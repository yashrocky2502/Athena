import { CollectorRegistry } from '../NewsEngineV3/collectorRegistry/CollectorRegistry.ts';
import { V3PublisherId } from '../NewsEngineV3/types/V3Types.ts';

export interface CollectorHealthStatus {
    name: string;
    source: string;
    schedule: string;
    lastExecution: string | null;
    lastSuccess: string | null;
    lastFailure: string | null;
    articlesDiscovered: number;
    articlesAccepted: number;
    duplicates: number;
    errors: number;
    consecutiveFailures: number;
    currentHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'IDLE';
    state: string;
    anomalies: string[];
}

export class CollectorHealthMonitor {
    private static instance: CollectorHealthMonitor | null = null;

    // Track active collector telemetry state
    private collectorStats: Map<string, {
        name: string;
        source: string;
        schedule: string;
        lastExecution: string | null;
        lastSuccess: string | null;
        lastFailure: string | null;
        articlesDiscovered: number;
        articlesAccepted: number;
        duplicates: number;
        errors: number;
        consecutiveFailures: number;
    }> = new Map();

    private constructor() {
        this.initializeDefaultCollectorProfiles();
    }

    public static getInstance(): CollectorHealthMonitor {
        if (!this.instance) {
            this.instance = new CollectorHealthMonitor();
        }
        return this.instance;
    }

    private initializeDefaultCollectorProfiles(): void {
        const DEFAULT_COLLECTORS = [
            { id: 'REUTERS', name: 'Reuters Financial', source: 'Reuters RSS/Feed', schedule: 'Every 30s' },
            { id: 'ECONOMIC_TIMES', name: 'Economic Times', source: 'ET Markets RSS', schedule: 'Every 30s' },
            { id: 'MONEYCONTROL', name: 'Moneycontrol Markets', source: 'Moneycontrol News API', schedule: 'Every 45s' },
            { id: 'LIVEMINT', name: 'LiveMint Business', source: 'LiveMint RSS', schedule: 'Every 45s' },
            { id: 'BUSINESS_STANDARD', name: 'Business Standard', source: 'BS Financial RSS', schedule: 'Every 60s' },
            { id: 'CNBC_TV18', name: 'CNBC-TV18', source: 'CNBC-TV18 Live Feed', schedule: 'Every 30s' },
            { id: 'NSE', name: 'NSE India Official', source: 'NSE Corporate Announcements', schedule: 'Every 60s' },
            { id: 'BSE', name: 'BSE India Official', source: 'BSE Corporate Filings', schedule: 'Every 60s' },
            { id: 'RBI', name: 'Reserve Bank of India', source: 'RBI Press Releases', schedule: 'Every 120s' },
            { id: 'SEBI', name: 'SEBI Regulatory', source: 'SEBI Orders & Circulars', schedule: 'Every 120s' },
            { id: 'PIB', name: 'Press Information Bureau', source: 'PIB Financial Desk', schedule: 'Every 180s' },
            { id: 'GOOGLE_NEWS', name: 'Google News Indian Markets', source: 'Google News RSS Aggregator', schedule: 'Every 60s' }
        ];

        for (const col of DEFAULT_COLLECTORS) {
            this.collectorStats.set(col.id, {
                name: col.name,
                source: col.source,
                schedule: col.schedule,
                lastExecution: null,
                lastSuccess: null,
                lastFailure: null,
                articlesDiscovered: 0,
                articlesAccepted: 0,
                duplicates: 0,
                errors: 0,
                consecutiveFailures: 0
            });
        }
    }

    public recordCollectorExecution(collectorId: string, discovered: number, accepted: number, duplicates: number): void {
        const stats = this.collectorStats.get(collectorId);
        const now = new Date().toISOString();
        if (stats) {
            stats.lastExecution = now;
            stats.lastSuccess = now;
            stats.articlesDiscovered += discovered;
            stats.articlesAccepted += accepted;
            stats.duplicates += duplicates;
            stats.consecutiveFailures = 0;
        } else {
            this.collectorStats.set(collectorId, {
                name: collectorId,
                source: collectorId,
                schedule: 'Dynamic Ingestion',
                lastExecution: now,
                lastSuccess: now,
                lastFailure: null,
                articlesDiscovered: discovered,
                articlesAccepted: accepted,
                duplicates: duplicates,
                errors: 0,
                consecutiveFailures: 0
            });
        }
    }

    public recordCollectorFailure(collectorId: string, _errorMsg: string): void {
        const stats = this.collectorStats.get(collectorId);
        const now = new Date().toISOString();
        if (stats) {
            stats.lastExecution = now;
            stats.lastFailure = now;
            stats.errors += 1;
            stats.consecutiveFailures += 1;
        } else {
            this.collectorStats.set(collectorId, {
                name: collectorId,
                source: collectorId,
                schedule: 'Dynamic Ingestion',
                lastExecution: now,
                lastSuccess: null,
                lastFailure: now,
                articlesDiscovered: 0,
                articlesAccepted: 0,
                duplicates: 0,
                errors: 1,
                consecutiveFailures: 1
            });
        }
    }

    public getCollectorHealthReport(): Record<string, CollectorHealthStatus> {
        const report: Record<string, CollectorHealthStatus> = {};
        const registry = CollectorRegistry.getInstance();
        const registryCollectors = registry.getAll();
        const registryHealth = registry.health();

        // 1. Process stats map
        for (const [id, stats] of this.collectorStats.entries()) {
            const anomalies: string[] = [];
            let currentHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'IDLE' = 'IDLE';

            // Check registry health if available
            const regH = registryHealth[id];
            let state = 'OFFLINE';

            if (regH) {
                state = regH.state;
                if (regH.circuitBreakerOpen) {
                    currentHealth = 'CRITICAL';
                    anomalies.push(`Circuit breaker tripped due to consecutive failures`);
                } else if (regH.consecutiveFailures >= 3) {
                    currentHealth = 'WARNING';
                    anomalies.push(`Consecutive fetch failures: ${regH.consecutiveFailures}`);
                } else if (regH.state === 'RUNNING') {
                    currentHealth = 'HEALTHY';
                }
            } else if (stats.lastExecution) {
                state = 'ACTIVE';
                if (stats.consecutiveFailures >= 5) {
                    currentHealth = 'CRITICAL';
                    anomalies.push(`Repeated collector failures (${stats.consecutiveFailures})`);
                } else if (stats.consecutiveFailures > 0) {
                    currentHealth = 'WARNING';
                    anomalies.push(`Recent collector failure recorded`);
                } else {
                    currentHealth = 'HEALTHY';
                }
            }

            if (stats.articlesDiscovered > 500) {
                anomalies.push(`Sudden abnormal article volume detected (${stats.articlesDiscovered} articles)`);
            }

            report[id] = {
                name: stats.name,
                source: stats.source,
                schedule: stats.schedule,
                lastExecution: stats.lastExecution,
                lastSuccess: stats.lastSuccess,
                lastFailure: stats.lastFailure,
                articlesDiscovered: stats.articlesDiscovered,
                articlesAccepted: stats.articlesAccepted,
                duplicates: stats.duplicates,
                errors: stats.errors,
                consecutiveFailures: stats.consecutiveFailures,
                currentHealth,
                state,
                anomalies
            };
        }

        return report;
    }

    public reset(): void {
        this.collectorStats.clear();
        this.initializeDefaultCollectorProfiles();
    }
}

export const collectorHealthMonitor = CollectorHealthMonitor.getInstance();
