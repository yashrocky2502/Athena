# ATHENA NEWS ENGINE V3 — PRODUCTION FEED CONTRACT

## 1. Overview & Canonical API Endpoint
- **Canonical API Endpoint**: `GET /api/v3/news/feed` (Alias: `GET /api/v3/feed`)
- **Purpose**: Serve real-time, multi-publisher, deduped financial news articles across Indian markets and global macroeconomic indicators.
- **Contract Version**: `v3.0.0-FROZEN`

---

## 2. Feed Item Schema Requirements
Every article object returned in the `articles` array MUST adhere strictly to the following contract:

```typescript
interface V3FeedArticleContract {
  id: string; // Unique, format: STORY_V3_<HASH>
  correlationId: string; // Traceability ID
  clusterId: string; // Story cluster ID
  headline: string; // Non-empty headline
  title: string; // Alias for headline
  description: string; // Non-empty article body / summary snippet
  publisher: string; // Human-readable publisher name (e.g. 'Economic Times', 'Reuters', 'LiveMint')
  publisherId: string; // Unique canonical publisher identifier (e.g. 'ECONOMIC_TIMES', 'REUTERS')
  url: string; // Direct canonical source URL
  originalPublisherUrl?: string; // Resolved destination URL if discovered via RSS
  publishedAt: string; // ISO-8601 UTC timestamp
  category: string; // Standard V3 category enum
  metadata: {
    collectionMethod: 'DIRECT' | 'GOOGLE_RSS_FALLBACK';
    collectorId: string;
    qualityScore: number;
    traceabilityId: string;
  };
  companies?: Array<{ ticker: string; name: string }>;
  tickers?: string[];
  intelligenceStatus?: 'ENRICHED' | 'PENDING' | 'FALLBACK';
}
```

---

## 3. Strict Rules & Guarantees
1. **Publisher Attribution**:
   - MUST preserve the actual publisher name and publisherId (e.g. `LiveMint`, `Reuters`, `Business Standard`, `SEBI`, `BSE India`, `NSE India`).
   - MUST NOT collapse publishers into generic labels like `FINANCIAL_NEWS` or default to `Economic Times`.

2. **Source & URL Safety**:
   - `url` MUST be a valid HTTP(S) URL pointing directly to the article source or RSS item.
   - `collectionMethod` MUST clearly distinguish `DIRECT` vs `GOOGLE_RSS_FALLBACK`.

3. **Article ID Uniqueness**:
   - `id` MUST be strictly unique within the feed response (`duplicate count === 0`).

4. **AI Independence Guarantee**:
   - Ingestion, normalization, deduplication, storage, and API delivery MUST execute strictly independently of LLM/AI status.
   - Quota limits or failures in Grok, Gemini, or Local engines MUST NEVER block article ingestion, storage, or feed rendering.

5. **Multi-Source Diversity**:
   - All registered collectors MUST operate in isolated environments (`Promise.allSettled`).
   - A failure in one collector (e.g., timeout or rate limit) MUST NOT abort execution of other collectors.

6. **Frontend Parity**:
   - `API_ARTICLE_COUNT === FRONTEND_ALL_TAB_COUNT`.
   - The React frontend `All` tab MUST render 100% of the API feed articles without arbitrary client-side truncation.
