/**
 * ATHENA NEWS ENGINE — PHASE 12
 * StrategyCandidateEngine.ts
 * 
 * Deterministic translation engine from Phase 11 Signal → Candidate Strategies.
 * Filters templates based on Phase 11 signal characteristics and initializes baseline controls.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic rules.
 */

import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { StrategyType, StrategyCategory } from './types.ts';
import { STRATEGY_TEMPLATES, BaseStrategyTemplate } from './StrategyTemplateSystem.ts';

export interface GeneratedCandidateConfig {
  strategyType: StrategyType;
  category: StrategyCategory;
  strategyName: string;
  description: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  holdingPeriodMinutes: number;
  positionSizeContractsOrQty: number;
  estimatedCapitalRequiredINR: number;
}

export class StrategyCandidateEngine {
  private static instance: StrategyCandidateEngine;

  private constructor() {}

  public static getInstance(): StrategyCandidateEngine {
    if (!this.instance) {
      this.instance = new StrategyCandidateEngine();
    }
    return this.instance;
  }

  /**
   * Translates Phase 11 Signal into a set of Candidate Strategy Configurations.
   */
  public generateCandidatesForSignal(signal: TransmissionSignalResult): GeneratedCandidateConfig[] {
    const spot = signal.marketReaction?.currentPrice || 1000;
    const isHeadlineBullish = /win|order|profit|growth|expansion|surge|record|rise|gain|contract/i.test(signal.headline || '') ||
                              /win|order|profit|growth|expansion|surge|record|rise|gain|contract/i.test(signal.canonicalSummary || '');
    const isHeadlineBearish = /loss|fall|decline|drop|plunge|slash|fine|probe|investigation|fraud|lawsuit/i.test(signal.headline || '') ||
                              /loss|fall|decline|drop|plunge|slash|fine|probe|investigation|fraud|lawsuit/i.test(signal.canonicalSummary || '');

    const direction = (signal.marketReaction?.totalChangePct && signal.marketReaction.totalChangePct > 0) ? 'BULLISH' : 
                      (signal.marketReaction?.totalChangePct && signal.marketReaction.totalChangePct < 0) ? 'BEARISH' : 
                      isHeadlineBullish ? 'BULLISH' : 
                      isHeadlineBearish ? 'BEARISH' : 'NEUTRAL';
    const score = signal.transmissionScore || 50;
    const isContradicted = signal.alignment === 'CONTRADICTED' || signal.lifecycleState === 'CONTRADICTED' || signal.lifecycleState === 'INVALIDATED';

    // If signal is contradicted or invalidated, immediately return Capital Preservation / NO_TRADE candidate
    if (isContradicted || signal.actionability === 'NO_TRADE') {
      return [{
        strategyType: 'NO_TRADE_STRATEGY',
        category: 'EQUITY',
        strategyName: 'No Trade / Capital Preservation',
        description: 'No active directional strategies generated due to contradictory market reaction or explicit NO_TRADE signal state.',
        direction: 'NEUTRAL',
        entryPrice: spot,
        stopLossPrice: spot,
        targetPrice: spot,
        holdingPeriodMinutes: 0,
        positionSizeContractsOrQty: 0,
        estimatedCapitalRequiredINR: 0
      }];
    }

    const candidateTypes: StrategyType[] = [];

    if (direction === 'BULLISH' || signal.marketReaction?.totalChangePct > 0) {
      // Equity Candidates
      candidateTypes.push('EQUITY_MOMENTUM_CONTINUATION');
      if (signal.marketReaction?.rvol >= 1.5) candidateTypes.push('EQUITY_BREAKOUT');
      candidateTypes.push('EQUITY_PULLBACK_CONTINUATION');
      if (score >= 75) candidateTypes.push('EQUITY_EVENT_DRIVEN_CONTINUATION');

      // Futures Candidates
      if (score >= 70) candidateTypes.push('FUTURES_DIRECTIONAL_LONG');

      // Options Candidates
      if (score >= 70) candidateTypes.push('OPTION_LONG_CALL');
      if (score >= 50) candidateTypes.push('OPTION_BULL_CALL_SPREAD');
      if (score >= 45) candidateTypes.push('OPTION_BULL_PUT_SPREAD');
    } else if (direction === 'BEARISH' || signal.marketReaction?.totalChangePct < 0) {
      // Equity Candidates
      candidateTypes.push('EQUITY_MOMENTUM_CONTINUATION');
      if (signal.marketReaction?.rvol >= 1.5) candidateTypes.push('EQUITY_BREAKOUT');
      if (score >= 75) candidateTypes.push('EQUITY_EVENT_DRIVEN_CONTINUATION');

      // Futures Candidates
      if (score >= 70) candidateTypes.push('FUTURES_DIRECTIONAL_SHORT');

      // Options Candidates
      if (score >= 70) candidateTypes.push('OPTION_LONG_PUT');
      if (score >= 50) candidateTypes.push('OPTION_BEAR_PUT_SPREAD');
      if (score >= 45) candidateTypes.push('OPTION_BEAR_CALL_SPREAD');
    } else {
      // Neutral / Rangebound Candidates
      candidateTypes.push('EQUITY_MEAN_REVERSION');
      candidateTypes.push('OPTION_IRON_CONDOR');
    }

    // Always include a fallback NO_TRADE / Capital Preservation option in the candidate set
    candidateTypes.push('NO_TRADE_STRATEGY');

    // Build concrete parameters for each candidate type
    return candidateTypes.map((st) => this.buildCandidateConfig(st, spot, direction, signal));
  }

  private buildCandidateConfig(
    st: StrategyType,
    spot: number,
    signalDirection: string,
    signal: TransmissionSignalResult
  ): GeneratedCandidateConfig {
    const tmpl = STRATEGY_TEMPLATES[st];
    const isBull = signalDirection === 'BULLISH' || signal.marketReaction?.totalChangePct > 0;
    
    let entryPrice = spot;
    let stopLossPrice = spot;
    let targetPrice = spot;
    let dir: 'LONG' | 'SHORT' | 'NEUTRAL' = isBull ? 'LONG' : 'SHORT';
    let qty = 100; // default shares
    let capital = Math.round(spot * 100);

    if (st === 'NO_TRADE_STRATEGY') {
      return {
        strategyType: st,
        category: tmpl.category,
        strategyName: tmpl.name,
        description: tmpl.description,
        direction: 'NEUTRAL',
        entryPrice: spot,
        stopLossPrice: spot,
        targetPrice: spot,
        holdingPeriodMinutes: 0,
        positionSizeContractsOrQty: 0,
        estimatedCapitalRequiredINR: 0
      };
    }

    // Calculate Entry, Stop, Target based on strategy archetype
    if (st.startsWith('EQUITY_')) {
      if (st === 'EQUITY_MOMENTUM_CONTINUATION') {
        entryPrice = spot;
        stopLossPrice = isBull ? Math.round(spot * 0.985 * 100) / 100 : Math.round(spot * 1.015 * 100) / 100;
        targetPrice = isBull ? Math.round(spot * 1.04 * 100) / 100 : Math.round(spot * 0.96 * 100) / 100;
      } else if (st === 'EQUITY_BREAKOUT') {
        entryPrice = isBull ? Math.round(spot * 1.005 * 100) / 100 : Math.round(spot * 0.995 * 100) / 100;
        stopLossPrice = isBull ? Math.round(spot * 0.99 * 100) / 100 : Math.round(spot * 1.01 * 100) / 100;
        targetPrice = isBull ? Math.round(spot * 1.05 * 100) / 100 : Math.round(spot * 0.95 * 100) / 100;
      } else if (st === 'EQUITY_PULLBACK_CONTINUATION') {
        entryPrice = isBull ? Math.round(spot * 0.993 * 100) / 100 : Math.round(spot * 1.007 * 100) / 100;
        stopLossPrice = isBull ? Math.round(spot * 0.982 * 100) / 100 : Math.round(spot * 1.018 * 100) / 100;
        targetPrice = isBull ? Math.round(spot * 1.035 * 100) / 100 : Math.round(spot * 0.965 * 100) / 100;
      } else {
        entryPrice = spot;
        stopLossPrice = isBull ? Math.round(spot * 0.98 * 100) / 100 : Math.round(spot * 1.02 * 100) / 100;
        targetPrice = isBull ? Math.round(spot * 1.03 * 100) / 100 : Math.round(spot * 0.97 * 100) / 100;
      }
      qty = Math.max(10, Math.floor(100000 / entryPrice));
      capital = Math.round(entryPrice * qty);
    } else if (st.startsWith('FUTURES_')) {
      dir = st.includes('SHORT') ? 'SHORT' : 'LONG';
      entryPrice = spot;
      stopLossPrice = dir === 'LONG' ? Math.round(spot * 0.99 * 100) / 100 : Math.round(spot * 1.01 * 100) / 100;
      targetPrice = dir === 'LONG' ? Math.round(spot * 1.03 * 100) / 100 : Math.round(spot * 0.97 * 100) / 100;
      qty = 1; // 1 futures contract lot
      capital = Math.round(spot * 50 * 0.12); // ~12% futures margin requirement
    } else if (st.startsWith('OPTION_')) {
      if (st.includes('CALL') || st.includes('BULL')) dir = 'LONG';
      else if (st.includes('PUT') || st.includes('BEAR')) dir = 'SHORT';
      else dir = 'NEUTRAL';

      entryPrice = spot;
      stopLossPrice = dir === 'LONG' ? Math.round(spot * 0.985 * 100) / 100 : Math.round(spot * 1.015 * 100) / 100;
      targetPrice = dir === 'LONG' ? Math.round(spot * 1.035 * 100) / 100 : Math.round(spot * 0.965 * 100) / 100;
      qty = 1; // 1 lot
      capital = st.includes('SPREAD') ? Math.round(spot * 50 * 0.02) : Math.round(spot * 50 * 0.015);
    }

    return {
      strategyType: st,
      category: tmpl.category,
      strategyName: tmpl.name,
      description: tmpl.description,
      direction: dir,
      entryPrice,
      stopLossPrice,
      targetPrice,
      holdingPeriodMinutes: tmpl.typicalHoldingPeriodMinutes,
      positionSizeContractsOrQty: qty,
      estimatedCapitalRequiredINR: capital
    };
  }
}

export const strategyCandidateEngine = StrategyCandidateEngine.getInstance();
