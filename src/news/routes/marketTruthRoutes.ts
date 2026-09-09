/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * marketTruthRoutes.ts
 * 
 * REST API endpoints for Canonical Market Truth, Session, Quality, and Circuit Breaker.
 */

import { Router, Request, Response } from 'express';
import { marketTruthStateManager } from '../market-truth/MarketTruthStateManager.ts';
import { marketSessionEngine } from '../market-truth/MarketSessionEngine.ts';
import { marketTruthCircuitBreaker } from '../market-truth/MarketTruthCircuitBreaker.ts';

export const marketTruthRouter = Router();

// 1. GET /status - Overall Market Truth State & Health
marketTruthRouter.get('/status', (req: Request, res: Response) => {
  try {
    const truthState = marketTruthStateManager.getTruthState();
    res.json({
      success: true,
      data: truthState
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. GET /snapshot - Latest Unified Canonical Market Snapshot
marketTruthRouter.get('/snapshot', (req: Request, res: Response) => {
  try {
    const snapshot = marketTruthStateManager.getSnapshot();
    res.json({
      success: true,
      data: snapshot
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GET /instrument/:symbol - Canonical Instrument State
marketTruthRouter.get('/instrument/:symbol', (req: Request, res: Response) => {
  try {
    const sym = req.params.symbol;
    const state = marketTruthStateManager.getInstrumentState(sym);
    if (!state) {
      return res.status(404).json({ success: false, message: `Instrument '${sym}' not found in canonical store` });
    }
    res.json({
      success: true,
      data: state
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. GET /quality - Market Data Quality Breakdown
marketTruthRouter.get('/quality', (req: Request, res: Response) => {
  try {
    const snapshot = marketTruthStateManager.getSnapshot();
    res.json({
      success: true,
      data: snapshot.quality
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. GET /sources - Active Feed Sources & Status
marketTruthRouter.get('/sources', (req: Request, res: Response) => {
  try {
    const sources = marketTruthStateManager.getSources();
    res.json({
      success: true,
      data: sources
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. GET /anomalies - Active Market Anomalies & Discontinuities
marketTruthRouter.get('/anomalies', (req: Request, res: Response) => {
  try {
    const anomalies = marketTruthStateManager.getAnomalies();
    res.json({
      success: true,
      data: anomalies
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. GET /session - Current Market Session State
marketTruthRouter.get('/session', (req: Request, res: Response) => {
  try {
    const session = marketSessionEngine.getSession(new Date().toISOString(), 'NSE');
    res.json({
      success: true,
      data: session
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. GET /telemetry - Microstructure & Processing Telemetry
marketTruthRouter.get('/telemetry', (req: Request, res: Response) => {
  try {
    const telemetry = marketTruthStateManager.getTelemetry();
    res.json({
      success: true,
      data: telemetry
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. POST /tick - Ingest Raw Feed Tick
marketTruthRouter.post('/tick', (req: Request, res: Response) => {
  try {
    const raw = req.body;
    if (!raw || !raw.symbol || raw.lastPrice === undefined) {
      return res.status(400).json({ success: false, message: 'Invalid tick body: symbol and lastPrice are required' });
    }
    const result = marketTruthStateManager.ingestRawTick(raw);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. POST /circuit-breaker/trip - Trip execution lock
marketTruthRouter.post('/circuit-breaker/trip', (req: Request, res: Response) => {
  try {
    const { reason } = req.body || {};
    marketTruthCircuitBreaker.trip(reason || 'Manual administrative trip');
    res.json({
      success: true,
      data: marketTruthCircuitBreaker.getStatus()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. POST /circuit-breaker/reset - Reset execution lock
marketTruthRouter.post('/circuit-breaker/reset', (req: Request, res: Response) => {
  try {
    marketTruthCircuitBreaker.reset();
    res.json({
      success: true,
      data: marketTruthCircuitBreaker.getStatus()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
