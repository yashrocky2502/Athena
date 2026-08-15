/**
 * ATHENA NEWS ENGINE V3 — BULK DEAL PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, BulkDealData } from './types/ParserTypes';

export class BulkDealParser extends BaseFinancialParser {
  public readonly parserType = 'BulkDealParser';

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
    specificFields?: BulkDealData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    const dealMetric = this.extractMetricByKeywords(
      doc,
      'Deal Value',
      ['bulk deal', 'bought shares worth', 'sold shares worth', 'valued at'],
      'crore'
    );
    if (dealMetric) metrics.push(dealMetric);

    const priceMetric = this.extractMetricByKeywords(
      doc,
      'Average Price',
      ['at rs', 'avg price', 'price of rs', 'average price', 'at average price'],
      'INR'
    );
    if (priceMetric) metrics.push(priceMetric);

    let exchange: BulkDealData['exchange'] = null;
    if (/nse/i.test(text) && /bse/i.test(text)) exchange = 'BOTH';
    else if (/nse/i.test(text)) exchange = 'NSE';
    else if (/bse/i.test(text)) exchange = 'BSE';

    const specificFields: BulkDealData = {
      dealValueCrores: dealMetric?.value as number | null,
      averagePrice: priceMetric?.value as number | null,
      exchange
    };

    return {
      metrics,
      entities: [],
      quotes: [],
      businessEvents: [{
        eventType: 'BULK_DEAL',
        description: `Bulk deal worth ${dealMetric?.value || 'N/A'} cr on ${exchange || 'exchange'}`,
        sourceSentence: doc.title
      }],
      dates: this.extractDates(doc),
      summaryFacts: [`Bulk Deal Value: ${dealMetric?.value || 'N/A'} cr`],
      specificFields
    };
  }
}
