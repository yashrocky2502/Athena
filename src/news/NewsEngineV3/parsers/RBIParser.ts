/**
 * ATHENA NEWS ENGINE V3 — RBI POLICY PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, RBIParserData } from './types/ParserTypes';

export class RBIParser extends BaseFinancialParser {
  public readonly parserType = 'RBIParser';

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
    specificFields?: RBIParserData;
  }> {
    const metrics: ExtractedMetric[] = [];
    const text = (doc.title + ' \n ' + (doc.plainText || '')).trim();

    // Repo Rate
    const repoMetric = this.extractMetricByKeywords(
      doc,
      'Repo Rate',
      ['repo rate', 'kept repo rate at', 'cut repo rate to', 'raised repo rate to'],
      'percent'
    );
    if (repoMetric) metrics.push(repoMetric);

    // Reverse Repo
    const reverseRepoMetric = this.extractMetricByKeywords(
      doc,
      'Reverse Repo Rate',
      ['reverse repo rate', 'reverse repo at'],
      'percent'
    );
    if (reverseRepoMetric) metrics.push(reverseRepoMetric);

    // CRR / SLR
    const crrMetric = this.extractMetricByKeywords(doc, 'CRR', ['crr', 'cash reserve ratio'], 'percent');
    if (crrMetric) metrics.push(crrMetric);

    const slrMetric = this.extractMetricByKeywords(doc, 'SLR', ['slr', 'statutory liquidity ratio'], 'percent');
    if (slrMetric) metrics.push(slrMetric);

    // Forecasts
    const gdpMetric = this.extractMetricByKeywords(doc, 'GDP Forecast', ['gdp growth forecast', 'gdp growth at', 'gdp forecast'], 'percent');
    if (gdpMetric) metrics.push(gdpMetric);

    const inflationMetric = this.extractMetricByKeywords(doc, 'Inflation Forecast', ['cpi forecast', 'inflation forecast', 'inflation projected at'], 'percent');
    if (inflationMetric) metrics.push(inflationMetric);

    let policyStance: RBIParserData['policyStance'] = null;
    if (/accommodative/i.test(text)) policyStance = 'ACCOMMODATIVE';
    else if (/neutral/i.test(text)) policyStance = 'NEUTRAL';
    else if (/hawkish/i.test(text)) policyStance = 'HAWKISH';
    else if (/withdrawal of accommodation/i.test(text)) policyStance = 'WITHDRAWAL_OF_ACCOMMODATION';

    const specificFields: RBIParserData = {
      repoRatePercent: repoMetric?.value as number | null,
      reverseRepoRatePercent: reverseRepoMetric?.value as number | null,
      crrPercent: crrMetric?.value as number | null,
      slrPercent: slrMetric?.value as number | null,
      gdpForecastPercent: gdpMetric?.value as number | null,
      inflationForecastPercent: inflationMetric?.value as number | null,
      policyStance
    };

    return {
      metrics,
      entities: [{
        name: 'Reserve Bank of India (RBI)',
        type: 'REGULATORY_BODY',
        confidence: 99,
        sourceSentence: doc.title
      }],
      quotes: this.extractQuotes(doc),
      businessEvents: [{
        eventType: 'RBI_POLICY_MEETING',
        description: `RBI Monetary Policy decision: Repo rate at ${repoMetric?.value || 'unchanged'}%`,
        sourceSentence: doc.title
      }],
      dates: this.extractDates(doc),
      summaryFacts: [`Repo Rate: ${repoMetric?.value || 'N/A'}%`, `Policy Stance: ${policyStance || 'N/A'}`],
      specificFields
    };
  }
}
