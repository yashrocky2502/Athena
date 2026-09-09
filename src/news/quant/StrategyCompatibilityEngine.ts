/**
 * ATHENA NEWS ENGINE — PHASE 12
 * StrategyCompatibilityEngine.ts
 * 
 * Deterministic Compatibility Engine.
 * Evaluates match between Phase 11 Signal & Candidate Strategy.
 * Computes compatibilityScore (0–100) & CompatibilityRating.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic rules.
 */

import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { StrategyType, CompatibilityRating } from './types.ts';
import { STRATEGY_TEMPLATES } from './StrategyTemplateSystem.ts';

export interface CompatibilityEvaluationResult {
  compatibilityScore: number; // 0-100
  compatibilityRating: CompatibilityRating;
  reasons: string[];
  breakdown: {
    directionAlignment: number; // 25 max
    transmissionScoreWeight: number; // 20 max
    volumeConfirmationWeight: number; // 15 max
    fnoConfirmationWeight: number; // 15 max
    regimeAlignmentWeight: number; // 15 max
    lifecycleStateWeight: number; // 10 max
  };
}

export class StrategyCompatibilityEngine {
  private static instance: StrategyCompatibilityEngine;

  private constructor() {}

  public static getInstance(): StrategyCompatibilityEngine {
    if (!this.instance) {
      this.instance = new StrategyCompatibilityEngine();
    }
    return this.instance;
  }

  /**
   * Deterministically evaluates compatibility between a Phase 11 Signal & a Strategy Candidate.
   */
  public evaluateCompatibility(
    signal: TransmissionSignalResult,
    strategyType: StrategyType,
    candidateDirection: 'LONG' | 'SHORT' | 'NEUTRAL'
  ): CompatibilityEvaluationResult {
    const tmpl = STRATEGY_TEMPLATES[strategyType];
    const reasons: string[] = [];
    const isContradicted = signal.alignment === 'CONTRADICTED' || signal.lifecycleState === 'CONTRADICTED' || signal.lifecycleState === 'INVALIDATED';

    if (strategyType === 'NO_TRADE_STRATEGY') {
      return {
        compatibilityScore: isContradicted ? 100 : 50,
        compatibilityRating: isContradicted ? 'COMPATIBLE' : 'CONDITIONAL',
        reasons: [isContradicted ? 'Signal is contradicted. Capital preservation is 100% compatible.' : 'Baseline capital preservation option.'],
        breakdown: { directionAlignment: 25, transmissionScoreWeight: 20, volumeConfirmationWeight: 15, fnoConfirmationWeight: 15, regimeAlignmentWeight: 15, lifecycleStateWeight: 10 }
      };
    }

    // 1. Direction Alignment (25 Points Max)
    let directionScore = 0;
    const isHeadlineBullish = /win|order|profit|growth|expansion|surge|record|rise|gain|contract/i.test(signal.headline || '') ||
                              /win|order|profit|growth|expansion|surge|record|rise|gain|contract/i.test(signal.canonicalSummary || '');
    const isHeadlineBearish = /loss|fall|decline|drop|plunge|slash|fine|probe|investigation|fraud|lawsuit/i.test(signal.headline || '') ||
                              /loss|fall|decline|drop|plunge|slash|fine|probe|investigation|fraud|lawsuit/i.test(signal.canonicalSummary || '');

    const sigDir = (signal.marketReaction?.totalChangePct && signal.marketReaction.totalChangePct > 0) ? 'BULLISH' :
                   (signal.marketReaction?.totalChangePct && signal.marketReaction.totalChangePct < 0) ? 'BEARISH' :
                   isHeadlineBullish ? 'BULLISH' :
                   isHeadlineBearish ? 'BEARISH' : 'NEUTRAL';

    if (candidateDirection === 'LONG' && (sigDir === 'BULLISH' || signal.marketReaction?.totalChangePct > 0)) {
      directionScore = 25;
      reasons.push('Long strategy direction perfectly aligns with bullish catalyst.');
    } else if (candidateDirection === 'SHORT' && (sigDir === 'BEARISH' || signal.marketReaction?.totalChangePct < 0)) {
      directionScore = 25;
      reasons.push('Short strategy direction perfectly aligns with bearish catalyst.');
    } else if (candidateDirection === 'NEUTRAL' && sigDir === 'NEUTRAL') {
      directionScore = 25;
      reasons.push('Neutral strategy aligns with rangebound catalyst.');
    } else {
      directionScore = 0;
      reasons.push(`Direction mismatch: Candidate is ${candidateDirection} while Signal is ${sigDir}.`);
    }

    // 2. Transmission Score Weight (20 Points Max)
    const tScore = signal.transmissionScore || 0;
    let transmissionWeight = 0;
    if (tScore >= tmpl.minTransmissionScore) {
      transmissionWeight = Math.min(20, Math.round((tScore / 100) * 20));
      reasons.push(`Transmission score (${tScore}/100) satisfies template minimum (${tmpl.minTransmissionScore}).`);
    } else {
      transmissionWeight = Math.max(0, Math.round((tScore / tmpl.minTransmissionScore) * 10));
      reasons.push(`Transmission score (${tScore}) below optimal template minimum (${tmpl.minTransmissionScore}).`);
    }

    // 3. Volume Confirmation Weight (15 Points Max)
    const rvol = signal.marketReaction?.rvol || 1.0;
    let volumeWeight = 0;
    if (rvol >= 2.0) {
      volumeWeight = 15;
      reasons.push(`High relative volume (${rvol}x RVOL) provides strong breakout confirmation.`);
    } else if (rvol >= 1.3) {
      volumeWeight = 11;
      reasons.push(`Moderate relative volume (${rvol}x RVOL).`);
    } else {
      volumeWeight = 5;
      reasons.push(`Subdued relative volume (${rvol}x RVOL).`);
    }

    // 4. F&O Positioning Confirmation Weight (15 Points Max)
    let fnoWeight = 10;
    if (signal.fnoPositioning) {
      if (signal.fnoPositioning.classification === 'CONTRADICTORY_FLOW') {
        fnoWeight = 0;
        reasons.push('F&O option flow contradicts spot price movement.');
      } else if (signal.fnoPositioning.confidence > 70) {
        fnoWeight = 15;
        reasons.push('F&O open interest buildup strongly confirms directional bias.');
      }
    }

    // 5. Market Regime Alignment Weight (15 Points Max)
    let regimeWeight = 12;
    if (signal.marketRegime === 'RISK_ON' && candidateDirection === 'LONG') {
      regimeWeight = 15;
    } else if (signal.marketRegime === 'HIGH_VOLATILITY' && strategyType.startsWith('OPTION_LONG')) {
      regimeWeight = 15;
    }

    // 6. Signal Lifecycle State Weight (10 Points Max)
    let lifecycleWeight = 0;
    if (signal.lifecycleState === 'CONFIRMED' || signal.lifecycleState === 'ACTIVE') {
      lifecycleWeight = 10;
    } else if (signal.lifecycleState === 'NEW') {
      lifecycleWeight = 6;
    } else if (signal.lifecycleState === 'WEAKENING') {
      lifecycleWeight = 3;
      reasons.push('Signal lifecycle state is WEAKENING.');
    } else if (isContradicted) {
      lifecycleWeight = 0;
      reasons.push('Signal is CONTRADICTED or INVALIDATED.');
    }

    // Penalize if signal is contradicted
    let rawSum = directionScore + transmissionWeight + volumeWeight + fnoWeight + regimeWeight + lifecycleWeight;
    if (isContradicted) {
      rawSum = Math.min(25, Math.round(rawSum * 0.2));
    }

    const finalScore = Math.min(100, Math.max(0, rawSum));

    let rating: CompatibilityRating = 'INCOMPATIBLE';
    if (finalScore >= 80) rating = 'COMPATIBLE';
    else if (finalScore >= 60) rating = 'CONDITIONAL';
    else if (finalScore >= 40) rating = 'WEAK';
    else rating = 'INCOMPATIBLE';

    return {
      compatibilityScore: finalScore,
      compatibilityRating: rating,
      reasons,
      breakdown: {
        directionAlignment: directionScore,
        transmissionScoreWeight: transmissionWeight,
        volumeConfirmationWeight: volumeWeight,
        fnoConfirmationWeight: fnoWeight,
        regimeAlignmentWeight: regimeWeight,
        lifecycleStateWeight: lifecycleWeight
      }
    };
  }
}

export const strategyCompatibilityEngine = StrategyCompatibilityEngine.getInstance();
