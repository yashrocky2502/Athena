/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Evidence-Backed Deterministic Opportunity Scoring Engine
 */

import {
  MathematicalDecomposition,
  MultiSourceConfirmationResult,
  HistoricalAnalogueResult,
  RegimeCompatibilityResult,
  ExpectedValueResult
} from './types';

export class OpportunityScoringEngine {
  private static instance: OpportunityScoringEngine;

  // Transparent weights
  public readonly WEIGHTS = {
    evidenceWeight: 0.22,
    confirmationWeight: 0.24,
    historicalWeight: 0.16,
    regimeWeight: 0.14,
    liquidityWeight: 0.10,
    expectedValueWeight: 0.14
  };

  public static getInstance(): OpportunityScoringEngine {
    if (!OpportunityScoringEngine.instance) {
      OpportunityScoringEngine.instance = new OpportunityScoringEngine();
    }
    return OpportunityScoringEngine.instance;
  }

  /**
   * Computes the transparent deterministic Opportunity Score with full mathematical decomposition
   */
  public computeOpportunityScore(params: {
    evidenceQualityScore: number;
    evidenceFreshnessScore: number;
    confirmation: MultiSourceConfirmationResult;
    historicalAnalogue: HistoricalAnalogueResult;
    regimeCompatibility: RegimeCompatibilityResult;
    expectedValueResult: ExpectedValueResult;
    liquidityScore: number;
    contradictionScore: number;
    riskScore: number;
  }): {
    finalScore: number;
    confidenceScore: number;
    decomposition: MathematicalDecomposition;
  } {
    // 1. Evidence Component (Blends Quality and Freshness)
    const combinedEvidenceScore = (params.evidenceQualityScore * 0.65) + (params.evidenceFreshnessScore * 0.35);
    const evidenceScoreComponent = combinedEvidenceScore * this.WEIGHTS.evidenceWeight;

    // 2. Confirmation Component
    const confirmationScoreComponent = params.confirmation.confirmationScore * this.WEIGHTS.confirmationWeight;

    // 3. Historical Support Component
    const historicalSupportComponent = params.historicalAnalogue.qualityScore * this.WEIGHTS.historicalWeight;

    // 4. Regime Compatibility Component
    const regimeCompatibilityComponent = params.regimeCompatibility.compatibilityScore * this.WEIGHTS.regimeWeight;

    // 5. Liquidity Component
    const liquidityComponent = params.liquidityScore * this.WEIGHTS.liquidityWeight;

    // 6. Expected Value Component (normalized 0 - 100 based on positive EV)
    const normalizedEvScore = Math.max(0, Math.min(100, (params.expectedValueResult.expectedValuePct + 1.0) * 35));
    const expectedValueComponent = normalizedEvScore * this.WEIGHTS.expectedValueWeight;

    // 7. Sum components to get raw positive score
    const rawScore = Number((
      evidenceScoreComponent +
      confirmationScoreComponent +
      historicalSupportComponent +
      regimeCompatibilityComponent +
      liquidityComponent +
      expectedValueComponent
    ).toFixed(2));

    // 8. Penalties
    const contradictionPenalty = Number(((params.contradictionScore / 100) * 35).toFixed(2));
    const riskPenalty = Number(((params.riskScore / 100) * 20).toFixed(2));

    // 9. Final Score Calculation
    let finalScore = Math.round(rawScore - contradictionPenalty - riskPenalty);
    finalScore = Math.max(0, Math.min(100, finalScore));

    // 10. Confidence Score Calculation
    let confidenceScore = Math.round(
      (combinedEvidenceScore * 0.30) +
      (params.confirmation.confirmationScore * 0.35) +
      (params.historicalAnalogue.qualityScore * 0.20) +
      (params.regimeCompatibility.compatibilityScore * 0.15) -
      (contradictionPenalty * 0.8)
    );
    confidenceScore = Math.max(0, Math.min(100, confidenceScore));

    const formula = `OpportunityScore = round((${this.WEIGHTS.evidenceWeight} * Evidence[${combinedEvidenceScore.toFixed(1)}]) + (${this.WEIGHTS.confirmationWeight} * Confirmation[${params.confirmation.confirmationScore}]) + (${this.WEIGHTS.historicalWeight} * Historical[${params.historicalAnalogue.qualityScore}]) + (${this.WEIGHTS.regimeWeight} * Regime[${params.regimeCompatibility.compatibilityScore}]) + (${this.WEIGHTS.liquidityWeight} * Liquidity[${params.liquidityScore}]) + (${this.WEIGHTS.expectedValueWeight} * EV[${normalizedEvScore.toFixed(1)}]) - ContradictionPenalty[${contradictionPenalty}] - RiskPenalty[${riskPenalty}]) = ${finalScore}`;

    const decomposition: MathematicalDecomposition = {
      evidenceScoreComponent: Number(evidenceScoreComponent.toFixed(2)),
      confirmationScoreComponent: Number(confirmationScoreComponent.toFixed(2)),
      historicalSupportComponent: Number(historicalSupportComponent.toFixed(2)),
      regimeCompatibilityComponent: Number(regimeCompatibilityComponent.toFixed(2)),
      liquidityComponent: Number(liquidityComponent.toFixed(2)),
      expectedValueComponent: Number(expectedValueComponent.toFixed(2)),
      contradictionPenalty,
      riskPenalty,
      rawScore,
      finalScore,
      weights: this.WEIGHTS,
      equationFormula: formula
    };

    return {
      finalScore,
      confidenceScore,
      decomposition
    };
  }
}
