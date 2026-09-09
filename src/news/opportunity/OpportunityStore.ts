/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Opportunity Store & Registry
 */

import {
  CanonicalOpportunity,
  OpportunityFilterCriteria,
  PriorityTier,
  ActionRecommendation,
  DecisionState
} from './types';
import { OpportunityDetectionEngine } from './OpportunityDetectionEngine';
import { OpportunityPriorityEngine } from './OpportunityPriorityEngine';

export class OpportunityStore {
  private static instance: OpportunityStore;
  private opportunities: Map<string, CanonicalOpportunity> = new Map();
  private listeners: Array<() => void> = [];

  public static getInstance(): OpportunityStore {
    if (!OpportunityStore.instance) {
      OpportunityStore.instance = new OpportunityStore();
      OpportunityStore.instance.seedInitialOpportunities();
    }
    return OpportunityStore.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Error in OpportunityStore listener', e);
      }
    }
  }

  public registerOpportunity(opp: CanonicalOpportunity): void {
    this.opportunities.set(opp.opportunityId, opp);
    this.notify();
  }

  public getOpportunity(id: string): CanonicalOpportunity | undefined {
    return this.opportunities.get(id);
  }

  public getAllOpportunities(): CanonicalOpportunity[] {
    const list = Array.from(this.opportunities.values());
    return OpportunityPriorityEngine.getInstance().rankOpportunities(list);
  }

  public getOpportunities(): CanonicalOpportunity[] {
    return this.getAllOpportunities();
  }

  public getOpportunitiesBySymbol(symbol: string): CanonicalOpportunity[] {
    const cleanSym = symbol.toUpperCase().replace('.NS', '').replace('.BO', '');
    return this.getAllOpportunities().filter(o => 
      o.instrument.toUpperCase().replace('.NS', '').replace('.BO', '') === cleanSym
    );
  }

  public filterOpportunities(criteria: OpportunityFilterCriteria): CanonicalOpportunity[] {
    let result = this.getAllOpportunities();

    if (criteria.searchQuery) {
      const q = criteria.searchQuery.toLowerCase();
      result = result.filter(o => 
        o.instrument.toLowerCase().includes(q) ||
        o.thesis.toLowerCase().includes(q) ||
        o.catalyst.toLowerCase().includes(q) ||
        o.opportunityType.toLowerCase().includes(q)
      );
    }

    if (criteria.opportunityType && criteria.opportunityType.length > 0) {
      result = result.filter(o => criteria.opportunityType!.includes(o.opportunityType));
    }

    if (criteria.direction && criteria.direction.length > 0) {
      result = result.filter(o => criteria.direction!.includes(o.direction));
    }

    if (criteria.priorityTier && criteria.priorityTier.length > 0) {
      result = result.filter(o => criteria.priorityTier!.includes(o.priorityTier));
    }

    if (criteria.actionRecommendation && criteria.actionRecommendation.length > 0) {
      result = result.filter(o => criteria.actionRecommendation!.includes(o.actionRecommendation));
    }

    if (criteria.decisionState && criteria.decisionState.length > 0) {
      result = result.filter(o => criteria.decisionState!.includes(o.decisionState));
    }

    if (criteria.minConfidence !== undefined) {
      result = result.filter(o => o.confidenceScore >= criteria.minConfidence!);
    }

    if (criteria.minEvidenceQuality !== undefined) {
      result = result.filter(o => o.evidenceQualityScore >= criteria.minEvidenceQuality!);
    }

    if (criteria.executionEligibility && criteria.executionEligibility.length > 0) {
      result = result.filter(o => criteria.executionEligibility!.includes(o.executionEligibility.status));
    }

    return result;
  }

  public clear(): void {
    this.opportunities.clear();
    this.notify();
  }

  /**
   * Seeds realistic Indian market opportunities verified across previous phases
   */
  public seedInitialOpportunities(): void {
    const detectionEngine = OpportunityDetectionEngine.getInstance();

    // 1. RELIANCE - High conviction Breakout / P0
    const relianceOpp = detectionEngine.detectOpportunity({
      symbol: 'RELIANCE',
      direction: 'LONG',
      opportunityType: 'BREAKOUT',
      thesis: 'Clean multi-month resistance breakout at ₹2,980 with institutional delivery surge and telecom ARPU upgrade',
      catalyst: 'Jio ARPU hike guidance & green energy commissioning filing',
      currentPrice: 3012.50,
      breakoutLevel: 2980.00,
      targetPrice: 3180.00,
      stopLossPrice: 2950.00,
      evidenceIds: ['EV_REL_FILING_ARPU_2026', 'EV_REL_NSE_TICK_L2'],
      provenanceRootId: 'PROV_REL_BREAKOUT_2026',
      evidenceQualityScore: 92,
      evidenceFreshnessScore: 95,
      currentRegime: 'TRENDING_BULLISH',
      marketSession: 'REGULAR_SESSION',
      priceMetrics: { changePct: 2.15, vwapDiffPct: 1.1, isBreakout: true },
      volumeMetrics: { volumeRatio: 2.8, deliveryPct: 58 },
      oiMetrics: { oiChangePct: 14.2, buildUpType: 'LONG_BUILDUP' },
      ivMetrics: { ivPercentile: 38, skew: 2.1 },
      breadthMetrics: { advanceDeclineRatio: 1.85 },
      sectorMetrics: { sectorChangePct: 1.6, sectorRelativeStrength: 1.35, sectorName: 'Energy' },
      indexMetrics: { indexChangePct: 0.95, isIndexAligned: true },
      macroMetrics: { macroAlignmentScore: 82, inrYieldStability: true },
      newsMetrics: { hasP0orP1Evidence: true, authorityScore: 95 },
      fundamentalMetrics: { earningsGrowthPct: 16.4, valuationScore: 78 }
    });
    this.opportunities.set(relianceOpp.opportunityId, relianceOpp);

    // 2. HDFCBANK - Derivative Flow & FII Inflow
    const hdfcOpp = detectionEngine.detectOpportunity({
      symbol: 'HDFCBANK',
      direction: 'LONG',
      opportunityType: 'DERIVATIVE_FLOW',
      thesis: 'Aggressive institutional call buying and futures OI build-up post credit deposit ratio normalization',
      catalyst: 'RBI quarterly supervisory update & institutional block accumulation',
      currentPrice: 1742.00,
      breakoutLevel: 1720.00,
      targetPrice: 1820.00,
      stopLossPrice: 1695.00,
      evidenceIds: ['EV_HDFC_NSE_BLOCK_2026', 'EV_HDFC_RBI_CDR_2026'],
      provenanceRootId: 'PROV_HDFC_FLOW_2026',
      evidenceQualityScore: 88,
      evidenceFreshnessScore: 90,
      currentRegime: 'TRENDING_BULLISH',
      priceMetrics: { changePct: 1.45, vwapDiffPct: 0.8, isBreakout: true },
      volumeMetrics: { volumeRatio: 2.2, deliveryPct: 62 },
      oiMetrics: { oiChangePct: 18.5, buildUpType: 'LONG_BUILDUP' },
      ivMetrics: { ivPercentile: 45, skew: 1.8 },
      breadthMetrics: { advanceDeclineRatio: 1.6 },
      sectorMetrics: { sectorChangePct: 1.4, sectorRelativeStrength: 1.25, sectorName: 'Banking' },
      indexMetrics: { indexChangePct: 0.95, isIndexAligned: true },
      macroMetrics: { macroAlignmentScore: 85, inrYieldStability: true },
      newsMetrics: { hasP0orP1Evidence: true, authorityScore: 90 },
      fundamentalMetrics: { earningsGrowthPct: 18.2, valuationScore: 82 }
    });
    this.opportunities.set(hdfcOpp.opportunityId, hdfcOpp);

    // 3. TATAMOTORS - Breakdown Candidate (Short)
    const tataOpp = detectionEngine.detectOpportunity({
      symbol: 'TATAMOTORS',
      direction: 'SHORT',
      opportunityType: 'BREAKDOWN',
      thesis: 'JLR global delivery deceleration and breach of key 200 EMA support at ₹920',
      catalyst: 'Monthly wholesale dispatch miss in UK/EU markets',
      currentPrice: 894.20,
      breakoutLevel: 920.00,
      targetPrice: 840.00,
      stopLossPrice: 928.00,
      evidenceIds: ['EV_TATAMOTORS_DISPATCH_2026', 'EV_TATAMOTORS_L2_TICK'],
      provenanceRootId: 'PROV_TATA_BREAKDOWN_2026',
      evidenceQualityScore: 86,
      evidenceFreshnessScore: 88,
      currentRegime: 'HIGH_VOLATILITY',
      priceMetrics: { changePct: -2.8, vwapDiffPct: -1.4, isBreakout: true },
      volumeMetrics: { volumeRatio: 2.4, deliveryPct: 52 },
      oiMetrics: { oiChangePct: 12.0, buildUpType: 'SHORT_BUILDUP' },
      ivMetrics: { ivPercentile: 65, skew: 2.4 },
      breadthMetrics: { advanceDeclineRatio: 0.75 },
      sectorMetrics: { sectorChangePct: -1.2, sectorRelativeStrength: -1.4, sectorName: 'Auto' },
      indexMetrics: { indexChangePct: -0.4, isIndexAligned: true },
      macroMetrics: { macroAlignmentScore: 68, inrYieldStability: true },
      newsMetrics: { hasP0orP1Evidence: true, authorityScore: 88 },
      fundamentalMetrics: { earningsGrowthPct: -8.0, valuationScore: 60 }
    });
    this.opportunities.set(tataOpp.opportunityId, tataOpp);

    // 4. TCS - Mean Reversion Watchlist item
    const tcsOpp = detectionEngine.detectOpportunity({
      symbol: 'TCS',
      direction: 'LONG',
      opportunityType: 'MEAN_REVERSION',
      thesis: 'Oversold RSI at 28 with heavy buyer support at key 200-week trendline and constant-currency deal pipeline win',
      catalyst: 'Tier-1 European bank mega-deal expansion disclosure',
      currentPrice: 3890.00,
      breakoutLevel: 3850.00,
      targetPrice: 4050.00,
      stopLossPrice: 3820.00,
      evidenceIds: ['EV_TCS_DEAL_FILING_2026'],
      provenanceRootId: 'PROV_TCS_REVERSION_2026',
      evidenceQualityScore: 82,
      evidenceFreshnessScore: 85,
      currentRegime: 'RANGE_BOUND',
      priceMetrics: { changePct: 0.65, vwapDiffPct: 0.2, isBreakout: false },
      volumeMetrics: { volumeRatio: 1.4, deliveryPct: 60 },
      oiMetrics: { oiChangePct: 6.5, buildUpType: 'SHORT_COVERING' },
      ivMetrics: { ivPercentile: 32, skew: 1.2 },
      breadthMetrics: { advanceDeclineRatio: 1.1 },
      sectorMetrics: { sectorChangePct: 0.4, sectorRelativeStrength: 0.6, sectorName: 'IT' },
      indexMetrics: { indexChangePct: 0.3, isIndexAligned: true },
      macroMetrics: { macroAlignmentScore: 75, inrYieldStability: true },
      newsMetrics: { hasP0orP1Evidence: true, authorityScore: 85 },
      fundamentalMetrics: { earningsGrowthPct: 11.5, valuationScore: 74 }
    });
    this.opportunities.set(tcsOpp.opportunityId, tcsOpp);
  }
}
