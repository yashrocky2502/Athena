import { RawArticlePayload, ArticleNormalizer } from '../normalization/ArticleNormalizer.ts';
import { ArticleIdentity } from '../identity/ArticleIdentity.ts';
import { ArticleClassifier } from '../classification/ArticleClassifier.ts';
import { ArticleDeduplicator } from '../deduplication/ArticleDeduplicator.ts';
import { INewsStore } from '../storage/NewsStore.ts';
import { NewsArticle } from '../types/Article.ts';
import { CanonicalArticleValidator } from '../validation/CanonicalArticleValidator.ts';
import { IngestionTelemetry } from '../monitoring/IngestionTelemetry.ts';
import { collectorHealthMonitor } from '../monitoring/CollectorHealthMonitor.ts';
import { sourceHealthMonitor } from '../monitoring/SourceHealthMonitor.ts';
import { TraderImpactEngine } from '../intelligence/TraderImpactEngine.ts';
import { TraderIntelligenceCache } from '../cache/TraderIntelligenceCache.ts';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline.ts';
import { ArticleFreshnessEvaluator } from '../freshness/ArticleFreshnessEvaluator.ts';
import { eventFingerprintEngine } from '../deduplication/EventFingerprintEngine.ts';
import { EventCentricOrchestrator } from '../intelligence/EventCentricOrchestrator.ts';
import { ingestionLatencyTracker } from '../monitoring/IngestionLatencyTracker.ts';

export interface IngestionResult {
    processed: number;
    saved: number;
    duplicates: number;
    errors: number;
    malformed: number;
    quarantined?: number;
}

export class IngestionPipeline {
    constructor(private store: INewsStore) {}

    /**
     * Executes the full Stage 8.4 ingestion pipeline:
     * Normalization -> Identity -> Quality Gate & Freshness -> Classification -> Deduplication & Event Centric Orchestration -> Storage -> Priority & SLA Telemetry -> Telegram Dispatch
     */
    public async ingest(payloads: RawArticlePayload[], sourceName: string): Promise<IngestionResult> {
        const telemetry = IngestionTelemetry.getInstance();
        telemetry.recordAttempt();

        const result: IngestionResult = {
            processed: 0,
            saved: 0,
            duplicates: 0,
            errors: 0,
            malformed: 0,
            quarantined: 0
        };

        const existingArticles = await this.store.getAll();

        for (const payload of payloads) {
            const discoveredAt = new Date().toISOString();
            try {
                result.processed++;
                
                // 1. Normalization
                let article = ArticleNormalizer.normalize(payload, sourceName, 'RSS');
                const normalizedAt = new Date().toISOString();

                // 2. Identity
                article.id = ArticleIdentity.generateId(article);

                // 3. Stage 8.3 Quality Gate & Quarantine Validation
                const qualityValidation = ArticleFreshnessEvaluator.validateQuality(article);
                if (!qualityValidation.accepted) {
                    result.quarantined = (result.quarantined || 0) + 1;
                    telemetry.recordMalformed(payload, [qualityValidation.rejectionReason || 'QUALITY_GATE_REJECTED']);
                    sourceHealthMonitor.recordExtractionOutcome(sourceName, 'FALLBACK', qualityValidation.qualityScore);
                    continue;
                }

                // 4. Classification
                article = ArticleClassifier.classify(article);

                // 5. Validation (Canonical Ingestion Contract)
                const validationErrors = CanonicalArticleValidator.validate(article);
                if (validationErrors.length > 0) {
                    result.malformed++;
                    telemetry.recordMalformed(payload, validationErrors);
                    continue;
                }

                // 6. Stage 8.3 Freshness Check
                const freshness = ArticleFreshnessEvaluator.evaluateFreshness(article, discoveredAt, normalizedAt);
                (article as any).freshnessState = freshness.freshnessState;
                (article as any).freshnessSeconds = freshness.freshnessSeconds;

                // 7. Stage 8.4 Event-Centric Live Orchestration
                const eventEval = eventFingerprintEngine.evaluateEvent(article);
                const eventOrchestration = EventCentricOrchestrator.getInstance().processArticle(article);

                (article as any).eventId = eventEval.eventId;
                (article as any).eventRelation = eventEval.eventRelation;
                (article as any).hasConflict = eventEval.hasConflict;

                // Basic Article Deduplication check (URL / ID match)
                const dedup = ArticleDeduplicator.check(article, existingArticles);
                if (dedup.status === 'DUPLICATE') {
                    result.duplicates++;
                    sourceHealthMonitor.recordPollSuccess(sourceName, 0, 0, 0, 0, 1, article.publishedAt);
                    continue;
                }

                // 8. Storage (Summary-first for canonical article store)
                await this.store.insert(article);
                result.saved++;
                const summaryReadyAt = new Date().toISOString();

                // 9. Stage 8.3 F&O Priority & Grounded Derivative Evidence
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

                // 10. Queue Priority Determination (P0 - P4)
                let priorityPClass = 3; // P3 default
                const isOfficialTier = sourceName.includes('SEBI') || sourceName.includes('RBI') || sourceName.includes('PIB') || sourceName.includes('NSE') || sourceName.includes('BSE');
                const isBreaking = freshness.freshnessState === 'BREAKING';

                if (isOfficialTier || (isFnoArticle && isBreaking)) {
                    priorityPClass = 0; // P0: Critical/Official/F&O breaking
                } else if (/order|wins|bags|profit|results|q[1-4]|block deal|bulk deal/i.test(fullText)) {
                    priorityPClass = 1; // P1: Major corporate catalyst
                } else if (/market|sensex|nifty|stocks|shares/i.test(fullText)) {
                    priorityPClass = 2; // P2: Significant market news
                } else if (qualityValidation.qualityScore < 70) {
                    priorityPClass = 4; // P4: Low-signal content
                }

                const eligibilityCheckedAt = new Date().toISOString();

                // 11. Stage 8.4 Event-Centric Telegram Dispatch
                let queuedAt: string | undefined;
                const shouldDispatch = eventEval.shouldDispatchAlert || eventOrchestration.shouldDispatchTelegram;

                if (shouldDispatch) {
                    queuedAt = new Date().toISOString();
                    try {
                        TelegramNotificationPipeline.getInstance().enqueueArticle(article as any, {
                            isLive: true,
                            priority: priorityPClass,
                            forceDispatch: eventEval.eventRelation === 'EVENT_ESCALATION' || eventEval.eventRelation === 'EVENT_UPDATE' || eventOrchestration.isEscalation
                        });
                    } catch (teleErr) {
                        console.warn(`[IngestionPipeline] Telegram enqueue error for ${article.id}:`, teleErr);
                    }
                }

                // Record end-to-end SLA Telemetry
                ingestionLatencyTracker.recordTelemetry({
                    articleId: article.id,
                    publisher: sourceName,
                    publishedAt: article.publishedAt || discoveredAt,
                    discoveredAt,
                    normalizedAt,
                    summaryReadyAt,
                    eligibilityCheckedAt,
                    queuedAt,
                    sentAt: queuedAt
                });

                // Add to temporary existing for intra-batch deduplication
                existingArticles.push(article);

            } catch (err: any) {
                console.error(`[IngestionPipeline] Error processing article:`, err);
                result.errors++;
                telemetry.recordFailure('parser_failure', err.message || 'Error processing article', sourceName);
                collectorHealthMonitor.recordCollectorFailure(sourceName, err.message || 'Error processing article');
                sourceHealthMonitor.recordPollFailure(sourceName, 0, err);
            }
        }

        telemetry.recordSuccess(result.saved, result.duplicates, sourceName);
        collectorHealthMonitor.recordCollectorExecution(sourceName, result.processed, result.saved, result.duplicates);
        sourceHealthMonitor.recordPollSuccess(sourceName, 0, payloads.length, result.saved, result.quarantined || 0, result.duplicates);

        return result;
    }
}
