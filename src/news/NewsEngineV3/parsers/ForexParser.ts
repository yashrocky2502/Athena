/**
 * ATHENA NEWS ENGINE V3 — FOREX & CURRENCY PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, ForexData } from './types/ParserTypes';

export class ForexParser extends BaseFinancialParser {
  public readonly parserType = 'ForexParser';

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
    specificFields?: ForexData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    let pair = 'USDINR';
    if (/usdinr|rupee vs dollar|rupee opens|rupee closes|rupee/i.test(text)) pair = 'USDINR';
    else if (/eurinr|euro/i.test(text)) pair = 'EURINR';
    else if (/gbpinr|pound/i.test(text)) pair = 'GBPINR';

    const rateMetric = this.extractMetricByKeywords(
      doc,
      `${pair} Rate`,
      ['rupee at', 'traded at', 'closed at', 'opened at', 'rupee dollar', 'flat at'],
      'INR'
    );
    if (rateMetric) metrics.push(rateMetric);

    const dxyMetric = this.extractMetricByKeywords(
      doc,
      'Dollar Index (DXY)',
      ['dollar index', 'dxy'],
      'index'
    );
    if (dxyMetric) metrics.push(dxyMetric);

    const yieldMetric = this.extractMetricByKeywords(
      doc,
      '10-Year Bond Yield',
      ['10-year yield', 'bond yield', 'treasury yield'],
      'percent'
    );
    if (yieldMetric) metrics.push(yieldMetric);

    let rate = rateMetric?.value as number | null;
    if (rate === null) {
      const rateMatch = text.match(/(?:at|traded at|closed at|opened at|rate of|rupee flat at|closed flat at)\s*([\d.]+)/i);
      if (rateMatch) {
        rate = parseFloat(rateMatch[1]);
      }
    }

    const specificFields: ForexData = {
      pair,
      rate,
      dollarIndex: dxyMetric?.value as number | null,
      tenYearYieldPercent: yieldMetric?.value as number | null
    };

    return {
      metrics,
      entities: [{
        name: pair,
        type: 'CURRENCY',
        confidence: 95,
        sourceSentence: doc.title
      }],
      quotes: [],
      businessEvents: [],
      dates: this.extractDates(doc),
      summaryFacts: [`Forex Pair: ${pair}`, `Rate: ${rateMetric?.value || 'N/A'}`],
      specificFields
    };
  }
}
