/**
 * ATHENA NEWS ENGINE V3 — FUND RAISE PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, FundRaiseData } from './types/ParserTypes';

export class FundRaiseParser extends BaseFinancialParser {
  public readonly parserType = 'FundRaiseParser';

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
    specificFields?: FundRaiseData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Amount
    const amountMetric = this.extractMetricByKeywords(
      doc,
      'Fund Raise Amount',
      ['raise rs', 'raising', 'raise up to', 'fund raise of', 'qip of'],
      'crore'
    );
    if (amountMetric) metrics.push(amountMetric);

    // Floor / Issue price
    const floorPriceMetric = this.extractMetricByKeywords(
      doc,
      'Floor Price',
      ['floor price of', 'issue price of', 'fixed at rs'],
      'INR'
    );
    if (floorPriceMetric) metrics.push(floorPriceMetric);

    let mode: FundRaiseData['mode'] = null;
    if (/qip|qualified institutional placement/i.test(text)) mode = 'QIP';
    else if (/rights issue/i.test(text)) mode = 'RIGHTS_ISSUE';
    else if (/bonds|debentures|ncd|debt/i.test(text)) mode = 'DEBT';
    else if (/preferential/i.test(text)) mode = 'PREFERENTIAL_ISSUE';

    const specificFields: FundRaiseData = {
      mode,
      amountCrores: amountMetric?.value as number | null,
      floorPrice: floorPriceMetric?.value as number | null
    };

    return {
      metrics,
      entities: [],
      quotes: [],
      businessEvents: [{
        eventType: 'FUND_RAISE',
        description: `Fund raise via ${mode || 'equity'} of ${amountMetric?.value || 'N/A'} cr`,
        sourceSentence: doc.title
      }],
      dates: this.extractDates(doc),
      summaryFacts: [`Fund Raise Amount: ${amountMetric?.value || 'N/A'} cr`, `Mode: ${mode || 'N/A'}`],
      specificFields
    };
  }
}
