/**
 * ATHENA NEWS ENGINE V3 — COMMODITY PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, CommodityData } from './types/ParserTypes';

export class CommodityParser extends BaseFinancialParser {
  public readonly parserType = 'CommodityParser';

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
    specificFields?: CommodityData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    let commodityName = 'Commodity';
    if (/gold/i.test(text)) commodityName = 'Gold';
    else if (/silver/i.test(text)) commodityName = 'Silver';
    else if (/crude|oil|brent/i.test(text)) commodityName = 'Crude Oil';
    else if (/copper/i.test(text)) commodityName = 'Copper';
    else if (/natural gas/i.test(text)) commodityName = 'Natural Gas';
    else if (/aluminium/i.test(text)) commodityName = 'Aluminium';

    const priceMetric = this.extractMetricByKeywords(
      doc,
      `${commodityName} Price`,
      ['traded at', 'price at', 'futures at', 'per ounce', 'per barrel', 'per 10g'],
      'USD'
    );
    if (priceMetric) metrics.push(priceMetric);

    const changeMetric = this.extractMetricByKeywords(
      doc,
      'Price Change',
      ['gained', 'rose by', 'fell by', 'dropped', 'up', 'down'],
      'percent'
    );
    if (changeMetric) metrics.push(changeMetric);

    let direction: CommodityData['movementDirection'] = 'FLAT';
    if (/rose|gained|higher|up|surged/i.test(text)) direction = 'UP';
    else if (/fell|dropped|lower|down|declined/i.test(text)) direction = 'DOWN';

    const specificFields: CommodityData = {
      commodityName,
      price: priceMetric?.value as number | null,
      priceChangePercent: changeMetric?.value as number | null,
      movementDirection: direction
    };

    return {
      metrics,
      entities: [{
        name: commodityName,
        type: 'COMMODITY',
        confidence: 95,
        sourceSentence: doc.title
      }],
      quotes: [],
      businessEvents: [],
      dates: this.extractDates(doc),
      summaryFacts: [`Commodity: ${commodityName}`, `Price: ${priceMetric?.value || 'N/A'}`],
      specificFields
    };
  }
}
