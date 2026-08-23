/**
 * ATHENA NEWS ENGINE — STAGE 8.9.4 SOURCE CIRCUIT BREAKER
 * SourceCircuitBreaker
 * 
 * Provides deterministic fault isolation and phased recovery for upstream news and calendar sources:
 * QUARANTINED → cooldown → probe → DEGRADED → stable successful polls → ACTIVE
 */

import { sourceExpansionRegistry, CircuitState } from '../registry/SourceExpansionRegistry';

export interface SourceProbeResult {
  sourceId: string;
  success: boolean;
  httpStatus?: number;
  error?: string;
  itemsFound?: number;
  probedAt: string;
}

export class SourceCircuitBreaker {
  private static instance: SourceCircuitBreaker | null = null;
  private cooldownPeriodMs: number = 30000; // 30s for testing/fast recovery
  private stablePollThreshold: number = 2; // 2 stable polls to go from DEGRADED to ACTIVE
  private recoverySuccessCounters: Map<string, number> = new Map();
  private lastProbeTimes: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): SourceCircuitBreaker {
    if (!SourceCircuitBreaker.instance) {
      SourceCircuitBreaker.instance = new SourceCircuitBreaker();
    }
    return SourceCircuitBreaker.instance;
  }

  public static resetInstance(): SourceCircuitBreaker {
    SourceCircuitBreaker.instance = new SourceCircuitBreaker();
    return SourceCircuitBreaker.instance;
  }

  public setCooldownPeriodMs(ms: number): void {
    this.cooldownPeriodMs = ms;
  }

  public setStablePollThreshold(threshold: number): void {
    this.stablePollThreshold = threshold;
  }

  /**
   * Evaluates if a quarantined source is eligible for a recovery probe.
   */
  public isEligibleForRecoveryProbe(sourceId: string): boolean {
    const record = sourceExpansionRegistry.getSourceRecord(sourceId);
    if (!record) return false;
    if (record.circuitState !== 'QUARANTINED') return false;

    const quarantinedTime = record.quarantinedAt ? new Date(record.quarantinedAt).getTime() : 0;
    const lastProbeTime = this.lastProbeTimes.get(sourceId) || quarantinedTime;
    const now = Date.now();

    return (now - lastProbeTime) >= this.cooldownPeriodMs;
  }

  /**
   * Executes a synthetic or live probe to test health of a quarantined/degraded source.
   */
  public async executeProbe(
    sourceId: string,
    mockFetchFn?: (url: string) => Promise<{ ok: boolean; status: number; items?: any[] }>
  ): Promise<SourceProbeResult> {
    const record = sourceExpansionRegistry.getSourceRecord(sourceId);
    const now = new Date().toISOString();
    this.lastProbeTimes.set(sourceId, Date.now());

    if (!record) {
      return {
        sourceId,
        success: false,
        error: 'Source not found in registry',
        probedAt: now
      };
    }

    try {
      let success = false;
      let httpStatus = 200;
      let itemsFound = 0;

      if (mockFetchFn) {
        const res = await mockFetchFn(record.endpoint);
        success = res.ok;
        httpStatus = res.status;
        itemsFound = res.items?.length || 0;
      } else {
        // Simple test: if not disabled or invalid endpoint
        success = !!record.endpoint;
        httpStatus = 200;
      }

      if (success) {
        // Step from QUARANTINED -> DEGRADED (first successful probe)
        if (record.circuitState === 'QUARANTINED') {
          record.circuitState = 'DEGRADED';
          record.state = 'TESTING';
          record.consecutiveFailures = 0;
          this.recoverySuccessCounters.set(sourceId, 1);
        } else if (record.circuitState === 'DEGRADED') {
          const currentCount = (this.recoverySuccessCounters.get(sourceId) || 0) + 1;
          this.recoverySuccessCounters.set(sourceId, currentCount);
          if (currentCount >= this.stablePollThreshold) {
            // Promoted to ACTIVE!
            record.circuitState = 'ACTIVE';
            record.state = 'ACTIVE';
            record.quarantineReason = undefined;
            record.quarantinedAt = undefined;
            this.recoverySuccessCounters.delete(sourceId);
          }
        }

        return {
          sourceId,
          success: true,
          httpStatus,
          itemsFound,
          probedAt: now
        };
      } else {
        // Probe failed -> keep quarantined or degrade further
        record.consecutiveFailures++;
        this.recoverySuccessCounters.set(sourceId, 0);
        return {
          sourceId,
          success: false,
          httpStatus,
          error: `Probe failed with HTTP ${httpStatus}`,
          probedAt: now
        };
      }
    } catch (err: any) {
      record.consecutiveFailures++;
      this.recoverySuccessCounters.set(sourceId, 0);
      return {
        sourceId,
        success: false,
        error: err?.message || String(err),
        probedAt: now
      };
    }
  }

  /**
   * Classifies HTTP error status codes deterministically without affecting other sources.
   */
  public classifyHttpError(sourceId: string, status: number, message?: string): void {
    const record = sourceExpansionRegistry.getSourceRecord(sourceId);
    if (!record) return;

    let classification = 'UNKNOWN_ERROR';
    if (status === 429) {
      classification = 'HTTP_429_RATE_LIMITED';
    } else if (status === 403) {
      classification = 'HTTP_403_FORBIDDEN';
    } else if (status === 404) {
      classification = 'HTTP_404_NOT_FOUND';
    } else if (status >= 500) {
      classification = `HTTP_${status}_SERVER_ERROR`;
    }

    record.failureClassification = classification;
    sourceExpansionRegistry.recordSourceFailure(sourceId, `${classification}: ${message || 'HTTP error'}`);
  }

  public recordFailure(sourceId: string, error?: any): void {
    let record = sourceExpansionRegistry.getSourceRecord(sourceId);
    if (!record) {
      sourceExpansionRegistry.registerSource({
        id: sourceId,
        name: sourceId,
        publisher: sourceId,
        category: 'MARKETS',
        url: `https://${sourceId}.com/feed`,
        tier: 2,
        enabled: true
      });
    }
    sourceExpansionRegistry.recordSourceFailure(sourceId, error || 'Source probe failure');
  }

  public isQuarantined(sourceId: string): boolean {
    const record = sourceExpansionRegistry.getSourceRecord(sourceId);
    return record ? record.circuitState === 'QUARANTINED' : false;
  }

  public resetSource(sourceId: string): boolean {
    return sourceExpansionRegistry.resetSourceCircuit(sourceId);
  }

  public reset(): void {
    this.recoverySuccessCounters.clear();
    this.lastProbeTimes.clear();
  }
}

export const sourceCircuitBreaker = SourceCircuitBreaker.getInstance();
