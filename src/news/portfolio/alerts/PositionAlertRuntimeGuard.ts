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

export type PositionAlertOperationalState = 'DISABLED' | 'DRY_RUN' | 'CONTROLLED_READY' | 'LIVE';

export type PositionAlertAuditReasonCode =
  | 'NOT_ENABLED'
  | 'KILL_SWITCH_ACTIVE'
  | 'INVALID_CONFIGURATION'
  | 'MISSING_PREREQUISITE'
  | 'SOURCE_INVALID'
  | 'POSITION_IRRELEVANT'
  | 'PROVENANCE_INVALID'
  | 'DUPLICATE'
  | 'DRY_RUN'
  | 'READY_FOR_CONTROLLED_ACTIVATION'
  | 'LIVE_DELIVERY_BLOCKED';

export interface PositionAlertConfigStatus {
  enabled: boolean;
  killSwitchActive: boolean;
  isDeliveryPermitted: boolean;
  hasBotToken: boolean;
  hasChatId: boolean;
  isConfigured: boolean;
  operationalState: PositionAlertOperationalState;
  auditReasonCode: PositionAlertAuditReasonCode;
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
   * ATHENA_POSITION_ALERTS_KILL_SWITCH controls kill switch state.
   * Kill switch takes absolute precedence over the feature flag.
   * 
   * Fail-Closed Safety Rules:
   * - Missing / Undefined => ACTIVE / BLOCKED
   * - Empty / Whitespace => ACTIVE / BLOCKED
   * - "true" / "TRUE" / "1" => ACTIVE / BLOCKED
   * - Arbitrary / Unrecognized => ACTIVE / BLOCKED
   * - "false" / "FALSE" / "0" (explicit recognized false) => INACTIVE
   */
  public static isKillSwitchActive(): boolean {
    if (this.killSwitchOverride !== null) {
      return this.killSwitchOverride;
    }

    const rawVal = process.env.ATHENA_POSITION_ALERTS_KILL_SWITCH;
    if (rawVal === undefined || rawVal === null) {
      return true;
    }

    const trimmed = rawVal.trim().toLowerCase();
    if (trimmed === 'false' || trimmed === '0') {
      return false;
    }

    return true;
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
   * Determines the formal operational state.
   */
  public static getOperationalState(): PositionAlertOperationalState {
    if (this.isKillSwitchActive() || !this.isAlertsEnabled()) {
      return 'DISABLED';
    }

    const status = this.getConfigStatusCore();
    if (!status.hasBotToken || !status.hasChatId) {
      return 'DRY_RUN';
    }

    const liveConfirmed = (process.env.ATHENA_POSITION_ALERTS_LIVE_CONFIRMED || '').trim().toLowerCase();
    if (liveConfirmed === 'true' || liveConfirmed === '1') {
      return 'LIVE';
    }

    return 'CONTROLLED_READY';
  }

  /**
   * Determines the formal audit reason code.
   */
  public static getAuditReasonCode(): PositionAlertAuditReasonCode {
    if (this.isKillSwitchActive()) {
      return 'KILL_SWITCH_ACTIVE';
    }
    if (!this.isAlertsEnabled()) {
      return 'NOT_ENABLED';
    }

    const status = this.getConfigStatusCore();
    if (!status.hasBotToken || !status.hasChatId) {
      return 'MISSING_PREREQUISITE';
    }

    const liveConfirmed = (process.env.ATHENA_POSITION_ALERTS_LIVE_CONFIRMED || '').trim().toLowerCase();
    if (liveConfirmed !== 'true' && liveConfirmed !== '1') {
      return 'LIVE_DELIVERY_BLOCKED';
    }

    return 'READY_FOR_CONTROLLED_ACTIVATION';
  }

  private static getConfigStatusCore(): { hasBotToken: boolean; hasChatId: boolean } {
    const botToken =
      process.env.ATHENA_POSITION_ALERTS_BOT_TOKEN ||
      process.env.ATHENA_POSITION_ALERTS_TELEGRAM_BOT_TOKEN ||
      process.env.POSITION_ALERT_TELEGRAM_BOT_TOKEN;

    const chatId =
      process.env.ATHENA_POSITION_ALERTS_CHAT_ID ||
      process.env.ATHENA_POSITION_ALERTS_TELEGRAM_CHAT_ID ||
      process.env.POSITION_ALERT_TELEGRAM_CHAT_ID;

    return {
      hasBotToken: Boolean(botToken && botToken.trim().length > 0),
      hasChatId: Boolean(chatId && chatId.trim().length > 0)
    };
  }

  /**
   * Checks if Telegram credentials are provided in environment without logging the token.
   */
  public static getConfigStatus(): PositionAlertConfigStatus {
    const core = this.getConfigStatusCore();
    const enabled = this.isAlertsEnabled();
    const killSwitchActive = this.isKillSwitchActive();
    const isDeliveryPermitted = this.isDeliveryPermitted();
    const operationalState = this.getOperationalState();
    const auditReasonCode = this.getAuditReasonCode();

    return {
      enabled,
      killSwitchActive,
      isDeliveryPermitted,
      hasBotToken: core.hasBotToken,
      hasChatId: core.hasChatId,
      isConfigured: isDeliveryPermitted && core.hasBotToken && core.hasChatId,
      operationalState,
      auditReasonCode
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
