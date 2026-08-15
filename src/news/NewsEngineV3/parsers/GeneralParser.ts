/**
 * ATHENA NEWS ENGINE V3 — GENERAL FINANCIAL PARSER (FALLBACK)
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate } from './types/ParserTypes';

export class GeneralParser extends BaseFinancialParser {
  public readonly parserType = 'GeneralParser';

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
    const metrics: ExtractedMetric[] = [];

    // General fallback metric extraction
    const genMetric = this.extractMetricByKeywords(
      doc,
      'Market Metric',
      ['worth', 'valued at', 'reported', 'total'],
      'units'
    );
    if (genMetric) metrics.push(genMetric);

    return {
      metrics,
      entities: doc.companies.map((c) => ({
        name: c.name,
        type: 'COMPANY',
        confidence: c.confidence || 80,
        sourceSentence: doc.title
      })),
      quotes: this.extractQuotes(doc),
      businessEvents: [],
      dates: this.extractDates(doc),
      summaryFacts: [doc.title]
    };
  }
}
