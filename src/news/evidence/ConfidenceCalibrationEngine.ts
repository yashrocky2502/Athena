/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * ConfidenceCalibrationEngine.ts
 * 
 * Tracks predicted confidence vs actual realized outcomes to calculate calibration error,
 * Brier score, and accuracy per confidence bucket.
 */

import { ConfidenceCalibrationBucket } from './types.ts';

export interface OutcomeRecord {
  predictionId: string;
  predictedConfidence: number; // 0 - 100
  actualSuccess: boolean;
  evaluatedAt: string;
}

export class ConfidenceCalibrationEngine {
  private static instance: ConfidenceCalibrationEngine;
  private records: OutcomeRecord[] = [];

  private constructor() {
    this.seedBaselineRecords();
  }

  public static getInstance(): ConfidenceCalibrationEngine {
    if (!ConfidenceCalibrationEngine.instance) {
      ConfidenceCalibrationEngine.instance = new ConfidenceCalibrationEngine();
    }
    return ConfidenceCalibrationEngine.instance;
  }

  private seedBaselineRecords(): void {
    // Seed sample calibration history for robust cold-start analytics
    const samples: [number, boolean][] = [
      [85, true], [88, true], [92, true], [82, false], [84, true],
      [72, true], [68, true], [75, false], [65, false], [70, true],
      [55, true], [52, false], [48, false], [58, true], [45, false],
      [35, false], [28, false], [38, true], [22, false], [30, false],
      [15, false], [18, false], [12, false], [8, false], [19, false]
    ];
    samples.forEach(([conf, success], idx) => {
      this.records.push({
        predictionId: `seed_calib_${idx}`,
        predictedConfidence: conf,
        actualSuccess: success,
        evaluatedAt: new Date(Date.now() - (25 - idx) * 3600000).toISOString()
      });
    });
  }

  /**
   * Records a resolved outcome against an earlier confidence prediction
   */
  public recordOutcome(predictionId: string, predictedConfidence: number, actualSuccess: boolean): void {
    this.records.push({
      predictionId,
      predictedConfidence: Math.max(0, Math.min(100, predictedConfidence)),
      actualSuccess,
      evaluatedAt: new Date().toISOString()
    });
  }

  /**
   * Computes calibration stats across buckets
   */
  public getCalibrationReport(): {
    totalPredictions: number;
    overallBrierScore: number;
    buckets: ConfidenceCalibrationBucket[];
  } {
    const bucketsConfig: { range: [number, number]; name: ConfidenceCalibrationBucket['bucket'] }[] = [
      { range: [0, 20], name: '0-20' },
      { range: [21, 40], name: '21-40' },
      { range: [41, 60], name: '41-60' },
      { range: [61, 80], name: '61-80' },
      { range: [81, 100], name: '81-100' }
    ];

    let totalSquaredError = 0;

    const buckets = bucketsConfig.map(b => {
      const items = this.records.filter(
        r => r.predictedConfidence >= b.range[0] && r.predictedConfidence <= b.range[1]
      );
      const total = items.length;
      const successes = items.filter(r => r.actualSuccess).length;
      const avgPred = total > 0 ? items.reduce((sum, r) => sum + r.predictedConfidence, 0) / total : (b.range[0] + b.range[1]) / 2;
      const actualAcc = total > 0 ? (successes / total) * 100 : 0;

      let bucketBrier = 0;
      if (total > 0) {
        const errorSum = items.reduce((sum, r) => {
          const prob = r.predictedConfidence / 100;
          const outcome = r.actualSuccess ? 1 : 0;
          return sum + Math.pow(prob - outcome, 2);
        }, 0);
        bucketBrier = errorSum / total;
        totalSquaredError += errorSum;
      }

      return {
        bucket: b.name,
        predictedConfidenceAvg: Number(avgPred.toFixed(1)),
        totalPredictions: total,
        successfulOutcomes: successes,
        actualAccuracyPercent: Number(actualAcc.toFixed(1)),
        brierScore: Number(bucketBrier.toFixed(4))
      };
    });

    const overallBrier = this.records.length > 0 ? totalSquaredError / this.records.length : 0;

    return {
      totalPredictions: this.records.length,
      overallBrierScore: Number(overallBrier.toFixed(4)),
      buckets
    };
  }
}

export const confidenceCalibrationEngine = ConfidenceCalibrationEngine.getInstance();
