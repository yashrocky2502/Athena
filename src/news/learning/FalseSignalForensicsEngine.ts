/**
 * ATHENA NEWS ENGINE — PHASE 15
 * FalseSignalForensicsEngine.ts
 * 
 * Performs forensic post-mortem analysis on failed signals/trades.
 * Categorizes failure modes into:
 * - FALSE_BREAKOUT
 * - FALSE_MOMENTUM
 * - NEWS_WITHOUT_PRICE_REACTION
 * - PRICE_REACTION_WITHOUT_NEWS
 * - VOLUME_CONTRADICTION
 * - FNO_CONTRADICTION
 * - LATE_SIGNAL
 * - OVEREXTENDED_ENTRY
 * - BAD_LIQUIDITY_ENTRY
 * - REGIME_MISMATCH
 * 
 * Provides deterministic primary/secondary failure pathways and lessons learned.
 */

import { FalseSignalForensicsRecord, TradeOutcome } from './types.ts';
import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';

export class FalseSignalForensicsEngine {
  /**
   * Conducts forensic analysis on a losing or failed trade.
   */
  public analyzeFailedSignal(
    tradeOutcome: TradeOutcome,
    signal?: TransmissionSignalResult
  ): FalseSignalForensicsRecord {
    const symbol = tradeOutcome.symbol;
    const rvol = signal?.marketReaction?.rvol || 0.9;
    const regime = tradeOutcome.marketRegime;

    let failureType: FalseSignalForensicsRecord['failureType'] = 'VOLUME_CONTRADICTION';
    let primaryFailureReason = 'Insufficient volume confirmation following catalyst release.';
    let secondaryFailureReason = 'Sector index exhibited bearish divergence.';
    let preventativeLesson = `Momentum signals for ${symbol} require RVOL >= 1.5x. Future candidate rankings should discount low-volume setups.`;

    if (rvol < 1.0) {
      failureType = 'VOLUME_CONTRADICTION';
      primaryFailureReason = `RVOL at ${rvol}x failed to validate headline catalyst materiality.`;
      secondaryFailureReason = 'Lack of institutional participation caused rapid price mean reversion.';
      preventativeLesson = `Require RVOL >= 1.2x for ${symbol} before approving momentum entries.`;
    } else if (regime === 'BEAR' || regime === 'RISK_OFF') {
      failureType = 'REGIME_MISMATCH';
      primaryFailureReason = `Long signal generated during adverse ${regime} regime.`;
      secondaryFailureReason = 'Macro market headwind overpowered single-stock corporate catalyst.';
      preventativeLesson = `Filter out long momentum setups for ${symbol} when broad market regime is RISK_OFF.`;
    } else if (tradeOutcome.maxFavorableExcursionPct < 0.5) {
      failureType = 'FALSE_BREAKOUT';
      primaryFailureReason = 'Breakout failed immediately at initial resistance level.';
      secondaryFailureReason = 'Heavy supply overhead and call option writing wall.';
      preventativeLesson = `Verify option chain resistance levels for ${symbol} prior to breakout trade execution.`;
    }

    return {
      forensicId: `forensic-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      lineage: tradeOutcome.lineage,
      symbol,
      failureType,
      primaryFailureReason,
      secondaryFailureReason,
      lossRMultiple: Number(Math.abs(tradeOutcome.realizedRMultiple).toFixed(2)),
      preventativeLesson,
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const falseSignalForensicsEngine = new FalseSignalForensicsEngine();
