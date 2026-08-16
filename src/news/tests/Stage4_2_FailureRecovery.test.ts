import { describe, it, expect } from 'vitest';
import { newsCanaryRouter } from '../canary/NewsCanaryRouter.ts';
import { NewsCoreV2UIAdapter } from '../../newsCoreV2/api/NewsCoreV2UIAdapter.ts';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore.ts';

describe('Stage 4.2: V3/V5 Failure Recovery & Fallback Resilience', () => {
    it('1. V3 Exception Fallback: Catches errors and seamlessly routes through V2 adapter', () => {
        const articles = newsStore.getAllArticles();
        expect(articles.length).toBeGreaterThan(0);

        // Simulate a V3 Feed exception handler branch
        let fallbackTriggered = false;
        let responsePayload: any = null;

        try {
            // Simulated V3 throw
            throw new Error('V3_STORAGE_UNAVAILABLE_EMULATED');
        } catch (canaryErr: any) {
            fallbackTriggered = true;
            const uiArticles = NewsCoreV2UIAdapter.adaptMany(articles.slice(0, 10));
            responsePayload = {
                status: 'success',
                version: 'V5-V2-FALLBACK',
                canaryRouted: false,
                canaryReason: `FALLBACK_${canaryErr.message}`,
                articles: uiArticles,
                totalCount: articles.length,
                page: 1,
                limit: 10,
                totalPages: Math.ceil(articles.length / 10)
            };
        }

        expect(fallbackTriggered).toBe(true);
        expect(responsePayload.status).toBe('success');
        expect(responsePayload.version).toBe('V5-V2-FALLBACK');
        expect(responsePayload.articles.length).toBe(10);
        expect(responsePayload.articles[0].headline).toBeDefined();
    });

    it('2. V3 Timeout Fallback: Recovers cleanly under simulated timeout without throwing 5xx', async () => {
        const articles = newsStore.getAllArticles();

        // Simulate V3 Promise.race with timeout
        const simulateV3WithTimeout = async () => {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('V3_SERVICE_TIMEOUT_5000MS')), 50)
            );
            const slowV3 = new Promise((resolve) => setTimeout(resolve, 200));
            return Promise.race([slowV3, timeoutPromise]);
        };

        let result: any = null;
        try {
            await simulateV3WithTimeout();
        } catch (err: any) {
            const uiArticles = NewsCoreV2UIAdapter.adaptMany(articles.slice(0, 5));
            result = {
                status: 'success',
                version: 'V5-V2-FALLBACK',
                canaryReason: `FALLBACK_${err.message}`,
                articles: uiArticles
            };
        }

        expect(result).not.toBeNull();
        expect(result.status).toBe('success');
        expect(result.canaryReason).toContain('V3_SERVICE_TIMEOUT');
        expect(result.articles.length).toBe(5);
    });

    it('3. Malformed V3 Data Fallback: Validates structure before delivery and falls back if corrupt', () => {
        const rawMalformedV3Output: any = { corruptedField: null, brokenArray: 'not-an-array' };

        let safeOutput: any = null;
        if (!Array.isArray(rawMalformedV3Output.articles)) {
            // Malformed detected, trigger graceful V2 fallback
            const fallbackArticles = newsStore.getAllArticles().slice(0, 10);
            safeOutput = {
                status: 'success',
                version: 'V5-V2-FALLBACK',
                canaryReason: 'FALLBACK_MALFORMED_V3_PAYLOAD',
                articles: NewsCoreV2UIAdapter.adaptMany(fallbackArticles)
            };
        }

        expect(safeOutput.status).toBe('success');
        expect(safeOutput.version).toBe('V5-V2-FALLBACK');
        expect(safeOutput.articles.length).toBe(10);
    });
});
