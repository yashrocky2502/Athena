/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Market Regime Compatibility Engine
 */

import {
  OpportunityType,
  RegimeCompatibilityResult
} from './types';

export class OpportunityRegimeCompatibilityEngine {
  private static instance: OpportunityRegimeCompatibilityEngine;

  public static getInstance(): OpportunityRegimeCompatibilityEngine {
    if (!OpportunityRegimeCompatibilityEngine.instance) {
      OpportunityRegimeCompatibilityEngine.instance = new OpportunityRegimeCompatibilityEngine();
    }
    return OpportunityRegimeCompatibilityEngine.instance;
  }

  /**
   * Computes compatibility between opportunity strategy type and the prevailing market regime
   */
  public evaluateRegimeCompatibility(opportunityType: OpportunityType, currentRegime: string): RegimeCompatibilityResult {
    const regime = (currentRegime || 'TRENDING_BULLISH').toUpperCase();

    let compatibilityScore = 60;
    let historicalRegimeSharpe = 1.2;
    let historicalRegimeWinRate = 0.58;
    let expectedVolMultiplier = 1.0;
    let regimeNotes = '';

    switch (opportunityType) {
      case 'BREAKOUT':
      case 'MOMENTUM':
      case 'SECTOR_ROTATION':
        if (regime.includes('TRENDING') || regime.includes('EXPANSION')) {
          compatibilityScore = 92;
          historicalRegimeSharpe = 2.1;
          historicalRegimeWinRate = 0.72;
          expectedVolMultiplier = 1.25;
          regimeNotes = `High compatibility: ${opportunityType} aligns strongly with directional expansion regime (${regime})`;
        } else if (regime.includes('RANGE') || regime.includes('COMPRESSION')) {
          compatibilityScore = 42;
          historicalRegimeSharpe = 0.6;
          historicalRegimeWinRate = 0.44;
          expectedVolMultiplier = 0.8;
          regimeNotes = `Low compatibility: ${opportunityType} exhibits high false-breakout risk in rangebound markets (${regime})`;
        } else {
          compatibilityScore = 65;
          regimeNotes = `Moderate compatibility in current regime (${regime})`;
        }
        break;

      case 'BREAKDOWN':
        if (regime.includes('BEARISH') || regime.includes('HIGH_VOLATILITY') || regime.includes('STRESS')) {
          compatibilityScore = 90;
          historicalRegimeSharpe = 1.95;
          historicalRegimeWinRate = 0.69;
          expectedVolMultiplier = 1.35;
          regimeNotes = `High compatibility: Short breakdowns thrive in stressed or bearish trend regimes (${regime})`;
        } else if (regime.includes('BULLISH')) {
          compatibilityScore = 38;
          historicalRegimeSharpe = 0.5;
          historicalRegimeWinRate = 0.40;
          expectedVolMultiplier = 0.9;
          regimeNotes = `Unfavorable: Short breakdowns prone to aggressive squeeze rallies in bullish regime`;
        } else {
          compatibilityScore = 60;
          regimeNotes = `Moderate compatibility (${regime})`;
        }
        break;

      case 'MEAN_REVERSION':
        if (regime.includes('RANGE') || regime.includes('LOW_VOLATILITY') || regime.includes('COMPRESSION')) {
          compatibilityScore = 94;
          historicalRegimeSharpe = 2.4;
          historicalRegimeWinRate = 0.76;
          expectedVolMultiplier = 0.75;
          regimeNotes = `High compatibility: Mean reversion strategies excel in rangebound oscillation regimes (${regime})`;
        } else if (regime.includes('TRENDING') || regime.includes('HIGH_VOLATILITY')) {
          compatibilityScore = 35;
          historicalRegimeSharpe = 0.4;
          historicalRegimeWinRate = 0.38;
          expectedVolMultiplier = 1.4;
          regimeNotes = `Hazardous: Fighting strong trending momentum incurs severe tail risk`;
        } else {
          compatibilityScore = 58;
          regimeNotes = `Moderate baseline compatibility (${regime})`;
        }
        break;

      case 'EARNINGS':
      case 'EVENT_DRIVEN':
      case 'DERIVATIVE_FLOW':
        compatibilityScore = 85;
        historicalRegimeSharpe = 1.7;
        historicalRegimeWinRate = 0.65;
        expectedVolMultiplier = 1.2;
        regimeNotes = `Catalyst-driven opportunity maintains high independent regime resilience`;
        break;

      case 'VOLATILITY':
        if (regime.includes('HIGH_VOLATILITY') || regime.includes('STRESS') || regime.includes('EXPANSION')) {
          compatibilityScore = 90;
          historicalRegimeSharpe = 1.85;
          historicalRegimeWinRate = 0.68;
          expectedVolMultiplier = 1.5;
          regimeNotes = `Vol expansion strategies optimized for current regime`;
        } else {
          compatibilityScore = 55;
          regimeNotes = `Subdued volatility environment reduces volatility expansion payoff`;
        }
        break;

      default:
        compatibilityScore = 70;
        regimeNotes = `Standard regime alignment`;
    }

    return {
      currentRegime: regime,
      opportunityType,
      compatibilityScore,
      isCompatible: compatibilityScore >= 60,
      historicalRegimeSharpe,
      historicalRegimeWinRate,
      expectedVolMultiplier,
      regimeNotes
    };
  }
}
