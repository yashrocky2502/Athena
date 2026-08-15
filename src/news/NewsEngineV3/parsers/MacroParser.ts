/**
 * ATHENA NEWS ENGINE V3 — MACROECONOMIC PARSER
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { ExtractedMetric, ExtractedEntity, ExtractedQuote, BusinessEvent, ExtractedDate, MacroData } from './types/ParserTypes';

export class MacroParser extends BaseFinancialParser {
  public readonly parserType = 'MacroParser';

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
    specificFields?: MacroData;
  }> {
    const metrics: ExtractedMetric[] = [];

    // GDP Growth
    const gdpMetric = this.extractMetricByKeywords(doc, 'GDP Growth', ['gdp grew at', 'gdp growth of', 'gdp growth at'], 'percent');
    if (gdpMetric) metrics.push(gdpMetric);

    // CPI Inflation
    const cpiMetric = this.extractMetricByKeywords(doc, 'CPI Inflation', ['cpi inflation', 'retail inflation', 'consumer price index'], 'percent');
    if (cpiMetric) metrics.push(cpiMetric);

    // WPI Inflation
    const wpiMetric = this.extractMetricByKeywords(doc, 'WPI Inflation', ['wpi inflation', 'wholesale inflation', 'wholesale price index'], 'percent');
    if (wpiMetric) metrics.push(wpiMetric);

    // PMI
    const pmiMetric = this.extractMetricByKeywords(doc, 'PMI', ['pmi at', 'manufacturing pmi', 'services pmi'], 'index');
    if (pmiMetric) metrics.push(pmiMetric);

    // IIP
    const iipMetric = this.extractMetricByKeywords(doc, 'IIP Growth', ['iip grew', 'industrial production', 'index of industrial production'], 'percent');
    if (iipMetric) metrics.push(iipMetric);

    // GST Collection
    const gstMetric = this.extractMetricByKeywords(doc, 'GST Collection', ['gst collection', 'gst revenue', 'gross gst'], 'crore');
    if (gstMetric) metrics.push(gstMetric);

    const specificFields: MacroData = {
      gdpGrowthPercent: gdpMetric?.value as number | null,
      cpiInflationPercent: cpiMetric?.value as number | null,
      wpiInflationPercent: wpiMetric?.value as number | null,
      pmiValue: pmiMetric?.value as number | null,
      iipGrowthPercent: iipMetric?.value as number | null,
      gstCollectionCrores: gstMetric?.value as number | null
    };

    return {
      metrics,
      entities: [],
      quotes: [],
      businessEvents: [],
      dates: this.extractDates(doc),
      summaryFacts: metrics.map((m) => `${m.metricName}: ${m.value} ${m.unit}`),
      specificFields
    };
  }
}
