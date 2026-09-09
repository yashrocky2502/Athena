/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Multi-Source Independent Confirmation Engine
 */

import {
  ConfirmationDimension,
  ConfirmationStatus,
  DimensionConfirmationResult,
  MultiSourceConfirmationResult,
  OpportunityDirection,
  OpportunityType
} from './types';

export class OpportunityConfirmationEngine {
  private static instance: OpportunityConfirmationEngine;

  public static getInstance(): OpportunityConfirmationEngine {
    if (!OpportunityConfirmationEngine.instance) {
      OpportunityConfirmationEngine.instance = new OpportunityConfirmationEngine();
    }
    return OpportunityConfirmationEngine.instance;
  }

  /**
   * Evaluates confirmation across 10 independent market dimensions
   */
  public evaluateMultiSourceConfirmation(params: {
    symbol: string;
    direction: OpportunityDirection;
    type: OpportunityType;
    priceMetrics?: { changePct: number; vwapDiffPct: number; isBreakout: boolean };
    volumeMetrics?: { volumeRatio: number; deliveryPct: number };
    oiMetrics?: { oiChangePct: number; buildUpType: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'SHORT_COVERING' | 'LONG_UNWINDING' | 'NEUTRAL' };
    ivMetrics?: { ivPercentile: number; skew: number };
    breadthMetrics?: { advanceDeclineRatio: number };
    sectorMetrics?: { sectorChangePct: number; sectorRelativeStrength: number };
    indexMetrics?: { indexChangePct: number; isIndexAligned: boolean };
    macroMetrics?: { macroAlignmentScore: number; inrYieldStability: boolean };
    newsMetrics?: { hasP0orP1Evidence: boolean; authorityScore: number };
    fundamentalMetrics?: { earningsGrowthPct?: number; valuationScore?: number };
  }): MultiSourceConfirmationResult {
    const isLong = params.direction === 'LONG';
    const isShort = params.direction === 'SHORT';

    const dimensionResults: Record<ConfirmationDimension, DimensionConfirmationResult> = {
      PRICE: this.evaluatePriceDimension(params.direction, params.priceMetrics),
      VOLUME: this.evaluateVolumeDimension(params.volumeMetrics),
      OPEN_INTEREST: this.evaluateOIDimension(params.direction, params.oiMetrics),
      IV: this.evaluateIVDimension(params.type, params.ivMetrics),
      BREADTH: this.evaluateBreadthDimension(params.direction, params.breadthMetrics),
      SECTOR: this.evaluateSectorDimension(params.direction, params.sectorMetrics),
      INDEX: this.evaluateIndexDimension(params.direction, params.indexMetrics),
      MACRO: this.evaluateMacroDimension(params.direction, params.macroMetrics),
      NEWS: this.evaluateNewsDimension(params.newsMetrics),
      FUNDAMENTALS: this.evaluateFundamentalDimension(params.direction, params.fundamentalMetrics)
    };

    let totalWeightedScore = 0;
    let totalWeight = 0;
    let independentDimensionCount = 0;
    let confirmingDimensionCount = 0;
    let contradictingDimensionCount = 0;
    let hasCriticalContradiction = false;
    let criticalReason = '';

    const dimensions = Object.keys(dimensionResults) as ConfirmationDimension[];

    for (const dim of dimensions) {
      const result = dimensionResults[dim];
      totalWeightedScore += result.score * result.weight;
      totalWeight += result.weight;

      if (result.isIndependentSource) {
        independentDimensionCount++;
      }

      if (result.status === 'CONFIRMED' || result.status === 'STRONGLY_CONFIRMED') {
        confirmingDimensionCount++;
      } else if (result.status === 'CONTRADICTED' || result.status === 'CRITICALLY_CONTRADICTED') {
        contradictingDimensionCount++;
        if (result.status === 'CRITICALLY_CONTRADICTED') {
          hasCriticalContradiction = true;
          criticalReason = `${dim} critically contradicts ${params.direction} thesis: ${result.details}`;
        }
      }
    }

    const rawScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 50;
    
    // Penalize score if contradictions exist
    const contradictionPenalty = contradictingDimensionCount * 18;
    const finalConfirmationScore = Math.max(0, Math.min(100, rawScore - contradictionPenalty));

    let overallStatus: ConfirmationStatus = 'UNCONFIRMED';
    if (hasCriticalContradiction) {
      overallStatus = 'CRITICALLY_CONTRADICTED';
    } else if (contradictingDimensionCount >= 2 || finalConfirmationScore < 30) {
      overallStatus = 'CONTRADICTED';
    } else if (confirmingDimensionCount >= 4 && finalConfirmationScore >= 75) {
      overallStatus = 'STRONGLY_CONFIRMED';
    } else if (confirmingDimensionCount >= 3 && finalConfirmationScore >= 60) {
      overallStatus = 'CONFIRMED';
    } else if (confirmingDimensionCount >= 2 && finalConfirmationScore >= 40) {
      overallStatus = 'PARTIALLY_CONFIRMED';
    } else {
      overallStatus = 'UNCONFIRMED';
    }

    return {
      overallStatus,
      confirmationScore: finalConfirmationScore,
      dimensionResults,
      independentDimensionCount,
      confirmingDimensionCount,
      contradictingDimensionCount,
      isStronglyConfirmed: overallStatus === 'STRONGLY_CONFIRMED',
      isContradicted: overallStatus === 'CONTRADICTED' || overallStatus === 'CRITICALLY_CONTRADICTED',
      criticalContradictionReason: hasCriticalContradiction ? criticalReason : undefined
    };
  }

  private evaluatePriceDimension(direction: OpportunityDirection, metrics?: { changePct: number; vwapDiffPct: number; isBreakout: boolean }): DimensionConfirmationResult {
    if (!metrics) {
      return {
        dimension: 'PRICE',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.18,
        isIndependentSource: true,
        sourceId: 'NSE_L1_TICK',
        metricLabel: 'Price Delta & VWAP Alignment',
        metricValue: 'N/A',
        threshold: 'Aligned with direction'
      };
    }

    const isLong = direction === 'LONG';
    const aligned = isLong ? (metrics.changePct > 0.3 && metrics.vwapDiffPct >= 0) : (metrics.changePct < -0.3 && metrics.vwapDiffPct <= 0);
    const stronglyAligned = aligned && metrics.isBreakout;
    const opposite = isLong ? (metrics.changePct < -0.8) : (metrics.changePct > 0.8);

    if (opposite) {
      return {
        dimension: 'PRICE',
        status: 'CONTRADICTED',
        score: 15,
        weight: 0.18,
        isIndependentSource: true,
        sourceId: 'NSE_L1_TICK',
        metricLabel: 'Price Delta',
        metricValue: `${metrics.changePct}%`,
        threshold: isLong ? '> 0%' : '< 0%',
        contradictionDetected: true,
        details: `Price is moving strongly opposite to thesis (${metrics.changePct}%)`
      };
    }

    return {
      dimension: 'PRICE',
      status: stronglyAligned ? 'STRONGLY_CONFIRMED' : aligned ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: stronglyAligned ? 95 : aligned ? 80 : 55,
      weight: 0.18,
      isIndependentSource: true,
      sourceId: 'NSE_L1_TICK',
      metricLabel: 'Price Delta & VWAP',
      metricValue: `${metrics.changePct}% (VWAP diff: ${metrics.vwapDiffPct}%)`,
      threshold: 'Aligned with direction'
    };
  }

  private evaluateVolumeDimension(metrics?: { volumeRatio: number; deliveryPct: number }): DimensionConfirmationResult {
    if (!metrics) {
      return {
        dimension: 'VOLUME',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.14,
        isIndependentSource: true,
        sourceId: 'NSE_L2_VOLUME',
        metricLabel: 'Volume Surge Ratio',
        metricValue: 'N/A',
        threshold: '> 1.5x 20-day SMA'
      };
    }

    const isHighVolume = metrics.volumeRatio >= 2.0;
    const isGoodVolume = metrics.volumeRatio >= 1.25;
    const isDryVolume = metrics.volumeRatio < 0.6;

    if (isDryVolume) {
      return {
        dimension: 'VOLUME',
        status: 'CONTRADICTED',
        score: 25,
        weight: 0.14,
        isIndependentSource: true,
        sourceId: 'NSE_L2_VOLUME',
        metricLabel: 'Volume Ratio',
        metricValue: `${metrics.volumeRatio.toFixed(2)}x`,
        threshold: '> 1.25x',
        contradictionDetected: true,
        details: `Subdued volume (${metrics.volumeRatio.toFixed(2)}x) fails to validate move`
      };
    }

    return {
      dimension: 'VOLUME',
      status: isHighVolume ? 'STRONGLY_CONFIRMED' : isGoodVolume ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: isHighVolume ? 92 : isGoodVolume ? 78 : 55,
      weight: 0.14,
      isIndependentSource: true,
      sourceId: 'NSE_L2_VOLUME',
      metricLabel: 'Volume Ratio / Delivery',
      metricValue: `${metrics.volumeRatio.toFixed(2)}x (Delivery: ${metrics.deliveryPct}%)`,
      threshold: '> 1.25x'
    };
  }

  private evaluateOIDimension(direction: OpportunityDirection, metrics?: { oiChangePct: number; buildUpType: string }): DimensionConfirmationResult {
    if (!metrics) {
      return {
        dimension: 'OPEN_INTEREST',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.12,
        isIndependentSource: true,
        sourceId: 'NSE_DERIVATIVES_FEED',
        metricLabel: 'F&O OI Buildup',
        metricValue: 'N/A',
        threshold: 'Long Buildup / Short Buildup'
      };
    }

    const isLong = direction === 'LONG';
    const isConfirmed = isLong ? (metrics.buildUpType === 'LONG_BUILDUP' || metrics.buildUpType === 'SHORT_COVERING')
                               : (metrics.buildUpType === 'SHORT_BUILDUP' || metrics.buildUpType === 'LONG_UNWINDING');
    const isContradicted = isLong ? (metrics.buildUpType === 'SHORT_BUILDUP' && metrics.oiChangePct > 5)
                                  : (metrics.buildUpType === 'LONG_BUILDUP' && metrics.oiChangePct > 5);

    if (isContradicted) {
      return {
        dimension: 'OPEN_INTEREST',
        status: 'CONTRADICTED',
        score: 20,
        weight: 0.12,
        isIndependentSource: true,
        sourceId: 'NSE_DERIVATIVES_FEED',
        metricLabel: 'OI Buildup Type',
        metricValue: `${metrics.buildUpType} (+${metrics.oiChangePct}%)`,
        threshold: isLong ? 'Long Buildup' : 'Short Buildup',
        contradictionDetected: true,
        details: `Derivatives positioning contradicts spot thesis (${metrics.buildUpType})`
      };
    }

    return {
      dimension: 'OPEN_INTEREST',
      status: isConfirmed ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: isConfirmed ? 85 : 55,
      weight: 0.12,
      isIndependentSource: true,
      sourceId: 'NSE_DERIVATIVES_FEED',
      metricLabel: 'OI Buildup',
      metricValue: `${metrics.buildUpType} (${metrics.oiChangePct > 0 ? '+' : ''}${metrics.oiChangePct}%)`,
      threshold: 'Directional buildup'
    };
  }

  private evaluateIVDimension(type: OpportunityType, metrics?: { ivPercentile: number; skew: number }): DimensionConfirmationResult {
    if (!metrics) {
      return {
        dimension: 'IV',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.08,
        isIndependentSource: true,
        sourceId: 'NSE_OPTIONS_SURFACE',
        metricLabel: 'IV Percentile & Skew',
        metricValue: 'N/A',
        threshold: 'Regime alignment'
      };
    }

    const isVolOpportunity = type === 'VOLATILITY' || type === 'EARNINGS' || type === 'EVENT_DRIVEN';
    const ivAligned = isVolOpportunity ? metrics.ivPercentile >= 40 : metrics.ivPercentile <= 75;

    return {
      dimension: 'IV',
      status: ivAligned ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: ivAligned ? 80 : 50,
      weight: 0.08,
      isIndependentSource: true,
      sourceId: 'NSE_OPTIONS_SURFACE',
      metricLabel: 'IV Percentile',
      metricValue: `${metrics.ivPercentile}th percentile`,
      threshold: isVolOpportunity ? '> 40%' : '< 75%'
    };
  }

  private evaluateBreadthDimension(direction: OpportunityDirection, metrics?: { advanceDeclineRatio: number }): DimensionConfirmationResult {
    if (!metrics) {
      return {
        dimension: 'BREADTH',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.08,
        isIndependentSource: true,
        sourceId: 'NSE_MARKET_BREADTH',
        metricLabel: 'Advance / Decline Ratio',
        metricValue: 'N/A',
        threshold: '> 1.0 (Long) / < 1.0 (Short)'
      };
    }

    const isLong = direction === 'LONG';
    const breadthBullish = metrics.advanceDeclineRatio >= 1.3;
    const breadthBearish = metrics.advanceDeclineRatio <= 0.7;
    const isAligned = isLong ? breadthBullish : breadthBearish;
    const isOpposite = isLong ? breadthBearish : breadthBullish;

    return {
      dimension: 'BREADTH',
      status: isOpposite ? 'CONTRADICTED' : isAligned ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: isOpposite ? 30 : isAligned ? 85 : 55,
      weight: 0.08,
      isIndependentSource: true,
      sourceId: 'NSE_MARKET_BREADTH',
      metricLabel: 'A/D Ratio',
      metricValue: metrics.advanceDeclineRatio.toFixed(2),
      threshold: isLong ? '>= 1.3' : '<= 0.7',
      contradictionDetected: isOpposite,
      details: isOpposite ? `Market breadth (${metrics.advanceDeclineRatio.toFixed(2)}) is against thesis` : undefined
    };
  }

  private evaluateSectorDimension(direction: OpportunityDirection, metrics?: { sectorChangePct: number; sectorRelativeStrength: number }): DimensionConfirmationResult {
    if (!metrics) {
      return {
        dimension: 'SECTOR',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.12,
        isIndependentSource: true,
        sourceId: 'NSE_SECTORAL_INDEX',
        metricLabel: 'Sector Index Momentum',
        metricValue: 'N/A',
        threshold: 'Sector tailwind'
      };
    }

    const isLong = direction === 'LONG';
    const sectorAligned = isLong ? (metrics.sectorChangePct > 0.4 && metrics.sectorRelativeStrength > 0)
                                 : (metrics.sectorChangePct < -0.4 && metrics.sectorRelativeStrength < 0);
    const sectorOpposite = isLong ? (metrics.sectorChangePct < -1.0) : (metrics.sectorChangePct > 1.0);

    if (sectorOpposite) {
      return {
        dimension: 'SECTOR',
        status: 'CONTRADICTED',
        score: 20,
        weight: 0.12,
        isIndependentSource: true,
        sourceId: 'NSE_SECTORAL_INDEX',
        metricLabel: 'Sector Delta',
        metricValue: `${metrics.sectorChangePct}%`,
        threshold: isLong ? '> 0%' : '< 0%',
        contradictionDetected: true,
        details: `Underlying sector is moving opposite (${metrics.sectorChangePct}%)`
      };
    }

    return {
      dimension: 'SECTOR',
      status: sectorAligned ? 'STRONGLY_CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: sectorAligned ? 88 : 55,
      weight: 0.12,
      isIndependentSource: true,
      sourceId: 'NSE_SECTORAL_INDEX',
      metricLabel: 'Sector Delta / RS',
      metricValue: `${metrics.sectorChangePct}% (RS: ${metrics.sectorRelativeStrength.toFixed(2)})`,
      threshold: 'Sector tailwind'
    };
  }

  private evaluateIndexDimension(direction: OpportunityDirection, metrics?: { indexChangePct: number; isIndexAligned: boolean }): DimensionConfirmationResult {
    if (!metrics) {
      return {
        dimension: 'INDEX',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.08,
        isIndependentSource: true,
        sourceId: 'NSE_NIFTY_BENCHMARK',
        metricLabel: 'Benchmark Nifty Alignment',
        metricValue: 'N/A',
        threshold: 'Benchmark direction'
      };
    }

    return {
      dimension: 'INDEX',
      status: metrics.isIndexAligned ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: metrics.isIndexAligned ? 82 : 50,
      weight: 0.08,
      isIndependentSource: true,
      sourceId: 'NSE_NIFTY_BENCHMARK',
      metricLabel: 'Benchmark Nifty Delta',
      metricValue: `${metrics.indexChangePct}%`,
      threshold: 'Aligned with benchmark'
    };
  }

  private evaluateMacroDimension(direction: OpportunityDirection, metrics?: { macroAlignmentScore: number; inrYieldStability: boolean }): DimensionConfirmationResult {
    if (!metrics) {
      return {
        dimension: 'MACRO',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.06,
        isIndependentSource: true,
        sourceId: 'RBI_MACRO_RESERVE',
        metricLabel: 'Macro Alignment Score',
        metricValue: 'N/A',
        threshold: 'Macro stability'
      };
    }

    return {
      dimension: 'MACRO',
      status: metrics.macroAlignmentScore >= 70 ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: metrics.macroAlignmentScore,
      weight: 0.06,
      isIndependentSource: true,
      sourceId: 'RBI_MACRO_RESERVE',
      metricLabel: 'Macro Score',
      metricValue: `${metrics.macroAlignmentScore}/100`,
      threshold: '>= 70'
    };
  }

  private evaluateNewsDimension(metrics?: { hasP0orP1Evidence: boolean; authorityScore: number }): DimensionConfirmationResult {
    if (!metrics) {
      return {
        dimension: 'NEWS',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.10,
        isIndependentSource: true,
        sourceId: 'ATHENA_P0_EVIDENCE_STORE',
        metricLabel: 'P0/P1 Official Disclosure',
        metricValue: 'N/A',
        threshold: 'Official filing present'
      };
    }

    return {
      dimension: 'NEWS',
      status: metrics.hasP0orP1Evidence ? 'STRONGLY_CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: metrics.hasP0orP1Evidence ? Math.max(85, metrics.authorityScore) : 50,
      weight: 0.10,
      isIndependentSource: true,
      sourceId: 'ATHENA_P0_EVIDENCE_STORE',
      metricLabel: 'Evidence Authority Score',
      metricValue: `${metrics.authorityScore}/100`,
      threshold: '>= 80 (P0/P1 Tier)'
    };
  }

  private evaluateFundamentalDimension(direction: OpportunityDirection, metrics?: { earningsGrowthPct?: number; valuationScore?: number }): DimensionConfirmationResult {
    if (!metrics || metrics.earningsGrowthPct === undefined) {
      return {
        dimension: 'FUNDAMENTALS',
        status: 'UNCONFIRMED',
        score: 50,
        weight: 0.04,
        isIndependentSource: true,
        sourceId: 'CORPORATE_DISCLOSURE_ENGINE',
        metricLabel: 'Earnings / Balance Sheet Health',
        metricValue: 'N/A',
        threshold: 'Positive growth'
      };
    }

    const isLong = direction === 'LONG';
    const isGrowth = metrics.earningsGrowthPct > 10;
    const isDecline = metrics.earningsGrowthPct < -15;

    if (isLong && isDecline) {
      return {
        dimension: 'FUNDAMENTALS',
        status: 'CONTRADICTED',
        score: 30,
        weight: 0.04,
        isIndependentSource: true,
        sourceId: 'CORPORATE_DISCLOSURE_ENGINE',
        metricLabel: 'Earnings YoY',
        metricValue: `${metrics.earningsGrowthPct}%`,
        threshold: '> 0%',
        contradictionDetected: true,
        details: `Deteriorating earnings (${metrics.earningsGrowthPct}%)`
      };
    }

    return {
      dimension: 'FUNDAMENTALS',
      status: isGrowth ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED',
      score: isGrowth ? 80 : 60,
      weight: 0.04,
      isIndependentSource: true,
      sourceId: 'CORPORATE_DISCLOSURE_ENGINE',
      metricLabel: 'Earnings Growth YoY',
      metricValue: `${metrics.earningsGrowthPct}%`,
      threshold: '> 10%'
    };
  }
}
