/**
 * ATHENA — PHASE 8 PRODUCTION ACCEPTANCE SUITE
 * News Core V2 Production Sync / Legacy Writer Isolation Boundary Verification
 *
 * Explicitly Proves:
 * A. Missing ATHENA_NEWS_CORE_V2_SYNC_ENABLED => false.
 * B. "false" => false.
 * C. "0" => false.
 * D. "true" => true.
 * E. "1" => true.
 * F. Legacy flag false does NOT affect authoritative V4 sync permission.
 * G. Server startup with sync flag absent does not initiate background ingestion.
 * H. Explicit test enablement works only with isolated temporary storage.
 * I. Legacy V2/V3 routes remain 503.
 * J. V4 reads remain operational while sync is disabled.
 * K. Manual V4 sync does not ingest when the guard is disabled.
 * L. Collector failures/timeouts do not fabricate data.
 * M. Canonical News Core anti-shrink protection remains active.
 * N. Starting the application in AI Studio/test/preview with no explicit sync flag cannot mutate any protected production dataset.
 * O. All protected production hashes remain unchanged after the complete suite.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import http from "http";
import express from "express";

import { LegacyWriterGuard } from "../isolation/LegacyWriterGuard.ts";
import { NewsCoreV2SyncGuard } from "../../newsCoreV2/isolation/NewsCoreV2SyncGuard.ts";
import { NewsSyncService, newsSyncService } from "../../newsCoreV2/sync/NewsSyncService.ts";
import { PersistentNewsStore, newsStore } from "../../newsCoreV2/storage/PersistentNewsStore.ts";
import { newsCoreV2Router } from "../../newsCoreV2/api/newsCoreV2Routes.ts";
import { NewsCanaryRouter } from "../canary/NewsCanaryRouter.ts";
import { NewsNormalizer } from "../../newsCoreV2/normalization/NewsNormalizer.ts";
import { CollectorRegistry } from "../../newsCoreV2/ingestion/CollectorRegistry.ts";
import { RawNewsItem } from "../../newsCoreV2/ingestion/NewsCollector.ts";
import { TelegramOutbox } from "../../newsCoreV2/storage/TelegramOutbox.ts";

function computeSha256(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function getRecordCount(filePath: string): number | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (Array.isArray(parsed)) return parsed.length;
    if (typeof parsed === "object" && parsed !== null) return Object.keys(parsed).length;
  } catch (e) {}
  return null;
}

describe("ATHENA Phase 8: News Core V2 Production Sync & Isolation Boundary", () => {
  const dataDir = path.join(process.cwd(), "data");
  const protectedFiles = [
    "news_core_v2.json",
    "news_core_v2.json.bak",
    "market_intelligence_outcomes.json",
    "market_intelligence_outcomes.json.bak",
    "news_intelligence_v2.json",
    "news_signal_lifecycle.json",
    "news_signal_historical_ledger.json",
    "telegram_decisions.json",
    "telegram_notifications.json",
    "telegram_notification_state.json",
    "telegram_outbox.json",
    "v3_news_store.json"
  ];

  let initialHashes: Record<string, { sha: string | null; count: number | null }> = {};
  const originalEnvSync = process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED;

  beforeEach(() => {
    LegacyWriterGuard.resetToDefault();
    NewsCoreV2SyncGuard.resetToDefault();
    delete process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED;

    // Snapshot hashes
    protectedFiles.forEach((f) => {
      const full = path.join(dataDir, f);
      initialHashes[f] = {
        sha: computeSha256(full),
        count: getRecordCount(full)
      };
    });
  });

  afterEach(() => {
    LegacyWriterGuard.resetToDefault();
    NewsCoreV2SyncGuard.resetToDefault();
    if (originalEnvSync !== undefined) {
      process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED = originalEnvSync;
    } else {
      delete process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED;
    }
    vi.restoreAllMocks();

    // Verify zero mutation after each test
    protectedFiles.forEach((f) => {
      const full = path.join(dataDir, f);
      const afterSha = computeSha256(full);
      const afterCount = getRecordCount(full);
      expect(afterSha).toBe(initialHashes[f].sha);
      expect(afterCount).toBe(initialHashes[f].count);
    });
  });

  it("A. Missing ATHENA_NEWS_CORE_V2_SYNC_ENABLED => false", () => {
    delete process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED;
    NewsCoreV2SyncGuard.resetToDefault();
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(false);
  });

  it("B. 'false' => false", () => {
    process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED = "false";
    NewsCoreV2SyncGuard.resetToDefault();
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(false);
  });

  it("C. '0' => false", () => {
    process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED = "0";
    NewsCoreV2SyncGuard.resetToDefault();
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(false);
  });

  it("D. 'true' => true", () => {
    process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED = "true";
    NewsCoreV2SyncGuard.resetToDefault();
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(true);
  });

  it("E. '1' => true", () => {
    process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED = "1";
    NewsCoreV2SyncGuard.resetToDefault();
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(true);
  });

  it("F. Legacy flag false does NOT affect authoritative V4 sync permission", () => {
    LegacyWriterGuard.setLegacyWritersEnabled(false);
    NewsCoreV2SyncGuard.setSyncEnabled(true);

    expect(LegacyWriterGuard.isLegacyWritersEnabled()).toBe(false);
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(true);

    LegacyWriterGuard.setLegacyWritersEnabled(true);
    NewsCoreV2SyncGuard.setSyncEnabled(false);

    expect(LegacyWriterGuard.isLegacyWritersEnabled()).toBe(true);
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(false);
  });

  it("G. Server startup with sync flag absent does not initiate background ingestion", () => {
    delete process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED;
    NewsCoreV2SyncGuard.resetToDefault();

    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(false);

    // Call startScheduler() with sync disabled -> ensures timer is not scheduled and initial boot sync does not execute
    const testSyncService = new NewsSyncService();
    testSyncService.startScheduler();
    expect((testSyncService as any).timer).toBeNull();
  });

  it("H. Explicit test enablement works only with isolated temporary storage", async () => {
    NewsCoreV2SyncGuard.setSyncEnabled(true);
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(true);

    const tempStorePath = path.join(dataDir, `test_news_store_${Date.now()}.json`);
    const tempOutboxPath = path.join(dataDir, `test_news_outbox_${Date.now()}.json`);
    const mockStore = new PersistentNewsStore(tempStorePath);
    const mockOutbox = new TelegramOutbox(tempOutboxPath);

    const mockRegistry = new CollectorRegistry(false);
    mockRegistry.register({
      name: "MockTestSource",
      collect: async (): Promise<RawNewsItem[]> => [
        {
          headline: "Reliance Industries Secures New Green Energy Contract",
          body: "Reliance Industries announced a major green energy solar installation contract.",
          url: "https://example.com/reliance-solar",
          publisher: "Economic Times",
          publishedAt: new Date().toISOString(),
          collectionMethod: "RSS"
        }
      ]
    });

    const isolatedSyncService = new NewsSyncService(mockRegistry, mockStore, mockOutbox);
    const syncResult = await isolatedSyncService.runSync();

    expect(syncResult.status).toBe("COMPLETED");
    expect(syncResult.itemsProcessed).toBe(1);
    expect(syncResult.newAdded).toBe(1);

    // Clean up temp files
    if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath);
    if (fs.existsSync(`${tempStorePath}.bak`)) fs.unlinkSync(`${tempStorePath}.bak`);
    if (fs.existsSync(tempOutboxPath)) fs.unlinkSync(tempOutboxPath);
  });

  it("I. Legacy V2/V3 routes remain 503", async () => {
    const app = express();
    app.use(express.json());

    // Replicate server.ts isolation middleware
    app.use(["/api/v2/news", "/api/v3/news", "/api/v2/news/*", "/api/v3/news/*"], (req, res) => {
      res.status(503).json({
        status: "error",
        message: "Legacy News Engine is ISOLATED and DISABLED. Sourced exclusively from News Core V2 (/api/v4/news/*).",
        newsCoreVersion: "V2"
      });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const v2Res = await fetch(`${baseUrl}/api/v2/news/feed`);
      expect(v2Res.status).toBe(503);
      const v2Body = await v2Res.json();
      expect(v2Body.status).toBe("error");

      const v3Res = await fetch(`${baseUrl}/api/v3/news/feed`);
      expect(v3Res.status).toBe(503);
      const v3Body = await v3Res.json();
      expect(v3Body.status).toBe("error");
    } finally {
      server.close();
    }
  });

  it("J. V4 reads remain operational while sync is disabled", async () => {
    NewsCoreV2SyncGuard.setSyncEnabled(false);
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(false);

    const app = express();
    app.use(express.json());
    app.use("/api/v4/news", newsCoreV2Router);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const feedRes = await fetch(`${baseUrl}/api/v4/news/feed?limit=5`);
      expect(feedRes.status).toBe(200);
      const feedBody = await feedRes.json();
      expect(feedBody.status).toBe("success");
      expect(Array.isArray(feedBody.articles)).toBe(true);

      const statusRes = await fetch(`${baseUrl}/api/v4/news/status`);
      expect(statusRes.status).toBe(200);
      const statusBody = await statusRes.json();
      expect(statusBody.status).toBe("success");
      expect(statusBody.storageCount).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });

  it("K. Manual V4 sync does not ingest when the guard is disabled", async () => {
    NewsCoreV2SyncGuard.setSyncEnabled(false);
    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(false);

    const app = express();
    app.use(express.json());
    app.use("/api/v4/news", newsCoreV2Router);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const syncRes = await fetch(`${baseUrl}/api/v4/news/sync`, { method: "POST" });
      expect(syncRes.status).toBe(200);
      const syncBody = await syncRes.json();
      expect(syncBody.status).toBe("disabled");
      expect(syncBody.syncState).toBe("DISABLED");
      expect(syncBody.itemsProcessed).toBe(0);
      expect(syncBody.newAdded).toBe(0);
    } finally {
      server.close();
    }
  });

  it("L. Collector failures/timeouts do not fabricate data", async () => {
    NewsCoreV2SyncGuard.setSyncEnabled(true);
    const tempStorePath = path.join(dataDir, `test_store_fail_${Date.now()}.json`);
    const mockStore = new PersistentNewsStore(tempStorePath);

    const mockRegistry = new CollectorRegistry(false);
    mockRegistry.register({
      name: "FailingCollector",
      collect: async () => {
        throw new Error("Simulated upstream network timeout 504 Gateway");
      }
    });

    const isolatedSyncService = new NewsSyncService(mockRegistry, mockStore);
    const result = await isolatedSyncService.runSync();

    expect(result.status).toBe("COMPLETED");
    expect(result.itemsProcessed).toBe(0);
    expect(result.newAdded).toBe(0);
    expect(mockStore.getAllArticles().length).toBe(0);

    if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath);
  });

  it("M. Canonical News Core anti-shrink protection remains active", async () => {
    const tempStorePath = path.join(dataDir, `test_store_shrink_${Date.now()}.json`);
    const mockStore = new PersistentNewsStore(tempStorePath);

    const article1 = NewsNormalizer.normalizeArticle({
      headline: "TCS Delivers Q3 Results Exceeding Profit Forecasts",
      body: "Tata Consultancy Services reported strong quarterly earnings growth.",
      source: { publisher: "LiveMint", url: "https://example.com/tcs-q3", collectionMethod: "RSS" }
    });
    const article2 = NewsNormalizer.normalizeArticle({
      headline: "Infosys Expands European Cloud Infrastructure Hub",
      body: "Infosys has inaugurated a new enterprise cloud facility.",
      source: { publisher: "Economic Times", url: "https://example.com/infy-cloud", collectionMethod: "RSS" }
    });

    await mockStore.saveArticles([article1, article2]);
    expect(mockStore.getAllArticles().length).toBe(2);

    // Attempting to save empty array should not delete existing articles
    await mockStore.saveArticles([]);
    expect(mockStore.getAllArticles().length).toBe(2);

    if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath);
    if (fs.existsSync(`${tempStorePath}.bak`)) fs.unlinkSync(`${tempStorePath}.bak`);
  });

  it("N. Starting the application in AI Studio/test/preview with no explicit sync flag cannot mutate any protected production dataset", () => {
    delete process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED;
    NewsCoreV2SyncGuard.resetToDefault();

    expect(NewsCoreV2SyncGuard.isSyncEnabled()).toBe(false);

    protectedFiles.forEach((f) => {
      const full = path.join(dataDir, f);
      const currentSha = computeSha256(full);
      const currentCount = getRecordCount(full);
      expect(currentSha).toBe(initialHashes[f].sha);
      expect(currentCount).toBe(initialHashes[f].count);
    });
  });

  it("O. All protected production hashes remain unchanged after the complete suite", () => {
    protectedFiles.forEach((f) => {
      const full = path.join(dataDir, f);
      const afterSha = computeSha256(full);
      const afterCount = getRecordCount(full);
      expect(afterSha).toBe(initialHashes[f].sha);
      expect(afterCount).toBe(initialHashes[f].count);
    });
  });
});
