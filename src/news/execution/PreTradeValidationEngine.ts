/**
 * ATHENA NEWS ENGINE — PHASE 14
 * PreTradeValidationEngine.ts
 * 
 * Deterministic Pre-Trade Validation Engine.
 * Enforces rigorous pre-trade verification across market conditions, portfolio constraints,
 * strategy validity, and hard safety gates before order construction.
 */

import { ExecutionIntent, ExecutionValidationResult } from './types.ts';
import { PortfolioSnapshot, PortfolioDecision } from '../portfolio/types.ts';
import { CanonicalStrategyCandidate } from '../quant/types.ts';
import { marketTruthCircuitBreaker } from '../market-truth/MarketTruthCircuitBreaker.ts';

export class PreTradeValidationEngine {
  private static instance: PreTradeValidationEngine;
  private recentExecutionSignatures: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): PreTradeValidationEngine {
    if (!this.instance) {
      this.instance = new PreTradeValidationEngine();
    }
    return this.instance;
  }

  /**
   * Deterministically validates an ExecutionIntent against market, portfolio, and strategy rules.
   */
  public validateExecution(
    intent: ExecutionIntent,
    candidate: CanonicalStrategyCandidate,
    decision: PortfolioDecision,
    snapshot: PortfolioSnapshot,
    quoteAgeMs: number = 500,
    isMarketOpen: boolean = true
  ): ExecutionValidationResult {
    const rejectionReasons: string[] = [];
    const warnings: string[] = [];
    const validatedAt = new Date().toISOString();

    // 1. HARD REJECT: Market Truth Circuit Breaker Tripped (Phase 22 Safety Gate)
    if (!marketTruthCircuitBreaker.canAuthorizeExecution()) {
      const cbStatus = marketTruthCircuitBreaker.getStatus();
      rejectionReasons.push(`HARD_REJECT: Market Truth Circuit Breaker is active (${cbStatus.state}). Reason: ${cbStatus.tripReason || 'Unsafe market state'}. Trade authorization locked.`);
    }

    // 2. HARD REJECT: Invalid Quantity
    if (!intent.quantity || intent.quantity <= 0) {
      rejectionReasons.push('HARD_REJECT: Invalid or non-positive order quantity.');
    }

    // 2. HARD REJECT: Runaway Quantity (> 500 lots or 10,000 shares single order limit)
    const maxSingleOrderQty = intent.assetClass === 'EQUITY' ? 10000 : 500;
    if (intent.quantity > maxSingleOrderQty) {
      rejectionReasons.push(`HARD_REJECT: Runaway order quantity (${intent.quantity} exceeds max limit ${maxSingleOrderQty}).`);
    }

    // 3. HARD REJECT: Contradictory Signal / Portfolio Gate Rejection
    if (decision.decision === 'NO_TRADE' || intent.portfolioGateStatus === 'NO_TRADE') {
      rejectionReasons.push('HARD_REJECT: Portfolio Decision is NO_TRADE. Trade execution strictly prohibited.');
    }

    // 4. HARD REJECT: Insufficient Margin / Capital
    const requiredMargin = intent.targetPrice * intent.quantity * (intent.assetClass === 'EQUITY' ? 1.0 : 0.2);
    if (requiredMargin > snapshot.availableCapitalINR) {
      rejectionReasons.push(`HARD_REJECT: Insufficient available capital/margin (Required: ₹${requiredMargin.toFixed(0)}, Available: ₹${snapshot.availableCapitalINR.toFixed(0)}).`);
    }

    // 5. HARD REJECT: Stale Quote (> 60,000 ms)
    if (quoteAgeMs > 60000) {
      rejectionReasons.push(`HARD_REJECT: Stale market quote detected (Age: ${(quoteAgeMs / 1000).toFixed(1)}s exceeds 60s limit).`);
    }

    // 6. HARD REJECT: Closed Market / Invalid Session
    if (!isMarketOpen) {
      rejectionReasons.push('HARD_REJECT: Market is currently closed or trading session is invalid.');
    }

    // 7. HARD REJECT: Duplicate Order Detection (< 5,000 ms window)
    const sigKey = `${intent.symbol}-${intent.side}-${intent.quantity}-${intent.targetPrice}`;
    const lastTime = this.recentExecutionSignatures.get(sigKey);
    const now = Date.now();
    if (lastTime && (now - lastTime) < 5000) {
      rejectionReasons.push(`HARD_REJECT: Duplicate order detected within 5-second window.`);
    }

    // 8. HARD REJECT: Signal Expiry (Intent timestamp > 24 hours old)
    const intentAgeMs = now - new Date(intent.timestamp).getTime();
    if (intentAgeMs > 86400000) {
      rejectionReasons.push('HARD_REJECT: Underlying market signal or execution intent has expired.');
    }

    // 9. HARD REJECT: Price Deviation (> 2.5% from candidate entry price)
    if (candidate.entryPrice > 0) {
      const priceDevPct = Math.abs((intent.targetPrice - candidate.entryPrice) / candidate.entryPrice) * 100;
      if (priceDevPct > 2.5) {
        rejectionReasons.push(`HARD_REJECT: Target price deviation (${priceDevPct.toFixed(2)}%) exceeds 2.5% maximum tolerance.`);
      }
    }

    // 10. HARD REJECT: Portfolio Drawdown Emergency / Preservation Breach
    if (snapshot.usedMarginINR > snapshot.totalCapitalINR * 0.95) {
      rejectionReasons.push('HARD_REJECT: Portfolio margin utilization exceeds 95% extreme drawdown threshold.');
    }

    // Record signature if valid or non-duplicate
    if (!lastTime || (now - lastTime) >= 5000) {
      this.recentExecutionSignatures.set(sigKey, now);
    }

    // WARNINGS
    if (quoteAgeMs > 10000 && quoteAgeMs <= 60000) {
      warnings.push(`Market quote is lagging (Age: ${(quoteAgeMs / 1000).toFixed(1)}s).`);
    }
    if (snapshot.usedMarginINR > snapshot.totalCapitalINR * 0.70) {
      warnings.push('Portfolio margin utilization is elevated (>70%).');
    }

    const hardRejection = rejectionReasons.some(r => r.startsWith('HARD_REJECT'));
    const isValid = rejectionReasons.length === 0;

    return {
      isValid,
      hardRejection,
      rejectionReasons,
      warnings,
      validatedAt,
      quoteTimestampAgeMs: quoteAgeMs,
      marketSessionValid: isMarketOpen
    };
  }

  public clearDuplicateCache() {
    this.recentExecutionSignatures.clear();
  }
}

export const preTradeValidationEngine = PreTradeValidationEngine.getInstance();
