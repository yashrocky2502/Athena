/**
 * ATHENA — PHASE 10P-2: PERSONAL POSITION ALERT FOUNDATION
 * types.ts
 * 
 * Canonical contracts for:
 * 1. Normalized Position Model
 * 2. Source-Agnostic Position Source Contract
 * 3. Position Lifecycle Events & State Snapshots
 * 4. Position-Scoped Alert Candidates
 * 5. Private Position Alert Notifier Interface
 * 
 * Safety & Architecture Rules:
 * - Strictly READ-ONLY. No order placement or execution capabilities.
 * - Zero Price Fabrication: Absent values remain explicitly null/undefined.
 * - Strict Position Scoping: Every alert candidate MUST reference a valid positionId.
 * - Separate Destination: Private position alert notifications are decoupled from News Core Telegram outbox.
 */

export type PositionAssetClass = 'EQUITY' | 'ETF' | 'FUTURES' | 'OPTIONS' | 'MUTUAL_FUND';
export type PositionSide = 'LONG' | 'SHORT';
export type PositionPresenceState = 'NO_POSITION' | 'POSITION_EXISTS';

/**
 * Normalized representation of an active user position.
 * Represents only genuine, observed financial data with zero synthetic fallbacks.
 */
export interface NormalizedPosition {
  /** Deterministic, unique position identifier (e.g. POS_EXCEL_NSE_RELIANCE_EQUITY) */
  positionId: string;
  
  /** Security / Ticker symbol (uppercase, trimmed) */
  symbol: string;
  
  /** Exchange identifier (e.g. NSE, BSE, NFO, MCX) when known */
  exchange?: string | null;
  
  /** Normalized asset class */
  assetClass: PositionAssetClass;
  
  /** Position direction / side when applicable */
  side?: PositionSide | null;
  
  /** Strictly positive active quantity (> 0) */
  quantity: number;
  
  /** Average purchase / entry price (null if unrecorded, never fabricated) */
  averagePrice?: number | null;
  
  /** Current market / reference price (null if unrecorded, never fabricated) */
  currentPrice?: number | null;
  
  /** International Securities Identification Number when available */
  isin?: string | null;
  
  /** Sector classification when available */
  sector?: string | null;
  
  /** Originating position source identifier (e.g. 'EXCEL', 'CSV', 'ZERODHA') */
  source: string;
  
  /** ISO timestamp when this position was observed / ingested */
  observedAt: string;
  
  // ==========================================
  // Derivatives & F&O Specific Fields (Optional)
  // ==========================================
  underlyingSymbol?: string | null;
  optionType?: 'CALL' | 'PUT' | null;
  strikePrice?: number | null;
  expiryDate?: string | null;
  lotSize?: number | null;
  
  /** Arbitrary non-critical metadata */
  metadata?: Record<string, any>;
}

/**
 * Source-agnostic contract for fetching user positions.
 * Supports CSV/XLSX file ingestion today, and broker sync in future phases.
 */
export interface PositionSource {
  readonly sourceId: string;
  readonly sourceType: 'FILE' | 'BROKER' | 'MEMORY' | 'MOCK';
  
  /**
   * Fetches the current set of normalized positions.
   * Returns empty array if no positions exist (NO_POSITION).
   */
  getPositions(): Promise<NormalizedPosition[]>;
}

/**
 * Immutable snapshot of observed position state at a point in time.
 */
export interface PositionSnapshot {
  snapshotId: string;
  sourceId: string;
  timestamp: string;
  positions: Map<string, NormalizedPosition>;
  presenceState: PositionPresenceState;
  totalPositions: number;
  totalQuantity: number;
}

/**
 * Position Lifecycle Event Types.
 */
export type PositionLifecycleEventType =
  | 'POSITION_APPEARED'
  | 'POSITION_QUANTITY_CHANGED'
  | 'POSITION_PRICE_CHANGED'
  | 'POSITION_SIDE_CHANGED'
  | 'POSITION_CLOSED';

/**
 * Event representing an observed change between two position snapshots.
 */
export interface PositionLifecycleEvent {
  eventId: string;
  positionId: string;
  symbol: string;
  type: PositionLifecycleEventType;
  timestamp: string;
  previousPosition?: NormalizedPosition | null;
  currentPosition?: NormalizedPosition | null;
  quantityDelta?: number;
  priceDelta?: number;
  details: string;
}

/**
 * Severity level for position-scoped alerts.
 */
export type PositionAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/**
 * Alert type category
 */
export type PositionAlertCategory =
  | 'LIFECYCLE'
  | 'QUANTITY_CHANGE'
  | 'PRICE_CHANGE'
  | 'POSITION_CLOSED'
  | 'POSITION_NEWS_EVENT'
  | 'CORPORATE_ACTION'
  | 'REGULATORY_EVENT'
  | 'RESULTS_EVENT'
  | 'MATERIAL_COMPANY_EVENT'
  | 'CUSTOM';

/**
 * Deterministic Position Impact Types for News & Market Intelligence.
 */
export type PositionImpactType =
  | 'POSITION_NEWS_EVENT'
  | 'CORPORATE_ACTION'
  | 'REGULATORY_EVENT'
  | 'RESULTS_EVENT'
  | 'MATERIAL_COMPANY_EVENT';

/**
 * Standardized input for News & Market Intelligence events.
 */
export interface PositionNewsEventInput {
  id: string;
  headline: string;
  body?: string;
  url?: string;
  publisher?: string;
  publishedAt?: string;
  source?: string;
  category?: string;
  eventType?: string;
  entities?: string[];
  symbols?: string[];
  isin?: string;
  exchange?: string;
  isSynthetic?: boolean;
  isTest?: boolean;
  provenance?: {
    source: string;
    publishedAt?: string;
    url?: string;
    verified?: boolean;
  };
  metadata?: Record<string, any>;
}

/**
 * Result of evaluating a news event against active user positions.
 */
export interface PositionRelevanceResult {
  decision: 'NO_POSITION_IMPACT' | 'POSITION_IMPACT';
  positionId?: string;
  symbol?: string;
  impactType?: PositionImpactType;
  severity?: PositionAlertSeverity;
  reason?: string;
  candidate?: PositionAlertCandidate;
  rejectionReason?: string;
}

/**
 * Alert Candidate Contract.
 * CRITICAL RULE: Must always contain a non-empty, valid positionId.
 */
export interface PositionAlertCandidate {
  /** Unique alert identifier */
  alertId: string;
  
  /** STRICT REQUIREMENT: References an active or transitioning user position */
  positionId: string;
  
  /** Security symbol associated with the position */
  symbol: string;
  
  /** Alert type category */
  alertType: PositionAlertCategory;
  
  /** Alert severity */
  severity: PositionAlertSeverity;
  
  /** Human-readable explanation of the alert */
  reason: string;
  
  /** ISO timestamp when the alert was generated */
  timestamp: string;
  
  /** Optional market data context if available (strictly truthful) */
  marketData?: {
    currentPrice?: number | null;
    previousPrice?: number | null;
    changePct?: number | null;
  };
  
  /** Full audit provenance */
  provenance: {
    source: string;
    observedAt: string;
    eventId?: string;
    publisher?: string;
    url?: string;
  };
  
  /** Deterministic deduplication key */
  dedupeKey: string;
}

/**
 * Destination interface for sending position alerts.
 * Decoupled from News Core V2 Telegram outbox.
 */
export interface PositionAlertNotifier {
  readonly destinationId: string;
  
  /**
   * Dispatches a position alert candidate to the target destination.
   * Returns true on successful delivery.
   */
  notify(alert: PositionAlertCandidate): Promise<boolean>;
}

/**
 * Configuration options for Private Position Telegram Notifier.
 */
export interface PositionTelegramNotifierConfig {
  botToken?: string;
  chatId?: string;
  enabled?: boolean;
  dryRun?: boolean; // Dry run mode for testing (no actual HTTP requests)
}
