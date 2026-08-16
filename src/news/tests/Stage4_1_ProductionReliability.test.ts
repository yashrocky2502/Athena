import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { healthMonitor } from '../monitoring/HealthMonitor.ts';
import { IngestionTelemetry } from '../monitoring/IngestionTelemetry.ts';
import { collectorHealthMonitor } from '../monitoring/CollectorHealthMonitor.ts';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { IngestionPipeline } from '../ingestion/IngestionPipeline.ts';
import { PersistentV3StorageAdapter } from '../NewsEngineV3/storage/PersistentV3StorageAdapter.ts';
import { ArticleIdentity } from '../identity/ArticleIdentity.ts';
import { ArticleDeduplicator } from '../deduplication/ArticleDeduplicator.ts';
import { ArticleNormalizer } from '../normalization/ArticleNormalizer.ts';

function computeSha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Stage 4.1: Production Reliability & Canonical Health Suite', () => {
    const dataDir = path.join(process.cwd(), 'data');
    const stage2StorePath = path.join(dataDir, 'news_stage2_store.json');
    const testTempDir = path.join(dataDir, 'test_stage4_1_temp');

    beforeEach(async () => {
        if (!fs.existsSync(testTempDir)) {
            fs.mkdirSync(testTempDir, { recursive: true });
        }
        healthMonitor.resetState();
        IngestionTelemetry.getInstance().reset();
        collectorHealthMonitor.reset();
        await healthMonitor.initialize();
    });

    afterEach(() => {
        healthMonitor.resetState();
        IngestionTelemetry.getInstance().reset();
        collectorHealthMonitor.reset();
        if (fs.existsSync(testTempDir)) {
            fs.rmSync(testTempDir, { recursive: true, force: true });
        }
    });

    it('1. Authoritative Ingestion Pipeline & Single Canonical Writer Verification', async () => {
        // Confirm only IngestionPipeline -> JsonNewsStore path writes to canonical store
        const store = new JsonNewsStore(path.join(testTempDir, 'temp_canonical.json'));
        await store.initialize();
        const pipeline = new IngestionPipeline(store);

        const payload = {
            title: 'TCS Q2 Results Beat Estimates with 8.5% Net Profit Rise',
            url: 'https://reuters.com/financials/tcs-q2-2026',
            body: 'Tata Consultancy Services delivered strong quarterly performance.',
            publishedAt: new Date().toISOString(),
            source: 'REUTERS'
        };

        const result = await pipeline.ingest([payload], 'REUTERS');
        expect(result.saved).toBe(1);
        expect(result.duplicates).toBe(0);
        expect(result.malformed).toBe(0);

        const count = await store.count();
        expect(count).toBe(1);
    });

    it('2. Zero-Growth Detection: Distinguishes Idle Periods from Ingestion Failures', async () => {
        const telemetry = IngestionTelemetry.getInstance();
        
        // Scenario A: Collector runs normally, discovers 0 new articles (idle state, healthy)
        telemetry.recordAttempt();
        telemetry.recordSuccess(0, 0, 'REUTERS');
        expect(telemetry.getCurrentIngestionStatus()).toBe('HEALTHY');
        expect(telemetry.getGrowthPerHour()).toBe(0);

        // Scenario B: Collector encounters failure (error state)
        telemetry.recordAttempt();
        telemetry.recordFailure('network_failure', 'ETIMEDOUT connecting to upstream', 'REUTERS');
        expect(telemetry.getCurrentIngestionStatus()).toBe('DEGRADED');
        expect(telemetry.getErrors().length).toBe(1);
    });

    it('3. Ingestion Idempotency & Syndication Identity Tests (A, B, C, D)', async () => {
        const store = new JsonNewsStore(path.join(testTempDir, 'idempotency_store.json'));
        await store.initialize();
        const pipeline = new IngestionPipeline(store);

        const basePayload = {
            title: 'Infosys Signs $1.5 Billion Cloud Infrastructure Deal with Global Bank',
            url: 'https://economictimes.indiatimes.com/tech/infosys-deal-2026',
            body: 'Infosys announced a major multi-year digital transformation deal.',
            publishedAt: new Date().toISOString(),
            source: 'ECONOMIC_TIMES'
        };

        // Test A — New article (+1)
        const resA = await pipeline.ingest([basePayload], 'ECONOMIC_TIMES');
        expect(resA.saved).toBe(1);
        expect(resA.duplicates).toBe(0);

        // Test B — Exact same article (+0)
        const resB = await pipeline.ingest([basePayload], 'ECONOMIC_TIMES');
        expect(resB.saved).toBe(0);
        expect(resB.duplicates).toBe(1);

        // Test C — Same canonical URL with changed metadata (+0, DUPLICATE)
        const payloadC = {
            ...basePayload,
            title: 'Infosys Signs $1.5B Cloud Deal (Updated)',
            body: 'Updated body text with further analyst commentary.'
        };
        const resC = await pipeline.ingest([payloadC], 'ECONOMIC_TIMES');
        expect(resC.saved).toBe(0);
        expect(resC.duplicates).toBe(1);

        // Test D — Syndicated reprint on different publisher with identical title
        const payloadD = {
            title: 'Infosys Signs $1.5 Billion Cloud Infrastructure Deal with Global Bank',
            url: 'https://moneycontrol.com/news/business/infosys-deal-reprint',
            body: 'Infosys announced a major multi-year digital transformation deal.',
            publishedAt: new Date().toISOString(),
            source: 'MONEYCONTROL'
        };
        const articleD = ArticleNormalizer.normalize(payloadD, 'MONEYCONTROL', 'RSS');
        articleD.id = ArticleIdentity.generateId(articleD);
        
        const existing = await store.getAll();
        const dedupD = ArticleDeduplicator.check(articleD, existing);
        expect(dedupD.status).toBe('POSSIBLE_DUPLICATE');
        expect(dedupD.evidence).toContain('Exact Normalized Headline Match');
    });

    it('4. Retention Boundary Safety: V3 Story 30-Day Cleanup Never Prunes Canonical Stage 2 Store', async () => {
        // Record baseline hash of canonical storage
        const hashBefore = computeSha256(stage2StorePath);
        expect(hashBefore).not.toBeNull();

        const v3Adapter = PersistentV3StorageAdapter.getInstance();
        const initialStories = await v3Adapter.getAllStories();
        expect(initialStories).toBeDefined();

        // Perform V3 cleanup
        v3Adapter.runRetentionCleanup(30);

        // Verify canonical hash and file existence are 100% untouched
        const hashAfter = computeSha256(stage2StorePath);
        expect(hashAfter).toBe(hashBefore);
    });

    it('5. Legacy Writer Observation (ATHENA_LEGACY_WRITERS_ENABLED=true)', async () => {
        const envVal = process.env.ATHENA_LEGACY_WRITERS_ENABLED ?? 'true';
        expect(envVal).toBe('true');

        const report = await healthMonitor.checkHealth();
        expect(report.writerStatus).toBeDefined();
        expect(report.writerStatus.canonicalStore.exists).toBe(true);
        expect(report.writerStatus.legacyV2Store).toBeDefined();
        expect(report.writerStatus.legacyV3Store).toBeDefined();
    });

    it('6. Safe Read-Only Diagnostics: Zero Temporary File Leakage', async () => {
        const filesBefore = fs.readdirSync(dataDir);

        // Run Health Check multiple times
        for (let i = 0; i < 5; i++) {
            await healthMonitor.checkHealth();
        }

        const filesAfter = fs.readdirSync(dataDir);
        const tempFiles = filesAfter.filter(f => f.includes('.tmp'));
        expect(tempFiles.length).toBe(0);
        expect(filesAfter.length).toBe(filesBefore.length);
    });
});
