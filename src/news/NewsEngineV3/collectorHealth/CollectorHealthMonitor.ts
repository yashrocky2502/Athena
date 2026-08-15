/**
 * ATHENA NEWS ENGINE V3 — COLLECTOR HEALTH MONITOR
 * 
 * Aggregates health metrics, failure rates, and status reports across all active collectors.
 */

import { CollectorRegistry } from '../collectorRegistry/CollectorRegistry';
import { V3CollectorHealthMetrics } from '../collectors/ICollector';

export interface V3CollectorAggregateHealthReport {
  timestamp: string;
  totalCollectors: number;
  runningCount: number;
  pausedCount: number;
  failedCount: number;
  offlineCount: number;
  overallHealthPct: number;
  collectors: Record<string, V3CollectorHealthMetrics>;
}

export class CollectorHealthMonitor {
  private static instance: CollectorHealthMonitor;

  private constructor() {}

  public static getInstance(): CollectorHealthMonitor {
    if (!CollectorHealthMonitor.instance) {
      CollectorHealthMonitor.instance = new CollectorHealthMonitor();
    }
    return CollectorHealthMonitor.instance;
  }

  public getAggregateReport(): V3CollectorAggregateHealthReport {
    const registry = CollectorRegistry.getInstance();
    const allHealth = registry.health();

    let total = 0;
    let running = 0;
    let paused = 0;
    let failed = 0;
    let offline = 0;
    let totalHealthSum = 0;

    Object.values(allHealth).forEach(m => {
      total++;
      if (m.state === 'RUNNING') running++;
      else if (m.state === 'PAUSED') paused++;
      else if (m.state === 'FAILED') failed++;
      else if (m.state === 'OFFLINE') offline++;

      totalHealthSum += m.healthPercentage;
    });

    const avgHealth = total > 0 ? Math.round(totalHealthSum / total) : 100;

    return {
      timestamp: new Date().toISOString(),
      totalCollectors: total,
      runningCount: running,
      pausedCount: paused,
      failedCount: failed,
      offlineCount: offline,
      overallHealthPct: avgHealth,
      collectors: allHealth
    };
  }
}
