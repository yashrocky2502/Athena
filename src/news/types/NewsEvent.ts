/**
 * ATHENA NEWS ENGINE — STAGE 8.4 EVENT-CENTRIC DATA MODEL
 * Represents durable market event abstractions linking multiple articles across publishers.
 */

export type EventStatus = 
  | 'NEW' 
  | 'CONFIRMED' 
  | 'UPDATED' 
  | 'ESCALATED' 
  | 'RESOLVED' 
  | 'CONFLICTED' 
  | 'SUPERSEDED' 
  | 'EXPIRED';

export type EventPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export type EventFreshness = 'BREAKING' | 'VERY_FRESH' | 'FRESH' | 'AGING' | 'STALE';

export type ConflictStatus = 'NONE' | 'CONFLICTING_REPORTS' | 'RESOLVED';

export type TelegramEventState = 
  | 'PENDING' 
  | 'SENT' 
  | 'UPDATED_SENT' 
  | 'ESCALATED_SENT' 
  | 'CONFLICT_SENT' 
  | 'SKIPPED';

export interface EventSourceRef {
  publisher: string;
  sourceUrl: string;
  headline: string;
  tier: number; // 1 = Official, 2 = High-quality wire/media, 3 = Secondary, 4 = Discovery
  publishedAt: string;
  articleId: string;
}

export interface EventKeyNumber {
  value: string; // e.g. "₹2,100 crore"
  numValue?: number; // e.g. 2100
  sourceArticleId: string;
  publisher: string;
  tier: number;
  extractedText: string;
  provenance?: {
    articleId: string;
    publisher: string;
  };
}

export interface ConflictingReport {
  field: string;
  reportA: {
    value: any;
    publisher: string;
    tier: number;
    articleId: string;
    text?: string;
  };
  reportB: {
    value: any;
    publisher: string;
    tier: number;
    articleId: string;
    text?: string;
  };
  conflictDetectedAt: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface EventCanonicalSummary {
  whatHappened: string;
  whyItMatters: string;
  keyNumbers?: string[];
}

export interface EventHistoryRecord {
  timestamp: string;
  previousStatus: EventStatus;
  newStatus: EventStatus;
  reason: string;
  triggerArticleId?: string;
  whatChanged?: string;
}

export interface NewsEvent {
  eventId: string;
  eventFingerprint: string;
  primaryEntity: string;
  symbol: string;
  category: string;
  eventType: string; // e.g. ORDER_WIN, EARNINGS, PROMOTER_TRANSACTION, REGULATORY, ACQUISITION, BUYBACK, GUIDANCE
  firstSeenAt: string;
  lastUpdatedAt: string;
  latestArticleId: string;
  sourceArticleIds: string[];
  primarySource: EventSourceRef;
  supportingSources: EventSourceRef[];
  sourceCount: number;
  eventStatus: EventStatus;
  eventPriority: EventPriority;
  eventFreshness: EventFreshness;
  confidence: number; // 0 - 100
  materialChangeDetected: boolean;
  escalationLevel: number;
  conflictStatus: ConflictStatus;
  canonicalSummary: EventCanonicalSummary;
  keyNumbers: EventKeyNumber[];
  previousKeyNumbers?: EventKeyNumber[];
  whatChanged?: string;
  whatRemainsUnknown?: string;
  telegramState: TelegramEventState;
  traderIntelligenceAvailable: boolean;
  conflictingReports?: ConflictingReport[];
  fnoMetrics?: {
    oi?: string;
    pcr?: string;
    iv?: string;
    strike?: string;
    derivativeDirection?: string;
  };
  history?: EventHistoryRecord[];
}
