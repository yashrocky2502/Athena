/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Multi-Factor Deterministic Opportunity Detection Engine
 */

import {
  CanonicalOpportunity,
  OpportunityDirection,
  OpportunityType,
  InstrumentType,
  ExchangeId
} from './types';
import { OpportunityConfirmationEngine } from './OpportunityConfirmationEngine';
import { OpportunityContradictionEngine } from './OpportunityContradictionEngine';
import { OpportunityHistoricalAnalogueEngine } from './OpportunityHistoricalAnalogueEngine';
import { OpportunityRegimeCompatibilityEngine } from './OpportunityRegimeCompatibilityEngine';
import { OpportunityExpectedValueEngine } from './OpportunityExpectedValueEngine';
import { OpportunityScoringEngine } from './OpportunityScoringEngine';
import { OpportunityPriorityEngine } from './OpportunityPriorityEngine';
import { PortfolioDecisionFilter } from './PortfolioDecisionFilter';
import { OpportunityExecutionBridge } from './OpportunityExecutionBridge';
import { OpportunityDecisionEngine } from './OpportunityDecisionEngine';
import { CausalChainEngine } from './CausalChainEngine';
import { OpportunityLifecycleEngine } from './OpportunityLifecycleEngine';

export interface OpportunityCandidateInput {
  symbol: string;
  instrumentType?: InstrumentType;
  exchange?: ExchangeId;
  direction: OpportunityDirection;
  opportunityType: OpportunityType;
  thesis: string;
  catalyst: string;
  currentPrice: number;
  breakoutLevel?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  evidenceIds: string[];
  provenanceRootId?: string;
  evidenceQualityScore?: number;
  evidenceFreshnessScore?: number;
  evidenceAgeMs?: number;
  currentRegime?: string;
  marketSession?: string;
  priceMetrics?: { changePct: number; vwapDiffPct: number; isBreakout: boolean };
  volumeMetrics?: { volumeRatio: number; deliveryPct: number };
  oiMetrics?: { oiChangePct: number; buildUpType: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'SHORT_COVERING' | 'LONG_UNWINDING' | 'NEUTRAL' };
  ivMetrics?: { ivPercentile: number; skew: number };
  breadthMetrics?: { advanceDeclineRatio: number };
  sectorMetrics?: { sectorChangePct: number; sectorRelativeStrength: number; sectorName?: string };
  indexMetrics?: { indexChangePct: number; isIndexAligned: boolean };
  macroMetrics?: { macroAlignmentScore: number; inrYieldStability: boolean };
  newsMetrics?: { hasP0orP1Evidence: boolean; authorityScore: number };
  fundamentalMetrics?: { earningsGrowthPct?: number; valuationScore?: number };
  surveillanceAnomalies?: string[];
  expectedNotional?: number;
  timestamp?: string;
  expiresInMs?: number;
}

export class OpportunityDetectionEngine {
  private static instance: OpportunityDetectionEngine;

  public static getInstance(): OpportunityDetectionEngine {
    if (!OpportunityDetectionEngine.instance) {
      OpportunityDetectionEngine.instance = new OpportunityDetectionEngine();
    }
    return OpportunityDetectionEngine.instance;
  }

  /**
   * Deterministically processes market candidate inputs and synthesizes a CanonicalOpportunity
   */
  public detectOpportunity(input: OpportunityCandidateInput): CanonicalOpportunity {
    const timestamp = input.timestamp || new Date().toISOString();
    const opportunityId = `OPP_${input.symbol}_${input.opportunityType}_${Date.now()}`;
    const provenanceRoot = input.provenanceRootId || `PROV_ROOT_${opportunityId}`;
    const evidenceQuality = input.evidenceQualityScore ?? 85;
    const evidenceFreshness = input.evidenceFreshnessScore ?? 90;
    const regime = input.currentRegime || 'TRENDING_BULLISH';
    const expiresAt = new Date(new Date(timestamp).getTime() + (input.expiresInMs || 86400000)).toISOString();

    // 1. Multi-Source Confirmation Engine
    const confirmationEngine = OpportunityConfirmationEngine.getInstance();
    const confirmation = confirmationEngine.evaluateMultiSourceConfirmation({
      symbol: input.symbol,
      direction: input.direction,
      type: input.opportunityType,
      priceMetrics: input.priceMetrics,
      volumeMetrics: input.volumeMetrics,
      oiMetrics: input.oiMetrics,
      ivMetrics: input.ivMetrics,
      breadthMetrics: input.breadthMetrics,
      sectorMetrics: input.sectorMetrics,
      indexMetrics: input.indexMetrics,
      macroMetrics: input.macroMetrics,
      newsMetrics: input.newsMetrics,
      fundamentalMetrics: input.fundamentalMetrics
    });

    // 2. Contradiction & Invalidation Engine
    const contradictionEngine = OpportunityContradictionEngine.getInstance();
    const contradictionEval = contradictionEngine.evaluateContradictions({
      symbol: input.symbol,
      direction: input.direction,
      type: input.opportunityType,
      currentPrice: input.currentPrice,
      breakoutLevel: input.breakoutLevel,
      confirmation,
      evidenceFreshnessScore: evidenceFreshness,
      hasP0Evidence: input.evidenceIds.length > 0,
      evidenceAgeMs: input.evidenceAgeMs || 10000,
      surveillanceAnomalies: input.surveillanceAnomalies,
      marketSession: input.marketSession
    });

    // 3. Historical Analogue Engine
    const analogueEngine = OpportunityHistoricalAnalogueEngine.getInstance();
    const historicalAnalogue = analogueEngine.findHistoricalAnalogues({
      symbol: input.symbol,
      opportunityType: input.opportunityType,
      direction: input.direction,
      currentRegime: regime,
      catalystType: input.catalyst,
      asOfTimestamp: timestamp
    });

    // 4. Regime Compatibility Engine
    const regimeEngine = OpportunityRegimeCompatibilityEngine.getInstance();
    const regimeCompatibility = regimeEngine.evaluateRegimeCompatibility(input.opportunityType, regime);

    // 5. Expected Value & Risk/Reward Engine
    const evEngine = OpportunityExpectedValueEngine.getInstance();
    const evResult = evEngine.calculateExpectedValue({
      symbol: input.symbol,
      analogueResult: historicalAnalogue,
      confirmation,
      regimeResult: regimeCompatibility,
      currentPrice: input.currentPrice,
      targetPrice: input.targetPrice,
      stopLossPrice: input.stopLossPrice,
      liquidityScore: 88
    });

    // 6. Portfolio Review Filter
    const portfolioFilter = PortfolioDecisionFilter.getInstance();
    const portfolioReview = portfolioFilter.reviewOpportunityAgainstPortfolio({
      symbol: input.symbol,
      sector: input.sectorMetrics?.sectorName || 'General',
      direction: input.direction,
      expectedNotional: input.expectedNotional || 250000
    });

    // 7. Opportunity Scoring Engine (Mathematical Decomposition)
    const scoringEngine = OpportunityScoringEngine.getInstance();
    const scoreResult = scoringEngine.computeOpportunityScore({
      evidenceQualityScore: evidenceQuality,
      evidenceFreshnessScore: evidenceFreshness,
      confirmation,
      historicalAnalogue,
      regimeCompatibility,
      expectedValueResult: evResult,
      liquidityScore: 88,
      contradictionScore: contradictionEval.contradictionScore,
      riskScore: 20
    });

    // 8. Construct Causal Chain
    const causalEngine = CausalChainEngine.getInstance();
    const causalChain = causalEngine.constructCausalChain({
      opportunityId,
      symbol: input.symbol,
      direction: input.direction,
      type: input.opportunityType,
      catalyst: input.catalyst,
      evidenceIds: input.evidenceIds,
      provenanceRootId: provenanceRoot,
      timestamp,
      marketReactionSummary: input.priceMetrics ? `Price moved ${input.priceMetrics.changePct}% with VWAP diff ${input.priceMetrics.vwapDiffPct}%` : undefined,
      sectorRS: input.sectorMetrics?.sectorRelativeStrength,
      oiBuildup: input.oiMetrics?.buildUpType,
      analogueCount: historicalAnalogue.analogueCount,
      riskGatePassed: portfolioReview.status !== 'PORTFOLIO_BLOCKED',
      executionEligible: false
    });

    // 9. Initial Opportunity Structure
    const opp: CanonicalOpportunity = {
      opportunityId,
      timestamp,
      marketSession: input.marketSession || 'REGULAR_SESSION',
      instrument: input.symbol,
      instrumentType: input.instrumentType || 'EQUITY',
      exchange: input.exchange || 'NSE',
      direction: input.direction,
      opportunityType: input.opportunityType,
      thesis: input.thesis,
      catalyst: input.catalyst,
      marketImpact: scoreResult.finalScore >= 80 ? 'HIGH' : 'MEDIUM',
      evidenceIds: input.evidenceIds,
      provenanceRootId: provenanceRoot,
      evidenceQualityScore: evidenceQuality,
      evidenceFreshnessScore: evidenceFreshness,
      confidenceScore: scoreResult.confidenceScore,
      confirmationScore: confirmation.confirmationScore,
      contradictionScore: contradictionEval.contradictionScore,
      historicalAnalogueScore: historicalAnalogue.qualityScore,
      regimeCompatibilityScore: regimeCompatibility.compatibilityScore,
      liquidityScore: 88,
      riskScore: 20,
      expectedValue: evResult.expectedValuePct,
      riskReward: evResult.riskRewardRatio,
      mathematicalDecomposition: scoreResult.decomposition,
      confirmationBreakdown: confirmation,
      historicalAnalogueBreakdown: historicalAnalogue,
      regimeCompatibilityBreakdown: regimeCompatibility,
      expectedValueBreakdown: evResult,
      portfolioReview,
      invalidationConditions: contradictionEval.invalidationConditions,
      decisionState: 'DETECTED',
      actionRecommendation: 'WATCH',
      priorityTier: 'P3_MONITOR',
      executionEligibility: {
        isEligible: false,
        status: 'PENDING_GATES',
        passedGatesCount: 0,
        totalGatesCount: 12,
        timestamp
      },
      causalChain,
      createdAt: timestamp,
      expiresAt,
      updatedAt: timestamp,
      schemaVersion: '25.0.0'
    };

    // 10. Execution Eligibility Bridge Evaluation
    const executionBridge = OpportunityExecutionBridge.getInstance();
    opp.executionEligibility = executionBridge.evaluateExecutionEligibility(opp);

    // 11. Decision State Machine Evaluation
    const decisionEngine = OpportunityDecisionEngine.getInstance();
    const decisionResult = decisionEngine.evaluateDecisionState(opp);
    opp.decisionState = decisionResult.decisionState;
    opp.actionRecommendation = decisionResult.actionRecommendation;

    // 12. Priority Tier Assignment
    const priorityEngine = OpportunityPriorityEngine.getInstance();
    opp.priorityTier = priorityEngine.determinePriorityTier(opp);

    // 13. Record Lifecycle Creation Event
    const lifecycleEngine = OpportunityLifecycleEngine.getInstance();
    lifecycleEngine.recordTransition({
      opportunityId,
      previousState: 'DETECTED',
      newState: opp.decisionState,
      reason: decisionResult.decisionReason,
      confidence: opp.confidenceScore,
      evidenceIds: opp.evidenceIds,
      actor: 'SYSTEM_DETERMINISTIC_ENGINE',
      metadata: { action: opp.actionRecommendation, priority: opp.priorityTier }
    });

    return opp;
  }
}
