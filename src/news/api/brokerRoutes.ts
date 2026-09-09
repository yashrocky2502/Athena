/**
 * ATHENA NEWS ENGINE — PHASE 20
 * brokerRoutes.ts
 * 
 * Production Broker Control & Observability API Router.
 * Provides sanitized status, credentials descriptors, execution mode switching,
 * manual position reconciliation triggers, and kill switch controls.
 */

import { Router, Request, Response } from 'express';
import { credentialManager } from '../credentials/CredentialManager.ts';
import { executionModeController } from '../execution/ExecutionModeController.ts';
import { executionAdapterFactory } from '../execution/ExecutionAdapterFactory.ts';
import { positionReconciliationScheduler } from '../execution/PositionReconciliationScheduler.ts';
import { positionReconciliationEngine } from '../execution/PositionReconciliationEngine.ts';
import { fillReconciliationEngine } from '../execution/FillReconciliationEngine.ts';
import { marketDataQualityEngine } from '../marketdata/MarketDataQualityEngine.ts';
import { executionKillSwitch } from '../execution/ExecutionKillSwitch.ts';
import { CredentialSanitizer } from '../credentials/CredentialSanitizer.ts';

export const brokerRouter = Router();

// GET /api/broker/status - Connectivity, auth, latency, mode, rate limit
brokerRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const adapter = executionAdapterFactory.getAdapter();
    const health = await adapter.healthCheck();
    const mode = executionModeController.getMode();
    const killSwitch = executionKillSwitch.getStatus();

    res.json({
      mode,
      activeBroker: adapter.broker,
      health,
      killSwitch,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/broker/credentials - Sanitized credential descriptors (no raw secrets)
brokerRouter.get('/credentials', async (req: Request, res: Response) => {
  try {
    const descriptors = await credentialManager.getAllDescriptors();
    res.json({ credentials: descriptors });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/broker/mode - Switch mode (PAPER / SANDBOX / LIVE)
brokerRouter.post('/mode', async (req: Request, res: Response) => {
  try {
    const { mode, broker, adminPassphrase } = req.body;
    const result = await executionModeController.setMode(mode, broker, adminPassphrase);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/broker/reconcile - Trigger manual reconciliation cycle
brokerRouter.post('/reconcile', async (req: Request, res: Response) => {
  try {
    const report = await positionReconciliationScheduler.runReconciliationCycle();
    res.json({ report });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/broker/positions - Current positions
brokerRouter.get('/positions', async (req: Request, res: Response) => {
  try {
    const adapter = executionAdapterFactory.getAdapter();
    const positions = await adapter.getPositions();
    res.json({ positions });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/broker/orders - Open & recent orders
brokerRouter.get('/orders', async (req: Request, res: Response) => {
  try {
    const adapter = executionAdapterFactory.getAdapter();
    const orders = await adapter.getOpenOrders();
    res.json({ orders });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/broker/fills - Canonical fill history
brokerRouter.get('/fills', async (req: Request, res: Response) => {
  try {
    const fills = fillReconciliationEngine.getFills();
    res.json({ fills });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/marketdata/health - Real-time market data quality report
brokerRouter.get('/marketdata/health', (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'INFY';
    const report = marketDataQualityEngine.evaluateQuality(symbol);
    res.json({ report });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/broker/killswitch - Trigger / Reset Kill Switch
brokerRouter.post('/killswitch', (req: Request, res: Response) => {
  try {
    const { action, reason, triggeredBy } = req.body;
    if (action === 'ACTIVATE') {
      executionKillSwitch.activateGlobalKillSwitch(reason || 'Manual Admin Emergency Kill Switch', triggeredBy || 'ADMIN_API');
    } else if (action === 'RESET') {
      executionKillSwitch.reset();
    }
    res.json({ status: executionKillSwitch.getStatus() });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});
