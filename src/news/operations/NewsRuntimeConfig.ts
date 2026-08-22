/**
 * ATHENA NEWS ENGINE — STAGE 8.9 PRODUCTION CONTROL PLANE
 * NewsRuntimeConfig
 * 
 * Centralized, deterministic runtime configuration for ATHENA News Engine.
 * 
 * Supported Production Modes:
 * - PRODUCTION: Authoritative canonical V4 feed with V5 intelligence operating alongside.
 * - CANARY: Controlled opt-in routing to V5 feed for verified sessions.
 * - DIAGNOSTIC: Forensic telemetry & non-mutating test verification.
 * - SAFE_MODE: Emergency degradation preserving canonical ingestion and historical feed.
 */

export type ProductionMode = 'PRODUCTION' | 'CANARY' | 'DIAGNOSTIC' | 'SAFE_MODE';

export interface RuntimeConfigSnapshot {
  mode: ProductionMode;
  v4AuthorityEnabled: boolean;
  v5IntelligenceEnabled: boolean;
  canaryEnabled: boolean;
  canaryPercentage: number;
  telegramEnabled: boolean;
  aiEnrichmentEnabled: boolean;
  forexFactoryEnabled: boolean;
  economicCalendarEnabled: boolean;
  sourceExpansionEnabled: boolean;
  eventClusteringEnabled: boolean;
  diagnosticMode: boolean;
  safeMode: boolean;
  warnings: string[];
  lastUpdatedAt: string;
}

export type ConfigChangeListener = (config: RuntimeConfigSnapshot) => void;

export class NewsRuntimeConfig {
  private static instance: NewsRuntimeConfig | null = null;

  // Runtime State
  private mode: ProductionMode = 'PRODUCTION';
  private v4AuthorityEnabled: boolean = true;
  private v5IntelligenceEnabled: boolean = true;
  private canaryEnabled: boolean = false;
  private canaryPercentage: number = 0;
  private telegramEnabled: boolean = true;
  private aiEnrichmentEnabled: boolean = true;
  private forexFactoryEnabled: boolean = true;
  private economicCalendarEnabled: boolean = true;
  private sourceExpansionEnabled: boolean = true;
  private eventClusteringEnabled: boolean = true;
  private diagnosticMode: boolean = false;
  private safeMode: boolean = false;

  private warnings: string[] = [];
  private listeners: Set<ConfigChangeListener> = new Set();
  private lastUpdatedAt: string = new Date().toISOString();

  private constructor() {
    this.loadFromEnvironment();
  }

  public static getInstance(): NewsRuntimeConfig {
    if (!NewsRuntimeConfig.instance) {
      NewsRuntimeConfig.instance = new NewsRuntimeConfig();
    }
    return NewsRuntimeConfig.instance;
  }

  public static resetInstance(): NewsRuntimeConfig {
    NewsRuntimeConfig.instance = new NewsRuntimeConfig();
    return NewsRuntimeConfig.instance;
  }

  /**
   * Safely hydrates runtime configuration from environment variables with fallback defaults.
   */
  public loadFromEnvironment(): void {
    this.warnings = [];

    // Parse Mode
    const rawMode = (process.env.ATHENA_NEWS_MODE || process.env.NEWS_ENGINE_MODE || '').trim().toUpperCase();
    if (rawMode) {
      if (rawMode === 'PRODUCTION' || rawMode === 'CANARY' || rawMode === 'DIAGNOSTIC' || rawMode === 'SAFE_MODE') {
        this.mode = rawMode as ProductionMode;
      } else {
        this.warnings.push(`Invalid ATHENA_NEWS_MODE "${rawMode}". Falling back to PRODUCTION.`);
        this.mode = 'PRODUCTION';
      }
    } else {
      this.mode = 'PRODUCTION';
    }

    // Safe mode flag
    if (process.env.ATHENA_SAFE_MODE === 'true' || this.mode === 'SAFE_MODE') {
      this.safeMode = true;
      this.mode = 'SAFE_MODE';
    } else {
      this.safeMode = false;
    }

    // Canary percentage (0 to 100)
    const rawCanaryPct = process.env.ATHENA_CANARY_PERCENTAGE || process.env.VITE_NEWS_CANARY_PERCENT;
    if (rawCanaryPct !== undefined) {
      const parsedPct = Number(rawCanaryPct);
      if (!isNaN(parsedPct) && parsedPct >= 0 && parsedPct <= 100) {
        this.canaryPercentage = parsedPct;
        this.canaryEnabled = parsedPct > 0 || process.env.ATHENA_CANARY_ENABLED === 'true';
      } else {
        this.warnings.push(`Invalid canary percentage "${rawCanaryPct}". Defaulting to 0.`);
        this.canaryPercentage = 0;
        this.canaryEnabled = false;
      }
    } else {
      this.canaryPercentage = 0;
      this.canaryEnabled = process.env.ATHENA_CANARY_ENABLED === 'true';
    }

    // Telegram Enabled
    if (process.env.ATHENA_TELEGRAM_ENABLED === 'false' || process.env.TELEGRAM_NOTIFICATIONS_ENABLED === 'false') {
      this.telegramEnabled = false;
    } else {
      this.telegramEnabled = true;
    }

    // AI Enrichment Enabled
    if (process.env.ATHENA_AI_ENABLED === 'false' || process.env.VITE_AI_ENABLED === 'false') {
      this.aiEnrichmentEnabled = false;
    } else {
      this.aiEnrichmentEnabled = true;
    }

    // Forex Factory
    if (process.env.ATHENA_FOREX_FACTORY_ENABLED === 'false') {
      this.forexFactoryEnabled = false;
    } else {
      this.forexFactoryEnabled = true;
    }

    // Diagnostic mode
    this.diagnosticMode = this.mode === 'DIAGNOSTIC' || process.env.ATHENA_DIAGNOSTIC_MODE === 'true';

    // Safe mode defaults overrides
    if (this.safeMode) {
      this.applySafeModeOverrides();
    }

    this.lastUpdatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  private applySafeModeOverrides(): void {
    // In SAFE_MODE, prioritize canonical news ingestion and disable optional heavy/external enrichments
    this.aiEnrichmentEnabled = false;
    this.forexFactoryEnabled = false;
    this.canaryEnabled = false;
    this.canaryPercentage = 0;
  }

  // Getters
  public getMode(): ProductionMode {
    return this.mode;
  }

  public getRuntimeMode(): ProductionMode {
    return this.mode;
  }

  public isSafeMode(): boolean {
    return this.safeMode;
  }

  public isCanaryEnabled(): boolean {
    return this.canaryEnabled;
  }

  public getCanaryPercentage(): number {
    return this.canaryPercentage;
  }

  public isTelegramEnabled(): boolean {
    return this.telegramEnabled;
  }

  public isAIEnrichmentEnabled(): boolean {
    return this.aiEnrichmentEnabled;
  }

  public isForexFactoryEnabled(): boolean {
    return this.forexFactoryEnabled;
  }

  public isEconomicCalendarEnabled(): boolean {
    return this.economicCalendarEnabled;
  }

  public isSourceExpansionEnabled(): boolean {
    return this.sourceExpansionEnabled;
  }

  public isEventClusteringEnabled(): boolean {
    return this.eventClusteringEnabled;
  }

  public isV4AuthorityEnabled(): boolean {
    return this.v4AuthorityEnabled;
  }

  public isV5IntelligenceEnabled(): boolean {
    return this.v5IntelligenceEnabled;
  }

  public isDiagnosticMode(): boolean {
    return this.diagnosticMode;
  }

  public getWarnings(): string[] {
    return [...this.warnings];
  }

  // Operational Mutators
  public setMode(mode: ProductionMode): void {
    this.mode = mode;
    if (mode === 'SAFE_MODE') {
      this.safeMode = true;
      this.applySafeModeOverrides();
    } else if (mode === 'DIAGNOSTIC') {
      this.diagnosticMode = true;
      this.safeMode = false;
    } else {
      this.safeMode = false;
      this.diagnosticMode = false;
    }
    this.lastUpdatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  public setRuntimeMode(mode: ProductionMode): void {
    this.setMode(mode);
  }

  public setSafeMode(enabled: boolean): void {
    this.safeMode = enabled;
    if (enabled) {
      this.mode = 'SAFE_MODE';
      this.applySafeModeOverrides();
    } else {
      if (this.mode === 'SAFE_MODE') {
        this.mode = 'PRODUCTION';
      }
      this.aiEnrichmentEnabled = true;
      this.forexFactoryEnabled = true;
    }
    this.lastUpdatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  public setCanary(enabled: boolean, percentage: number = 0): void {
    this.canaryEnabled = enabled;
    this.canaryPercentage = Math.max(0, Math.min(100, percentage));
    this.lastUpdatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  public setTelegramEnabled(enabled: boolean): void {
    this.telegramEnabled = enabled;
    this.lastUpdatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  public setAIEnrichmentEnabled(enabled: boolean): void {
    this.aiEnrichmentEnabled = enabled;
    this.lastUpdatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  public setForexFactoryEnabled(enabled: boolean): void {
    this.forexFactoryEnabled = enabled;
    this.lastUpdatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  public setSourceExpansionEnabled(enabled: boolean): void {
    this.sourceExpansionEnabled = enabled;
    this.lastUpdatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  public setEventClusteringEnabled(enabled: boolean): void {
    this.eventClusteringEnabled = enabled;
    this.lastUpdatedAt = new Date().toISOString();
    this.notifyListeners();
  }

  public subscribe(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn('[NewsRuntimeConfig] Listener error:', err);
      }
    }
  }

  public getSnapshot(): RuntimeConfigSnapshot {
    return {
      mode: this.mode,
      v4AuthorityEnabled: this.v4AuthorityEnabled,
      v5IntelligenceEnabled: this.v5IntelligenceEnabled,
      canaryEnabled: this.canaryEnabled,
      canaryPercentage: this.canaryPercentage,
      telegramEnabled: this.telegramEnabled,
      aiEnrichmentEnabled: this.aiEnrichmentEnabled,
      forexFactoryEnabled: this.forexFactoryEnabled,
      economicCalendarEnabled: this.economicCalendarEnabled,
      sourceExpansionEnabled: this.sourceExpansionEnabled,
      eventClusteringEnabled: this.eventClusteringEnabled,
      diagnosticMode: this.diagnosticMode,
      safeMode: this.safeMode,
      warnings: [...this.warnings],
      lastUpdatedAt: this.lastUpdatedAt
    };
  }

  public toJSON(): any {
    return {
      runtimeMode: this.mode,
      isSafeMode: this.safeMode,
      telegramEnabled: this.telegramEnabled,
      aiEnrichmentEnabled: this.aiEnrichmentEnabled,
      canaryEnabled: this.canaryEnabled,
      canaryPercentage: this.canaryPercentage,
      forexFactoryEnabled: this.forexFactoryEnabled,
      sourceExpansionEnabled: this.sourceExpansionEnabled,
      timestamp: this.lastUpdatedAt
    };
  }
}

export const newsRuntimeConfig = NewsRuntimeConfig.getInstance();
