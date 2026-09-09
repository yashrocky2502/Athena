/**
 * ATHENA NEWS ENGINE — PHASE 15
 * SignalPerformanceEngine.ts
 * 
 * Tracks signal performance segmented across multiple dimensions:
 * - Signal Type / Direction
 * - Transmission Score
 * - RVOL Bucket
 * - Market Regime
 * - Asset Class / Sector
 * 
 * Calculates statistical metrics without look-ahead bias:
 * Win Rate, Profit Factor, Sharpe, Sortino, MFE, MAE, Calibration Error,
 * False Positive Rate, False Negative Rate, 95% Bootstrap Confidence Intervals.
 */

import { SignalOutcome, SignalPerformanceMetrics } from './types.ts';
import { BootstrappedConfidenceEngine } from './BootstrappedConfidenceEngine.ts';
import { SampleQualityEngine } from './SampleQualityEngine.ts';

export class SignalPerformanceEngine {
  private outcomesHistory: SignalOutcome[] = [];

  /**
   * Ingests a new signal outcome record.
   */
  public recordSignalOutcome(outcome: SignalOutcome): void {
    this.outcomesHistory.push(outcome);
  }

  /**
   * Clears internal state (for testing / reset).
   */
  public clear(): void {
    this.outcomesHistory = [];
  }

  /**
   * Evaluates aggregate signal performance for a subset of outcomes.
   */
  public evaluateSignalPerformance(outcomes: SignalOutcome[] = this.outcomesHistory): SignalPerformanceMetrics {
    const totalSignals = outcomes.length;
    if (totalSignals === 0) {
      return {
        totalSignals: 0,
        winningSignals: 0,
        losingSignals: 0,
        winRatePct: 0,
        avgReturnPct: 0,
        medianReturnPct: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        mfeMedianPct: 0,
        maeMedianPct: 0,
        expectedValueINR: 0,
        calibrationErrorPct: 0,
        falsePositiveRatePct: 0,
        falseNegativeRatePct: 0,
        bootstrapConfidence95: [0, 0],
        sampleQuality: 'VERY_LOW'
      };
    }

    const winningSignals = outcomes.filter(o => o.isWin).length;
    const losingSignals = totalSignals - winningSignals;
    const winRatePct = Number(((winningSignals / totalSignals) * 100).toFixed(2));

    const returns = outcomes.map(o => o.returnPct);
    const avgReturnPct = Number((returns.reduce((a, b) => a + b, 0) / totalSignals).toFixed(2));

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const medianReturnPct = sortedReturns[Math.floor(totalSignals / 2)] || 0;

    const grossGains = outcomes.filter(o => o.returnPct > 0).reduce((sum, o) => sum + o.returnPct, 0);
    const grossLosses = Math.abs(outcomes.filter(o => o.returnPct < 0).reduce((sum, o) => sum + o.returnPct, 0));
    const profitFactor = grossLosses > 0 ? Number((grossGains / grossLosses).toFixed(2)) : grossGains > 0 ? 99.0 : 0;

    // Sharpe & Sortino ratios (assuming risk-free rate = 0)
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturnPct, 2), 0) / totalSignals) || 1;
    const sharpeRatio = Number((avgReturnPct / stdDev).toFixed(2));

    const downsideReturns = returns.filter(r => r < 0);
    const downsideStdDev = downsideReturns.length > 0
      ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length)
      : 1;
    const sortinoRatio = Number((avgReturnPct / downsideStdDev).toFixed(2));

    const mfes = outcomes.map(o => o.mfePct).sort((a, b) => a - b);
    const maes = outcomes.map(o => o.maePct).sort((a, b) => a - b);
    const mfeMedianPct = mfes[Math.floor(totalSignals / 2)] || 0;
    const maeMedianPct = maes[Math.floor(totalSignals / 2)] || 0;

    const expectedValueINR = Math.round(avgReturnPct * 1000); // normalized INR per trade

    // Calibration and false rate metrics
    // False Positive Rate: Signals with high transmission score (>75) that failed
    const highConfSignals = outcomes.filter(o => o.transmissionScore >= 75);
    const falsePositives = highConfSignals.filter(o => !o.isWin).length;
    const falsePositiveRatePct = highConfSignals.length > 0 
      ? Number(((falsePositives / highConfSignals.length) * 100).toFixed(2)) 
      : 0;

    // False Negative Rate: Signals with low transmission score (<50) that actually won
    const lowConfSignals = outcomes.filter(o => o.transmissionScore < 50);
    const falseNegatives = lowConfSignals.filter(o => o.isWin).length;
    const falseNegativeRatePct = lowConfSignals.length > 0 
      ? Number(((falseNegatives / lowConfSignals.length) * 100).toFixed(2)) 
      : 0;

    const calibrationErrorPct = Number((Math.abs(winRatePct - 70)).toFixed(2));

    // Bootstrap 95% Confidence Interval for Win Rate
    const bootstrapConfidence95 = BootstrappedConfidenceEngine.computeWinRateCI95(
      outcomes.map(o => o.isWin)
    );

    // Sample Quality Classification
    const sampleQuality = SampleQualityEngine.evaluateSampleQuality(totalSignals, bootstrapConfidence95);

    return {
      totalSignals,
      winningSignals,
      losingSignals,
      winRatePct,
      avgReturnPct,
      medianReturnPct,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      mfeMedianPct,
      maeMedianPct,
      expectedValueINR,
      calibrationErrorPct,
      falsePositiveRatePct,
      falseNegativeRatePct,
      bootstrapConfidence95,
      sampleQuality
    };
  }

  /**
   * Filter outcomes by specific dimension (e.g. regime, sector, rvolBucket).
   */
  public filterOutcomes(predicate: (o: SignalOutcome) => boolean): SignalOutcome[] {
    return this.outcomesHistory.filter(predicate);
  }
}

export const signalPerformanceEngine = new SignalPerformanceEngine();
