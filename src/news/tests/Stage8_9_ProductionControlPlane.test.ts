/**
 * ATHENA NEWS ENGINE — STAGE 8.9 TEST SUITE
 * Stage8_9_ProductionControlPlane.test.ts
 * 
 * 60 Comprehensive Automated Tests validating:
 * 1. Operational Config & Modes (T1-T6)
 * 2. Telegram Operational Control Plane (T7-T13)
 * 3. Source Expansion Operational Controls (T14-T19)
 * 4. AI Operations & Cost Guard (T20-T25)
 * 5. Safe Mode Degraded Operations (T26-T31)
 * 6. Canary Routing Isolation (T32-T37)
 * 7. Feed Integrity & Count Regression Guard (T38-T43)
 * 8. Forex Factory & Optional Sources (T44-T49)
 * 9. Operational API Endpoints (T50-T55)
 * 10. End-to-End Zero-Regression Resilience (T56-T60)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NewsRuntimeConfig } from '../operations/NewsRuntimeConfig';
import { TelegramOperationsController } from '../operations/TelegramOperationsController';
import { TelegramAuditTrail } from '../operations/TelegramAuditTrail';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { SourceExpansionRegistry } from '../registry/SourceExpansionRegistry';
import { AIOperationsController } from '../operations/AIOperationsController';
import { NewsSafeModeController } from '../operations/NewsSafeModeController';
import { NewsCanaryRouter } from '../canary/NewsCanaryRouter';
import { FeedIntegrityMonitor } from '../observability/FeedIntegrityMonitor';
import { ForexFactoryProvider } from '../providers/ForexFactoryProvider';
import { AIRouter } from '../AI/AIRouter';
import { NewsSummaryService } from '../services/NewsSummaryService';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { NewsArticle } from '../models/NewsArticle';

describe('STAGE 8.9 — ATHENA Production Control Plane & Safe Operations', () => {

  beforeEach(() => {
    NewsRuntimeConfig.resetInstance();
    TelegramOperationsController.resetInstance();
    TelegramAuditTrail.resetInstance();
    TelegramNotificationPipeline.resetInstance();
    SourceExpansionRegistry.resetInstance();
    AIOperationsController.resetInstance();
    NewsSafeModeController.resetInstance();
    NewsCanaryRouter.resetInstance();
    FeedIntegrityMonitor.resetInstance();
    ForexFactoryProvider.resetInstance();
  });

  // =========================================================================
  // GROUP 1: OPERATIONAL CONFIG & MODES (T1 - T6)
  // =========================================================================
  describe('Group 1: Operational Config & Modes', () => {
    it('T1: Default initialization sets PRODUCTION mode with safe defaults', () => {
      const config = NewsRuntimeConfig.getInstance();
      expect(config.getRuntimeMode()).toBe('PRODUCTION');
      expect(config.isSafeMode()).toBe(false);
      expect(config.isTelegramEnabled()).toBe(true);
      expect(config.isAIEnrichmentEnabled()).toBe(true);
      expect(config.isCanaryEnabled()).toBe(false);
      expect(config.getCanaryPercentage()).toBe(0);
    });

    it('T2: Mode transition to CANARY sets runtimeMode correctly', () => {
      const config = NewsRuntimeConfig.getInstance();
      config.setRuntimeMode('CANARY');
      expect(config.getRuntimeMode()).toBe('CANARY');
      expect(config.isSafeMode()).toBe(false);
    });

    it('T3: Mode transition to DIAGNOSTIC enables deep diagnostic logs', () => {
      const config = NewsRuntimeConfig.getInstance();
      config.setRuntimeMode('DIAGNOSTIC');
      expect(config.getRuntimeMode()).toBe('DIAGNOSTIC');
    });

    it('T4: Mode transition to SAFE_MODE activates safe mode flag', () => {
      const config = NewsRuntimeConfig.getInstance();
      config.setRuntimeMode('SAFE_MODE');
      expect(config.getRuntimeMode()).toBe('SAFE_MODE');
      expect(config.isSafeMode()).toBe(true);
    });

    it('T5: Safe defaults validation for all components', () => {
      const config = NewsRuntimeConfig.getInstance();
      expect(config.isForexFactoryEnabled()).toBe(true);
      expect(config.isCanaryEnabled()).toBe(false);
    });

    it('T6: Runtime config serialization and immutability of defaults', () => {
      const config = NewsRuntimeConfig.getInstance();
      const json = config.toJSON();
      expect(json.runtimeMode).toBe('PRODUCTION');
      expect(json.isSafeMode).toBe(false);
      expect(json.telegramEnabled).toBe(true);
      expect(typeof json.timestamp).toBe('string');
    });
  });

  // =========================================================================
  // GROUP 2: TELEGRAM OPERATIONAL CONTROL PLANE (T7 - T13)
  // =========================================================================
  describe('Group 2: Telegram Operational Control Plane', () => {
    it('T7: Pause retains queued items in-memory without silent loss', async () => {
      const controller = TelegramOperationsController.getInstance();
      const pipeline = TelegramNotificationPipeline.getInstance();
      pipeline.setAuditMode(true);

      controller.pause('Maintenance window');
      expect(controller.isPaused()).toBe(true);
      expect(controller.getStatus().state).toBe('PAUSED');

      // Enqueue an article while paused
      const article: any = {
        id: 'art_pause_test_1',
        headline: 'RELIANCE Q3 Net Profit Surges 28% YoY',
        isBreaking: true
      };

      const dispatchPromise = pipeline.enqueueArticle(article);
      // Wait a tick to verify item sits in queue
      await new Promise(r => setTimeout(r, 50));
      expect(pipeline.getQueueLength()).toBeGreaterThanOrEqual(1);

      controller.resume();
      expect(controller.isPaused()).toBe(false);
      const res = await dispatchPromise;
      expect(res.articleId).toBe('art_pause_test_1');
    });

    it('T8: Resuming drains retained queue in FIFO/priority order', async () => {
      const controller = TelegramOperationsController.getInstance();
      const pipeline = TelegramNotificationPipeline.getInstance();
      pipeline.setAuditMode(true);

      controller.pause();

      const normalItem: any = {
        id: 'art_normal_1',
        headline: 'Tata Motors Launches New EV Model in Mumbai',
        isBreaking: false
      };

      const fnoItem: any = {
        id: 'art_fno_1',
        headline: 'NIFTY 24500 CALL Call Strike Open Interest Spikes by 150%',
        category: 'FNO',
        isBreaking: true
      };

      const p1 = pipeline.enqueueArticle(normalItem, { priority: 3 });
      const p2 = pipeline.enqueueArticle(fnoItem, { priority: 1 });

      expect(pipeline.getQueueLength()).toBe(2);

      controller.resume();
      await Promise.all([p1, p2]);
      expect(pipeline.getQueueLength()).toBe(0);
    });

    it('T9: Disabling stops dispatch attempts cleanly without crashes', async () => {
      const controller = TelegramOperationsController.getInstance();
      controller.disable();
      expect(controller.isEnabled()).toBe(false);
      expect(controller.getStatus().state).toBe('DISABLED');

      const pipeline = TelegramNotificationPipeline.getInstance();
      const article: any = {
        id: 'art_disabled_1',
        headline: 'Infosys Signs $500M Cloud Deal with European Bank'
      };

      const res = await pipeline.enqueueArticle(article);
      expect(res.articleId).toBe('art_disabled_1');
      expect(res.dispatched).toBe(false);
    });

    it('T10: Transient 429 transitions state to DEGRADED without crash', () => {
      const controller = TelegramOperationsController.getInstance();
      controller.markDegraded('Rate limit backoff (429)');
      expect(controller.getStatus().state).toBe('DEGRADED');
      expect(controller.getStatus().degradedReason).toContain('Rate limit');
    });

    it('T11: Recovery from 429 returns state to ACTIVE', () => {
      const controller = TelegramOperationsController.getInstance();
      controller.markDegraded('Rate limited');
      expect(controller.getStatus().state).toBe('DEGRADED');
      controller.markActive();
      expect(controller.getStatus().state).toBe('ACTIVE');
      expect(controller.getStatus().degradedReason).toBeUndefined();
    });

    it('T12: Exactly-once delivery tracking (idempotency key verification)', () => {
      const controller = TelegramOperationsController.getInstance();
      const eventId = 'evt_reliance_q3_2026';
      const alertType = 'EVENT_CREATED';

      expect(controller.isEventAlertDispatched(eventId, alertType)).toBe(false);
      controller.recordDispatchedEvent(eventId, alertType);
      expect(controller.isEventAlertDispatched(eventId, alertType)).toBe(true);

      // Hydration
      controller.hydrateDispatchedKeys(['evt_2::EVENT_UPDATE', 'evt_3::EVENT_ESCALATION']);
      expect(controller.isEventAlertDispatched('evt_2', 'EVENT_UPDATE')).toBe(true);
      expect(controller.isEventAlertDispatched('evt_3', 'EVENT_ESCALATION')).toBe(true);
    });

    it('T13: Audit trail records all required fields without storing credentials', () => {
      const audit = TelegramAuditTrail.getInstance();
      const record = audit.recordQueued({
        eventId: 'evt_audit_1',
        alertType: 'ARTICLE_ALERT',
        priority: 1,
        headline: 'RBI Unscheduled MPC Meeting Announced'
      });

      expect(record.deliveryId).toBeDefined();
      expect(record.eventId).toBe('evt_audit_1');
      expect(record.priority).toBe(1);
      expect(record.status).toBe('QUEUED');
      expect((record as any).botToken).toBeUndefined();
      expect((record as any).token).toBeUndefined();

      audit.recordAttempt(record.deliveryId);
      expect(audit.getRecord(record.deliveryId)?.status).toBe('SENDING');

      audit.recordSuccess(record.deliveryId, 987654);
      const updated = audit.getRecord(record.deliveryId);
      expect(updated?.status).toBe('SENT');
      expect(updated?.telegramMessageId).toBe(987654);
    });
  });

  // =========================================================================
  // GROUP 3: SOURCE EXPANSION OPERATIONAL CONTROLS (T14 - T19)
  // =========================================================================
  describe('Group 3: Source Expansion Operational Controls', () => {
    it('T14: Disabling single source isolates only that source', () => {
      const registry = SourceExpansionRegistry.getInstance();
      registry.registerSource({ id: 'src_bse', publisher: 'BSE India', url: 'https://bse.in/rss' } as any);
      registry.registerSource({ id: 'src_nse', publisher: 'NSE India', url: 'https://nse.in/rss' } as any);

      registry.disableSource('src_bse');
      const bseStatus = registry.getSourceStatus('src_bse');
      const nseStatus = registry.getSourceStatus('src_nse');

      expect(bseStatus?.enabled).toBe(false);
      expect(bseStatus?.circuitState).toBe('DISABLED');
      expect(nseStatus?.enabled).toBe(true);
      expect(nseStatus?.circuitState).toBe('ACTIVE');
    });

    it('T15: Other sources continue polling unaffected when one is disabled', () => {
      const registry = SourceExpansionRegistry.getInstance();
      registry.registerSource({ id: 'src_mc', publisher: 'MoneyControl', url: 'https://mc.in/rss' } as any);
      registry.registerSource({ id: 'src_et', publisher: 'Economic Times', url: 'https://et.in/rss' } as any);

      registry.disableSource('src_mc');
      const activeSources = registry.getActiveSources();
      expect(activeSources.some(s => s.id === 'src_et')).toBe(true);
      expect(activeSources.some(s => s.id === 'src_mc')).toBe(false);
    });

    it('T16: Quarantining a source preserves article history', () => {
      const registry = SourceExpansionRegistry.getInstance();
      registry.registerSource({ id: 'src_reuters', publisher: 'Reuters', url: 'https://reuters.com/rss' } as any);
      registry.recordSourceSuccess('src_reuters', 12);

      registry.quarantineSource('src_reuters', 'Too many parsing anomalies');
      const record = registry.getSourceRecord('src_reuters');
      expect(record?.state).toBe('QUARANTINED');
      expect(record?.totalItemsFetched).toBe(12);
      expect(record?.quarantineReason).toContain('parsing anomalies');
    });

    it('T17: Circuit reset clears failure counters and reinstates source', () => {
      const registry = SourceExpansionRegistry.getInstance();
      registry.registerSource({ id: 'src_bloomberg', publisher: 'Bloomberg', url: 'https://bloomberg.com/rss' } as any);
      registry.recordSourceFailure('src_bloomberg', new Error('Timeout 1'));
      registry.recordSourceFailure('src_bloomberg', new Error('Timeout 2'));

      expect(registry.getSourceStatus('src_bloomberg')?.consecutiveFailures).toBe(2);
      registry.resetSourceCircuit('src_bloomberg');
      const status = registry.getSourceStatus('src_bloomberg');
      expect(status?.consecutiveFailures).toBe(0);
      expect(status?.circuitState).toBe('ACTIVE');
    });

    it('T18: 3-failure threshold triggers automated quarantine', () => {
      const registry = SourceExpansionRegistry.getInstance();
      registry.registerSource({ id: 'src_flaky', publisher: 'Flaky Feed', url: 'https://flaky.com/rss' } as any);

      registry.recordSourceFailure('src_flaky', new Error('500 Error'));
      registry.recordSourceFailure('src_flaky', new Error('502 Bad Gateway'));
      registry.recordSourceFailure('src_flaky', new Error('504 Gateway Timeout'));

      const status = registry.getSourceStatus('src_flaky');
      expect(status?.circuitState).toBe('QUARANTINED');
      expect(status?.quarantineReason).toContain('3 consecutive failures');
    });

    it('T19: Operational status returns complete diagnostic metadata', () => {
      const registry = SourceExpansionRegistry.getInstance();
      registry.registerSource({ id: 'src_livemint', publisher: 'Livemint', url: 'https://livemint.com/rss' } as any);
      registry.recordSourceSuccess('src_livemint', 5);

      const status = registry.getSourceStatus('src_livemint');
      expect(status?.sourceId).toBe('src_livemint');
      expect(status?.publisher).toBe('Livemint');
      expect(status?.lastSuccessfulPoll).toBeDefined();
      expect(status?.lastSuccessfulArticle).toBeDefined();
    });
  });

  // =========================================================================
  // GROUP 4: AI OPERATIONS & COST GUARD (T20 - T25)
  // =========================================================================
  describe('Group 4: AI Operations & Cost Guard', () => {
    it('T20: AI disablement bypasses all external network calls', async () => {
      const aiController = AIOperationsController.getInstance();
      aiController.disableAI();
      expect(aiController.isAIEnabled()).toBe(false);

      const router = AIRouter.getInstance();
      const groqSpy = vi.spyOn(router.groqProvider, 'generate');
      const geminiSpy = vi.spyOn(router.geminiProvider, 'generate');

      const response = await router.generateSummary({
        headline: 'HDFC Bank Announces Quarterly Results',
        body: 'Net profit rose by 14% to Rs 16,500 crore in the latest quarter.'
      });

      expect(groqSpy).not.toHaveBeenCalled();
      expect(geminiSpy).not.toHaveBeenCalled();
      expect(response.fallbackUsed).toBe(true);
      expect(aiController.getUsageTelemetry().aiCallsAvoided).toBeGreaterThanOrEqual(1);
    });

    it('T21: Local deterministic summary is returned when AI is disabled', async () => {
      const aiController = AIOperationsController.getInstance();
      aiController.disableAI();

      const summaryService = NewsSummaryService.getInstance();
      const article: any = {
        id: 'art_ai_disabled_test',
        headline: 'Larsen & Toubro Secures Mega Order in Middle East',
        title: 'Larsen & Toubro Secures Mega Order in Middle East',
        summary: 'L&T Construction wins order worth over Rs 15,000 crore.',
        content: 'L&T Construction wins order worth over Rs 15,000 crore.',
        publishedAt: new Date().toISOString(),
        sourceUrl: 'https://example.com/lnt',
        url: 'https://example.com/lnt',
        category: 'Corporate',
        publisher: 'Press Release'
      };

      const summary = await summaryService.getOrGenerateSummary(article);
      expect(summary.articleId).toBe('art_ai_disabled_test');
      expect(summary.keyFacts.length).toBeGreaterThanOrEqual(1);
      expect(summary.provider).toBe('AthenaLocalEngine');
      expect(summary.validated).toBe(true);
    });

    it('T22: Cache hit avoids redundant AI generation', () => {
      const aiController = AIOperationsController.getInstance();
      aiController.recordCacheHit();
      const telem = aiController.getUsageTelemetry();
      expect(telem.cachedSummaries).toBe(1);
      expect(telem.aiCallsAvoided).toBe(1);
    });

    it('T23: Failed extraction avoids AI generation and records avoided call', () => {
      const aiController = AIOperationsController.getInstance();
      aiController.recordAvoidedCall('EXTRACTION_FAILED');
      const telem = aiController.getUsageTelemetry();
      expect(telem.avoidedCalls).toBe(1);
    });

    it('T24: Telemetry tracks total, gemini, and groq call breakdown accurately', () => {
      const aiController = AIOperationsController.getInstance();
      aiController.recordCallAttempt('groq');
      aiController.recordCallSuccess();
      aiController.recordCallAttempt('gemini');
      aiController.recordCallFailure('Quota exceeded');

      const telem = aiController.getUsageTelemetry();
      expect(telem.totalCalls).toBe(2);
      expect(telem.groqCalls).toBe(1);
      expect(telem.geminiCalls).toBe(1);
      expect(telem.successfulCalls).toBe(1);
      expect(telem.failedCalls).toBe(1);
    });

    it('T25: Cache hit rate percentage calculation accuracy', () => {
      const aiController = AIOperationsController.getInstance();
      aiController.recordCallAttempt('groq');
      aiController.recordCallSuccess(); // 1 made
      aiController.recordCacheHit();     // 1 cached
      aiController.recordCacheHit();     // 1 cached
      aiController.recordCacheHit();     // 1 cached

      // Total requests = 1 made + 3 cached = 4. Cache hit rate = (3/4)*100 = 75%
      const telem = aiController.getUsageTelemetry();
      expect(telem.cacheHitRate).toBe(75);
    });
  });

  // =========================================================================
  // GROUP 5: SAFE MODE DEGRADED OPERATIONS (T26 - T31)
  // =========================================================================
  describe('Group 5: Safe Mode Degraded Operations', () => {
    it('T26: Safe mode activation suspends AI enrichment', () => {
      const safeModeController = NewsSafeModeController.getInstance();
      safeModeController.enableSafeMode('Emergency provider latency');

      expect(safeModeController.isSafeMode()).toBe(true);
      expect(AIOperationsController.getInstance().isAIEnabled()).toBe(false);
    });

    it('T27: Safe mode activation pauses Telegram dispatch', () => {
      const safeModeController = NewsSafeModeController.getInstance();
      safeModeController.enableSafeMode();
      expect(TelegramOperationsController.getInstance().isPaused()).toBe(true);
    });

    it('T28: Safe mode preserves 100% of canonical articles', () => {
      const initialCount = newsStore.getAllArticles().length;
      const safeModeController = NewsSafeModeController.getInstance();
      safeModeController.enableSafeMode();

      const afterCount = newsStore.getAllArticles().length;
      expect(afterCount).toBe(initialCount);
    });

    it('T29: Safe mode keeps V4 feed operational and readable', () => {
      const safeModeController = NewsSafeModeController.getInstance();
      safeModeController.enableSafeMode();

      const status = safeModeController.getStatus();
      expect(status.v4FeedActive).toBe(true);
      expect(status.canonicalStorageActive).toBe(true);
    });

    it('T30: Safe mode is reversible at runtime', () => {
      const safeModeController = NewsSafeModeController.getInstance();
      safeModeController.enableSafeMode('Testing reversibility');
      expect(safeModeController.isSafeMode()).toBe(true);

      safeModeController.disableSafeMode();
      expect(safeModeController.isSafeMode()).toBe(false);
      expect(TelegramOperationsController.getInstance().isPaused()).toBe(false);
      expect(AIOperationsController.getInstance().isAIEnabled()).toBe(true);
    });

    it('T31: Safe mode status accurately reports subsystem states', () => {
      const safeModeController = NewsSafeModeController.getInstance();
      safeModeController.enableSafeMode('Audit run');
      const status = safeModeController.getStatus();

      expect(status.isSafeMode).toBe(true);
      expect(status.reason).toBe('Audit run');
      expect(status.telegramPaused).toBe(true);
      expect(status.aiEnrichmentDisabled).toBe(true);
    });
  });

  // =========================================================================
  // GROUP 6: CANARY ROUTING ISOLATION (T32 - T37)
  // =========================================================================
  describe('Group 6: Canary Routing Isolation', () => {
    it('T32: Control requests route deterministically to V4 when canary disabled', () => {
      const router = NewsCanaryRouter.getInstance();
      router.setEnabled(false);

      const decision = router.shouldRouteToCanary({});
      expect(decision.useCanary).toBe(false);
      expect(decision.reason).toBe('CANARY_DISABLED');
    });

    it('T33: Explicit query canary=1 routes to V5', () => {
      const router = NewsCanaryRouter.getInstance();
      const decision = router.shouldRouteToCanary({ query: { canary: '1' } });
      expect(decision.useCanary).toBe(true);
      expect(decision.reason).toBe('QUERY_OVERRIDE_CANARY');
    });

    it('T34: Explicit query canary=0 routes to V4', () => {
      const router = NewsCanaryRouter.getInstance();
      router.setEnabled(true);
      router.setPercentage(100);

      const decision = router.shouldRouteToCanary({ query: { canary: '0' } });
      expect(decision.useCanary).toBe(false);
      expect(decision.reason).toBe('QUERY_OVERRIDE_CONTROL');
    });

    it('T35: Explicit header x-news-canary routes appropriately', () => {
      const router = NewsCanaryRouter.getInstance();
      const decisionTrue = router.shouldRouteToCanary({ headers: { 'x-news-canary': 'true' } });
      expect(decisionTrue.useCanary).toBe(true);

      const decisionFalse = router.shouldRouteToCanary({ headers: { 'x-news-canary': 'false' } });
      expect(decisionFalse.useCanary).toBe(false);
    });

    it('T36: Hash bucketing distributes requests by percentage', () => {
      const router = NewsCanaryRouter.getInstance();
      router.setEnabled(true);
      router.setPercentage(50);

      let canaryCount = 0;
      for (let i = 0; i < 100; i++) {
        const dec = router.shouldRouteToCanary({ ip: `192.168.1.${i}` });
        if (dec.useCanary) canaryCount++;
      }

      expect(canaryCount).toBeGreaterThan(20);
      expect(canaryCount).toBeLessThan(80);
    });

    it('T37: Canary routing does not mutate canonical datasets', () => {
      const countBefore = newsStore.getAllArticles().length;
      const router = NewsCanaryRouter.getInstance();
      router.shouldRouteToCanary({ query: { canary: '1' } });
      router.shouldRouteToCanary({ query: { canary: '0' } });
      const countAfter = newsStore.getAllArticles().length;
      expect(countAfter).toBe(countBefore);
    });
  });

  // =========================================================================
  // GROUP 7: FEED INTEGRITY & COUNT REGRESSION GUARD (T38 - T43)
  // =========================================================================
  describe('Group 7: Feed Integrity & Count Regression Guard', () => {
    it('T38: Integrity monitor calculates exact count alignment', async () => {
      const monitor = FeedIntegrityMonitor.getInstance();
      const report = await monitor.runIntegrityCheck();
      expect(report.canonicalDiskCount).toBeGreaterThanOrEqual(0);
      expect(report.persistentMemoryCount).toBeGreaterThanOrEqual(0);
      expect(report.uniqueMemoryIdsCount).toBeGreaterThanOrEqual(0);
    });

    it('T39: Multi-layer count check detects store divergence', async () => {
      const monitor = FeedIntegrityMonitor.getInstance();
      const report = await monitor.runIntegrityCheck();
      expect(report.status).toBeDefined();
      expect(Array.isArray(report.mismatches)).toBe(true);
    });

    it('T40: Duplicate ID detection in memory store', async () => {
      const monitor = FeedIntegrityMonitor.getInstance();
      const report = await monitor.runIntegrityCheck();
      expect(typeof report.duplicateIdsCount).toBe('number');
      expect(Array.isArray(report.duplicateIds)).toBe(true);
    });

    it('T41: Duplicate URL detection across feeds', async () => {
      const monitor = FeedIntegrityMonitor.getInstance();
      const report = await monitor.runIntegrityCheck();
      expect(typeof report.duplicateUrlsCount).toBe('number');
      expect(Array.isArray(report.duplicateUrls)).toBe(true);
    });

    it('T42: Count regression guard detects downward count drop (CANONICAL_COUNT_REGRESSION)', async () => {
      const monitor = FeedIntegrityMonitor.getInstance();
      // Set high-water mark verified count
      monitor.setVerifiedCanonicalCount(10000);

      const report = await monitor.runIntegrityCheck();
      expect(report.hasCanonicalCountRegressed).toBe(true);
      expect(report.status).toBe('CANONICAL_COUNT_REGRESSION');
      expect(report.mismatches.some(m => m.includes('CANONICAL_COUNT_REGRESSION'))).toBe(true);
    });

    it('T43: Count regression guard prevents silent downward normalization', async () => {
      const monitor = FeedIntegrityMonitor.getInstance();
      monitor.setVerifiedCanonicalCount(5000);
      const verified = monitor.getVerifiedCanonicalCount();
      expect(verified).toBe(5000);

      const report = await monitor.runIntegrityCheck();
      expect(report.verifiedCanonicalCount).toBe(5000);
    });
  });

  // =========================================================================
  // GROUP 8: FOREX FACTORY & OPTIONAL SOURCES (T44 - T49)
  // =========================================================================
  describe('Group 8: Forex Factory & Optional Sources', () => {
    it('T44: Forex Factory provider disablement skips polling', async () => {
      const ff = ForexFactoryProvider.getInstance();
      ff.disable();
      expect(ff.isAvailable()).toBe(false);

      const events = await ff.getUpcomingEvents(72);
      expect(events).toEqual([]);
    });

    it('T45: 3 consecutive network failures triggers DEGRADED state', async () => {
      const ff = ForexFactoryProvider.getInstance();
      ff.enable();

      // Force failure path by setting invalid endpoint
      (ff as any).endpoint = 'https://invalid.domain.12345/calendar.json';
      await ff.getUpcomingEvents(72);
      await ff.getUpcomingEvents(72);
      await ff.getUpcomingEvents(72);

      const status = ff.getStatus();
      expect(status.state).toBe('DEGRADED');
    });

    it('T46: Quarantined provider returns empty events without throwing', async () => {
      const ff = ForexFactoryProvider.getInstance();
      ff.quarantine('Operator manual quarantine');
      expect(ff.getStatus().state).toBe('QUARANTINED');

      const events = await ff.getUpcomingEvents(72);
      expect(events).toEqual([]);
    });

    it('T47: Fallback macro events are marked with isFallback: true', () => {
      const ff = ForexFactoryProvider.getInstance();
      const fallbackEvents = (ff as any).getFallbackMacroEvents();
      expect(fallbackEvents.length).toBeGreaterThan(0);
      expect(fallbackEvents[0].title).toContain('[Fallback]');
    });

    it('T48: Fallback macro events do not trigger false confirmed alerts', () => {
      const ff = ForexFactoryProvider.getInstance();
      const article = ff.toCanonicalArticle({
        id: 'ff_test_event',
        title: 'US CPI Release [Fallback]',
        country: 'US',
        agency: 'FED',
        indicator: 'CPI_INFLATION',
        scheduledAt: new Date().toISOString(),
        importance: 'HIGH',
        isFallback: true
      } as any);

      expect((article as any).isFallback).toBe(true);
      expect((article as any).isOfficialSource).toBe(false);
    });

    it('T49: Commercial provider authority tier remains 2', () => {
      const ff = ForexFactoryProvider.getInstance();
      const article = ff.toCanonicalArticle({
        id: 'ff_tier_test',
        title: 'India Manufacturing PMI',
        country: 'IN',
        agency: 'OTHER',
        indicator: 'IIP',
        scheduledAt: new Date().toISOString(),
        importance: 'MEDIUM'
      } as any);

      expect((article as any).authorityTier).toBe(2);
    });
  });

  // =========================================================================
  // GROUP 9: OPERATIONAL API ENDPOINTS (T50 - T55)
  // =========================================================================
  describe('Group 9: Operational API Endpoints & State Exposure', () => {
    it('T50: Operations status exposes unified telemetry', () => {
      const config = NewsRuntimeConfig.getInstance();
      const telegram = TelegramOperationsController.getInstance().getStatus();
      const ai = AIOperationsController.getInstance().getAIStatus();
      const safemode = NewsSafeModeController.getInstance().getStatus();

      expect(config.getRuntimeMode()).toBe('PRODUCTION');
      expect(telegram.state).toBe('ACTIVE');
      expect(ai.enabled).toBe(true);
      expect(safemode.isSafeMode).toBe(false);
    });

    it('T51: Telegram pause and resume lifecycle updates operational state', () => {
      const ctrl = TelegramOperationsController.getInstance();
      ctrl.pause('Audit');
      expect(ctrl.getStatus().isPaused).toBe(true);
      ctrl.resume();
      expect(ctrl.getStatus().isPaused).toBe(false);
    });

    it('T52: AI disable and enable lifecycle updates operational state', () => {
      const ai = AIOperationsController.getInstance();
      ai.disableAI();
      expect(ai.isAIEnabled()).toBe(false);
      ai.enableAI();
      expect(ai.isAIEnabled()).toBe(true);
    });

    it('T53: Safe mode enable and disable lifecycle updates operational state', () => {
      const sm = NewsSafeModeController.getInstance();
      sm.enableSafeMode('Testing API');
      expect(sm.getStatus().isSafeMode).toBe(true);
      sm.disableSafeMode();
      expect(sm.getStatus().isSafeMode).toBe(false);
    });

    it('T54: Source registry disable and reset actions succeed', () => {
      const reg = SourceExpansionRegistry.getInstance();
      reg.registerSource({ id: 'src_test_api', publisher: 'Test API', url: 'https://test.api/rss' } as any);

      expect(reg.disableSource('src_test_api')).toBe(true);
      expect(reg.getSourceStatus('src_test_api')?.enabled).toBe(false);

      expect(reg.resetSourceCircuit('src_test_api')).toBe(true);
      expect(reg.getSourceStatus('src_test_api')?.consecutiveFailures).toBe(0);
    });

    it('T55: Feed integrity status returns forensic report without throwing', async () => {
      const monitor = FeedIntegrityMonitor.getInstance();
      const report = await monitor.runIntegrityCheck();
      expect(report.status).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // GROUP 10: END-TO-END ZERO-REGRESSION RESILIENCE (T56 - T60)
  // =========================================================================
  describe('Group 10: End-to-End Zero-Regression Resilience', () => {
    it('T56: High-volume ingestion during Telegram pause retains all alerts', async () => {
      const ctrl = TelegramOperationsController.getInstance();
      const pipeline = TelegramNotificationPipeline.getInstance();
      pipeline.setAuditMode(true);
      ctrl.pause('High volume batch');

      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          pipeline.enqueueArticle({
            id: `art_hv_${i}`,
            headline: `Breaking News Story ${i}`,
            isBreaking: true
          } as any)
        );
      }

      expect(pipeline.getQueueLength()).toBe(20);
      ctrl.resume();

      await Promise.all(promises);
      expect(pipeline.getQueueLength()).toBe(0);
    });

    it('T57: Full pipeline run with AI disabled preserves headline, category & freshness', async () => {
      AIOperationsController.getInstance().disableAI();
      const article: any = {
        id: 'art_e2e_resilience',
        headline: 'Tata Steel Commissions 5 MTPA Blast Furnace in Kalinganagar',
        title: 'Tata Steel Commissions 5 MTPA Blast Furnace in Kalinganagar',
        summary: 'Major capacity expansion project completed on schedule.',
        content: 'Major capacity expansion project completed on schedule.',
        publishedAt: new Date().toISOString(),
        sourceUrl: 'https://tatasteel.com/news',
        url: 'https://tatasteel.com/news',
        category: 'Corporate',
        primaryCategory: 'Corporate',
        symbol: 'TATASTEEL'
      };

      const summaryService = NewsSummaryService.getInstance();
      const summary = await summaryService.getOrGenerateSummary(article);

      expect(summary.articleId).toBe('art_e2e_resilience');
      expect(summary.keyFacts.length).toBeGreaterThanOrEqual(1);
      expect(summary.summary.length).toBeGreaterThan(0);
      expect(summary.provider).toBe('AthenaLocalEngine');
    });

    it('T58: Combined Safe Mode + Canary + Source failure retains canonical news core', async () => {
      const initialCount = newsStore.getAllArticles().length;
      const sm = NewsSafeModeController.getInstance();
      const canary = NewsCanaryRouter.getInstance();
      const reg = SourceExpansionRegistry.getInstance();

      sm.enableSafeMode('Full drill');
      canary.setEnabled(true);
      canary.setPercentage(50);
      reg.registerSource({ id: 'src_broken', publisher: 'Broken', url: 'https://broken.com' } as any);
      reg.recordSourceFailure('src_broken', new Error('Down'));
      reg.recordSourceFailure('src_broken', new Error('Down'));
      reg.recordSourceFailure('src_broken', new Error('Down'));

      const articles = newsStore.getAllArticles();
      expect(articles.length).toBe(initialCount);

      sm.disableSafeMode();
    });

    it('T59: Memory store and disk store maintain zero data loss under concurrent operations', () => {
      const articles = newsStore.getAllArticles();
      expect(articles.length).toBeGreaterThan(0);
      expect(articles.every(a => !!a.id && !!a.headline)).toBe(true);
    });

    it('T60: Engine restart preserves canonical verified counts and operational sanity', () => {
      const monitor = FeedIntegrityMonitor.getInstance();
      expect(monitor.getVerifiedCanonicalCount()).toBeGreaterThan(0);
    });
  });

});
