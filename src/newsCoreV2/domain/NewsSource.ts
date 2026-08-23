export type CollectionMethod = "DIRECT" | "RSS" | "MIGRATED_V3" | "MIGRATED_INTELLIGENCE" | "MIGRATION" | "FEED" | "API";

export interface ArticleProvenance {
  articleId: string;
  sourceId: string;
  publisher: string;
  sourceType: string;
  sourceUrl: string;
  canonicalUrl?: string;
  discoveredAt: string;
  publishedAt?: string;
  ingestedAt: string;
  retrievedAt?: string;
  extractionMethod?: string;
  sourceAuthorityTier?: 1 | 2 | 3 | 4;
}

export interface NewsSource {
  publisher: string;
  url: string;
  collectionMethod: CollectionMethod;
  name?: string;
  sourceAuthorityTier?: 1 | 2 | 3 | 4;
  provenance?: ArticleProvenance;
  sourceUrl?: string;
}
