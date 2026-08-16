import { NewsArticle } from '../types/Article.ts';

export class CanonicalArticleValidator {
    /**
     * Validates a newly normalizer-constructed and classifier-enriched news article.
     * Returns an array of error messages. If empty, the article is valid.
     */
    public static validate(article: Partial<NewsArticle>): string[] {
        const errors: string[] = [];

        // 1. Stable ID Validation
        if (!article.id) {
            errors.push('Required field "id" is missing.');
        } else if (typeof article.id !== 'string' || article.id.trim().length === 0) {
            errors.push('Field "id" must be a non-empty string.');
        }

        // 2. Headline/Title Validation
        if (!article.headline) {
            errors.push('Required field "headline" is missing.');
        } else if (typeof article.headline !== 'string' || article.headline.trim().length < 5) {
            errors.push('Field "headline" must be a string with at least 5 characters.');
        }

        // 3. Source/Publisher Metadata Validation
        if (!article.source) {
            errors.push('Required object "source" is missing.');
        } else {
            const name = article.source.name || article.source.publisher;
            if (!name || name.trim().length === 0) {
                errors.push('Field "source.name" or "source.publisher" must be a non-empty string.');
            }
            if (!article.source.url) {
                errors.push('Required field "source.url" is missing.');
            } else if (typeof article.source.url !== 'string' || article.source.url.trim().length === 0) {
                errors.push('Field "source.url" must be a non-empty string.');
            }
        }

        // 4. Original Source URL Validation
        if (!article.sourceUrl) {
            errors.push('Required field "sourceUrl" is missing.');
        } else if (typeof article.sourceUrl !== 'string' || !article.sourceUrl.startsWith('http')) {
            errors.push('Field "sourceUrl" must be a valid URL starting with http/https.');
        }

        // 5. Published ISO Timestamp Validation
        if (!article.publishedAt) {
            errors.push('Required field "publishedAt" is missing.');
        } else {
            const date = new Date(article.publishedAt);
            if (isNaN(date.getTime())) {
                errors.push(`Field "publishedAt" ("${article.publishedAt}") is not a valid ISO date string.`);
            }
        }

        // 6. Ingestion Timestamp Validation
        if (!article.fetchedAt) {
            errors.push('Required field "fetchedAt" is missing.');
        } else {
            const date = new Date(article.fetchedAt);
            if (isNaN(date.getTime())) {
                errors.push(`Field "fetchedAt" ("${article.fetchedAt}") is not a valid ISO date string.`);
            }
        }

        // 7. Primary Category Validation
        if (!article.primaryCategory) {
            errors.push('Required field "primaryCategory" is missing.');
        } else if (typeof article.primaryCategory !== 'string' || article.primaryCategory.trim().length === 0) {
            errors.push('Field "primaryCategory" must be a non-empty string.');
        }

        // 8. Relevance and Confidence Score validation
        if (article.relevanceScore === undefined || article.relevanceScore === null) {
            errors.push('Required field "relevanceScore" is missing.');
        } else if (typeof article.relevanceScore !== 'number' || article.relevanceScore < 0 || article.relevanceScore > 100) {
            errors.push('Field "relevanceScore" must be a number between 0 and 100.');
        }

        if (article.classificationConfidence === undefined || article.classificationConfidence === null) {
            errors.push('Required field "classificationConfidence" is missing.');
        } else if (typeof article.classificationConfidence !== 'number' || article.classificationConfidence < 0 || article.classificationConfidence > 100) {
            errors.push('Field "classificationConfidence" must be a number between 0 and 100.');
        }

        return errors;
    }
}
