/**
 * ATHENA NEWS ENGINE — STAGE 8.4 EVENT FINGERPRINT & DEDUPLICATION ENGINE
 * Deterministic cross-source event fingerprinting, event relation classification,
 * update/escalation detection, and source conflict resolution.
 */

import { NewsArticle } from '../types/Article';
import { sourceAuthorityRanker } from '../intelligence/SourceAuthorityRanker';
import { NewsEvent } from '../types/NewsEvent';

export type EventRelation = 'NEW_EVENT' | 'DUPLICATE_EVENT' | 'EVENT_UPDATE' | 'EVENT_ESCALATION';

export interface EventSourceRef {
  publisher: string;
  sourceUrl: string;
  headline: string;
  tier: number;
  publishedAt: string;
  articleId?: string;
}

export interface ConflictingField {
  field: string;
  valueA: any;
  sourceA: string;
  valueB: any;
  sourceB: string;
}

export interface NewsEventRecord {
  eventId: string;
  fingerprint: string;
  primaryEntity: string;
  eventType: string;
  primaryHeadline: string;
  keyNumbers: string[];
  firstDiscoveredAt: string;
  lastUpdatedAt: string;
  sources: EventSourceRef[];
  primarySourceTier: number;
  hasConflict: boolean;
  conflictingFields?: ConflictingField[];
  financialValue?: number; // e.g. order value or profit amount in Cr
  articlesCount: number;
}

export interface EventEvaluationResult {
  eventId: string;
  eventRelation: EventRelation;
  fingerprint: string;
  shouldDispatchAlert: boolean;
  eventRecord: NewsEventRecord;
  hasConflict: boolean;
  reason?: string;
}

export class EventFingerprintEngine {
  private static instance: EventFingerprintEngine | null = null;
  private eventsMap: Map<string, NewsEventRecord> = new Map(); // fingerprint -> NewsEventRecord

  private constructor() {}

  public static getInstance(): EventFingerprintEngine {
    if (!EventFingerprintEngine.instance) {
      EventFingerprintEngine.instance = new EventFingerprintEngine();
    }
    return EventFingerprintEngine.instance;
  }

  public static resetInstance(): EventFingerprintEngine {
    EventFingerprintEngine.instance = new EventFingerprintEngine();
    return EventFingerprintEngine.instance;
  }

  /**
   * Generates a deterministic event fingerprint string based on primary entity, event type, key keywords, and financial metrics.
   */
  public generateFingerprint(article: Partial<NewsArticle>): {
    fingerprint: string;
    primaryEntity: string;
    symbol: string;
    eventType: string;
    keyNumbers: string[];
    numericalValue?: number;
  } {
    const headline = (article.headline || article.title || '').trim();
    const body = (article.body || (article as any).summary || (article as any).content || '').trim();
    const fullText = `${headline} ${body}`.toLowerCase();

    // 1. Extract Primary Entity & Symbol
    let primaryEntity = (article.symbol || '').toUpperCase().trim();
    let symbol = primaryEntity;

    if (!primaryEntity || primaryEntity === 'UNKNOWN') {
      if (/\btata motors\b/i.test(fullText)) { primaryEntity = 'TATA MOTORS'; symbol = 'TATAMOTORS'; }
      else if (/\breliance\b|\bril\b/i.test(fullText)) { primaryEntity = 'RELIANCE'; symbol = 'RELIANCE'; }
      else if (/\binfosys\b|\binfy\b/i.test(fullText)) { primaryEntity = 'INFOSYS'; symbol = 'INFY'; }
      else if (/\blarsen\b|\bl&t\b|\blarsen & toubro\b/i.test(fullText)) { primaryEntity = 'L&T'; symbol = 'LT'; }
      else if (/\btcs\b|\btata consultancy\b/i.test(fullText)) { primaryEntity = 'TCS'; symbol = 'TCS'; }
      else if (/\bbharti airtel\b|\bairtel\b/i.test(fullText)) { primaryEntity = 'BHARTI AIRTEL'; symbol = 'BHARTIARTL'; }
      else if (/\bhdfc bank\b/i.test(fullText)) { primaryEntity = 'HDFC BANK'; symbol = 'HDFCBANK'; }
      else if (/\bicici bank\b/i.test(fullText)) { primaryEntity = 'ICICI BANK'; symbol = 'ICICIBANK'; }
      else if (/\bsbi\b|\bstate bank of india\b/i.test(fullText)) { primaryEntity = 'SBI'; symbol = 'SBIN'; }
      else if (/\badani\b/i.test(fullText)) { primaryEntity = 'ADANI'; symbol = 'ADANIENT'; }
      else {
        // Fallback entity from headline first word if uppercase ticker-like, otherwise GENERIC
        const firstWord = headline.split(' ')[0]?.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (firstWord && firstWord.length >= 2 && firstWord.length <= 10 && !/^(THE|AND|FOR|WITH|THIS|THAT|MORE|NEWS|NEW|STOCK|MARKET|INDIA|GLOBAL)$/.test(firstWord)) {
          primaryEntity = firstWord;
          symbol = firstWord;
        } else {
          primaryEntity = 'GENERIC';
          symbol = 'GENERIC';
        }
      }
    }

    // 2. Extract Event Type
    let eventType = (article.eventType || article.primaryCategory || '').toUpperCase();
    if (/\border\b|\bbags\b|\bwins\b|\bcontract\b|\bsecures\b|\bdeal\b/i.test(fullText)) {
      eventType = 'ORDER_WIN';
    } else if (/\bearnings\b|\bq[1-4]\b|\bnet profit\b|\brevenue\b|\bresults\b|\bnet income\b|\byoy\b|\bqoq\b/i.test(fullText)) {
      eventType = 'EARNINGS';
    } else if (/\bpromoter\b|\bstake\b|\bbuys shares\b|\bpromoter group\b|\bincreases stake\b|\binsider\b|\bacquires shares\b/i.test(fullText)) {
      eventType = 'PROMOTER_TRANSACTION';
    } else if (/\bacquisition\b|\bmerger\b|\bacquires\b|\btakeover\b|\bm&a\b/i.test(fullText)) {
      eventType = 'ACQUISITION';
    } else if (/\bsebi\b|\brbi\b|\bpenalty\b|\bcircular\b|\bregulatory\b|\bban\b|\binquiry\b|\bnotice\b/i.test(fullText)) {
      eventType = 'REGULATORY';
    } else if (/\bbuyback\b|\bshare buyback\b/i.test(fullText)) {
      eventType = 'BUYBACK';
    } else if (/\bguidance\b|\boutlook\b|\bforecast\b/i.test(fullText)) {
      eventType = 'GUIDANCE';
    } else if (/\btelecom plan\b|\btariff\b|\b5g\b|\bproduct launch\b|\bplans\b/i.test(fullText)) {
      eventType = 'PRODUCT_LAUNCH';
    } else if (/\bblock deal\b|\bbulk deal\b/i.test(fullText)) {
      eventType = 'BLOCK_DEAL';
    } else if (/\brating\b|\btarget price\b|\bupgrade\b|\bdowngrade\b/i.test(fullText)) {
      eventType = 'RATING_CHANGE';
    } else if (!eventType || eventType === 'GENERAL') {
      eventType = 'CORPORATE_NEWS';
    }

    // 3. Extract Key Numerical Values (e.g. ₹2,500 crore, 500 cr, 100%)
    const rawNumbers = fullText.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(crore|cr|lakh|lkh|billion|million|%)?/gi) || [];
    const keyNumbers: string[] = [];
    let numericalValue: number | undefined;

    for (const numStr of rawNumbers) {
      const clean = numStr.replace(/[^0-9.]/g, '');
      if (clean && parseFloat(clean) > 0) {
        const normalizedToken = numStr.replace(/^(?:₹|rs\.?|inr)\s*/i, '').replace(/\s+/g, '').toLowerCase();
        keyNumbers.push(normalizedToken);
        if (!numericalValue || parseFloat(clean) > numericalValue) {
          numericalValue = parseFloat(clean);
        }
      }
    }

    // 4. Construct Deterministic Event Fingerprint
    let fingerprint: string;
    if (primaryEntity === 'GENERIC') {
      // For general articles without a company entity, combine headline hash / id to prevent false collisions
      const hash = this.simpleHash(headline || article.id || 'article');
      fingerprint = `evt_generic_${eventType.toLowerCase()}_${hash}`;
    } else {
      // Ticker + EventType gives deterministic grouping
      const normalizedSym = symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
      fingerprint = `evt_${normalizedSym}_${eventType.toLowerCase()}`;
    }

    return {
      fingerprint,
      primaryEntity,
      symbol,
      eventType,
      keyNumbers,
      numericalValue
    };
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  /**
   * Processes an incoming article through event fingerprinting, cross-source deduplication, and conflict detection.
   */
  public evaluateEvent(article: Partial<NewsArticle>): EventEvaluationResult {
    const { fingerprint, primaryEntity, symbol, eventType, keyNumbers, numericalValue } = this.generateFingerprint(article);

    const publisher = article.source?.name || article.publisher || 'Unknown';
    const sourceUrl = article.sourceUrl || article.source?.url || article.url || '';
    const headline = article.headline || article.title || '';
    const tier = (article.source as any)?.tier || sourceAuthorityRanker.getTier(publisher, sourceUrl);
    const publishedAt = article.publishedAt || new Date().toISOString();
    const articleId = article.id || `art_${Date.now()}`;

    const existingEvent = this.eventsMap.get(fingerprint);

    // 1. NEW_EVENT: First time this fingerprint is seen
    if (!existingEvent) {
      const newRecord: NewsEventRecord = {
        eventId: `evt_id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fingerprint,
        primaryEntity,
        eventType,
        primaryHeadline: headline,
        keyNumbers,
        firstDiscoveredAt: publishedAt,
        lastUpdatedAt: publishedAt,
        sources: [{ publisher, sourceUrl, headline, tier, publishedAt, articleId }],
        primarySourceTier: tier,
        hasConflict: false,
        financialValue: numericalValue,
        articlesCount: 1
      };

      this.eventsMap.set(fingerprint, newRecord);

      return {
        eventId: newRecord.eventId,
        eventRelation: 'NEW_EVENT',
        fingerprint,
        shouldDispatchAlert: true,
        eventRecord: newRecord,
        hasConflict: false,
        reason: 'New event fingerprint detected across feeds'
      };
    }

    // 2. Existing Event Found
    existingEvent.articlesCount++;
    existingEvent.lastUpdatedAt = publishedAt;

    // Check if source already registered
    const sourceExists = existingEvent.sources.some(s => s.publisher === publisher || (Boolean(sourceUrl) && s.sourceUrl === sourceUrl));
    if (!sourceExists) {
      existingEvent.sources.push({ publisher, sourceUrl, headline, tier, publishedAt, articleId });
    }

    // Conflict Detection (numerical conflict e.g. ₹2000 Cr vs ₹2500 Cr)
    let hasConflict = existingEvent.hasConflict;
    const conflictingFields: ConflictingField[] = existingEvent.conflictingFields || [];

    if (numericalValue !== undefined && existingEvent.financialValue !== undefined && Math.abs(numericalValue - existingEvent.financialValue) > 5) {
      const isDiff = Math.abs(numericalValue - existingEvent.financialValue) / Math.max(numericalValue, existingEvent.financialValue) > 0.15;
      if (isDiff) {
        hasConflict = true;
        existingEvent.hasConflict = true;
        conflictingFields.push({
          field: 'financialValue',
          valueA: existingEvent.financialValue,
          sourceA: existingEvent.sources[0]?.publisher || 'Primary Source',
          valueB: numericalValue,
          sourceB: publisher
        });
        existingEvent.conflictingFields = conflictingFields;
      }
    }

    // Classify Relation (DUPLICATE_EVENT vs EVENT_UPDATE vs EVENT_ESCALATION)
    let eventRelation: EventRelation = 'DUPLICATE_EVENT';
    let shouldDispatchAlert = false;
    let reason = 'Duplicate event report across multiple news sources';

    if (numericalValue !== undefined && existingEvent.financialValue !== undefined && numericalValue > existingEvent.financialValue * 1.2) {
      // Event Escalation
      eventRelation = 'EVENT_ESCALATION';
      shouldDispatchAlert = true;
      reason = `Event escalation: Financial catalyst value increased from ₹${existingEvent.financialValue} to ₹${numericalValue}`;
      existingEvent.financialValue = numericalValue;
    } else if (/\bconfirms\b|\btimeline\b|\bdetails\b|\brevised\b|\bescalates\b/i.test(headline)) {
      // Material Event Update
      eventRelation = 'EVENT_UPDATE';
      shouldDispatchAlert = true;
      reason = 'Event update containing newly confirmed operational or execution timeline details';
    }

    return {
      eventId: existingEvent.eventId,
      eventRelation,
      fingerprint,
      shouldDispatchAlert,
      eventRecord: existingEvent,
      hasConflict,
      reason
    };
  }

  public getRecentEvents(limit: number = 50): NewsEventRecord[] {
    return Array.from(this.eventsMap.values()).slice(0, limit);
  }

  public getEventByFingerprint(fingerprint: string): NewsEventRecord | undefined {
    return this.eventsMap.get(fingerprint);
  }

  public reset(): void {
    this.eventsMap.clear();
  }
}

export const eventFingerprintEngine = EventFingerprintEngine.getInstance();
