import { NewsFeedService, FeedOptions, FeedResponse } from '../feed/NewsFeedService.ts';

export type ShadowDiffType =
    | 'MATCH'
    | 'V2_ONLY'
    | 'V3_ONLY'
    | 'IDENTITY_MISMATCH'
    | 'CATEGORY_MISMATCH'
    | 'METADATA_MISMATCH'
    | 'ORDERING_DIFFERENCE'
    | 'PAGINATION_DIFFERENCE'
    | 'TIMEOUT'
    | 'ERROR';

export interface NormalizedShadowArticle {
    id: string;
    normalizedUrl: string;
    normalizedHeadline: string;
    publisher: string;
    publishedAt: string;
    category: string;
    fnoEligible: boolean;
    symbol: string | null;
    relevanceScore: number;
    sourceName: string;
}

export interface ShadowDiffDetail {
    type: ShadowDiffType;
    articleId?: string;
    url?: string;
    headline?: string;
    v2Value?: any;
    v3Value?: any;
    reason?: string;
}

export interface ShadowComparisonRequest {
    category?: string;
    symbol?: string;
    page?: number;
    limit?: number;
    sort?: 'latest' | 'relevance';
}

export interface ShadowComparisonResult {
    id: string;
    timestamp: string;
    request: ShadowComparisonRequest;
    v2Count: number;
    v3Count: number;
    v2TotalCount: number;
    v3TotalCount: number;
    intersectionCount: number;
    v2OnlyCount: number;
    v3OnlyCount: number;
    matches: number;
    identityMismatches: number;
    categoryMismatches: number;
    metadataMismatches: number;
    orderingDifferences: number;
    paginationDifferences: number;
    v3LatencyMs: number;
    comparisonDurationMs: number;
    status: ShadowDiffType;
    details: ShadowDiffDetail[];
}

export interface ShadowAggregateMetrics {
    enabled: boolean;
    totalComparisons: number;
    matches: number;
    v2Only: number;
    v3Only: number;
    identityMismatches: number;
    categoryMismatches: number;
    metadataMismatches: number;
    orderingDifferences: number;
    paginationDifferences: number;
    timeouts: number;
    errors: number;
    averageV3LatencyMs: number;
    lastComparisonAt: string | null;
    lastStatus: ShadowDiffType | null;
}

export class NewsShadowComparator {
    private static instance: NewsShadowComparator | null = null;
    private forceEnabled: boolean | null = null;
    private recentComparisons: ShadowComparisonResult[] = [];
    private maxHistory = 100;
    private timeoutMs = 1500;

    private metrics: ShadowAggregateMetrics = {
        enabled: false,
        totalComparisons: 0,
        matches: 0,
        v2Only: 0,
        v3Only: 0,
        identityMismatches: 0,
        categoryMismatches: 0,
        metadataMismatches: 0,
        orderingDifferences: 0,
        paginationDifferences: 0,
        timeouts: 0,
        errors: 0,
        averageV3LatencyMs: 0,
        lastComparisonAt: null,
        lastStatus: null
    };

    public static getInstance(): NewsShadowComparator {
        if (!NewsShadowComparator.instance) {
            NewsShadowComparator.instance = new NewsShadowComparator();
        }
        return NewsShadowComparator.instance;
    }

    public isEnabled(): boolean {
        if (this.forceEnabled !== null) {
            return this.forceEnabled;
        }
        return process.env.NEWS_CORE_V3_SHADOW_MODE === 'true';
    }

    public setEnabled(enabled: boolean): void {
        this.forceEnabled = enabled;
    }

    public setTimeoutMs(ms: number): void {
        this.timeoutMs = Math.max(100, ms);
    }

    public normalizeUrl(url: string | undefined | null): string {
        if (!url) return '';
        try {
            const u = new URL(url.trim());
            // Normalize path, discard common query tracking parameters (utm_*, ref, etc.)
            let pathname = u.pathname.replace(/\/$/, '').toLowerCase();
            return `${u.hostname}${pathname}`;
        } catch {
            return (url || '').trim().toLowerCase().replace(/\/$/, '');
        }
    }

    public normalizeHeadline(headline: string | undefined | null): string {
        return (headline || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    public normalizeCategory(cat: string | undefined | null): string {
        if (!cat) return 'Market';
        const clean = cat.trim();
        const lower = clean.toLowerCase();
        if (lower === 'f&o' || lower === 'fno') return 'F&O';
        if (lower === 'market' || lower === 'markets') return 'Market';
        if (lower === 'results' || lower === 'result') return 'Results';
        if (lower === 'ipo') return 'IPO';
        if (lower === 'economy') return 'Economy';
        if (lower === 'corporate') return 'Corporate';
        if (lower === 'commodities' || lower === 'commodity') return 'Commodities';
        if (lower === 'crypto') return 'Crypto';
        if (lower === 'global') return 'Global';
        if (lower === 'technology' || lower === 'tech') return 'Technology';
        if (lower === 'exchange') return 'Exchange';
        return clean;
    }

    public normalizeArticle(art: any): NormalizedShadowArticle {
        const rawUrl = art.canonicalUrl || art.sourceUrl || art.url || art.source?.url || '';
        const rawHeadline = art.headline || art.title || '';
        const rawPublisher = art.source?.publisher || art.source?.name || art.publisher || 'Unknown';
        const rawPublishedAt = art.publishedAt || new Date().toISOString();
        const rawCategory = art.primaryCategory || art.category || 'Market';
        const isFno = !!(art.fnoEligible ?? art.isFO ?? art.isFnO ?? art.fno?.eligible ?? false);
        const rawSymbol = art.symbol || art.fnoSymbol || art.fno?.symbol || null;
        const relevance = typeof art.relevanceScore === 'number' ? art.relevanceScore : 50;

        return {
            id: art.id || '',
            normalizedUrl: this.normalizeUrl(rawUrl),
            normalizedHeadline: this.normalizeHeadline(rawHeadline),
            publisher: (rawPublisher || '').trim(),
            publishedAt: rawPublishedAt,
            category: this.normalizeCategory(rawCategory),
            fnoEligible: isFno,
            symbol: rawSymbol ? rawSymbol.toUpperCase() : null,
            relevanceScore: relevance,
            sourceName: art.source?.name || art.source?.publisher || rawPublisher
        };
    }

    public generateFingerprint(norm: NormalizedShadowArticle): string {
        const datePrefix = norm.publishedAt.substring(0, 10);
        const pubPrefix = norm.publisher.toLowerCase().replace(/[^a-z0-9]/g, '');
        return `${norm.normalizedHeadline}|${pubPrefix}|${datePrefix}`;
    }

    /**
     * Executes shadow comparison between V2 and V3 without blocking or failing V2.
     */
    public async runShadowComparison(
        req: ShadowComparisonRequest,
        v2Response: any,
        feedService: NewsFeedService
    ): Promise<ShadowComparisonResult | null> {
        if (!this.isEnabled()) {
            return null;
        }

        const startTime = Date.now();
        let v3LatencyMs = 0;
        let v3Feed: FeedResponse | null = null;
        let shadowStatus: ShadowDiffType = 'MATCH';
        const comparisonId = `sc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        try {
            // Execute V3 fetch with safe timeout
            const v3Promise = feedService.getFeed({
                category: req.category || 'All',
                symbol: req.symbol,
                page: req.page || 1,
                limit: req.limit || 50,
                sort: req.sort || 'latest'
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('V3_SHADOW_TIMEOUT')), this.timeoutMs)
            );

            const v3Start = Date.now();
            v3Feed = await Promise.race([v3Promise, timeoutPromise]);
            v3LatencyMs = Date.now() - v3Start;
        } catch (err: any) {
            v3LatencyMs = Date.now() - startTime;
            if (err.message === 'V3_SHADOW_TIMEOUT') {
                shadowStatus = 'TIMEOUT';
                this.metrics.timeouts++;
            } else {
                shadowStatus = 'ERROR';
                this.metrics.errors++;
            }

            const errorResult: ShadowComparisonResult = {
                id: comparisonId,
                timestamp: new Date().toISOString(),
                request: req,
                v2Count: v2Response?.articles?.length || 0,
                v3Count: 0,
                v2TotalCount: v2Response?.totalCount || 0,
                v3TotalCount: 0,
                intersectionCount: 0,
                v2OnlyCount: v2Response?.articles?.length || 0,
                v3OnlyCount: 0,
                matches: 0,
                identityMismatches: 0,
                categoryMismatches: 0,
                metadataMismatches: 0,
                orderingDifferences: 0,
                paginationDifferences: 0,
                v3LatencyMs,
                comparisonDurationMs: Date.now() - startTime,
                status: shadowStatus,
                details: [{
                    type: shadowStatus,
                    reason: err.message || 'Shadow execution failed'
                }]
            };

            this.recordComparison(errorResult);
            return errorResult;
        }

        // Compare V2 and V3 payloads
        return this.comparePayloads(comparisonId, req, v2Response, v3Feed, v3LatencyMs, startTime);
    }

    public comparePayloads(
        comparisonId: string,
        req: ShadowComparisonRequest,
        v2Response: any,
        v3Feed: FeedResponse,
        v3LatencyMs: number,
        startTime: number
    ): ShadowComparisonResult {
        const v2RawArticles = v2Response?.articles || [];
        const v3RawArticles = v3Feed.articles || [];

        const v2Articles = v2RawArticles.map((a: any) => this.normalizeArticle(a));
        const v3Articles = v3RawArticles.map((a: any) => this.normalizeArticle(a));

        const v2Total = v2Response?.totalCount ?? v2Articles.length;
        const v3Total = v3Feed.totalCount ?? v3Articles.length;

        const details: ShadowDiffDetail[] = [];

        // Build URL & Fingerprint lookups
        const v2UrlMap = new Map<string, NormalizedShadowArticle>();
        const v2FpMap = new Map<string, NormalizedShadowArticle>();
        const v2IdMap = new Map<string, NormalizedShadowArticle>();

        for (const art of v2Articles) {
            if (art.normalizedUrl) v2UrlMap.set(art.normalizedUrl, art);
            const fp = this.generateFingerprint(art);
            if (fp) v2FpMap.set(fp, art);
            if (art.id) v2IdMap.set(art.id, art);
        }

        const v3UrlMap = new Map<string, NormalizedShadowArticle>();
        const v3FpMap = new Map<string, NormalizedShadowArticle>();
        const v3IdMap = new Map<string, NormalizedShadowArticle>();

        for (const art of v3Articles) {
            if (art.normalizedUrl) v3UrlMap.set(art.normalizedUrl, art);
            const fp = this.generateFingerprint(art);
            if (fp) v3FpMap.set(fp, art);
            if (art.id) v3IdMap.set(art.id, art);
        }

        let intersectionCount = 0;
        let v2OnlyCount = 0;
        let v3OnlyCount = 0;
        let matchCount = 0;
        let identityMismatchCount = 0;
        let categoryMismatchCount = 0;
        let metadataMismatchCount = 0;
        let orderingDifferenceCount = 0;
        let paginationDifferenceCount = 0;

        // Check V2 items against V3
        for (let i = 0; i < v2Articles.length; i++) {
            const v2Art = v2Articles[i];
            const v3Match = v3UrlMap.get(v2Art.normalizedUrl) || v3FpMap.get(this.generateFingerprint(v2Art));

            if (!v3Match) {
                v2OnlyCount++;
                details.push({
                    type: 'V2_ONLY',
                    articleId: v2Art.id,
                    url: v2Art.normalizedUrl,
                    headline: v2Art.normalizedHeadline,
                    v2Value: v2Art,
                    reason: 'Article present in V2 page but not in V3 page window'
                });
            } else {
                intersectionCount++;

                // Check Category
                if (v2Art.category !== v3Match.category) {
                    categoryMismatchCount++;
                    details.push({
                        type: 'CATEGORY_MISMATCH',
                        articleId: v2Art.id,
                        headline: v2Art.normalizedHeadline,
                        v2Value: v2Art.category,
                        v3Value: v3Match.category,
                        reason: `Category differs: V2="${v2Art.category}", V3="${v3Match.category}"`
                    });
                }

                // Check F&O / Metadata
                if (v2Art.fnoEligible !== v3Match.fnoEligible) {
                    metadataMismatchCount++;
                    details.push({
                        type: 'METADATA_MISMATCH',
                        articleId: v2Art.id,
                        headline: v2Art.normalizedHeadline,
                        v2Value: { fnoEligible: v2Art.fnoEligible },
                        v3Value: { fnoEligible: v3Match.fnoEligible },
                        reason: `F&O eligibility differs: V2=${v2Art.fnoEligible}, V3=${v3Match.fnoEligible}`
                    });
                }

                // Check Ordering sequence if index is different
                const v3Index = v3Articles.findIndex(a => a.normalizedUrl === v2Art.normalizedUrl || this.generateFingerprint(a) === this.generateFingerprint(v2Art));
                if (v3Index !== -1 && v3Index !== i) {
                    orderingDifferenceCount++;
                }

                if (v2Art.category === v3Match.category && v2Art.fnoEligible === v3Match.fnoEligible) {
                    matchCount++;
                }
            }
        }

        // Check V3 items that are V3-Only (Expected Growth)
        for (const v3Art of v3Articles) {
            const v2Match = v2UrlMap.get(v3Art.normalizedUrl) || v2FpMap.get(this.generateFingerprint(v3Art));
            if (!v2Match) {
                v3OnlyCount++;
                details.push({
                    type: 'V3_ONLY',
                    articleId: v3Art.id,
                    url: v3Art.normalizedUrl,
                    headline: v3Art.normalizedHeadline,
                    v3Value: v3Art,
                    reason: 'Legitimate newer article in V3 (Expected growth)'
                });
            }
        }

        // Check pagination
        const v2TotalPages = v2Response?.totalPages ?? Math.ceil(v2Total / (req.limit || 50));
        const v3TotalPages = v3Feed.totalPages;
        if (v2TotalPages !== v3TotalPages) {
            paginationDifferenceCount++;
        }

        // Determine primary status
        let finalStatus: ShadowDiffType = 'MATCH';
        if (categoryMismatchCount > 0) {
            finalStatus = 'CATEGORY_MISMATCH';
        } else if (metadataMismatchCount > 0) {
            finalStatus = 'METADATA_MISMATCH';
        } else if (v3OnlyCount > 0 && v2OnlyCount === 0) {
            finalStatus = 'V3_ONLY';
        } else if (v2OnlyCount > 0) {
            finalStatus = 'V2_ONLY';
        } else if (orderingDifferenceCount > 0) {
            finalStatus = 'ORDERING_DIFFERENCE';
        } else if (paginationDifferenceCount > 0) {
            finalStatus = 'PAGINATION_DIFFERENCE';
        }

        const duration = Date.now() - startTime;

        const result: ShadowComparisonResult = {
            id: comparisonId,
            timestamp: new Date().toISOString(),
            request: req,
            v2Count: v2Articles.length,
            v3Count: v3Articles.length,
            v2TotalCount: v2Total,
            v3TotalCount: v3Total,
            intersectionCount,
            v2OnlyCount,
            v3OnlyCount,
            matches: matchCount,
            identityMismatches: identityMismatchCount,
            categoryMismatches: categoryMismatchCount,
            metadataMismatches: metadataMismatchCount,
            orderingDifferences: orderingDifferenceCount,
            paginationDifferences: paginationDifferenceCount,
            v3LatencyMs,
            comparisonDurationMs: duration,
            status: finalStatus,
            details: details.slice(0, 50)
        };

        this.recordComparison(result);
        return result;
    }

    private recordComparison(res: ShadowComparisonResult): void {
        this.recentComparisons.unshift(res);
        if (this.recentComparisons.length > this.maxHistory) {
            this.recentComparisons.pop();
        }

        this.metrics.totalComparisons++;
        if (res.status === 'MATCH') this.metrics.matches++;
        if (res.v2OnlyCount > 0) this.metrics.v2Only += res.v2OnlyCount;
        if (res.v3OnlyCount > 0) this.metrics.v3Only += res.v3OnlyCount;
        this.metrics.identityMismatches += res.identityMismatches;
        this.metrics.categoryMismatches += res.categoryMismatches;
        this.metrics.metadataMismatches += res.metadataMismatches;
        this.metrics.orderingDifferences += res.orderingDifferences;
        this.metrics.paginationDifferences += res.paginationDifferences;

        // Moving average latency
        const total = this.metrics.totalComparisons;
        this.metrics.averageV3LatencyMs = Math.round(
            ((this.metrics.averageV3LatencyMs * (total - 1)) + res.v3LatencyMs) / total
        );
        this.metrics.lastComparisonAt = res.timestamp;
        this.metrics.lastStatus = res.status;
    }

    public getMetrics(): ShadowAggregateMetrics {
        return {
            ...this.metrics,
            enabled: this.isEnabled()
        };
    }

    public getRecentComparisons(limit = 20): ShadowComparisonResult[] {
        return this.recentComparisons.slice(0, limit);
    }

    public clearMetrics(): void {
        this.recentComparisons = [];
        this.metrics = {
            enabled: this.isEnabled(),
            totalComparisons: 0,
            matches: 0,
            v2Only: 0,
            v3Only: 0,
            identityMismatches: 0,
            categoryMismatches: 0,
            metadataMismatches: 0,
            orderingDifferences: 0,
            paginationDifferences: 0,
            timeouts: 0,
            errors: 0,
            averageV3LatencyMs: 0,
            lastComparisonAt: null,
            lastStatus: null
        };
    }
}

export const newsShadowComparator = NewsShadowComparator.getInstance();
