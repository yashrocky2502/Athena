/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * types.ts
 * 
 * Canonical schemas for deterministic evidence, provenance chains, source authority,
 * quality scoring, confidence decomposition, conflict detection, and forensic audit records.
 */

import { CanonicalMarketSnapshot, CanonicalMarketTick, MarketSessionState } from '../market-truth/types.ts';

// --------------------------------------------------------------------------
// 1. Evidence Types & Classifications
// --------------------------------------------------------------------------

export type EvidenceType =
  | 'NEWS'
  | 'MARKET_TICK'
  | 'MARKET_SNAPSHOT'
  | 'ORDER_BOOK'
  | 'VOLUME'
  | 'OPEN_INTEREST'
  | 'IV'
  | 'OPTIONS_CHAIN'
  | 'DERIVATIVE_FLOW'
  | 'SECTOR_DATA'
  | 'INDEX_DATA'
  | 'MACRO_DATA'
  | 'FX_DATA'
  | 'COMMODITY_DATA'
  | 'ECONOMIC_RELEASE'
  | 'FILING'
  | 'CORPORATE_ACTION'
  | 'BROKER_DATA'
  | 'SURVEILLANCE_EVENT'
  | 'SIGNAL'
  | 'STRATEGY'
  | 'PORTFOLIO'
  | 'EXECUTION'
  | 'OUTCOME'
  | 'HISTORICAL_REPLAY'
  | 'FILING_EVIDENCE'
  | 'MARKET_EVIDENCE'
  | 'MARKET_TICK_EVIDENCE'
  | 'ORDERBOOK_EVIDENCE'
  | 'SIGNAL_EVIDENCE'
  | 'SURVEILLANCE_EVIDENCE'
  | 'MACRO_EVIDENCE';

export type SourceTier =
  | 'P0_AUTHORITATIVE'  // NSE, BSE, RBI, SEBI, MCA official disclosures
  | 'P1_PRIMARY'        // Company IR, authorized broker feeds, official government releases
  | 'P2_SECONDARY'      // Reuters, Bloomberg, established financial publications
  | 'P3_AGGREGATED'     // RSS aggregators, syndicated feeds
  | 'P4_UNVERIFIED';    // Social feeds, unverified web scrapers

export type EvidenceRelationshipType =
  | 'SUPPORTS'
  | 'CONTRADICTS'
  | 'CORROBORATES'
  | 'DERIVED_FROM'
  | 'TRIGGERS'
  | 'CONFIRMS'
  | 'INVALIDATES'
  | 'PRECEDES'
  | 'CAUSES'
  | 'CAUSED_SIGNAL'
  | 'CORRELATES_WITH'
  | 'DEPENDS_ON'
  | 'REPLACES'
  | 'SUPERSEDES';

export type ConflictSeverity =
  | 'INFO'
  | 'MINOR'
  | 'MATERIAL'
  | 'CRITICAL';

export type EvidenceQualityStatus =
  | 'EXCELLENT'
  | 'GOOD'
  | 'DEGRADED'
  | 'POOR'
  | 'INVALID';

export type CausalFactorClassification =
  | 'DIRECT_CAUSE'
  | 'STRONG_CONTRIBUTOR'
  | 'WEAK_CONTRIBUTOR'
  | 'CORRELATED_FACTOR'
  | 'UNCONFIRMED';

export type DecisionType =
  | 'LONG_SIGNAL'
  | 'SHORT_SIGNAL'
  | 'NEUTRAL'
  | 'BUY_ORDER'
  | 'SELL_ORDER'
  | 'HOLD_POSITION'
  | 'CLOSE_POSITION'
  | 'REBALANCE_PORTFOLIO'
  | 'CIRCUIT_TRIP'
  | 'SURVEILLANCE_ALERT'
  | 'MARKET_DIAGNOSIS';

// --------------------------------------------------------------------------
// 2. Canonical EvidenceObject (Immutable)
// --------------------------------------------------------------------------

export interface EvidenceSourceMetadata {
  sourceId: string;
  name: string;
  tier: SourceTier;
  url?: string;
  publisherId?: string;
  isOfficialExchange?: boolean;
  isRegulatory?: boolean;
  baseAuthorityScore: number; // 0 - 100
  authorityScore?: number;
  isPrimary?: boolean;
}

export interface EvidenceObject<T = any> {
  id: string;                                // e.g. "evi_news_1720000000_abc123"
  evidenceType: EvidenceType;
  source: string;                            // e.g. "NSE_DIRECT", "REUTERS", "RBI"
  sourceTier: SourceTier;
  sourceId: string;
  sourceUrl?: string;
  symbol?: string;
  entity?: string;
  sector?: string;
  timestamp: string;                         // Canonical reference timestamp
  sourceTimestamp: string;                   // Original timestamp at source origin
  ingestionTimestamp: string;                // Time recorded into ATHENA
  availabilityTimestamp: string;             // Exact time available for decision consumption
  schemaVersion: string;                     // e.g. "v24.1"
  contentHash: string;                       // Cryptographic hash of normalized payload
  canonicalHash: string;                     // Cryptographic hash of entire evidence object
  provenanceId: string;                      // Lineage identifier
  qualityScore: number;                      // 0 - 100
  reliabilityScore: number;                  // 0 - 100
  authorityScore: number;                    // 0 - 100
  freshnessScore: number;                    // 0 - 100
  confidence: number;                        // 0 - 100
  status: EvidenceQualityStatus;
  
  // Immutability & Versioning
  version: number;                           // 1 for original, >1 for revisions
  originalEvidenceId?: string;
  supersedesEvidenceId?: string;
  revisionTimestamp?: string;
  revisionReason?: string;
  
  // Context & Payload
  isHistoricalReplay?: boolean;
  replayTimestamp?: string;
  payload: T;
  metadata?: Record<string, any>;
}

// --------------------------------------------------------------------------
// 3. Evidence Relationships & Chains (DAG)
// --------------------------------------------------------------------------

export interface EvidenceNode {
  nodeId: string;
  evidenceId: string;
  evidenceType: EvidenceType;
  label: string;
  timestamp: string;
  authorityScore?: number;
  qualityScore?: number;
  confidence?: number;
  source?: string;
  status?: EvidenceQualityStatus;
  payload?: any;
  outgoingEdges?: string[];
  incomingEdges?: string[];
  [key: string]: any;
}

export interface EvidenceEdge {
  edgeId: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  relationship: EvidenceRelationshipType;
  weight: number;                          // 0 - 1.0
  confidence?: number;                     // 0 - 100
  reason?: string;
  timestamp?: string;
  detectedAt?: string;
}

export interface EvidenceChain {
  chainId: string;
  rootEvidenceId: string;
  targetDecisionId?: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  chainHash: string;                       // Tamper-evident cryptographic hash of entire chain
  canonicalChainHash?: string;
  depth?: number;
  overallConfidence: number;               // 0 - 100
  qualityScore: number;                    // 0 - 100
  corroborationScore: number;              // 0 - 100
  contradictionPenalty: number;            // subtracted value (e.g. -12)
  isComplete: boolean;
  hasOrphans: boolean;
  hasCycles: boolean;
  engineVersion: string;
  createdAt: string;
  finalizedAt?: string;
}

// --------------------------------------------------------------------------
// 4. Conflicts & Contradictions
// --------------------------------------------------------------------------

export interface EvidenceConflict {
  conflictId: string;
  conflictType: 
    | 'SOURCE_DISAGREEMENT'
    | 'DIRECTIONAL_CONTRADICTION'
    | 'PRICE_NEWS_CONTRADICTION'
    | 'VOLUME_PRICE_CONTRADICTION'
    | 'OI_PRICE_CONTRADICTION'
    | 'SECTOR_INDEX_CONTRADICTION'
    | 'MACRO_MARKET_CONTRADICTION'
    | 'SIGNAL_EVIDENCE_CONTRADICTION'
    | 'STRATEGY_EVIDENCE_CONTRADICTION'
    | 'TEMPORAL_ANACHRONISM';
  severity: ConflictSeverity;
  description: string;
  evidenceIdA: string;
  evidenceIdB: string;
  penaltyScore: number;                     // 0 - 50 deduction
  detectedAt: string;
  isResolved: boolean;
  resolution?: string;
}

// --------------------------------------------------------------------------
// 5. Corroboration & Independence
// --------------------------------------------------------------------------

export interface EvidenceCorroborationSummary {
  corroborationScore: number;               // 0 - 100
  totalSourcesCount: number;
  independentSourcesCount: number;
  independentSourceCount?: number;
  contradictionDetected?: boolean;
  syndicatedDuplicatesCount: number;
  highestAuthorityTier: SourceTier;
  corroboratingEvidenceIds: string[];
  status: 'STRONG_CORROBORATION' | 'MODERATE_CORROBORATION' | 'SINGLE_SOURCE' | 'UNVERIFIED';
}

// --------------------------------------------------------------------------
// 6. Confidence Decomposition & Calibration
// --------------------------------------------------------------------------

export interface ConfidenceBreakdown {
  finalConfidence: number;                  // 0 - 100
  sourceAuthorityWeight: number;            // e.g. 90
  sourceReliabilityWeight: number;          // e.g. 85
  evidenceQualityWeight: number;            // e.g. 92
  freshnessWeight: number;                  // e.g. 96
  marketConfirmationWeight: number;         // e.g. 78
  crossSourceCorroborationWeight: number;   // e.g. 80
  contradictionPenalty: number;             // e.g. -12
  formula: string;                          // Reproducible explanation formula
  isDeterministic: boolean;
  calculatedAt: string;
}

export interface ConfidenceCalibrationBucket {
  bucket: '0-20' | '21-40' | '41-60' | '61-80' | '81-100';
  predictedConfidenceAvg: number;
  totalPredictions: number;
  successfulOutcomes: number;
  actualAccuracyPercent: number;
  brierScore: number;
}

// --------------------------------------------------------------------------
// 7. Domain-Specific Evidence Interfaces
// --------------------------------------------------------------------------

export interface NewsMarketEvidence {
  newsEvidenceId: string;
  headline: string;
  source: string;
  sourceTier: SourceTier;
  publishedAt: string;
  affectedEntities: string[];
  affectedSectors: string[];
  expectedDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE';
  observedPriceReactionPercent?: number;
  observedVolumeMultiplier?: number;
  observedOIChangePercent?: number;
  observedIVChangePercent?: number;
  marketConfirmation: 'STRONG' | 'MODERATE' | 'WEAK' | 'CONTRADICTED' | 'PENDING';
  contradictionDetails?: string;
  transmissionScore: number;                // 0 - 100
}

export interface CausalEvidenceItem {
  factorId: string;
  factorName: string;
  classification: CausalFactorClassification;
  weight: number;                           // 0 - 1.0
  evidenceId: string;
  explanation: string;
  temporalDeltaMinutes: number;
}

export interface MarketCausalEvidence {
  targetSymbolOrIndex: string;
  timestamp: string;
  timeWindow: string;
  primaryCause: CausalEvidenceItem;
  secondaryCauses: CausalEvidenceItem[];
  contributors: CausalEvidenceItem[];
  confirmingEvidence: EvidenceObject[];
  contradictingEvidence: EvidenceObject[];
  temporalSequence: { timestamp: string; event: string; evidenceId: string }[];
  overallConfidence: number;
}

export interface SignalEvidenceTrace {
  signalId: string;
  signalType: string;
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  triggerEvidence: EvidenceObject[];
  confirmationEvidence: EvidenceObject[];
  contradictionEvidence: EvidenceObject[];
  marketReactionEvidence?: EvidenceObject[];
  transmissionScore: number;
  calculatedConfidence: number;
  evidenceChainId: string;
}

export interface StrategyEvidenceTrace {
  strategyId: string;
  strategyName: string;
  marketRegimeEvidence: EvidenceObject;
  signalEvidence: SignalEvidenceTrace;
  historicalAnalogueEvidence?: EvidenceObject[];
  expectedValueEvidence: { ev: number; sharpe: number; winRate: number; evidenceId: string };
  backtestEvidence?: { score: number; sampleSize: number; evidenceId: string };
  walkForwardEvidence?: { score: number; evidenceId: string };
  overfittingCheckEvidence: { isOverfitted: boolean; score: number; evidenceId: string };
  evidenceChainId: string;
}

export interface PortfolioRiskEvidenceTrace {
  decisionId: string;
  decision: 'APPROVE' | 'REJECT' | 'SCALE_DOWN' | 'HOLD';
  deltaExposure: number;
  gammaExposure: number;
  sectorConcentrationPercent: number;
  var95Percent: number;
  stressTestPass: boolean;
  marginUtilizationPercent: number;
  riskGatePassCount: number;
  totalRiskGates: number;
  criticalContradictionsCount: number;
  evidenceChainId: string;
}

export interface ExecutionEvidenceTrace {
  executionIntentId: string;
  orderId?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'LIMIT' | 'MARKET';
  executionMode: 'PAPER' | 'SANDBOX' | 'LIVE';
  strategyEvidenceChainId: string;
  portfolioRiskGateEvidenceId: string;
  marketTruthEvidenceId: string;
  marketDataFreshnessMs: number;
  brokerHealthEvidenceId: string;
  twelveGatePassStatus: boolean;
  authorizationHash: string;
  isAiCreated: boolean;                     // MUST ALWAYS BE FALSE
  isAiAuthorized: boolean;                  // MUST ALWAYS BE FALSE
}

export interface BrokerProvenanceTrace {
  decisionId: string;
  executionIntentId: string;
  orderPlanId: string;
  brokerOrderId: string;
  brokerAdapter: string;                    // e.g. "ZerodhaAdapter", "ShoonyaAdapter", "PaperBroker"
  brokerResponseTimestamp: string;
  fillPrice?: number;
  fillQuantity?: number;
  slippageBps?: number;
  reconciliationStatus: 'RECONCILED' | 'PENDING' | 'DISCREPANCY';
  outcomeId?: string;
}

// --------------------------------------------------------------------------
// 8. Forensic Decision Record & Audit
// --------------------------------------------------------------------------

export interface ForensicDecisionRecord {
  decisionId: string;
  timestamp: string;
  decisionType: DecisionType;
  symbol?: string;
  decision: string;                         // e.g. "BUY", "SELL", "HOLD", "ALERT_TRIP"
  confidence: number;                       // 0 - 100
  confidenceBreakdown: ConfidenceBreakdown;
  evidenceChainId: string;
  primaryEvidence: EvidenceNode[];
  supportingEvidence: EvidenceNode[];
  contradictingEvidence: EvidenceConflict[];
  riskChecks: { name: string; passed: boolean; score?: number }[];
  marketTruthState: {
    snapshotId: string;
    timestamp: string;
    qualityScore: number;
    regime?: string;
  };
  strategyState?: {
    strategyId: string;
    score: number;
    expectedValue: number;
  };
  portfolioState?: {
    totalRiskGatesPassed: boolean;
    concentrationStatus: string;
    varStatus: string;
  };
  executionState?: {
    executionIntentId?: string;
    mode: 'PAPER' | 'SANDBOX' | 'LIVE';
    authorized: boolean;
  };
  engineVersions: {
    evidenceSchema: string;
    marketTruthVersion: string;
    causalEngineVersion: string;
    riskEngineVersion: string;
  };
  deterministicHash: string;
  secretSanitized: boolean;
}

export interface EvidenceAuditIssue {
  issueId: string;
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
  type: 
    | 'MISSING_PROVENANCE'
    | 'INVALID_HASH'
    | 'FUTURE_EVIDENCE_DETECTED'
    | 'ORPHAN_DECISION'
    | 'ORPHAN_EVIDENCE'
    | 'BROKEN_RELATIONSHIP'
    | 'DUPLICATE_EVIDENCE'
    | 'UNRESOLVED_CRITICAL_CONFLICT'
    | 'STALE_ACTIONABLE_EVIDENCE'
    | 'INVALID_SOURCE'
    | 'MISSING_TIMESTAMP'
    | 'SCHEMA_MISMATCH'
    | 'AI_EVIDENCE_MUTATION_ATTEMPT'
    | 'AI_EXECUTION_AUTHORIZATION_ATTEMPT'
    | 'SECRET_EXPOSURE_DETECTED';
  targetId: string;
  message: string;
  detectedAt: string;
}

export interface EvidenceAuditRecord {
  auditId: string;
  timestamp: string;
  totalEvidenceChecked: number;
  totalChainsChecked: number;
  totalDecisionsChecked: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  issues: EvidenceAuditIssue[];
  deterministicHash: string;
}

// --------------------------------------------------------------------------
// 9. Telemetry & Search
// --------------------------------------------------------------------------

export interface EvidenceTelemetry {
  totalEvidenceObjects: number;
  validEvidenceObjects: number;
  invalidEvidenceObjects: number;
  futureEvidenceBlocked: number;
  conflictCount: number;
  criticalConflictCount: number;
  averageEvidenceQuality: number;
  averageSourceReliability: number;
  averageConfidence: number;
  provenanceFailures: number;
  hashFailures: number;
  orphanEvidenceCount: number;
  orphanDecisionsCount: number;
  lastAuditedAt: string;
}

export interface EvidenceSearchQuery {
  symbol?: string;
  entity?: string;
  sector?: string;
  evidenceType?: EvidenceType;
  source?: string;
  sourceTier?: SourceTier;
  minConfidence?: number;
  minQuality?: number;
  hasContradiction?: boolean;
  fromTimestamp?: string;
  toTimestamp?: string;
  provenanceId?: string;
  decisionId?: string;
  limit?: number;
}

export interface TelegramEvidenceProof {
  proofId: string;
  decision: string;
  symbol: string;
  confidence: number;
  primaryEvidenceSummary: string[];
  marketConfirmationSummary: string;
  riskStatusSummary: string;
  contradictionSummary?: string;
  sourceQualitySummary: string;
  timestamp: string;
  evidenceId: string;
  provenanceId: string;
  deterministicHash: string;
  isHistoricalReplay: boolean;
  formattedMessage: string;
}
