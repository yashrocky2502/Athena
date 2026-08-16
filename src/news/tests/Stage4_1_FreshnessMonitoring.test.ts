import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { healthMonitor } from '../monitoring/HealthMonitor.ts';
import { IngestionTelemetry } from '../monitoring/IngestionTelemetry.ts';
import { collectorHealthMonitor } from '../monitoring/CollectorHealthMonitor.ts';

describe('Stage 4.1: Freshness Monitoring, Collector Matrix & Performance SLA', () => {
    beforeEach(async () => {
        healthMonitor.resetState();
        IngestionTelemetry.getInstance().reset();
        collectorHealthMonitor.reset();
        await healthMonitor.initialize();
    });

    afterEach(() => {
        healthMonitor.resetState();
        IngestionTelemetry.getInstance().reset();
        collectorHealthMonitor.reset();
    });

    it('1. Freshness Threshold Calculations & Warning/Critical Status', async () => {
        const report = await healthMonitor.checkHealth();
        expect(report.newestPublishedAt).toBeDefined();
        expect(report.oldestPublishedAt).toBeDefined();
        expect(report.ageOfNewestArticleMinutes).toBeGreaterThanOrEqual(0);
        expect(report.freshnessStatus).toBeDefined();
        expect(['HEALTHY', 'WARNING', 'CRITICAL']).toContain(report.freshnessStatus);
    });

    it('2. Collector Health Matrix Verification & Anomaly Detection', async () => {
        // Record test activity on collectors
        collectorHealthMonitor.recordCollectorExecution('REUTERS', 15, 12, 3);
        collectorHealthMonitor.recordCollectorExecution('ECONOMIC_TIMES', 10, 8, 2);
        collectorHealthMonitor.recordCollectorFailure('SEBI', 'Timeout from official gateway');

        const collectorReport = collectorHealthMonitor.getCollectorHealthReport();
        expect(collectorReport.REUTERS).toBeDefined();
        expect(collectorReport.REUTERS.articlesDiscovered).toBe(15);
        expect(collectorReport.REUTERS.articlesAccepted).toBe(12);
        expect(collectorReport.REUTERS.currentHealth).toBe('HEALTHY');

        expect(collectorReport.SEBI).toBeDefined();
        expect(collectorReport.SEBI.errors).toBe(1);
        expect(collectorReport.SEBI.currentHealth).toBe('WARNING');
    });

    it('3. News Population Truth Layer Separation Verification', async () => {
        const report = await healthMonitor.checkHealth();
        const pop = report.populationBreakdown;
        expect(pop).toBeDefined();
        expect(pop.populationA.storage).toContain('news_stage2_store.json');
        expect(pop.populationA.count).toBeGreaterThan(0);
        expect(pop.populationC.storage).toContain('v3_news_store.json');
        expect(pop.cardinalityTruth).toBe('Canonical Articles ≠ Clustered Stories ≠ UI Feed Count');
    });

    it('4. Health Endpoint Read Performance SLA (p50 < 15ms, p95 < 35ms, p99 < 60ms across 1,000 requests)', async () => {
        const latencies: number[] = [];
        const iterations = 1000;

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await healthMonitor.checkHealth();
            const dur = performance.now() - start;
            latencies.push(dur);
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(iterations * 0.50)];
        const p95 = latencies[Math.floor(iterations * 0.95)];
        const p99 = latencies[Math.floor(iterations * 0.99)];

        console.log(`[Performance Benchmark] Health Check 1,000 Requests -> p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, p99: ${p99.toFixed(2)}ms`);

        expect(p50).toBeLessThan(15);
        expect(p95).toBeLessThan(35);
        expect(p99).toBeLessThan(60);
    });

    it('5. Continuous Growth & Ingestion Rolling Telemetry', async () => {
        const telemetry = IngestionTelemetry.getInstance();
        telemetry.recordAttempt();
        telemetry.recordSuccess(5, 1, 'REUTERS');
        telemetry.recordAttempt();
        telemetry.recordSuccess(10, 2, 'ECONOMIC_TIMES');

        const summary = telemetry.getTelemetrySummary();
        expect(summary.totalIngestionAttempts).toBe(2);
        expect(summary.successfulBatches).toBe(2);
        expect(summary.articlesAccepted).toBe(15);
        expect(summary.duplicateArticles).toBe(3);
        expect(summary.duplicateRate).toBeGreaterThan(0);
        expect(summary.currentIngestionStatus).toBe('HEALTHY');
    });
});
