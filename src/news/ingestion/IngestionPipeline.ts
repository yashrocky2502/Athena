import { RawArticlePayload, ArticleNormalizer } from '../normalization/ArticleNormalizer.ts';
import { ArticleIdentity } from '../identity/ArticleIdentity.ts';
import { ArticleClassifier } from '../classification/ArticleClassifier.ts';
import { ArticleDeduplicator } from '../deduplication/ArticleDeduplicator.ts';
import { INewsStore } from '../storage/NewsStore.ts';
import { NewsArticle } from '../types/Article.ts';
import { CanonicalArticleValidator } from '../validation/CanonicalArticleValidator.ts';
import { IngestionTelemetry } from '../monitoring/IngestionTelemetry.ts';
import { collectorHealthMonitor } from '../monitoring/CollectorHealthMonitor.ts';
import { TraderImpactEngine } from '../intelligence/TraderImpactEngine.ts';
import { TraderIntelligenceCache } from '../cache/TraderIntelligenceCache.ts';

export interface IngestionResult {
    processed: number;
    saved: number;
    duplicates: number;
    errors: number;
    malformed: number;
}

export class IngestionPipeline {
    constructor(private store: INewsStore) {}

    /**
     * Executes the full ingestion pipeline:
     * Normalization -> Identity -> Classification -> Validation -> Deduplication -> Storage
     */
    public async ingest(payloads: RawArticlePayload[], sourceName: string): Promise<IngestionResult> {
        const telemetry = IngestionTelemetry.getInstance();
        telemetry.recordAttempt();

        const result: IngestionResult = {
            processed: 0,
            saved: 0,
            duplicates: 0,
            errors: 0,
            malformed: 0
        };

        const existingArticles = await this.store.getAll();

        for (const payload of payloads) {
            try {
                result.processed++;
                
                // 1. Normalization
                let article = ArticleNormalizer.normalize(payload, sourceName, 'RSS');

                // 2. Identity
                article.id = ArticleIdentity.generateId(article);

                // 3. Classification
                article = ArticleClassifier.classify(article);

                // 4. Validation (Canonical Ingestion Contract)
                const validationErrors = CanonicalArticleValidator.validate(article);
                if (validationErrors.length > 0) {
                    result.malformed++;
                    telemetry.recordMalformed(payload, validationErrors);
                    continue;
                }

                // 5. Deduplication
                const dedup = ArticleDeduplicator.check(article, existingArticles);
                if (dedup.status === 'DUPLICATE') {
                    result.duplicates++;
                    continue;
                }

                // 6. Storage (Summary-first for canonical article store)
                await this.store.insert(article);
                result.saved++;

                // 7. Stage 7.3 Exception: Auto-generate & cache full intelligence for F&O articles ONLY
                const fullText = `${(article as any).headline || (article as any).title || ''} ${(article as any).summary || (article as any).content || ''}`.toLowerCase();
                const isFnoArticle = (article as any).isFno ||
                    (article as any).category === 'FNO' ||
                    (article as any).primaryCategory === 'FNO' ||
                    /options|futures|strike|open interest|\boi\b|pcr|implied volatility|\biv\b|call option|put option|futures basis|rollover/i.test(fullText);

                if (isFnoArticle) {
                    try {
                        const fnoIntel = TraderImpactEngine.transform(article as any);
                        TraderIntelligenceCache.getInstance().set(article.id, fnoIntel, 'v7_3');
                    } catch (fnoErr) {
                        console.warn(`[IngestionPipeline] F&O auto-intelligence pre-cache failed for ${article.id}:`, fnoErr);
                    }
                }
                
                // Add to temporary existing for intra-batch deduplication
                existingArticles.push(article);

            } catch (err: any) {
                console.error(`[IngestionPipeline] Error processing article:`, err);
                result.errors++;
                telemetry.recordFailure('parser_failure', err.message || 'Error processing article', sourceName);
                collectorHealthMonitor.recordCollectorFailure(sourceName, err.message || 'Error processing article');
            }
        }

        telemetry.recordSuccess(result.saved, result.duplicates, sourceName);
        collectorHealthMonitor.recordCollectorExecution(sourceName, result.processed, result.saved, result.duplicates);
        return result;
    }
}

