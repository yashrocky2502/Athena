/**
 * ATHENA NEWS ENGINE V3 — QUARTERLY RESULTS PARSER
 *
 * Phase 6 Institutional Grade Parser for Earnings / Quarterly Results.
 * Purely deterministic, rule-based extraction for Revenue, PAT, EBITDA, Margins, EPS, Guidance.
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
  QuarterlyResultsData
} from './types/ParserTypes';

export class QuarterlyResultsParser extends BaseFinancialParser {
  public readonly parserType = 'QuarterlyResultsParser';

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
    specificFields?: QuarterlyResultsData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // 1. Extract Revenue / Operating Revenue
    const revMetric = this.extractMetricByKeywords(
      doc,
      'Revenue',
      ['revenue', 'sales', 'turnover', 'income from operations', 'topline'],
      'crore'
    );
    if (revMetric) metrics.push(revMetric);

    // 2. Extract PAT / Net Profit
    const patMetric = this.extractMetricByKeywords(
      doc,
      'PAT',
      ['net profit', 'pat', 'profit after tax', 'bottomline', 'net income'],
      'crore'
    );
    if (patMetric) metrics.push(patMetric);

    // 3. Extract EBITDA / EBIT
    const ebitdaMetric = this.extractMetricByKeywords(
      doc,
      'EBITDA',
      ['ebitda', 'operating profit', 'ebit'],
      'crore'
    );
    if (ebitdaMetric) metrics.push(ebitdaMetric);

    // 4. Extract EBITDA Margin / Operating Margin
    const ebitdaMarginMetric = this.extractMetricByKeywords(
      doc,
      'EBITDA Margin',
      ['ebitda margin', 'operating margin', 'opm'],
      'percent'
    );
    if (ebitdaMarginMetric) metrics.push(ebitdaMarginMetric);

    // 5. Extract EPS
    const epsMetric = this.extractMetricByKeywords(
      doc,
      'EPS',
      ['eps', 'earnings per share', 'diluted eps'],
      'per share'
    );
    if (epsMetric) metrics.push(epsMetric);

    // 6. Extract Banking / Financial / Operational Metrics if present
    const nimMetric = this.extractMetricByKeywords(doc, 'NIM', ['net interest margin', 'nim'], 'percent');
    if (nimMetric) metrics.push(nimMetric);

    const gnpaMetric = this.extractMetricByKeywords(doc, 'GNPA', ['gross npa', 'gnpa'], 'percent');
    if (gnpaMetric) metrics.push(gnpaMetric);

    const nnpaMetric = this.extractMetricByKeywords(doc, 'NNPA', ['net npa', 'nnpa'], 'percent');
    if (nnpaMetric) metrics.push(nnpaMetric);

    // Quarter & FY Detection
    let quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | undefined;
    if (/q1|first quarter/i.test(text)) quarter = 'Q1';
    else if (/q2|second quarter/i.test(text)) quarter = 'Q2';
    else if (/q3|third quarter/i.test(text)) quarter = 'Q3';
    else if (/q4|fourth quarter|full year/i.test(text)) quarter = 'Q4';

    let financialYear: string | undefined;
    const fyMatch = text.match(/fy\s*(\d{2,4})/i);
    if (fyMatch) {
      financialYear = `FY${fyMatch[1]}`;
    }

    // Specific Structured Schema Fields
    const specificFields: QuarterlyResultsData = {
      quarter,
      financialYear,
      revenue: revMetric?.value as number | null,
      pat: patMetric?.value as number | null,
      ebitda: ebitdaMetric?.value as number | null,
      ebitdaMargin: ebitdaMarginMetric?.value as number | null,
      eps: epsMetric?.value as number | null,
      managementCommentary: doc.sentences
        ?.filter((s) => /comment|said|outlook|guidance|expect/i.test(s.text))
        .map((s) => s.text)
        .slice(0, 3)
    };

    const quotes = this.extractQuotes(doc);
    const dates = this.extractDates(doc);

    const entities: ExtractedEntity[] = doc.companies.map((c) => ({
      name: c.name,
      type: 'COMPANY',
      confidence: c.confidence || 90,
      sourceSentence: doc.title
    }));

    const summaryFacts: string[] = [];
    if (revMetric) summaryFacts.push(`Revenue reported at ${revMetric.value} ${revMetric.unit}`);
    if (patMetric) summaryFacts.push(`Net profit reported at ${patMetric.value} ${patMetric.unit}`);

    return {
      metrics,
      entities,
      quotes,
      businessEvents: [],
      dates,
      summaryFacts,
      specificFields
    };
  }
}
