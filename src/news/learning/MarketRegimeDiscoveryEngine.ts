/**
 * ATHENA NEWS ENGINE — PHASE 16
 * MarketRegimeDiscoveryEngine.ts
 * 
 * Deterministic Market Regime Discovery Engine.
 * Identifies changing market conditions from live and historical data using measurable
 * mathematical indicators, and exposes the specific parameters and evidence of the classification.
 */

export type DiscoveryRegimeType =
  | 'TRENDING_BULL'
  | 'TRENDING_BEAR'
  | 'RANGE_BOUND'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'VOLATILITY_EXPANSION'
  | 'VOLATILITY_CONTRACTION'
  | 'GAP_REGIME'
  | 'EVENT_DRIVEN'
  | 'LIQUIDITY_STRESS'
  | 'RISK_OFF'
  | 'RISK_ON';

export interface MarketMetrics {
  atr: number;                  // Average True Range (normalized)
  realizedVolatilityPct: number;// Realized Volatility (%)
  impliedVolatilityPct: number; // Implied Volatility (%)
  adx: number;                  // Average Directional Index (0-100)
  vwapDisplacementPct: number;  // Distance of price from VWAP (%)
  trendStrength: number;        // Trend strength indicator (-100 to 100)
  rvol: number;                 // Relative Volume
  marketBreadthPct: number;     // Advance/Decline ratio (%)
  vix: number;                  // VIX or India VIX level
  yieldMovementBps: number;     // Benchmark yield change (bps)
  usdInrChangePct: number;      // USD/INR currency change (%)
  commodityCorrelation: number; // Correlation with broad commodities (-1 to 1)
  indexDispersion: number;      // Dispersion of index constituents
}

export interface RegimeEvidence {
  metricName: string;
  actualValue: number;
  thresholdCondition: string;
  isTriggered: boolean;
}

export interface RegimeClassificationResult {
  regime: DiscoveryRegimeType;
  confidencePct: number;
  evidence: RegimeEvidence[];
  timestamp: string;
  metrics: MarketMetrics;
}

export class MarketRegimeDiscoveryEngine {
  private static defaultMetrics: MarketMetrics = {
    atr: 1.8,
    realizedVolatilityPct: 18.5,
    impliedVolatilityPct: 20.2,
    adx: 28.0,
    vwapDisplacementPct: 1.5,
    trendStrength: 45.0,
    rvol: 1.4,
    marketBreadthPct: 62.0,
    vix: 15.4,
    yieldMovementBps: 2.5,
    usdInrChangePct: -0.1,
    commodityCorrelation: 0.35,
    indexDispersion: 1.2,
  };

  /**
   * Determine current market regime based on input metrics
   */
  public static discoverRegime(inputMetrics?: Partial<MarketMetrics>): RegimeClassificationResult {
    const metrics: MarketMetrics = { ...this.defaultMetrics, ...inputMetrics };
    const evidenceList: { [key in DiscoveryRegimeType]: RegimeEvidence[] } = this.evaluateAllEvidence(metrics);

    let bestRegime: DiscoveryRegimeType = 'RISK_ON';
    let highestConfidence = 0;

    const regimes: DiscoveryRegimeType[] = [
      'TRENDING_BULL',
      'TRENDING_BEAR',
      'RANGE_BOUND',
      'HIGH_VOLATILITY',
      'LOW_VOLATILITY',
      'VOLATILITY_EXPANSION',
      'VOLATILITY_CONTRACTION',
      'GAP_REGIME',
      'EVENT_DRIVEN',
      'LIQUIDITY_STRESS',
      'RISK_OFF',
      'RISK_ON',
    ];

    for (const r of regimes) {
      const evidence = evidenceList[r];
      const triggeredCount = evidence.filter(e => e.isTriggered).length;
      const confidence = Number(((triggeredCount / evidence.length) * 100).toFixed(1));

      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestRegime = r;
      }
    }

    // Default fallback to RANGE_BOUND if confidence is low, or keep selected if reasonable
    if (highestConfidence < 30) {
      bestRegime = 'RANGE_BOUND';
      highestConfidence = 45.0;
    }

    return {
      regime: bestRegime,
      confidencePct: highestConfidence,
      evidence: evidenceList[bestRegime],
      timestamp: new Date().toISOString(),
      metrics,
    };
  }

  private static evaluateAllEvidence(m: MarketMetrics): { [key in DiscoveryRegimeType]: RegimeEvidence[] } {
    return {
      TRENDING_BULL: [
        { metricName: 'ADX', actualValue: m.adx, thresholdCondition: '> 25', isTriggered: m.adx > 25 },
        { metricName: 'Trend Strength', actualValue: m.trendStrength, thresholdCondition: '> 20', isTriggered: m.trendStrength > 20 },
        { metricName: 'VWAP Displacement', actualValue: m.vwapDisplacementPct, thresholdCondition: '> 0.5', isTriggered: m.vwapDisplacementPct > 0.5 },
        { metricName: 'Market Breadth', actualValue: m.marketBreadthPct, thresholdCondition: '> 55', isTriggered: m.marketBreadthPct > 55 },
      ],
      TRENDING_BEAR: [
        { metricName: 'ADX', actualValue: m.adx, thresholdCondition: '> 25', isTriggered: m.adx > 25 },
        { metricName: 'Trend Strength', actualValue: m.trendStrength, thresholdCondition: '< -20', isTriggered: m.trendStrength < -20 },
        { metricName: 'VWAP Displacement', actualValue: m.vwapDisplacementPct, thresholdCondition: '< -0.5', isTriggered: m.vwapDisplacementPct < -0.5 },
        { metricName: 'Market Breadth', actualValue: m.marketBreadthPct, thresholdCondition: '< 45', isTriggered: m.marketBreadthPct < 45 },
      ],
      RANGE_BOUND: [
        { metricName: 'ADX', actualValue: m.adx, thresholdCondition: '< 20', isTriggered: m.adx < 20 },
        { metricName: 'VWAP Displacement', actualValue: Math.abs(m.vwapDisplacementPct), thresholdCondition: '< 0.5', isTriggered: Math.abs(m.vwapDisplacementPct) < 0.5 },
        { metricName: 'Trend Strength', actualValue: Math.abs(m.trendStrength), thresholdCondition: '< 15', isTriggered: Math.abs(m.trendStrength) < 15 },
      ],
      HIGH_VOLATILITY: [
        { metricName: 'VIX / India VIX', actualValue: m.vix, thresholdCondition: '> 22', isTriggered: m.vix > 22 },
        { metricName: 'Realized Volatility', actualValue: m.realizedVolatilityPct, thresholdCondition: '> 25', isTriggered: m.realizedVolatilityPct > 25 },
        { metricName: 'ATR (normalized)', actualValue: m.atr, thresholdCondition: '> 2.5', isTriggered: m.atr > 2.5 },
      ],
      LOW_VOLATILITY: [
        { metricName: 'VIX / India VIX', actualValue: m.vix, thresholdCondition: '< 13', isTriggered: m.vix < 13 },
        { metricName: 'Realized Volatility', actualValue: m.realizedVolatilityPct, thresholdCondition: '< 12', isTriggered: m.realizedVolatilityPct < 12 },
        { metricName: 'ATR (normalized)', actualValue: m.atr, thresholdCondition: '< 1.2', isTriggered: m.atr < 1.2 },
      ],
      VOLATILITY_EXPANSION: [
        { metricName: 'Implied vs Realized Premium', actualValue: m.impliedVolatilityPct - m.realizedVolatilityPct, thresholdCondition: '> 3', isTriggered: (m.impliedVolatilityPct - m.realizedVolatilityPct) > 3 },
        { metricName: 'RVOL', actualValue: m.rvol, thresholdCondition: '> 1.8', isTriggered: m.rvol > 1.8 },
        { metricName: 'VIX Momentum', actualValue: m.vix, thresholdCondition: '> 18', isTriggered: m.vix > 18 },
      ],
      VOLATILITY_CONTRACTION: [
        { metricName: 'Implied vs Realized Premium', actualValue: m.impliedVolatilityPct - m.realizedVolatilityPct, thresholdCondition: '< 0.5', isTriggered: (m.impliedVolatilityPct - m.realizedVolatilityPct) < 0.5 },
        { metricName: 'RVOL', actualValue: m.rvol, thresholdCondition: '< 0.8', isTriggered: m.rvol < 0.8 },
      ],
      GAP_REGIME: [
        { metricName: 'VWAP Displacement', actualValue: Math.abs(m.vwapDisplacementPct), thresholdCondition: '> 2.5', isTriggered: Math.abs(m.vwapDisplacementPct) > 2.5 },
        { metricName: 'RVOL', actualValue: m.rvol, thresholdCondition: '> 2.0', isTriggered: m.rvol > 2.0 },
      ],
      EVENT_DRIVEN: [
        { metricName: 'RVOL', actualValue: m.rvol, thresholdCondition: '> 2.2', isTriggered: m.rvol > 2.2 },
        { metricName: 'Index Dispersion', actualValue: m.indexDispersion, thresholdCondition: '> 1.8', isTriggered: m.indexDispersion > 1.8 },
      ],
      LIQUIDITY_STRESS: [
        { metricName: 'Yield Movement', actualValue: Math.abs(m.yieldMovementBps), thresholdCondition: '> 15', isTriggered: Math.abs(m.yieldMovementBps) > 15 },
        { metricName: 'USD/INR Change', actualValue: Math.abs(m.usdInrChangePct), thresholdCondition: '> 0.6', isTriggered: Math.abs(m.usdInrChangePct) > 0.6 },
        { metricName: 'VIX', actualValue: m.vix, thresholdCondition: '> 25', isTriggered: m.vix > 25 },
      ],
      RISK_OFF: [
        { metricName: 'VIX / India VIX', actualValue: m.vix, thresholdCondition: '> 20', isTriggered: m.vix > 20 },
        { metricName: 'USD/INR change (INR weakening)', actualValue: m.usdInrChangePct, thresholdCondition: '> 0.3', isTriggered: m.usdInrChangePct > 0.3 },
        { metricName: 'Market Breadth', actualValue: m.marketBreadthPct, thresholdCondition: '< 40', isTriggered: m.marketBreadthPct < 40 },
        { metricName: 'Commodity Correlation', actualValue: m.commodityCorrelation, thresholdCondition: '< 0.1', isTriggered: m.commodityCorrelation < 0.1 },
      ],
      RISK_ON: [
        { metricName: 'VIX / India VIX', actualValue: m.vix, thresholdCondition: '< 16', isTriggered: m.vix < 16 },
        { metricName: 'Market Breadth', actualValue: m.marketBreadthPct, thresholdCondition: '> 52', isTriggered: m.marketBreadthPct > 52 },
        { metricName: 'Trend Strength', actualValue: m.trendStrength, thresholdCondition: '> 10', isTriggered: m.trendStrength > 10 },
      ],
    };
  }
}
