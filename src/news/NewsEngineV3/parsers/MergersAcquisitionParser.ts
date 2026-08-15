/**
 * ATHENA NEWS ENGINE V3 — MERGERS & ACQUISITIONS PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, MergersAcquisitionData } from './types/ParserTypes';

export class MergersAcquisitionParser extends BaseFinancialParser {
  public readonly parserType = 'MergersAcquisitionParser';

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
    specificFields?: MergersAcquisitionData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Deal Value
    const dealMetric = this.extractMetricByKeywords(
      doc,
      'Deal Value',
      ['deal value', 'deal worth', 'acquisition cost', 'bought for', 'valued at'],
      'crore'
    );
    if (dealMetric) metrics.push(dealMetric);

    // Stake %
    const stakeMetric = this.extractMetricByKeywords(
      doc,
      'Stake Percentage',
      ['stake', 'equity stake', 'holding of', 'percent stake'],
      'percent'
    );
    if (stakeMetric) metrics.push(stakeMetric);

    let targetCompany: string | null = null;
    if (/target firm/i.test(text)) targetCompany = 'target firm';
    else if (/target company/i.test(text)) targetCompany = 'target company';
    else {
      const targetMatch = text.match(/(?:acquisition of|stake in|acquires)\s+([A-Za-z0-9\s]+?)\s+(?:for|at|completed|$)/i);
      if (targetMatch) {
        targetCompany = targetMatch[1].trim();
      }
    }

    const buyerName = doc.companies[0]?.name || null;

    const specificFields: MergersAcquisitionData = {
      dealValueCrores: dealMetric?.value as number | null,
      stakePercent: stakeMetric?.value as number | null,
      targetCompany,
      buyerName
    };

    return {
      metrics,
      entities: [],
      quotes: [],
      businessEvents: [{
        eventType: 'M_AND_A',
        description: `M&A deal worth ${dealMetric?.value || 'N/A'} ${dealMetric?.unit || ''} for ${stakeMetric?.value || 'N/A'}% stake`,
        sourceSentence: doc.title
      }],
      dates: this.extractDates(doc),
      summaryFacts: [`Deal Value: ${dealMetric?.value || 'N/A'}`, `Stake: ${stakeMetric?.value || 'N/A'}%`],
      specificFields
    };
  }
}
