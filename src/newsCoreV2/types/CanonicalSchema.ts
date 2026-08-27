
export interface CanonicalArticle {
    id: string;
    headline: string;
    body: string;
    url: string;
    source: string;
    publishedAt: string;
    primaryCategory: string;
    eventType: string;
    fnoEligible: boolean;
    financialMetrics: any;
    classificationMetadata: any;
    createdAt: string;
    updatedAt: string;
    schemaVersion: string;
}

export interface CanonicalArticleSummary {
    articleId: string;
    headline: string;
    summary: string;
    whatHappened: string;
    backgroundAndContext?: string;
    whyItMatters: string;
    keyFacts: string[];
    importantNumbers: Array<{ value: string; context: string }>;
    entities: string[];
    eventType: string;
    publisher?: string;
    publishedAt?: string;
    canonicalUrl?: string;
    extractionQuality?: string;
    extractionStatus?: 'SOURCE_GROUNDED' | 'SOURCE_UNAVAILABLE' | 'EXTRACTION_FAILED' | 'QUALITY_REJECTED';
    summaryStatus?: 'SOURCE_GROUNDED' | 'SOURCE_UNAVAILABLE' | 'EXTRACTION_FAILED' | 'QUALITY_REJECTED';
    qualityGatePassed?: boolean;
    qualityGateScore?: number;
    qualityGateReason?: string;
    generatedAt?: string;
    cached?: boolean;
    revision?: string;
}

export interface IntelligenceOverlay {
    intelligenceId: string;
    canonicalArticleId: string;
    provider: string;
    intelligenceVersion: string;
    executiveSummary: string;
    marketImpact: string;
    keyFacts: string;
    whyItMatters: string;
    optionsSellerImpact: string;
    riskFactors: string;
    traceability: string;
    generatedAt: string;
    schemaVersion: string;
}

