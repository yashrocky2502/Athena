/**
 * ATHENA UNIFIED INTELLIGENCE OS — ConfidencePropagationEngine.ts
 * 
 * Implements Phase 17 weighted confidence propagation rules.
 * Confidence does NOT simply average.
 */

import { ConfidenceReport } from './UnifiedIntelligenceTypes.ts';

export class ConfidencePropagationEngine {
  private static instance: ConfidencePropagationEngine;

  private constructor() {}

  public static getInstance(): ConfidencePropagationEngine {
    if (!this.instance) {
      this.instance = new ConfidencePropagationEngine();
    }
    return this.instance;
  }

  /**
   * Evaluates the propagated confidence across stages with explicit weightings
   */
  public propagate(inputs: {
    sourceTier?: number; // 1 (best), 2, 3
    numericalFactCount?: number; // 0, 1, 2+
    marketConfirmationPassed?: boolean;
    volumeConfirmationPassed?: boolean;
    fnoConfirmationPassed?: boolean;
    historicalWinRatePct?: number;
    strategyRobustnessScore?: number; // 0 - 100
    portfolioCompatibilityScore?: number; // 0 - 100
    executionSlippagePct?: number;
  }): ConfidenceReport {
    const confidenceFactors: string[] = [];
    const confidenceWarnings: string[] = [];
    
    // Start with a raw baseline of 80%
    let rawConfidence = 80.0;

    // 1. Source Reliability Weighting
    if (inputs.sourceTier === 1) {
      rawConfidence += 10.0;
      confidenceFactors.push('Source Tier 1 (Official Exchange/Corporate Publication) confirmed [+10%]');
    } else if (inputs.sourceTier === 3) {
      rawConfidence -= 15.0;
      confidenceWarnings.push('Source Tier 3 (Secondary or Unconfirmed Media publication) [-15%]');
    } else {
      confidenceFactors.push('Source Tier 2 (Standard Mainstream News) [Neutral]');
    }

    // 2. Fact / Numerical Coverage
    const facts = inputs.numericalFactCount ?? 0;
    if (facts >= 2) {
      rawConfidence += 5.0;
      confidenceFactors.push(`High evidence fact density (${facts} numerical metrics verified) [+5%]`);
    } else if (facts === 0) {
      rawConfidence -= 10.0;
      confidenceWarnings.push('Zero numerical facts found in evidence corpus [-10%]');
    }

    // 3. Market Price, Volume & Derivatives Confirmation
    if (inputs.marketConfirmationPassed === true) {
      rawConfidence += 5.0;
      confidenceFactors.push('Market price action matches catalyst direction [+5%]');
    } else if (inputs.marketConfirmationPassed === false) {
      rawConfidence -= 10.0;
      confidenceWarnings.push('Market price action contradicts catalyst direction [-10%]');
    }

    if (inputs.volumeConfirmationPassed === true) {
      rawConfidence += 5.0;
      confidenceFactors.push('Volume expansion confirms breakout direction [+5%]');
    }

    if (inputs.fnoConfirmationPassed === true) {
      rawConfidence += 5.0;
      confidenceFactors.push('F&O derivatives positioning supports signal [+5%]');
    } else if (inputs.fnoConfirmationPassed === false) {
      rawConfidence -= 10.0;
      confidenceWarnings.push('F&O derivatives positioning diverges from signal [-10%]');
    }

    // 4. Historical Precedent
    const winRate = inputs.historicalWinRatePct ?? 50.0;
    if (winRate > 65.0) {
      rawConfidence += 5.0;
      confidenceFactors.push(`Excellent historical analogue precedents (Win Rate: ${winRate}%) [+5%]`);
    } else if (winRate < 45.0) {
      rawConfidence -= 15.0;
      confidenceWarnings.push(`Historical win rate represents low edge (Win Rate: ${winRate}%) [-15%]`);
    }

    // 5. Strategy Robustness & Portfolio Compatibility
    const robustness = inputs.strategyRobustnessScore ?? 75.0;
    if (robustness > 85.0) {
      rawConfidence += 5.0;
      confidenceFactors.push('Robust strategy parameters with high Monte Carlo pass rate [+5%]');
    } else if (robustness < 60.0) {
      rawConfidence -= 10.0;
      confidenceWarnings.push(`Strategy robustness score is weak (${robustness}/100) [-10%]`);
    }

    const compatibility = inputs.portfolioCompatibilityScore ?? 80.0;
    if (compatibility < 50.0) {
      rawConfidence -= 15.0;
      confidenceWarnings.push(`Extreme correlation or concentration conflict with current portfolio (${compatibility}/100) [-15%]`);
    }

    // 6. Execution Quality
    const slippage = inputs.executionSlippagePct ?? 0.0;
    if (slippage > 1.5) {
      rawConfidence -= 10.0;
      confidenceWarnings.push(`High execution slippage detected (${slippage}%) [-10%]`);
    }

    // Bound raw confidence to [0, 100]
    rawConfidence = Math.max(0, Math.min(100, rawConfidence));

    // Dynamic Adjusted Confidence based on warning density
    let adjustedConfidence = rawConfidence;
    if (confidenceWarnings.length >= 3) {
      adjustedConfidence *= 0.75; // 25% penalty for high warnings
      confidenceWarnings.push('Adjusted Confidence heavily penalized due to high density of risk/integrity warnings');
    }

    return {
      rawConfidence: parseFloat(rawConfidence.toFixed(2)),
      adjustedConfidence: parseFloat(adjustedConfidence.toFixed(2)),
      confidenceFactors,
      confidenceWarnings
    };
  }
}
