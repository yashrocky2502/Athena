/**
 * ATHENA NEWS ENGINE V3 — MANAGEMENT CHANGE PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, ManagementChangeData } from './types/ParserTypes';

export class ManagementChangeParser extends BaseFinancialParser {
  public readonly parserType = 'ManagementChangeParser';

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
    specificFields?: ManagementChangeData;
  }> {
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Executive Name & Designation
    let designation: string | null = null;
    if (/\bceo\b|chief executive/i.test(text)) designation = 'Chief Executive Officer (CEO)';
    else if (/\bcfo\b|chief financial/i.test(text)) designation = 'Chief Financial Officer (CFO)';
    else if (/\bmd\b|managing director/i.test(text)) designation = 'Managing Director (MD)';
    else if (/chairman/i.test(text)) designation = 'Chairman';
    else if (/director/i.test(text)) designation = 'Director';

    let action: ManagementChangeData['action'] = null;
    if (/appoints|appointed|names|named|elevation/i.test(text)) action = 'APPOINTED';
    else if (/resigns|resigned|step down|steps down|resignation/i.test(text)) action = 'RESIGNED';
    else if (/retires|retired|retirement/i.test(text)) action = 'RETIRED';

    // Extract Name regex: e.g. "Appoints John Doe as CEO" or "John Doe resigns"
    let executiveName: string | null = null;
    const nameMatch = text.match(/(?:appoints|appointed|names|named|resignation of|resigns as|appointment of|appointment of mr\.?|appoints mr\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    if (nameMatch) {
      executiveName = nameMatch[1].trim();
    }

    const specificFields: ManagementChangeData = {
      executiveName,
      designation,
      action,
      effectiveDate: this.extractDates(doc)[0]?.date || null
    };

    const entities: ExtractedEntity[] = [];
    if (executiveName) {
      entities.push({
        name: executiveName,
        type: 'PERSON',
        confidence: 90,
        sourceSentence: doc.title
      });
    }

    return {
      metrics: [],
      entities,
      quotes: this.extractQuotes(doc),
      businessEvents: [{
        eventType: 'MANAGEMENT_CHANGE',
        description: `${executiveName || 'Executive'} ${action?.toLowerCase() || 'change'} as ${designation || 'Officer'}`,
        sourceSentence: doc.title
      }],
      dates: this.extractDates(doc),
      summaryFacts: [`Executive: ${executiveName || 'N/A'}`, `Action: ${action || 'N/A'}`, `Role: ${designation || 'N/A'}`],
      specificFields
    };
  }
}
