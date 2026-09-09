/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalFutureFirewall.ts
 * 
 * Tomorrow / Future Information Firewall.
 * Multi-layer defense-in-depth boundary that intercepts and rejects any data
 * whose timestamp is in the future relative to the active replay timestamp.
 */

import { LookAheadViolation } from './types.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';

export type FirewallLayer = 
  | 'INGESTION' 
  | 'NORMALIZATION' 
  | 'EVENT_BUS' 
  | 'ORCHESTRATION' 
  | 'SIGNAL' 
  | 'STRATEGY' 
  | 'PORTFOLIO' 
  | 'EXECUTION' 
  | 'AI_INTERPRETATION';

export class HistoricalFutureFirewall {
  private static instance: HistoricalFutureFirewall;
  private violations: LookAheadViolation[] = [];
  private activeReplayTimestamp: string | null = null;
  private isEnforced: boolean = true;

  private constructor() {}

  public static getInstance(): HistoricalFutureFirewall {
    if (!HistoricalFutureFirewall.instance) {
      HistoricalFutureFirewall.instance = new HistoricalFutureFirewall();
    }
    return HistoricalFutureFirewall.instance;
  }

  /**
   * Sets the active replay timestamp cursor
   */
  public setReplayCursor(timestampIso: string): void {
    this.activeReplayTimestamp = timestampIso;
  }

  /**
   * Clears the replay cursor (e.g. when back to live mode)
   */
  public clearReplayCursor(): void {
    this.activeReplayTimestamp = null;
  }

  public getActiveCursor(): string | null {
    return this.activeReplayTimestamp;
  }

  /**
   * Strict validation of any data record against the active replay timestamp.
   * Throws Error or returns false if look-ahead bias is detected.
   */
  public inspectRecord(
    layer: FirewallLayer,
    recordTimestamp: string,
    source: string,
    field: string,
    value: any,
    throwOnViolation: boolean = false
  ): { passed: boolean; violation?: LookAheadViolation } {
    if (!this.isEnforced || !this.activeReplayTimestamp) {
      return { passed: true };
    }

    const recordTimeMs = new Date(recordTimestamp).getTime();
    const replayTimeMs = new Date(this.activeReplayTimestamp).getTime();

    // Check for look-ahead violation: record time is strictly in the future (> replay time)
    if (recordTimeMs > replayTimeMs) {
      const violation: LookAheadViolation = {
        violationId: `vio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        detectedAt: new Date().toISOString(),
        sourceTimestamp: recordTimestamp,
        replayTimestamp: this.activeReplayTimestamp,
        source,
        field,
        leakedValue: value,
        severity: 'CRITICAL_BREACH',
        engine: `Firewall:${layer}`,
        message: `LOOK_AHEAD_BIAS_DETECTED at ${layer}: sourceTimestamp (${recordTimestamp}) is after replayTimestamp (${this.activeReplayTimestamp})`
      };

      this.violations.push(violation);

      if (throwOnViolation) {
        throw new Error(`[LOOK_AHEAD_BIAS_DETECTED] ${violation.message}`);
      }

      return { passed: false, violation };
    }

    return { passed: true };
  }

  /**
   * Filter an array of historical records to ensure only records <= replayTimestamp pass
   */
  public filterHistory<T extends { timestamp?: string; publishedAt?: string; sourceTimestamp?: string }>(
    records: T[],
    customReplayTimestamp?: string
  ): T[] {
    const boundary = customReplayTimestamp || this.activeReplayTimestamp;
    if (!boundary) return records;

    const boundaryMs = new Date(boundary).getTime();
    return records.filter(r => {
      const ts = r.timestamp || r.publishedAt || r.sourceTimestamp;
      if (!ts) return false;
      const tMs = new Date(ts).getTime();
      return tMs <= boundaryMs;
    });
  }

  /**
   * Guard for AI interaction - ensures AI cannot provide forward-looking data or modify truth
   */
  public assertAiBoundary(data: any, replayTimestamp: string): void {
    if (!data) return;
    const inspect = (item: any) => {
      if (typeof item === 'object' && item !== null) {
        if (item.timestamp && new Date(item.timestamp).getTime() > new Date(replayTimestamp).getTime()) {
          throw new Error(`[LOOK_AHEAD_BIAS_DETECTED] AI prompt or context contained future timestamp: ${item.timestamp}`);
        }
        for (const key of Object.keys(item)) {
          inspect(item[key]);
        }
      }
    };
    inspect(data);
  }

  public getViolations(): LookAheadViolation[] {
    return [...this.violations];
  }

  public clearViolations(): void {
    this.violations = [];
  }

  public reset(): void {
    this.violations = [];
    this.activeReplayTimestamp = null;
    this.isEnforced = true;
  }
}

export const historicalFutureFirewall = HistoricalFutureFirewall.getInstance();
