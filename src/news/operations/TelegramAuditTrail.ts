/**
 * ATHENA NEWS ENGINE — STAGE 8.9 TELEGRAM AUDIT TRAIL
 * TelegramAuditTrail
 * 
 * Immutable operational ledger of all Telegram event delivery attempts.
 * 
 * Safety Rules:
 * - NEVER store bot tokens, API keys, or Telegram credentials.
 * - Tracks granular lifecycle states from QUEUED to SENT or FAILED.
 * - Provides auditability for forensic compliance and trader delivery guarantees.
 */

export type TelegramDeliveryStatus = 
  | 'QUEUED' 
  | 'SENDING' 
  | 'SENT' 
  | 'RETRYING' 
  | 'RATE_LIMITED' 
  | 'FAILED' 
  | 'SUPPRESSED' 
  | 'PAUSED';

export interface TelegramAuditRecord {
  deliveryId: string;
  eventId: string;
  alertType: string; // 'EVENT_CREATED' | 'EVENT_UPDATE' | 'EVENT_ESCALATION' | 'ARTICLE_ALERT'
  priority: number;  // 1 = F&O / P0, 2 = High / P1, 3 = Normal / P2, etc.
  headline?: string;
  eventFingerprint?: string;
  queuedAt: string;
  attemptedAt?: string;
  sentAt?: string;
  status: TelegramDeliveryStatus;
  retryCount: number;
  httpStatus?: number;
  errorClassification?: string;
  telegramMessageId?: number | string;
}

export class TelegramAuditTrail {
  private static instance: TelegramAuditTrail | null = null;
  private records: Map<string, TelegramAuditRecord> = new Map();
  private maxRecords = 2000;

  private constructor() {}

  public static getInstance(): TelegramAuditTrail {
    if (!TelegramAuditTrail.instance) {
      TelegramAuditTrail.instance = new TelegramAuditTrail();
    }
    return TelegramAuditTrail.instance;
  }

  public static resetInstance(): TelegramAuditTrail {
    TelegramAuditTrail.instance = new TelegramAuditTrail();
    return TelegramAuditTrail.instance;
  }

  /**
   * Records a newly queued delivery attempt.
   */
  public recordQueued(params: {
    deliveryId?: string;
    eventId: string;
    alertType: string;
    priority: number;
    headline?: string;
    eventFingerprint?: string;
  }): TelegramAuditRecord {
    const deliveryId = params.deliveryId || `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record: TelegramAuditRecord = {
      deliveryId,
      eventId: params.eventId,
      alertType: params.alertType,
      priority: params.priority,
      headline: params.headline,
      eventFingerprint: params.eventFingerprint,
      queuedAt: new Date().toISOString(),
      status: 'QUEUED',
      retryCount: 0
    };

    this.upsertRecord(record);
    return record;
  }

  /**
   * Updates an audit record when dispatch is actively attempted.
   */
  public recordAttempt(deliveryId: string): void {
    const existing = this.records.get(deliveryId);
    if (existing) {
      existing.attemptedAt = new Date().toISOString();
      existing.status = 'SENDING';
    }
  }

  /**
   * Updates an audit record upon successful delivery.
   */
  public recordSuccess(deliveryId: string, telegramMessageId?: number | string): void {
    const existing = this.records.get(deliveryId);
    if (existing) {
      existing.status = 'SENT';
      existing.sentAt = new Date().toISOString();
      if (telegramMessageId) {
        existing.telegramMessageId = telegramMessageId;
      }
    }
  }

  /**
   * Updates an audit record upon delivery failure or retry backoff.
   */
  public recordFailure(deliveryId: string, params: {
    status: TelegramDeliveryStatus;
    httpStatus?: number;
    errorClassification?: string;
    retryCount?: number;
  }): void {
    const existing = this.records.get(deliveryId);
    if (existing) {
      existing.status = params.status;
      existing.httpStatus = params.httpStatus;
      existing.errorClassification = params.errorClassification;
      if (params.retryCount !== undefined) {
        existing.retryCount = params.retryCount;
      }
    }
  }

  public getRecord(deliveryId: string): TelegramAuditRecord | undefined {
    return this.records.get(deliveryId);
  }

  public getRecordsByEventId(eventId: string): TelegramAuditRecord[] {
    return Array.from(this.records.values()).filter(r => r.eventId === eventId);
  }

  public getAllRecords(limit = 100): TelegramAuditRecord[] {
    return Array.from(this.records.values())
      .sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime())
      .slice(0, limit);
  }

  public clear(): void {
    this.records.clear();
  }

  private upsertRecord(record: TelegramAuditRecord): void {
    if (this.records.size >= this.maxRecords) {
      const oldestKey = this.records.keys().next().value;
      if (oldestKey) this.records.delete(oldestKey);
    }
    this.records.set(record.deliveryId, record);
  }
}

export const telegramAuditTrail = TelegramAuditTrail.getInstance();
