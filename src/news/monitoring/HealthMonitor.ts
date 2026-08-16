import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { JsonNewsStore } from '../storage/JsonNewsStore.ts';
import { IngestionTelemetry } from './IngestionTelemetry.ts';

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

        // 2. Freshness Monitor
        let oldestPublishedAt: string | null = null;
        let newestPublishedAt: string | null = null;
        let ingestionLagSeconds = 0;
        let freshnessStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';

        if (articles.length > 0) {
            // Since articles are pre-sorted by publishedAt descending, the first is newest, last is oldest
            newestPublishedAt = articles[0].publishedAt;
            oldestPublishedAt = articles[articles.length - 1].publishedAt;

            const newestDate = new Date(newestPublishedAt);
            if (!isNaN(newestDate.getTime())) {
                const ageMinutes = (now.getTime() - newestDate.getTime()) / (60 * 1000);
                ingestionLagSeconds = Math.max(0, Math.floor((now.getTime() - newestDate.getTime()) / 1000));

                const warningThreshold = Number(process.env.ATHENA_NEWS_FRESHNESS_WARNING_MINUTES) || 30;
                const criticalThreshold = Number(process.env.ATHENA_NEWS_FRESHNESS_CRITICAL_MINUTES) || 120;

                const telemetry = IngestionTelemetry.getInstance();
                const lastSyncSuccess = telemetry.lastSuccessfulIngestion;
                
                let isCollectorInactive = false;
                if (lastSyncSuccess) {
                    const syncInactivityMinutes = (now.getTime() - new Date(lastSyncSuccess).getTime()) / (60 * 1000);
                    if (syncInactivityMinutes > warningThreshold) {
                        isCollectorInactive = true;
                    }
                }

                // If ageMinutes is large, only flag warning/critical if there is actual collector inactivity
                if (ageMinutes > criticalThreshold && isCollectorInactive) {
                    freshnessStatus = 'CRITICAL';
                } else if (ageMinutes > warningThreshold && isCollectorInactive) {
                    freshnessStatus = 'WARNING';
                }
            }
        }

        // 3. Duplicate Identification
        let uniqueIds = 0;
        let uniqueUrls = 0;
        let duplicateIds = 0;
        let duplicateUrls = 0;
        let missingRequiredFields = 0;

        const seenIds = new Set<string>();
        const seenUrls = new Set<string>();

        for (const art of articles) {
            if (!art.id || !art.headline || !art.publishedAt || !art.sourceUrl) {
                missingRequiredFields++;
            }
            if (seenIds.has(art.id)) {
                duplicateIds++;
            } else {
                seenIds.add(art.id);
            }
            if (seenUrls.has(art.sourceUrl)) {
                duplicateUrls++;
            } else {
                seenUrls.add(art.sourceUrl);
            }
        }
        uniqueIds = seenIds.size;
        uniqueUrls = seenUrls.size;

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

        // 6. Alert Severity Model
        let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (this.criticalCountDecreaseDetected || duplicateIds > 0 || duplicateUrls > 0 || missingRequiredFields > 0) {
            overallStatus = 'critical';
        } else if (freshnessStatus === 'CRITICAL') {
            overallStatus = 'critical';
        } else if (freshnessStatus === 'WARNING' || categoryAnomalies.length > 0 || publisherAnomalies.length > 0) {
            overallStatus = 'warning';
        }

        // 7. Writer Status metadata (Expected legacy vs canonical vs monitoring)
        const stage2Path = path.join(process.cwd(), 'data', 'news_stage2_store.json');
        const v2Path = path.join(process.cwd(), 'data', 'news_core_v2.json');
        const v3Path = path.join(process.cwd(), 'data', 'v3_news_store.json');
        const intelPath = path.join(process.cwd(), 'data', 'news_intelligence_v2.json');

        const getFileInfo = (p: string) => {
            if (!fs.existsSync(p)) return { exists: false };
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
            count: currentCount,
            oldestPublishedAt,
            newestPublishedAt,
            ingestionLagSeconds,
            uniqueIds,
            uniqueUrls,
            duplicateIds,
            duplicateUrls,
            missingRequiredFields,
            categoryCount: currentCategoryCounts,
            publisherCount,
            storeHash: writerStatus.canonicalStore.exists ? writerStatus.canonicalStore.sha256 : 'missing',
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
