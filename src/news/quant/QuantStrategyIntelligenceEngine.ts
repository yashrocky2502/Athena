/**
 * ATHENA NEWS ENGINE — PHASE 12
 * QuantStrategyIntelligenceEngine.ts
 * 
 * Main Central Orchestrator for Phase 12: Quantitative Strategy Intelligence & Signal-to-Strategy Engine.
 * Schema: v12_strategy_candidate
 * 
 * ZERO-AI COST CONTRACT:
 * 100% deterministic mathematical execution. AI is strictly optional/advisory.
 */

import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { CanonicalStrategyCandidate, QuantIntelligenceObservability } from './types.ts';
import { strategyCandidateEngine } from './StrategyCandidateEngine.ts';
import { strategyCompatibilityEngine } from './StrategyCompatibilityEngine.ts';
import { historicalAnalogueEngine } from './HistoricalAnalogueEngine.ts';
import { strategyBacktestEngine } from './StrategyBacktestEngine.ts';
import { strategyExpectedValueEngine } from './StrategyExpectedValueEngine.ts';
import { strategyRobustnessEngine } from './StrategyRobustnessEngine.ts';
import { strategyRiskGate } from './StrategyRiskGate.ts';
import { StrategyTemplateSystem } from './StrategyTemplateSystem.ts';

export class QuantStrategyIntelligenceEngine {
  private static instance: QuantStrategyIntelligenceEngine;

  private strategyCache: Map<string, CanonicalStrategyCandidate[]> = new Map();

  private observability: QuantIntelligenceObservability = {
    signalsConsumed: 0,
    strategyCandidatesGenerated: 0,
    strategiesRejected: 0,
    backtestsExecuted: 0,
    validationFailures: 0,
    insufficientSamples: 0,
    overfittingWarnings: 0,
    contradictorySignalsProcessed: 0,
    riskGateRejections: 0,
    cacheHits: 0,
    cacheMisses: 0,
    computationLatencyMs: [],
    aiResearchInvocations: 0,
    deterministicCalculations: 0
  };

  private constructor() {}

  public static getInstance(): QuantStrategyIntelligenceEngine {
    if (!this.instance) {
      this.instance = new QuantStrategyIntelligenceEngine();
    }
    return this.instance;
  }

  /**
   * Translates Phase 11 TransmissionSignalResult into a suite of Canonical Strategy Candidates (v12_strategy_candidate).
   */
  public evaluateSignalToStrategies(
    signal: TransmissionSignalResult,
    forceRefresh: boolean = false
  ): CanonicalStrategyCandidate[] {
    const startTime = Date.now();
    this.observability.signalsConsumed++;

    // Deterministic Cache Key based on Signal ID & Transmission Score
    const cacheKey = `v12-quant-${signal.signalId}-${signal.transmissionScore}-${signal.lifecycleState}-${signal.alignment}`;
    if (!forceRefresh && this.strategyCache.has(cacheKey)) {
      this.observability.cacheHits++;
      return this.strategyCache.get(cacheKey)!;
    }
    this.observability.cacheMisses++;

    const isContradicted = signal.alignment === 'CONTRADICTED' || 
                           signal.lifecycleState === 'CONTRADICTED' || 
                           signal.lifecycleState === 'INVALIDATED';
    if (isContradicted) {
      this.observability.contradictorySignalsProcessed++;
    }

    // 1. Generate Strategy Candidates Configs
    const candidateConfigs = strategyCandidateEngine.generateCandidatesForSignal(signal);
    this.observability.strategyCandidatesGenerated += candidateConfigs.length;

    // 2. Process Historical Analogues (Event-Conditioned)
    const precedents = historicalAnalogueEngine.findHistoricalAnalogues(signal);
    if (precedents.sampleQuality === 'INSUFFICIENT_SAMPLE') {
      this.observability.insufficientSamples++;
    }

    const spotPrice = signal.marketReaction?.currentPrice || 1000;
    const candidates: CanonicalStrategyCandidate[] = [];

    for (const config of candidateConfigs) {
      this.observability.deterministicCalculations++;

      // A. Evaluate Compatibility
      const compResult = strategyCompatibilityEngine.evaluateCompatibility(
        signal,
        config.strategyType,
        config.direction
      );

      // B. Run Event-Conditioned Backtest
      const backtestMetrics = strategyBacktestEngine.runEventConditionedBacktest({
        strategyType: config.strategyType,
        entryPrice: config.entryPrice,
        stopLossPrice: config.stopLossPrice,
        targetPrice: config.targetPrice,
        holdingPeriodMinutes: config.holdingPeriodMinutes,
        positionSizeContractsOrQty: config.positionSizeContractsOrQty,
        historicalPrecedents: precedents,
        signal
      });
      this.observability.backtestsExecuted++;

      // C. Calculate Expected Value
      const expectedValueMetrics = strategyExpectedValueEngine.calculateExpectedValue(
        backtestMetrics,
        config.estimatedCapitalRequiredINR
      );

      // D. Validate Robustness & Anti-Overfitting
      const robustnessReport = strategyRobustnessEngine.validateStrategyRobustness(
        backtestMetrics,
        precedents,
        compResult.compatibilityScore
      );
      if (robustnessReport.validationStatus === 'UNVALIDATED' || robustnessReport.validationStatus === 'OVERFIT_RISK') {
        this.observability.validationFailures++;
      }
      if (robustnessReport.overfittingRiskLevel === 'HIGH') {
        this.observability.overfittingWarnings++;
      }

      // E. Risk Gate & Actionability Evaluator
      const riskGateResult = strategyRiskGate.evaluateRiskGate(
        signal,
        backtestMetrics,
        expectedValueMetrics,
        robustnessReport.validationStatus,
        config.estimatedCapitalRequiredINR
      );

      if (riskGateResult.actionability === 'NO_TRADE') {
        this.observability.riskGateRejections++;
        this.observability.strategiesRejected++;
      }

      // F. Construct Option Legs & Greeks if Options Category
      let optionLegs = undefined;
      let optionsGreeks = undefined;
      if (config.category === 'OPTIONS' && config.strategyType !== 'NO_TRADE_STRATEGY') {
        optionLegs = StrategyTemplateSystem.constructOptionLegs(config.strategyType, spotPrice);
        optionsGreeks = StrategyTemplateSystem.calculateOptionGreeks(spotPrice, optionLegs);
      }

      // G. Assemble Versioned Canonical Strategy Object: v12_strategy_candidate
      const canonicalCandidate: CanonicalStrategyCandidate = {
        schemaVersion: 'v12_strategy_candidate',
        strategyId: `strat-${signal.symbol}-${config.strategyType}-${Date.now().toString().slice(-4)}`,
        signalId: signal.signalId,
        articleId: signal.articleId,
        symbol: signal.symbol,
        companyName: signal.entityResolution?.primaryEntity?.symbol || signal.symbol,
        sector: signal.entityResolution?.sector || 'GENERAL',
        marketRegime: signal.marketRegime || 'BALANCED',
        signalDirection: signal.marketReaction?.totalChangePct > 0 ? 'BULLISH' : signal.marketReaction?.totalChangePct < 0 ? 'BEARISH' : 'NEUTRAL',
        signalConfidence: Math.min(99, Math.round(signal.transmissionScore * 1.05)),
        transmissionScore: signal.transmissionScore || 70,
        lifecycleState: signal.lifecycleState || 'CONFIRMED',

        strategyType: config.strategyType,
        category: config.category,
        strategyName: config.strategyName,
        description: config.description,
        underlyingSymbol: signal.symbol,
        direction: config.direction,

        entryPrice: config.entryPrice,
        stopLossPrice: config.stopLossPrice,
        targetPrice: config.targetPrice,
        holdingPeriodMinutes: config.holdingPeriodMinutes,
        positionSizeContractsOrQty: config.positionSizeContractsOrQty,
        estimatedCapitalRequiredINR: config.estimatedCapitalRequiredINR,

        optionLegs,
        optionsGreeks,

        compatibilityScore: compResult.compatibilityScore,
        compatibilityRating: compResult.compatibilityRating,
        backtestMetrics,
        expectedValue: expectedValueMetrics,
        robustnessReport,
        riskProfile: riskGateResult.riskProfile,
        historicalPrecedents: precedents,

        validationStatus: robustnessReport.validationStatus,
        contradictionStatus: isContradicted,
        actionability: riskGateResult.actionability,
        actionabilityRationale: riskGateResult.rationale,

        evidenceReferences: [
          { stage: 'SIGNAL_SOURCE', summary: `Phase 11 Signal ID ${signal.signalId} (Score: ${signal.transmissionScore}/100)` },
          { stage: 'HISTORICAL_ANALOGUES', summary: `${precedents.sampleSize} comparable historical events analyzed (${precedents.sampleQuality})` },
          { stage: 'QUANT_BACKTEST', summary: `Net EV +₹${expectedValueMetrics.expectedValueINR} | Win Rate ${backtestMetrics.winRatePct}%` },
          { stage: 'RISK_GATE', summary: riskGateResult.rationale }
        ],

        generatedAt: new Date().toISOString(),
        engineVersion: 'ATHENA_QUANT_STRATEGY_V12.0'
      };

      candidates.push(canonicalCandidate);
    }

    // Sort candidates by Actionability Priority & Compatibility Score
    candidates.sort((a, b) => {
      const rank = { TRADEABLE: 4, WATCH: 3, CONDITIONAL: 2, NO_TRADE: 1 };
      const diff = rank[b.actionability] - rank[a.actionability];
      if (diff !== 0) return diff;
      return b.compatibilityScore - a.compatibilityScore;
    });

    this.strategyCache.set(cacheKey, candidates);
    const latency = Date.now() - startTime;
    this.observability.computationLatencyMs.push(latency);

    return candidates;
  }

  /**
   * Generates Telegram Grounded Quant Strategy Snapshot
   */
  public generateTelegramQuantSnapshot(candidate: CanonicalStrategyCandidate): string {
    const actEmoji = candidate.actionability === 'TRADEABLE' ? '🟢' :
                     candidate.actionability === 'WATCH' ? '🟡' :
                     candidate.actionability === 'CONDITIONAL' ? '🟠' : '🔴';

    const valEmoji = candidate.validationStatus === 'VALIDATED' ? '✅' : '⚠️';

    return [
      `🧠 *QUANT STRATEGY SNAPSHOT*`,
      `*Symbol:* ${candidate.symbol} | *Regime:* ${candidate.marketRegime}`,
      `*Signal:* ${candidate.signalDirection} (Conf: ${candidate.signalConfidence}%, Transmission: ${candidate.transmissionScore}/100)`,
      ``,
      `*Recommended Strategy:* ${candidate.strategyName} (${candidate.category})`,
      `*Direction:* ${candidate.direction} | *Compatibility:* ${candidate.compatibilityScore}/100 (${candidate.compatibilityRating})`,
      ``,
      `*Historical Sample:* ${candidate.historicalPrecedents.sampleSize} comparable events (${candidate.historicalPrecedents.sampleQuality})`,
      `*Win Rate:* ${candidate.backtestMetrics.winRatePct}% | *Profit Factor:* ${candidate.backtestMetrics.profitFactor}`,
      `*Expected Value:* +₹${candidate.expectedValue.expectedValueINR.toLocaleString('en-IN')} per trade`,
      `*Reward / Risk Ratio:* ${candidate.expectedValue.rewardToRiskRatio}:1`,
      `*Max Drawdown:* ${candidate.backtestMetrics.maxDrawdownPct}%`,
      ``,
      `*Validation:* ${valEmoji} ${candidate.validationStatus}`,
      `*Actionability:* ${actEmoji} *${candidate.actionability}*`,
      `_${candidate.actionabilityRationale}_`,
      ``,
      `⚠️ *DISCLAIMER:* Quantitative strategy research output. Not direct trade execution advice.`
    ].join('\n');
  }

  public getObservability(): QuantIntelligenceObservability {
    return { ...this.observability };
  }

  public clearCache(): void {
    this.strategyCache.clear();
  }
}

export const quantStrategyIntelligenceEngine = QuantStrategyIntelligenceEngine.getInstance();
