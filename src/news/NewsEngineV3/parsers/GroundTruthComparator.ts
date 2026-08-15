/**
 * ATHENA NEWS ENGINE V3 — GROUND TRUTH COMPARATOR
 *
 * Compares actual parser outputs against dynamically detected field-level
 * ground truth to calculate high-fidelity Precision, Recall, F1, and Accuracy.
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { StructuredExtraction } from './types/ParserTypes';
import { ExpectedFieldMatrix } from './ExpectedFieldMatrix';

export interface ParserMetricsScore {
  accuracy: number;         // TP / GT_Present
  precision: number;        // TP / (TP + FP)
  recall: number;           // TP / (TP + FN)
  f1: number;               // Harmonic mean
  tpCount: number;
  fpCount: number;
  fnCount: number;
  gtCount: number;
  missingFields: string[];
  falsePositives: string[];
  falseNegatives: string[];
}

export class GroundTruthComparator {
  /**
   * Compares a single parser extraction against ground-truth field presence.
   */
  public static compare(
    doc: NormalizedDocument,
    extraction: StructuredExtraction
  ): ParserMetricsScore {
    const parserType = extraction.parserType;
    const groundTruthPresent = ExpectedFieldMatrix.detectPresentFields(doc, parserType);

    const extractedFields = new Set<string>();
    const fields = extraction.specificFields || {};

    // Determine which fields were actually extracted with meaningful non-null values
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) {
        extractedFields.add(key);
      }
    }

    // Also include metrics as extracted fields if they match named specific fields
    if (extraction.metrics && extraction.metrics.length > 0) {
      extraction.metrics.forEach((m) => {
        // Map common metric names to specificField camelCase names
        const nameMap: Record<string, string> = {
          'Revenue': 'revenue',
          'Net Profit': 'pat',
          'PAT': 'pat',
          'EBITDA': 'ebitda',
          'EBITDA Margin': 'ebitdaMargin',
          'Net Margin': 'netMargin',
          'EPS': 'eps',
          'Target Price': 'targetPrice',
          'Upside Potential': 'upsidePercent',
          'Penalty Amount': 'penaltyAmountLakhs',
          'Repo Rate': 'repoRatePercent',
          'GDP Growth': 'gdpGrowthPercent',
          'CPI Inflation': 'cpiInflationPercent',
          'WPI Inflation': 'wpiInflationPercent',
          'PMI': 'pmiValue',
          'IIP Growth': 'iipGrowthPercent',
          'GST Collection': 'gstCollectionCrores'
        };

        const mappedName = nameMap[m.metricName];
        if (mappedName) {
          extractedFields.add(mappedName);
        }
      });
    }

    const missingFields: string[] = [];
    const falsePositives: string[] = [];
    const falseNegatives: string[] = [];

    let tp = 0;
    let fp = 0;
    let fn = 0;

    // Track all configured fields for this parser
    const allConfiguredFields = ExpectedFieldMatrix.getFieldsForParser(parserType);

    allConfiguredFields.forEach((field) => {
      const isGT = groundTruthPresent.has(field);
      const isExt = extractedFields.has(field);

      if (isGT && isExt) {
        tp++;
      } else if (isGT && !isExt) {
        fn++;
        falseNegatives.push(field);
        missingFields.push(field);
      } else if (!isGT && isExt) {
        fp++;
        falsePositives.push(field);
      }
    });

    // Special cases: if there are no expected fields in Ground Truth, the article is general/absent of structured targets
    const gtCount = groundTruthPresent.size;
    const extCount = extractedFields.size;

    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 1.0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 1.0;
    const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 1.0;
    const accuracy = gtCount > 0 ? tp / gtCount : 1.0;

    return {
      accuracy: Math.round(accuracy * 100),
      precision: Math.round(precision * 100),
      recall: Math.round(recall * 100),
      f1: Math.round(f1 * 100),
      tpCount: tp,
      fpCount: fp,
      fnCount: fn,
      gtCount,
      missingFields,
      falsePositives,
      falseNegatives
    };
  }
}
