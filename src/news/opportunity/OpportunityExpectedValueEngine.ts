/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Expected Value & Quantitative Risk/Reward Engine
 */

import {
  ExpectedValueResult,
  HistoricalAnalogueResult,
  MultiSourceConfirmationResult,
  RegimeCompatibilityResult
} from './types';

export class OpportunityExpectedValueEngine {
  private static instance: OpportunityExpectedValueEngine;

  public static getInstance(): OpportunityExpectedValueEngine {
    if (!OpportunityExpectedValueEngine.instance) {
      OpportunityExpectedValueEngine.instance = new OpportunityExpectedValueEngine();
    }
    return OpportunityExpectedValueEngine.instance;
  }

  /**
   * Deterministically computes Expected Value, Risk/Reward, Slippage & Frictional Costs
   */
  public calculateExpectedValue(params: {
    symbol: string;
    analogueResult: HistoricalAnalogueResult;
    confirmation: MultiSourceConfirmationResult;
    regimeResult: RegimeCompatibilityResult;
    currentPrice: number;
    targetPrice?: number;
    stopLossPrice?: number;
    liquidityScore?: number;
  }): ExpectedValueResult {
    const notes: string[] = [];

    // Check data sufficiency
    if (!params.analogueResult.hasSufficientData && params.confirmation.confirmationScore < 40) {
      return {
        probabilityOfSuccess: 0,
        expectedProfitPct: 0,
        expectedLossPct: 0,
        expectedValuePct: 0,
        riskRewardRatio: 0,
        maxAdverseExcursion: 0,
        maxFavourableExcursion: 0,
        estimatedSlippageBps: 0,
        transactionCostsBps: 0,
        hasSufficientDeterministicEvidence: false,
        calculationNotes: ['INSUFFICIENT_DETERMINISTIC_EVIDENCE: Historical analogues and confirmation scores are inadequate']
      };
    }

    // 1. Deterministic Probability of Success Calculation
    // Base prior from historical win rate, adjusted by confirmation score & regime compatibility
    const baseWinRate = params.analogueResult.historicalWinRate || 0.55;
    const confirmationAdjustment = ((params.confirmation.confirmationScore - 50) / 100) * 0.18; // [-0.09, +0.09]
    const regimeAdjustment = ((params.regimeResult.compatibilityScore - 50) / 100) * 0.10; // [-0.05, +0.05]

    let probSuccess = baseWinRate + confirmationAdjustment + regimeAdjustment;
    probSuccess = Math.max(0.15, Math.min(0.88, probSuccess));
    probSuccess = Number(probSuccess.toFixed(3));

    // 2. Expected Returns & Losses
    let expectedProfitPct = params.analogueResult.historicalAvgReturnPct > 0 
      ? params.analogueResult.historicalAvgReturnPct 
      : 2.8;
    
    let expectedLossPct = Math.abs(params.analogueResult.maxAdverseExcursionPct) > 0 
      ? Math.abs(params.analogueResult.maxAdverseExcursionPct) 
      : 1.2;

    // Adjust target / stop if user supplied explicit prices
    if (params.targetPrice && params.stopLossPrice && params.currentPrice > 0) {
      const explicitProfit = Math.abs((params.targetPrice - params.currentPrice) / params.currentPrice) * 100;
      const explicitLoss = Math.abs((params.currentPrice - params.stopLossPrice) / params.currentPrice) * 100;
      if (explicitProfit > 0 && explicitLoss > 0) {
        expectedProfitPct = Number(explicitProfit.toFixed(2));
        expectedLossPct = Number(explicitLoss.toFixed(2));
      }
    }

    // 3. Friction & Slippage
    const liqScore = params.liquidityScore ?? 80;
    const estimatedSlippageBps = liqScore >= 85 ? 4 : liqScore >= 60 ? 10 : 25; // 4 to 25 bps
    const transactionCostsBps = 7.5; // STT, exchange, SEBI, stamp duty for Indian equities
    const totalFrictionPct = (estimatedSlippageBps + transactionCostsBps) / 100; // e.g. 0.115%

    // 4. Mathematical Expectancy formula:
    // EV = (P(Win) * ExpectedProfit%) - ((1 - P(Win)) * ExpectedLoss%) - TotalFriction%
    const rawEv = (probSuccess * expectedProfitPct) - ((1 - probSuccess) * expectedLossPct) - totalFrictionPct;
    const expectedValuePct = Number(rawEv.toFixed(3));

    // 5. Risk / Reward Ratio: ExpectedProfit / ExpectedLoss
    const riskRewardRatio = expectedLossPct > 0 ? Number((expectedProfitPct / expectedLossPct).toFixed(2)) : 1.0;

    notes.push(`Base Historical Win Rate: ${(baseWinRate * 100).toFixed(1)}%`);
    notes.push(`Confirmation Adjusted Probability: ${(probSuccess * 100).toFixed(1)}%`);
    notes.push(`Target Win: +${expectedProfitPct}% | Stop Loss: -${expectedLossPct}%`);
    notes.push(`Risk/Reward: 1 : ${riskRewardRatio}`);
    notes.push(`Friction (Slippage ${estimatedSlippageBps} bps + STT/Exch ${transactionCostsBps} bps): -${totalFrictionPct.toFixed(3)}%`);
    notes.push(`Deterministic Expected Value: ${expectedValuePct > 0 ? '+' : ''}${expectedValuePct}%`);

    return {
      probabilityOfSuccess: probSuccess,
      expectedProfitPct,
      expectedLossPct,
      expectedValuePct,
      riskRewardRatio,
      maxAdverseExcursion: params.analogueResult.maxAdverseExcursionPct || -expectedLossPct,
      maxFavourableExcursion: params.analogueResult.maxFavourableExcursionPct || expectedProfitPct,
      estimatedSlippageBps,
      transactionCostsBps,
      hasSufficientDeterministicEvidence: true,
      calculationNotes: notes
    };
  }
}
