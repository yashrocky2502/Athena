/**
 * ATHENA NEWS ENGINE — PHASE 15
 * NoTradePerformanceEngine.ts
 * 
 * Measures counterfactual performance for rejected setups (NO_TRADE decisions).
 * Evaluates risk avoidance explicitly rather than judging strictly by missed profit.
 * 
 * Classifies NO_TRADE outcomes into:
 * - GOOD_NO_TRADE
 * - BAD_NO_TRADE
 * - MISSED_OPPORTUNITY
 * - CORRECT_RISK_BLOCK
 */

import { NoTradePerformanceRecord, CompleteLineage } from './types.ts';
import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';
import { PortfolioDecision } from '../portfolio/types.ts';

export class NoTradePerformanceEngine {
  /**
   * Evaluates counterfactual market movement following a NO_TRADE decision.
   */
  public evaluateNoTradeDecision(
    lineage: CompleteLineage,
    decision: PortfolioDecision,
    simulatedPostEventPriceChangePct = -2.5,
    entryPrice = 1800
  ): NoTradePerformanceRecord {
    const symbol = decision.symbol;
    const decisionReason = decision.rationales?.[0] || 'Risk gate rejected portfolio addition';

    const hypotheticalQty = decision.positionSizing?.recommendedQuantity || 100;
    const hypotheticalExitPrice = entryPrice * (1 + simulatedPostEventPriceChangePct / 100);
    const hypotheticalPnLINR = Math.round(hypotheticalQty * (hypotheticalExitPrice - entryPrice));

    let classification: NoTradePerformanceRecord['classification'] = 'GOOD_NO_TRADE';
    let avoidedLossINR = 0;
    let avoidedDrawdownPct = 0;
    let missedProfitINR = 0;

    if (simulatedPostEventPriceChangePct < 0) {
      avoidedLossINR = Math.abs(hypotheticalPnLINR);
      avoidedDrawdownPct = Number(((avoidedLossINR / 500000) * 100).toFixed(2));
      classification = (decision.riskGateStatus === 'NO_TRADE' || decision.riskGateStatus === 'WATCH') ? 'CORRECT_RISK_BLOCK' : 'GOOD_NO_TRADE';
    } else {
      missedProfitINR = hypotheticalPnLINR;
      classification = missedProfitINR > 10000 ? 'MISSED_OPPORTUNITY' : 'BAD_NO_TRADE';
    }

    return {
      recordId: `notrade-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      lineage,
      symbol,
      decisionReason,
      counterfactualHypothesis: {
        hypotheticalEntryPrice: entryPrice,
        hypotheticalMaxAdversePrice: entryPrice * 0.96,
        hypotheticalExitPrice,
        hypotheticalPnLINR
      },
      classification,
      avoidedLossINR,
      avoidedDrawdownPct,
      missedProfitINR,
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const noTradePerformanceEngine = new NoTradePerformanceEngine();
