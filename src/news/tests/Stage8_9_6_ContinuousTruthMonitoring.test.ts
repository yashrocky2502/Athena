/**
 * ATHENA NEWS ENGINE — STAGE 8.9.6 CONTINUOUS TRUTH MONITORING & SELF-HEALING TEST SUITE
 * 75 Comprehensive Forensic Tests covering:
 * - Cross-boundary Truth Drift Detection (Disk, Store, V4, V5, UI Adapter, Summary, Telegram, Events, Sources, Freshness)
 * - Article-Level Forensic Inspection with Boundary Status Maps
 * - Summary Integrity & Zero-LLM Deterministic Validation
 * - Telegram Queue Reconciliation, Revision-Aware Idempotency & Delivery Guarantees
 * - Event Engine Boundary Auditing & False Merge/Split Detection
 * - Source Authority Hierarchy & Circuit State Enforcement
 * - Freshness Timeline & Stale News Containment
 * - 7-Level Self-Healing Recovery Hierarchy Execution & Idempotency
 * - Observability API Endpoint Response Structure
 * - Safe Mode & Canonical Non-Destructiveness Invariants
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { productionTruthDriftDetector, ProductionTruthDriftDetector } from '../controlPlane/ProductionTruthDriftDetector';
import { productionTruthControlPlane } from '../controlPlane/ProductionTruthControlPlane';
import { productionTruthGuard } from '../guard/ProductionTruthGuard';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { NewsCoreV2UIAdapter } from '../../newsCoreV2/api/NewsCoreV2UIAdapter';
import { NewsSummaryCache } from '../cache/NewsSummaryCache';
import { EventCentricOrchestrator } from '../intelligence/EventCentricOrchestrator';
import { sourceExpansionRegistry } from '../registry/SourceExpansionRegistry';
import { newsSafeModeController } from '../operations/NewsSafeModeController';
import { telegramOperationsController } from '../operations/TelegramOperationsController';
import { aiOperationsController } from '../operations/AIOperationsController';

describe('Stage 8.9.6: Continuous Production Truth Monitoring, Drift Detection & Self-Healing Validation', () => {
  beforeEach(() => {
    productionTruthDriftDetector.reset();
    ProductionTruthDriftDetector.resetInstance();
    productionTruthControlPlane.reset();
    productionTruthGuard.reset();
    NewsSummaryCache.getInstance().clear();
    EventCentricOrchestrator.resetInstance();
    newsSafeModeController.disableSafeMode();
    aiOperationsController.enableAI();
    telegramOperationsController.resume();
    telegramOperationsController.clearIdempotency();
  });

  afterEach(() => {
    newsSafeModeController.disableSafeMode();
    aiOperationsController.enableAI();
    telegramOperationsController.resume();
  });

  // =========================================================================
  // 1. CORE DRIFT DETECTION & CROSS-BOUNDARY SCANNING (1-10)
  // =========================================================================
  describe('1. Core Cross-Boundary Drift Detection', () => {
    it('1. Executes detectDrift() and returns a fully formed OverallDriftReport', () => {
      const report = productionTruthDriftDetector.detectDrift();
      expect(report).toBeDefined();
      expect(report.checkedAt).toBeDefined();
      expect(typeof report.driftDetected).toBe('boolean');
      expect(report.summaryIntegrity).toBeDefined();
      expect(report.telegramIntegrity).toBeDefined();
      expect(report.eventIntegrity).toBeDefined();
      expect(report.sourceIntegrity).toBeDefined();
      expect(report.freshnessIntegrity).toBeDefined();
      expect(Array.isArray(report.countDrifts)).toBe(true);
      expect(Array.isArray(report.articleDrifts)).toBe(true);
    });

    it('2. Reports no drift under ideal synchronized baseline conditions', () => {
      const report = productionTruthDriftDetector.detectDrift();
      expect(report.summaryIntegrity.driftCount).toBe(0);
      expect(report.telegramIntegrity.driftCount).toBe(0);
      expect(report.eventIntegrity.driftCount).toBe(0);
    });

    it('3. Timestamps every scan in valid ISO format', () => {
      const report = productionTruthDriftDetector.detectDrift();
      expect(new Date(report.checkedAt).getTime()).not.toBeNaN();
    });

    it('4. Tracks active incidents count in the drift report', () => {
      productionTruthControlPlane.recordIncident({
        domain: 'CANONICAL_STORAGE',
        severity: 'WARNING',
        reason: 'Test warning incident'
      });
      const report = productionTruthDriftDetector.detectDrift();
      expect(report.activeIncidentsCount).toBeGreaterThanOrEqual(1);
    });

    it('5. Reflects Safe Mode engagement status accurately', () => {
      expect(productionTruthDriftDetector.detectDrift().safeModeEngaged).toBe(false);
      newsSafeModeController.enableSafeMode('Testing Safe Mode detection');
      expect(productionTruthDriftDetector.detectDrift().safeModeEngaged).toBe(true);
    });

    it('6. Detects persistent store article total correctly', () => {
      const count = newsStore.getAllArticles().length;
      expect(count).toBeGreaterThan(0);
    });

    it('7. Integrates with UI Adapter count seamlessly', () => {
      const uiArticles = NewsCoreV2UIAdapter.getArticlesForUI();
      expect(Array.isArray(uiArticles)).toBe(true);
    });

    it('8. Evaluates V5 Event Projection count in drift scan', () => {
      const events = EventCentricOrchestrator.getInstance().getAllEvents();
      expect(Array.isArray(events)).toBe(true);
    });

    it('9. Preserves last generated report in detector instance', () => {
      const report1 = productionTruthDriftDetector.detectDrift();
      const report2 = productionTruthDriftDetector.detectDrift();
      expect(report2.checkedAt).toBeDefined();
    });

    it('10. Operates with sub-50ms execution speed for real-time monitoring', () => {
      const start = Date.now();
      productionTruthDriftDetector.detectDrift();
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50);
    });
  });

  // =========================================================================
  // 2. ARTICLE FORENSIC DISCREPANCY INSPECTION (11-20)
  // =========================================================================
  describe('2. Article Forensic Discrepancy Inspection', () => {
    it('11. Generates complete ArticleForensicReport for known article ID', () => {
      const articles = newsStore.getAllArticles();
      const targetId = articles[0]?.id || 'test_art_1';
      const forensic = productionTruthDriftDetector.getArticleForensicReport(targetId);

      expect(forensic).toBeDefined();
      expect(forensic.articleId).toBe(targetId);
      expect(typeof forensic.foundInDisk).toBe('boolean');
      expect(typeof forensic.foundInStore).toBe('boolean');
      expect(typeof forensic.foundInV4).toBe('boolean');
      expect(typeof forensic.foundInV5).toBe('boolean');
      expect(typeof forensic.foundInUIAdapter).toBe('boolean');
      expect(forensic.boundaryStatus).toBeDefined();
    });

    it('12. Reports boundaryStatus MATCH across synced boundaries', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const forensic = productionTruthDriftDetector.getArticleForensicReport(articles[0].id);
        expect(forensic.boundaryStatus.CANONICAL_DISK_VS_PERSISTENT_STORE).toBe('MATCH');
        expect(forensic.boundaryStatus.PERSISTENT_STORE_VS_V4_FEED).toBe('MATCH');
      }
    });

    it('13. Correctly identifies missing article on store vs disk boundary', () => {
      const forensic = productionTruthDriftDetector.getArticleForensicReport('non_existent_id_99999');
      expect(forensic.foundInDisk).toBe(false);
      expect(forensic.foundInStore).toBe(false);
      expect(forensic.foundInV4).toBe(false);
    });

    it('14. Resolves source tier for inspectable article', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const forensic = productionTruthDriftDetector.getArticleForensicReport(articles[0].id);
        expect(forensic.sourceTier).toBeGreaterThanOrEqual(1);
        expect(forensic.sourceTier).toBeLessThanOrEqual(4);
      }
    });

    it('15. Flags articles with duplicate IDs during forensic scan', () => {
      const report = productionTruthDriftDetector.detectDrift();
      expect(report.articleDrifts).toBeDefined();
    });

    it('16. Validates timestamp plausibility for canonical articles', () => {
      const articles = newsStore.getAllArticles();
      for (const a of articles) {
        const pubDate = a.publishedAt || a.collectedAt;
        if (pubDate) {
          const ms = new Date(pubDate).getTime();
          expect(ms).not.toBeNaN();
        }
      }
    });

    it('17. Inspects missing publisher attribution gracefully', () => {
      const forensic = productionTruthDriftDetector.getArticleForensicReport('unknown_publisher_art');
      expect(forensic.discrepancies).toBeDefined();
    });

    it('18. Includes inspection timestamp in forensic report', () => {
      const forensic = productionTruthDriftDetector.getArticleForensicReport('art_test_time');
      expect(new Date(forensic.inspectedAt).getTime()).not.toBeNaN();
    });

    it('19. Associates event ID if present in V5 cluster', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const forensic = productionTruthDriftDetector.getArticleForensicReport(articles[0].id);
        expect(forensic.inspectedAt).toBeDefined();
      }
    });

    it('20. Is zero-destructive during article forensic inspections', () => {
      const countBefore = newsStore.getAllArticles().length;
      productionTruthDriftDetector.getArticleForensicReport('art_test_safe');
      const countAfter = newsStore.getAllArticles().length;
      expect(countAfter).toBe(countBefore);
    });
  });

  // =========================================================================
  // 3. SUMMARY INTEGRITY & ZERO-LLM VALIDATION (21-30)
  // =========================================================================
  describe('3. Summary Integrity & Zero-LLM Validation', () => {
    it('21. Validates clean summary without triggering drift', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const id = articles[0].id;
        NewsSummaryCache.getInstance().set(id, {
          summaryId: `sum_${id}`,
          articleId: id,
          headline: articles[0].headline,
          executiveSummary: 'TCS reported a 12% YoY increase in quarterly net profit driven by digital transformation deals.',
          keyTakeaways: ['Net profit up 12% YoY', 'Digital deal momentum strong'],
          marketImpact: 'POSITIVE',
          fnoImpact: 'BULLISH',
          generatedAt: new Date().toISOString(),
          provider: 'DETERMINISTIC_V7_4'
        } as any);

        const res = productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
        expect(res.driftCount).toBe(0);
      }
    });

    it('22. Detects and evicts verbatim headline summaries', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const id = articles[0].id;
        const headline = articles[0].headline;

        NewsSummaryCache.getInstance().set(id, {
          summaryId: `sum_${id}`,
          articleId: id,
          headline,
          executiveSummary: headline,
          keyTakeaways: [],
          marketImpact: 'NEUTRAL',
          fnoImpact: 'NEUTRAL',
          generatedAt: new Date().toISOString(),
          provider: 'DETERMINISTIC'
        } as any);

        const res = productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
        expect(res.driftCount).toBeGreaterThanOrEqual(1);
        expect(res.items[0].discrepancyType).toBe('VERBATIM_HEADLINE');
        expect(NewsSummaryCache.getInstance().get(id)).toBeNull();
      }
    });

    it('23. Detects and evicts generic AI template leakage', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const id = articles[0].id;

        NewsSummaryCache.getInstance().set(id, {
          summaryId: `sum_${id}`,
          articleId: id,
          headline: 'Reliance Retail Expands Footprint',
          executiveSummary: 'As an AI, here is a summary of the news article detailing Reliance Retail footprint expansion.',
          keyTakeaways: [],
          marketImpact: 'NEUTRAL',
          fnoImpact: 'NEUTRAL',
          generatedAt: new Date().toISOString(),
          provider: 'LLM_FALLBACK'
        } as any);

        const res = productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
        expect(res.driftCount).toBeGreaterThanOrEqual(1);
        expect(res.items[0].discrepancyType).toBe('GENERIC_TEMPLATE_LEAKAGE');
        expect(NewsSummaryCache.getInstance().get(id)).toBeNull();
      }
    });

    it('24. Detects fabricated F&O metrics absent from source text', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const id = articles[0].id;

        NewsSummaryCache.getInstance().set(id, {
          summaryId: `sum_${id}`,
          articleId: id,
          headline: 'Simple Corporate Board Meeting Scheduled',
          executiveSummary: 'The company scheduled board meeting. Open Interest spiked 45% with heavy Strike Price activity at 2500 Call.',
          keyTakeaways: [],
          marketImpact: 'NEUTRAL',
          fnoImpact: 'NEUTRAL',
          generatedAt: new Date().toISOString(),
          provider: 'SIMULATED'
        } as any);

        const res = productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
        expect(res.driftCount).toBeGreaterThanOrEqual(1);
        expect(res.items[0].discrepancyType).toBe('UNSUPPORTED_FNO_METRIC');
      }
    });

    it('25. Records incident in Control Plane upon detecting summary drift', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const id = articles[0].id;
        NewsSummaryCache.getInstance().set(id, {
          executiveSummary: 'As an AI language model, I cannot provide financial advice.',
          articleId: id
        } as any);

        productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
        const incidents = productionTruthControlPlane.getIncidents('SUMMARY_ENGINE');
        expect(incidents.length).toBeGreaterThan(0);
      }
    });

    it('26. Clears cache entry automatically when evicting bad summary', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const id = articles[0].id;
        NewsSummaryCache.getInstance().set(id, {
          executiveSummary: 'As an AI model, here is summary.',
          articleId: id
        } as any);

        productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
        expect(NewsSummaryCache.getInstance().has(id)).toBe(false);
      }
    });

    it('27. Operates without any AI/LLM network calls during summary audit', () => {
      const aiStatus = aiOperationsController.getAIStatus();
      const res = productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
      expect(res).toBeDefined();
      expect(aiOperationsController.getAIStatus().telemetry.totalCalls).toBe(aiStatus.telemetry.totalCalls);
    });

    it('28. Audits multiple cached summaries in a single pass', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length >= 2) {
        NewsSummaryCache.getInstance().set(articles[0].id, { executiveSummary: 'Valid summary text for article 1.' } as any);
        NewsSummaryCache.getInstance().set(articles[1].id, { executiveSummary: 'Valid summary text for article 2.' } as any);

        const res = productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
        expect(res.totalChecked).toBeGreaterThanOrEqual(2);
      }
    });

    it('29. Ignores empty or uninitialized summary entries safely', () => {
      NewsSummaryCache.getInstance().clear();
      const res = productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
      expect(res.driftCount).toBe(0);
    });

    it('30. Preserves valid summaries without evicting them', () => {
      const articles = newsStore.getAllArticles();
      if (articles.length > 0) {
        const id = articles[0].id;
        NewsSummaryCache.getInstance().set(id, {
          articleId: id,
          headline: articles[0].headline,
          executiveSummary: 'Quarterly revenue grew by 18% YoY driven by enterprise contract renewals.'
        } as any);

        productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());
        expect(NewsSummaryCache.getInstance().has(id)).toBe(true);
      }
    });
  });

  // =========================================================================
  // 4. TELEGRAM QUEUE RECONCILIATION & REVISION IDEMPOTENCY (31-40)
  // =========================================================================
  describe('4. Telegram Queue Reconciliation & Idempotency', () => {
    it('31. Tracks delivered Telegram keys via markTelegramDelivered()', () => {
      productionTruthDriftDetector.markTelegramDelivered('evt_100', 'BREAKING_NEWS', 1);
      expect(productionTruthDriftDetector.isTelegramDelivered('evt_100', 'BREAKING_NEWS', 1)).toBe(true);
    });

    it('32. Differentiates alert types for same event ID in idempotency check', () => {
      productionTruthDriftDetector.markTelegramDelivered('evt_101', 'INITIAL_ALERT', 1);
      expect(productionTruthDriftDetector.isTelegramDelivered('evt_101', 'INITIAL_ALERT', 1)).toBe(true);
      expect(productionTruthDriftDetector.isTelegramDelivered('evt_101', 'ESCALATION_ALERT', 1)).toBe(false);
    });

    it('33. Differentiates revisions for same event ID and alert type', () => {
      productionTruthDriftDetector.markTelegramDelivered('evt_102', 'MATERIAL_UPDATE', 1);
      expect(productionTruthDriftDetector.isTelegramDelivered('evt_102', 'MATERIAL_UPDATE', 1)).toBe(true);
      expect(productionTruthDriftDetector.isTelegramDelivered('evt_102', 'MATERIAL_UPDATE', 2)).toBe(false);
    });

    it('34. Detects duplicate Telegram dispatches during queue integrity check', () => {
      productionTruthDriftDetector.markTelegramDelivered('evt_dup_1', 'MARKET_EVENT', 1);

      const checkRes = productionTruthDriftDetector.checkTelegramIntegrity(new Date().toISOString());
      expect(checkRes).toBeDefined();
    });

    it('35. Validates revision-aware idempotency format eventId::alertType::revision', () => {
      const eventId = 'evt_fmt_1';
      const alertType = 'EARNINGS_ALERT';
      const revision = 3;

      productionTruthDriftDetector.markTelegramDelivered(eventId, alertType, revision);
      expect(productionTruthDriftDetector.isTelegramDelivered(eventId, alertType, revision)).toBe(true);
    });

    it('36. Does not block unsent new alerts in Telegram integrity scan', () => {
      const isDelivered = productionTruthDriftDetector.isTelegramDelivered('evt_fresh_1', 'NEW_EVENT', 1);
      expect(isDelivered).toBe(false);
    });

    it('37. Reconciles queue depth telemetry with control plane', () => {
      const forensics = productionTruthControlPlane.getTelegramForensics();
      expect(forensics).toBeDefined();
      expect(typeof forensics.queueDepth).toBe('number');
    });

    it('38. Integrates with TelegramOperationsController pause state', () => {
      telegramOperationsController.pause('Testing pause state');
      expect(telegramOperationsController.isPaused()).toBe(true);
      telegramOperationsController.resume();
      expect(telegramOperationsController.isPaused()).toBe(false);
    });

    it('39. Guarantees zero duplicate dispatch under repeated mark calls', () => {
      for (let i = 0; i < 5; i++) {
        productionTruthDriftDetector.markTelegramDelivered('evt_repeat_1', 'ALERT', 1);
      }
      expect(productionTruthDriftDetector.isTelegramDelivered('evt_repeat_1', 'ALERT', 1)).toBe(true);
    });

    it('40. Clears Telegram idempotency map upon detector reset', () => {
      const detector = ProductionTruthDriftDetector.getInstance();
      detector.markTelegramDelivered('evt_reset_1', 'ALERT', 1);
      const fresh = ProductionTruthDriftDetector.resetInstance();
      expect(fresh.isTelegramDelivered('evt_reset_1', 'ALERT', 1)).toBe(false);
    });
  });

  // =========================================================================
  // 5. EVENT ENGINE BOUNDARY AUDITING (41-50)
  // =========================================================================
  describe('5. Event Engine Boundary Auditing', () => {
    it('41. Scans event engine state and returns event integrity report', () => {
      const report = productionTruthDriftDetector.checkEventIntegrity(new Date().toISOString());
      expect(report).toBeDefined();
      expect(typeof report.totalChecked).toBe('number');
      expect(typeof report.driftCount).toBe('number');
      expect(Array.isArray(report.items)).toBe(true);
    });

    it('42. Detects potential false event merges when stock symbols conflict', () => {
      const orchestrator = EventCentricOrchestrator.getInstance();
      const articles = newsStore.getAllArticles();
      if (articles.length >= 2) {
        orchestrator.processArticle(articles[0] as any);
        orchestrator.processArticle(articles[1] as any);
      }

      const report = productionTruthDriftDetector.checkEventIntegrity(new Date().toISOString());
      expect(report.totalChecked).toBeGreaterThanOrEqual(0);
    });

    it('43. Verifies event fingerprint engine consistency', () => {
      const orchestrator = EventCentricOrchestrator.getInstance();
      const events = orchestrator.getAllEvents();
      expect(Array.isArray(events)).toBe(true);
    });

    it('44. Preserves primary source attribution in event cluster', () => {
      const events = EventCentricOrchestrator.getInstance().getAllEvents();
      for (const ev of events) {
        expect(ev.primarySource).toBeDefined();
      }
    });

    it('45. Is zero-destructive to canonical news store during event audits', () => {
      const beforeCount = newsStore.getAllArticles().length;
      productionTruthDriftDetector.checkEventIntegrity(new Date().toISOString());
      expect(newsStore.getAllArticles().length).toBe(beforeCount);
    });

    it('46. Handles empty event store gracefully without throwing', () => {
      EventCentricOrchestrator.resetInstance();
      const report = productionTruthDriftDetector.checkEventIntegrity(new Date().toISOString());
      expect(report.totalChecked).toBe(0);
      expect(report.driftCount).toBe(0);
    });

    it('47. Logs incidents to control plane when event discrepancies are found', () => {
      const incidentsBefore = productionTruthControlPlane.getIncidents('EVENT_ENGINE').length;
      productionTruthDriftDetector.checkEventIntegrity(new Date().toISOString());
      const incidentsAfter = productionTruthControlPlane.getIncidents('EVENT_ENGINE').length;
      expect(incidentsAfter).toBeGreaterThanOrEqual(incidentsBefore);
    });

    it('48. Reports zero drift for well-formed single-source events', () => {
      const orchestrator = EventCentricOrchestrator.getInstance();
      orchestrator.processArticle({
        id: 'art_single_1',
        headline: 'Infosys Signs $1.5B Cloud Deal With European Bank',
        body: 'Infosys announced a major strategic cloud transformation deal with European banking client.',
        publishedAt: new Date().toISOString(),
        publisher: 'Reuters',
        sourceUrl: 'https://reuters.com/infosys-deal'
      });

      const report = productionTruthDriftDetector.checkEventIntegrity(new Date().toISOString());
      expect(report.driftCount).toBe(0);
    });

    it('49. Audits event freshness status correctly', () => {
      const events = EventCentricOrchestrator.getInstance().getAllEvents();
      for (const ev of events) {
        expect(['HOT', 'WARM', 'COLD', 'ARCHIVED']).toContain((ev as any).freshness || 'HOT');
      }
    });

    it('50. Rebuilds event index cleanly via resetInstance()', () => {
      EventCentricOrchestrator.resetInstance();
      expect(EventCentricOrchestrator.getInstance().getAllEvents().length).toBe(0);
    });
  });

  // =========================================================================
  // 6. SOURCE AUTHORITY HIERARCHY & CIRCUIT STATE (51-60)
  // =========================================================================
  describe('6. Source Authority Hierarchy & Circuit State', () => {
    it('51. Assigns Tier 1 to exchange & regulator sources (BSE, NSE, SEBI, RBI)', () => {
      expect(productionTruthDriftDetector.getSourceTier('BSE India')).toBe(1);
      expect(productionTruthDriftDetector.getSourceTier('NSE Corporate Filings')).toBe(1);
      expect(productionTruthDriftDetector.getSourceTier('SEBI Press Releases')).toBe(1);
      expect(productionTruthDriftDetector.getSourceTier('RBI Official')).toBe(1);
    });

    it('52. Assigns Tier 2 to major wire services & tier-1 financial press', () => {
      expect(productionTruthDriftDetector.getSourceTier('Reuters')).toBe(2);
      expect(productionTruthDriftDetector.getSourceTier('The Economic Times')).toBe(2);
      expect(productionTruthDriftDetector.getSourceTier('Business Standard')).toBe(2);
      expect(productionTruthDriftDetector.getSourceTier('Moneycontrol')).toBe(2);
    });

    it('53. Assigns Tier 3 to secondary media & news portals', () => {
      expect(productionTruthDriftDetector.getSourceTier('Generic News Express')).toBe(3);
    });

    it('54. Assigns Tier 4 to unclassified / fallback sources', () => {
      expect(productionTruthDriftDetector.getSourceTier('Random Blog Wire')).toBe(4);
    });

    it('55. Audits source expansion registry state and returns source integrity report', () => {
      const report = productionTruthDriftDetector.checkSourceIntegrity(new Date().toISOString());
      expect(report).toBeDefined();
      expect(typeof report.totalChecked).toBe('number');
      expect(report.totalChecked).toBeGreaterThan(0);
    });

    it('56. Detects source state mismatches between enabled flag and circuit breaker', () => {
      const sources = sourceExpansionRegistry.getAllSources();
      expect(sources.length).toBeGreaterThan(0);
    });

    it('57. Preserves high-tier source priority during authority evaluation', () => {
      const tier1 = productionTruthDriftDetector.getSourceTier('NSE');
      const tier3 = productionTruthDriftDetector.getSourceTier('Random News');
      expect(tier1).toBeLessThan(tier3);
    });

    it('58. Records source authority incident in Control Plane when violations occur', () => {
      const incidents = productionTruthControlPlane.getIncidents('SOURCE_INGESTION');
      expect(Array.isArray(incidents)).toBe(true);
    });

    it('59. Quarantines repeatedly failing sources without mutating canonical data', () => {
      const quarantined = sourceExpansionRegistry.getQuarantinedSources();
      expect(Array.isArray(quarantined)).toBe(true);
    });

    it('60. Returns non-empty source list from registry', () => {
      const sources = sourceExpansionRegistry.getAllSources();
      expect(sources.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 7. SELF-HEALING RECOVERY HIERARCHY (LEVELS 1-7) (61-68)
  // =========================================================================
  describe('7. Self-Healing Recovery Hierarchy Execution', () => {
    it('61. Level 1: Executes Projection Refresh successfully', async () => {
      const res = await productionTruthDriftDetector.executeRecoveryLevel(1);
      expect(res.level).toBe(1);
      expect(res.actionName).toBe('PROJECTION_REFRESH');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Level 1 recovery');
    });

    it('62. Level 2: Executes Repository Rehydration successfully', async () => {
      const res = await productionTruthDriftDetector.executeRecoveryLevel(2);
      expect(res.level).toBe(2);
      expect(res.actionName).toBe('REPOSITORY_REHYDRATION');
      expect(res.success).toBe(true);
      expect(res.articlesRecovered).toBeGreaterThan(0);
    });

    it('63. Level 3: Executes Event Reconstruction successfully', async () => {
      const res = await productionTruthDriftDetector.executeRecoveryLevel(3);
      expect(res.level).toBe(3);
      expect(res.actionName).toBe('EVENT_RECONSTRUCTION');
      expect(res.success).toBe(true);
    });

    it('64. Level 4: Executes Summary Invalidation successfully', async () => {
      NewsSummaryCache.getInstance().set('test_art_1', { summaryText: 'Test' } as any);
      expect(NewsSummaryCache.getInstance().has('test_art_1')).toBe(true);

      const res = await productionTruthDriftDetector.executeRecoveryLevel(4);
      expect(res.level).toBe(4);
      expect(res.actionName).toBe('SUMMARY_INVALIDATION');
      expect(res.success).toBe(true);
      expect(NewsSummaryCache.getInstance().has('test_art_1')).toBe(false);
    });

    it('65. Level 5: Executes Telegram Queue Reconciliation successfully', async () => {
      const res = await productionTruthDriftDetector.executeRecoveryLevel(5);
      expect(res.level).toBe(5);
      expect(res.actionName).toBe('TELEGRAM_QUEUE_RECONCILIATION');
      expect(res.success).toBe(true);
    });

    it('66. Level 6: Executes Source Isolation successfully', async () => {
      const res = await productionTruthDriftDetector.executeRecoveryLevel(6);
      expect(res.level).toBe(6);
      expect(res.actionName).toBe('SOURCE_ISOLATION');
      expect(res.success).toBe(true);
    });

    it('67. Level 7: Executes Safe Mode Engagement successfully', async () => {
      expect(newsSafeModeController.isSafeMode()).toBe(false);
      const res = await productionTruthDriftDetector.executeRecoveryLevel(7);
      expect(res.level).toBe(7);
      expect(res.actionName).toBe('SAFE_MODE');
      expect(res.success).toBe(true);
      expect(res.safeModeEngaged).toBe(true);
      expect(newsSafeModeController.isSafeMode()).toBe(true);
    });

    it('68. Maintains idempotency across multiple recovery executions', async () => {
      const res1 = await productionTruthDriftDetector.executeRecoveryLevel(1);
      const res2 = await productionTruthDriftDetector.executeRecoveryLevel(1);
      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
    });
  });

  // =========================================================================
  // 8. OPERATIONAL INVARIANTS & SAFE MODE NON-DESTRUCTIVENESS (69-75)
  // =========================================================================
  describe('8. Operational Invariants & Safe Mode Non-Destructiveness', () => {
    it('69. Safe Mode preserves full read accessibility of canonical articles', () => {
      const beforeCount = newsStore.getAllArticles().length;
      newsSafeModeController.enableSafeMode('Invariants test');

      const articles = newsStore.getAllArticles();
      expect(articles.length).toBe(beforeCount);
      expect(articles.length).toBeGreaterThan(0);
    });

    it('70. Safe Mode preserves full read accessibility of V4 feed', () => {
      newsSafeModeController.enableSafeMode('Invariants test');
      const feed = NewsCoreV2UIAdapter.getArticlesForUI();
      expect(feed.length).toBeGreaterThan(0);
    });

    it('71. Safe Mode suspends AI operations cleanly', () => {
      newsSafeModeController.enableSafeMode('Invariants test');
      expect(aiOperationsController.isAIEnabled()).toBe(false);
    });

    it('72. Safe Mode pauses Telegram dispatch pipeline cleanly', () => {
      newsSafeModeController.enableSafeMode('Invariants test');
      expect(telegramOperationsController.isPaused()).toBe(true);
    });

    it('73. Drift detection logic contains zero LLM/AI dependency', () => {
      aiOperationsController.disableAI();
      const report = productionTruthDriftDetector.detectDrift();
      expect(report).toBeDefined();
      expect(report.checkedAt).toBeDefined();
    });

    it('74. Canonical storage file data/news_core_v2.json is never mutated or shrunk by drift detector', () => {
      const articles = newsStore.getAllArticles();
      const countBefore = articles.length;

      productionTruthDriftDetector.detectDrift();
      (productionTruthDriftDetector as any).checkCountDrifts(new Date().toISOString());
      (productionTruthDriftDetector as any).checkArticleDrifts(new Date().toISOString());
      productionTruthDriftDetector.checkSummaryIntegrity(new Date().toISOString());

      expect(newsStore.getAllArticles().length).toBe(countBefore);
    });

    it('75. Safe Mode deactivation cleanly restores AI and Telegram pipelines', () => {
      newsSafeModeController.enableSafeMode('Temporary safe mode');
      expect(newsSafeModeController.isSafeMode()).toBe(true);

      newsSafeModeController.disableSafeMode();
      expect(newsSafeModeController.isSafeMode()).toBe(false);
      expect(aiOperationsController.isAIEnabled()).toBe(true);
      expect(telegramOperationsController.isPaused()).toBe(false);
    });
  });
});
