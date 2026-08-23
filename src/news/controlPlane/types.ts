/**
 * ATHENA NEWS ENGINE — STAGE 8.9.5 PRODUCTION TRUTH CONTROL PLANE TYPES
 * Types for Production Truth Dashboard, Incident Forensics & Zero-Regression Operational Lock
 */

import {
  HealthState,
  RuntimeMode,
  GuardSeverity,
  FailureDomain,
  SubsystemId
} from '../guard/types';
import {
  ProductionTruthSnapshot as ReconciliationSnapshot,
  FeedVisibilityReason,
  SummaryQualityStatus
} from '../reconciliation/types';

export type IncidentStatus = 'OPEN' | 'CONTAINED' | 'RECOVERING' | 'RESOLVED' | 'ESCALATED';

export interface ProductionIncident {
  incidentId: string;
  fingerprint: string;
  domain: FailureDomain;
  severity: GuardSeverity;
  status: IncidentStatus;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt?: string;

  errorCode: string;
  reason: string;

  affectedArticleIds: string[];
  affectedEventIds: string[];

  previousHealth: HealthState;
  resultingHealth: HealthState;
  containmentAction: string;
  recoveryAction?: string;

  occurrenceCount: number;
  consecutiveFailures: number;

  reconciliationId?: string;
  sourceId?: string;
  alertId?: string;

  evidence: string[];
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  domain: FailureDomain;
  event: string;
  severity: GuardSeverity;
  correlationId: string;
  details?: Record<string, any>;
}

export interface DomainHealthStatus {
  domain: FailureDomain;
  health: HealthState;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  activeIncidentCount: number;
  contained: boolean;
  lastAction: string;
}

export interface DomainHealthMatrix {
  CANONICAL_STORAGE: DomainHealthStatus;
  FEED_API: DomainHealthStatus;
  UI_PROJECTION: DomainHealthStatus;
  EVENT_ENGINE: DomainHealthStatus;
  SUMMARY_ENGINE: DomainHealthStatus;
  TELEGRAM: DomainHealthStatus;
  SOURCE_INGESTION: DomainHealthStatus;
  ECONOMIC_CALENDAR: DomainHealthStatus;
  AI_PROVIDER: DomainHealthStatus;
  CACHE: DomainHealthStatus;
  CANARY_ROUTING: DomainHealthStatus;
}

export interface UnresolvedTelegramAlert {
  eventId: string;
  alertType: string;
  revision: number | string;
  idempotencyKey: string;
  queueStatus: 'QUEUED' | 'RETRYING' | 'RATE_LIMITED' | 'PAUSED' | 'FAILED';
  attemptCount: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
}

export interface TelegramForensics {
  telegramHealth: HealthState;
  queueDepth: number;
  queuedEvents: number;
  sentCount: number;
  failedCount: number;
  retryCount: number;
  rateLimitedCount: number;
  lastQueuedAt: string | null;
  lastSentAt: string | null;
  lastFailureAt: string | null;
  lastSuccessfulDeliveryAt: string | null;
  averageDeliveryLatency: number;
  p95DeliveryLatency: number;
  duplicateSuppressedCount: number;
  revisionAlertsSent: number;
  escalationAlertsSent: number;
  conflictAlertsSent: number;
  historicalAlertsSuppressed: number;
  unresolvedAlerts: UnresolvedTelegramAlert[];
}

export type AICallAvoidedReason =
  | 'DUPLICATE'
  | 'CACHE_HIT'
  | 'LOW_SIGNAL'
  | 'NO_ENRICHMENT_REQUIRED'
  | 'HISTORICAL'
  | 'NON_MATERIAL_UPDATE'
  | 'TELEGRAM_NOT_ELIGIBLE';

export interface AIForensics {
  gemini: {
    enabled: boolean;
    available: boolean;
    consecutiveFailures: number;
    circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  };
  groq: {
    enabled: boolean;
    available: boolean;
  };
  fallbackUsage: {
    active: boolean;
    totalFallbackGenerations: number;
  };
  successfulCalls: number;
  failedCalls: number;
  timeoutCalls: number;
  rateLimitCalls: number;
  tokensUsed: number | 'UNKNOWN';
  estimatedCost: number | 'UNKNOWN';
  cacheHits: number;
  cacheMisses: number;
  suppressedCalls: number;
  aiCallsAvoided: Record<AICallAvoidedReason, number>;
}

export interface SourceAccuracyMetrics {
  articlesDiscovered: number;
  articlesAccepted: number;
  articlesQuarantined: number;
  duplicatesSuppressed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsEscalated: number;
}

export interface SourceForensicItem {
  sourceId: string;
  publisher: string;
  sourceType: string;
  enabled: boolean;
  circuitState: 'ACTIVE' | 'DEGRADED' | 'QUARANTINED' | 'DISABLED';
  failureClassification?: string;
  consecutiveFailures: number;
  lastPollAt: string | null;
  lastSuccessfulPollAt: string | null;
  lastSuccessfulArticleAt: string | null;
  nextRetryAt: string | null;
  quarantineUntil: string | null;
  accuracyMetrics: SourceAccuracyMetrics | null;
}

export interface SourceForensics {
  totalRegistered: number;
  activeCount: number;
  degradedCount: number;
  quarantinedCount: number;
  disabledCount: number;
  sources: SourceForensicItem[];
}

export interface EconomicCalendarForensics {
  provider: 'FOREX_FACTORY' | 'RBI' | 'FED' | 'INTERNAL';
  health: HealthState;
  lastSuccessfulFetch: string | null;
  nextScheduledFetch: string | null;
  eventsDiscovered: number;
  eventsAccepted: number;
  fallbackEventsUsed: number;
}

export interface CanaryForensics {
  v3Enabled: boolean;
  canaryEnabled: boolean;
  canaryPercentage: number;
  lastCanaryRequest: string | null;
  controlRequests: number;
  canaryRequests: number;
  forcedCanaryRequests: number;
  forcedControlRequests: number;
  v5Contained: boolean;
}

export interface EventEngineForensics {
  eventsCreated: number;
  eventsUpdated: number;
  eventsEscalated: number;
  eventsResolved: number;
  eventsConflicted: number;
  sourceCoverage: number;
  duplicateArticlesMerged: number;
  activeEventCount: number;
}

export interface SummaryQualityForensics {
  summariesGenerated: number;
  summariesCached: number;
  summariesRejected: number;
  genericTemplateRejected: number;
  entityMismatchRejected: number;
  numberMismatchRejected: number;
  unsupportedClaimRejected: number;
  fabricatedFoRejected: number;
}

export interface RecoveryActionItem {
  id: string;
  domain: FailureDomain;
  subsystem: SubsystemId;
  startedAt: string;
  completedAt?: string;
  result: 'SUCCESS' | 'FAILURE' | 'IN_PROGRESS';
  attempt: number;
  probeType: string;
  message?: string;
}

export interface RecoveryForensics {
  recoveryMode: boolean;
  activeRecoveryActions: RecoveryActionItem[];
  completedRecoveryActions: RecoveryActionItem[];
  failedRecoveryActions: RecoveryActionItem[];
  lastRecoveryAt: string | null;
  lastSuccessfulRecoveryAt: string | null;
}

export interface CanonicalTruthStatus {
  canonicalCount: number;
  persistentStoreCount: number;
  v4Count: number;
  v5Count: number;
  adapterCount: number;
  countParity: boolean;
  duplicateArticleIds: string[];
  duplicateCanonicalUrls: string[];
  missingArticleIds: string[];
  lastHydrationAt: string | null;
  lastSuccessfulHydrationAt: string | null;
  totalCanonicalArticles: number;
  currentPageSize: number;
  categoryFilterCount: number;
  eventProjectionCount: number;
}

export interface ProductionTruthScore {
  totalScore: number; // 0 - 100
  components: {
    canonicalIntegrity: number; // Max 30
    feedAvailability: number;   // Max 20
    eventIntegrity: number;     // Max 15
    telegramHealth: number;     // Max 10
    sourceHealth: number;       // Max 10
    aiHealth: number;           // Max 5
    cacheCanary: number;        // Max 5
    recoveryState: number;      // Max 5
  };
  authoritativeHealth: HealthState;
  explanation: string;
}

export interface RegressionBaseline {
  canonicalCount: number;
  storeCount: number;
  v4Count: number;
  v5Count: number;
  adapterCount: number;
  eventCount: number;
  sourceCount: number;
  telegramQueueDepth: number;
  recordedAt: string;
}

export interface ProductionTruthSnapshot {
  snapshotId: string;
  generatedAt: string;
  overallHealth: HealthState;
  runtimeMode: RuntimeMode;

  canonicalFeed: CanonicalTruthStatus;
  feedProjection: {
    v5Safe: boolean;
    projectionCount: number;
    projectionDiscrepancies: number;
  };
  eventEngine: EventEngineForensics;
  summaryEngine: SummaryQualityForensics;
  telegram: TelegramForensics;
  ai: AIForensics;
  sources: SourceForensics;
  economicCalendar: EconomicCalendarForensics;
  cache: {
    hits: number;
    misses: number;
    size: number;
    hitRatio: number;
  };
  canary: CanaryForensics;
  reconciliation: {
    lastCheckedAt: string;
    overallStatus: string;
    canonicalDiskCount: number;
    storeCount: number;
    apiCount: number;
    feedDropsCount: number;
    discrepancyExplanation?: string;
  };
  recovery: RecoveryForensics;

  activeIncidents: ProductionIncident[];
  recentIncidents: ProductionIncident[];
  containmentActions: Array<{
    subsystem: SubsystemId;
    domain: FailureDomain;
    containedAt: string;
    reason: string;
  }>;
  recoveryActions: RecoveryActionItem[];

  truthScore: ProductionTruthScore;
  baseline: RegressionBaseline;
  metrics: {
    generationDurationMs: number;
    memoryUsageMb: number;
  };
}

export interface CompactHealthSummary {
  snapshotId: string;
  timestamp: string;
  overallHealth: HealthState;
  runtimeMode: RuntimeMode;
  truthScore: number;
  canonicalStoreCount: number;
  diskStoreCount: number;
  countParity: boolean;
  activeIncidentsCount: number;
  containedSubsystemsCount: number;
  telegramQueueDepth: number;
  aiEnabled: boolean;
  sourcesActive: number;
  sourcesDegraded: number;
  sourcesQuarantined: number;
}
