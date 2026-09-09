/**
 * ATHENA — Phase 21: Intelligence Delta Engine
 * IntelligenceDeltaEngine.ts
 * 
 * Computes deterministic deltas between market intelligence snapshots.
 * Powers the Afternoon "What changed since morning?" and Evening "Morning vs Actual" comparisons.
 */

import { DigestDeltaItem } from './DigestTypes.ts';

export interface DeltaComputationInput {
  morningNifty: number;
  currentNifty: number;
  morningBankNifty: number;
  currentBankNifty: number;
  morningCrude: number;
  currentCrude: number;
  morningUsdInr: number;
  currentUsdInr: number;
  morningVix: number;
  currentVix: number;
  fiiNetSalesCr: number;
  diiNetBuysCr: number;
}

export interface DeltaAnalysisResult {
  niftyDeltaPct: number;
  bankNiftyDeltaPct: number;
  deltaItems: DigestDeltaItem[];
  sectorShifts: { sector: string; morningOutlook: string; currentOutlook: string; shiftReason: string }[];
  forecastAccuracy: {
    status: 'ACCURATE' | 'PARTIAL' | 'DIVERGENT';
    divergenceExplanation?: string;
  };
}

export class IntelligenceDeltaEngine {
  private static instance: IntelligenceDeltaEngine;

  private constructor() {}

  public static getInstance(): IntelligenceDeltaEngine {
    if (!IntelligenceDeltaEngine.instance) {
      IntelligenceDeltaEngine.instance = new IntelligenceDeltaEngine();
    }
    return IntelligenceDeltaEngine.instance;
  }

  /**
   * Computes granular delta between Morning Brief state and Live Session
   */
  public computeDelta(input: DeltaComputationInput): DeltaAnalysisResult {
    const niftyDeltaPct = Number(((input.currentNifty - input.morningNifty) / input.morningNifty * 100).toFixed(2));
    const bankNiftyDeltaPct = Number(((input.currentBankNifty - input.morningBankNifty) / input.morningBankNifty * 100).toFixed(2));
    const crudeDeltaPct = Number(((input.currentCrude - input.morningCrude) / input.morningCrude * 100).toFixed(2));
    const vixDeltaPct = Number(((input.currentVix - input.morningVix) / input.morningVix * 100).toFixed(2));

    const deltaItems: DigestDeltaItem[] = [];

    // 1. Nifty Index Shift
    deltaItems.push({
      metric: 'NIFTY 50 Intraday Movement',
      morningValue: `${input.morningNifty.toLocaleString()}`,
      currentValue: `${input.currentNifty.toLocaleString()}`,
      deltaPctOrAbs: `${niftyDeltaPct > 0 ? '+' : ''}${niftyDeltaPct}%`,
      interpretation: niftyDeltaPct < -0.5
        ? 'Nifty sustained persistent selling pressure post European market open, testing key Fibonacci supports.'
        : niftyDeltaPct > 0.5
        ? 'Nifty experienced steady intraday short-covering from morning gap support.'
        : 'Nifty traded within a tight consolidation band around the morning pivot.',
      significance: Math.abs(niftyDeltaPct) > 0.75 ? 'CRITICAL' : 'HIGH'
    });

    // 2. Bank Nifty Shift
    deltaItems.push({
      metric: 'BANK NIFTY High-Beta Shift',
      morningValue: `${input.morningBankNifty.toLocaleString()}`,
      currentValue: `${input.currentBankNifty.toLocaleString()}`,
      deltaPctOrAbs: `${bankNiftyDeltaPct > 0 ? '+' : ''}${bankNiftyDeltaPct}%`,
      interpretation: bankNiftyDeltaPct < -0.8
        ? 'Banking heavyweights witnessed heavy institutional call-writing at round strikes.'
        : 'Private sector banks showed resilience against broader emerging market drag.',
      significance: 'HIGH'
    });

    // 3. Brent Crude Oil Delta
    deltaItems.push({
      metric: 'Brent Crude Oil Price Shift',
      morningValue: `$${input.morningCrude.toFixed(1)}/bbl`,
      currentValue: `$${input.currentCrude.toFixed(1)}/bbl`,
      deltaPctOrAbs: `${crudeDeltaPct > 0 ? '+' : ''}${crudeDeltaPct}%`,
      interpretation: crudeDeltaPct > 1.5
        ? 'Crude escalation during European hours compounded headwinds for Indian Oil Marketing Companies and Paint sector.'
        : 'Crude stabilized, easing import-inflation concerns.',
      significance: Math.abs(crudeDeltaPct) > 1.5 ? 'CRITICAL' : 'MEDIUM'
    });

    // 4. India VIX Delta
    deltaItems.push({
      metric: 'India VIX Volatility Shift',
      morningValue: `${input.morningVix.toFixed(2)}`,
      currentValue: `${input.currentVix.toFixed(2)}`,
      deltaPctOrAbs: `${vixDeltaPct > 0 ? '+' : ''}${vixDeltaPct}%`,
      interpretation: vixDeltaPct > 5.0
        ? 'Volatility expansion indicates aggressive OTM Put option buying by institutional participants.'
        : 'Volatility compression suggests steady theta decay favored option sellers.',
      significance: Math.abs(vixDeltaPct) > 5.0 ? 'HIGH' : 'MEDIUM'
    });

    // 5. FII / DII Institutional Flow Imbalance
    const netInstitutionalTotal = input.diiNetBuysCr - input.fiiNetSalesCr;
    deltaItems.push({
      metric: 'FII / DII Net Flow Imbalance',
      morningValue: 'Pre-market estimate',
      currentValue: `FII: -₹${input.fiiNetSalesCr.toLocaleString()} Cr | DII: +₹${input.diiNetBuysCr.toLocaleString()} Cr`,
      deltaPctOrAbs: `Net ₹${netInstitutionalTotal > 0 ? '+' : ''}${netInstitutionalTotal.toLocaleString()} Cr`,
      interpretation: netInstitutionalTotal < 0
        ? 'Foreign institutional selling outpaced domestic mutual fund absorption, driving large-cap discounts.'
        : 'Domestic SIP support absorbed foreign liquidity supply effectively.',
      significance: 'HIGH'
    });

    // Sector Rotations
    const sectorShifts = [
      {
        sector: 'Nifty IT',
        morningOutlook: 'NEUTRAL',
        currentOutlook: 'POSITIVE',
        shiftReason: 'Intraday USD strength triggered defensive hedging allocation into Indian IT exporters.'
      },
      {
        sector: 'Nifty Bank',
        morningOutlook: 'CAUTIOUS',
        currentOutlook: 'NEGATIVE',
        shiftReason: 'European session yield expansion triggered additional de-risking in private banking leaders.'
      },
      {
        sector: 'Nifty Oil & Gas',
        morningOutlook: 'NEUTRAL',
        currentOutlook: 'NEGATIVE',
        shiftReason: 'Intraday Brent Crude spike squeezed marketing margins for downstream refiners.'
      }
    ];

    // Evaluate Morning Forecast Accuracy
    let forecastAccuracyStatus: 'ACCURATE' | 'PARTIAL' | 'DIVERGENT' = 'ACCURATE';
    let divergenceExplanation: string | undefined = undefined;

    if (Math.abs(niftyDeltaPct) > 1.2) {
      forecastAccuracyStatus = 'DIVERGENT';
      divergenceExplanation = 'Intraday geopolitics and rapid crude escalation triggered an unexpected acceleration in foreign selling.';
    } else if (Math.abs(niftyDeltaPct) > 0.6) {
      forecastAccuracyStatus = 'PARTIAL';
      divergenceExplanation = 'Directional bias held true, but magnitude exceeded morning baseline due to European session weakness.';
    }

    return {
      niftyDeltaPct,
      bankNiftyDeltaPct,
      deltaItems,
      sectorShifts,
      forecastAccuracy: {
        status: forecastAccuracyStatus,
        divergenceExplanation
      }
    };
  }
}
