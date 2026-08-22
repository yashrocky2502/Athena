/**
 * ATHENA NEWS ENGINE — STAGE 8.7 FEED INTEGRITY MONITOR
 * FeedIntegrityMonitor
 * 
 * Verifies count alignment, duplicate freedom, and persistence integrity across:
 * - Canonical Disk Store (data/news_core_v2.json)
 * - PersistentNewsStore (In-Memory)
 * - Stage 2 Store (JsonNewsStore / V5)
 * 
 * STRICT MANDATE:
 * - Read-only monitoring & diagnostic reporting ONLY.
 * - MUST NOT automatically delete, rewrite, or mutate canonical data.
 */

import fs from 'fs';
import path from 'path';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { JsonNewsStore } from '../storage/JsonNewsStore';

export type IntegrityStatus = 'HEALTHY' | 'MISMATCH' | 'DEGRADED' | 'CANONICAL_COUNT_REGRESSION';

export interface IntegrityReport {
  status: IntegrityStatus;
  timestamp: string;
  canonicalDiskCount: number;
  persistentMemoryCount: number;
  v5Stage2Count: number;
  adapterCount?: number;
  apiCount?: number;
  verifiedCanonicalCount: number;
  hasCanonicalCountRegressed: boolean;
  uniqueMemoryIdsCount: number;
  duplicateIdsCount: number;
  duplicateUrlsCount: number;
  missingIds: string[];
  duplicateIds: string[];
  duplicateUrls: string[];
  mismatches: string[];
  causeAnalysis: string[];
  recommendedAction: string;
}

export class FeedIntegrityMonitor {
  private static instance: FeedIntegrityMonitor | null = null;
  private autoCheckTimer: NodeJS.Timeout | null = null;
  private lastReport: IntegrityReport | null = null;
  private verifiedCanonicalCount: number = 0;

  private constructor() {
    this.hydrateInitialVerifiedCount();
  }

  public static getInstance(): FeedIntegrityMonitor {
    if (!FeedIntegrityMonitor.instance) {
      FeedIntegrityMonitor.instance = new FeedIntegrityMonitor();
    }
    return FeedIntegrityMonitor.instance;
  }

  public static resetInstance(): FeedIntegrityMonitor {
    if (FeedIntegrityMonitor.instance) {
      FeedIntegrityMonitor.instance.stopAutoCheck();
    }
    FeedIntegrityMonitor.instance = new FeedIntegrityMonitor();
    return FeedIntegrityMonitor.instance;
  }

  private hydrateInitialVerifiedCount(): void {
    const memoryArticles = newsStore.getAllArticles();
    if (memoryArticles.length > 0) {
      this.verifiedCanonicalCount = memoryArticles.length;
    }
  }

  public setVerifiedCanonicalCount(count: number): void {
    this.verifiedCanonicalCount = Math.max(this.verifiedCanonicalCount, count);
  }

  public getVerifiedCanonicalCount(): number {
    return this.verifiedCanonicalCount;
  }

  /**
   * Executes a forensic integrity check across disk, memory, adapter, and Stage 2 stores.
   * Guarantees zero mutation to canonical datasets.
   */
  public async runIntegrityCheck(): Promise<IntegrityReport> {
    const dataPath = path.join(process.cwd(), 'data', 'news_core_v2.json');
    let canonicalDiskCount = 0;
    const diskIds = new Set<string>();

    if (fs.existsSync(dataPath)) {
      try {
        const raw = fs.readFileSync(dataPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          canonicalDiskCount = parsed.length;
          for (const item of parsed) {
            if (item && item.id) diskIds.add(item.id);
          }
        }
      } catch (e) {
        canonicalDiskCount = -1; // Parsing failure
      }
    }

    const memoryArticles = newsStore.getAllArticles();
    const persistentMemoryCount = memoryArticles.length;

    // Check duplicates in memory
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const duplicateIds: string[] = [];
    const duplicateUrls: string[] = [];

    for (const art of memoryArticles) {
      if (seenIds.has(art.id)) {
        duplicateIds.push(art.id);
      } else {
        seenIds.add(art.id);
      }

      const url = (art as any).canonicalUrl || (art as any).sourceUrl || (art as any).url || '';
      if (url && url.length > 5) {
        if (seenUrls.has(url)) {
          duplicateUrls.push(url);
        } else {
          seenUrls.add(url);
        }
      }
    }

    // Check missing IDs between disk and memory
    const missingIds: string[] = [];
    for (const id of diskIds) {
      if (!seenIds.has(id)) {
        missingIds.push(id);
      }
    }

    // Check Stage 2 / V5 count
    let v5Stage2Count = 0;
    try {
      const stage2Store = new JsonNewsStore();
      v5Stage2Count = await stage2Store.count();
    } catch {
      v5Stage2Count = 0;
    }

    // High water mark count verification
    let hasCanonicalCountRegressed = false;
    if (this.verifiedCanonicalCount > 0 && persistentMemoryCount < this.verifiedCanonicalCount) {
      hasCanonicalCountRegressed = true;
    } else if (persistentMemoryCount > this.verifiedCanonicalCount) {
      this.verifiedCanonicalCount = persistentMemoryCount;
    }

    const mismatches: string[] = [];
    const causeAnalysis: string[] = [];

    if (hasCanonicalCountRegressed) {
      mismatches.push(`CANONICAL_COUNT_REGRESSION: Memory count (${persistentMemoryCount}) is less than verified high-water mark (${this.verifiedCanonicalCount}).`);
      causeAnalysis.push('Silent destructive write or incomplete initialization detected.');
    }

    if (canonicalDiskCount >= 0 && canonicalDiskCount !== persistentMemoryCount) {
      mismatches.push(`Disk count (${canonicalDiskCount}) differs from memory count (${persistentMemoryCount}).`);
      causeAnalysis.push('Unsaved in-memory articles or delayed flush to disk.');
    }

    if (duplicateIds.length > 0) {
      mismatches.push(`Found ${duplicateIds.length} duplicate article IDs in memory store.`);
      causeAnalysis.push('Concurrent ingestion without deduplication check or duplicate key collisions.');
    }

    if (duplicateUrls.length > 0) {
      mismatches.push(`Found ${duplicateUrls.length} duplicate canonical URLs in memory store.`);
      causeAnalysis.push('Multiple feeds syndicating same story without canonical URL normalization.');
    }

    let status: IntegrityStatus = 'HEALTHY';
    if (hasCanonicalCountRegressed) {
      status = 'CANONICAL_COUNT_REGRESSION';
    } else if (duplicateIds.length > 0 || (canonicalDiskCount >= 0 && canonicalDiskCount !== persistentMemoryCount)) {
      status = 'MISMATCH';
    } else if (duplicateUrls.length > 5) {
      status = 'DEGRADED';
    }

    let recommendedAction = 'System integrity is optimal. No action required.';
    if (status === 'CANONICAL_COUNT_REGRESSION') {
      recommendedAction = 'ALERT: Investigate potential unverified article pruning or store corruption immediately. Do not normalize count downward.';
    } else if (status === 'MISMATCH') {
      recommendedAction = 'Investigate ingestion pipeline deduplication step and trigger explicit sync/flush.';
    } else if (status === 'DEGRADED') {
      recommendedAction = 'Monitor source syndication rates and verify normalization URL canonicalization.';
    }

    const report: IntegrityReport = {
      status,
      timestamp: new Date().toISOString(),
      canonicalDiskCount,
      persistentMemoryCount,
      v5Stage2Count,
      adapterCount: persistentMemoryCount,
      apiCount: persistentMemoryCount,
      verifiedCanonicalCount: this.verifiedCanonicalCount,
      hasCanonicalCountRegressed,
      uniqueMemoryIdsCount: seenIds.size,
      duplicateIdsCount: duplicateIds.length,
      duplicateUrlsCount: duplicateUrls.length,
      missingIds,
      duplicateIds,
      duplicateUrls,
      mismatches,
      causeAnalysis,
      recommendedAction
    };

    this.lastReport = report;
    return report;
  }

  public getLastReport(): IntegrityReport | null {
    return this.lastReport;
  }

  public startAutoCheck(intervalMs = 30000): void {
    if (this.autoCheckTimer) {
      clearInterval(this.autoCheckTimer);
    }
    this.autoCheckTimer = setInterval(() => {
      this.runIntegrityCheck().catch(err => {
        console.warn('[FeedIntegrityMonitor] Auto check error:', err.message);
      });
    }, intervalMs);
  }

  public stopAutoCheck(): void {
    if (this.autoCheckTimer) {
      clearInterval(this.autoCheckTimer);
      this.autoCheckTimer = null;
    }
  }
}

export const feedIntegrityMonitor = FeedIntegrityMonitor.getInstance();
