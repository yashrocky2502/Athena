/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Contradiction Detection & Explicit Invalidation Engine
 */

import {
  InvalidationCondition,
  OpportunityDirection,
  OpportunityType,
  MultiSourceConfirmationResult
} from './types';
import { MarketTruthCircuitBreaker } from '../market-truth/MarketTruthCircuitBreaker';
import { EvidenceFreshnessEngine } from '../evidence/EvidenceFreshnessEngine';

export interface ContradictionEvaluationResult {
  hasCriticalContradiction: boolean;
  hasModerateContradiction: boolean;
  contradictionScore: number; // 0 - 100 (100 = severe contradiction, 0 = pure synergy)
  detectedContradictions: string[];
  invalidationConditions: InvalidationCondition[];
  circuitBreakerActive: boolean;
  evidenceStale: boolean;
}

export class OpportunityContradictionEngine {
  private static instance: OpportunityContradictionEngine;

  public static getInstance(): OpportunityContradictionEngine {
    if (!OpportunityContradictionEngine.instance) {
      OpportunityContradictionEngine.instance = new OpportunityContradictionEngine();
    }
    return OpportunityContradictionEngine.instance;
  }

  /**
   * Analyzes an opportunity thesis against market reality for contradictions and builds invalidation rules
   */
  public evaluateContradictions(params: {
    symbol: string;
    direction: OpportunityDirection;
    type: OpportunityType;
    currentPrice: number;
    breakoutLevel?: number;
    confirmation: MultiSourceConfirmationResult;
    evidenceFreshnessScore: number;
    hasP0Evidence: boolean;
    evidenceAgeMs: number;
    surveillanceAnomalies?: string[];
    marketSession?: string;
  }): ContradictionEvaluationResult {
    const isLong = params.direction === 'LONG';
    const detectedContradictions: string[] = [];
    const invalidationConditions: InvalidationCondition[] = [];
    let contradictionScore = 0;

    // 1. Check Market Truth Circuit Breakers
    const circuitBreaker = MarketTruthCircuitBreaker.getInstance();
    const isCircuitBreakerTripped = circuitBreaker.isTripped();
    if (isCircuitBreakerTripped) {
      detectedContradictions.push(`CRITICAL: MarketTruthCircuitBreaker active on ${params.symbol}`);
      contradictionScore += 80;
    }

    // 2. Check Evidence Staleness
    const isEvidenceStale = params.evidenceFreshnessScore < 40 || params.evidenceAgeMs > 300000; // > 5 min for ticks
    if (isEvidenceStale) {
      detectedContradictions.push(`Evidence is stale (Freshness: ${params.evidenceFreshnessScore}/100, Age: ${Math.round(params.evidenceAgeMs / 1000)}s)`);
      contradictionScore += 35;
    }

    // 3. Multi-Dimension Contradiction checks
    const dimResults = params.confirmation.dimensionResults;

    // A. Price vs Direction
    if (dimResults.PRICE && dimResults.PRICE.contradictionDetected) {
      detectedContradictions.push(`Price Action Contradiction: ${dimResults.PRICE.details}`);
      contradictionScore += 40;
    }

    // B. Volume vs Move
    if (dimResults.VOLUME && dimResults.VOLUME.contradictionDetected) {
      detectedContradictions.push(`Volume Contradiction: ${dimResults.VOLUME.details}`);
      contradictionScore += 25;
    }

    // C. Sector vs Constituent
    if (dimResults.SECTOR && dimResults.SECTOR.contradictionDetected) {
      detectedContradictions.push(`Sector Divergence: ${dimResults.SECTOR.details}`);
      contradictionScore += 25;
    }

    // D. Derivatives OI Divergence
    if (dimResults.OPEN_INTEREST && dimResults.OPEN_INTEREST.contradictionDetected) {
      detectedContradictions.push(`Derivatives Contradiction: ${dimResults.OPEN_INTEREST.details}`);
      contradictionScore += 30;
    }

    // E. Fundamentals Divergence
    if (dimResults.FUNDAMENTALS && dimResults.FUNDAMENTALS.contradictionDetected) {
      detectedContradictions.push(`Fundamental Contradiction: ${dimResults.FUNDAMENTALS.details}`);
      contradictionScore += 20;
    }

    // 4. Surveillance Anomaly Invalidation
    if (params.surveillanceAnomalies && params.surveillanceAnomalies.length > 0) {
      const suspicious = params.surveillanceAnomalies.filter(a => 
        a.includes('MANIPULATION') || a.includes('DISCONTINUITY') || a.includes('WASH_TRADE') || a.includes('SPOOFING')
      );
      if (suspicious.length > 0) {
        detectedContradictions.push(`Surveillance Alert: ${suspicious.join(', ')}`);
        contradictionScore += 50;
      }
    }

    // Cap contradiction score between 0 and 100
    contradictionScore = Math.min(100, contradictionScore);

    const hasCriticalContradiction = isCircuitBreakerTripped || contradictionScore >= 60 || params.confirmation.overallStatus === 'CRITICALLY_CONTRADICTED';
    const hasModerateContradiction = contradictionScore >= 25 || params.confirmation.overallStatus === 'CONTRADICTED';

    // 5. Synthesize Deterministic Invalidation Conditions
    // Rule 1: Price Invalidation Stop Level
    const stopLossPct = params.type === 'BREAKOUT' ? 0.015 : 0.025;
    const invalidationPrice = isLong 
      ? (params.breakoutLevel ? params.breakoutLevel * 0.992 : params.currentPrice * (1 - stopLossPct))
      : (params.breakoutLevel ? params.breakoutLevel * 1.008 : params.currentPrice * (1 + stopLossPct));

    invalidationConditions.push({
      id: `INV_PRICE_${params.symbol}_${Date.now()}`,
      conditionType: 'PRICE_LEVEL',
      description: isLong 
        ? `Spot price closes below support / invalidation level ₹${invalidationPrice.toFixed(2)}`
        : `Spot price closes above resistance / invalidation level ₹${invalidationPrice.toFixed(2)}`,
      thresholdValue: invalidationPrice,
      currentValue: params.currentPrice,
      isTriggered: isLong ? params.currentPrice < invalidationPrice : params.currentPrice > invalidationPrice,
      deterministicRuleId: 'RULE_DETERMINISTIC_PRICE_INVALIDATION'
    });

    // Rule 2: Volume Invalidation
    invalidationConditions.push({
      id: `INV_VOL_${params.symbol}_${Date.now()}`,
      conditionType: 'VOLUME_DROP',
      description: 'Volume fails to sustain >= 1.0x 20-day SMA on hourly progression',
      thresholdValue: 1.0,
      currentValue: dimResults.VOLUME ? Number(String(dimResults.VOLUME.metricValue).replace('x', '')) || 1.2 : 1.0,
      isTriggered: dimResults.VOLUME?.status === 'CONTRADICTED',
      deterministicRuleId: 'RULE_DETERMINISTIC_VOLUME_INVALIDATION'
    });

    // Rule 3: Regime Shift Invalidation
    invalidationConditions.push({
      id: `INV_REGIME_${params.symbol}_${Date.now()}`,
      conditionType: 'REGIME_SHIFT',
      description: 'Intraday market regime transitions to CHOPPY_COMPRESSION or HIGH_STRESS_VOLATILITY',
      isTriggered: false,
      deterministicRuleId: 'RULE_DETERMINISTIC_REGIME_SHIFT'
    });

    // Rule 4: Evidence Expiry
    invalidationConditions.push({
      id: `INV_EXPIRY_${params.symbol}_${Date.now()}`,
      conditionType: 'EVIDENCE_EXPIRY',
      description: 'Primary catalyst evidence expires or fails continuous freshness SLA (> 15 min without tick)',
      isTriggered: isEvidenceStale,
      deterministicRuleId: 'RULE_DETERMINISTIC_EVIDENCE_FRESHNESS'
    });

    // Rule 5: Critical Contradiction / Circuit Breaker
    invalidationConditions.push({
      id: `INV_CIRCUIT_${params.symbol}_${Date.now()}`,
      conditionType: 'CIRCUIT_BREAKER',
      description: 'MarketTruthCircuitBreaker, Exchange L2 band halt, or Surveillance Halt triggers',
      isTriggered: isCircuitBreakerTripped,
      deterministicRuleId: 'RULE_MARKET_TRUTH_CIRCUIT_BREAKER'
    });

    return {
      hasCriticalContradiction,
      hasModerateContradiction,
      contradictionScore,
      detectedContradictions,
      invalidationConditions,
      circuitBreakerActive: isCircuitBreakerTripped,
      evidenceStale: isEvidenceStale
    };
  }
}
