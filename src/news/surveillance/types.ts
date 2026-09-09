/**
 * ATHENA — Phase 18 Schema
 * types.ts
 * 
 * Strict TypeScript typings for Phase 18 Autonomous Market Surveillance & Event Detection Engine.
 */

import { UnifiedLifecycleState } from '../intelligence/UnifiedIntelligenceTypes.ts';

export type SurveillanceLifecycle =
  | 'DETECTED'
  | 'CONFIRMED'
  | 'ESCALATED'
  | 'ACTIVE'
  | 'WEAKENING'
  | 'RESOLVED'
  | 'INVALIDATED'
  | 'SUPERSEDED';

export type SurveillanceActionability = 'TRADEABLE' | 'WATCH' | 'CONDITIONAL' | 'NO_TRADE';

export type SurveillancePriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW' | 'P4_INFORMATIONAL';

export interface PriceMetrics {
  lastPrice: number;
  openPrice: number;
  prevClose: number;
  percentageChange: number;
  zScore: number;
  atrNormalizedDisplacement: number;
  vwapDisplacementPct: number;
  isBreakout: boolean;
  isBreakdown: boolean;
  gapPct: number;
}

export interface VolumeMetrics {
  currentVolume: number;
  rollingAverageVolume: number;
  relativeVolume: number; // RVOL
  volumeZScore: number;
  volumePercentile: number;
  volumeAccelerationPct: number;
  priceVolumeConfirmation: boolean;
}

export interface VolatilityMetrics {
  realizedVolPct: number;
  atr: number;
  volPercentile: number;
  volAccelerationPct: number;
  impliedVolPct?: number; // IV where options data exists
  ivRank?: number;
  ivPercentile?: number;
  volRegime: 'VOLATILITY_EXPANSION' | 'VOLATILITY_COMPRESSION' | 'NORMAL';
}

export interface FnoMetrics {
  openInterest: number;
  oiChangePct: number;
  oiChangeVelocity: number;
  futuresBasis: number; // premium/discount
  longShortClassification: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_COVERING' | 'NEUTRAL' | 'CONFLICTED';
  futuresVolumeRatio: number;
}

export interface OptionsMetrics {
  optionVolumeSpikeRatio: number;
  putCallRatio: number;
  skewChangePct: number;
  unusualStrikeConcentration: string;
  ivSpikeAtAtm: boolean;
}

export interface LiquidityMetrics {
  bidAskSpreadPct: number;
  priceImpactScore: number; // 0-100
  liquidityState: 'LIQUIDITY_NORMAL' | 'LIQUIDITY_DETERIORATING' | 'LIQUIDITY_SHOCK';
}

export interface SectorMetrics {
  stockVsSectorReturnPct: number;
  sectorVsIndexReturnPct: number;
  outperformingSector: boolean;
  isSectorLeader: boolean;
}

export interface CrossAssetMetrics {
  usdInrDeltaPct: number;
  crudeDeltaPct: number;
  goldDeltaPct: number;
  correlationStatus: 'CORRELATED' | 'DIVERGENT' | 'POTENTIAL_TRANSMISSION' | 'UNCONFIRMED';
}

export interface ComponentAnomalyScores {
  priceScore: number;
  volumeScore: number;
  oiScore: number;
  volatilityScore: number;
  sectorScore: number;
  newsScore: number;
  finalScore: number; // Composite Anomaly Score (0-100)
}

export interface MarketSurveillanceEvent {
  id: string;
  version: 'v18_market_surveillance_event';
  timestamp: string;
  detectionTimestamp: string;

  symbol: string;
  exchange: string;
  assetClass: 'EQUITY' | 'FNO' | 'COMMODITY' | 'CURRENCY';

  entity: string;
  companyName: string;
  sector: string;
  indices: string[];

  eventType: string; // e.g. 'RVOL_SPIKE', 'PRICE_ANOMALY'
  eventCategory: string; // From MarketSurveillanceEventTypes

  detectionWindow: string; // e.g. '15M', '1H'
  baselineWindow: string; // e.g. '15D', '30D'

  priceMetrics: PriceMetrics;
  volumeMetrics: VolumeMetrics;
  volatilityMetrics: VolatilityMetrics;
  openInterestMetrics?: FnoMetrics;
  liquidityMetrics: LiquidityMetrics;
  optionsMetrics?: OptionsMetrics;
  sectorMetrics?: SectorMetrics;
  crossAssetMetrics?: CrossAssetMetrics;

  anomalyScores: ComponentAnomalyScores;
  transmissionScore: number;

  confidence: number;
  severity: 'NONE' | 'MINOR' | 'MATERIAL' | 'CRITICAL';
  priority: SurveillancePriority;

  catalystStatus: 'NEWS_CONFIRMED' | 'NEWS_POSSIBLE' | 'NEWS_UNRELATED' | 'NO_KNOWN_NEWS';
  newsCorrelation?: {
    recentArticleId: string;
    headline: string;
    similarityScore: number;
  };
  marketConfirmation: 'NEWS_MARKET_CONFIRMATION' | 'NEWS_MARKET_CONTRADICTION' | 'NEWS_WITHOUT_REACTION' | 'PRICE_WITHOUT_NEWS';

  actionability: SurveillanceActionability;

  evidence: string[];
  contradictions: string[];

  historicalAnalogueRef?: {
    sampleSize: number;
    winRate: number;
    medianReturnPct: number;
  };
  lineage: {
    origin: string; // 'MARKET_TICK'
    detectorId: string;
    eventId: string;
  };

  lifecycleState: SurveillanceLifecycle;
}
