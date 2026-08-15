import { RawArticlePayload, ArticleNormalizer } from '../normalization/ArticleNormalizer.ts';
import { ArticleIdentity } from '../identity/ArticleIdentity.ts';
import { ArticleClassifier } from '../classification/ArticleClassifier.ts';
import { ArticleDeduplicator } from '../deduplication/ArticleDeduplicator.ts';
import { INewsStore } from '../storage/NewsStore.ts';
import { NewsArticle } from '../types/Article.ts';

export interface IngestionResult {
    processed: number;
    saved: number;
    duplicates: number;
    errors: number;
}

export class IngestionPipeline {
    constructor(private store: INewsStore) {}

    /**
     * Executes the full ingestion pipeline:
     * Normalization -> Identity -> Classification -> Deduplication -> Storage
     */
    public async ingest(payloads: RawArticlePayload[], sourceName: string): Promise<IngestionResult> {
        const result: IngestionResult = {
            processed: 0,
            saved: 0,
            duplicates: 0,
            errors: 0
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

                // 4. Deduplication
                const dedup = ArticleDeduplicator.check(article, existingArticles);
                if (dedup.status === 'DUPLICATE') {
                    result.duplicates++;
                    continue;
                }

                // 5. Storage
                await this.store.insert(article);
                result.saved++;
                
                // Add to temporary existing for intra-batch deduplication
                existingArticles.push(article);

            } catch (err) {
                console.error(`[IngestionPipeline] Error processing article:`, err);
                result.errors++;
            }
        }

        return result;
    }
}
