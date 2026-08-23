/**
 * ATHENA NEWS ENGINE — STAGE 8.9.3 PRODUCTION TRUTH TYPES
 * ProductionTruthRecord & ProductionTruthSnapshot
 */

export type FeedVisibilityReason =
  | 'CANONICAL_VISIBLE'
  | 'CANONICAL_STORED_BUT_FILTERED'
  | 'EVENT_PROJECTED'
  | 'QUARANTINED'
  | 'INVALID'
  | 'MISSING_DOWNSTREAM'
  | 'UNEXPECTED_FEED_DROP';

export type SummaryQualityStatus =
  | 'VALID'
  | 'HEADLINE_REPETITION'
  | 'GENERIC_TEMPLATE'
  | 'ENTITY_MISMATCH'
  | 'EVENT_MISMATCH'
  | 'NUMBER_MISMATCH'
  | 'UNSUPPORTED_CLAIM'
  | 'FABRICATED_FO_DATA'
  | 'SOURCE_CONTEXT_MISSING';

export type SummarySourceType =
  | 'SOURCE_GROUNDED'
  | 'CACHE_REUSED'
  | 'FALLBACK_GENERATED'
  | 'INSUFFICIENT_SOURCE_CONTEXT';

export type TelegramDispatchState =
  | 'SENT'
  | 'QUEUED'
  | 'SUPPRESSED'
  | 'BACKOFF_RETRY'
  | 'FAILED'
  | 'UNPROCESSED';

export type ConflictStatus =
  | 'NO_CONFLICT'
  | 'RESOLVED_BY_AUTHORITY'
  | 'UNRESOLVED_CONFLICT';

export type FreshnessClass =
  | 'BREAKING'
  | 'VERY_FRESH'
  | 'FRESH'
  | 'AGING'
  | 'STALE';

export type PriorityClass =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW';

export type ReconciliationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface ReconciliationIssue {
  severity: ReconciliationSeverity;
  code: string;
  message: string;
}

export interface ProductionTruthRecord {
  articleId: string;
  eventId: string | null;
  eventFingerprint: string | null;
  publisher: string;
  sourceUrl: string;
  publishedAt: string;
  ingestedAt: string;
  normalizedAt: string;
  classifiedAt: string;
  storedAt: string;
  category: string;
  eventType: string;
  symbol: string | null;
  primaryEntity: string | null;

  feedVisible: boolean;
  feedVisibilityReason: FeedVisibilityReason;

  summaryStatus: 'AVAILABLE' | 'GENERATED_ON_DEMAND' | 'STALE_INVALIDATED' | 'FALLBACK' | 'MISSING' | 'UNSUPPORTED_CLAIM';
  summaryRevision: number;
  summarySource: SummarySourceType;
  summaryGeneratedAt: string | null;
  summaryQualityStatus: SummaryQualityStatus;

  telegramEligible: boolean;
  telegramEligibilityReason: string;
  telegramAlertType: string | null;
  telegramRevision: number;
  telegramDispatchState: TelegramDispatchState;
  telegramSuppressionReason: string | null;

  eventStatus: string | null;
  eventRevision: number;
  materialChangeDetected: boolean;
  conflictStatus: ConflictStatus;

  sourceAuthorityTier: 1 | 2 | 3 | 4;
  freshnessClass: FreshnessClass;
  priorityClass: PriorityClass;

  reconciliationStatus: 'OK' | 'DISCREPANCY';
  reconciliationIssues: ReconciliationIssue[];
}

export interface ProductionTruthSnapshot {
  overallStatus: 'OK' | 'WARNING' | 'ERROR' | 'CRITICAL';
  checkedAt: string;
  canonicalDiskCount: number;
  storeCount: number;
  apiCount: number;
  uiCount: number;

  feedDrops: Array<{ articleId: string; reason: string }>;
  projectionDifferences: Array<{ articleId: string; eventId: string; detail: string }>;
  summaryIssues: Array<{ articleId: string; issue: SummaryQualityStatus; detail: string }>;
  eventIssues: Array<{ eventId: string; issue: string }>;
  telegramIssues: Array<{ articleId: string; eventId?: string; issue: string }>;
  sourceIssues: Array<{ articleId: string; publisher: string; issue: string }>;
  cacheIssues: Array<{ key: string; issue: string }>;

  records: ProductionTruthRecord[];
}
