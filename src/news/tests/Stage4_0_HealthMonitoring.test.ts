import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { healthMonitor } from '../monitoring/HealthMonitor.ts';
import { IngestionTelemetry } from '../monitoring/IngestionTelemetry.ts';
import { CanonicalArticleValidator } from '../validation/CanonicalArticleValidator.ts';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';

function computeSha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Stage 4.0: Production-Grade Health Monitoring & Quality Assurance', () => {
    const dataDir = path.join(process.cwd(), 'data');
    const stage2StorePath = path.join(dataDir, 'news_stage2_store.json');

    beforeEach(async () => {
        healthMonitor.resetState();
        IngestionTelemetry.getInstance().reset();
        await healthMonitor.initialize();
    });

    afterEach(() => {
        healthMonitor.resetState();
        IngestionTelemetry.getInstance().reset();
    });

    it('1. Schema Validation (Canonical Ingestion Contract)', () => {
        const validArticle = {
            id: 'v3_sha256_mock_id_12345678',
            source: {
                name: 'REUTERS',
                url: 'https://reuters.com/article-1',
                collectionMethod: 'RSS' as const
            },
            sourceUrl: 'https://reuters.com/article-1',
            headline: 'Reliance Industries Q1 Net Profit Jumps 15% YoY',
            body: 'Reliance announced solid corporate numbers for the previous quarter.',
            publishedAt: new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            primaryCategory: 'Corporate',
            eventType: 'EARNINGS',
            symbol: 'RELIANCE',
            fnoEligible: true,
            financialMetrics: [],
            classificationConfidence: 95,
            relevanceScore: 85
        };

        const errors = CanonicalArticleValidator.validate(validArticle);
        expect(errors.length).toBe(0);

        const malformedArticle = {
            id: '',
            headline: 'Shrt',
            sourceUrl: 'not_a_url',
            publishedAt: 'invalid-date'
        };

        const errors2 = CanonicalArticleValidator.validate(malformedArticle);
        expect(errors2.length).toBeGreaterThan(0);
        expect(errors2.some(e => e.includes('id'))).toBe(true);
        expect(errors2.some(e => e.includes('headline'))).toBe(true);
        expect(errors2.some(e => e.includes('publishedAt'))).toBe(true);
    });

    it('2. Freshness & Ingestion Lag Metrics', async () => {
        const report = await healthMonitor.checkHealth();
        expect(report.newestPublishedAt).not.toBeNull();
        expect(report.ingestionLagSeconds).toBeGreaterThanOrEqual(0);
        expect(report.diagnostics.freshnessStatus).toBeDefined();
    });

    it('3. Stateful Count Decreases & Immutable Retention Guard', async () => {
        // Assert starting hash of primary file
        const hashBefore = computeSha256(stage2StorePath);
        expect(hashBefore).not.toBeNull();

        // 1. Fetch initial health report
        const report1 = await healthMonitor.checkHealth();
        const initialCount = report1.count;
        expect(initialCount).toBeGreaterThan(0);

        // 2. Mock a decrease event in the monitor
        // We set previousCount to a higher number to simulate that a decrease occurred in the store
        (healthMonitor as any).previousCount = initialCount + 5;

        // 3. Re-run checkHealth to trigger the decrease detection logic
        // We bypass cached evaluation by clearing cached time
        (healthMonitor as any).lastCheckedAt = null;
        const report2 = await healthMonitor.checkHealth();

        expect(report2.status).toBe('critical');
        expect(report2.diagnostics.countStatus).toBe('DECREASED');
        expect(report2.diagnostics.decreaseDetails).not.toBeNull();
        expect(report2.diagnostics.decreaseDetails.event).toBe('CANONICAL_COUNT_DECREASE_DETECTED');
        expect(report2.diagnostics.decreaseDetails.delta).toBe(-5);
        expect(report2.diagnostics.decreaseDetails.action).toBe('NO_AUTOMATIC_MUTATION');

        // Verify SHA-256 remains 100% untouched: count monitoring must NEVER mutate storage
        const hashAfter = computeSha256(stage2StorePath);
        expect(hashAfter).toBe(hashBefore);
    });

    it('4. Category Distribution & Quality Anomalies', async () => {
        const report = await healthMonitor.checkHealth();
        expect(report.categoryCount).toBeDefined();
        expect(report.categoryCount.Other).toBeDefined();
        expect(report.diagnostics.categoryAnomalies).toBeDefined();
    });

    it('5. Source Concentration & Publisher Health', async () => {
        const report = await healthMonitor.checkHealth();
        expect(report.publisherCount).toBeDefined();
        expect(report.diagnostics.topPublishers).toBeDefined();
        expect(report.diagnostics.publisherAnomalies).toBeDefined();
    });

    it('6. Continuous Ingestion Telemetry & Separate Population Verification', async () => {
        const telemetry = IngestionTelemetry.getInstance();
        telemetry.recordAttempt();
        telemetry.recordSuccess(10, 2);
        telemetry.recordFailure('network_failure', 'Connection Timeout', 'REUTERS');

        expect(telemetry.ingestionAttempts).toBe(1);
        expect(telemetry.articlesAdded).toBe(10);
        expect(telemetry.duplicatesRejected).toBe(2);
        expect(telemetry.ingestionFailures).toBe(1);
        expect(telemetry.getErrors().length).toBe(1);
        expect(telemetry.getErrors()[0].errorClass).toBe('network_failure');

        // Growth metrics
        expect(telemetry.getGrowthPerHour()).toBe(10);
        expect(telemetry.getGrowthPerDay()).toBe(10);
    });
});
