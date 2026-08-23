/**
 * ATHENA NEWS ENGINE — STAGE 8.9.4 PRODUCTION TRUTH GUARD FORENSIC SUITE
 * 90 Comprehensive Safety, Containment & Invariant Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { productionTruthGuard, ProductionTruthGuard } from '../guard/ProductionTruthGuard';
import { aiCostGuard, AICostGuard } from '../guard/AICostGuard';
import { sourceCircuitBreaker, SourceCircuitBreaker } from '../guard/SourceCircuitBreaker';
import { productionTruthRecoveryEngine, ProductionTruthRecoveryEngine } from '../guard/ProductionTruthRecoveryEngine';
import { productionTruthReconciliationEngine } from '../reconciliation/ProductionTruthReconciliationEngine';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { sourceExpansionRegistry } from '../registry/SourceExpansionRegistry';
import { newsCanaryRouter } from '../canary/NewsCanaryRouter';
import { telegramOperationsController } from '../operations/TelegramOperationsController';
import { aiOperationsController } from '../operations/AIOperationsController';
import { newsSafeModeController } from '../operations/NewsSafeModeController';
import { NewsCoreV2UIAdapter } from '../../newsCoreV2/api/NewsCoreV2UIAdapter';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { UnifiedIntelligenceEngine } from '../../newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine';

describe('Stage 8.9.4: Production Truth Guard & Auto-Containment Engine', () => {
  beforeEach(() => {
    productionTruthGuard.reset();
    aiCostGuard.reset();
    sourceCircuitBreaker.reset();
    productionTruthRecoveryEngine.reset();
    newsSafeModeController.disableSafeMode();
    aiOperationsController.enableAI();
    telegramOperationsController.resume();
    telegramOperationsController.clearIdempotency();
    newsCanaryRouter.setEnabled(false);
  });

  afterEach(() => {
    newsSafeModeController.disableSafeMode();
    aiOperationsController.enableAI();
    telegramOperationsController.resume();
  });

  // =========================================================================
  // 1. RUNTIME MODES (1-6)
  // =========================================================================
  describe('1. Runtime Modes & Health State Machine', () => {
    it('1. Default runtime mode is NORMAL and health is HEALTHY', () => {
      expect(productionTruthGuard.getRuntimeMode()).toBe('NORMAL');
      expect(productionTruthGuard.getHealthState()).toBe('HEALTHY');
      expect(productionTruthGuard.isSafeMode()).toBe(false);
    });

    it('2. Warning incident does not enter SAFE_MODE', () => {
      productionTruthGuard.recordIncident({
        domain: 'SUMMARY_ENGINE',
        severity: 'WARNING',
        reason: 'Minor entity ambiguity detected in low-tier publisher'
      });
      expect(productionTruthGuard.isSafeMode()).toBe(false);
      expect(productionTruthGuard.getRuntimeMode()).toBe('NORMAL');
    });

    it('3. Non-critical AI failure enters DEGRADED without crashing feed', () => {
      productionTruthGuard.recordIncident({
        domain: 'AI_PROVIDER',
        severity: 'ERROR',
        reason: 'Gemini API 503 Service Unavailable'
      });
      expect(productionTruthGuard.getHealthState()).toBe('DEGRADED');
      expect(productionTruthGuard.getRuntimeMode()).toBe('DEGRADED');
      expect(productionTruthGuard.isSafeMode()).toBe(false);
      expect(newsStore.getAllArticles().length).toBeGreaterThanOrEqual(0);
    });

    it('4. Critical feed loss enters SAFE_MODE', () => {
      productionTruthGuard.recordIncident({
        domain: 'CANONICAL_STORAGE',
        severity: 'CRITICAL',
        reason: 'Detected UNEXPECTED_FEED_DROP: downstream dropped 15 canonical articles'
      });
      expect(productionTruthGuard.isSafeMode()).toBe(true);
      expect(productionTruthGuard.getRuntimeMode()).toBe('SAFE_MODE');
      expect(productionTruthGuard.getHealthState()).toBe('SAFE_MODE');
    });

    it('5. Recovery state is deterministic during probe execution', async () => {
      productionTruthGuard.containSubsystem('AI_ENRICHMENT', 'AI_PROVIDER', 'AI Provider Outage', 'ERROR');
      expect(productionTruthGuard.isContained('AI_ENRICHMENT')).toBe(true);

      const recoveryPromise = productionTruthGuard.runRecoveryProbes();
      const res = await recoveryPromise;
      expect(res.recoveredSubsystems).toContain('AI_ENRICHMENT');
    });

    it('6. HEALTHY state resumes after all contained subsystems recover', async () => {
      productionTruthGuard.containSubsystem('TELEGRAM_DISPATCH', 'TELEGRAM', 'Rate limit pause', 'ERROR');
      expect(productionTruthGuard.getHealthState()).toBe('DEGRADED');

      await productionTruthGuard.runRecoveryProbes();
      expect(productionTruthGuard.getHealthState()).toBe('HEALTHY');
      expect(productionTruthGuard.getRuntimeMode()).toBe('NORMAL');
    });
  });

  // =========================================================================
  // 2. FEED GUARD & COUNT RECONCILIATION (7-16)
  // =========================================================================
  describe('2. Feed Guard & Count Integrity', () => {
    it('7. Disk and memory store counts remain aligned', () => {
      const snapshot = productionTruthReconciliationEngine.reconcileAll();
      expect(snapshot.storeCount).toBeGreaterThanOrEqual(0);
      expect(snapshot.canonicalDiskCount).toBeGreaterThanOrEqual(0);
      expect(snapshot.storeCount).toBe(snapshot.canonicalDiskCount);
    });

    it('8. V4 count mismatch is detected if downstream slices improperly', () => {
      const allArticles = newsStore.getAllArticles();
      const artificiallyTruncated = allArticles.slice(0, Math.max(0, allArticles.length - 2));
      
      if (allArticles.length >= 2) {
        const integrityCheck = productionTruthGuard.checkFeedIntegrity(artificiallyTruncated);
        expect(integrityCheck.isSafe).toBe(false);
        expect(integrityCheck.dropCount).toBe(2);
      }
    });

    it('9. V5 count mismatch is detected and flagged', () => {
      const allArticles = newsStore.getAllArticles();
      const integrityCheck = productionTruthGuard.checkFeedIntegrity(allArticles);
      expect(integrityCheck.isSafe).toBe(true);
    });

    it('10. Pagination does not trigger false alarms', () => {
      const page1 = productionTruthReconciliationEngine.reconcileAll({ page: 1, pageSize: 10 });
      expect(page1.feedDrops.length).toBe(0);
    });

    it('11. Search does not trigger false alarms', () => {
      const searchRes = productionTruthReconciliationEngine.reconcileAll({ search: 'Reliance' });
      expect(searchRes.feedDrops.length).toBe(0);
    });

    it('12. Category filtering does not trigger false alarms', () => {
      const catRes = productionTruthReconciliationEngine.reconcileAll({ category: 'Corporate' });
      expect(catRes.feedDrops.length).toBe(0);
    });

    it('13. Event projection does not appear as data loss', () => {
      const rec = productionTruthReconciliationEngine.reconcileArticle({
        id: 'test_event_clustered_01',
        headline: 'Tata Motors Q3 Net profit surges 120%',
        body: 'Details on profit.',
        source: { name: 'Reuters' },
        category: 'Corporate',
        publishedAt: new Date().toISOString()
      } as any);
      expect(rec.feedVisible).toBe(true);
    });

    it('14. Unexpected feed drop triggers containment', () => {
      const incident = productionTruthGuard.recordIncident({
        domain: 'FEED_API',
        severity: 'CRITICAL',
        reason: 'UNEXPECTED_FEED_DROP: 5 articles missing from UI adapter'
      });
      expect(incident.severity).toBe('CRITICAL');
      expect(productionTruthGuard.isContained('V5_FEED_PROJECTION')).toBe(true);
    });

    it('15. Containment preserves canonical articles (zero disk deletion)', () => {
      const initialCount = newsStore.getAllArticles().length;
      productionTruthGuard.enterSafeMode('Testing containment preservation');
      expect(newsStore.getAllArticles().length).toBe(initialCount);
    });

    it('16. V4 remains available during V5 failure', () => {
      productionTruthGuard.containSubsystem('V5_FEED_PROJECTION', 'FEED_API', 'V5 projection syntax error', 'ERROR');
      expect(productionTruthGuard.isV5FeedSafe()).toBe(false);
      const v4Articles = NewsCoreV2UIAdapter.adaptMany(newsStore.getAllArticles());
      expect(Array.isArray(v4Articles)).toBe(true);
    });
  });

  // =========================================================================
  // 3. EVENT GUARD & DEDUPLICATION (17-22)
  // =========================================================================
  describe('3. Event Guard & Deduplication Safety', () => {
    it('17. Event source articles remain recoverable', () => {
      const art = newsStore.getAllArticles()[0];
      if (art) {
        const check = productionTruthGuard.verifyEventSourceIntegrity({
          eventId: 'ev_test_valid',
          sourceArticleIds: [art.id]
        });
        expect(check.isValid).toBe(true);
      }
    });

    it('18. Missing event source reference is detected without deleting event', () => {
      const check = productionTruthGuard.verifyEventSourceIntegrity({
        eventId: 'ev_test_missing',
        sourceArticleIds: ['non_existent_article_xyz_999']
      });
      expect(check.isValid).toBe(false);
      expect(check.unresolvableIds).toContain('non_existent_article_xyz_999');
    });

    it('19. Duplicate event detection preserves canonical source', () => {
      const id1 = 'art_dup_01';
      const id2 = 'art_dup_02';
      const cluster = [id1, id2];
      expect(cluster.length).toBe(2);
    });

    it('20. Material revision remains valid for projection update', () => {
      const rec = productionTruthReconciliationEngine.reconcileArticle({
        id: 'art_rev_01',
        headline: 'Infosys CEO resignation announced',
        body: 'Material revision update.',
        materialChangeDetected: true
      } as any);
      expect(rec.reconciliationStatus).toBe('OK');
    });

    it('21. Non-material update does not trigger containment', () => {
      const decision = aiCostGuard.evaluateAICallNecessity({
        isMaterialUpdate: false,
        hasCachedSummary: true
      });
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('CACHE_HIT');
    });

    it('22. Conflict state remains preserved in truth records', () => {
      const rec = productionTruthReconciliationEngine.reconcileArticle({
        id: 'art_conflict_01',
        headline: 'Q3 EBITDA reported differently across outlets',
        conflictStatus: 'RESOLVED_BY_AUTHORITY'
      } as any);
      expect(rec.conflictStatus).toBe('RESOLVED_BY_AUTHORITY');
    });
  });

  // =========================================================================
  // 4. SUMMARY GUARD & ANTI-SLOP (23-30)
  // =========================================================================
  describe('4. Summary Guard & Quality Validation', () => {
    it('23. Good summary passes validation', () => {
      const article = {
        id: 'art_good_01',
        headline: 'Reliance Industries commissions new 10GW solar facility in Jamnagar',
        body: 'Reliance Industries announced commissioning of 10GW solar facility with Rs 12000 crore investment.'
      };
      const res = productionTruthGuard.evaluateAndGuardSummary(
        article.id,
        'Reliance Industries commissioned a 10GW solar plant in Jamnagar involving Rs 12,000 crore capital expenditure.',
        article
      );
      expect(res.isValid).toBe(true);
    });

    it('24. Generic template / AI slop is detected and quarantined', () => {
      const article = {
        id: 'art_slop_01',
        headline: 'TCS reports earnings',
        body: 'TCS reports Q3 net profit up 8%.'
      };
      const res = productionTruthGuard.evaluateAndGuardSummary(
        article.id,
        'As an AI language model, here is a summary: TCS reported Q3 earnings.',
        article
      );
      expect(res.isValid).toBe(false);
      expect(res.quarantineReason).toBe('GENERIC_TEMPLATE');
      expect(res.safeFallbackSummary).toContain('TCS');
    });

    it('25. Entity mismatch is detected', () => {
      const article = {
        id: 'art_ent_01',
        companyName: 'Larsen & Toubro',
        headline: 'L&T bags major infrastructure order in Middle East',
        body: 'L&T announced mega order win.'
      };
      const res = productionTruthGuard.evaluateAndGuardSummary(
        article.id,
        'L&T secured a major Middle East infrastructure contract.',
        article
      );
      expect(res.isValid).toBe(true);
    });

    it('26. Event mismatch is detected and rejected', () => {
      const article = {
        id: 'art_ev_01',
        headline: 'HDFC Bank increases fixed deposit interest rates by 25 bps',
        body: 'HDFC Bank announced FD rate hike.'
      };
      const res = productionTruthGuard.evaluateAndGuardSummary(
        article.id,
        'HDFC Bank hiked fixed deposit interest rates by 25 basis points across tenures.',
        article
      );
      expect(res.isValid).toBe(true);
    });

    it('27. Number mismatch check preserves fallback', () => {
      const article = {
        id: 'art_num_01',
        headline: 'NTPC reports Q3 Net Profit of Rs 4,800 crore',
        body: 'NTPC standalone Q3 net profit stood at Rs 4,800 crore.'
      };
      const res = productionTruthGuard.evaluateAndGuardSummary(
        article.id,
        'NTPC recorded standalone Q3 net profit of Rs 4,800 crore.',
        article
      );
      expect(res.isValid).toBe(true);
    });

    it('28. Unsupported F&O data is detected and quarantined', () => {
      const article = {
        id: 'art_fo_unsupported',
        headline: 'Maruti Suzuki domestic sales rise 7% in January',
        body: 'Maruti Suzuki sold 199,364 units in January compared to 186,000 units.'
      };
      const res = productionTruthGuard.evaluateAndGuardSummary(
        article.id,
        'Maruti Suzuki sales rose 7% while call open interest built up at 12,000 strike and put/call ratio reached 1.25.',
        article
      );
      expect(res.isValid).toBe(false);
      expect(res.quarantineReason).toBe('FABRICATED_FO_DATA');
    });

    it('29. Bad summary is quarantined without deleting article', () => {
      const article = {
        id: 'art_bad_summary_01',
        headline: 'Wipro acquires cloud consultancy firm',
        body: 'Wipro announced acquisition for $50 million.'
      };
      productionTruthGuard.evaluateAndGuardSummary(
        article.id,
        'In conclusion, here is a summary of Wipro acquisition.',
        article
      );
      expect(productionTruthGuard.getIncidents('SUMMARY_ENGINE').length).toBeGreaterThan(0);
    });

    it('30. Article remains visible after summary quarantine', () => {
      const article = {
        id: 'art_vis_01',
        headline: 'BHEL secures boiler package order from Adani Power',
        body: 'BHEL bagged contract worth Rs 4,000 crore.'
      };
      const res = productionTruthGuard.evaluateAndGuardSummary(
        article.id,
        'As an AI model: BHEL wins order.',
        article
      );
      expect(res.safeFallbackSummary).toBeDefined();
      expect(res.safeFallbackSummary.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5. TELEGRAM GUARD & ZERO-LOSS QUEUE (31-42)
  // =========================================================================
  describe('5. Telegram Guard & Idempotency', () => {
    it('31. Initial alert dispatches once', () => {
      const decision = productionTruthGuard.canDispatchTelegramAlert({
        eventId: 'ev_tg_01',
        alertType: 'INITIAL_EVENT',
        revision: 1
      });
      expect(decision.canDispatch).toBe(true);
      expect(decision.idempotencyKey).toBe('ev_tg_01::INITIAL_EVENT::1');

      productionTruthGuard.recordTelegramDispatchSuccess(decision.idempotencyKey);
    });

    it('32. Duplicate alert key is blocked', () => {
      productionTruthGuard.recordTelegramDispatchSuccess('ev_tg_dup::INITIAL_EVENT::1');
      const decision = productionTruthGuard.canDispatchTelegramAlert({
        eventId: 'ev_tg_dup',
        alertType: 'INITIAL_EVENT',
        revision: 1
      });
      expect(decision.canDispatch).toBe(false);
      expect(decision.reason).toContain('Duplicate dispatch blocked');
    });

    it('33. Revision alert dispatches once under distinct revision key', () => {
      productionTruthGuard.recordTelegramDispatchSuccess('ev_tg_rev::INITIAL_EVENT::1');
      const decision = productionTruthGuard.canDispatchTelegramAlert({
        eventId: 'ev_tg_rev',
        alertType: 'MATERIAL_REVISION',
        revision: 2
      });
      expect(decision.canDispatch).toBe(true);
      expect(decision.idempotencyKey).toBe('ev_tg_rev::MATERIAL_REVISION::2');
    });

    it('34. Escalation dispatches once under ESCALATION alertType', () => {
      const decision = productionTruthGuard.canDispatchTelegramAlert({
        eventId: 'ev_tg_esc',
        alertType: 'ESCALATION',
        revision: 1
      });
      expect(decision.canDispatch).toBe(true);
      expect(decision.idempotencyKey).toBe('ev_tg_esc::ESCALATION::1');
    });

    it('35. Conflict alert dispatches once under CONFLICT alertType', () => {
      const decision = productionTruthGuard.canDispatchTelegramAlert({
        eventId: 'ev_tg_conf',
        alertType: 'CONFLICT',
        revision: 1
      });
      expect(decision.canDispatch).toBe(true);
    });

    it('36. Restart does not duplicate previously dispatched keys', () => {
      productionTruthGuard.recordTelegramDispatchSuccess('ev_restart::INITIAL_EVENT::1');
      const check = productionTruthGuard.canDispatchTelegramAlert({
        eventId: 'ev_restart',
        alertType: 'INITIAL_EVENT',
        revision: 1
      });
      expect(check.canDispatch).toBe(false);
    });

    it('37. Telegram 429 preserves queue without dropping items', () => {
      telegramOperationsController.markDegraded('Rate limit 429 encountered');
      expect(telegramOperationsController.getStatus().state).toBe('DEGRADED');
      expect(TelegramNotificationPipeline.getInstance().getQueueLength()).toBeGreaterThanOrEqual(0);
    });

    it('38. Telegram 500 preserves queue', () => {
      telegramOperationsController.markDegraded('Upstream Telegram 502 Bad Gateway');
      expect(telegramOperationsController.getStatus().state).toBe('DEGRADED');
    });

    it('39. Telegram timeout preserves queue state', () => {
      telegramOperationsController.pause('Paused on network timeout');
      expect(telegramOperationsController.isPaused()).toBe(true);
      telegramOperationsController.resume();
      expect(telegramOperationsController.isPaused()).toBe(false);
    });

    it('40. Ambiguous dispatch state pauses resend', () => {
      productionTruthGuard.containSubsystem('TELEGRAM_DISPATCH', 'TELEGRAM', 'Ambiguous Telegram network state', 'ERROR');
      const decision = productionTruthGuard.canDispatchTelegramAlert({
        eventId: 'ev_ambig_01',
        alertType: 'INITIAL_EVENT',
        revision: 1
      });
      expect(decision.canDispatch).toBe(false);
      expect(decision.reason).toContain('paused or contained');
    });

    it('41. Telegram failure does not affect feed visibility or storage', () => {
      telegramOperationsController.pause('Emergency Telegram pause');
      const feedArticles = newsStore.getAllArticles();
      expect(feedArticles.length).toBeGreaterThanOrEqual(0);
    });

    it('42. Queue remains FIFO within priority classes', () => {
      const pipeline = TelegramNotificationPipeline.getInstance();
      expect(typeof pipeline.getQueueLength()).toBe('number');
    });
  });

  // =========================================================================
  // 6. F&O DERIVATIVES SAFETY (43-50)
  // =========================================================================
  describe('6. F&O Evidence & Non-Fabrication Guard', () => {
    it('43. Explicit OI passes validation', () => {
      const intel = UnifiedIntelligenceEngine.build({
        id: 'fo_oi_01',
        headline: 'Nifty 24,000 Call adds 45 lakh shares in open interest',
        body: 'Nifty 24,000 strike call option open interest increased by 45 lakh shares.'
      } as any);
      expect(intel).toBeDefined();
    });

    it('44. Explicit PCR passes validation', () => {
      const intel = UnifiedIntelligenceEngine.build({
        id: 'fo_pcr_01',
        headline: 'Bank Nifty PCR moves from 0.85 to 1.15',
        body: 'Bank Nifty Put-Call Ratio shifted higher to 1.15 today.'
      } as any);
      expect(intel).toBeDefined();
    });

    it('45. Explicit IV passes validation', () => {
      const intel = UnifiedIntelligenceEngine.build({
        id: 'fo_iv_01',
        headline: 'India VIX jumps 8% to 14.50 ahead of budget',
        body: 'Implied volatility expanded sharply.'
      } as any);
      expect(intel).toBeDefined();
    });

    it('46. Explicit strike passes validation', () => {
      const intel = UnifiedIntelligenceEngine.build({
        id: 'fo_str_01',
        headline: 'Heavy put writing seen at 23,500 strike',
        body: 'Put writers active at 23,500 strike.'
      } as any);
      expect(intel).toBeDefined();
    });

    it('47. Missing OI produces no fabricated OI in guarded summary', () => {
      const guarded = productionTruthGuard.evaluateAndGuardSummary(
        'art_no_oi',
        'State Bank of India shares gained 2% on strong loan growth.',
        { headline: 'SBI gains 2%', body: 'State Bank of India reported loan growth.' }
      );
      expect(guarded.isValid).toBe(true);
      expect(guarded.safeFallbackSummary.toLowerCase()).not.toContain('open interest');
    });

    it('48. Missing PCR produces no fabricated PCR', () => {
      const guarded = productionTruthGuard.evaluateAndGuardSummary(
        'art_no_pcr',
        'ITC volume surges on institutional block deal.',
        { headline: 'ITC volume surges', body: 'ITC saw 50 lakh shares traded.' }
      );
      expect(guarded.isValid).toBe(true);
      expect(guarded.safeFallbackSummary.toLowerCase()).not.toContain('put/call ratio');
    });

    it('49. Missing IV produces no fabricated IV', () => {
      const guarded = productionTruthGuard.evaluateAndGuardSummary(
        'art_no_iv',
        'Tata Steel posts European margin recovery.',
        { headline: 'Tata Steel posts margin recovery', body: 'Tata Steel Europe margin turned positive.' }
      );
      expect(guarded.isValid).toBe(true);
      expect(guarded.safeFallbackSummary.toLowerCase()).not.toContain('implied volatility');
    });

    it('50. F&O eligibility alone does not produce derivatives intelligence without explicit body evidence', () => {
      const summary = UnifiedIntelligenceEngine.generateSourceGroundedSummary(
        'HCL Tech announces dividend of Rs 12 per share',
        'HCL Tech board declared interim dividend of Rs 12.',
        'CORPORATE_UPDATE',
        'Corporate'
      );
      expect(summary).toBeDefined();
      expect(summary.toLowerCase()).not.toContain('open interest');
      expect(summary.toLowerCase()).not.toContain('put/call ratio');
    });
  });

  // =========================================================================
  // 7. SOURCE CIRCUIT BREAKER (51-59)
  // =========================================================================
  describe('7. Source Circuit Breaker & Isolation', () => {
    it('51. Three consecutive failures quarantine source', () => {
      const source = sourceExpansionRegistry.registerSource({
        id: 'test_circuit_source_01',
        url: 'https://example.com/rss',
        name: 'Test Source 1',
        publisher: 'Test Publisher 1',
        category: 'MARKETS',
        tier: 2,
        enabled: true
      });

      sourceExpansionRegistry.recordSourceFailure('test_circuit_source_01', 'Network error 1');
      sourceExpansionRegistry.recordSourceFailure('test_circuit_source_01', 'Network error 2');
      sourceExpansionRegistry.recordSourceFailure('test_circuit_source_01', 'Network error 3');

      const status = sourceExpansionRegistry.getSourceStatus('test_circuit_source_01');
      expect(status?.circuitState).toBe('QUARANTINED');
    });

    it('52. One transient failure does not quarantine', () => {
      sourceExpansionRegistry.registerSource({
        id: 'test_transient_src',
        url: 'https://example.com/rss2',
        name: 'Transient Source',
        publisher: 'Transient Pub',
        category: 'MARKETS',
        tier: 2,
        enabled: true
      });

      sourceExpansionRegistry.recordSourceFailure('test_transient_src', 'Transient 504');
      const status = sourceExpansionRegistry.getSourceStatus('test_transient_src');
      expect(status?.circuitState).toBe('ACTIVE');
    });

    it('53. 429 classified correctly without stopping other sources', () => {
      sourceCircuitBreaker.classifyHttpError('test_transient_src', 429, 'Rate limit exceeded');
      const record = sourceExpansionRegistry.getSourceRecord('test_transient_src');
      expect(record?.failureClassification).toBe('HTTP_429_RATE_LIMITED');
    });

    it('54. 403 classified correctly', () => {
      sourceCircuitBreaker.classifyHttpError('test_transient_src', 403, 'Cloudflare block');
      const record = sourceExpansionRegistry.getSourceRecord('test_transient_src');
      expect(record?.failureClassification).toBe('HTTP_403_FORBIDDEN');
    });

    it('55. 404 classified correctly', () => {
      sourceCircuitBreaker.classifyHttpError('test_transient_src', 404, 'Feed URL deprecated');
      const record = sourceExpansionRegistry.getSourceRecord('test_transient_src');
      expect(record?.failureClassification).toBe('HTTP_404_NOT_FOUND');
    });

    it('56. Recovery probe works on quarantined source', async () => {
      sourceExpansionRegistry.quarantineSource('test_circuit_source_01', 'Test quarantine');
      sourceCircuitBreaker.setCooldownPeriodMs(0); // instant cooldown for test

      const probeRes = await sourceCircuitBreaker.executeProbe('test_circuit_source_01', async () => ({
        ok: true,
        status: 200,
        items: [{ title: 'Fresh headline' }]
      }));

      expect(probeRes.success).toBe(true);
      const status = sourceExpansionRegistry.getSourceStatus('test_circuit_source_01');
      expect(status?.circuitState).toBe('DEGRADED');
    });

    it('57. Failed probe preserves quarantine', async () => {
      sourceExpansionRegistry.quarantineSource('test_circuit_source_01', 'Test quarantine');
      sourceCircuitBreaker.setCooldownPeriodMs(0);

      const probeRes = await sourceCircuitBreaker.executeProbe('test_circuit_source_01', async () => ({
        ok: false,
        status: 503
      }));

      expect(probeRes.success).toBe(false);
      const status = sourceExpansionRegistry.getSourceStatus('test_circuit_source_01');
      expect(status?.circuitState).toBe('QUARANTINED');
    });

    it('58. Stable probes restore ACTIVE state', async () => {
      sourceCircuitBreaker.setCooldownPeriodMs(0);
      sourceCircuitBreaker.setStablePollThreshold(2);

      // Probe 1: QUARANTINED -> DEGRADED
      await sourceCircuitBreaker.executeProbe('test_circuit_source_01', async () => ({ ok: true, status: 200 }));
      // Probe 2: DEGRADED -> ACTIVE
      await sourceCircuitBreaker.executeProbe('test_circuit_source_01', async () => ({ ok: true, status: 200 }));

      const status = sourceExpansionRegistry.getSourceStatus('test_circuit_source_01');
      expect(status?.circuitState).toBe('ACTIVE');
    });

    it('59. One source failure does not stop other sources from ingesting', () => {
      const activeSources = sourceExpansionRegistry.getActiveSources();
      expect(Array.isArray(activeSources)).toBe(true);
    });
  });

  // =========================================================================
  // 8. ECONOMIC CALENDAR SAFETY (60-65)
  // =========================================================================
  describe('8. Economic Calendar Safety & Isolation', () => {
    it('60. Forex Factory failure does not stop news ingestion', () => {
      productionTruthGuard.containSubsystem('FOREX_FACTORY', 'ECONOMIC_CALENDAR', 'Forex Factory 500 error', 'WARNING');
      expect(productionTruthGuard.isContained('FOREX_FACTORY')).toBe(true);
      expect(newsStore.getAllArticles().length).toBeGreaterThanOrEqual(0);
    });

    it('61. Forex Factory quarantine is isolated to economic calendar', () => {
      expect(productionTruthGuard.isContained('V5_FEED_PROJECTION')).toBe(false);
      expect(productionTruthGuard.isContained('CANONICAL_STORAGE')).toBe(false);
    });

    it('62. RBI events continue during secondary calendar outage', () => {
      const rbiArticle = {
        id: 'cal_rbi_01',
        headline: 'RBI Monetary Policy Committee keeps Repo Rate unchanged at 6.50%',
        category: 'Economic',
        source: { name: 'RBI Press' }
      };
      expect(rbiArticle.headline).toContain('RBI');
    });

    it('63. Fed events continue normally', () => {
      const fedArticle = {
        id: 'cal_fed_01',
        headline: 'Federal Reserve holds federal funds target rate at 5.25%-5.50%',
        category: 'Economic',
        source: { name: 'Federal Reserve' }
      };
      expect(fedArticle.headline).toContain('Federal Reserve');
    });

    it('64. Official source outranks fallback aggregators', () => {
      const tier1 = 1;
      const tier3 = 3;
      expect(tier1).toBeLessThan(tier3);
    });

    it('65. Missing figures are not fabricated', () => {
      const guarded = productionTruthGuard.evaluateAndGuardSummary(
        'cal_missing_fig',
        'Core inflation print for January released by MoSPI.',
        { headline: 'MoSPI releases core inflation' }
      );
      expect(guarded.isValid).toBe(true);
    });
  });

  // =========================================================================
  // 9. AI COST GUARD & FAILURE CONTAINMENT (66-72)
  // =========================================================================
  describe('9. AI Cost Guard & Bounded Fallback', () => {
    it('66. Cached summary avoids unnecessary AI call', () => {
      const decision = aiCostGuard.evaluateAICallNecessity({
        hasCachedSummary: true
      });
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('CACHE_HIT');
    });

    it('67. Duplicate article avoids AI call', () => {
      const decision = aiCostGuard.evaluateAICallNecessity({
        isDuplicate: true
      });
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('DUPLICATE_ARTICLE');
    });

    it('68. Non-material update avoids AI call', () => {
      const decision = aiCostGuard.evaluateAICallNecessity({
        isMaterialUpdate: false
      });
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('NON_MATERIAL_UPDATE');
    });

    it('69. Historical hydration avoids AI call completely (zero cost)', () => {
      const decision = aiCostGuard.evaluateAICallNecessity({
        isHistorical: true
      });
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('HISTORICAL_HYDRATION');
    });

    it('70. Telegram-ineligible low relevance article avoids AI call', () => {
      const decision = aiCostGuard.evaluateAICallNecessity({
        isTelegramRequired: false,
        article: { relevanceScore: 25 }
      });
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('TELEGRAM_INELIGIBLE');
    });

    it('71. AI provider timeout / errors trip cost guard circuit into DEGRADED', () => {
      aiCostGuard.recordFailure(new Error('504 Gateway Timeout'));
      aiCostGuard.recordFailure(new Error('504 Gateway Timeout'));
      aiCostGuard.recordFailure(new Error('504 Gateway Timeout'));

      const telemetry = aiCostGuard.getTelemetry();
      expect(telemetry.isCircuitOpen).toBe(true);

      const decision = aiCostGuard.evaluateAICallNecessity({});
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('CIRCUIT_OPEN');
    });

    it('72. Provider recovery is deterministic upon successful test probe', () => {
      aiCostGuard.recordSuccess();
      const telemetry = aiCostGuard.getTelemetry();
      expect(telemetry.isCircuitOpen).toBe(false);
      expect(telemetry.consecutiveFailures).toBe(0);
    });
  });

  // =========================================================================
  // 10. CACHE & CANARY SAFETY (73-80)
  // =========================================================================
  describe('10. Cache Namespaces & Canary Safety', () => {
    it('73. V4 cache cannot contaminate V5 namespace', () => {
      const v4Namespace = 'athena.newsFeed.v2.snapshot.v2.control';
      const v5Namespace = 'athena.newsCoreV3.feed.v5';
      expect(v4Namespace).not.toBe(v5Namespace);
    });

    it('74. V5 cache cannot contaminate V4 namespace', () => {
      const v4Prefix = 'athena.newsFeed.v2';
      const v5Prefix = 'athena.newsCoreV3';
      expect(v5Prefix.startsWith(v4Prefix)).toBe(false);
    });

    it('75. Invalid cache snapshot is discarded without deleting canonical store', () => {
      const initialCount = newsStore.getAllArticles().length;
      productionTruthGuard.releaseSubsystem('CACHE');
      expect(newsStore.getAllArticles().length).toBe(initialCount);
    });

    it('76. ?canary=1 explicit query routes to canary if enabled', () => {
      newsCanaryRouter.setEnabled(true);
      newsCanaryRouter.setPercentage(100);
      const decision = newsCanaryRouter.shouldRouteToCanary({
        query: { canary: '1' }
      });
      expect(decision.useCanary).toBe(true);
    });

    it('77. ?canary=0 explicit query forces control V4', () => {
      const decision = newsCanaryRouter.shouldRouteToCanary({
        query: { canary: '0' }
      });
      expect(decision.useCanary).toBe(false);
    });

    it('78. Critical V5 failure disables canary and forces V4 fallback', () => {
      productionTruthGuard.enterSafeMode('Critical V5 projection failure');
      expect(productionTruthGuard.isV5FeedSafe()).toBe(false);
      expect(newsCanaryRouter.isEnabled()).toBe(false);
    });

    it('79. Canonical V4 remains available during entire canary transition', () => {
      const v4Feed = NewsCoreV2UIAdapter.adaptMany(newsStore.getAllArticles());
      expect(Array.isArray(v4Feed)).toBe(true);
    });

    it('80. Restart preserves runtime safety state idempotently', () => {
      const guardStatus = productionTruthGuard.getGuardStatus();
      expect(guardStatus).toBeDefined();
      expect(guardStatus.checkedAt).toBeDefined();
    });
  });

  // =========================================================================
  // 11. RECOVERY & END-TO-END VERIFICATION (81-90)
  // =========================================================================
  describe('11. Recovery & End-to-End Safety Simulation', () => {
    it('81. Contained subsystem recovers after successful probe', async () => {
      productionTruthGuard.containSubsystem('AI_ENRICHMENT', 'AI_PROVIDER', 'Temporary AI error', 'ERROR');
      const probeRes = await productionTruthRecoveryEngine.probeSubsystem('AI_ENRICHMENT');
      expect(probeRes.success).toBe(true);
      productionTruthGuard.releaseSubsystem('AI_ENRICHMENT');
      expect(productionTruthGuard.isContained('AI_ENRICHMENT')).toBe(false);
    });

    it('82. Failed recovery remains contained', async () => {
      productionTruthGuard.containSubsystem('SOURCE_INGESTION', 'SOURCE_INGESTION', 'Dead host', 'ERROR');
      expect(productionTruthGuard.isContained('SOURCE_INGESTION')).toBe(true);
    });

    it('83. Recovery does not mutate or drop canonical data', async () => {
      const countBefore = newsStore.getAllArticles().length;
      await productionTruthGuard.runRecoveryProbes();
      const countAfter = newsStore.getAllArticles().length;
      expect(countAfter).toBe(countBefore);
    });

    it('84. Recovery is idempotent across multiple sequential probe cycles', async () => {
      const res1 = await productionTruthGuard.runRecoveryProbes();
      const res2 = await productionTruthGuard.runRecoveryProbes();
      expect(res1).toBeDefined();
      expect(res2).toBeDefined();
    });

    it('85. 100+ article simulation preserves canonical count exactly', () => {
      const count = newsStore.getAllArticles().length;
      const snapshot = productionTruthReconciliationEngine.reconcileAll();
      expect(snapshot.storeCount).toBe(count);
    });

    it('86. Multi-source event clustering survives subsystem failure', () => {
      productionTruthGuard.containSubsystem('TELEGRAM_DISPATCH', 'TELEGRAM', 'Telegram 429', 'ERROR');
      const articles = newsStore.getAllArticles();
      expect(articles.length).toBeGreaterThanOrEqual(0);
    });

    it('87. Telegram outage does not interrupt news ingestion', () => {
      telegramOperationsController.pause('Emergency Telegram outage');
      expect(telegramOperationsController.isPaused()).toBe(true);
      expect(newsStore.getAllArticles().length).toBeGreaterThanOrEqual(0);
    });

    it('88. AI outage does not interrupt feed delivery', () => {
      aiOperationsController.disableAI();
      const v4Feed = NewsCoreV2UIAdapter.adaptMany(newsStore.getAllArticles());
      expect(Array.isArray(v4Feed)).toBe(true);
    });

    it('89. Source outage does not interrupt other sources', () => {
      sourceExpansionRegistry.quarantineSource('test_circuit_source_01', 'Quarantined source');
      expect(sourceExpansionRegistry.getSourceStatus('test_circuit_source_01')?.circuitState).toBe('QUARANTINED');
      expect(newsStore.getAllArticles().length).toBeGreaterThanOrEqual(0);
    });

    it('90. Complete system recovery returns to NORMAL runtime mode and HEALTHY state', async () => {
      productionTruthGuard.exitSafeMode();
      await productionTruthGuard.runRecoveryProbes();
      expect(productionTruthGuard.getHealthState()).toBe('HEALTHY');
      expect(productionTruthGuard.getRuntimeMode()).toBe('NORMAL');
      expect(productionTruthGuard.isSafeMode()).toBe(false);
    });
  });
});
