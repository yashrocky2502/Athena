/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalLookAheadBiasEngine.ts
 * 
 * Deep audit engine for detecting look-ahead bias across all market, news,
 * derivative, surveillance, signal, strategy, portfolio, and execution streams.
 */

import { LookAheadViolation } from './types.ts';
import { historicalFutureFirewall } from './HistoricalFutureFirewall.ts';

export interface AuditTarget {
  name: string;
  replayTimestamp: string;
  data: any;
}

export class HistoricalLookAheadBiasEngine {
  private static instance: HistoricalLookAheadBiasEngine;
  private auditLog: LookAheadViolation[] = [];

  private constructor() {}

  public static getInstance(): HistoricalLookAheadBiasEngine {
    if (!HistoricalLookAheadBiasEngine.instance) {
      HistoricalLookAheadBiasEngine.instance = new HistoricalLookAheadBiasEngine();
    }
    return HistoricalLookAheadBiasEngine.instance;
  }

  /**
   * Scans an entire dataset or snapshot for any timestamp or future leakage
   */
  public auditReplayState(
    targetName: string,
    replayTimestamp: string,
    stateObject: any
  ): { hasLookAheadBias: boolean; violations: LookAheadViolation[] } {
    const violations: LookAheadViolation[] = [];
    const replayTimeMs = new Date(replayTimestamp).getTime();

    const scanNode = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      // Check timestamp properties
      const tsFields = ['timestamp', 'sourceTimestamp', 'publishedAt', 'exchangeTimestamp', 'receivedTimestamp'];
      for (const field of tsFields) {
        if (obj[field] && typeof obj[field] === 'string') {
          const itemTimeMs = new Date(obj[field]).getTime();
          if (itemTimeMs > replayTimeMs) {
            const violation: LookAheadViolation = {
              violationId: `audit_vio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              detectedAt: new Date().toISOString(),
              sourceTimestamp: obj[field],
              replayTimestamp,
              source: obj.source || obj.exchange || targetName,
              field: path ? `${path}.${field}` : field,
              leakedValue: obj[field],
              severity: 'CRITICAL_BREACH',
              engine: 'HistoricalLookAheadBiasEngine',
              message: `LOOK_AHEAD_BIAS_DETECTED: Object at '${path || field}' has future timestamp (${obj[field]}) > replayTimestamp (${replayTimestamp})`
            };
            violations.push(violation);
            this.auditLog.push(violation);
          }
        }
      }

      // Recursively traverse arrays and sub-objects
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => scanNode(item, `${path}[${index}]`));
      } else {
        for (const key of Object.keys(obj)) {
          // Skip known non-leaking audit logs or future comparison objects if explicitly marked as separated
          if (key === 'whatHappenedAfterSeparated' || key === 'auditLog') continue;
          scanNode(obj[key], path ? `${path}.${key}` : key);
        }
      }
    };

    scanNode(stateObject);

    return {
      hasLookAheadBias: violations.length > 0,
      violations
    };
  }

  /**
   * Asserts no lookahead bias or throws immediately
   */
  public assertNoLookAhead(targetName: string, replayTimestamp: string, data: any): void {
    const result = this.auditReplayState(targetName, replayTimestamp, data);
    if (result.hasLookAheadBias) {
      throw new Error(`[LOOK_AHEAD_BIAS_DETECTED] Invalidation in ${targetName}: ${result.violations[0].message}`);
    }
  }

  public getViolations(): LookAheadViolation[] {
    return [...this.auditLog];
  }

  public clear(): void {
    this.auditLog = [];
  }
}

export const historicalLookAheadBiasEngine = HistoricalLookAheadBiasEngine.getInstance();
