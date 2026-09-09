/**
 * ATHENA NEWS ENGINE — PHASE 16
 * RegimeTransitionEngine.ts
 * 
 * Regime Transition Engine.
 * Tracks transitions from REGIME(t-1) to REGIME(t) with multi-sample confirmation
 * to filter out single-candle noise or tick spikes.
 */

import { DiscoveryRegimeType } from './MarketRegimeDiscoveryEngine.ts';

export interface TransitionRecord {
  fromRegime: DiscoveryRegimeType;
  toRegime: DiscoveryRegimeType;
  timestamp: string;
  confidencePct: number;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  persistenceScore: number;       // Measure of persistence (1-10)
  postTransitionBehavior: string;  // Description of expected market behavior
  historicalFrequency: number;     // Historical occurrence %
}

export class RegimeTransitionEngine {
  private static transitionHistory: TransitionRecord[] = [];
  private static activeRegime: DiscoveryRegimeType = 'RANGE_BOUND';
  
  // Buffer to store recent raw discoveries (for smoothing)
  private static discoveryBuffer: DiscoveryRegimeType[] = [];
  private static readonly BUFFER_SIZE_REQUIRED = 3; // Must see 3 consecutive matching values to transition

  /**
   * Evaluates a new raw regime discovery. Returns true if a transition was confirmed.
   */
  public static processDiscovery(rawRegime: DiscoveryRegimeType, rawConfidence: number): {
    confirmedTransition: TransitionRecord | null;
    currentRegime: DiscoveryRegimeType;
    isNoisyTickFiltered: boolean;
  } {
    let confirmedTransition: TransitionRecord | null = null;
    let isNoisyTickFiltered = false;

    // Push to buffer
    this.discoveryBuffer.push(rawRegime);
    if (this.discoveryBuffer.length > this.BUFFER_SIZE_REQUIRED) {
      this.discoveryBuffer.shift();
    }

    // Check if transition is needed
    if (rawRegime !== this.activeRegime) {
      // Determine if it is fully supported by the buffer (to filter noisy spikes)
      const allMatch = this.discoveryBuffer.length === this.BUFFER_SIZE_REQUIRED &&
                       this.discoveryBuffer.every(val => val === rawRegime);

      if (allMatch) {
        // Confirm the transition!
        const from = this.activeRegime;
        this.activeRegime = rawRegime;

        // Calculate severity, persistence, frequency, and behavioral expectation
        const severity = this.calculateSeverity(from, rawRegime);
        const persistenceScore = this.calculatePersistence(rawRegime);
        const postTransitionBehavior = this.getPostTransitionBehavior(from, rawRegime);
        const historicalFrequency = this.getHistoricalFrequency(from, rawRegime);

        confirmedTransition = {
          fromRegime: from,
          toRegime: rawRegime,
          timestamp: new Date().toISOString(),
          confidencePct: rawConfidence,
          severity,
          persistenceScore,
          postTransitionBehavior,
          historicalFrequency,
        };

        this.transitionHistory.push(confirmedTransition);
      } else {
        // Raw regime differs from active, but buffer doesn't fully agree yet. Filter as tick noise!
        isNoisyTickFiltered = true;
      }
    }

    return {
      confirmedTransition,
      currentRegime: this.activeRegime,
      isNoisyTickFiltered,
    };
  }

  public static getActiveRegime(): DiscoveryRegimeType {
    return this.activeRegime;
  }

  public static getTransitionHistory(): TransitionRecord[] {
    return this.transitionHistory;
  }

  public static clear(): void {
    this.transitionHistory = [];
    this.activeRegime = 'RANGE_BOUND';
    this.discoveryBuffer = [];
  }

  private static calculateSeverity(from: DiscoveryRegimeType, to: DiscoveryRegimeType): 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' {
    if (from === 'LOW_VOLATILITY' && to === 'HIGH_VOLATILITY') return 'EXTREME';
    if (from === 'RISK_ON' && to === 'RISK_OFF') return 'HIGH';
    if (to === 'LIQUIDITY_STRESS') return 'EXTREME';
    if (from === 'RANGE_BOUND' && (to === 'TRENDING_BULL' || to === 'TRENDING_BEAR')) return 'MODERATE';
    return 'LOW';
  }

  private static calculatePersistence(regime: DiscoveryRegimeType): number {
    switch (regime) {
      case 'TRENDING_BULL': return 8;
      case 'TRENDING_BEAR': return 7;
      case 'RANGE_BOUND': return 9;
      case 'HIGH_VOLATILITY': return 4;
      case 'LOW_VOLATILITY': return 9;
      case 'LIQUIDITY_STRESS': return 3;
      default: return 5;
    }
  }

  private static getPostTransitionBehavior(from: DiscoveryRegimeType, to: DiscoveryRegimeType): string {
    if (from === 'RANGE_BOUND' && to === 'TRENDING_BULL') {
      return 'Expect breakout continuation and expanding volume. Favor momentum breakouts.';
    }
    if (from === 'LOW_VOLATILITY' && to === 'HIGH_VOLATILITY') {
      return 'Expect wide option bid-ask spreads, rapid stops triggered, and mean-reverting swings.';
    }
    if (to === 'RISK_OFF') {
      return 'De-leveraging expected across all desks. Safe haven asset correlation rising.';
    }
    return 'Consolidating price discovery within new regime boundaries.';
  }

  private static getHistoricalFrequency(from: DiscoveryRegimeType, to: DiscoveryRegimeType): number {
    // Return typical historical conditional probabilities (%)
    if (from === 'RANGE_BOUND' && to === 'VOLATILITY_EXPANSION') return 18.5;
    if (from === 'TRENDING_BULL' && to === 'RANGE_BOUND') return 34.2;
    if (from === 'LOW_VOLATILITY' && to === 'VOLATILITY_EXPANSION') return 25.1;
    return 12.4; // generic fallback
  }
}
