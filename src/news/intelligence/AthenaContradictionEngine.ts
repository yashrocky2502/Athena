/**
 * ATHENA UNIFIED INTELLIGENCE OS — AthenaContradictionEngine.ts
 * 
 * Detects contradictions across stages such as:
 * - NEWS BULLISH but PRICE BEARISH
 * - NEWS BULLISH but VOLUME NEGATIVE
 * - SIGNAL BULLISH but F&O POSITIONING BEARISH
 * - STRATEGY POSITIVE but PORTFOLIO RISK GATE FAIL
 * - AI HYPOTHESIS POSITIVE but OOS VALIDATION FAIL
 * - EXECUTION EXPECTED but ACTUAL FILL INVALID
 */

import { AthenaContradiction, ContradictionSeverity } from './UnifiedIntelligenceTypes.ts';

export class AthenaContradictionEngine {
  private static instance: AthenaContradictionEngine;
  private contradictions: Map<string, AthenaContradiction[]> = new Map();

  private constructor() {}

  public static getInstance(): AthenaContradictionEngine {
    if (!this.instance) {
      this.instance = new AthenaContradictionEngine();
    }
    return this.instance;
  }

  public reset(): void {
    this.contradictions.clear();
  }

  /**
   * Evaluate and record any contradictions for an Event or Signal
   */
  public evaluate(
    eventId: string,
    inputs: {
      newsSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      priceDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'SIDEWAYS';
      volumeDirection?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
      signalSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      fnoPositioning?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      strategyStatus?: 'APPROVED' | 'REJECTED' | 'FAILED';
      portfolioRiskGatePassed?: boolean;
      aiHypothesisStatus?: 'POSITIVE' | 'NEGATIVE';
      oosValidationPassed?: boolean;
      executionExpected?: boolean;
      actualFillValid?: boolean;
    }
  ): AthenaContradiction[] {
    const list: AthenaContradiction[] = [];
    const timestamp = new Date().toISOString();

    const addContradiction = (
      severity: ContradictionSeverity,
      affectedStage: string,
      evidence: string,
      description: string
    ) => {
      const item: AthenaContradiction = {
        contradictionId: `contra-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        severity,
        source: 'AthenaContradictionEngine',
        affectedStage,
        evidence,
        resolutionState: 'OPEN',
        description,
        timestamp
      };
      list.push(item);
    };

    // 1. NEWS BULLISH but PRICE BEARISH
    if (inputs.newsSentiment === 'BULLISH' && inputs.priceDirection === 'BEARISH') {
      addContradiction(
        'MATERIAL',
        'MARKET_CONFIRMATION',
        `newsSentiment=${inputs.newsSentiment}, priceDirection=${inputs.priceDirection}`,
        'NEWS sentiment is Bullish but market price action shows Bearish direction.'
      );
    }

    // 2. NEWS BEARISH but PRICE BULLISH
    if (inputs.newsSentiment === 'BEARISH' && inputs.priceDirection === 'BULLISH') {
      addContradiction(
        'MATERIAL',
        'MARKET_CONFIRMATION',
        `newsSentiment=${inputs.newsSentiment}, priceDirection=${inputs.priceDirection}`,
        'NEWS sentiment is Bearish but market price action shows Bullish direction.'
      );
    }

    // 3. NEWS BULLISH but VOLUME NEGATIVE
    if (inputs.newsSentiment === 'BULLISH' && inputs.volumeDirection === 'NEGATIVE') {
      addContradiction(
        'MINOR',
        'VOLUME_CONFIRMATION',
        `newsSentiment=${inputs.newsSentiment}, volumeDirection=${inputs.volumeDirection}`,
        'NEWS sentiment is Bullish but traded volume or delivery is negative.'
      );
    }

    // 4. SIGNAL BULLISH but F&O POSITIONING BEARISH
    if (inputs.signalSentiment === 'BULLISH' && inputs.fnoPositioning === 'BEARISH') {
      addContradiction(
        'MATERIAL',
        'FNO_ALIGNMENT',
        `signalSentiment=${inputs.signalSentiment}, fnoPositioning=${inputs.fnoPositioning}`,
        'SIGNAL is Bullish but Derivatives/F&O open interest positioning is Bearish.'
      );
    }

    // 5. STRATEGY POSITIVE but PORTFOLIO RISK GATE FAIL
    if (inputs.strategyStatus === 'APPROVED' && inputs.portfolioRiskGatePassed === false) {
      addContradiction(
        'CRITICAL',
        'PORTFOLIO_RISK_GATE',
        `strategyStatus=${inputs.strategyStatus}, portfolioRiskGatePassed=${inputs.portfolioRiskGatePassed}`,
        'STRATEGY is Approved but Portfolio Risk Gate check failed. Blocking transaction.'
      );
    }

    // 6. AI HYPOTHESIS POSITIVE but OOS VALIDATION FAIL
    if (inputs.aiHypothesisStatus === 'POSITIVE' && inputs.oosValidationPassed === false) {
      addContradiction(
        'CRITICAL',
        'OOS_VALIDATION_GATE',
        `aiHypothesisStatus=${inputs.aiHypothesisStatus}, oosValidationPassed=${inputs.oosValidationPassed}`,
        'AI strategy hypothesis is Positive but deterministic Out-Of-Sample (OOS) validation failed.'
      );
    }

    // 7. EXECUTION EXPECTED but ACTUAL FILL INVALID
    if (inputs.executionExpected === true && inputs.actualFillValid === false) {
      addContradiction(
        'CRITICAL',
        'EXECUTION_FILL_RECONCILIATION',
        `executionExpected=${inputs.executionExpected}, actualFillValid=${inputs.actualFillValid}`,
        'Execution was expected but actual broker fill is invalid or mismatched.'
      );
    }

    this.contradictions.set(eventId, list);
    return list;
  }

  public getContradictionsByEventId(eventId: string): AthenaContradiction[] {
    return this.contradictions.get(eventId) || [];
  }

  public getAllContradictions(): AthenaContradiction[] {
    return Array.from(this.contradictions.values()).flat();
  }

  public checkCriticalBlock(eventId: string): boolean {
    const list = this.getContradictionsByEventId(eventId);
    return list.some(c => c.severity === 'CRITICAL' || c.severity === 'MATERIAL');
  }
}
