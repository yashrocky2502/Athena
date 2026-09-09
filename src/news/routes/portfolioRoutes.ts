/**
 * ATHENA NEWS ENGINE — PHASE 13
 * portfolioRoutes.ts
 * 
 * Express Router endpoints for Portfolio Intelligence & Position Decision Engine (/api/v5/portfolio/*).
 */

import { Router, Request, Response } from 'express';
import { portfolioDecisionEngine } from '../portfolio/PortfolioDecisionEngine.ts';
import { portfolioPositionNormalizer } from '../portfolio/PortfolioPositionNormalizer.ts';
import { portfolioExposureEngine } from '../portfolio/PortfolioExposureEngine.ts';
import { portfolioGreeksEngine } from '../portfolio/PortfolioGreeksEngine.ts';
import { portfolioStressEngine } from '../portfolio/PortfolioStressEngine.ts';
import { portfolioTelegramSnapshot } from '../portfolio/PortfolioTelegramSnapshot.ts';
import { RawPortfolioPosition, PortfolioSnapshot } from '../portfolio/types.ts';
import { strategyCandidateEngine } from '../quant/StrategyCandidateEngine.ts';
import { TransmissionSignalResult } from '../intelligence/EventToSignalTransmissionEngine.ts';

const router = Router();

// Sample Default Portfolio Snapshot for UI demonstration & testing
const DEFAULT_SAMPLE_PORTFOLIO_POSITIONS: RawPortfolioPosition[] = [
  {
    id: 'pos-1',
    symbol: 'INFY',
    underlyingSymbol: 'INFY',
    assetClass: 'EQUITY',
    side: 'LONG',
    quantity: 150,
    entryPrice: 1820,
    currentPrice: 1860,
    unrealizedPnLINR: 6000,
    realizedPnLINR: 0,
    sector: 'IT',
    indexSymbol: 'NIFTY_IT',
    beta: 1.1
  },
  {
    id: 'pos-2',
    symbol: 'RELIANCE',
    underlyingSymbol: 'RELIANCE',
    assetClass: 'EQUITY',
    side: 'LONG',
    quantity: 100,
    entryPrice: 2950,
    currentPrice: 3010,
    unrealizedPnLINR: 6000,
    realizedPnLINR: 0,
    sector: 'ENERGY',
    indexSymbol: 'NIFTY',
    beta: 1.25
  },
  {
    id: 'pos-3',
    symbol: 'NIFTY_25000_CE',
    underlyingSymbol: 'NIFTY',
    assetClass: 'OPTIONS',
    side: 'SHORT',
    quantity: 2,
    entryPrice: 180,
    currentPrice: 140,
    unrealizedPnLINR: 4000,
    realizedPnLINR: 0,
    sector: 'INDEX',
    indexSymbol: 'NIFTY',
    optionType: 'CALL',
    strikePrice: 25000,
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    delta: -0.42,
    gamma: -0.0015,
    theta: 18.5,
    vega: -12.0
  }
];

/**
 * GET /api/v5/portfolio/snapshot
 */
router.get('/snapshot', (req: Request, res: Response) => {
  try {
    const totalCapitalINR = 500000;
    const normalizedPositions = portfolioPositionNormalizer.normalizePositions(DEFAULT_SAMPLE_PORTFOLIO_POSITIONS);
    const exposure = portfolioExposureEngine.calculateExposure(normalizedPositions, totalCapitalINR);
    const greeks = portfolioGreeksEngine.aggregateGreeks(normalizedPositions);
    const stress = portfolioStressEngine.runStressTests(normalizedPositions, totalCapitalINR);

    const snapshot: PortfolioSnapshot = {
      schemaVersion: 'v13_portfolio_intelligence',
      timestamp: new Date().toISOString(),
      totalCapitalINR,
      availableCapitalINR: 211000,
      usedMarginINR: 289000,
      freeMarginINR: 211000,
      cashINR: 211000,
      totalUnrealizedPnLINR: 16000,
      totalRealizedPnLINR: 0,
      positions: normalizedPositions
    };

    res.json({
      success: true,
      snapshot,
      exposure,
      greeks,
      stressSummary: {
        score: stress.overallStressScore,
        worstLossINR: stress.worstCaseLossINR,
        worstScenario: stress.worstCaseScenarioName
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v5/portfolio/evaluate
 */
router.post('/evaluate', (req: Request, res: Response) => {
  try {
    const { candidateStrategy, portfolioSnapshot, rawPositions, capitalINR, marketRegime } = req.body;

    let targetCandidate = candidateStrategy;
    if (!targetCandidate) {
      // Generate sample strategy candidate on the fly if not provided
      const sampleSignal: any = {
        signalId: 'sig-route-eval',
        eventCategory: 'EARNINGS_BEAT',
        symbol: 'INFY',
        direction: 'BULLISH',
        transmissionScore: 82,
        marketReaction: { totalChangePct: 2.8, currentPrice: 1860, rvol: 2.1 },
        lifecycleState: 'CONFIRMED',
        actionability: 'TRADEABLE',
        headline: 'Infosys Reports Strong Q3 Earnings Growth',
        canonicalSummary: 'Infosys reports quarterly revenue surge with expanding margins.'
      };
      const candidates = strategyCandidateEngine.generateCandidatesForSignal(sampleSignal);
      targetCandidate = candidates[0];
    }

    const snapshotInput = portfolioSnapshot || {
      totalCapitalINR: capitalINR || 500000,
      rawPositions: rawPositions || DEFAULT_SAMPLE_PORTFOLIO_POSITIONS
    };

    const decision = portfolioDecisionEngine.evaluateCandidateForPortfolio(
      targetCandidate,
      snapshotInput,
      marketRegime || 'BALANCED'
    );

    const telegramText = portfolioTelegramSnapshot.generateTelegramSnapshot(decision);

    res.json({
      success: true,
      decision,
      telegramText
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export const portfolioRoutes = router;
