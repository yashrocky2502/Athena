/**
 * ATHENA UNIFIED INTELLIGENCE OS — v17_unified_event
 * UnifiedIntelligenceTypes.ts
 * 
 * Type definitions and contracts for Phase 17 Unified Intelligence OS.
 */

export type UnifiedLifecycleState =
  | 'NO_TRADE'
  | 'WATCH'
  | 'CONDITIONAL'
  | 'TRADEABLE'
  | 'EXECUTION_PENDING'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'MONITORING'
  | 'COMPLETED'
  | 'ATTRIBUTED'
  | 'LEARNED';

export type UnifiedDecisionType =
  | 'ADD'
  | 'REDUCE'
  | 'HOLD'
  | 'HEDGE'
  | 'REBALANCE'
  | 'CONDITIONAL'
  | 'NO_TRADE';

export type ContradictionSeverity = 'NONE' | 'MINOR' | 'MATERIAL' | 'CRITICAL';

export interface UnifiedAthenaEvent {
  schemaVersion: 'v17_unified_event';
  eventId: string;
  correlationId: string;
  parentEventId: string | null;
  timestamp: string;
  source: string;
  sourceType: string;
  eventType: string;
  articleId: string;
  evidenceIds: string[];
  entityIds: string[];
  sectorIds: string[];
  indexIds: string[];
  macroAssetIds: string[];
  marketReactionId: string | null;
  regimeSnapshotId: string | null;
  signalId: string | null;
  strategyCandidateIds: string[];
  portfolioDecisionId: string | null;
  executionIntentId: string | null;
  executionOrderIds: string[];
  fillIds: string[];
  outcomeId: string | null;
  attributionId: string | null;
  learningRecordId: string | null;
  researchHypothesisIds: string[];
  strategyVariantIds: string[];
  confidence: number;
  lifecycleState: UnifiedLifecycleState;
  actionability: string;
  contradictionState: string;
  provenance: string;
  deterministicOrAI: 'DETERMINISTIC' | 'AI';
}

export interface AthenaContradiction {
  contradictionId: string;
  severity: ContradictionSeverity;
  source: string;
  affectedStage: string;
  evidence: string;
  resolutionState: 'OPEN' | 'RESOLVED' | 'IGNORED';
  description: string;
  timestamp: string;
}

export interface AthenaAuditRecord {
  auditId: string;
  timestamp: string;
  actor: string;
  component: string;
  action: string;
  input: string; // JSON string representation or description
  output: string; // JSON string representation or description
  decision: string;
  reason: string;
  evidence: string[];
  lineageId: string;
  previousState: string;
  newState: string;
}

export interface ConfidenceReport {
  rawConfidence: number;
  adjustedConfidence: number;
  confidenceFactors: string[];
  confidenceWarnings: string[];
}

export interface AthenaUnifiedDecision {
  event: UnifiedAthenaEvent;
  evidence: any[];
  entity: any | null;
  marketReaction: any | null;
  regime: string;
  signal: any | null;
  strategy: any[] | null;
  portfolio: any | null;
  risk: any | null;
  execution: any | null;
  outcome: any | null;
  attribution: any | null;
  learning: any | null;
  research: any | null;
  finalDecision: {
    decision: UnifiedDecisionType;
    confidence: number;
    actionability: UnifiedLifecycleState;
    riskState: string;
    contradictionState: string;
    limitingFactors: string[];
    evidenceReferences: string[];
    lineageId: string;
    timestamp: string;
  };
}

export interface AthenaTelemetry {
  eventProcessingLatencyMs: number;
  stageLatency: Record<string, number>;
  aiCalls: number;
  aiTokenUsage: number;
  deterministicExecutionCount: number;
  cacheHits: number;
  cacheMisses: number;
  eventRetries: number;
  failures: Record<string, number>;
  rejectedDecisions: number;
  contradictionCount: number;
  tradeableConversionRate: number;
}
