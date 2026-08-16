import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { IngestionTelemetry } from './IngestionTelemetry.ts';
import { collectorHealthMonitor } from './CollectorHealthMonitor.ts';
import { CanonicalArticleValidator } from '../validation/CanonicalArticleValidator.ts';
import { PersistentV3StorageAdapter } from '../NewsEngineV3/storage/PersistentV3StorageAdapter.ts';

export interface IngestionError {
    timestamp: string;
    collector: string;
    errorClass: 'collector_failure' | 'network_failure' | 'parser_failure' | 'schema_validation_failure' | 'deduplication_failure' | 'storage_failure' | 'timeout' | 'rate_limit' | 'authentication_failure' | 'unknown';
    message: string;
    retryStatus: 'pending' | 'failed' | 'succeeded' | 'none';
    canonicalStorageModified: boolean;
}

export class HealthMonitor {
    private static instance: HealthMonitor | null = null;
    private stage2Store: JsonNewsStore;

    // Stateful Count Tracking
    private previousCount = 0;
    private lastGrowthTimestamp: string | null = null;
    private criticalCountDecreaseDetected = false;
    private decreaseDetails: any = null;

    // Stateful Category Tracking for anomaly detection
    private previousCategoryCounts: Record<string, number> = {};

    // Cache parameters
    private cachedHealthData: any = null;
    private lastCheckedAt: Date | null = null;

    private constructor() {
        this.stage2Store = new JsonNewsStore();
    }

    public static getInstance(): HealthMonitor {
        if (!this.instance) {
            this.instance = new HealthMonitor();
        }
        return this.instance;
    }

    public async initialize(): Promise<void> {
        await this.stage2Store.initialize();
        const initialCount = await this.stage2Store.count();
        this.previousCount = initialCount;
        
        // Populate initial category counts
        const articles = await this.stage2Store.getAll();
        const cats: Record<string, number> = {};
        for (const art of articles) {
            const cat = art.primaryCategory || 'Other';
            cats[cat] = (cats[cat] || 0) + 1;
        }
        this.previousCategoryCounts = cats;
    }

    public getFileSha256(filePath: string): string {
        if (!fs.existsSync(filePath)) return 'missing';
        try {
            const content = fs.readFileSync(filePath);
            return crypto.createHash('sha256').update(content).digest('hex');
        } catch {
            return 'unreadable';
        }
    }

    public async checkHealth(): Promise<any> {
        const intervalSeconds = Number(process.env.ATHENA_NEWS_HEALTH_INTERVAL_SECONDS) || 60;
        const now = new Date();

        if (this.cachedHealthData && this.lastCheckedAt && (now.getTime() - this.lastCheckedAt.getTime() < intervalSeconds * 1000)) {
            return {
                ...this.cachedHealthData,
                cached: true,
                lastCheckedAt: this.lastCheckedAt.toISOString()
            };
        }

        // Perform health check calculations (STRICTLY READ-ONLY)
        const articles = await this.stage2Store.getAll();
        const currentCount = articles.length;

        // 1. Count stability
        let countDelta = 0;
        let growthRate = 0;
        let countStatus = 'STABLE';

        if (this.previousCount === 0 && currentCount > 0) {
            this.previousCount = currentCount;
        }

        if (currentCount > this.previousCount) {
            countDelta = currentCount - this.previousCount;
            growthRate = parseFloat((countDelta / this.previousCount).toFixed(4));
            this.lastGrowthTimestamp = now.toISOString();
            this.previousCount = currentCount;
            countStatus = 'GROWING';
        } else if (currentCount < this.previousCount) {
            this.criticalCountDecreaseDetected = true;
            countDelta = currentCount - this.previousCount;
            this.decreaseDetails = {
                event: 'CANONICAL_COUNT_DECREASE_DETECTED',
                previousCount: this.previousCount,
                currentCount,
                delta: countDelta,
                action: 'NO_AUTOMATIC_MUTATION'
            };
            countStatus = 'DECREASED';
        }

        // 2. Freshness Monitor & Lag Calculations
        let oldestPublishedAt: string | null = null;
        let newestPublishedAt: string | null = null;
        let ingestionLagSeconds = 0;
        let ageOfNewestArticleMinutes = 0;
        let ageOfNewestArticleSeconds = 0;
        let timeSinceLastSuccessfulIngestionSeconds: number | null = null;
        let timeSinceLastCollectorExecutionSeconds: number | null = null;
        let freshnessStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';

        const telemetry = IngestionTelemetry.getInstance();

        if (telemetry.lastSuccessfulIngestion) {
            const syncTime = new Date(telemetry.lastSuccessfulIngestion).getTime();
            timeSinceLastSuccessfulIngestionSeconds = Math.max(0, Math.floor((now.getTime() - syncTime) / 1000));
            timeSinceLastCollectorExecutionSeconds = timeSinceLastSuccessfulIngestionSeconds;
        }

        if (articles.length > 0) {
            // Sort to ensure absolute bounds
            const sortedByPub = [...articles].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
            newestPublishedAt = sortedByPub[0].publishedAt;
            oldestPublishedAt = sortedByPub[sortedByPub.length - 1].publishedAt;

            const newestDate = new Date(newestPublishedAt);
            if (!isNaN(newestDate.getTime())) {
                ageOfNewestArticleMinutes = parseFloat(((now.getTime() - newestDate.getTime()) / (60 * 1000)).toFixed(1));
                ageOfNewestArticleSeconds = Math.max(0, Math.floor((now.getTime() - newestDate.getTime()) / 1000));
                ingestionLagSeconds = ageOfNewestArticleSeconds;

                const warningThreshold = Number(process.env.ATHENA_NEWS_FRESHNESS_WARNING_MINUTES) || 30;
                const criticalThreshold = Number(process.env.ATHENA_NEWS_FRESHNESS_CRITICAL_MINUTES) || 120;

                const lastSyncSuccess = telemetry.lastSuccessfulIngestion;
                let isCollectorInactive = false;
                if (lastSyncSuccess) {
                    const syncInactivityMinutes = (now.getTime() - new Date(lastSyncSuccess).getTime()) / (60 * 1000);
                    if (syncInactivityMinutes > warningThreshold) {
                        isCollectorInactive = true;
                    }
                }

                // If ageMinutes is large and collector is inactive, elevate alert
                if (ageOfNewestArticleMinutes > criticalThreshold && isCollectorInactive) {
                    freshnessStatus = 'CRITICAL';
                } else if (ageOfNewestArticleMinutes > warningThreshold && isCollectorInactive) {
                    freshnessStatus = 'WARNING';
                } else {
                    freshnessStatus = 'HEALTHY';
                }
            }
        }

        // 3. Duplicate Identification & Schema Compliance
        let uniqueIds = 0;
        let uniqueCanonicalUrls = 0;
        let duplicateIds = 0;
        let duplicateCanonicalUrls = 0;
        let invalidSchemaCount = 0;

        const seenIds = new Set<string>();
        const seenUrls = new Set<string>();

        for (const art of articles) {
            const valErrors = CanonicalArticleValidator.validate(art);
            if (valErrors.length > 0) {
                invalidSchemaCount++;
            }

            if (seenIds.has(art.id)) {
                duplicateIds++;
            } else {
                seenIds.add(art.id);
            }

            if (seenUrls.has(art.sourceUrl)) {
                duplicateCanonicalUrls++;
            } else {
                seenUrls.add(art.sourceUrl);
            }
        }
        uniqueIds = seenIds.size;
        uniqueCanonicalUrls = seenUrls.size;

        const schemaCompliance = {
            validCount: currentCount - invalidSchemaCount,
            invalidCount: invalidSchemaCount,
            compliancePercentage: currentCount > 0 ? parseFloat((((currentCount - invalidSchemaCount) / currentCount) * 100).toFixed(2)) : 100
        };

        // 4. Category Quality Monitoring
        const currentCategoryCounts: Record<string, number> = {};
        const CANONICAL_CATEGORIES = [
            'All', 'Results', 'Crypto', 'IPO', 'F&O', 'Economy', 'Market', 
            'Corporate', 'Commodities', 'Global', 'Technology', 'Exchange'
        ];

        for (const cat of CANONICAL_CATEGORIES) {
            currentCategoryCounts[cat] = 0;
        }
        currentCategoryCounts['Other'] = 0;

        for (const art of articles) {
            const cat = art.primaryCategory || 'Other';
            if (currentCategoryCounts[cat] !== undefined) {
                currentCategoryCounts[cat]++;
            } else {
                currentCategoryCounts['Other']++;
            }
        }

        const categoryAnomalies: string[] = [];
        for (const [cat, count] of Object.entries(currentCategoryCounts)) {
            const prev = this.previousCategoryCounts[cat] || 0;
            if (prev > 0) {
                const ratio = count / prev;
                if (ratio < 0.5) {
                    categoryAnomalies.push(`Category "${cat}" count dropped suddenly by >50% (Current: ${count}, Previous: ${prev})`);
                } else if (ratio > 3.0) {
                    categoryAnomalies.push(`Category "${cat}" count increased suddenly by >200% (Current: ${count}, Previous: ${prev})`);
                }
            }
            if (!CANONICAL_CATEGORIES.includes(cat) && cat !== 'Other' && count > 0) {
                categoryAnomalies.push(`Unexpected category "${cat}" appears with ${count} records.`);
            }
        }

        const totalOther = currentCategoryCounts['Other'] || 0;
        if (currentCount > 0 && (totalOther / currentCount) > 0.3) {
            categoryAnomalies.push(`Unusually large percentage of articles classified as "Other" (${((totalOther / currentCount) * 100).toFixed(1)}%)`);
        }

        // Update baseline category counts for next cycle
        this.previousCategoryCounts = { ...currentCategoryCounts };

        // 5. Publisher / Source Quality Monitor
        const publisherCount: Record<string, number> = {};
        for (const art of articles) {
            const pubName = art.source?.publisher || art.source?.name || 'Unknown';
            publisherCount[pubName] = (publisherCount[pubName] || 0) + 1;
        }

        const topPublishers = Object.entries(publisherCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([pub, count]) => ({ publisher: pub, count, percentage: parseFloat(((count / currentCount) * 100).toFixed(2)) }));

        const publisherAnomalies: string[] = [];
        if (topPublishers.length > 0 && topPublishers[0].percentage > 60) {
            publisherAnomalies.push(`High source concentration: top publisher "${topPublishers[0].publisher}" dominates ${topPublishers[0].percentage}% of the canonical store.`);
        }

        // Identify publishers with zero articles in the last 7 days
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        const activePublishersInLast7Days = new Set<string>();
        for (const art of articles) {
            const pubDate = new Date(art.publishedAt);
            if (!isNaN(pubDate.getTime()) && pubDate >= sevenDaysAgo) {
                const pubName = art.source?.publisher || art.source?.name || 'Unknown';
                activePublishersInLast7Days.add(pubName);
            }
        }

        const idlePublishers: string[] = [];
        for (const pubName of Object.keys(publisherCount)) {
            if (!activePublishersInLast7Days.has(pubName)) {
                idlePublishers.push(pubName);
            }
        }
        if (idlePublishers.length > 0) {
            publisherAnomalies.push(`Publisher inactivity detected: ${idlePublishers.join(', ')} have zero articles published in the last 7 days.`);
        }

        // 6. Collector Health Matrix
        const collectorHealthMatrix = collectorHealthMonitor.getCollectorHealthReport();

        // 7. News Population Separation Definition
        const v3Stories = await PersistentV3StorageAdapter.getInstance().getAllStories();
        const populationBreakdown = {
            populationA: {
                name: 'Population A — Canonical Articles',
                storage: 'data/news_stage2_store.json',
                count: currentCount,
                purpose: 'Immutable, authoritative historical source of truth for all fully validated articles.'
            },
            populationB: {
                name: 'Population B — Raw Ingestion Records',
                storage: 'Transient / Event Ingestion Payloads',
                count: telemetry.ingestionAttempts,
                purpose: 'Unfiltered incoming payloads prior to identity hashing, classification, and deduplication.'
            },
            populationC: {
                name: 'Population C — Clustered V3 Stories',
                storage: 'data/v3_news_store.json',
                count: v3Stories.length,
                purpose: 'Multi-article grouped and synthesized analytical story clusters.'
            },
            populationD: {
                name: 'Population D — Duplicates & Syndicated Articles',
                storage: 'Filtered by Deduplication Engine',
                count: telemetry.duplicatesRejected,
                purpose: 'Articles identified as exact or near-match syndications; rejected from canonical store.'
            },
            populationE: {
                name: 'Population E — Retained / Expired V3 Stories',
                storage: 'Pruned by RETENTION_DAYS=30 in V3 Storage',
                count: 0,
                purpose: 'Expired story clusters pruned from V3 active storage. Leaves canonical store untouched.'
            },
            populationF: {
                name: 'Population F — Current UI Feed Records',
                storage: 'API Response / In-Memory Filtered',
                count: currentCount,
                purpose: 'Targeted user view applying active category, symbol, search, and pagination filters.'
            },
            cardinalityTruth: 'Canonical Articles ≠ Clustered Stories ≠ UI Feed Count'
        };

        // 8. Alert Severity Model
        let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (this.criticalCountDecreaseDetected || duplicateIds > 0 || duplicateCanonicalUrls > 0 || invalidSchemaCount > 0) {
            overallStatus = 'critical';
        } else if (freshnessStatus === 'CRITICAL') {
            overallStatus = 'critical';
        } else if (freshnessStatus === 'WARNING' || categoryAnomalies.length > 0 || publisherAnomalies.length > 0) {
            overallStatus = 'warning';
        }

        // 9. Writer Status metadata (Expected legacy vs canonical vs monitoring)
        const stage2Path = path.join(process.cwd(), 'data', 'news_stage2_store.json');
        const v2Path = path.join(process.cwd(), 'data', 'news_core_v2.json');
        const v3Path = path.join(process.cwd(), 'data', 'v3_news_store.json');
        const intelPath = path.join(process.cwd(), 'data', 'news_intelligence_v2.json');

        const getFileInfo = (p: string) => {
            if (!fs.existsSync(p)) return { exists: false, size: 0, sha256: 'missing', mtime: null };
            const stat = fs.statSync(p);
            return {
                exists: true,
                size: stat.size,
                mtime: stat.mtime.toISOString(),
                sha256: this.getFileSha256(p)
            };
        };

        const writerStatus = {
            canonicalStore: getFileInfo(stage2Path),
            canonicalBackupStore: getFileInfo(`${stage2Path}.bak`),
            legacyV2Store: getFileInfo(v2Path),
            legacyV2BackupStore: getFileInfo(`${v2Path}.bak`),
            legacyV2IntelligenceStore: getFileInfo(intelPath),
            legacyV3Store: getFileInfo(v3Path)
        };

        this.cachedHealthData = {
            status: overallStatus,
            canonicalArticleCount: currentCount,
            count: currentCount,
            previousKnownCanonicalCount: this.previousCount,
            previousCount: this.previousCount,
            countDelta,
            uniqueIds,
            uniqueCanonicalUrls,
            duplicateIds,
            duplicateCanonicalUrls,
            duplicateUrls: duplicateCanonicalUrls,
            missingRequiredFields: invalidSchemaCount,
            schemaCompliance,
            oldestArticle: oldestPublishedAt,
            oldestPublishedAt,
            newestArticle: newestPublishedAt,
            newestPublishedAt,
            sha256: writerStatus.canonicalStore.exists ? writerStatus.canonicalStore.sha256 : 'missing',
            storeHash: writerStatus.canonicalStore.exists ? writerStatus.canonicalStore.sha256 : 'missing',
            backupSha256: writerStatus.canonicalBackupStore.exists ? writerStatus.canonicalBackupStore.sha256 : 'missing',
            fileSizeBytes: writerStatus.canonicalStore.size,
            fileSize: writerStatus.canonicalStore.size,
            ingestionLagSeconds,
            ageOfNewestArticleMinutes,
            ageOfNewestArticleSeconds,
            timeSinceLastSuccessfulIngestionSeconds,
            timeSinceLastCollectorExecutionSeconds,
            articlesReceivedLast5Min: telemetry.getArticlesAddedInWindow(5),
            articlesReceivedLast15Min: telemetry.getArticlesAddedInWindow(15),
            articlesReceivedLastHour: telemetry.getGrowthPerHour(),
            articlesReceivedLast24Hours: telemetry.getGrowthPerDay(),
            freshnessStatus,
            categoryDistribution: currentCategoryCounts,
            categoryCount: currentCategoryCounts,
            publisherDistribution: publisherCount,
            publisherCount,
            collectorHealth: collectorHealthMatrix,
            populationBreakdown,
            lastCheckedAt: now.toISOString(),
            writerStatus,
            diagnostics: {
                countStatus,
                countDelta,
                growthRate,
                lastGrowthTimestamp: this.lastGrowthTimestamp,
                freshnessStatus,
                categoryAnomalies,
                publisherAnomalies,
                decreaseDetails: this.decreaseDetails,
                topPublishers,
                idlePublishers
            }
        };

        this.lastCheckedAt = now;
        return {
            ...this.cachedHealthData,
            cached: false
        };
    }

    public isCountDecreased(): boolean {
        return this.criticalCountDecreaseDetected;
    }

    public getDecreaseDetails(): any {
        return this.decreaseDetails;
    }

    public resetState(): void {
        this.previousCount = 0;
        this.lastGrowthTimestamp = null;
        this.criticalCountDecreaseDetected = false;
        this.decreaseDetails = null;
        this.previousCategoryCounts = {};
        this.cachedHealthData = null;
        this.lastCheckedAt = null;
    }
}

export const healthMonitor = HealthMonitor.getInstance();
