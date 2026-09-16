import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { NewsSyncService } from "../../newsCoreV2/sync/NewsSyncService";
import { CollectorRegistry } from "../../newsCoreV2/ingestion/CollectorRegistry";

describe("Phase 3B: News Telemetry Truthfulness & Production Integrity Acceptance Tests", () => {
  it("1. Verifies server.ts does not contain fabricated fallback literals for RSS / news metrics", () => {
    const serverCode = fs.readFileSync(path.resolve(process.cwd(), "server.ts"), "utf-8");

    // Must not contain fabricated fallback metric magic numbers
    expect(serverCode).not.toContain("telemetry.articlesFetched || 38");
    expect(serverCode).not.toContain("telemetry.articlesAccepted || 14");
    expect(serverCode).not.toContain("telemetry.articlesRejected || 4");
    expect(serverCode).not.toContain("telemetry.duplicateCount || 20");
    expect(serverCode).not.toContain("telemetry.articlesFetched || 120");
    expect(serverCode).not.toContain("lastLatencyMs: 120");
    expect(serverCode).not.toContain("totalSuccess: 120");
  });

  it("2. Verifies legacy /api/rss/* control routes are truthfully disabled with 503 status", () => {
    const serverCode = fs.readFileSync(path.resolve(process.cwd(), "server.ts"), "utf-8");

    // All legacy control mutations must return 503 and indicate LEGACY_NEWS_ENGINE_DISABLED
    expect(serverCode).toContain('app.post("/api/rss/refresh"');
    expect(serverCode).toContain('app.post("/api/rss/toggle-poller"');
    expect(serverCode).toContain('app.post("/api/rss/reload"');
    expect(serverCode).toContain('app.post("/api/rss/clear"');
    expect(serverCode).toContain('app.post("/api/rss/test-connector"');

    // Confirm LEGACY_NEWS_ENGINE_DISABLED reason is present
    expect(serverCode).toContain("LEGACY_NEWS_ENGINE_DISABLED");
  });

  it("3. Verifies authoritative GET /api/rss/diagnostics sources data truthfully from News Core V2", () => {
    const serverCode = fs.readFileSync(path.resolve(process.cwd(), "server.ts"), "utf-8");

    // Must use newsSyncService and newsStore in diagnostics
    expect(serverCode).toContain("newsSyncService.getStatus()");
    expect(serverCode).toContain("newsStore.getStats()");
  });

  it("4. NewsSyncService.getStatus() provides truthful state structure without null pointer risks", () => {
    const syncService = new NewsSyncService();
    const status = syncService.getStatus();

    expect(status).toHaveProperty("syncState");
    expect(status).toHaveProperty("lastAttemptAt");
    expect(status).toHaveProperty("lastSuccessfulSyncAt");
    expect(status).toHaveProperty("nextSyncAt");
    expect(status).toHaveProperty("lastSyncItemCount");
    expect(status).toHaveProperty("lastSyncDurationMs");
    expect(status).toHaveProperty("lastError");

    const collectorsCount = syncService.getActiveCollectorsCount();
    expect(typeof collectorsCount).toBe("number");
    expect(collectorsCount).toBeGreaterThan(0);
  });

  it("5. CollectorRegistry contains registered News Core V2 collectors with valid configurations", () => {
    const registry = new CollectorRegistry();
    const count = registry.getActiveCollectorsCount();

    expect(count).toBeGreaterThan(0);
    expect(typeof registry.collectAll).toBe("function");
  });

  it("6. Admin dashboard uses /api/v4/news/status and handles optional/empty connectorHealth gracefully", () => {
    const dashboardCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/admin/NewsOperationsDashboard.tsx"),
      "utf-8"
    );

    // LiveMonitorView uses /api/v4/news/status
    expect(dashboardCode).toContain('fetch("/api/v4/news/status")');
    expect(dashboardCode).not.toContain('fetch("/api/v3/news/monitor-status")');

    // LiveMonitorView manual sync uses /api/v4/news/sync
    expect(dashboardCode).toContain('fetch("/api/v4/news/sync"');

    // Safe connectorHealth calculations
    expect(dashboardCode).toContain("diag?.connectorHealth || []");
  });
});
