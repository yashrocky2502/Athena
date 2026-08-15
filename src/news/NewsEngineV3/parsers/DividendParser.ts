/**
 * ATHENA NEWS ENGINE V3 — DIVIDEND PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, DividendData } from './types/ParserTypes';

export class DividendParser extends BaseFinancialParser {
  public readonly parserType = 'DividendParser';

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
    specificFields?: DividendData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // 1. Dividend Amount
    const divMetric = this.extractMetricByKeywords(
      doc,
      'Dividend Per Share',
      ['dividend of', 'dividend at', 'dividend per share', 'dps of'],
      'per share'
    );
    if (divMetric) metrics.push(divMetric);

    // 2. Dividend Yield
    const yieldMetric = this.extractMetricByKeywords(
      doc,
      'Dividend Yield',
      ['dividend yield', 'yield of'],
      'percent'
    );
    if (yieldMetric) metrics.push(yieldMetric);

    let type: DividendData['type'] = 'DEFAULT';
    if (/interim/i.test(text)) type = 'INTERIM';
    else if (/final/i.test(text)) type = 'FINAL';
    else if (/special/i.test(text)) type = 'SPECIAL';

    const dates = this.extractDates(doc);
    const recDate = dates.find((d) => /record date/i.test(d.label))?.date;
    const exDate = dates.find((d) => /ex-date|ex date/i.test(d.label))?.date;

    const specificFields: DividendData = {
      dividendAmountPerShare: divMetric?.value as number | null,
      dividendYieldPercent: yieldMetric?.value as number | null,
      type,
      recordDate: recDate,
      exDate
    };

    return {
      metrics,
      entities: [],
      quotes: [],
      businessEvents: [{
        eventType: 'DIVIDEND',
        description: `Dividend announced: ${divMetric?.value || ''} per share (${type})`,
        sourceSentence: doc.title
      }],
      dates,
      summaryFacts: [`Dividend: ${divMetric?.value || 'N/A'} per share`],
      specificFields
    };
  }
}
