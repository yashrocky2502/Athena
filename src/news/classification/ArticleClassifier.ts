import { NewsArticle, Sentiment, FinancialMetric } from '../types/Article.ts';
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

        // 3. Extract deterministic financial metrics if present in headline/body
        const financialMetrics = this.extractDeterministicMetrics(article.headline, article.body);

        // 4. Map back to canonical article
        return {
            ...article,
            primaryCategory: result.primaryCategory,
            eventType: result.eventType,
            symbol: fnoResult.symbol,
            fnoEligible: fnoResult.eligible,
            sentiment: result.sentiment as Sentiment,
            financialMetrics,
            classificationConfidence: Number(result.categoryConfidence || 80),
            relevanceScore: result.relevanceScore
        };
    }

    private static extractDeterministicMetrics(headline: string, body: string): FinancialMetric[] {
        const text = `${headline} ${body}`;
        const metrics: FinancialMetric[] = [];

        // 1. Net Profit / PAT match
        const patMatch = text.match(/(?:net profit|pat|profit) (?:jumps|rises|surges|grew|climbs|up|falls|drops|declines|down)?\s*(?:by\s*)?([\d.,]+%|\d+ percent)?\s*(?:to\s*(?:rs\.?|₹)?\s*([\d.,]+)\s*(cr|crore|lakh|bn|billion|m|million)?)?/i);
        if (patMatch && (patMatch[1] || patMatch[2])) {
            metrics.push({
                name: 'Net Profit',
                value: patMatch[2] ? `${patMatch[2]} ${patMatch[3] || 'Cr'}`.trim() : (patMatch[1] || 'N/A'),
                change: patMatch[1] || undefined,
                unit: patMatch[3] || (patMatch[1]?.includes('%') ? '%' : undefined)
            });
        }

        // 2. Revenue / Sales match
        const revMatch = text.match(/(?:revenue|sales|turnover) (?:rises|grew|up|jumps|declines|falls|down)?\s*(?:by\s*)?([\d.,]+%|\d+ percent)?\s*(?:to\s*(?:rs\.?|₹)?\s*([\d.,]+)\s*(cr|crore|lakh|bn|billion|m|million)?)?/i);
        if (revMatch && (revMatch[1] || revMatch[2])) {
            metrics.push({
                name: 'Revenue',
                value: revMatch[2] ? `${revMatch[2]} ${revMatch[3] || 'Cr'}`.trim() : (revMatch[1] || 'N/A'),
                change: revMatch[1] || undefined,
                unit: revMatch[3] || (revMatch[1]?.includes('%') ? '%' : undefined)
            });
        }

        // 3. Dividend match
        const divMatch = text.match(/dividend (?:of\s*)?(?:rs\.?|₹)?\s*([\d.,]+)(?:\s*per share|\/share)?/i);
        if (divMatch && divMatch[1]) {
            metrics.push({
                name: 'Dividend',
                value: `₹${divMatch[1]}/share`,
                unit: '₹'
            });
        }

        return metrics;
    }
}

