/**
 * ATHENA NEWS ENGINE — PHASE 14
 * executionRoutes.ts
 * 
 * REST API Routes for Execution Intelligence & Deterministic Trade Lifecycle Engine.
 * Endpoints under /api/v5/execution/*
 */

import { Router, Request, Response } from 'express';
import { executionEngine } from '../execution/ExecutionEngine.ts';
import { executionAdapterFactory } from '../execution/ExecutionAdapterFactory.ts';
import { executionKillSwitch } from '../execution/ExecutionKillSwitch.ts';
import { executionMonitoringEngine } from '../execution/ExecutionMonitoringEngine.ts';
import { positionReconciliationEngine } from '../execution/PositionReconciliationEngine.ts';
import { tradeLifecycleEngine } from '../execution/TradeLifecycleEngine.ts';
import { preTradeValidationEngine } from '../execution/PreTradeValidationEngine.ts';
import { executionRiskGate } from '../execution/ExecutionRiskGate.ts';
import { orderConstructionEngine } from '../execution/OrderConstructionEngine.ts';
import { paperExecutionAdapter } from '../execution/ExecutionAdapterFactory.ts';

import { portfolioDecisionEngine } from '../portfolio/PortfolioDecisionEngine.ts';
import { quantStrategyIntelligenceEngine } from '../quant/QuantStrategyIntelligenceEngine.ts';
import { eventToSignalTransmissionEngine } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { PortfolioSnapshot } from '../portfolio/types.ts';

const fallbackSnapshot: PortfolioSnapshot = {
  schemaVersion: 'v13_portfolio_intelligence',
  timestamp: new Date().toISOString(),
  totalCapitalINR: 500000,
  availableCapitalINR: 211000,
  usedMarginINR: 289000,
  freeMarginINR: 211000,
  cashINR: 211000,
  totalUnrealizedPnLINR: 0,
  totalRealizedPnLINR: 0,
  positions: []
};

const router = Router();

// 1. GET /api/v5/execution/status
router.get('/status', (req: Request, res: Response) => {
  const adapter = executionAdapterFactory.getAdapter();
  const mode = executionAdapterFactory.getMode();
  const killSwitch = executionKillSwitch.getStatus();

  res.json({
    mode,
    adapterName: adapter.adapterName,
    brokerConnected: adapter.isAuthenticated(),
    killSwitch,
    serverTime: new Date().toISOString()
  });
});

// 2. GET /api/v5/execution/health
router.get('/health', (req: Request, res: Response) => {
  const health = executionMonitoringEngine.generateHealthReport();
  res.json(health);
});

// 3. GET /api/v5/execution/orders
router.get('/orders', async (req: Request, res: Response) => {
  const adapter = executionAdapterFactory.getAdapter();
  const orders = await adapter.getOpenOrders();
  res.json({ count: orders.length, orders });
});

// 4. GET /api/v5/execution/orders/:id
router.get('/orders/:id', async (req: Request, res: Response) => {
  const adapter = executionAdapterFactory.getAdapter();
  const order = await adapter.getOrderStatus(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

/// 5. POST /api/v5/execution/validate
router.post('/validate', (req: Request, res: Response) => {
  try {
    const rawArticle = req.body.rawArticle || {
      id: 'art-exec-val-1',
      title: 'TCS signs $1.5B Cloud Migration deal with European bank',
      content: 'TCS has secured a major 5-year digital transformation deal.',
      source: 'Bloomberg',
      timestamp: new Date().toISOString()
    };

    const signal = eventToSignalTransmissionEngine.transmitEventToSignal(rawArticle);
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signal);
    const candidate = candidates[0];
    const decision = portfolioDecisionEngine.evaluateCandidateForPortfolio(candidate, fallbackSnapshot);

    const intent = {
      schemaVersion: 'v14_execution_intelligence' as const,
      executionId: `exec-val-${Date.now()}`,
      strategyId: candidate.strategyId,
      portfolioDecisionId: decision.decisionId,
      symbol: candidate.symbol,
      underlyingSymbol: candidate.symbol,
      instrument: candidate.symbol,
      assetClass: 'EQUITY' as const,
      side: 'BUY' as const,
      quantity: req.body.requestedQty || 10,
      targetPrice: candidate.entryPrice || 100,
      orderType: 'LIMIT' as const,
      timeInForce: 'DAY' as const,
      entryRationale: 'Pre-trade validation test',
      sourceSignalId: signal.signalId,
      riskGateStatus: 'APPROVED' as const,
      portfolioGateStatus: decision.decision,
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: candidate.compatibilityScore,
      executionPriority: 'HIGH' as const,
      mode: executionAdapterFactory.getMode()
    };

    const validation = preTradeValidationEngine.validateExecution(intent, candidate, decision, fallbackSnapshot);
    const riskGate = executionRiskGate.evaluateGate(intent, validation, decision, fallbackSnapshot);

    res.json({ intent, validation, riskGate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/v5/execution/paper/submit
router.post('/paper/submit', async (req: Request, res: Response) => {
  try {
    const rawArticle = req.body.rawArticle || {
      id: `art-submit-${Date.now()}`,
      title: 'Infosys announces ₹18,000 Crore Share Buyback at 20% premium',
      content: 'Infosys board approves aggressive share buyback program.',
      source: 'Reuters',
      timestamp: new Date().toISOString()
    };

    const signal = eventToSignalTransmissionEngine.transmitEventToSignal(rawArticle);
    const candidates = quantStrategyIntelligenceEngine.evaluateSignalToStrategies(signal);
    const candidate = candidates[0];
    const decision = portfolioDecisionEngine.evaluateCandidateForPortfolio(candidate, fallbackSnapshot);

    const result = await executionEngine.processExecution(
      signal, candidate, decision, fallbackSnapshot, req.body.requestedQty
    );


    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GET /api/v5/execution/positions
router.get('/positions', async (req: Request, res: Response) => {
  const adapter = executionAdapterFactory.getAdapter();
  const positions = await adapter.getPositions();
  res.json({ count: positions.length, positions });
});

// 8. GET /api/v5/execution/reconciliation
router.get('/reconciliation', async (req: Request, res: Response) => {
  const adapter = executionAdapterFactory.getAdapter();
  const brokerPositions = await adapter.getPositions();

  const activeTrades = tradeLifecycleEngine.getActiveTrades();
  const athenaPositions = activeTrades.map(t => ({
    id: t.tradeId,
    symbol: t.symbol,
    underlyingSymbol: t.symbol,
    assetClass: 'EQUITY' as const,
    quantity: t.quantity,
    entryPrice: t.entryPrice,
    currentPrice: t.entryPrice,
    marketValueINR: t.entryPrice * t.quantity,
    unrealizedPnLINR: 0,
    realizedPnLINR: 0,
    portfolioWeightPct: 5.0,
    sector: 'IT',
    side: t.direction
  }));

  const report = positionReconciliationEngine.reconcilePositions(athenaPositions, brokerPositions);

  res.json(report);
});

// 9. POST /api/v5/execution/kill-switch
router.post('/kill-switch', (req: Request, res: Response) => {
  const trigger = req.body.trigger || 'GLOBAL_KILL';
  const reason = req.body.reason || 'Manual emergency kill switch triggered from Command Center Dashboard.';
  const triggeredBy = req.body.triggeredBy || 'USER_ADMIN';

  const status = executionKillSwitch.triggerKillSwitch(trigger, reason, triggeredBy);
  res.json(status);
});

// 10. POST /api/v5/execution/resume
router.post('/resume', (req: Request, res: Response) => {
  const resumedBy = req.body.resumedBy || 'USER_ADMIN';
  const status = executionKillSwitch.resumeExecution(resumedBy);
  res.json(status);
});

export default router;
