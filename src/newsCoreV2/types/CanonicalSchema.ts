
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
