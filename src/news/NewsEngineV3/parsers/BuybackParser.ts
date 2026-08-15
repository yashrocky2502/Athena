/**
 * ATHENA NEWS ENGINE V3 — BUYBACK PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, BuybackData } from './types/ParserTypes';

export class BuybackParser extends BaseFinancialParser {
  public readonly parserType = 'BuybackParser';

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
    specificFields?: BuybackData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Offer Price
    const priceMetric = this.extractMetricByKeywords(
      doc,
      'Buyback Offer Price',
      ['buyback price', 'price of rs', 'offer price'],
      'INR'
    );
    if (priceMetric) metrics.push(priceMetric);

    // Total Buyback Size
    const sizeMetric = this.extractMetricByKeywords(
      doc,
      'Buyback Size',
      ['buyback size', 'buyback worth', 'aggregate amount of', 'buyback of', 'total buyback'],
      'crore'
    );
    if (sizeMetric) metrics.push(sizeMetric);

    let mechanism: BuybackData['mechanism'] = null;
    if (/tender offer|tender route/i.test(text)) mechanism = 'TENDER_OFFER';
    else if (/open market/i.test(text)) mechanism = 'OPEN_MARKET';

    const dates = this.extractDates(doc);

    const specificFields: BuybackData = {
      offerPrice: priceMetric?.value as number | null,
      buybackSizeCrores: sizeMetric?.value as number | null,
      mechanism,
      recordDate: dates.find((d) => /record date/i.test(d.label))?.date
    };

    return {
      metrics,
      entities: [],
      quotes: [],
      businessEvents: [{
        eventType: 'BUYBACK',
        description: `Share Buyback announced at Rs ${priceMetric?.value || 'N/A'} per share`,
        sourceSentence: doc.title
      }],
      dates,
      summaryFacts: [`Buyback Price: ${priceMetric?.value || 'N/A'}`, `Buyback Size: ${sizeMetric?.value || 'N/A'} cr`],
      specificFields
    };
  }
}
