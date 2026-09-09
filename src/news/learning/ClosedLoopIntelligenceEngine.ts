/**
 * ATHENA NEWS ENGINE — PHASE 15
 * ClosedLoopIntelligenceEngine.ts
 * 
 * Central Orchestrator for Phase 15 Closed-Loop Intelligence.
 * Seamlessly connects:
 * Realized Trade Outcome -> Performance Attribution -> Expected vs Realized ->
 * Forensics -> Adaptive Ranking -> Edge Decay -> Safety Gate -> Version Manager -> Telegram Snapshot.
 */

import {
  ClosedLoopIntelligenceResult,
  TradeOutcome,
  CompleteLineage
} from './types.ts';
import { tradePerformanceAttributionEngine } from './TradePerformanceAttributionEngine.ts';
import { expectedVsRealizedEngine } from './ExpectedVsRealizedEngine.ts';
import { signalPerformanceEngine } from './SignalPerformanceEngine.ts';
import { strategyPerformanceEngine } from './StrategyPerformanceEngine.ts';
import { regimePerformanceEngine } from './RegimePerformanceEngine.ts';
import { transmissionScorecardEngine } from './TransmissionScorecardEngine.ts';
import { falseSignalForensicsEngine } from './FalseSignalForensicsEngine.ts';
import { executionPerformanceFeedbackEngine } from './ExecutionPerformanceFeedbackEngine.ts';
import { portfolioDecisionAttributionEngine } from './PortfolioDecisionAttributionEngine.ts';
import { noTradePerformanceEngine } from './NoTradePerformanceEngine.ts';
import { adaptiveRankingEngine } from './AdaptiveRankingEngine.ts';
import { edgeDecayEngine } from './EdgeDecayEngine.ts';
import { LearningSafetyGate } from './LearningSafetyGate.ts';
import { learningVersionManager } from './LearningVersionManager.ts';
import { LearningTelegramSnapshot } from './LearningTelegramSnapshot.ts';

import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { CanonicalStrategyCandidate, StrategyType } from '../quant/types.ts';
import { PortfolioDecision } from '../portfolio/types.ts';
import { ExecutionIntent } from '../execution/types.ts';

export class ClosedLoopIntelligenceEngine {
  /**
   * Processes a completed trade end-to-end through Phase 15 closed-loop engine.
   */
  public processCompletedTrade(
    tradeOutcome: TradeOutcome,
    signal?: TransmissionSignalResult,
    candidate?: CanonicalStrategyCandidate,
    decision?: PortfolioDecision,
    intent?: ExecutionIntent
  ): ClosedLoopIntelligenceResult {
    // 1. Performance Attribution
    const attribution = tradePerformanceAttributionEngine.attributeTrade(
      tradeOutcome, signal, candidate, decision, intent
    );

    // 2. Expected vs Realized
    const predictionError = expectedVsRealizedEngine.evaluateExpectedVsRealized(
      tradeOutcome, candidate, decision, intent
    );

    // 3. Signal Performance Ingestion
    signalPerformanceEngine.recordSignalOutcome({
      signalId: tradeOutcome.lineage.signalId,
      signalType: signal?.actionability || 'TRADEABLE',
      direction: signal?.marketReaction?.reactionCategory === 'BEARISH' ? 'BEARISH' : 'BULLISH',
      transmissionScore: signal?.transmissionScore || 85,
      rvolBucket: 'HIGH_RVOL',
      marketRegime: tradeOutcome.marketRegime,
      assetClass: candidate?.category || 'EQUITY',
      sector: 'IT',
      newsCategory: 'CORPORATE_ORDER',
      isWin: tradeOutcome.isWin,
      returnPct: tradeOutcome.realizedReturnPct,
      mfePct: tradeOutcome.maxFavorableExcursionPct,
      maePct: tradeOutcome.maxAdverseExcursionPct,
      evaluatedAt: new Date().toISOString()
    });

    // 4. Strategy Performance Ingestion
    const strategyType: StrategyType = candidate?.strategyType || 'EQUITY_MOMENTUM_CONTINUATION';
    strategyPerformanceEngine.recordStrategyTrade(strategyType, tradeOutcome);

    // 5. Regime Performance Ingestion
    regimePerformanceEngine.recordRegimeTrade(tradeOutcome.marketRegime, tradeOutcome);

    // 6. News Transmission Scorecard Ingestion
    transmissionScorecardEngine.recordTransmissionOutcome('CORPORATE_ORDER', tradeOutcome);

    // 7. Forensics (if losing trade or false signal)
    const forensics = !tradeOutcome.isWin
      ? falseSignalForensicsEngine.analyzeFailedSignal(tradeOutcome, signal)
      : undefined;

    // 8. Execution Performance Feedback
    executionPerformanceFeedbackEngine.evaluateExecutionFeedback('PAPER_SIMULATOR', 'LIMIT', [tradeOutcome]);

    // 9. Portfolio Decision Attribution
    if (decision) {
      portfolioDecisionAttributionEngine.evaluatePortfolioDecision(decision, tradeOutcome);
    }

    // 10. Adaptive Ranking & Strategy Evaluation
    const stratMetrics = strategyPerformanceEngine.evaluateStrategy(strategyType);
    const activeVersion = learningVersionManager.getActiveVersion();
    const adaptiveScore = adaptiveRankingEngine.computeStrategyScore(stratMetrics, activeVersion.versionId);

    // 11. Edge Decay Detection
    edgeDecayEngine.evaluateEdgeDecay(strategyType, [tradeOutcome]);

    // 12. Learning Safety Gate Validation
    const previousScore = activeVersion.scores[strategyType]?.discountedScore || 70;
    const safetyCheck = LearningSafetyGate.validateAdaptiveChange(
      strategyType,
      previousScore,
      adaptiveScore.discountedScore,
      stratMetrics.totalTrades,
      activeVersion.versionId,
      stratMetrics.statusReason
    );

    if (safetyCheck.isValid && safetyCheck.record) {
      learningVersionManager.recordChangeLog(safetyCheck.record);
    }

    // Update active version score snapshot
    activeVersion.scores[strategyType] = adaptiveScore;

    // 13. Construct Complete Result
    const partialResult: Omit<ClosedLoopIntelligenceResult, 'telegramText'> = {
      schemaVersion: 'v15_closed_loop_intelligence',
      tradeOutcome,
      attribution,
      predictionError,
      forensics,
      learningLog: safetyCheck.record || {
        logId: `log-${Date.now()}`,
        entityKey: strategyType,
        previousScore,
        newScore: adaptiveScore.discountedScore,
        evidenceWindow: 'LAST_30_TRADES',
        sampleSize: stratMetrics.totalTrades,
        performanceChange: 'STABLE',
        reason: 'Initial evaluation',
        learningVersion: activeVersion.versionId,
        riskGateChanged: false,
        timestamp: new Date().toISOString()
      },
      learningVersion: activeVersion.versionId,
      evaluatedAt: new Date().toISOString()
    };

    const telegramText = LearningTelegramSnapshot.formatTelegramPostTrade(
      partialResult as ClosedLoopIntelligenceResult
    );

    return {
      ...partialResult,
      telegramText
    };
  }
}

export const closedLoopIntelligenceEngine = new ClosedLoopIntelligenceEngine();
