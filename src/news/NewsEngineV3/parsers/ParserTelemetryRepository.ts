/**
 * ATHENA NEWS ENGINE V3 — PARSER TELEMETRY REPOSITORY
 *
 * Tracks, stores, and aggregates high-speed performance stats, latencies,
 * failures, missing metrics, and accuracy for institutional financial parsers.
 * Supports Phase 6.1 Strict Precision, Recall, F1 calibration.
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { StructuredExtraction, ExtractedQuote } from './types/ParserTypes';
import { GroundTruthComparator, ParserMetricsScore } from './GroundTruthComparator';
import { ExpectedFieldMatrix } from './ExpectedFieldMatrix';

export interface FieldStats {
  fieldName: string;
  expectedCount: number;
  extractedCount: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface ParserHeatmapItem {
  parserName: string;
  totalRuns: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  averageLatencyMs: number;
  topMissingFields: Array<{ field: string; count: number }>;
  topFalsePositives: Array<{ field: string; count: number }>;
  failuresCount: number;
  errors: string[];
}

export interface ParserTelemetryStats {
  parserHealth: number;          // % of success vs total attempts
  averageConfidence: number;     // average extraction confidence
  extractionAccuracy: number;    // % of extracted vs expected metrics (Precision/Recall blend)
  precision: number;             // overall TP / (TP+FP)
  recall: number;                // overall TP / (TP+FN)
  f1: number;                    // overall F1 score
  metricsExtracted: number;      // total count of metrics
  missingMetrics: number;        // count of missed important metrics
  parserLatency: number;         // average parser latency in ms
  parserFailures: number;        // count of parser crashes/errors
  topMissingFields: Array<{ field: string; count: number }>;
  topParsingErrors: Array<{ error: string; count: number }>;
  
  // Phase 6.1 Heatmap & Per-Field Stats
  parserHeatmap: Record<string, ParserHeatmapItem>;
  perFieldStats: Record<string, FieldStats>;
}

export class ParserTelemetryRepository {
  private static instance: ParserTelemetryRepository;

  private totalParsed = 0;
  private totalFailures = 0;
  private confidenceSum = 0;
  private latencySum = 0;
  private totalMetricsExtracted = 0;

  // Raw counts for global Precision/Recall
  private globalTP = 0;
  private globalFP = 0;
  private globalFN = 0;

  private missingFieldsMap = new Map<string, number>();
  private falsePositivesMap = new Map<string, number>();
  private parsingErrorsMap = new Map<string, number>();

  private extractions: StructuredExtraction[] = [];
  
  // Per-parser tracking
  private parserRuns: Record<string, {
    tp: number;
    fp: number;
    fn: number;
    latencies: number[];
    failures: number[];
    errors: string[];
    missingFields: Map<string, number>;
    falsePositives: Map<string, number>;
  }> = {};

  // Per-field statistics tracking
  private fieldTrackers: Record<string, {
    expected: number;
    extracted: number;
    tp: number;
    fp: number;
    fn: number;
  }> = {};

  private constructor() {
    this.initFieldTrackers();
  }

  public static getInstance(): ParserTelemetryRepository {
    if (!ParserTelemetryRepository.instance) {
      ParserTelemetryRepository.instance = new ParserTelemetryRepository();
    }
    return ParserTelemetryRepository.instance;
  }

  private initFieldTrackers(): void {
    const fieldsToTrack = [
      'Revenue', 'PAT', 'EBITDA', 'Margins', 'EPS',
      'Target Price', 'Dividend', 'Split Ratio', 'Repo Rate',
      'Inflation', 'Guidance', 'CEO Quotes', 'Broker Quotes'
    ];
    fieldsToTrack.forEach((f) => {
      this.fieldTrackers[f] = { expected: 0, extracted: 0, tp: 0, fp: 0, fn: 0 };
    });
  }

  /**
   * Records a successful parser execution with ground-truth analysis.
   */
  public recordSuccess(doc: NormalizedDocument, extraction: StructuredExtraction): void {
    this.totalParsed++;
    this.extractions.push(extraction);
    this.confidenceSum += extraction.confidence;
    this.latencySum += extraction.processingTimeMs;
    this.totalMetricsExtracted += extraction.metrics.length;

    // Run strict comparison
    const score = GroundTruthComparator.compare(doc, extraction);
    const parserType = extraction.parserType;

    // Initialize parser slot if needed
    if (!this.parserRuns[parserType]) {
      this.parserRuns[parserType] = {
        tp: 0, fp: 0, fn: 0,
        latencies: [], failures: [], errors: [],
        missingFields: new Map(), falsePositives: new Map()
      };
    }

    const pRun = this.parserRuns[parserType];
    pRun.tp += score.tpCount;
    pRun.fp += score.fpCount;
    pRun.fn += score.fnCount;
    pRun.latencies.push(extraction.processingTimeMs);

    // Global counters
    this.globalTP += score.tpCount;
    this.globalFP += score.fpCount;
    this.globalFN += score.fnCount;

    // Record warnings
    if (extraction.validation.warnings) {
      extraction.validation.warnings.forEach((warn) => {
        const cleanWarn = warn.replace(/Rs\.|₹|crore|million|NaN|undefined/i, 'METRIC_FORMAT_WARN');
        this.parsingErrorsMap.set(cleanWarn, (this.parsingErrorsMap.get(cleanWarn) || 0) + 1);
      });
    }

    // Process missing fields & false positives
    score.missingFields.forEach((f) => {
      const fullKey = `${parserType}.${f}`;
      this.missingFieldsMap.set(fullKey, (this.missingFieldsMap.get(fullKey) || 0) + 1);
      pRun.missingFields.set(f, (pRun.missingFields.get(f) || 0) + 1);
    });

    score.falsePositives.forEach((f) => {
      const fullKey = `${parserType}.${f}`;
      this.falsePositivesMap.set(fullKey, (this.falsePositivesMap.get(fullKey) || 0) + 1);
      pRun.falsePositives.set(f, (pRun.falsePositives.get(f) || 0) + 1);
    });

    // Track per-field granular statistics
    this.trackGranularFields(doc, extraction, score);
  }

  /**
   * Records a parser crash or hard validation failure
   */
  public recordFailure(parserType: string, errorMsg: string): void {
    this.totalParsed++;
    this.totalFailures++;
    this.parsingErrorsMap.set(errorMsg, (this.parsingErrorsMap.get(errorMsg) || 0) + 1);

    if (!this.parserRuns[parserType]) {
      this.parserRuns[parserType] = {
        tp: 0, fp: 0, fn: 0,
        latencies: [], failures: [], errors: [],
        missingFields: new Map(), falsePositives: new Map()
      };
    }
    const pRun = this.parserRuns[parserType];
    pRun.failures.push(1);
    pRun.errors.push(errorMsg);
  }

  /**
   * Evaluates the specific granular fields asked by Phase 6.1
   */
  private trackGranularFields(
    doc: NormalizedDocument,
    extraction: StructuredExtraction,
    score: ParserMetricsScore
  ): void {
    const parserType = extraction.parserType;
    const fields = extraction.specificFields || {};

    const evaluateField = (
      trackerKey: string,
      targetParser: string,
      fieldKey: string,
      customCheck?: () => { expected: boolean; extracted: boolean }
    ) => {
      const tracker = this.fieldTrackers[trackerKey];
      if (!tracker) return;

      let expected = false;
      let extracted = false;

      if (customCheck) {
        const res = customCheck();
        expected = res.expected;
        extracted = res.extracted;
      } else if (parserType === targetParser) {
        const gtFields = ExpectedFieldMatrix.detectPresentFields(doc, parserType);
        expected = gtFields.has(fieldKey);
        extracted = fields[fieldKey] !== undefined && fields[fieldKey] !== null && fields[fieldKey] !== '';
      }

      if (expected) {
        tracker.expected++;
        if (extracted) {
          tracker.extracted++;
          tracker.tp++;
        } else {
          tracker.fn++;
        }
      } else {
        if (extracted) {
          tracker.extracted++;
          tracker.fp++;
        }
      }
    };

    // 1. Revenue (QuarterlyResults)
    evaluateField('Revenue', 'QuarterlyResultsParser', 'revenue');

    // 2. PAT (QuarterlyResults)
    evaluateField('PAT', 'QuarterlyResultsParser', 'pat');

    // 3. EBITDA (QuarterlyResults)
    evaluateField('EBITDA', 'QuarterlyResultsParser', 'ebitda');

    // 4. Margins (ebitdaMargin, netMargin or marginImpact)
    evaluateField('Margins', 'QuarterlyResultsParser', 'ebitdaMargin', () => {
      const gt = ExpectedFieldMatrix.detectPresentFields(doc, 'QuarterlyResultsParser');
      const isExpected = gt.has('ebitdaMargin') || gt.has('netMargin') || (parserType === 'OrderWinParser' && ExpectedFieldMatrix.detectPresentFields(doc, 'OrderWinParser').has('marginImpact'));
      const isExtracted = fields.ebitdaMargin !== undefined && fields.ebitdaMargin !== null || fields.netMargin !== undefined && fields.netMargin !== null || fields.marginImpact !== undefined && fields.marginImpact !== null;
      return { expected: isExpected, extracted: isExtracted };
    });

    // 5. EPS (QuarterlyResults)
    evaluateField('EPS', 'QuarterlyResultsParser', 'eps');

    // 6. Target Price (BrokerReport)
    evaluateField('Target Price', 'BrokerReportParser', 'targetPrice');

    // 7. Dividend (DividendParser)
    evaluateField('Dividend', 'DividendParser', 'dividendAmountPerShare');

    // 8. Split Ratio (BonusSplitParser)
    evaluateField('Split Ratio', 'BonusSplitParser', 'splitRatio');

    // 9. Repo Rate (RBIParser)
    evaluateField('Repo Rate', 'RBIParser', 'repoRatePercent');

    // 10. Inflation (MacroParser)
    evaluateField('Inflation', 'MacroParser', 'cpiInflationPercent', () => {
      const gt = ExpectedFieldMatrix.detectPresentFields(doc, 'MacroParser');
      const isExpected = gt.has('cpiInflationPercent') || gt.has('wpiInflationPercent');
      const isExtracted = fields.cpiInflationPercent !== undefined && fields.cpiInflationPercent !== null || fields.wpiInflationPercent !== undefined && fields.wpiInflationPercent !== null;
      return { expected: isExpected, extracted: isExtracted };
    });

    // 11. Guidance (QuarterlyResults)
    evaluateField('Guidance', 'QuarterlyResultsParser', 'guidance');

    // 12. CEO Quotes
    evaluateField('CEO Quotes', '', '', () => {
      const hasQuoteRegex = /\b(?:ceo|md|managing director|chairperson|executive director)\b.*?\b(?:said|stated|commented|quoted)\b/i;
      const isExpected = hasQuoteRegex.test(doc.plainText || '');
      const isExtracted = extraction.quotes.some((q) => {
        const des = (q.designation || '').toLowerCase();
        return des.includes('ceo') || des.includes('md') || des.includes('managing') || des.includes('chair');
      });
      return { expected: isExpected, extracted: isExtracted };
    });

    // 13. Broker Quotes
    evaluateField('Broker Quotes', '', '', () => {
      const hasBrokerQuote = /\b(?:brokerage|jefferies|clsa|morgan stanley|nomura|motilal|kotak|investec)\b.*?\b(?:notes|recommends|says|rating)\b/i;
      const isExpected = hasBrokerQuote.test(doc.plainText || '');
      const isExtracted = extraction.quotes.some((q) => {
        const speaker = (q.speaker || '').toLowerCase();
        return speaker.includes('broker') || speaker.includes('analyst') || speaker.includes('research') || /jefferies|clsa|nomura|morgan stanley|jpmorgan/i.test(speaker);
      });
      return { expected: isExpected, extracted: isExtracted };
    });
  }

  /**
   * Generates highly-detailed aggregate telemetry statistics for Phase 6.1 Calibration
   */
  public getStats(): ParserTelemetryStats {
    const total = this.totalParsed;
    const successCount = total - this.totalFailures;

    const parserHealth = total > 0 ? Math.round((successCount / total) * 100) : 100;
    const averageConfidence = successCount > 0 ? Math.round(this.confidenceSum / successCount) : 0;
    const parserLatency = successCount > 0 ? Math.round((this.latencySum / successCount) * 100) / 100 : 0;

    // Global precision, recall, F1
    const precisionVal = (this.globalTP + this.globalFP) > 0 ? this.globalTP / (this.globalTP + this.globalFP) : 1.0;
    const recallVal = (this.globalTP + this.globalFN) > 0 ? this.globalTP / (this.globalTP + this.globalFN) : 1.0;
    const f1Val = (precisionVal + recallVal) > 0 ? 2 * (precisionVal * recallVal) / (precisionVal + recallVal) : 1.0;

    // Build parser heatmap
    const parserHeatmap: Record<string, ParserHeatmapItem> = {};
    const parserTypes = [
      'QuarterlyResultsParser', 'BrokerReportParser', 'CorporateActionParser', 'DividendParser',
      'BuybackParser', 'BonusSplitParser', 'ManagementChangeParser', 'OrderWinParser',
      'MergersAcquisitionParser', 'IPOParser', 'BlockDealParser', 'BulkDealParser',
      'FundRaiseParser', 'RBIParser', 'SEBIParser', 'MacroParser', 'CommodityParser',
      'ForexParser', 'GeneralParser'
    ];

    parserTypes.forEach((pt) => {
      const run = this.parserRuns[pt] || {
        tp: 0, fp: 0, fn: 0, latencies: [], failures: [], errors: [],
        missingFields: new Map(), falsePositives: new Map()
      };

      const runsCount = run.latencies.length + run.failures.length;
      const successRuns = run.latencies.length;

      const pPrec = (run.tp + run.fp) > 0 ? run.tp / (run.tp + run.fp) : 1.0;
      const pRec = (run.tp + run.fn) > 0 ? run.tp / (run.tp + run.fn) : 1.0;
      const pF1 = (pPrec + pRec) > 0 ? 2 * (pPrec * pRec) / (pPrec + pRec) : 1.0;
      const pAcc = (run.tp + run.fn) > 0 ? run.tp / (run.tp + run.fn) : 1.0;

      const avgLat = successRuns > 0 ? run.latencies.reduce((a, b) => a + b, 0) / successRuns : 0.0;

      const topMissingFields = Array.from(run.missingFields.entries())
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const topFalsePositives = Array.from(run.falsePositives.entries())
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      parserHeatmap[pt] = {
        parserName: pt,
        totalRuns: runsCount,
        accuracy: Math.round(pAcc * 100),
        precision: Math.round(pPrec * 100),
        recall: Math.round(pRec * 100),
        f1: Math.round(pF1 * 100),
        averageLatencyMs: Math.round(avgLat * 100) / 100,
        topMissingFields,
        topFalsePositives,
        failuresCount: run.failures.length,
        errors: Array.from(new Set(run.errors)).slice(0, 3)
      };
    });

    // Build Per-Field Stats
    const perFieldStats: Record<string, FieldStats> = {};
    for (const [fName, trackers] of Object.entries(this.fieldTrackers)) {
      const pPrec = (trackers.tp + trackers.fp) > 0 ? trackers.tp / (trackers.tp + trackers.fp) : 1.0;
      const pRec = (trackers.tp + trackers.fn) > 0 ? trackers.tp / (trackers.tp + trackers.fn) : 1.0;
      const pF1 = (pPrec + pRec) > 0 ? 2 * (pPrec * pRec) / (pPrec + pRec) : 1.0;
      const pAcc = trackers.expected > 0 ? trackers.tp / trackers.expected : 1.0;

      perFieldStats[fName] = {
        fieldName: fName,
        expectedCount: trackers.expected,
        extractedCount: trackers.extracted,
        truePositives: trackers.tp,
        falsePositives: trackers.fp,
        falseNegatives: trackers.fn,
        accuracy: Math.round(pAcc * 100),
        precision: Math.round(pPrec * 100),
        recall: Math.round(pRec * 100),
        f1: Math.round(pF1 * 100)
      };
    }

    const topMissingFields = Array.from(this.missingFieldsMap.entries())
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topParsingErrors = Array.from(this.parsingErrorsMap.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      parserHealth,
      averageConfidence,
      extractionAccuracy: Math.round(recallVal * 100),
      precision: Math.round(precisionVal * 100),
      recall: Math.round(recallVal * 100),
      f1: Math.round(f1Val * 100),
      metricsExtracted: this.totalMetricsExtracted,
      missingMetrics: this.globalFN,
      parserLatency,
      parserFailures: this.totalFailures,
      topMissingFields,
      topParsingErrors,
      parserHeatmap,
      perFieldStats
    };
  }

  /**
   * Resets telemetry metrics
   */
  public clear(): void {
    this.totalParsed = 0;
    this.totalFailures = 0;
    this.confidenceSum = 0;
    this.latencySum = 0;
    this.totalMetricsExtracted = 0;
    this.globalTP = 0;
    this.globalFP = 0;
    this.globalFN = 0;

    this.missingFieldsMap.clear();
    this.falsePositivesMap.clear();
    this.parsingErrorsMap.clear();
    this.extractions = [];
    this.parserRuns = {};

    this.initFieldTrackers();
  }
}
