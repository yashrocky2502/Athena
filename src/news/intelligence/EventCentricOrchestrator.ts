/**
 * ATHENA NEWS ENGINE — STAGE 8.4 EVENT-CENTRIC LIVE INTELLIGENCE ORCHESTRATOR
 * Orchestrates event creation, source aggregation, conflict resolution, material change detection,
 * state machine transitions, cost protection, and Telegram delivery eligibility.
 */

import { NewsArticle } from '../types/Article';
import { NewsEvent, EventStatus, EventPriority, EventFreshness, EventSourceRef } from '../types/NewsEvent';
import { EventFingerprintEngine } from '../deduplication/EventFingerprintEngine';
import { sourceAuthorityRanker } from './SourceAuthorityRanker';
import { eventEvidenceAggregator } from './EventEvidenceAggregator';
import { eventEscalationDetector } from './EventEscalationDetector';
import { EventStateMachine } from './EventStateMachine';

export interface EventOrchestrationResult {
  event: NewsEvent;
  isNewEvent: boolean;
  isDuplicate: boolean;
  isMaterialUpdate: boolean;
  isEscalation: boolean;
  hasConflict: boolean;
  shouldDispatchTelegram: boolean;
  telegramAction?: 'NEW_EVENT' | 'EVENT_UPDATE' | 'EVENT_ESCALATION' | 'CONFLICT_DETECTED' | 'SKIP';
  reason?: string;
}

export class EventCentricOrchestrator {
  private static instance: EventCentricOrchestrator;
  private eventsByFingerprint: Map<string, NewsEvent> = new Map();
  private eventsById: Map<string, NewsEvent> = new Map();

  private constructor() {}

  public static getInstance(): EventCentricOrchestrator {
    if (!EventCentricOrchestrator.instance) {
      EventCentricOrchestrator.instance = new EventCentricOrchestrator();
    }
    return EventCentricOrchestrator.instance;
  }

  public static resetInstance(): EventCentricOrchestrator {
    EventCentricOrchestrator.instance = new EventCentricOrchestrator();
    return EventCentricOrchestrator.instance;
  }

  /**
   * Main entry point: Process an incoming article into the event-centric architecture.
   */
  public processArticle(article: Partial<NewsArticle>): EventOrchestrationResult {
    const fingerprintEngine = EventFingerprintEngine.getInstance();
    const { fingerprint, primaryEntity, symbol, eventType, keyNumbers } = fingerprintEngine.generateFingerprint(article);

    const publisher = article.source?.name || article.publisher || 'Unknown';
    const sourceUrl = article.sourceUrl || article.source?.url || article.url || '';
    const headline = article.headline || article.title || '';
    const tier = (article.source as any)?.tier || sourceAuthorityRanker.getTier(publisher, sourceUrl);
    const publishedAt = article.publishedAt || new Date().toISOString();
    const articleId = article.id || `art_${Date.now()}`;

    const sourceRef: EventSourceRef = {
      publisher,
      sourceUrl,
      headline,
      tier,
      publishedAt,
      articleId
    };

    let existingEvent = this.eventsByFingerprint.get(fingerprint);

    // 1. NEW EVENT
    if (!existingEvent) {
      const extractedNumbers = eventEvidenceAggregator.extractNumbersFromArticle(article);
      const isOfficialTier = tier === 1;

      // Determine initial priority
      let eventPriority: EventPriority = 'P3';
      const fullText = `${headline} ${(article.body || (article as any).summary || '')}`.toLowerCase();
      const isFno = (article as any).isFno || /options|futures|strike|open interest|\boi\b|pcr|\biv\b/i.test(fullText);

      if (isOfficialTier || (isFno && /breaking|surge|ban|action/i.test(fullText))) {
        eventPriority = 'P0';
      } else if (isFno || /order|wins|profit|earnings|results|q[1-4]|buyback|m&a/i.test(fullText)) {
        eventPriority = 'P1';
      } else if (/market|stocks|shares|nifty|sensex/i.test(fullText)) {
        eventPriority = 'P2';
      }

      const initialStatus: EventStatus = isOfficialTier ? 'CONFIRMED' : 'NEW';

      const newEvent: NewsEvent = {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        eventFingerprint: fingerprint,
        primaryEntity: primaryEntity || 'Market',
        symbol: symbol || 'MARKET',
        category: article.category || article.primaryCategory || 'Corporate',
        eventType: eventType || 'CORPORATE_NEWS',
        firstSeenAt: publishedAt,
        lastUpdatedAt: publishedAt,
        latestArticleId: articleId,
        sourceArticleIds: [articleId],
        primarySource: sourceRef,
        supportingSources: [sourceRef],
        sourceCount: 1,
        eventStatus: initialStatus,
        eventPriority,
        eventFreshness: 'BREAKING',
        confidence: isOfficialTier ? 95 : 80,
        materialChangeDetected: false,
        escalationLevel: 0,
        conflictStatus: 'NONE',
        canonicalSummary: {
          whatHappened: headline,
          whyItMatters: `High market impact event for ${primaryEntity || 'market'}`,
          keyNumbers: extractedNumbers.map(k => k.value)
        },
        keyNumbers: extractedNumbers,
        telegramState: 'PENDING',
        traderIntelligenceAvailable: isFno || eventPriority === 'P0' || eventPriority === 'P1',
        history: [{
          timestamp: publishedAt,
          previousStatus: 'NEW',
          newStatus: initialStatus,
          reason: 'Initial event report discovered',
          triggerArticleId: articleId
        }]
      };

      this.eventsByFingerprint.set(fingerprint, newEvent);
      this.eventsById.set(newEvent.eventId, newEvent);

      // Telegram dispatch decision for new high-signal event
      const shouldDispatchTelegram = eventPriority === 'P0' || eventPriority === 'P1' || isFno;

      return {
        event: newEvent,
        isNewEvent: true,
        isDuplicate: false,
        isMaterialUpdate: false,
        isEscalation: false,
        hasConflict: false,
        shouldDispatchTelegram,
        telegramAction: shouldDispatchTelegram ? 'NEW_EVENT' : 'SKIP',
        reason: 'New event created'
      };
    }

    // 2. EXISTING EVENT -> EVOLVING EVIDENCE
    existingEvent.sourceCount += 1;
    existingEvent.lastUpdatedAt = publishedAt;
    existingEvent.latestArticleId = articleId;
    if (!existingEvent.sourceArticleIds.includes(articleId)) {
      existingEvent.sourceArticleIds.push(articleId);
    }

    // Add supporting source if not already added
    if (!existingEvent.supportingSources.some(s => s.publisher === publisher || (sourceUrl && s.sourceUrl === sourceUrl))) {
      existingEvent.supportingSources.push(sourceRef);
    }

    // Update primary source if new source has higher authority (lower tier)
    if (tier < existingEvent.primarySource.tier) {
      existingEvent.primarySource = sourceRef;
      if (existingEvent.eventStatus === 'NEW') {
        existingEvent = EventStateMachine.transition(existingEvent, 'CONFIRMED', `Confirmed by Tier ${tier} source (${publisher})`, articleId);
      }
    }

    // Evidence Aggregation & Conflict Check
    const evidence = eventEvidenceAggregator.aggregate(existingEvent, article);
    existingEvent.keyNumbers = evidence.keyNumbers;

    if (evidence.hasNumericalConflict) {
      existingEvent.conflictStatus = 'CONFLICTING_REPORTS';
      if (evidence.conflictingReport) {
        existingEvent.conflictingReports = [...(existingEvent.conflictingReports || []), evidence.conflictingReport];
      }
      existingEvent = EventStateMachine.transition(existingEvent, 'CONFLICTED', 'Conflicting numerical values reported across sources', articleId);
    }

    // Material Escalation Check
    const escalation = eventEscalationDetector.evaluate(existingEvent, article);

    let isMaterialUpdate = escalation.isMaterialChange;
    let isEscalation = escalation.isEscalation;
    let telegramAction: 'NEW_EVENT' | 'EVENT_UPDATE' | 'EVENT_ESCALATION' | 'CONFLICT_DETECTED' | 'SKIP' = 'SKIP';
    let shouldDispatchTelegram = false;

    if (evidence.hasNumericalConflict && existingEvent.telegramState !== 'CONFLICT_SENT') {
      shouldDispatchTelegram = true;
      telegramAction = 'CONFLICT_DETECTED';
    } else if (isEscalation) {
      existingEvent.escalationLevel = escalation.newEscalationLevel;
      existingEvent = EventStateMachine.transition(existingEvent, 'ESCALATED', escalation.reason || 'Event escalated', articleId, escalation.whatChanged);
      shouldDispatchTelegram = true;
      telegramAction = 'EVENT_ESCALATION';
    } else if (isMaterialUpdate) {
      existingEvent = EventStateMachine.transition(existingEvent, 'UPDATED', escalation.reason || 'Material update', articleId, escalation.whatChanged);
      shouldDispatchTelegram = true;
      telegramAction = 'EVENT_UPDATE';
    }

    this.eventsByFingerprint.set(fingerprint, existingEvent);
    this.eventsById.set(existingEvent.eventId, existingEvent);

    return {
      event: existingEvent,
      isNewEvent: false,
      isDuplicate: !isMaterialUpdate && !isEscalation && !evidence.hasNumericalConflict,
      isMaterialUpdate,
      isEscalation,
      hasConflict: evidence.hasNumericalConflict,
      shouldDispatchTelegram,
      telegramAction,
      reason: escalation.reason || (evidence.hasNumericalConflict ? 'Conflict detected' : 'Duplicate coverage added to event')
    };
  }

  public getEventById(eventId: string): NewsEvent | undefined {
    return this.eventsById.get(eventId);
  }

  public getEventByFingerprint(fingerprint: string): NewsEvent | undefined {
    return this.eventsByFingerprint.get(fingerprint);
  }

  public getAllEvents(): NewsEvent[] {
    return Array.from(this.eventsById.values());
  }

  public reset(): void {
    this.eventsByFingerprint.clear();
    this.eventsById.clear();
  }
}

export const eventCentricOrchestrator = EventCentricOrchestrator.getInstance();
