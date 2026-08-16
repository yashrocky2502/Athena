/**
 * ATHENA NEWS CORE — STAGE 3.9 RETENTION SAFETY & CANONICAL STORE IMMUTABILITY
 *
 * Verifies:
 * 1. Running V3 retention cleanup has 0 side-effects on the canonical Stage 2 store.
 * 2. SHA-256 hash before and after any operations remains 100% identical.
 * 3. Verify all read operations on the canonical store are strictly read-only.
 * 4. Ensures no canonical-store mutation occurs during any diagnostic or V3 story pruning actions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { PersistentV3StorageAdapter } from '../NewsEngineV3/storage/PersistentV3StorageAdapter.ts';

function computeSha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

describe('Stage 3.9: V3 Retention Safety & Canonical Immutability Guard', () => {
    const dataDir = path.join(process.cwd(), 'data');
    const stage2StorePath = path.join(dataDir, 'news_stage2_store.json');

    let store: JsonNewsStore;
    let v3Adapter: PersistentV3StorageAdapter;

    beforeEach(async () => {
        store = new JsonNewsStore();
        await store.initialize();
        v3Adapter = PersistentV3StorageAdapter.getInstance();
        await v3Adapter.initialize();
    });

    it('1. V3 retention cleanup must not mutate or prune the canonical Stage 2 store', async () => {
        // Compute SHA-256 hash of canonical store before any operation
        const hashBefore = computeSha256(stage2StorePath);
        expect(hashBefore).not.toBeNull();

        const countBefore = await store.count();
        expect(countBefore).toBeGreaterThan(0);

        // Run V3 retention cleanup
        // Since V3 manages its own retention boundary (e.g. 30 days) inside storiesMap
        // it must leave news_stage2_store.json completely untouched.
        await v3Adapter.runRetentionCleanup();

        // Count after operations must be identical
        const countAfter = await store.count();
        expect(countAfter).toBe(countBefore);

        // Compute SHA-256 hash of canonical store after operation
        const hashAfter = computeSha256(stage2StorePath);
        expect(hashAfter).toBe(hashBefore);
    });

    it('2. Verify that Stage 2 JSON operations are strictly read-only and immutable', async () => {
        const hashBefore = computeSha256(stage2StorePath);
        expect(hashBefore).not.toBeNull();

        // Perform mock read queries
        const allArticles = await store.getAll();
        expect(allArticles.length).toBeGreaterThan(0);

        // Verify hash remains identical after query actions
        const hashAfter = computeSha256(stage2StorePath);
        expect(hashAfter).toBe(hashBefore);
    });
});
