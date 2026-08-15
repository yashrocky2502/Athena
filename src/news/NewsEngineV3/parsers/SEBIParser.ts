/**
 * ATHENA NEWS ENGINE V3 — SEBI REGULATORY PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, SEBIParserData } from './types/ParserTypes';

export class SEBIParser extends BaseFinancialParser {
  public readonly parserType = 'SEBIParser';

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
    specificFields?: SEBIParserData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Penalty amount if applicable
    const penaltyMetric = this.extractMetricByKeywords(
      doc,
      'Penalty Amount',
      ['penalty of rs', 'fine of rs', 'imposes penalty of'],
      'lakh'
    );
    if (penaltyMetric) metrics.push(penaltyMetric);

    let documentType: SEBIParserData['documentType'] = null;
    if (/circular/i.test(text)) documentType = 'CIRCULAR';
    else if (/penalty|imposes fine/i.test(text)) documentType = 'PENALTY';
    else if (/bars|ban|restrains|restriction/i.test(text)) documentType = 'RESTRICTION';
    else if (/settlement|settles/i.test(text)) documentType = 'SETTLEMENT';
    else if (/consultation paper/i.test(text)) documentType = 'CONSULTATION';

    let complianceRequirement: string | null = null;
    if (/disclosure/i.test(text)) complianceRequirement = 'disclosure norms';
    else if (/compliance/i.test(text)) complianceRequirement = 'compliance guidelines';

    const specificFields: SEBIParserData = {
      documentType,
      penaltyAmountLakhs: penaltyMetric?.value as number | null,
      complianceRequirement
    };

    return {
      metrics,
      entities: [{
        name: 'Securities and Exchange Board of India (SEBI)',
        type: 'REGULATORY_BODY',
        confidence: 99,
        sourceSentence: doc.title
      }],
      quotes: [],
      businessEvents: [{
        eventType: 'SEBI_ACTION',
        description: `SEBI ${documentType || 'regulatory update'} announced`,
        sourceSentence: doc.title
      }],
      dates: this.extractDates(doc),
      summaryFacts: [`SEBI Action: ${documentType || 'Regulatory Circular'}`],
      specificFields
    };
  }
}
