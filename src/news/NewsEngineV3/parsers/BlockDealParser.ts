/**
 * ATHENA NEWS ENGINE V3 — BLOCK DEAL PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, BlockDealData } from './types/ParserTypes';

export class BlockDealParser extends BaseFinancialParser {
  public readonly parserType = 'BlockDealParser';

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
    specificFields?: BlockDealData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Deal Value
    const dealMetric = this.extractMetricByKeywords(
      doc,
      'Deal Value',
      ['block deal', 'deal worth', 'shares worth', 'valued at'],
      'crore'
    );
    if (dealMetric) metrics.push(dealMetric);

    // Quantity / Shares
    const qtyMetric = this.extractMetricByKeywords(
      doc,
      'Share Quantity',
      ['shares', 'equity shares', 'stake of'],
      'shares'
    );
    if (qtyMetric) metrics.push(qtyMetric);

    // Average Price
    const priceMetric = this.extractMetricByKeywords(
      doc,
      'Average Price',
      ['at rs', 'avg price', 'price of rs', 'average price', 'at average price'],
      'INR'
    );
    if (priceMetric) metrics.push(priceMetric);

    let exchange: BlockDealData['exchange'] = null;
    if (/nse/i.test(text) && /bse/i.test(text)) exchange = 'BOTH';
    else if (/nse/i.test(text)) exchange = 'NSE';
    else if (/bse/i.test(text)) exchange = 'BSE';

    const specificFields: BlockDealData = {
      dealValueCrores: dealMetric?.value as number | null,
      quantity: qtyMetric?.value as number | null,
      averagePrice: priceMetric?.value as number | null,
      exchange
    };

    return {
      metrics,
      entities: [],
      quotes: [],
      businessEvents: [{
        eventType: 'BLOCK_DEAL',
        description: `Block deal worth ${dealMetric?.value || 'N/A'} cr on ${exchange || 'exchange'}`,
        sourceSentence: doc.title
      }],
      dates: this.extractDates(doc),
      summaryFacts: [`Block Deal Value: ${dealMetric?.value || 'N/A'} cr`, `Exchange: ${exchange || 'N/A'}`],
      specificFields
    };
  }
}
