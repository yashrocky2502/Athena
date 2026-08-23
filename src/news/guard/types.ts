/**
 * ATHENA NEWS ENGINE — STAGE 8.9.4 PRODUCTION TRUTH GUARD TYPES
 * Types for Production Truth Guard, Auto-Containment & Safe-Mode Enforcement
 */

export type HealthState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'RECONCILIATION_FAILURE'
  | 'SAFE_MODE'
  | 'RECOVERING';

export type RuntimeMode =
  | 'NORMAL'
  | 'DEGRADED'
  | 'SAFE_MODE'
  | 'RECOVERY';

export type GuardSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';

export type FailureDomain =
  | 'CANONICAL_STORAGE'
  | 'FEED_API'
  | 'UI_PROJECTION'
  | 'EVENT_ENGINE'
  | 'SUMMARY_ENGINE'
  | 'TELEGRAM'
  | 'SOURCE_INGESTION'
  | 'ECONOMIC_CALENDAR'
  | 'AI_PROVIDER'
  | 'CACHE'
  | 'CANARY_ROUTING';

export type SubsystemId =
  | 'CANONICAL_STORAGE'
  | 'V5_FEED_PROJECTION'
  | 'V4_FEED'
  | 'EVENT_ENGINE'
  | 'SUMMARY_ENGINE'
  | 'TELEGRAM_DISPATCH'
  | 'AI_ENRICHMENT'
  | 'SOURCE_INGESTION'
  | 'FOREX_FACTORY'
  | 'ECONOMIC_CALENDAR'
  | 'CACHE'
  | 'CANARY_ROUTER'
  | 'NSE_RSS'
  | 'STORAGE_INTEGRITY'
  | (string & {});

export interface GuardIncident {
  id: string;
  domain: FailureDomain;
  severity: GuardSeverity;
  timestamp: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  consecutiveFailures: number;
  affectedArticleIds: string[];
  affectedEventIds: string[];
  reason: string;
  containmentAction: string;
  recoveryStatus: 'PENDING' | 'PROBING' | 'RECOVERED' | 'FAILED';
}

export interface ContainedSubsystemInfo {
  subsystem: SubsystemId;
  domain: FailureDomain;
  containedAt: string;
  reason: string;
  severity: GuardSeverity;
  incidentId: string;
  autoRecoverable: boolean;
  probeCount: number;
  lastProbeAt: string | null;
}

export interface GuardStatus {
  overallHealth: HealthState;
  runtimeMode: RuntimeMode;
  safeMode: boolean;
  activeIncidents: GuardIncident[];
  containedSubsystems: ContainedSubsystemInfo[];
  sourceCircuitStates: Array<{
    sourceId: string;
    publisher: string;
    circuitState: string;
    consecutiveFailures: number;
    quarantineReason?: string;
  }>;
  aiProviderStates: {
    enabled: boolean;
    provider: string;
    consecutiveFailures: number;
    isDegraded: boolean;
    rateLimited: boolean;
  };
  telegramState: {
    paused: boolean;
    queueLength: number;
    consecutiveFailures: number;
    inFlight: number;
    isDegraded: boolean;
    rateLimited: boolean;
  };
  canaryState: {
    enabled: boolean;
    percentage: number;
    canaryAvailable: boolean;
    fallbackReason?: string;
  };
  lastReconciliation: {
    checkedAt: string;
    overallStatus: string;
    canonicalDiskCount: number;
    storeCount: number;
    apiCount: number;
  } | null;
  lastRecovery: {
    probedAt: string;
    recoveredSubsystems: string[];
    status: string;
  } | null;
  checkedAt: string;
}

export interface RecoveryProbeResult {
  subsystem: SubsystemId;
  success: boolean;
  message: string;
  probedAt: string;
  reconciliationPassed: boolean;
  healthyState?: HealthState;
}
