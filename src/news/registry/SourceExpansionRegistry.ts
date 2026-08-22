/**
 * ATHENA NEWS ENGINE — STAGE 8.7 SOURCE EXPANSION REGISTRY
 * SourceExpansionRegistry
 * 
 * Production registry for dynamic source discovery, expansion, health validation,
 * circuit breaker management, and automated quarantine protection.
 */

import { LiveSourceFeedConfig } from '../ingestion/LiveSourceProviders';

export type CircuitState = 'ACTIVE' | 'DEGRADED' | 'QUARANTINED' | 'DISABLED';
export type SourceRegistrationState = 'REGISTERED' | 'TESTING' | 'ACTIVE' | 'QUARANTINED' | 'DISABLED';

export interface SourceExpansionRecord {
  sourceId: string;
  publisher: string;
  sourceType: string;
  endpoint: string;
  feed?: string;
  enabled: boolean;
  pollInterval: number;
  timeout: number;
  authorityTier: number;
  categories: string[];
  lastPollAt: string | null;
  lastSuccessfulPollAt: string | null;
  lastSuccessfulArticleAt: string | null;
  consecutiveFailures: number;
  circuitState: CircuitState;
  failureClassification?: string;
  nextRetry?: string;

  config: LiveSourceFeedConfig;
  state: SourceRegistrationState;
  registeredAt: string;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  totalItemsFetched: number;
  quarantineReason?: string;
  quarantinedAt?: string;
}

export class SourceExpansionRegistry {
  private static instance: SourceExpansionRegistry | null = null;
  private sources: Map<string, SourceExpansionRecord> = new Map();

  private constructor() {}

  public static getInstance(): SourceExpansionRegistry {
    if (!SourceExpansionRegistry.instance) {
      SourceExpansionRegistry.instance = new SourceExpansionRegistry();
    }
    return SourceExpansionRegistry.instance;
  }

  public static resetInstance(): SourceExpansionRegistry {
    SourceExpansionRegistry.instance = new SourceExpansionRegistry();
    return SourceExpansionRegistry.instance;
  }

  /**
   * Operational Action: Enables a source for active polling.
   */
  public enableSource(sourceId: string): boolean {
    const record = this.sources.get(sourceId);
    if (!record) return false;
    record.enabled = true;
    record.config.enabled = true;
    if (record.state === 'DISABLED') {
      record.state = 'ACTIVE';
      record.circuitState = 'ACTIVE';
    }
    return true;
  }

  /**
   * Operational Action: Disables a source without deleting its history.
   */
  public disableSource(sourceId: string): boolean {
    const record = this.sources.get(sourceId);
    if (!record) return false;
    record.enabled = false;
    record.config.enabled = false;
    record.state = 'DISABLED';
    record.circuitState = 'DISABLED';
    return true;
  }

  /**
   * Operational Action: Manually quarantines a source.
   */
  public quarantineSource(sourceId: string, reason = 'Operator quarantined source'): boolean {
    const record = this.sources.get(sourceId);
    if (!record) return false;
    record.state = 'QUARANTINED';
    record.circuitState = 'QUARANTINED';
    record.quarantineReason = reason;
    record.quarantinedAt = new Date().toISOString();
    return true;
  }

  /**
   * Operational Action: Resets a source's circuit breaker and failures.
   */
  public resetSourceCircuit(sourceId: string): boolean {
    const record = this.sources.get(sourceId);
    if (!record) return false;
    record.consecutiveFailures = 0;
    record.failureClassification = undefined;
    record.nextRetry = undefined;
    record.quarantineReason = undefined;
    record.quarantinedAt = undefined;
    record.state = record.enabled ? 'ACTIVE' : 'DISABLED';
    record.circuitState = record.enabled ? 'ACTIVE' : 'DISABLED';
    return true;
  }

  public getSourceStatus(sourceId: string) {
    const record = this.sources.get(sourceId);
    if (!record) return null;
    return {
      sourceId: record.sourceId,
      publisher: record.publisher,
      sourceType: record.sourceType,
      enabled: record.enabled,
      circuitState: record.circuitState,
      consecutiveFailures: record.consecutiveFailures,
      lastSuccessfulPoll: record.lastSuccessfulPollAt,
      lastSuccessfulArticle: record.lastSuccessfulArticleAt,
      nextRetry: record.nextRetry,
      failureClassification: record.failureClassification,
      quarantineReason: record.quarantineReason
    };
  }

  public getAllSourceStatuses() {
    return Array.from(this.sources.values()).map(r => ({
      sourceId: r.sourceId,
      publisher: r.publisher,
      sourceType: r.sourceType,
      enabled: r.enabled,
      circuitState: r.circuitState,
      consecutiveFailures: r.consecutiveFailures,
      lastSuccessfulPoll: r.lastSuccessfulPollAt,
      lastSuccessfulArticle: r.lastSuccessfulArticleAt,
      nextRetry: r.nextRetry,
      failureClassification: r.failureClassification,
      quarantineReason: r.quarantineReason
    }));
  }

  /**
   * Registers a new live source feed dynamically.
   */
  public registerSource(config: LiveSourceFeedConfig, autoPromote = true): SourceExpansionRecord {
    const initialState: SourceRegistrationState = autoPromote ? 'ACTIVE' : 'REGISTERED';
    const initialCircuit: CircuitState = autoPromote ? 'ACTIVE' : 'DISABLED';
    const isEnabled = config.enabled !== false;

    const sourceConfig: LiveSourceFeedConfig = {
      ...config,
      enabled: isEnabled
    };

    const record: SourceExpansionRecord = {
      sourceId: config.id,
      publisher: config.publisher || 'Unknown',
      sourceType: (config as any).sourceType || 'RSS',
      endpoint: config.url || '',
      feed: config.url || '',
      enabled: isEnabled,
      pollInterval: (config as any).pollInterval || 60000,
      timeout: (config as any).timeout || 15000,
      authorityTier: config.tier || 2,
      categories: [config.category || 'MARKETS'],
      lastPollAt: null,
      lastSuccessfulPollAt: null,
      lastSuccessfulArticleAt: null,
      consecutiveFailures: 0,
      circuitState: initialCircuit,

      config: sourceConfig,
      state: initialState,
      registeredAt: new Date().toISOString(),
      lastTestedAt: null,
      lastSuccessAt: null,
      totalItemsFetched: 0
    };

    this.sources.set(config.id, record);
    return record;
  }

  /**
   * Deregisters / removes a source from the expansion registry.
   */
  public unregisterSource(sourceId: string): boolean {
    return this.sources.delete(sourceId);
  }

  /**
   * Promotes a registered source after passing health validation.
   */
  public promoteToActive(sourceId: string): boolean {
    const record = this.sources.get(sourceId);
    if (!record || record.state === 'QUARANTINED') return false;
    record.state = 'ACTIVE';
    record.circuitState = 'ACTIVE';
    record.consecutiveFailures = 0;
    return true;
  }

  /**
   * Records a poll attempt for a source.
   */
  public recordPollAttempt(sourceId: string): void {
    const record = this.sources.get(sourceId);
    if (!record) return;
    const now = new Date().toISOString();
    record.lastPollAt = now;
    record.lastTestedAt = now;
  }

  /**
   * Records a successful fetch run for a registered source.
   */
  public recordSourceSuccess(sourceId: string, itemsFetched: number): void {
    const record = this.sources.get(sourceId);
    if (!record) return;

    const now = new Date().toISOString();
    record.lastSuccessAt = now;
    record.lastSuccessfulPollAt = now;
    record.lastTestedAt = now;
    if (itemsFetched > 0) {
      record.lastSuccessfulArticleAt = now;
    }
    record.consecutiveFailures = 0;
    record.totalItemsFetched += itemsFetched;

    if (record.state === 'TESTING' || record.state === 'REGISTERED' || record.circuitState === 'DEGRADED') {
      record.state = 'ACTIVE';
      record.circuitState = 'ACTIVE';
    }
  }

  /**
   * Records a failed fetch run and triggers circuit breaker if consecutive failures >= 3.
   */
  public recordSourceFailure(sourceId: string, error: any): void {
    const record = this.sources.get(sourceId);
    if (!record) return;

    const now = new Date().toISOString();
    record.lastTestedAt = now;
    record.lastPollAt = now;
    record.consecutiveFailures++;

    const errorMsg = String(error?.message || error || 'Source fetch error');

    if (record.consecutiveFailures === 2 && record.circuitState === 'ACTIVE') {
      record.circuitState = 'DEGRADED';
    }

    // Circuit Breaker: Quarantine after 3 consecutive failures
    if (record.consecutiveFailures >= 3 && record.state !== 'QUARANTINED') {
      record.state = 'QUARANTINED';
      record.circuitState = 'QUARANTINED';
      record.quarantineReason = `Circuit Breaker Tripped: 3 consecutive failures (${errorMsg})`;
      record.quarantinedAt = now;
      console.warn(`[SourceExpansionRegistry] Source '${sourceId}' quarantined: ${record.quarantineReason}`);
    }
  }

  /**
   * Reinstates a quarantined source after manual inspection or reset.
   */
  public reinstateSource(sourceId: string): boolean {
    const record = this.sources.get(sourceId);
    if (!record) return false;

    record.state = 'TESTING';
    record.circuitState = 'ACTIVE';
    record.consecutiveFailures = 0;
    record.quarantineReason = undefined;
    record.quarantinedAt = undefined;
    return true;
  }

  public getActiveSources(): LiveSourceFeedConfig[] {
    return Array.from(this.sources.values())
      .filter(r => r.state === 'ACTIVE' && r.config.enabled)
      .map(r => r.config);
  }

  public getSourceRecord(sourceId: string): SourceExpansionRecord | undefined {
    return this.sources.get(sourceId);
  }

  public getAllSources(): SourceExpansionRecord[] {
    return Array.from(this.sources.values());
  }

  public getQuarantinedSources(): SourceExpansionRecord[] {
    return Array.from(this.sources.values()).filter(r => r.state === 'QUARANTINED');
  }

  public reset(): void {
    this.sources.clear();
  }
}

export const sourceExpansionRegistry = SourceExpansionRegistry.getInstance();
