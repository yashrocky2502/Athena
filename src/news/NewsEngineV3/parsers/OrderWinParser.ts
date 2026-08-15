/**
 * ATHENA NEWS ENGINE V3 — ORDER WIN PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, OrderWinData } from './types/ParserTypes';

export class OrderWinParser extends BaseFinancialParser {
  public readonly parserType = 'OrderWinParser';

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
    specificFields?: OrderWinData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Contract Value
    const valueMetric = this.extractMetricByKeywords(
      doc,
      'Contract Value',
      ['order worth', 'contract worth', 'order valued at', 'bagged order', 'wins order', 'project worth'],
      'crore'
    );
    if (valueMetric) metrics.push(valueMetric);

    // Client Name match
    let clientName: string | null = null;
    const clientMatch = text.match(/(?:from|awarded by|order from|contract with)\s+([A-Z][a-zA-Z0-9\s&]+?)(?=\s+(?:worth|valued|for|in|$))/i);
    if (clientMatch) {
      clientName = clientMatch[1].trim();
    }

    // Geography
    let geography: string | null = null;
    if (/domestic|india/i.test(text)) geography = 'Domestic (India)';
    else if (/international|overseas|us|europe|gulf|middle east/i.test(text)) geography = 'International';

    const specificFields: OrderWinData = {
      clientName,
      contractValueCrores: valueMetric?.value as number | null,
      currency: valueMetric?.currency || 'INR',
      geography
    };

    const entities: ExtractedEntity[] = [];
    if (clientName) {
      entities.push({
        name: clientName,
        type: 'CLIENT',
        confidence: 85,
        sourceSentence: doc.title
      });
    }

    return {
      metrics,
      entities,
      quotes: [],
      businessEvents: [{
        eventType: 'ORDER_WIN',
        description: `Order win worth ${valueMetric?.value || 'N/A'} ${valueMetric?.unit || ''} from ${clientName || 'Client'}`,
        sourceSentence: doc.title
      }],
      dates: this.extractDates(doc),
      summaryFacts: [`Contract Value: ${valueMetric?.value || 'N/A'} ${valueMetric?.unit || ''}`, `Client: ${clientName || 'N/A'}`],
      specificFields
    };
  }
}
