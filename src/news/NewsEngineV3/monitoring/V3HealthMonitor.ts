/**
 * ATHENA NEWS ENGINE V3 — HEALTH & STATUS MONITORING
 * 
 * Central health check aggregator for monitoring core pipeline components,
 * memory thresholds, event bus queues, storage, and engine status.
 */

import { V3ConfigManager } from '../config/V3Config';
import { V3Telemetry, V3TelemetrySnapshot } from '../telemetry/V3Telemetry';

export type V3ModuleHealthState = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE';

export interface V3ModuleStatus {
  moduleName: string;
  status: V3ModuleHealthState;
  lastCheckedAt: string;
  details?: Record<string, any>;
}

export interface V3SystemHealthReport {
  engineName: string;
  version: string;
  environment: string;
  overallHealth: V3ModuleHealthState;
  uptimeSeconds: number;
  timestamp: string;
  modules: Record<string, V3ModuleStatus>;
  telemetry: V3TelemetrySnapshot;
}

export class V3HealthMonitor {
  private static instance: V3HealthMonitor;
  private moduleStatuses: Map<string, V3ModuleStatus> = new Map();
  private startTime: number = Date.now();

  private constructor() {
    this.registerModule('ConfigManager', 'HEALTHY', { version: '3.0.0-FOUNDATION' });
    this.registerModule('Logger', 'HEALTHY');
    this.registerModule('Telemetry', 'HEALTHY');
    this.registerModule('EventBus', 'HEALTHY');
    this.registerModule('StorageRepository', 'HEALTHY');
    this.registerModule('CacheClient', 'HEALTHY');
  }

  public static getInstance(): V3HealthMonitor {
    if (!V3HealthMonitor.instance) {
      V3HealthMonitor.instance = new V3HealthMonitor();
    }
    return V3HealthMonitor.instance;
  }

  public registerModule(
    moduleName: string,
    status: V3ModuleHealthState,
    details?: Record<string, any>
  ): void {
    this.moduleStatuses.set(moduleName, {
      moduleName,
      status,
      lastCheckedAt: new Date().toISOString(),
      details
    });
  }

  public updateModuleStatus(
    moduleName: string,
    status: V3ModuleHealthState,
    details?: Record<string, any>
  ): void {
    const existing = this.moduleStatuses.get(moduleName);
    this.moduleStatuses.set(moduleName, {
      moduleName,
      status,
      lastCheckedAt: new Date().toISOString(),
      details: details ? { ...(existing?.details || {}), ...details } : existing?.details
    });
  }

  public getSystemHealthReport(): V3SystemHealthReport {
    const config = V3ConfigManager.getInstance().getConfig();
    const telemetry = V3Telemetry.getInstance().getSnapshot();

    const modulesObj: Record<string, V3ModuleStatus> = {};
    let hasUnhealthy = false;
    let hasDegraded = false;

    this.moduleStatuses.forEach((val, key) => {
      modulesObj[key] = { ...val };
      if (val.status === 'UNHEALTHY' || val.status === 'OFFLINE') {
        hasUnhealthy = true;
      } else if (val.status === 'DEGRADED') {
        hasDegraded = true;
      }
    });

    let overallHealth: V3ModuleHealthState = 'HEALTHY';
    if (hasUnhealthy) {
      overallHealth = 'UNHEALTHY';
    } else if (hasDegraded) {
      overallHealth = 'DEGRADED';
    }

    return {
      engineName: 'NewsEngineV3',
      version: config.version,
      environment: config.environment,
      overallHealth,
      uptimeSeconds: Math.round((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      modules: modulesObj,
      telemetry
    };
  }
}
