/**
 * ATHENA — PHASE 10P-8: REAL-TIME POSITION ALERT RUNTIME WIRING
 * PositionAlertRuntimeGuard.ts
 * 
 * Production runtime feature flag and configuration guard for personal position alerts.
 * 
 * Strict Guarantees:
 * - Defaults to OFF: ATHENA_POSITION_ALERTS_ENABLED=false.
 * - When false: Zero alert evaluation, zero Telegram network requests, zero delivery records.
 * - Never log secrets: Telegram bot tokens are never logged or exposed.
 * - Safe config telemetry: Detects credential availability without leaking token strings.
 */

export interface PositionAlertConfigStatus {
  enabled: boolean;
  hasBotToken: boolean;
  hasChatId: boolean;
  isConfigured: boolean;
}

export class PositionAlertRuntimeGuard {
  private static runtimeOverride: boolean | null = null;

  /**
   * Determines whether personal position alerts are enabled at runtime.
   * STRICT DEFAULT: false.
   */
  public static isAlertsEnabled(): boolean {
    if (this.runtimeOverride !== null) {
      return this.runtimeOverride;
    }

    const envVal = (process.env.ATHENA_POSITION_ALERTS_ENABLED || '').trim().toLowerCase();
    return envVal === 'true' || envVal === '1';
  }

  /**
   * Sets a runtime override for test isolation.
   */
  public static setRuntimeOverride(override: boolean | null): void {
    this.runtimeOverride = override;
  }

  /**
   * Resets the runtime override to default environment inspection.
   */
  public static reset(): void {
    this.runtimeOverride = null;
  }

  /**
   * Checks if Telegram credentials are provided in environment without logging the token.
   */
  public static getConfigStatus(): PositionAlertConfigStatus {
    const botToken =
      process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN ||
      process.env.ATHENA_POSITION_ALERTS_TELEGRAM_BOT_TOKEN ||
      process.env.POSITION_ALERT_TELEGRAM_BOT_TOKEN;

    const chatId =
      process.env.ATHENA_POSITION_ALERTS_CHAT_ID ||
      process.env.ATHENA_POSITION_ALERTS_TELEGRAM_CHAT_ID ||
      process.env.POSITION_ALERT_TELEGRAM_CHAT_ID;

    const hasBotToken = Boolean(botToken && botToken.trim().length > 0);
    const hasChatId = Boolean(chatId && chatId.trim().length > 0);
    const enabled = this.isAlertsEnabled();

    return {
      enabled,
      hasBotToken,
      hasChatId,
      isConfigured: enabled && hasBotToken && hasChatId
    };
  }

  /**
   * Returns a sanitized, safe descriptor for logs and monitoring. Zero secrets.
   */
  public static getSafeTelemetryDescriptor(): string {
    const status = this.getConfigStatus();
    return `[PositionAlertRuntimeGuard] enabled=${status.enabled} hasBotToken=${status.hasBotToken} hasChatId=${status.hasChatId} isConfigured=${status.isConfigured}`;
  }
}
