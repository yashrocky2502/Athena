/**
 * ATHENA NEWS ENGINE — PHASE 16
 * researchRoutes.ts
 * 
 * Express routes for Phase 16 Research, Regime Discovery & Strategy Evolution:
 * - GET/POST /api/v5/research/regime
 * - GET /api/v5/research/regime-transition
 * - GET /api/v5/research/strategy-health
 * - GET /api/v5/research/strategy-decay
 * - GET/POST /api/v5/research/strategy-evolution
 * - GET/POST /api/v5/research/hypotheses
 * - GET /api/v5/research/experiments
 * - GET/POST /api/v5/research/market-memory
 * - GET /api/v5/research/knowledge-graph
 * - POST /api/v5/research/promotion-gate
 */

import { Router, Request, Response } from 'express';
import { MarketRegimeDiscoveryEngine } from '../learning/MarketRegimeDiscoveryEngine.ts';
import { RegimeTransitionEngine } from '../learning/RegimeTransitionEngine.ts';
import { StrategyRegimeMatrixEngine } from '../learning/StrategyRegimeMatrixEngine.ts';
import { StrategyDecayEngine } from '../learning/StrategyDecayEngine.ts';
import { StrategyEvolutionEngine } from '../learning/StrategyEvolutionEngine.ts';
import { StrategyPromotionGate } from '../learning/StrategyPromotionGate.ts';
import { MarketMemoryEngine } from '../learning/MarketMemoryEngine.ts';
import { ResearchHypothesisEngine } from '../learning/ResearchHypothesisEngine.ts';
import { AutonomousResearchQueue } from '../learning/AutonomousResearchQueue.ts';
import { StrategyKnowledgeGraph } from '../learning/StrategyKnowledgeGraph.ts';
import { EventOutcomeAttributionEngine } from '../learning/EventOutcomeAttributionEngine.ts';
import { TradeOutcome } from '../learning/types.ts';

const router = Router();

// Seed data once on load
StrategyRegimeMatrixEngine.seedMockData();
MarketMemoryEngine.seedMockMemory();
ResearchHypothesisEngine.seedMockHypotheses();
AutonomousResearchQueue.seedQueue();
StrategyKnowledgeGraph.seedGraph();

// Pre-register parent strategies and evolve some variants
const parent1 = StrategyEvolutionEngine.registerParent('EQUITY_MOMENTUM_CONTINUATION');
const parent2 = StrategyEvolutionEngine.registerParent('FUTURES_BREAKOUT');
StrategyEvolutionEngine.evolveStrategy(parent2.strategyId, 'rvolThreshold', 1.8, 'RVOL threshold raised from 1.5 to 1.8 to reduce false breakout signals');

// Setup standard mock trade history for decay engine testing
const mockTradesForDecay: TradeOutcome[] = Array.from({ length: 15 }, (_, i) => ({
  schemaVersion: 'v15_closed_loop_intelligence',
  lineage: {
    newsEventId: `n-${i}`,
    entityId: 'TCS',
    signalId: `s-${i}`,
    strategyCandidateId: 'strat-1',
    portfolioDecisionId: `d-${i}`,
    executionId: `e-${i}`,
    orderId: `o-${i}`,
    positionId: `p-${i}`,
    tradeId: `t-${i}`
  },
  symbol: 'TCS',
  underlyingSymbol: 'TCS',
  side: 'LONG',
  quantity: 100,
  entryPrice: 3400,
  exitPrice: i < 10 ? 3500 : 3300, // Profit at start, losing at the end (alpha decay!)
  entryTimestamp: new Date().toISOString(),
  exitTimestamp: new Date().toISOString(),
  holdingPeriodMinutes: 120,
  realizedPnLINR: i < 10 ? 10000 : -10000,
  realizedReturnPct: i < 10 ? 2.9 : -2.9,
  realizedRMultiple: i < 10 ? 2.0 : -2.0,
  maxFavorableExcursionPct: i < 10 ? 3.5 : 0.5,
  maxAdverseExcursionPct: i < 10 ? -0.2 : -3.5,
  exitReason: i < 10 ? 'TARGET_HIT' : 'STOP_LOSS_HIT',
  grossPnLINR: i < 10 ? 11000 : -9000,
  slippageCostINR: 500,
  transactionCostsINR: 500,
  netPnLINR: i < 10 ? 10000 : -10000,
  isWin: i < 10,
  marketRegime: 'BULL'
}));

StrategyDecayEngine.evaluateDecay('FUTURES_BREAKOUT', mockTradesForDecay);

// 1. GET/POST /api/v5/research/regime
router.get('/regime', (req: Request, res: Response) => {
  try {
    const inputMetrics = req.query as any;
    // Map string parameters to numbers
    const parsed: any = {};
    for (const key of Object.keys(inputMetrics)) {
      parsed[key] = Number(inputMetrics[key]);
    }
    const result = MarketRegimeDiscoveryEngine.discoverRegime(parsed);
    res.json({ status: 'success', result });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/regime', (req: Request, res: Response) => {
  try {
    const metrics = req.body.metrics;
    const result = MarketRegimeDiscoveryEngine.discoverRegime(metrics);
    
    // Process discovery through transition engine to filter noise
    const trans = RegimeTransitionEngine.processDiscovery(result.regime, result.confidencePct);

    res.json({
      status: 'success',
      result,
      transition: trans.confirmedTransition,
      activeRegime: trans.currentRegime,
      isNoisyTickFiltered: trans.isNoisyTickFiltered,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 2. GET /api/v5/research/regime-transition
router.get('/regime-transition', (req: Request, res: Response) => {
  try {
    res.json({
      status: 'success',
      activeRegime: RegimeTransitionEngine.getActiveRegime(),
      history: RegimeTransitionEngine.getTransitionHistory(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 3. GET /api/v5/research/strategy-health
router.get('/strategy-health', (req: Request, res: Response) => {
  try {
    const strategy = (req.query.strategy as any) || 'FUTURES_BREAKOUT';
    const regime = (req.query.regime as any) || 'TRENDING_BULL';
    const stats = StrategyRegimeMatrixEngine.evaluateStats(strategy, regime);
    res.json({ status: 'success', stats });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 4. GET /api/v5/research/strategy-decay
router.get('/strategy-decay', (req: Request, res: Response) => {
  try {
    const strategy = (req.query.strategy as any) || 'FUTURES_BREAKOUT';
    let report = StrategyDecayEngine.getReport(strategy);
    if (!report) {
      report = StrategyDecayEngine.evaluateDecay(strategy, mockTradesForDecay);
    }
    res.json({ status: 'success', report, allDecayReports: StrategyDecayEngine.getAllReports() });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 5. GET/POST /api/v5/research/strategy-evolution
router.get('/strategy-evolution', (req: Request, res: Response) => {
  try {
    res.json({ status: 'success', strategies: StrategyEvolutionEngine.getAllEvolved() });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/strategy-evolution', (req: Request, res: Response) => {
  try {
    const { parentStrategyId, fieldToMutate, newValue, rationale } = req.body;
    if (!parentStrategyId || !fieldToMutate || newValue === undefined || !rationale) {
      return res.status(400).json({ status: 'error', message: 'Missing parameters' });
    }
    const evolved = StrategyEvolutionEngine.evolveStrategy(parentStrategyId, fieldToMutate, newValue, rationale);
    res.json({ status: 'success', evolved });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 6. GET/POST /api/v5/research/hypotheses
router.get('/hypotheses', (req: Request, res: Response) => {
  try {
    res.json({ status: 'success', hypotheses: ResearchHypothesisEngine.getHypotheses() });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/hypotheses', async (req: Request, res: Response) => {
  try {
    const { seedTopic } = req.body;
    const generated = await ResearchHypothesisEngine.generateHypothesis(seedTopic);
    
    // Add to autonomous research queue
    AutonomousResearchQueue.enqueue({
      itemId: `RQ_${Date.now()}`,
      type: 'HYPOTHESIS',
      title: generated.title,
      description: generated.description,
      expectedInformationGain: generated.expectedInformationGain,
      marketRelevanceScore: generated.marketRelevanceScore,
      statisticalPotential: generated.statisticalPotential,
      status: 'QUEUED'
    });

    res.json({ status: 'success', generated });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 7. GET /api/v5/research/experiments
router.get('/experiments', (req: Request, res: Response) => {
  try {
    res.json({
      status: 'success',
      queue: AutonomousResearchQueue.getQueue(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 8. GET/POST /api/v5/research/market-memory
router.get('/market-memory', (req: Request, res: Response) => {
  try {
    const { eventType, sector, regime } = req.query as any;
    const matches = MarketMemoryEngine.findAnalogues({ eventType, sector, regime });
    const analysis = MarketMemoryEngine.analyzePrecedents(matches);
    res.json({ status: 'success', matches, analysis });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/market-memory', (req: Request, res: Response) => {
  try {
    const analogue = req.body.analogue;
    if (!analogue) {
      return res.status(400).json({ status: 'error', message: 'Missing analogue object' });
    }
    MarketMemoryEngine.addAnalogue(analogue);
    res.json({ status: 'success', message: 'Analogue registered successfully' });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 9. GET /api/v5/research/knowledge-graph
router.get('/knowledge-graph', (req: Request, res: Response) => {
  try {
    res.json({
      status: 'success',
      nodes: StrategyKnowledgeGraph.getNodes(),
      edges: StrategyKnowledgeGraph.getEdges(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 10. POST /api/v5/research/promotion-gate
router.post('/promotion-gate', (req: Request, res: Response) => {
  try {
    const { strategyId, additionalMetrics } = req.body;
    if (!strategyId) {
      return res.status(400).json({ status: 'error', message: 'Missing strategyId' });
    }
    const strategy = StrategyEvolutionEngine.getStrategy(strategyId);
    if (!strategy) {
      return res.status(404).json({ status: 'error', message: 'Strategy not found' });
    }
    const result = StrategyPromotionGate.evaluatePromotion(strategy, additionalMetrics);
    res.json({ status: 'success', result });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
