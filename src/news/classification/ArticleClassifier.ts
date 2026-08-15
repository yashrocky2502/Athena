import { NewsArticle, Sentiment } from '../types/Article.ts';
import { NewsClassifier } from '../../newsCoreV2/classification/NewsClassifier.ts';
import { FNOEligibilityEngine } from '../../newsCoreV2/fno/FNOEligibilityEngine.ts';

export class ArticleClassifier {
    /**
     * Adapts existing ATHENA classification logic to the new Canonical News Article model.
     */
    public static classify(article: NewsArticle): NewsArticle {
        // 1. Resolve F&O Eligibility
        const fnoResult = FNOEligibilityEngine.evaluate(article.headline, article.body);

        // 2. Resolve Category, Sentiment, and Relevance using existing NewsClassifier
        const result = NewsClassifier.classify(
            article.headline,
            article.body,
            article.source.publisher || article.source.name,
            fnoResult
        );

        // 3. Map back to canonical article
        return {
            ...article,
            primaryCategory: result.primaryCategory,
            eventType: result.eventType,
            symbol: fnoResult.symbol,
            fnoEligible: fnoResult.eligible,
            sentiment: result.sentiment as Sentiment,
            classificationConfidence: Number(result.categoryConfidence || 80),
            relevanceScore: result.relevanceScore
        };
    }
}
