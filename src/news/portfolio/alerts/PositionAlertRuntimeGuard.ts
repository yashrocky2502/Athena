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
  killSwitchActive: boolean;
  isDeliveryPermitted: boolean;
  hasBotToken: boolean;
  hasChatId: boolean;
  isConfigured: boolean;
}

export class PositionAlertRuntimeGuard {
  private static runtimeOverride: boolean | null = null;
  private static killSwitchOverride: boolean | null = null;

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
   * Checks whether the hard kill switch is active.
   * ATHENA_POSITION_ALERTS_KILL_SWITCH=true or 1 blocks all position alert delivery.
   * Kill switch takes absolute precedence over the feature flag.
   */
  public static isKillSwitchActive(): boolean {
    if (this.killSwitchOverride !== null) {
      return this.killSwitchOverride;
    }

    const envVal = (process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH || '').trim().toLowerCase();
    return envVal === 'true' || envVal === '1';
  }

  /**
   * Determines whether position alert delivery is permitted.
   * Delivery is permitted IF AND ONLY IF:
   * 1. Kill switch is NOT active.
   * 2. Alerts feature flag is explicitly enabled.
   */
  public static isDeliveryPermitted(): boolean {
    if (this.isKillSwitchActive()) {
      return false;
    }
    return this.isAlertsEnabled();
  }

  /**
   * Sets a runtime override for test isolation.
   */
  public static setRuntimeOverride(override: boolean | null): void {
    this.runtimeOverride = override;
  }

  /**
   * Sets a kill switch override for test isolation.
   */
  public static setKillSwitchOverride(override: boolean | null): void {
    this.killSwitchOverride = override;
  }

  /**
   * Resets all runtime and kill switch overrides to default environment inspection.
   */
  public static reset(): void {
    this.runtimeOverride = null;
    this.killSwitchOverride = null;
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
    const killSwitchActive = this.isKillSwitchActive();
    const isDeliveryPermitted = this.isDeliveryPermitted();

    return {
      enabled,
      killSwitchActive,
      isDeliveryPermitted,
      hasBotToken,
      hasChatId,
      isConfigured: isDeliveryPermitted && hasBotToken && hasChatId
    };
  }

  /**
   * Returns a sanitized, safe descriptor for logs and monitoring. Zero secrets.
   */
  public static getSafeTelemetryDescriptor(): string {
    const status = this.getConfigStatus();
    return `[PositionAlertRuntimeGuard] enabled=${status.enabled} killSwitch=${status.killSwitchActive} deliveryPermitted=${status.isDeliveryPermitted} hasBotToken=${status.hasBotToken} hasChatId=${status.hasChatId} isConfigured=${status.isConfigured}`;
  }
}
