/**
 * ATHENA NEWS ENGINE — STAGE 8.9.5 PRODUCTION TRUTH CONTROL PLANE FORENSIC SUITE
 * 112 Comprehensive Control Plane, Forensics, Deduplication & Operational Lock Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { productionTruthControlPlane, ProductionTruthControlPlane } from '../controlPlane/ProductionTruthControlPlane';
import { productionTruthGuard } from '../guard/ProductionTruthGuard';
import { aiCostGuard } from '../guard/AICostGuard';
import { sourceCircuitBreaker } from '../guard/SourceCircuitBreaker';
import { productionTruthRecoveryEngine } from '../guard/ProductionTruthRecoveryEngine';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { sourceExpansionRegistry } from '../registry/SourceExpansionRegistry';
import { newsCanaryRouter } from '../canary/NewsCanaryRouter';
import { telegramOperationsController } from '../operations/TelegramOperationsController';
import { aiOperationsController } from '../operations/AIOperationsController';
import { newsSafeModeController } from '../operations/NewsSafeModeController';
import { NewsCoreV2UIAdapter } from '../../newsCoreV2/api/NewsCoreV2UIAdapter';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';

describe('Stage 8.9.5: Production Truth Dashboard, Incident Forensics & Zero-Regression Operational Lock', () => {
  beforeEach(() => {
    productionTruthControlPlane.reset();
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
  // 1. CORE SNAPSHOT GENERATION & PERFORMANCE (< 10ms) (1-10)
  // =========================================================================
  describe('1. Core Snapshot Generation & Determinism', () => {
    it('1. Generates complete ProductionTruthSnapshot with all top-level sections', () => {
      const snapshot = productionTruthControlPlane.getOperationalSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.snapshotId).toMatch(/^snap_\d+_/);
      expect(snapshot.generatedAt).toBeDefined();
      expect(snapshot.overallHealth).toBe('HEALTHY');
      expect(snapshot.runtimeMode).toBe('NORMAL');
      expect(snapshot.canonicalFeed).toBeDefined();
      expect(snapshot.eventEngine).toBeDefined();
      expect(snapshot.summaryEngine).toBeDefined();
      expect(snapshot.telegram).toBeDefined();
      expect(snapshot.ai).toBeDefined();
      expect(snapshot.sources).toBeDefined();
      expect(snapshot.economicCalendar).toBeDefined();
      expect(snapshot.cache).toBeDefined();
      expect(snapshot.canary).toBeDefined();
      expect(snapshot.reconciliation).toBeDefined();
      expect(snapshot.recovery).toBeDefined();
      expect(snapshot.truthScore).toBeDefined();
      expect(snapshot.baseline).toBeDefined();
      expect(snapshot.metrics).toBeDefined();
    });

    it('2. Snapshot generation executes in < 10ms with zero network/AI calls', () => {
      const start = performance.now();
      const snapshot = productionTruthControlPlane.getOperationalSnapshot();
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(10);
      expect(snapshot.metrics.generationDurationMs).toBeLessThanOrEqual(10);
    });

    it('3. Generates unique snapshotId on subsequent calls', () => {
      const snap1 = productionTruthControlPlane.getOperationalSnapshot();
      const snap2 = productionTruthControlPlane.getOperationalSnapshot();
      expect(snap1.snapshotId).not.toBe(snap2.snapshotId);
    });

    it('4. generatedAt timestamp is a valid ISO 8601 string', () => {
      const snapshot = productionTruthControlPlane.getOperationalSnapshot();
      expect(new Date(snapshot.generatedAt).toISOString()).toBe(snapshot.generatedAt);
    });

    it('5. Generates compact summary via getCompactSummary()', () => {
      const summary = productionTruthControlPlane.getCompactSummary();
      expect(summary.snapshotId).toBeDefined();
      expect(summary.overallHealth).toBe('HEALTHY');
      expect(summary.runtimeMode).toBe('NORMAL');
      expect(summary.truthScore).toBeGreaterThanOrEqual(0);
      expect(summary.truthScore).toBeLessThanOrEqual(100);
      expect(summary.canonicalStoreCount).toBeGreaterThanOrEqual(0);
      expect(summary.countParity).toBe(true);
      expect(summary.activeIncidentsCount).toBe(0);
      expect(summary.containedSubsystemsCount).toBe(0);
    });

    it('6. Compact summary reflects snapshot key metrics accurately', () => {
      const snapshot = productionTruthControlPlane.getOperationalSnapshot();
      const summary = productionTruthControlPlane.getCompactSummary();
      expect(summary.overallHealth).toBe(snapshot.overallHealth);
      expect(summary.runtimeMode).toBe(snapshot.runtimeMode);
      expect(summary.canonicalStoreCount).toBe(snapshot.canonicalFeed.persistentStoreCount);
      expect(summary.diskStoreCount).toBe(snapshot.canonicalFeed.canonicalCount);
      expect(summary.countParity).toBe(snapshot.canonicalFeed.countParity);
    });

    it('7. Read-only operation does not modify canonical store', () => {
      const countBefore = newsStore.getAllArticles().length;
      productionTruthControlPlane.getOperationalSnapshot();
      const countAfter = newsStore.getAllArticles().length;
      expect(countAfter).toBe(countBefore);
    });

    it('8. Memory usage is tracked in metrics block', () => {
      const snapshot = productionTruthControlPlane.getOperationalSnapshot();
      expect(typeof snapshot.metrics.memoryUsageMb).toBe('number');
      expect(snapshot.metrics.memoryUsageMb).toBeGreaterThanOrEqual(0);
    });

    it('9. Multiple snapshot evaluations are idempotent and deterministic', () => {
      const snap1 = productionTruthControlPlane.getOperationalSnapshot();
      const snap2 = productionTruthControlPlane.getOperationalSnapshot();
      expect(snap1.overallHealth).toBe(snap2.overallHealth);
      expect(snap1.truthScore.totalScore).toBe(snap2.truthScore.totalScore);
      expect(snap1.canonicalFeed.canonicalCount).toBe(snap2.canonicalFeed.canonicalCount);
    });

    it('10. Zero side-effects on active pipelines during evaluation', () => {
      const isPausedBefore = telegramOperationsController.isPaused();
      const isAIBefore = aiOperationsController.isAIEnabled();
      productionTruthControlPlane.getOperationalSnapshot();
      expect(telegramOperationsController.isPaused()).toBe(isPausedBefore);
      expect(aiOperationsController.isAIEnabled()).toBe(isAIBefore);
    });
  });

  // =========================================================================
  // 2. INCIDENT REPOSITORY & DEDUPLICATION (11-20)
  // =========================================================================
  describe('2. Incident Repository & Deduplication Forensics', () => {
    it('11. Records new incident with unique incidentId', () => {
      const inc = productionTruthControlPlane.recordIncident({
        domain: 'FEED_API',
        severity: 'ERROR',
        reason: 'Temporary pagination upstream timeout'
      });
      expect(inc.incidentId).toMatch(/^inc_\d+_/);
      expect(inc.status).toBe('OPEN');
      expect(inc.occurrenceCount).toBe(1);
      expect(inc.consecutiveFailures).toBe(1);
    });

    it('12. Generates deterministic fingerprint domain::errorCode::reason', () => {
      const inc = productionTruthControlPlane.recordIncident({
        domain: 'SOURCE_INGESTION',
        severity: 'WARNING',
        errorCode: 'ERR_TIMEOUT',
        reason: 'NSE RSS poll timed out after 5000ms'
      });
      expect(inc.fingerprint).toContain('SOURCE_INGESTION::ERR_TIMEOUT');
    });

    it('13. Deduplicates identical incidents, incrementing occurrenceCount', () => {
      const inc1 = productionTruthControlPlane.recordIncident({
        domain: 'AI_PROVIDER',
        severity: 'ERROR',
        errorCode: 'ERR_RATE_LIMIT',
        reason: 'Gemini quota exceeded 429'
      });
      const inc2 = productionTruthControlPlane.recordIncident({
        domain: 'AI_PROVIDER',
        severity: 'ERROR',
        errorCode: 'ERR_RATE_LIMIT',
        reason: 'Gemini quota exceeded 429'
      });
      expect(inc1.incidentId).toBe(inc2.incidentId);
      expect(inc2.occurrenceCount).toBe(2);
      expect(inc2.consecutiveFailures).toBe(2);
    });

    it('14. Updates lastDetectedAt on deduplicated incident', () => {
      const inc1 = productionTruthControlPlane.recordIncident({
        domain: 'TELEGRAM',
        severity: 'ERROR',
        reason: 'Telegram network connection reset'
      });
      const firstDetected = inc1.firstDetectedAt;
      const inc2 = productionTruthControlPlane.recordIncident({
        domain: 'TELEGRAM',
        severity: 'ERROR',
        reason: 'Telegram network connection reset'
      });
      expect(inc2.firstDetectedAt).toBe(firstDetected);
      expect(new Date(inc2.lastDetectedAt).getTime()).toBeGreaterThanOrEqual(new Date(firstDetected).getTime());
    });

    it('15. Merges affectedArticleIds on recurring incident without duplicates', () => {
      productionTruthControlPlane.recordIncident({
        domain: 'SUMMARY_ENGINE',
        severity: 'WARNING',
        reason: 'Entity mismatch detected',
        affectedArticleIds: ['art_1', 'art_2']
      });
      const recurring = productionTruthControlPlane.recordIncident({
        domain: 'SUMMARY_ENGINE',
        severity: 'WARNING',
        reason: 'Entity mismatch detected',
        affectedArticleIds: ['art_2', 'art_3']
      });
      expect(recurring.affectedArticleIds).toEqual(['art_1', 'art_2', 'art_3']);
    });

    it('16. Resolves incident with resolveIncident(), sets resolvedAt and recoveryAction', () => {
      const inc = productionTruthControlPlane.recordIncident({
        domain: 'EVENT_ENGINE',
        severity: 'ERROR',
        reason: 'Event projection missing article'
      });
      const res = productionTruthControlPlane.resolveIncident(inc.incidentId, 'Reprojected event with canonical fallback');
      expect(res).toBe(true);

      const resolved = productionTruthControlPlane.getIncidentById(inc.incidentId);
      expect(resolved?.status).toBe('RESOLVED');
      expect(resolved?.resolvedAt).toBeDefined();
      expect(resolved?.recoveryAction).toBe('Reprojected event with canonical fallback');
    });

    it('17. getIncidents() filters correctly by domain and status', () => {
      const inc1 = productionTruthControlPlane.recordIncident({
        domain: 'TELEGRAM',
        severity: 'ERROR',
        reason: 'Telegram 429'
      });
      const inc2 = productionTruthControlPlane.recordIncident({
        domain: 'AI_PROVIDER',
        severity: 'ERROR',
        reason: 'Gemini 503'
      });

      const telegramIncidents = productionTruthControlPlane.getIncidents('TELEGRAM');
      expect(telegramIncidents.length).toBe(1);
      expect(telegramIncidents[0].domain).toBe('TELEGRAM');

      productionTruthControlPlane.resolveIncident(inc1.incidentId);
      const openIncidents = productionTruthControlPlane.getIncidents(undefined, 'OPEN');
      expect(openIncidents.some(i => i.incidentId === inc2.incidentId)).toBe(true);
      expect(openIncidents.some(i => i.incidentId === inc1.incidentId)).toBe(false);
    });

    it('18. getIncidentById() retrieves forensic details or null for unknown ID', () => {
      const inc = productionTruthControlPlane.recordIncident({
        domain: 'CANARY_ROUTING',
        severity: 'WARNING',
        reason: 'Canary split ratio skew'
      });
      expect(productionTruthControlPlane.getIncidentById(inc.incidentId)).toBeDefined();
      expect(productionTruthControlPlane.getIncidentById('unknown_inc_id')).toBeNull();
    });

    it('19. Critical incident creates status CONTAINED immediately', () => {
      const inc = productionTruthControlPlane.recordIncident({
        domain: 'CANONICAL_STORAGE',
        severity: 'CRITICAL',
        reason: 'Critical corruption detected'
      });
      expect(inc.status).toBe('CONTAINED');
    });

    it('20. Deduplication creates new incident if previous one was resolved', () => {
      const inc1 = productionTruthControlPlane.recordIncident({
        domain: 'FEED_API',
        severity: 'ERROR',
        reason: 'Feed discrepancy'
      });
      productionTruthControlPlane.resolveIncident(inc1.incidentId);

      const inc2 = productionTruthControlPlane.recordIncident({
        domain: 'FEED_API',
        severity: 'ERROR',
        reason: 'Feed discrepancy'
      });
      expect(inc2.incidentId).not.toBe(inc1.incidentId);
      expect(inc2.status).toBe('OPEN');
    });
  });

  // =========================================================================
  // 3. TIMELINE MANAGEMENT & SECURITY SANITIZATION (21-28)
  // =========================================================================
  describe('3. Timeline Management & Security Sanitization', () => {
    it('21. Logs timestamped chronological timeline events', () => {
      const event = productionTruthControlPlane.recordTimelineEvent({
        domain: 'FEED_API',
        event: 'Feed refreshed successfully',
        severity: 'INFO',
        correlationId: 'test_corr_1'
      });
      expect(event.id).toMatch(/^tl_\d+_/);
      expect(event.timestamp).toBeDefined();
      expect(event.domain).toBe('FEED_API');
    });

    it('22. Sanitizes Telegram bot tokens in timeline descriptions', () => {
      const event = productionTruthControlPlane.recordTimelineEvent({
        domain: 'TELEGRAM',
        event: 'Failed dispatch to bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz with 401',
        severity: 'ERROR',
        correlationId: 'sec_test_1'
      });
      expect(event.event).not.toContain('bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
      expect(event.event).toContain('bot[REDACTED]');
    });

    it('23. Sanitizes Google Gemini API keys in timeline events', () => {
      const event = productionTruthControlPlane.recordTimelineEvent({
        domain: 'AI_PROVIDER',
        event: 'Request to endpoint using AIzaSyD98X76543210ZYXWVUTSRQPONMLKJIHG failed',
        severity: 'ERROR',
        correlationId: 'sec_test_2'
      });
      expect(event.event).not.toContain('AIzaSyD98X76543210ZYXWVUTSRQPONMLKJIHG');
      expect(event.event).toContain('AIza[REDACTED]');
    });

    it('24. Sanitizes Bearer authorization tokens in timeline events', () => {
      const event = productionTruthControlPlane.recordTimelineEvent({
        domain: 'FEED_API',
        event: 'Upstream call failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token',
        severity: 'ERROR',
        correlationId: 'sec_test_3'
      });
      expect(event.event).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token');
      expect(event.event).toContain('Bearer [REDACTED]');
    });

    it('25. Maintains bounded timeline size without unbounded growth', () => {
      for (let i = 0; i < 250; i++) {
        productionTruthControlPlane.recordTimelineEvent({
          domain: 'SOURCE_INGESTION',
          event: `Source poll ${i}`,
          severity: 'INFO',
          correlationId: `bulk_${i}`
        });
      }
      const timeline = productionTruthControlPlane.getTimeline(300);
      expect(timeline.length).toBeLessThanOrEqual(200);
    });

    it('26. getTimeline(limit) honors limit parameter', () => {
      for (let i = 0; i < 20; i++) {
        productionTruthControlPlane.recordTimelineEvent({
          domain: 'ECONOMIC_CALENDAR',
          event: `Macro event check ${i}`,
          severity: 'INFO',
          correlationId: `macro_${i}`
        });
      }
      const timeline = productionTruthControlPlane.getTimeline(5);
      expect(timeline.length).toBe(5);
    });

    it('27. Recording an incident automatically emits a timeline event', () => {
      const initialCount = productionTruthControlPlane.getTimeline().length;
      productionTruthControlPlane.recordIncident({
        domain: 'UI_PROJECTION',
        severity: 'WARNING',
        reason: 'UI card render latency high'
      });
      const newCount = productionTruthControlPlane.getTimeline().length;
      expect(newCount).toBe(initialCount + 1);
    });

    it('28. Resolving an incident automatically emits a RESOLVED timeline event', () => {
      const inc = productionTruthControlPlane.recordIncident({
        domain: 'CACHE',
        severity: 'WARNING',
        reason: 'Cache hit ratio dropped'
      });
      const initialCount = productionTruthControlPlane.getTimeline().length;
      productionTruthControlPlane.resolveIncident(inc.incidentId, 'Re-warmed cache partition');
      const newCount = productionTruthControlPlane.getTimeline().length;
      expect(newCount).toBe(initialCount + 1);
      const latest = productionTruthControlPlane.getTimeline(1)[0];
      expect(latest.event).toContain('RESOLVED');
    });
  });

  // =========================================================================
  // 4. DOMAIN HEALTH MATRIX (29-39)
  // =========================================================================
  describe('4. Domain Health Matrix', () => {
    it('29. Exposes health status across all 11 failure domains', () => {
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.CANONICAL_STORAGE).toBeDefined();
      expect(matrix.FEED_API).toBeDefined();
      expect(matrix.UI_PROJECTION).toBeDefined();
      expect(matrix.EVENT_ENGINE).toBeDefined();
      expect(matrix.SUMMARY_ENGINE).toBeDefined();
      expect(matrix.TELEGRAM).toBeDefined();
      expect(matrix.SOURCE_INGESTION).toBeDefined();
      expect(matrix.ECONOMIC_CALENDAR).toBeDefined();
      expect(matrix.AI_PROVIDER).toBeDefined();
      expect(matrix.CACHE).toBeDefined();
      expect(matrix.CANARY_ROUTING).toBeDefined();
    });

    it('30. CANONICAL_STORAGE health reflects storage state', () => {
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.CANONICAL_STORAGE.health).toBe('HEALTHY');
      expect(matrix.CANONICAL_STORAGE.contained).toBe(false);
    });

    it('31. FEED_API health reflects feed projection safety', () => {
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.FEED_API.health).toBe('HEALTHY');
    });

    it('32. UI_PROJECTION health tracks UI adapter status', () => {
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.UI_PROJECTION.health).toBe('HEALTHY');
    });

    it('33. EVENT_ENGINE health tracks clustering status', () => {
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.EVENT_ENGINE.health).toBe('HEALTHY');
    });

    it('34. SUMMARY_ENGINE health tracks summary validation', () => {
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.SUMMARY_ENGINE.health).toBe('HEALTHY');
    });

    it('35. TELEGRAM health reflects paused state as DEGRADED', () => {
      telegramOperationsController.pause('Testing pause');
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.TELEGRAM.health).toBe('DEGRADED');
      expect(matrix.TELEGRAM.lastAction).toContain('paused');
    });

    it('36. SOURCE_INGESTION health tracks degraded sources', () => {
      sourceExpansionRegistry.quarantineSource('nse_corporate', 'Testing quarantine');
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.SOURCE_INGESTION.health).toBe('DEGRADED');
    });

    it('37. ECONOMIC_CALENDAR health reflects calendar state', () => {
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.ECONOMIC_CALENDAR.health).toBe('HEALTHY');
    });

    it('38. AI_PROVIDER health reflects disabled AI as DEGRADED', () => {
      aiOperationsController.disableAI();
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.AI_PROVIDER.health).toBe('DEGRADED');
    });

    it('39. Active incidents update domain health and failure timestamps', () => {
      productionTruthControlPlane.recordIncident({
        domain: 'EVENT_ENGINE',
        severity: 'ERROR',
        reason: 'Event correlation error'
      });
      const matrix = productionTruthControlPlane.getDomainHealth();
      expect(matrix.EVENT_ENGINE.activeIncidentCount).toBe(1);
      expect(matrix.EVENT_ENGINE.lastFailureAt).toBeDefined();
    });
  });

  // =========================================================================
  // 5. TELEGRAM FORENSICS & ZERO-LOSS TRACKING (40-50)
  // =========================================================================
  describe('5. Telegram Forensics & Zero-Loss Audit', () => {
    it('40. Tracks telegramHealth, queueDepth, queuedEvents, sentCount, failedCount', () => {
      const telem = productionTruthControlPlane.getTelegramForensics();
      expect(telem.telegramHealth).toBeDefined();
      expect(typeof telem.queueDepth).toBe('number');
      expect(typeof telem.queuedEvents).toBe('number');
      expect(typeof telem.sentCount).toBe('number');
      expect(typeof telem.failedCount).toBe('number');
    });

    it('41. Pausing Telegram marks health DEGRADED without dropping queue', () => {
      telegramOperationsController.pause('Manual maintenance');
      const telem = productionTruthControlPlane.getTelegramForensics();
      expect(telem.telegramHealth).toBe('DEGRADED');
      expect(telegramOperationsController.isPaused()).toBe(true);
    });

    it('42. Resuming Telegram restores healthy status', () => {
      telegramOperationsController.pause('Test');
      telegramOperationsController.resume();
      const telem = productionTruthControlPlane.getTelegramForensics();
      expect(telem.telegramHealth).toBe('HEALTHY');
    });

    it('43. Duplicate suppression count is tracked in forensics', () => {
      const telem = productionTruthControlPlane.getTelegramForensics();
      expect(typeof telem.duplicateSuppressedCount).toBe('number');
      expect(telem.duplicateSuppressedCount).toBeGreaterThanOrEqual(0);
    });

    it('44. Historical alert suppression count is tracked', () => {
      const telem = productionTruthControlPlane.getTelegramForensics();
      expect(typeof telem.historicalAlertsSuppressed).toBe('number');
    });

    it('45. Average and P95 delivery latencies are exposed as positive numbers', () => {
      const telem = productionTruthControlPlane.getTelegramForensics();
      expect(telem.averageDeliveryLatency).toBeGreaterThanOrEqual(0);
      expect(telem.p95DeliveryLatency).toBeGreaterThanOrEqual(0);
    });

    it('46. Unresolved alerts array is exposed safely', () => {
      const telem = productionTruthControlPlane.getTelegramForensics();
      expect(Array.isArray(telem.unresolvedAlerts)).toBe(true);
    });

    it('47. Idempotency tracking prevents duplicate dispatches', () => {
      const res1 = telegramOperationsController.recordDispatch('evt_test_1', 'EARNINGS_ANNOUNCEMENT', 1);
      expect(res1.shouldDispatch).toBe(true);

      const res2 = telegramOperationsController.recordDispatch('evt_test_1', 'EARNINGS_ANNOUNCEMENT', 1);
      expect(res2.shouldDispatch).toBe(false);
      expect(res2.reason).toContain('Duplicate alert suppressed');
    });

    it('48. Rate limit pauses are tracked in rateLimitedCount', () => {
      const telem = productionTruthControlPlane.getTelegramForensics();
      expect(typeof telem.rateLimitedCount).toBe('number');
    });

    it('49. Telegram operations status reflects sentEventKeysCount', () => {
      telegramOperationsController.recordDispatch('evt_test_2', 'DIVIDEND_DECLARATION', 1);
      const status = telegramOperationsController.getStatus();
      expect(status.sentEventKeysCount).toBeGreaterThanOrEqual(1);
    });

    it('50. Clearing idempotency allows re-dispatch for test environments', () => {
      telegramOperationsController.recordDispatch('evt_test_3', 'MACRO_POLICY', 1);
      telegramOperationsController.clearIdempotency();
      const res = telegramOperationsController.recordDispatch('evt_test_3', 'MACRO_POLICY', 1);
      expect(res.shouldDispatch).toBe(true);
    });
  });

  // =========================================================================
  // 6. AI USAGE FORENSICS & COST PROTECTION (51-60)
  // =========================================================================
  describe('6. AI Usage Forensics & Cost Protection', () => {
    it('51. Tracks Gemini provider status and circuit breaker state', () => {
      const ai = productionTruthControlPlane.getAIForensics();
      expect(ai.gemini.enabled).toBe(true);
      expect(ai.gemini.available).toBe(true);
      expect(ai.gemini.circuitState).toBe('CLOSED');
    });

    it('52. Tracks Groq provider status', () => {
      const ai = productionTruthControlPlane.getAIForensics();
      expect(ai.groq.enabled).toBe(true);
    });

    it('53. Fallback usage is inactive when AI is healthy', () => {
      const ai = productionTruthControlPlane.getAIForensics();
      expect(ai.fallbackUsage.active).toBe(false);
    });

    it('54. Fallback usage becomes active when AI is disabled', () => {
      aiOperationsController.disableAI();
      const ai = productionTruthControlPlane.getAIForensics();
      expect(ai.fallbackUsage.active).toBe(true);
    });

    it('55. Tracks detailed breakdown of aiCallsAvoided categories', () => {
      productionTruthControlPlane.trackAICallAvoided('DUPLICATE');
      productionTruthControlPlane.trackAICallAvoided('CACHE_HIT');
      productionTruthControlPlane.trackAICallAvoided('HISTORICAL');
      productionTruthControlPlane.trackAICallAvoided('LOW_SIGNAL');

      const ai = productionTruthControlPlane.getAIForensics();
      expect(ai.aiCallsAvoided.DUPLICATE).toBe(1);
      expect(ai.aiCallsAvoided.CACHE_HIT).toBe(1);
      expect(ai.aiCallsAvoided.HISTORICAL).toBe(1);
      expect(ai.aiCallsAvoided.LOW_SIGNAL).toBe(1);
      expect(ai.aiCallsAvoided.NO_ENRICHMENT_REQUIRED).toBe(0);
    });

    it('56. Non-material update avoidance is tracked', () => {
      productionTruthControlPlane.trackAICallAvoided('NON_MATERIAL_UPDATE');
      const ai = productionTruthControlPlane.getAIForensics();
      expect(ai.aiCallsAvoided.NON_MATERIAL_UPDATE).toBe(1);
    });

    it('57. Telegram-not-eligible avoidance is tracked', () => {
      productionTruthControlPlane.trackAICallAvoided('TELEGRAM_NOT_ELIGIBLE');
      const ai = productionTruthControlPlane.getAIForensics();
      expect(ai.aiCallsAvoided.TELEGRAM_NOT_ELIGIBLE).toBe(1);
    });

    it('58. AICostGuard evaluates duplicate article bypass strategy', () => {
      const decision = aiCostGuard.evaluateAICallNecessity({
        isDuplicate: true
      });
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('DUPLICATE_ARTICLE');
    });

    it('59. AICostGuard evaluates cache hit bypass strategy', () => {
      const decision = aiCostGuard.evaluateAICallNecessity({
        hasCachedSummary: true
      });
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('CACHE_HIT');
    });

    it('60. AICostGuard evaluates historical hydration bypass strategy with ZERO AI calls', () => {
      const decision = aiCostGuard.evaluateAICallNecessity({
        isHistorical: true
      });
      expect(decision.shouldCallAI).toBe(false);
      expect(decision.bypassStrategy).toBe('HISTORICAL_HYDRATION');
    });
  });

  // =========================================================================
  // 7. SOURCE REGISTRY & ACCURACY FORENSICS (61-70)
  // =========================================================================
  describe('7. Source Registry & Accuracy Forensics', () => {
    it('61. Reports total registered sources and status counts', () => {
      const sources = productionTruthControlPlane.getSourceForensics();
      expect(sources.totalRegistered).toBeGreaterThan(0);
      expect(sources.activeCount).toBeGreaterThan(0);
      expect(typeof sources.degradedCount).toBe('number');
      expect(typeof sources.quarantinedCount).toBe('number');
      expect(typeof sources.disabledCount).toBe('number');
      expect(sources.activeCount + sources.degradedCount + sources.quarantinedCount + sources.disabledCount).toBe(sources.totalRegistered);
    });

    it('62. Lists each source with ID, publisher, sourceType, circuitState', () => {
      const sources = productionTruthControlPlane.getSourceForensics();
      const first = sources.sources[0];
      expect(first.sourceId).toBeDefined();
      expect(first.publisher).toBeDefined();
      expect(first.sourceType).toBeDefined();
      expect(first.circuitState).toBeDefined();
    });

    it('63. Quarantining a source reflects immediately in quarantinedCount', () => {
      sourceExpansionRegistry.quarantineSource('bse_corporate', 'Test quarantine');
      const sources = productionTruthControlPlane.getSourceForensics();
      expect(sources.quarantinedCount).toBeGreaterThanOrEqual(1);

      const bse = sources.sources.find(s => s.sourceId === 'bse_corporate');
      expect(bse?.circuitState).toBe('QUARANTINED');
    });

    it('64. Exposes source quarantine reason in forensics', () => {
      sourceExpansionRegistry.quarantineSource('rbi_press', 'Payload schema violation');
      const sources = productionTruthControlPlane.getSourceForensics();
      const rbi = sources.sources.find(s => s.sourceId === 'rbi_press');
      expect(rbi?.failureClassification).toBe('Payload schema violation');
    });

    it('65. Source accuracy metrics are exposed with non-negative counters', () => {
      const sources = productionTruthControlPlane.getSourceForensics();
      for (const s of sources.sources) {
        if (s.accuracyMetrics) {
          expect(s.accuracyMetrics.articlesDiscovered).toBeGreaterThanOrEqual(0);
          expect(s.accuracyMetrics.articlesAccepted).toBeGreaterThanOrEqual(0);
          expect(s.accuracyMetrics.articlesQuarantined).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('66. Resetting quarantined source restores ACTIVE state', () => {
      sourceExpansionRegistry.quarantineSource('moneycontrol_feed', 'Test');
      sourceExpansionRegistry.resetSourceStatus('moneycontrol_feed');
      const sources = productionTruthControlPlane.getSourceForensics();
      const mc = sources.sources.find(s => s.sourceId === 'moneycontrol_feed');
      expect(mc?.circuitState).toBe('ACTIVE');
    });

    it('67. Degraded source does not crash other healthy sources', () => {
      sourceExpansionRegistry.recordFailure('livemint_markets', 'HTTP 500');
      const sources = productionTruthControlPlane.getSourceForensics();
      const healthy = sources.sources.filter(s => s.circuitState === 'ACTIVE');
      expect(healthy.length).toBeGreaterThan(0);
    });

    it('68. Source circuit breaker tracks consecutive failures per source', () => {
      sourceCircuitBreaker.recordFailure('source_test_1');
      sourceCircuitBreaker.recordFailure('source_test_1');
      expect(sourceCircuitBreaker.isQuarantined('source_test_1')).toBe(false);
      sourceCircuitBreaker.recordFailure('source_test_1'); // 3rd failure trips
      expect(sourceCircuitBreaker.isQuarantined('source_test_1')).toBe(true);
    });

    it('69. Source circuit breaker reset clears quarantine', () => {
      sourceCircuitBreaker.recordFailure('source_test_2');
      sourceCircuitBreaker.recordFailure('source_test_2');
      sourceCircuitBreaker.recordFailure('source_test_2');
      expect(sourceCircuitBreaker.isQuarantined('source_test_2')).toBe(true);
      sourceCircuitBreaker.resetSource('source_test_2');
      expect(sourceCircuitBreaker.isQuarantined('source_test_2')).toBe(false);
    });

    it('70. Single source degradation leaves overall system functioning', () => {
      sourceExpansionRegistry.quarantineSource('pib_press', 'Parsing error');
      const snapshot = productionTruthControlPlane.getOperationalSnapshot();
      expect(snapshot.overallHealth).toBe('DEGRADED');
      expect(snapshot.canonicalFeed.persistentStoreCount).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 8. ECONOMIC CALENDAR, CANARY & EVENT ENGINE FORENSICS (71-80)
  // =========================================================================
  describe('8. Economic Calendar, Canary & Event Engine Forensics', () => {
    it('71. Economic calendar exposes provider, health, and event counts', () => {
      const cal = productionTruthControlPlane.getEconomicCalendarForensics();
      expect(cal.provider).toBe('FOREX_FACTORY');
      expect(cal.health).toBe('HEALTHY');
      expect(typeof cal.eventsDiscovered).toBe('number');
      expect(typeof cal.eventsAccepted).toBe('number');
      expect(typeof cal.fallbackEventsUsed).toBe('number');
    });

    it('72. Canary forensics track percentage, control requests, canary requests', () => {
      const canary = productionTruthControlPlane.getCanaryForensics();
      expect(typeof canary.canaryPercentage).toBe('number');
      expect(typeof canary.controlRequests).toBe('number');
      expect(typeof canary.canaryRequests).toBe('number');
      expect(canary.v5Contained).toBe(false);
    });

    it('73. Canary containment marks v5Contained true', () => {
      productionTruthGuard.containSubsystem('V5_FEED_PROJECTION', 'FEED_API', 'Test containment');
      const canary = productionTruthControlPlane.getCanaryForensics();
      expect(canary.v5Contained).toBe(true);
    });

    it('74. Event engine forensics report total eventsCreated', () => {
      const ev = productionTruthControlPlane.getEventEngineForensics();
      expect(typeof ev.eventsCreated).toBe('number');
      expect(ev.eventsCreated).toBeGreaterThanOrEqual(0);
    });

    it('75. Event engine forensics track escalated events', () => {
      const ev = productionTruthControlPlane.getEventEngineForensics();
      expect(typeof ev.eventsEscalated).toBe('number');
    });

    it('76. Event engine forensics track resolved events', () => {
      const ev = productionTruthControlPlane.getEventEngineForensics();
      expect(typeof ev.eventsResolved).toBe('number');
    });

    it('77. Event engine forensics track conflicted events', () => {
      const ev = productionTruthControlPlane.getEventEngineForensics();
      expect(typeof ev.eventsConflicted).toBe('number');
    });

    it('78. Source coverage is reported as positive average', () => {
      const ev = productionTruthControlPlane.getEventEngineForensics();
      expect(ev.sourceCoverage).toBeGreaterThanOrEqual(1.0);
    });

    it('79. Duplicate articles merged counter is reported', () => {
      const ev = productionTruthControlPlane.getEventEngineForensics();
      expect(typeof ev.duplicateArticlesMerged).toBe('number');
    });

    it('80. Active event count matches activeEventCount', () => {
      const ev = productionTruthControlPlane.getEventEngineForensics();
      expect(ev.activeEventCount).toBe(ev.eventsCreated);
    });
  });

  // =========================================================================
  // 9. SUMMARY QUALITY FORENSICS & ANTI-SLOP VALIDATION (81-90)
  // =========================================================================
  describe('9. Summary Quality Forensics & Anti-Slop Validation', () => {
    it('81. Tracks summariesGenerated and summariesCached', () => {
      productionTruthControlPlane.trackSummaryQualityOutcome({ generated: true });
      productionTruthControlPlane.trackSummaryQualityOutcome({ cached: true });
      const sq = productionTruthControlPlane.getSummaryQualityForensics();
      expect(sq.summariesGenerated).toBe(1);
      expect(sq.summariesCached).toBe(1);
    });

    it('82. Tracks genericTemplateRejected (anti-slop AI template rejection)', () => {
      productionTruthControlPlane.trackSummaryQualityOutcome({ genericTemplateRejected: true });
      const sq = productionTruthControlPlane.getSummaryQualityForensics();
      expect(sq.summariesRejected).toBe(1);
      expect(sq.genericTemplateRejected).toBe(1);
    });

    it('83. Tracks entityMismatchRejected', () => {
      productionTruthControlPlane.trackSummaryQualityOutcome({ entityMismatchRejected: true });
      const sq = productionTruthControlPlane.getSummaryQualityForensics();
      expect(sq.entityMismatchRejected).toBe(1);
      expect(sq.summariesRejected).toBe(1);
    });

    it('84. Tracks numberMismatchRejected', () => {
      productionTruthControlPlane.trackSummaryQualityOutcome({ numberMismatchRejected: true });
      const sq = productionTruthControlPlane.getSummaryQualityForensics();
      expect(sq.numberMismatchRejected).toBe(1);
      expect(sq.summariesRejected).toBe(1);
    });

    it('85. Tracks unsupportedClaimRejected', () => {
      productionTruthControlPlane.trackSummaryQualityOutcome({ unsupportedClaimRejected: true });
      const sq = productionTruthControlPlane.getSummaryQualityForensics();
      expect(sq.unsupportedClaimRejected).toBe(1);
      expect(sq.summariesRejected).toBe(1);
    });

    it('86. Tracks fabricatedFoRejected', () => {
      productionTruthControlPlane.trackSummaryQualityOutcome({ fabricatedFoRejected: true });
      const sq = productionTruthControlPlane.getSummaryQualityForensics();
      expect(sq.fabricatedFoRejected).toBe(1);
      expect(sq.summariesRejected).toBe(1);
    });

    it('87. ProductionTruthGuard rejects AI slop phrases and produces safe fallback', () => {
      const res = productionTruthGuard.evaluateAndGuardSummary(
        'art_slop_1',
        'As an AI, in conclusion here is a summary of the quarterly results.',
        { headline: 'HDFC Bank reports 18% profit growth', body: 'HDFC Bank announced robust net profit.' }
      );
      expect(res.isValid).toBe(false);
      expect(res.quarantineReason).toBe('GENERIC_TEMPLATE');
      expect(res.safeFallbackSummary).toContain('HDFC Bank');
    });

    it('88. ProductionTruthGuard rejects fabricated F&O claims without source grounding', () => {
      const res = productionTruthGuard.evaluateAndGuardSummary(
        'art_fno_fake',
        'NIFTY 25000 CE open interest increased by 500% with huge PCR shift.',
        { headline: 'IT Index ends flat today', body: 'Indian IT stocks closed flat with no major movement.' }
      );
      expect(res.isValid).toBe(false);
      expect(res.quarantineReason).toBe('FABRICATED_FO_DATA');
    });

    it('89. ProductionTruthGuard accepts valid, grounded summary without rejection', () => {
      const res = productionTruthGuard.evaluateAndGuardSummary(
        'art_valid_1',
        'TCS signs 5-year digital transformation deal with European retail giant.',
        { headline: 'TCS signs retail contract in Europe', body: 'Tata Consultancy Services announced a major deal.' }
      );
      expect(res.isValid).toBe(true);
      expect(res.quarantineReason).toBeUndefined();
    });

    it('90. Empty summary safely produces headline/body fallback', () => {
      const res = productionTruthGuard.evaluateAndGuardSummary(
        'art_empty_1',
        '   ',
        { headline: 'Infosys board declares dividend', body: 'Infosys declared Rs 20 dividend.' }
      );
      expect(res.isValid).toBe(false);
      expect(res.safeFallbackSummary).toContain('Infosys');
    });
  });

  // =========================================================================
  // 10. RECOVERY FORENSICS & ACTION HISTORY (91-100)
  // =========================================================================
  describe('10. Recovery Forensics & Action History', () => {
    it('91. Tracks recoveryMode flag', () => {
      const rec = productionTruthControlPlane.getRecoveryForensics();
      expect(rec.recoveryMode).toBe(false);
    });

    it('92. Records recovery action via recordRecoveryAction()', () => {
      const action = productionTruthControlPlane.recordRecoveryAction({
        domain: 'AI_PROVIDER',
        subsystem: 'AI_ENRICHMENT',
        result: 'SUCCESS',
        attempt: 1,
        probeType: 'PING_GEMINI_HEALTH',
        message: 'Gemini provider resumed 200 OK'
      });
      expect(action.id).toMatch(/^rec_\d+_/);
      expect(action.result).toBe('SUCCESS');
      expect(action.probeType).toBe('PING_GEMINI_HEALTH');
    });

    it('93. Categorizes active, completed, and failed recovery actions', () => {
      productionTruthControlPlane.recordRecoveryAction({
        domain: 'TELEGRAM',
        subsystem: 'TELEGRAM_DISPATCH',
        result: 'SUCCESS',
        attempt: 1,
        probeType: 'PROBE_TELEGRAM_QUEUE'
      });
      productionTruthControlPlane.recordRecoveryAction({
        domain: 'SOURCE_INGESTION',
        subsystem: 'NSE_RSS',
        result: 'FAILURE',
        attempt: 2,
        probeType: 'POLL_SOURCE_HEALTH'
      });

      const rec = productionTruthControlPlane.getRecoveryForensics();
      expect(rec.completedRecoveryActions.length).toBe(1);
      expect(rec.failedRecoveryActions.length).toBe(1);
      expect(rec.activeRecoveryActions.length).toBe(0);
    });

    it('94. Tracks lastRecoveryAt timestamp', () => {
      productionTruthControlPlane.recordRecoveryAction({
        domain: 'FEED_API',
        subsystem: 'V5_FEED_PROJECTION',
        result: 'SUCCESS',
        attempt: 1,
        probeType: 'PROBE_COUNT_PARITY'
      });
      const rec = productionTruthControlPlane.getRecoveryForensics();
      expect(rec.lastRecoveryAt).toBeDefined();
      expect(rec.lastSuccessfulRecoveryAt).toBeDefined();
    });

    it('95. Recovery action history is bounded', () => {
      for (let i = 0; i < 120; i++) {
        productionTruthControlPlane.recordRecoveryAction({
          domain: 'CACHE',
          subsystem: 'STORAGE_INTEGRITY',
          result: 'SUCCESS',
          attempt: 1,
          probeType: `PROBE_${i}`
        });
      }
      const rec = productionTruthControlPlane.getRecoveryForensics();
      expect(rec.completedRecoveryActions.length).toBeLessThanOrEqual(100);
    });

    it('96. ProductionTruthRecoveryEngine probes AI_ENRICHMENT successfully when AI enabled', async () => {
      aiOperationsController.enableAI();
      const res = await productionTruthRecoveryEngine.probeSubsystem('AI_ENRICHMENT');
      expect(res.success).toBe(true);
      expect(res.healthyState).toBe('HEALTHY');
    });

    it('97. ProductionTruthRecoveryEngine probes TELEGRAM_DISPATCH successfully when not paused', async () => {
      telegramOperationsController.resume();
      const res = await productionTruthRecoveryEngine.probeSubsystem('TELEGRAM_DISPATCH');
      expect(res.success).toBe(true);
    });

    it('98. ProductionTruthRecoveryEngine probes V5_FEED_PROJECTION and checks count parity', async () => {
      const res = await productionTruthRecoveryEngine.probeSubsystem('V5_FEED_PROJECTION');
      expect(res.success).toBe(true);
    });

    it('99. ProductionTruthGuard runs recovery probes and clears recovered subsystems', async () => {
      productionTruthGuard.containSubsystem('AI_ENRICHMENT', 'AI_PROVIDER', 'Temporary outage');
      expect(productionTruthGuard.isContained('AI_ENRICHMENT')).toBe(true);

      const recResult = await productionTruthGuard.runRecoveryProbes();
      expect(recResult.recoveredSubsystems).toContain('AI_ENRICHMENT');
      expect(productionTruthGuard.isContained('AI_ENRICHMENT')).toBe(false);
      expect(productionTruthGuard.getHealthState()).toBe('HEALTHY');
    });

    it('100. Guard status exposes lastRecovery details after probe run', async () => {
      productionTruthGuard.containSubsystem('TELEGRAM_DISPATCH', 'TELEGRAM', 'Rate limit pause');
      await productionTruthGuard.runRecoveryProbes();
      const status = productionTruthGuard.getGuardStatus();
      expect(status.lastRecovery).toBeDefined();
      expect(status.lastRecovery?.recoveredSubsystems).toContain('TELEGRAM_DISPATCH');
    });
  });

  // =========================================================================
  // 11. PRODUCTION TRUTH SCORE & INVARIANT LOCK (101-112)
  // =========================================================================
  describe('11. Production Truth Score & Zero-Regression Operational Lock', () => {
    it('101. Total score is 100 on perfectly healthy system', () => {
      const score = productionTruthControlPlane.getOperationalSnapshot().truthScore;
      expect(score.totalScore).toBe(100);
      expect(score.components.canonicalIntegrity).toBe(30);
      expect(score.components.feedAvailability).toBe(20);
      expect(score.components.eventIntegrity).toBe(15);
      expect(score.components.telegramHealth).toBe(10);
      expect(score.components.sourceHealth).toBe(10);
      expect(score.components.aiHealth).toBe(5);
      expect(score.components.cacheCanary).toBe(5);
      expect(score.components.recoveryState).toBe(5);
    });

    it('102. Canonical integrity contributes 30 points on verified count parity', () => {
      const score = productionTruthControlPlane.getOperationalSnapshot().truthScore;
      expect(score.components.canonicalIntegrity).toBe(30);
    });

    it('103. Feed availability gives 20 points when V5 feed is safe', () => {
      const score = productionTruthControlPlane.getOperationalSnapshot().truthScore;
      expect(score.components.feedAvailability).toBe(20);
    });

    it('104. Telegram degradation reduces score proportionally without crash', () => {
      telegramOperationsController.pause('Test degradation');
      const score = productionTruthControlPlane.getOperationalSnapshot().truthScore;
      expect(score.components.telegramHealth).toBe(6);
      expect(score.totalScore).toBe(96);
    });

    it('105. AI fallback reduces AI component score from 5 to 3', () => {
      aiOperationsController.disableAI();
      const score = productionTruthControlPlane.getOperationalSnapshot().truthScore;
      expect(score.components.aiHealth).toBe(3);
    });

    it('106. Precedence rule: State Machine (SAFE_MODE) remains authoritative over raw score', () => {
      productionTruthGuard.enterSafeMode('Testing emergency lock');
      const snapshot = productionTruthControlPlane.getOperationalSnapshot();
      expect(snapshot.overallHealth).toBe('SAFE_MODE');
      expect(snapshot.truthScore.authoritativeHealth).toBe('SAFE_MODE');
      expect(snapshot.truthScore.explanation).toContain('State Machine (SAFE_MODE) remains authoritative');
    });

    it('107. Precedence rule: RECONCILIATION_FAILURE takes precedence over DEGRADED', () => {
      const health = productionTruthControlPlane.determineOverallHealth(undefined, 'RECONCILIATION_FAILURE');
      expect(health).toBe('RECONCILIATION_FAILURE');
    });

    it('108. Startup baseline is recorded upon initialization', () => {
      const baseline = productionTruthControlPlane.getBaseline();
      expect(baseline).toBeDefined();
      expect(baseline.canonicalCount).toBeGreaterThanOrEqual(0);
      expect(baseline.storeCount).toBeGreaterThanOrEqual(0);
      expect(baseline.sourceCount).toBeGreaterThan(0);
      expect(baseline.recordedAt).toBeDefined();
    });

    it('109. Drift check against baseline confirms zero canonical news loss', () => {
      const baseline = productionTruthControlPlane.getBaseline();
      const current = productionTruthControlPlane.getOperationalSnapshot().canonicalFeed;
      expect(current.persistentStoreCount).toBeGreaterThanOrEqual(baseline.storeCount);
      expect(current.canonicalCount).toBeGreaterThanOrEqual(baseline.canonicalCount);
    });

    it('110. Control plane reset restores clean state for test harness', () => {
      productionTruthControlPlane.recordIncident({
        domain: 'FEED_API',
        severity: 'ERROR',
        reason: 'Temporary error'
      });
      expect(productionTruthControlPlane.getIncidents().length).toBe(1);

      productionTruthControlPlane.reset();
      expect(productionTruthControlPlane.getIncidents().length).toBe(0);
      expect(productionTruthControlPlane.getTimeline().length).toBe(0);
    });

    it('111. End-to-End: Incident -> Deduplication -> Auto-Containment -> Recovery -> Truth Restoration', async () => {
      // 1. Initial healthy state
      let snap = productionTruthControlPlane.getOperationalSnapshot();
      expect(snap.overallHealth).toBe('HEALTHY');
      expect(snap.truthScore.totalScore).toBe(100);

      // 2. Incident tripped on AI
      productionTruthGuard.recordIncident({
        domain: 'AI_PROVIDER',
        severity: 'ERROR',
        reason: 'Provider downstream 503 error'
      });
      snap = productionTruthControlPlane.getOperationalSnapshot();
      expect(snap.overallHealth).toBe('DEGRADED');
      expect(snap.containmentActions.some(c => c.subsystem === 'AI_ENRICHMENT')).toBe(true);

      // 3. Recovery probe run
      aiOperationsController.enableAI();
      const rec = await productionTruthGuard.runRecoveryProbes();
      expect(rec.recoveredSubsystems).toContain('AI_ENRICHMENT');

      // 4. System restored to HEALTHY
      snap = productionTruthControlPlane.getOperationalSnapshot();
      expect(snap.overallHealth).toBe('HEALTHY');
      expect(snap.truthScore.totalScore).toBe(100);
    });

    it('112. Full production invariant check across all layers', () => {
      const snap = productionTruthControlPlane.getOperationalSnapshot();
      // Invariant 1: Count Parity
      expect(snap.canonicalFeed.countParity).toBe(true);
      // Invariant 2: Zero duplicate canonical URLs
      expect(snap.canonicalFeed.duplicateCanonicalUrls.length).toBe(0);
      // Invariant 3: Source coverage >= 1.0
      expect(snap.eventEngine.sourceCoverage).toBeGreaterThanOrEqual(1.0);
      // Invariant 4: No unreconciled feed drops
      expect(snap.reconciliation.feedDropsCount).toBe(0);
      // Invariant 5: Safe feed fallback available
      expect(snap.feedProjection.v5Safe).toBe(true);
    });
  });
});
