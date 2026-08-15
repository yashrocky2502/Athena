/**
 * ATHENA NEWS ENGINE V3 — IPO PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, IPOData } from './types/ParserTypes';

export class IPOParser extends BaseFinancialParser {
  public readonly parserType = 'IPOParser';

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
    specificFields?: IPOData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Issue Size
    const issueSizeMetric = this.extractMetricByKeywords(
      doc,
      'Issue Size',
      ['ipo size', 'issue size', 'plans to raise', 'ipo worth'],
      'crore'
    );
    if (issueSizeMetric) metrics.push(issueSizeMetric);

    // Price Band
    const priceBandMetric = this.extractMetricByKeywords(
      doc,
      'Price Band',
      ['price band', 'issue price', 'price range'],
      'INR'
    );
    if (priceBandMetric) metrics.push(priceBandMetric);

    // Subscription Times
    const subMetric = this.extractMetricByKeywords(
      doc,
      'Subscription',
      ['subscribed', 'subscription of', 'times subscribed'],
      'times'
    );
    if (subMetric) metrics.push(subMetric);

    // GMP
    const gmpMetric = this.extractMetricByKeywords(
      doc,
      'Grey Market Premium',
      ['gmp', 'grey market premium'],
      'INR'
    );
    if (gmpMetric) metrics.push(gmpMetric);

    const dates = this.extractDates(doc);

    const specificFields: IPOData = {
      issueSizeCrores: issueSizeMetric?.value as number | null,
      priceBandMin: priceBandMetric?.value as number | null,
      subscriptionTimes: subMetric?.value as number | null,
      gmpAmount: gmpMetric?.value as number | null,
      listingDate: dates.find((d) => /listing/i.test(d.label))?.date
    };

    return {
      metrics,
      entities: [],
      quotes: [],
      businessEvents: [{
        eventType: 'IPO',
        description: `IPO issue size ${issueSizeMetric?.value || 'N/A'} cr, subscribed ${subMetric?.value || 'N/A'}x`,
        sourceSentence: doc.title
      }],
      dates,
      summaryFacts: [`IPO Size: ${issueSizeMetric?.value || 'N/A'} cr`, `Subscription: ${subMetric?.value || 'N/A'}x`],
      specificFields
    };
  }
}
