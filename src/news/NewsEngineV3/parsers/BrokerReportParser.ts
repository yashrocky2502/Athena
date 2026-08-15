/**
 * ATHENA NEWS ENGINE V3 — BROKER REPORT PARSER
 *
 * Phase 6 Institutional Grade Parser for Analyst & Broker Research Reports.
 * Purely deterministic, rule-based extraction for Broker, Rating, Target Price, Up/Downgrade, Upside %.
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import {
  ExtractedMetric,
  ExtractedEntity,
  ExtractedQuote,
  BusinessEvent,
  ExtractedDate,
  BrokerReportData
} from './types/ParserTypes';

export class BrokerReportParser extends BaseFinancialParser {
  public readonly parserType = 'BrokerReportParser';

  private readonly KNOWN_BROKERS = [
    'Morgan Stanley',
    'Goldman Sachs',
    'Jefferies',
    'CLSA',
    'Nomura',
    'JPMorgan',
    'UBS',
    'Citi',
    'Macquarie',
    'Motilal Oswal',
    'ICICI Securities',
    'Kotak Institutional Equities',
    'Axis Capital',
    'HDFC Securities',
    'Nuvama',
    'JM Financial',
    'Emkay',
    'Nirmal Bang',
    'Edelweiss',
    'Centrum',
    'Investec',
    'DAM Capital',
    'Prabhudas Lilladher'
  ];

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
    specificFields?: BrokerReportData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // 1. Identify Broker
    let brokerName: string | null = null;
    for (const b of this.KNOWN_BROKERS) {
      if (text.toLowerCase().includes(b.toLowerCase())) {
        brokerName = b;
        break;
      }
    }

    // 2. Extract Target Price
    const tpMetric = this.extractMetricByKeywords(
      doc,
      'Target Price',
      ['target price', 'target of', 'tp of', 'price target', 'target at'],
      'INR'
    );
    if (tpMetric) metrics.push(tpMetric);

    // 3. Extract Previous Target Price
    let previousTargetPrice: number | null = null;
    const prevTpMatch = text.match(/(?:from|earlier|previous|cut from|raised from)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)/i);
    if (prevTpMatch) {
      previousTargetPrice = parseFloat(prevTpMatch[1].replace(/,/g, ''));
    }

    // 4. Rating & Action Detection
    let rating: BrokerReportData['rating'] = null;
    if (/\bbuy\b/i.test(text)) rating = 'BUY';
    else if (/\baccumulate\b/i.test(text)) rating = 'ACCUMULATE';
    else if (/\bhold\b/i.test(text)) rating = 'HOLD';
    else if (/\breduce\b/i.test(text)) rating = 'REDUCE';
    else if (/\bsell\b/i.test(text)) rating = 'SELL';
    else if (/\bneutral\b/i.test(text)) rating = 'NEUTRAL';
    else if (/\boutperform\b/i.test(text)) rating = 'OUTPERFORM';

    let action: BrokerReportData['action'] = null;
    if (/\bupgrade[sd]?\b|\braises to buy\b/i.test(text)) action = 'UPGRADE';
    else if (/\bdowngrade[sd]?\b|\bcuts to sell\b|\bcuts to hold\b/i.test(text)) action = 'DOWNGRADE';
    else if (/\binitiate[sd]?\b|\binitiates coverage\b/i.test(text)) action = 'INITIATION';
    else if (/\breiterate[sd]?\b|\bmaintains\b/i.test(text)) action = 'REITERATE';

    // 5. Upside % / Downside %
    const upsideMetric = this.extractMetricByKeywords(
      doc,
      'Upside Potential',
      ['upside', 'upside of', 'potential upside'],
      'percent'
    );
    if (upsideMetric) metrics.push(upsideMetric);

    const specificFields: BrokerReportData = {
      brokerName,
      targetPrice: tpMetric?.value as number | null,
      previousTargetPrice,
      rating,
      action,
      upsidePercent: upsideMetric?.value as number | null
    };

    const entities: ExtractedEntity[] = [];
    if (brokerName) {
      entities.push({
        name: brokerName,
        type: 'BROKER',
        confidence: 95,
        sourceSentence: doc.title
      });
    }

    const summaryFacts: string[] = [];
    if (brokerName) summaryFacts.push(`Broker: ${brokerName}`);
    if (rating) summaryFacts.push(`Rating: ${rating}`);
    if (tpMetric) summaryFacts.push(`Target Price: ${tpMetric.value} ${tpMetric.unit}`);

    return {
      metrics,
      entities,
      quotes: [],
      businessEvents: [],
      dates: this.extractDates(doc),
      summaryFacts,
      specificFields
    };
  }
}
