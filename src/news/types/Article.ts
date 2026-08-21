/**
 * ATHENA Canonical News Article Schema
 * Version: 1.0.0
 */

export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface FinancialMetric {
    name: string;
    value: string | number;
    unit?: string;
    change?: string | number;
    changePercent?: number;
    period?: string;
}

export interface NewsArticleSource {
    name: string;
    url: string;
    publisher?: string;
    collectionMethod: 'RSS' | 'API' | 'MIGRATION' | 'MANUAL';
}

export interface NewsArticle {
    /** Unique immutable identifier (SHA-256 hash of URL/Headline) */
    id: string;
    
    /** Source metadata */
    source: NewsArticleSource;
    
    /** Original URL from source */
    sourceUrl: string;
    
    /** Cleaned headline */
    headline: string;
    
    /** Cleaned body text (plain text or structured) */
    body: string;
    
    /** ISO timestamp of when the article was published */
    publishedAt: string;
    
    /** ISO timestamp of when the article was first fetched by ATHENA */
    fetchedAt: string;

    /** Primary classification (e.g., Results, IPO, Corporate, Economy) */
    primaryCategory: string;
    
    /** Specific event type (e.g., EARNINGS, LISTING, ACQUISITION) */
    eventType: string;
    
    /** Associated ticker symbol (if any) */
    symbol: string | null;
    
    /** Whether the entity is F&O eligible */
    fnoEligible: boolean;

    /** Deterministic financial metrics extracted from text */
    financialMetrics: FinancialMetric[];

    /** Confidence score of the classification (0-100) */
    classificationConfidence: number;

    /** Relevance score for feed ordering (0-100) */
    relevanceScore: number;

    /** Legacy / raw collector optional aliases */
    title?: string;
    publisher?: string;
    url?: string;
    category?: string;

    /** Sentiment analysis (optional enrichment) */
    sentiment?: Sentiment;

    /** AI Summary / Narrative (Enrichment layer) */
    intelligence?: {
        summary: string;
        whyItMatters: string;
        marketImpact: string;
        generatedAt: string;
        version: string;
    };
}
