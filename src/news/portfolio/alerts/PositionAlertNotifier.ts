/**
 * ATHENA — PHASE 10P-2: PERSONAL POSITION ALERT FOUNDATION
 * PositionAlertNotifier.ts
 * 
 * Separate, Private Telegram Destination for Personal Position Alerts.
 * 
 * Strict Architectural Separation:
 * 1. Decoupled from News Core V2: NEVER touches or writes to data/telegram_outbox.json.
 * 2. Configuration Isolation: Uses separate credentials (POSITION_ALERT_TELEGRAM_BOT_TOKEN / POSITION_ALERT_TELEGRAM_CHAT_ID).
 * 3. Dry-Run / Test Safety: Zero external HTTP requests during tests or when dryRun is active.
 */

import {
  PositionAlertCandidate,
  PositionAlertNotifier,
  PositionTelegramNotifierConfig
} from './types.ts';

export class PrivatePositionTelegramNotifier implements PositionAlertNotifier {
  public readonly destinationId = 'PRIVATE_POSITION_TELEGRAM';
  private botToken?: string;
  private chatId?: string;
  private enabled: boolean;
  private dryRun: boolean;
  private sentAlertsLog: PositionAlertCandidate[] = [];

  constructor(config: PositionTelegramNotifierConfig = {}) {
    this.botToken = config.botToken || process.env.POSITION_ALERT_TELEGRAM_BOT_TOKEN;
    this.chatId = config.chatId || process.env.POSITION_ALERT_TELEGRAM_CHAT_ID;
    this.enabled = config.enabled ?? true;
    this.dryRun = config.dryRun ?? (process.env.NODE_ENV === 'test' || !this.botToken || !this.chatId);
  }

  /**
   * Dispatches a position-scoped alert.
   */
  public async notify(alert: PositionAlertCandidate): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    this.sentAlertsLog.push(alert);

    // In dry-run mode (or tests), log and return success without network call
    if (this.dryRun || !this.botToken || !this.chatId) {
      return true;
    }

    try {
      const message = this.formatAlertMessage(alert);
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      if (!response.ok) {
        console.error(`[PrivatePositionTelegramNotifier] Telegram API error: ${response.status} ${response.statusText}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[PrivatePositionTelegramNotifier] Failed to send Telegram alert:', err);
      return false;
    }
  }

  /**
   * Formats a PositionAlertCandidate into a Markdown-styled Telegram message.
   */
  public formatAlertMessage(alert: PositionAlertCandidate): string {
    const severityIcon = alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'WARNING' ? '⚠️' : 'ℹ️';
    
    let text = `${severityIcon} *PERSONAL POSITION ALERT*\n`;
    text += `*Symbol*: \`${alert.symbol}\`\n`;
    text += `*Type*: ${alert.alertType} (${alert.severity})\n`;
    text += `*Reason*: ${alert.reason}\n`;
    text += `*Position ID*: \`${alert.positionId}\`\n`;
    
    if (alert.marketData?.currentPrice !== undefined && alert.marketData.currentPrice !== null) {
      text += `*Market Price*: ₹${alert.marketData.currentPrice.toLocaleString('en-IN')}\n`;
    }
    
    text += `*Source*: ${alert.provenance.source}\n`;
    text += `*Time*: ${alert.timestamp}`;
    
    return text;
  }

  public getSentAlertsLog(): PositionAlertCandidate[] {
    return [...this.sentAlertsLog];
  }

  public clearSentLog(): void {
    this.sentAlertsLog = [];
  }
}

/**
 * Mock notifier for isolated testing.
 */
export class MockPositionAlertNotifier implements PositionAlertNotifier {
  public readonly destinationId = 'MOCK_POSITION_NOTIFIER';
  public dispatchedAlerts: PositionAlertCandidate[] = [];

  public async notify(alert: PositionAlertCandidate): Promise<boolean> {
    this.dispatchedAlerts.push(alert);
    return true;
  }

  public clear(): void {
    this.dispatchedAlerts = [];
  }
}
