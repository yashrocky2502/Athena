/**
 * ATHENA NEWS ENGINE — STAGE 8.4 EVIDENCE AGGREGATION & CONFLICT RESOLUTION
 * Aggregates evidence across articles for an event and manages numerical conflicts.
 */

import { NewsArticle } from '../types/Article';
import { NewsEvent, EventKeyNumber, ConflictingReport, ConflictStatus } from '../types/NewsEvent';
import { sourceAuthorityRanker } from './SourceAuthorityRanker';

export interface ExtractedEvidence {
  keyNumbers: EventKeyNumber[];
  hasNumericalConflict: boolean;
  conflictingReport?: ConflictingReport;
  preferredValue?: number;
  preferredSource?: string;
  confidence: number;
}

export class EventEvidenceAggregator {
  private static instance: EventEvidenceAggregator;

  private constructor() {}

  public static getInstance(): EventEvidenceAggregator {
    if (!EventEvidenceAggregator.instance) {
      EventEvidenceAggregator.instance = new EventEvidenceAggregator();
    }
    return EventEvidenceAggregator.instance;
  }

  /**
   * Extracts numerical evidence with full provenance from a news article.
   */
  public extractNumbersFromArticle(article: Partial<NewsArticle>): EventKeyNumber[] {
    const headline = article.headline || article.title || '';
    const body = article.body || (article as any).summary || (article as any).content || '';
    const text = `${headline} ${body}`;
    const publisher = article.source?.name || article.publisher || 'Unknown';
    const tier = (article.source as any)?.tier || sourceAuthorityRanker.getTier(publisher, article.sourceUrl);
    const sourceArticleId = article.id || `art_${Date.now()}`;

    const regex = /(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(crore|cr|lakh|lkh|billion|million|%)?/gi;
    const matches = Array.from(text.matchAll(regex));

    const results: EventKeyNumber[] = [];
    const seenValues = new Set<string>();

    for (const match of matches) {
      const rawText = match[0].trim();
      const numPart = match[1].replace(/,/g, '');
      const numValue = parseFloat(numPart);

      if (!isNaN(numValue) && numValue > 0) {
        const key = rawText.toLowerCase();
        if (!seenValues.has(key)) {
          seenValues.add(key);
          results.push({
            value: rawText,
            numValue,
            sourceArticleId,
            publisher,
            tier,
            extractedText: text.substring(Math.max(0, match.index! - 20), Math.min(text.length, match.index! + match[0].length + 20)),
            provenance: {
              articleId: sourceArticleId,
              publisher
            }
          });
        }
      }
    }

    return results;
  }

  /**
   * Extracts and aggregates numbers across multiple articles.
   */
  public extractAndAggregate(articles: Partial<NewsArticle>[]): ExtractedEvidence {
    const allNumbers: EventKeyNumber[] = [];
    for (const art of articles) {
      allNumbers.push(...this.extractNumbersFromArticle(art));
    }
    return {
      keyNumbers: allNumbers,
      hasNumericalConflict: false,
      confidence: 85
    };
  }

  /**
   * Aggregates key numbers from a new article into an existing event and detects numerical conflicts.
   */
  public aggregate(existingEvent: NewsEvent, newArticle: Partial<NewsArticle>): ExtractedEvidence {
    const newNumbers = this.extractNumbersFromArticle(newArticle);
    const publisher = newArticle.source?.name || newArticle.publisher || 'Unknown';
    const tier = (newArticle.source as any)?.tier || sourceAuthorityRanker.getTier(publisher, newArticle.sourceUrl);
    const sourceArticleId = newArticle.id || `art_${Date.now()}`;

    // Combine existing and new key numbers
    const allNumbers = [...existingEvent.keyNumbers, ...newNumbers];

    // Find main financial metrics (e.g. monetary values in Cr / Crore)
    const existingValNum = existingEvent.keyNumbers.find(k => k.numValue !== undefined && k.numValue > 10);
    const newValNum = newNumbers.find(k => k.numValue !== undefined && k.numValue > 10);

    let hasConflict = false;
    let conflictReport: ConflictingReport | undefined;
    let preferredValue: number | undefined = existingValNum?.numValue;
    let preferredSource: string | undefined = existingValNum?.publisher;
    let confidence = existingEvent.confidence || 80;

    if (existingValNum && newValNum && Math.abs(existingValNum.numValue! - newValNum.numValue!) > 1) {
      const pctDiff = Math.abs(existingValNum.numValue! - newValNum.numValue!) / Math.max(existingValNum.numValue!, newValNum.numValue!);
      
      if (pctDiff > 0.10) {
        // Material conflict detected
        hasConflict = true;

        conflictReport = {
          field: 'financialValue',
          reportA: {
            value: existingValNum.value,
            publisher: existingValNum.publisher,
            tier: existingValNum.tier,
            articleId: existingValNum.sourceArticleId,
            text: existingValNum.extractedText
          },
          reportB: {
            value: newValNum.value,
            publisher: newValNum.publisher,
            tier: newValNum.tier,
            articleId: sourceArticleId,
            text: newValNum.extractedText
          },
          conflictDetectedAt: new Date().toISOString()
        };

        // Conflict Resolution via Source Authority: Tier 1 outranks Tier 2/3
        if (newValNum.tier < existingValNum.tier) {
          // New official source (e.g. Tier 1 NSE filing) resolves conflict over media source
          preferredValue = newValNum.numValue;
          preferredSource = newValNum.publisher;
          confidence = 95;
          conflictReport.resolvedBy = newValNum.publisher;
          conflictReport.resolutionNote = `Resolved by higher authority Tier ${newValNum.tier} source (${newValNum.publisher})`;
        } else if (existingValNum.tier < newValNum.tier) {
          // Existing official source outranks new secondary source
          preferredValue = existingValNum.numValue;
          preferredSource = existingValNum.publisher;
          confidence = 95;
          conflictReport.resolvedBy = existingValNum.publisher;
          conflictReport.resolutionNote = `Maintained Tier ${existingValNum.tier} official value over lower tier report`;
        } else {
          // Same tier reporting conflicting values: Unresolved
          confidence = 60; // Reduce confidence due to conflict
        }
      }
    }

    return {
      keyNumbers: allNumbers,
      hasNumericalConflict: hasConflict,
      conflictingReport: conflictReport,
      preferredValue,
      preferredSource,
      confidence
    };
  }
}

export const eventEvidenceAggregator = EventEvidenceAggregator.getInstance();
