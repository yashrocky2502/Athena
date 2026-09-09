/**
 * ATHENA — Phase 18 Market Surveillance Test Suite
 * Phase18_MarketSurveillance.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketSurveillanceEngine } from '../surveillance/MarketSurveillanceEngine.ts';
import { AthenaEventBus } from '../intelligence/AthenaEventBus.ts';
import { priceAnomalyEngine } from '../surveillance/PriceAnomalyEngine.ts';
import { volumeAnomalyEngine } from '../surveillance/VolumeAnomalyEngine.ts';
import { volatilitySurveillanceEngine } from '../surveillance/VolatilitySurveillanceEngine.ts';
import { fnoAnomalyEngine } from '../surveillance/FnoAnomalyEngine.ts';
import { optionsMicrostructureEngine } from '../surveillance/OptionsMicrostructureEngine.ts';
import { liquiditySurveillanceEngine } from '../surveillance/LiquiditySurveillanceEngine.ts';
import { sectorDivergenceEngine } from '../surveillance/SectorDivergenceEngine.ts';
import { crossAssetShockEngine } from '../surveillance/CrossAssetShockEngine.ts';
import { newsCorrelationEngine } from '../surveillance/NewsCorrelationEngine.ts';
import { newsMarketMismatchEngine } from '../surveillance/NewsMarketMismatchEngine.ts';
import { marketNoiseFilter } from '../surveillance/MarketNoiseFilter.ts';
import { surveillanceTelegramSnapshot } from '../surveillance/SurveillanceTelegramSnapshot.ts';

describe('ATHENA Phase 18 — Autonomous Real-Time Market Surveillance & Event Detection Engine', () => {
  beforeEach(() => {
    AthenaEventBus.getInstance().reset();
    MarketSurveillanceEngine.getInstance().reset();
  });

  describe('Price Anomaly Detection', () => {
    it('should detect a standard price breakout and assign appropriate anomaly scores', () => {
      const prices = [100, 101, 100.5, 102, 101.8, 105.5]; // last element is a material breakout
      const result = priceAnomalyEngine.analyze(prices, 100, 100, 1.2);

      expect(result.metrics.lastPrice).toBe(105.5);
      expect(result.metrics.isBreakout).toBe(true);
      expect(result.score).toBeGreaterThan(40);
    });

    it('should handle small baseline arrays gracefully without crashing', () => {
      const result = priceAnomalyEngine.analyze([100], 100, 100, 1.2);
      expect(result.score).toBe(0);
      expect(result.metrics.percentageChange).toBe(0);
    });
  });

  describe('Volume & RVOL Anomaly Detection', () => {
    it('should identify a massive volume spike (RVOL) and classify it as extreme', () => {
      const volumes = [1000, 1200, 950, 1100, 8000]; // last volume is 8x normal baseline
      const prices = [100, 100.5, 101, 100.8, 103.5];
      const result = volumeAnomalyEngine.analyze(volumes, prices);

      expect(result.metrics.relativeVolume).toBeGreaterThan(4);
      expect(result.classification).toBe('EXTREME');
      expect(result.score).toBeGreaterThan(60);
    });
  });

  describe('Volatility Surveillance & Regime Transitions', () => {
    it('should detect volatility expansion when ATR spikes significantly', () => {
      const prices = [100, 102, 99, 105, 96, 112];
      const recentAtrs = [1.2, 1.3, 1.2, 1.4, 2.5]; // last ATR represents a major spike
      const result = volatilitySurveillanceEngine.analyze(prices, recentAtrs);

      expect(result.metrics.volRegime).toBe('VOLATILITY_EXPANSION');
      expect(result.score).toBeGreaterThan(30);
    });
  });

  describe('Open Interest & F&O Positioning', () => {
    it('should resolve long-buildup state when price rises and OI expands', () => {
      const result = fnoAnomalyEngine.analyze(2.5, 550000, 500000, 0.4);

      expect(result.metrics.longShortClassification).toBe('LONG_BUILDUP');
      expect(result.score).toBeGreaterThan(40);
    });

    it('should resolve short-buildup state when price drops and OI expands', () => {
      const result = fnoAnomalyEngine.analyze(-2.5, 550000, 500000, -0.4);

      expect(result.metrics.longShortClassification).toBe('SHORT_BUILDUP');
    });
  });

  describe('Options Microstructure Anomalies', () => {
    it('should identify extreme put-call imbalance and list matching evidence', () => {
      const result = optionsMicrostructureEngine.analyze(25000, 5000, 120000, 30000, 4000, 0, true);

      expect(result.metrics.optionVolumeSpikeRatio).toBeGreaterThan(5);
      expect(result.metrics.putCallRatio).toBe(5.0);
      expect(result.evidence.some(e => e.includes('Unusual call-side volume'))).toBe(true);
    });
  });

  describe('Liquidity Shock Detection', () => {
    it('should identify spread deterioration and flag a liquidity shock', () => {
      const result = liquiditySurveillanceEngine.analyze(0.65, 0.2, 0.9);

      expect(result.metrics.liquidityState).toBe('LIQUIDITY_SHOCK');
      expect(result.score).toBeGreaterThan(60);
    });
  });

  describe('Sector & Index Divergence', () => {
    it('should detect when a stock is outperforming its sector significantly', () => {
      const result = sectorDivergenceEngine.analyze('RELIANCE', 4.5, 1.2, 0.4);

      expect(result.metrics.outperformingSector).toBe(true);
      expect(result.metrics.isSectorLeader).toBe(true);
      expect(result.evidence).toContain('RELIANCE is outperforming its sector');
    });
  });

  describe('Cross-Asset Shock Transmission', () => {
    it('should detect potential transmission vector on crude spikes with market drops', () => {
      const result = crossAssetShockEngine.analyze(0.2, 4.5, 1.0, -1.2, 'OMC');

      expect(result.metrics.correlationStatus).toBe('POTENTIAL_TRANSMISSION');
      expect(result.evidence.some(e => e.includes('Crude Oil spike'))).toBe(true);
    });
  });

  describe('News Correlation & News-Market Mismatch', () => {
    it('should return price without news when extreme movement occurs without catalysts', () => {
      const result = newsMarketMismatchEngine.evaluate('evt-101', false, 'NEUTRAL', 4.2, 5.0);

      expect(result.marketConfirmation).toBe('PRICE_WITHOUT_NEWS');
      expect(result.contradictions.length).toBeGreaterThan(0);
    });

    it('should return news market mismatch when news is bullish but price falls', () => {
      const result = newsMarketMismatchEngine.evaluate('evt-101', true, 'BULLISH', -3.2, 4.5);

      expect(result.marketConfirmation).toBe('NEWS_MARKET_CONTRADICTION');
    });
  });

  describe('Market Noise Filter', () => {
    it('should block signals when spread is too wide', () => {
      const result = marketNoiseFilter.shouldBlock('RELIANCE', 'PRICE_ANOMALY', 2.0, 5000, 1.5);
      expect(result.block).toBe(true);
      expect(result.reason).toBe('LIQUIDITY_SPREAD_TOO_WIDE_NOISE');
    });

    it('should allow valid alerts that pass noise parameters', () => {
      const result = marketNoiseFilter.shouldBlock('TCS', 'PRICE_ANOMALY', 3.5, 120000, 0.02);
      expect(result.block).toBe(false);
    });
  });

  describe('E2E Central Surveillance Integration', () => {
    it('should ingest market tick, perform composite scoring, and publish high priority event', async () => {
      const engine = MarketSurveillanceEngine.getInstance();
      const bus = AthenaEventBus.getInstance();

      let publishedUnifiedEvent: any = null;
      bus.subscribe('SURVEILLANCE_ANOMALY_DETECTED', async (evt) => {
        publishedUnifiedEvent = evt;
      });

      const ev = await engine.ingestTick({
        symbol: 'RELIANCE',
        exchange: 'NSE',
        prices: [2400, 2410, 2405, 2420, 2415, 2490], // extreme spike
        openPrice: 2400,
        prevClose: 2400,
        volumes: [5000, 6000, 4500, 5500, 4000, 45000], // volume spike
        bidAskSpreadPct: 0.03,
        recentAtrs: [20, 21, 20, 22, 23, 45], // volatility spike
        currentOi: 1200000,
        prevOi: 1000000, // OI buildup
        futuresBasis: 5.5,
        stockReturn: 3.75,
        sectorReturn: 0.5,
        indexReturn: 0.2,
        usdInrDeltaPct: 0.1,
        crudeDeltaPct: 0.2,
        goldDeltaPct: 0.1,
      });

      expect(ev).not.toBeNull();
      expect(ev!.priority).toBe('P1_HIGH');
      expect(ev!.actionability).toBe('TRADEABLE');

      // Verify published on central event bus
      expect(publishedUnifiedEvent).not.toBeNull();
      expect(publishedUnifiedEvent.eventId).toBe(ev!.id);
      expect(publishedUnifiedEvent.entityIds).toContain('RELIANCE');
    });
  });

  describe('Telegram Alert Parity Rendering', () => {
    it('should format surveillance event into clean HTML Telegram structure', async () => {
      const engine = MarketSurveillanceEngine.getInstance();
      const ev = await engine.ingestTick({
        symbol: 'INFY',
        exchange: 'NSE',
        prices: [1500, 1505, 1502, 1510, 1508, 1580],
        openPrice: 1500,
        prevClose: 1500,
        volumes: [2000, 2500, 2200, 2400, 2100, 18000],
        bidAskSpreadPct: 0.02,
        recentAtrs: [12, 13, 12, 14, 13, 25],
        stockReturn: 5.3,
        sectorReturn: 1.1,
        indexReturn: 0.4,
      });

      const telegramMsg = surveillanceTelegramSnapshot.format(ev!);
      expect(telegramMsg).toContain('⚡ ATHENA SURVEILLANCE ALERT');
      expect(telegramMsg).toContain('INFY — Unusual Market Activity Detected');
      expect(telegramMsg).toContain('RVOL:');
      expect(telegramMsg).toContain('Downstream strategy evaluation eligible.');
    });
  });
});
