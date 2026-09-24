/**
 * ATHENA — PHASE 10P-4: POSITION ALERT DELIVERY & OPERATIONAL HARDENING
 * PositionAlertNotifier.ts
 * 
 * Separate, Private Telegram Destination for Personal Position Alerts.
 * 
 * Strict Architectural Guarantees:
 * 1. Decoupled from News Core V2: NEVER touches or writes to data/telegram_outbox.json.
 * 2. Opt-in Safety: Defaults to ATHENA_POSITION_ALERTS_ENABLED=false.
 * 3. Configuration Safety: Missing credentials will fail safely without crashing.
 * 4. Delivery Hardening: Timeout, bounded retries, transient vs permanent classification.
 * 5. Concurrency Control: Single flight execution per dedupe key prevents duplicate sends.
 * 6. Zero Credential Leaks: Bot token and auth secrets are never exposed in logs or telemetry.
 * 7. Read-Only Safety: No order placement or trading actions.
 */

import {
  PositionAlertCandidate,
  PositionAlertNotifier,
  PositionTelegramNotifierConfig,
  PositionAlertDeliveryStatus,
  PositionAlertDeliveryRecord,
  PositionAlertTelemetryPayload
} from './types.ts';
import { PositionAlertDeliveryStore } from './PositionAlertDeliveryStore.ts';

export class PrivatePositionTelegramNotifier implements PositionAlertNotifier {
  public readonly destinationId = 'PRIVATE_POSITION_TELEGRAM';
  private botToken?: string;
  private chatId?: string;
  private enabled: boolean;
  private dryRun: boolean;
  private timeoutMs: number;
  private maxRetries: number;
  private initialBackoffMs: number;
  private fetchImpl: typeof fetch;
  private onTelemetry?: (event: PositionAlertTelemetryPayload) => void;
  private deliveryStore: PositionAlertDeliveryStore;
  private sentAlertsLog: PositionAlertCandidate[] = [];
  private inFlightDeliveries: Map<string, Promise<boolean>> = new Map();

  constructor(config: PositionTelegramNotifierConfig = {}) {
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    } else if (process.env.ATHENA_POSITION_ALERTS_ENABLED === 'true') {
      this.enabled = true;
    } else if (config.dryRun === true) {
      this.enabled = true;
    } else {
      this.enabled = false;
    }

    this.botToken =
      config.botToken ||
      process.env.ATHENA_POSITION_ALERTS_TELEGRAM_BOT_TOKEN ||
      process.env.POSITION_ALERT_TELEGRAM_BOT_TOKEN;
    this.chatId =
      config.chatId ||
      process.env.ATHENA_POSITION_ALERTS_TELEGRAM_CHAT_ID ||
      process.env.POSITION_ALERT_TELEGRAM_CHAT_ID;
    this.dryRun = config.dryRun ?? (process.env.NODE_ENV === 'test');
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.maxRetries = config.maxRetries ?? 3;
    this.initialBackoffMs = config.initialBackoffMs ?? 50;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.onTelemetry = config.onTelemetry;
    this.deliveryStore = new PositionAlertDeliveryStore(config.storePath);
  }

  public getDeliveryStore(): PositionAlertDeliveryStore {
    return this.deliveryStore;
  }

  public getDeliveryStatus(dedupeKey: string): PositionAlertDeliveryStatus | undefined {
    return this.deliveryStore.getStatus(dedupeKey);
  }

  /**
   * Dispatches a position alert candidate to the private Telegram destination.
   * Fully hardened against transient failures, timeouts, duplicates, and concurrency races.
   */
  public async notify(alert: PositionAlertCandidate): Promise<boolean> {
    const now = new Date().toISOString();
    const dedupeKey = alert.dedupeKey;

    // 1. Check if Delivery Subsystem is explicitly enabled
    if (!this.enabled) {
      this.emitTelemetry({
        event: 'DELIVERY_DISABLED',
        dedupeKey,
        alertId: alert.alertId,
        symbol: alert.symbol,
        positionId: alert.positionId,
        status: 'DISABLED',
        timestamp: now
      });
      return false;
    }

    // 2. Check if already delivered (Exact-Once / Deduplication / Restart Recovery)
    if (this.deliveryStore.isDelivered(dedupeKey)) {
      this.emitTelemetry({
        event: 'DUPLICATE_SUPPRESSED',
        dedupeKey,
        alertId: alert.alertId,
        symbol: alert.symbol,
        positionId: alert.positionId,
        status: 'SUPPRESSED_DUPLICATE',
        reason: 'ALREADY_DELIVERED',
        timestamp: now
      });
      return true;
    }

    // 3. Check if permanently failed (Do not enter infinite retry loop on permanent config/auth errors)
    if (this.deliveryStore.isPermanentlyFailed(dedupeKey)) {
      this.emitTelemetry({
        event: 'DUPLICATE_SUPPRESSED',
        dedupeKey,
        alertId: alert.alertId,
        symbol: alert.symbol,
        positionId: alert.positionId,
        status: 'FAILED_PERMANENT',
        reason: 'PERMANENT_FAILURE_SUPPRESSED',
        timestamp: now
      });
      return false;
    }

    // 4. Concurrency Race Prevention: Coalesce in-flight requests for the same dedupeKey
    const inFlight = this.inFlightDeliveries.get(dedupeKey);
    if (inFlight) {
      return inFlight;
    }

    const deliveryPromise = this.executeDelivery(alert);
    this.inFlightDeliveries.set(dedupeKey, deliveryPromise);

    try {
      return await deliveryPromise;
    } finally {
      this.inFlightDeliveries.delete(dedupeKey);
    }
  }

  private async executeDelivery(alert: PositionAlertCandidate): Promise<boolean> {
    const now = new Date().toISOString();
    const dedupeKey = alert.dedupeKey;
    this.sentAlertsLog.push(alert);

    // Dry-run mode for tests / offline validation (does not require real Telegram credentials)
    if (this.dryRun) {
      this.deliveryStore.saveRecord({
        deliveryId: `DEL_${alert.alertId}_${Date.now()}`,
        alertId: alert.alertId,
        dedupeKey,
        positionId: alert.positionId,
        symbol: alert.symbol,
        status: 'SENT',
        attemptCount: 1,
        lastAttemptAt: now,
        deliveredAt: now
      });

      this.emitTelemetry({
        event: 'DELIVERY_SUCCEEDED',
        dedupeKey,
        alertId: alert.alertId,
        symbol: alert.symbol,
        positionId: alert.positionId,
        status: 'SENT',
        attempt: 1,
        timestamp: now
      });
      return true;
    }

    // Missing Configuration Validation in non-dry-run mode (Fail-Safe, No Crash)
    if (!this.botToken || !this.chatId) {
      this.deliveryStore.saveRecord({
        deliveryId: `DEL_${alert.alertId}_${Date.now()}`,
        alertId: alert.alertId,
        dedupeKey,
        positionId: alert.positionId,
        symbol: alert.symbol,
        status: 'FAILED_PERMANENT',
        attemptCount: 0,
        lastAttemptAt: now,
        lastError: 'MISSING_TELEGRAM_CONFIGURATION',
        isPermanentFailure: true
      });

      this.emitTelemetry({
        event: 'CONFIGURATION_UNAVAILABLE',
        dedupeKey,
        alertId: alert.alertId,
        symbol: alert.symbol,
        positionId: alert.positionId,
        status: 'FAILED_PERMANENT',
        reason: 'MISSING_TELEGRAM_CREDENTIALS',
        timestamp: now
      });
      return false;
    }

    let attempts = 0;
    let lastError = '';

    while (attempts < this.maxRetries) {
      attempts++;
      const attemptTime = new Date().toISOString();

      this.emitTelemetry({
        event: 'DELIVERY_ATTEMPTED',
        dedupeKey,
        alertId: alert.alertId,
        symbol: alert.symbol,
        positionId: alert.positionId,
        attempt: attempts,
        timestamp: attemptTime
      });

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const message = this.formatAlertMessage(alert);
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

        const response = await this.fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: message,
            parse_mode: 'Markdown'
          }),
          signal: controller.signal
        });

        clearTimeout(timer);

        if (response.ok) {
          const successTime = new Date().toISOString();
          this.deliveryStore.saveRecord({
            deliveryId: `DEL_${alert.alertId}_${Date.now()}`,
            alertId: alert.alertId,
            dedupeKey,
            positionId: alert.positionId,
            symbol: alert.symbol,
            status: 'SENT',
            attemptCount: attempts,
            lastAttemptAt: successTime,
            deliveredAt: successTime
          });

          this.emitTelemetry({
            event: 'DELIVERY_SUCCEEDED',
            dedupeKey,
            alertId: alert.alertId,
            symbol: alert.symbol,
            positionId: alert.positionId,
            status: 'SENT',
            attempt: attempts,
            statusCode: response.status,
            timestamp: successTime
          });
          return true;
        }

        // Handle Non-200 Responses
        const status = response.status;
        lastError = `HTTP_${status}`;

        // Permanent Failures: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)
        if (status === 400 || status === 401 || status === 403 || status === 404) {
          this.deliveryStore.saveRecord({
            deliveryId: `DEL_${alert.alertId}_${Date.now()}`,
            alertId: alert.alertId,
            dedupeKey,
            positionId: alert.positionId,
            symbol: alert.symbol,
            status: 'FAILED_PERMANENT',
            attemptCount: attempts,
            lastAttemptAt: attemptTime,
            lastError,
            isPermanentFailure: true
          });

          this.emitTelemetry({
            event: 'DELIVERY_PERMANENT_FAILURE',
            dedupeKey,
            alertId: alert.alertId,
            symbol: alert.symbol,
            positionId: alert.positionId,
            status: 'FAILED_PERMANENT',
            attempt: attempts,
            statusCode: status,
            reason: `PERMANENT_HTTP_${status}`,
            timestamp: attemptTime
          });
          return false;
        }

        // Retryable Failures: 429 (Rate Limit), 5xx (Server Errors)
        let backoffMs = this.initialBackoffMs * Math.pow(2, attempts - 1);
        const retryAfterHeader = response.headers.get('Retry-After');
        if (retryAfterHeader) {
          const parsedSec = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsedSec) && parsedSec > 0) {
            backoffMs = Math.min(parsedSec * 1000, 5000);
          }
        }

        if (attempts < this.maxRetries) {
          await this.sleep(backoffMs);
        }
      } catch (err: any) {
        lastError = this.sanitizeError(err?.message || 'NETWORK_ERROR');
        if (attempts < this.maxRetries) {
          const backoffMs = this.initialBackoffMs * Math.pow(2, attempts - 1);
          await this.sleep(backoffMs);
        }
      }
    }

    // All retries exhausted -> FAILED_RETRYABLE
    const failureTime = new Date().toISOString();
    this.deliveryStore.saveRecord({
      deliveryId: `DEL_${alert.alertId}_${Date.now()}`,
      alertId: alert.alertId,
      dedupeKey,
      positionId: alert.positionId,
      symbol: alert.symbol,
      status: 'FAILED_RETRYABLE',
      attemptCount: attempts,
      lastAttemptAt: failureTime,
      lastError,
      isPermanentFailure: false
    });

    this.emitTelemetry({
      event: 'DELIVERY_RETRYABLE_FAILURE',
      dedupeKey,
      alertId: alert.alertId,
      symbol: alert.symbol,
      positionId: alert.positionId,
      status: 'FAILED_RETRYABLE',
      attempt: attempts,
      reason: lastError,
      timestamp: failureTime
    });

    return false;
  }

  /**
   * Formats a PositionAlertCandidate into a clean, compact Markdown Telegram message.
   * Strictly truthful with zero fabricated metrics or credentials.
   */
  public formatAlertMessage(alert: PositionAlertCandidate): string {
    const severityIcon = alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'WARNING' ? '⚠️' : 'ℹ️';
    
    let text = `${severityIcon} *PERSONAL POSITION ALERT*\n\n`;
    text += `*Symbol*: \`${alert.symbol}\`\n`;
    text += `*Type*: ${alert.alertType} (${alert.severity})\n`;
    text += `*Reason*: ${alert.reason}\n`;
    text += `*Position ID*: \`${alert.positionId}\`\n`;
    
    if (alert.marketData?.currentPrice !== undefined && alert.marketData.currentPrice !== null) {
      text += `*Market Price*: ₹${alert.marketData.currentPrice.toLocaleString('en-IN')}\n`;
    }
    
    if (alert.marketData?.previousPrice !== undefined && alert.marketData.previousPrice !== null) {
      text += `*Avg Price*: ₹${alert.marketData.previousPrice.toLocaleString('en-IN')}\n`;
    }
    
    text += `*Source*: ${alert.provenance.source}\n`;
    text += `*Time*: ${alert.timestamp}`;
    
    if (alert.provenance.url && alert.provenance.url.startsWith('http')) {
      text += `\n*Source Link*: [Read Announcement](${alert.provenance.url})`;
    }
    
    return text;
  }

  public getSentAlertsLog(): PositionAlertCandidate[] {
    return [...this.sentAlertsLog];
  }

  public clearSentLog(): void {
    this.sentAlertsLog = [];
  }

  private emitTelemetry(payload: PositionAlertTelemetryPayload): void {
    if (this.onTelemetry) {
      try {
        this.onTelemetry(payload);
      } catch {
        // Telemetry errors must never disrupt delivery
      }
    }
  }

  private sanitizeError(rawMessage: string): string {
    if (!rawMessage) return 'UNKNOWN_ERROR';
    if (this.botToken) {
      return rawMessage.replace(new RegExp(this.botToken, 'g'), '[REDACTED_TOKEN]');
    }
    return rawMessage;
  }

  private escapeMarkdown(text: string): string {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Mock notifier for isolated testing.
 */
export class MockPositionAlertNotifier implements PositionAlertNotifier {
  public readonly destinationId = 'MOCK_POSITION_NOTIFIER';
  public dispatchedAlerts: PositionAlertCandidate[] = [];
  private deliveryStatusMap: Map<string, PositionAlertDeliveryStatus> = new Map();

  public async notify(alert: PositionAlertCandidate): Promise<boolean> {
    this.dispatchedAlerts.push(alert);
    this.deliveryStatusMap.set(alert.dedupeKey, 'SENT');
    return true;
  }

  public getDeliveryStatus(dedupeKey: string): PositionAlertDeliveryStatus | undefined {
    return this.deliveryStatusMap.get(dedupeKey);
  }

  public clear(): void {
    this.dispatchedAlerts = [];
    this.deliveryStatusMap.clear();
  }
}
