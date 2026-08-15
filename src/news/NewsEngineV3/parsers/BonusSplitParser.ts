/**
 * ATHENA NEWS ENGINE V3 — BONUS & SPLIT PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, BonusSplitData } from './types/ParserTypes';

export class BonusSplitParser extends BaseFinancialParser {
  public readonly parserType = 'BonusSplitParser';

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
    specificFields?: BonusSplitData;
  }> {
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Bonus Ratio Match (e.g., 1:1, 2:1, 1:2 or 1:1 bonus)
    const bonusRatioMatch = text.match(/(\d+:\d+)\s*bonus|bonus\s*(?:issue|ratio|shares)?\s*(?:of)?\s*(\d+:\d+)/i);
    const bonusRatio = bonusRatioMatch ? (bonusRatioMatch[1] || bonusRatioMatch[2]) : null;

    // Split Ratio Match (e.g., 1:10, 1:5 or Rs 10 to Rs 1)
    const splitRatioMatch = text.match(/(?:stock split|sub-division|split)\s*(?:in the ratio of|in|of)?\s*(\d+:\d+|rs\.?\s*\d+\s*to\s*rs\.?\s*\d+)|(\d+:\d+)\s*split/i);
    const splitRatio = splitRatioMatch ? (splitRatioMatch[1] || splitRatioMatch[2]) : null;

    let type: BonusSplitData['type'] = null;
    if (bonusRatio && splitRatio) type = 'BONUS_AND_SPLIT';
    else if (bonusRatio) type = 'BONUS';
    else if (splitRatio) type = 'SPLIT';

    const dates = this.extractDates(doc);

    const specificFields: BonusSplitData = {
      type,
      bonusRatio,
      splitRatio,
      recordDate: dates.find((d) => /record date/i.test(d.label))?.date,
      exDate: dates.find((d) => /ex-date|ex date/i.test(d.label))?.date
    };

    return {
      metrics: [],
      entities: [],
      quotes: [],
      businessEvents: [{
        eventType: type || 'CORPORATE_ACTION',
        description: `Corporate Action: Bonus ${bonusRatio || 'N/A'}, Split ${splitRatio || 'N/A'}`,
        sourceSentence: doc.title
      }],
      dates,
      summaryFacts: [`Bonus Ratio: ${bonusRatio || 'N/A'}`, `Split Ratio: ${splitRatio || 'N/A'}`],
      specificFields
    };
  }
}
