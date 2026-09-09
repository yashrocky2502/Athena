/**
 * ATHENA NEWS ENGINE — PHASE 15
 * learningRoutes.ts
 * 
 * Express routes for Phase 15 Closed-Loop Intelligence endpoints:
 * - GET /api/v5/learning/performance
 * - GET /api/v5/learning/signals
 * - GET /api/v5/learning/strategies
 * - GET /api/v5/learning/regimes
 * - GET /api/v5/learning/execution
 * - GET /api/v5/learning/attribution
 * - GET /api/v5/learning/false-signals
 * - GET /api/v5/learning/no-trade
 * - GET /api/v5/learning/edge-decay
 * - GET /api/v5/learning/rankings
 * - GET /api/v5/learning/versions
 * - GET /api/v5/learning/compare
 * - POST /api/v5/learning/rollback
 * - POST /api/v5/learning/process-trade
 */

import { Router, Request, Response } from 'express';
import { closedLoopIntelligenceEngine } from '../learning/ClosedLoopIntelligenceEngine.ts';
import { signalPerformanceEngine } from '../learning/SignalPerformanceEngine.ts';
import { strategyPerformanceEngine } from '../learning/StrategyPerformanceEngine.ts';
import { regimePerformanceEngine } from '../learning/RegimePerformanceEngine.ts';
import { transmissionScorecardEngine } from '../learning/TransmissionScorecardEngine.ts';
import { falseSignalForensicsEngine } from '../learning/FalseSignalForensicsEngine.ts';
import { executionPerformanceFeedbackEngine } from '../learning/ExecutionPerformanceFeedbackEngine.ts';
import { noTradePerformanceEngine } from '../learning/NoTradePerformanceEngine.ts';
import { adaptiveRankingEngine } from '../learning/AdaptiveRankingEngine.ts';
import { edgeDecayEngine } from '../learning/EdgeDecayEngine.ts';
import { learningVersionManager } from '../learning/LearningVersionManager.ts';
import { TradeOutcome, CompleteLineage } from '../learning/types.ts';

const router = Router();

// Mock fallback trade for API demonstrations
const fallbackTrade: TradeOutcome = {
  schemaVersion: 'v15_closed_loop_intelligence',
  lineage: {
    newsEventId: 'evt-100',
    entityId: 'INFY',
    signalId: 'sig-100',
    strategyCandidateId: 'strat-100',
    portfolioDecisionId: 'dec-100',
    executionId: 'exec-100',
    orderId: 'ord-100',
    positionId: 'pos-100',
    tradeId: 'trd-100'
  },
  symbol: 'INFY',
  underlyingSymbol: 'INFY',
  side: 'LONG',
  quantity: 50,
  entryPrice: 1800,
  exitPrice: 1860,
  entryTimestamp: new Date(Date.now() - 3600000).toISOString(),
  exitTimestamp: new Date().toISOString(),
  holdingPeriodMinutes: 60,
  realizedPnLINR: 18500,
  realizedReturnPct: 3.33,
  realizedRMultiple: 2.19,
  maxFavorableExcursionPct: 3.8,
  maxAdverseExcursionPct: -0.2,
  exitReason: 'TARGET_HIT',
  grossPnLINR: 19800,
  slippageCostINR: 450,
  transactionCostsINR: 850,
  netPnLINR: 18500,
  isWin: true,
  marketRegime: 'BULL'
};

// 1. GET /api/v5/learning/performance
router.get('/performance', (req: Request, res: Response) => {
  const result = closedLoopIntelligenceEngine.processCompletedTrade(fallbackTrade);
  res.json({
    activeVersion: learningVersionManager.getActiveVersion().versionId,
    sampleTradeResult: result
  });
});

// 2. GET /api/v5/learning/signals
router.get('/signals', (req: Request, res: Response) => {
  const metrics = signalPerformanceEngine.evaluateSignalPerformance();
  res.json(metrics);
});

// 3. GET /api/v5/learning/strategies
router.get('/strategies', (req: Request, res: Response) => {
  const metrics = strategyPerformanceEngine.evaluateStrategy('EQUITY_MOMENTUM_CONTINUATION');
  res.json(metrics);
});

// 4. GET /api/v5/learning/regimes
router.get('/regimes', (req: Request, res: Response) => {
  const perf = regimePerformanceEngine.evaluateRegime('BULL');
  res.json(perf);
});

// 5. GET /api/v5/learning/execution
router.get('/execution', (req: Request, res: Response) => {
  const feedback = executionPerformanceFeedbackEngine.evaluateExecutionFeedback();
  res.json(feedback);
});

// 6. GET /api/v5/learning/attribution
router.get('/attribution', (req: Request, res: Response) => {
  const result = closedLoopIntelligenceEngine.processCompletedTrade(fallbackTrade);
  res.json(result.attribution);
});

// 7. GET /api/v5/learning/false-signals
router.get('/false-signals', (req: Request, res: Response) => {
  const failedTrade: TradeOutcome = { ...fallbackTrade, netPnLINR: -8500, realizedReturnPct: -1.5, isWin: false };
  const forensic = falseSignalForensicsEngine.analyzeFailedSignal(failedTrade);
  res.json(forensic);
});

// 8. GET /api/v5/learning/no-trade
router.get('/no-trade', (req: Request, res: Response) => {
  const lineage: CompleteLineage = fallbackTrade.lineage;
  const mockDecision = {
    schemaVersion: 'v13_portfolio_intelligence' as const,
    decisionId: 'dec-1',
    candidateStrategyId: 'strat-1',
    candidateStrategyName: 'Sample',
    symbol: 'INFY',
    decision: 'NO_TRADE' as const,
    positionSizing: { recommendedQuantity: 100, maxAllowedQuantity: 200, conservativeQuantity: 50, limitingFactor: 'Capital', estimatedCapitalRequiredINR: 100000, estimatedMarginRequiredINR: 100000 },
    portfolioImpact: 'RISK_INCREMENTAL' as const,
    capitalImpactINR: 100000,
    marginImpactINR: 100000,
    deltaImpact: 100,
    concentrationImpactScore: 10,
    stressImpactLossINR: -10000,
    riskGateStatus: 'NO_TRADE' as const,
    rationales: ['Exceeded sector concentration limit'],
    evidenceReferences: [],
    generatedAt: new Date().toISOString(),
    engineVersion: 'ATHENA_PORTFOLIO_INTELLIGENCE_V13.0' as const
  };
  const record = noTradePerformanceEngine.evaluateNoTradeDecision(lineage, mockDecision, -2.5, 1800);
  res.json(record);
});

// 9. GET /api/v5/learning/edge-decay
router.get('/edge-decay', (req: Request, res: Response) => {
  const report = edgeDecayEngine.evaluateEdgeDecay('EQUITY_MOMENTUM_CONTINUATION', [fallbackTrade]);
  res.json(report);
});

// 10. GET /api/v5/learning/rankings
router.get('/rankings', (req: Request, res: Response) => {
  const metrics = strategyPerformanceEngine.evaluateStrategy('EQUITY_MOMENTUM_CONTINUATION');
  const score = adaptiveRankingEngine.computeStrategyScore(metrics);
  res.json(score);
});

// 11. GET /api/v5/learning/versions
router.get('/versions', (req: Request, res: Response) => {
  res.json(learningVersionManager.getAllVersions());
});

// 12. GET /api/v5/learning/compare
router.get('/compare', (req: Request, res: Response) => {
  const { v1 = 'v15.0', v2 = 'v15.0' } = req.query;
  const comparison = learningVersionManager.compareVersions(v1 as string, v2 as string);
  res.json(comparison);
});

// 13. POST /api/v5/learning/rollback
router.post('/rollback', (req: Request, res: Response) => {
  const { targetVersionId = 'v15.0' } = req.body;
  const result = learningVersionManager.rollbackVersion(targetVersionId);
  res.json(result);
});

// 14. POST /api/v5/learning/process-trade
router.post('/process-trade', (req: Request, res: Response) => {
  const trade = req.body.tradeOutcome || fallbackTrade;
  const result = closedLoopIntelligenceEngine.processCompletedTrade(trade);
  res.json(result);
});

export default router;
