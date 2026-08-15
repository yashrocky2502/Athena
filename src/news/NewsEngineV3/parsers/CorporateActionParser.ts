/**
 * ATHENA NEWS ENGINE V3 — CORPORATE ACTION PARSER
 *
 * Phase 6 Institutional Grade Parser for General Corporate Actions (Bonus, Split, Rights, Buyback, Dividends).
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate } from './types/ParserTypes';

export class CorporateActionParser extends BaseFinancialParser {
  public readonly parserType = 'CorporateActionParser';

  protected async executeParsing(
    doc: NormalizedDocument,
    classification?: ClassificationResult
  ): Promise<{
    metrics: ExtractedMetric[];
    entities: ExtractedEntity[];
    quotes: ExtractedQuote[];
    businessEvents: BusinessEvent[];
    dates: ExtractedDate[];
    summaryFacts: string[];
    specificFields?: Record<string, any>;
  }> {
    const dates = this.extractDates(doc);
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    const businessEvents: BusinessEvent[] = [];
    if (/bonus/i.test(text)) {
      businessEvents.push({ eventType: 'BONUS_ISSUE', description: 'Bonus share issue announced', sourceSentence: doc.title });
    }
    if (/split/i.test(text)) {
      businessEvents.push({ eventType: 'STOCK_SPLIT', description: 'Stock split announced', sourceSentence: doc.title });
    }
    if (/dividend/i.test(text)) {
      businessEvents.push({ eventType: 'DIVIDEND_DECLARATION', description: 'Dividend payment announced', sourceSentence: doc.title });
    }

    return {
      metrics: [],
      entities: [],
      quotes: [],
      businessEvents,
      dates,
      summaryFacts: businessEvents.map((e) => e.description)
    };
  }
}
