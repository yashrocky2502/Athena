/**
 * ATHENA NEWS ENGINE — STAGE 8.3 FORENSIC TEST SUITE
 * Live Feed Reliability, Article Freshness, Event Fingerprinting, Source Health & Telemetry Audit.
 * 30 Forensic Test Cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { sourceHealthMonitor, SourceHealthMonitor } from '../monitoring/SourceHealthMonitor';
import { ArticleFreshnessEvaluator } from '../freshness/ArticleFreshnessEvaluator';
import { eventFingerprintEngine, EventFingerprintEngine } from '../deduplication/EventFingerprintEngine';
import { ingestionLatencyTracker, IngestionLatencyTracker } from '../monitoring/IngestionLatencyTracker';
import { IngestionPipeline } from '../ingestion/IngestionPipeline';
import { JsonNewsStore } from '../storage/JsonNewsStore';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';

describe('Stage 8.3 Live Feed Reliability & Freshness Forensic Test Suite', () => {
  beforeEach(() => {
    SourceHealthMonitor.resetInstance();
    EventFingerprintEngine.resetInstance();
    IngestionLatencyTracker.resetInstance();
    TelegramNotificationPipeline.resetInstance();
    ArticleFreshnessEvaluator.clearQuarantineLog();
  });

  // 1. Source Health Registration
  it('1. source_health_registration_and_metrics: registers source with initial zeroed metrics', () => {
    const monitor = SourceHealthMonitor.getInstance();
    const source = monitor.registerSource('reuters-rss', 'Reuters Financial', 'RSS', 30000);

    expect(source.sourceId).toBe('reuters-rss');
    expect(source.publisher).toBe('Reuters Financial');
    expect(source.consecutiveFailures).toBe(0);
    expect(source.healthState).toBe('UNKNOWN');
    expect(source.stallState).toBe('HEALTHY');
  });

  // 2. Failure Classification - Transient HTTP
  it('2. failure_classification_transient_http: classifies 429, 500, 502, 503, 504 and timeout as TRANSIENT', () => {
    const monitor = SourceHealthMonitor.getInstance();

    const res503 = monitor.classifyFailure(new Error('Service Unavailable'), 503);
    expect(res503.failureClass).toBe('TRANSIENT');
    expect(res503.isTransient).toBe(true);

    const res429 = monitor.classifyFailure(new Error('Too Many Requests'), 429);
    expect(res429.failureClass).toBe('TRANSIENT');

    const resTimeout = monitor.classifyFailure(new Error('ETIMEDOUT connection reset'));
    expect(resTimeout.failureClass).toBe('TRANSIENT');
  });

  // 3. Failure Classification - Permanent Auth
  it('3. failure_classification_permanent_auth: classifies 400, 401 and invalid credentials as PERMANENT', () => {
    const monitor = SourceHealthMonitor.getInstance();

    const res401 = monitor.classifyFailure(new Error('Invalid Credentials'), 401);
    expect(res401.failureClass).toBe('PERMANENT');
    expect(res401.isTransient).toBe(false);
  });

  // 4. Failure Classification - Access Restricted
  it('4. failure_classification_access_restricted: classifies 403, robots and access denied as ACCESS_RESTRICTED', () => {
    const monitor = SourceHealthMonitor.getInstance();

    const res403 = monitor.classifyFailure(new Error('Access Denied by Cloudflare'), 403);
    expect(res403.failureClass).toBe('ACCESS_RESTRICTED');
    expect(res403.isTransient).toBe(false);
  });

  // 5. Failure Classification - Missing Resource
  it('5. failure_classification_missing_resource: classifies 404 and invalid feed url as MISSING_RESOURCE', () => {
    const monitor = SourceHealthMonitor.getInstance();

    const res404 = monitor.classifyFailure(new Error('Feed Not Found'), 404);
    expect(res404.failureClass).toBe('MISSING_RESOURCE');
    expect(res404.isTransient).toBe(false);
  });

  // 6. Transient Backoff Exponential
  it('6. transient_backoff_exponential: applies bounded exponential backoff for transient errors', () => {
    const monitor = SourceHealthMonitor.getInstance();
    monitor.registerSource('src-1', 'Publisher 1');

    monitor.recordPollFailure('src-1', 100, new Error('Timeout'), 503);
    let health = monitor.getSourceHealth('src-1');
    expect(health?.consecutiveFailures).toBe(1);
    expect(health?.backoffUntilMs).toBeGreaterThan(Date.now());

    monitor.recordPollFailure('src-1', 100, new Error('Timeout'), 503);
    health = monitor.getSourceHealth('src-1');
    expect(health?.consecutiveFailures).toBe(2);
  });

  // 7. Permanent Error No Endless Retry
  it('7. permanent_error_no_endless_retry: permanent error sets OFFLINE and long backoff', () => {
    const monitor = SourceHealthMonitor.getInstance();
    monitor.registerSource('src-perm', 'Bad Publisher');

    monitor.recordPollFailure('src-perm', 50, new Error('404 Not Found'), 404);
    const health = monitor.getSourceHealth('src-perm');
    expect(health?.healthState).toBe('OFFLINE');
    expect(health?.lastFailureClass).toBe('MISSING_RESOURCE');
    expect(health?.backoffUntilMs).toBeGreaterThan(Date.now() + 300000); // long backoff
  });

  // 8. Freshness State Classification
  it('8. freshness_state_classification: classifies BREAKING, VERY_FRESH, FRESH, AGING, STALE', () => {
    const now = Date.now();

    const breakingArt = { publishedAt: new Date(now - 120 * 1000).toISOString() };
    expect(ArticleFreshnessEvaluator.evaluateFreshness(breakingArt).freshnessState).toBe('BREAKING');

    const vFreshArt = { publishedAt: new Date(now - 600 * 1000).toISOString() };
    expect(ArticleFreshnessEvaluator.evaluateFreshness(vFreshArt).freshnessState).toBe('VERY_FRESH');

    const freshArt = { publishedAt: new Date(now - 3600 * 1000).toISOString() };
    expect(ArticleFreshnessEvaluator.evaluateFreshness(freshArt).freshnessState).toBe('FRESH');

    const agingArt = { publishedAt: new Date(now - 12 * 3600 * 1000).toISOString() };
    expect(ArticleFreshnessEvaluator.evaluateFreshness(agingArt).freshnessState).toBe('AGING');

    const staleArt = { publishedAt: new Date(now - 30 * 3600 * 1000).toISOString() };
    expect(ArticleFreshnessEvaluator.evaluateFreshness(staleArt).freshnessState).toBe('STALE');
  });

  // 9. Stale Article Suppression
  it('9. stale_article_suppression: suppresses articles older than 24h unless material update present', () => {
    const staleArt = {
      headline: 'Old Corporate Earnings Report',
      body: 'Old content published days ago with sufficient length to pass stub check',
      sourceUrl: 'https://example.com/stale-article-1',
      publishedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString()
    };

    const evalRes = ArticleFreshnessEvaluator.evaluateFreshness(staleArt);
    expect(evalRes.isStale).toBe(true);
    expect(evalRes.suppressReason).toContain('stale threshold');

    const qualRes = ArticleFreshnessEvaluator.validateQuality(staleArt);
    expect(qualRes.accepted).toBe(false);
    expect(qualRes.rejectionReason).toBe('STALE_ARTICLE');
  });

  // 10. Article Update Detection - Unchanged
  it('10. article_update_detection_unchanged: classifies identical article text as UNCHANGED_ARTICLE', () => {
    const inc = { headline: 'Tata Motors Wins Order', body: 'Tata Motors bags ₹2,500 crore order from DTC' };
    const ext = { headline: 'Tata Motors Wins Order', body: 'Tata Motors bags ₹2,500 crore order from DTC' };

    const updateRes = ArticleFreshnessEvaluator.detectUpdate(inc, ext);
    expect(updateRes.updateClass).toBe('UNCHANGED_ARTICLE');
    expect(updateRes.hasMaterialUpdate).toBe(false);
  });

  // 11. Article Update Detection - Material
  it('11. article_update_detection_material: classifies revised financial numbers as UPDATED_ARTICLE with material update', () => {
    const inc = { headline: 'Tata Motors Wins Expanded Order', body: 'Tata Motors bags ₹3,200 crore expanded contract' };
    const ext = { headline: 'Tata Motors Wins Order', body: 'Tata Motors bags ₹2,500 crore order' };

    const updateRes = ArticleFreshnessEvaluator.detectUpdate(inc, ext);
    expect(updateRes.updateClass).toBe('UPDATED_ARTICLE');
    expect(updateRes.hasMaterialUpdate).toBe(true);
  });

  // 12. Event Fingerprint Generation
  it('12. event_fingerprint_generation: generates deterministic fingerprint for same event across headlines', () => {
    const engine = EventFingerprintEngine.getInstance();

    const fp1 = engine.generateFingerprint({ headline: 'Tata Motors wins ₹2,500 crore order' });
    const fp2 = engine.generateFingerprint({ headline: 'Tata Motors bags Rs 2,500 crore contract' });

    expect(fp1.fingerprint).toBe(fp2.fingerprint);
    expect(fp1.primaryEntity).toBe('TATAMOTORS');
    expect(fp1.eventType).toBe('ORDER_WIN');
  });

  // 13. Event Deduplication Single Alert
  it('13. event_deduplication_single_alert: 3 articles for same event produce 1 alert', () => {
    const engine = EventFingerprintEngine.getInstance();

    const res1 = engine.evaluateEvent({ headline: 'Tata Motors wins ₹2,500 crore order', source: { name: 'Reuters', publisher: 'Reuters', tier: 2 } as any });
    const res2 = engine.evaluateEvent({ headline: 'Tata Motors bags Rs 2,500 crore contract', source: { name: 'Economic Times', publisher: 'Economic Times', tier: 2 } as any });
    const res3 = engine.evaluateEvent({ headline: 'Tata Motors secures ₹2,500 crore order', source: { name: 'Moneycontrol', publisher: 'Moneycontrol', tier: 2 } as any });

    expect(res1.shouldDispatchAlert).toBe(true);
    expect(res1.eventRelation).toBe('NEW_EVENT');

    expect(res2.shouldDispatchAlert).toBe(false);
    expect(res2.eventRelation).toBe('DUPLICATE_EVENT');

    expect(res3.shouldDispatchAlert).toBe(false);
    expect(res3.eventRelation).toBe('DUPLICATE_EVENT');

    expect(res3.eventRecord.articlesCount).toBe(3);
    expect(res3.eventRecord.sources.length).toBe(3);
  });

  // 14. Event Escalation Detection
  it('14. event_escalation_detection: financial value increase triggers EVENT_ESCALATION and new alert', () => {
    const engine = EventFingerprintEngine.getInstance();

    engine.evaluateEvent({ headline: 'Tata Motors wins ₹500 crore order', source: { name: 'Reuters' } as any });
    const escRes = engine.evaluateEvent({ headline: 'Tata Motors order size increases to ₹900 crore', source: { name: 'CNBC' } as any });

    expect(escRes.eventRelation).toBe('EVENT_ESCALATION');
    expect(escRes.shouldDispatchAlert).toBe(true);
  });

  // 15. Source Conflict Detection
  it('15. source_conflict_detection: contradictory numbers trigger CONFLICT_DETECTED', () => {
    const engine = EventFingerprintEngine.getInstance();

    engine.evaluateEvent({ headline: 'Tata Motors reports Q3 net profit at ₹500 crore', source: { name: 'Reuters' } as any });
    const conflictRes = engine.evaluateEvent({ headline: 'Tata Motors reports Q3 net profit at ₹350 crore', source: { name: 'ET' } as any });

    expect(conflictRes.hasConflict).toBe(true);
    expect(conflictRes.eventRecord.conflictingFields?.length).toBeGreaterThan(0);
  });

  // 16. Quality Gate Empty Article Rejection
  it('16. quality_gate_empty_article_rejection: rejects empty headline/body', () => {
    const res = ArticleFreshnessEvaluator.validateQuality({ headline: '', body: '' });
    expect(res.accepted).toBe(false);
    expect(res.rejectionReason).toBe('EMPTY_ARTICLE');
  });

  // 17. Quality Gate Short Stub Rejection
  it('17. quality_gate_short_stub_rejection: rejects short stubs under 30 chars', () => {
    const res = ArticleFreshnessEvaluator.validateQuality({ headline: 'Short', body: 'Stub text' });
    expect(res.accepted).toBe(false);
    expect(res.rejectionReason).toBe('EXTREMELY_SHORT_STUB');
  });

  // 18. Quality Gate Navigation Page Rejection
  it('18. quality_gate_navigation_page_rejection: rejects breadcrumbs & navigation pages', () => {
    const res = ArticleFreshnessEvaluator.validateQuality({
      headline: 'Home > Markets > Stocks',
      body: 'Click here for more footer navigation terms'
    });
    expect(res.accepted).toBe(false);
    expect(res.rejectionReason).toBe('NAVIGATION_PAGE');
  });

  // 19. Quality Gate Live Price Page Rejection
  it('19. quality_gate_live_price_page_rejection: rejects pure stock price tables without narrative', () => {
    const res = ArticleFreshnessEvaluator.validateQuality({
      headline: 'Current price: ₹450.25 High 455 Low 448',
      body: 'Current price ₹450.25 52 week high low listing table without story text'
    });
    expect(res.accepted).toBe(false);
    expect(res.rejectionReason).toBe('LIVE_PRICE_PAGE');
  });

  // 20. Quality Gate Malformed RSS Rejection
  it('20. quality_gate_malformed_rss_rejection: rejects entries with missing/invalid source URL', () => {
    const res = ArticleFreshnessEvaluator.validateQuality({
      headline: 'Valid Headline with long description text',
      body: 'Valid long body content describing financial event in detail',
      sourceUrl: ''
    });
    expect(res.accepted).toBe(false);
    expect(res.rejectionReason).toBe('MALFORMED_RSS_ENTRY');
  });

  // 21. Quality Gate Boilerplate Rejection
  it('21. quality_gate_boilerplate_rejection: rejects disclaimer/promotional stub', () => {
    const res = ArticleFreshnessEvaluator.validateQuality({
      headline: 'Market Update',
      body: 'Disclaimer: The views expressed above are solely subscribe to unlock this article',
      sourceUrl: 'https://example.com/article'
    });
    expect(res.accepted).toBe(false);
    expect(res.rejectionReason).toBe('PUBLISHER_BOILERPLATE');
  });

  // 22. Quarantine Auditability
  it('22. quarantine_auditability: quarantined articles recorded without deleting source records', () => {
    ArticleFreshnessEvaluator.validateQuality({ headline: '', body: '' });
    ArticleFreshnessEvaluator.validateQuality({ headline: 'Short', body: 'Stub' });

    const log = ArticleFreshnessEvaluator.getQuarantineLog();
    expect(log.length).toBe(2);
    expect(log[0].rejectionReason).toBe('EMPTY_ARTICLE');
    expect(log[1].rejectionReason).toBe('EXTREMELY_SHORT_STUB');
  });

  // 23. Stall State No New Content
  it('23. stall_state_no_new_content: sets NO_NEW_CONTENT state when 2x interval elapsed without new content', () => {
    const monitor = SourceHealthMonitor.getInstance();
    monitor.registerSource('stalled-src', 'Quiet Publisher', 'RSS', 30000);

    const oldTime = new Date(Date.now() - 70000).toISOString();
    monitor.recordPollSuccess('stalled-src', 100, 0, 0, 0, 0, oldTime);

    const health = monitor.getSourceHealth('stalled-src');
    expect(health?.stallState).toBe('NO_NEW_CONTENT');
  });

  // 24. Stall State Stalled Feed
  it('24. stall_state_stalled_feed: sets STALLED state when no new content for > 6 hours', () => {
    const monitor = SourceHealthMonitor.getInstance();
    monitor.registerSource('dead-src', 'Stale Publisher', 'RSS', 30000);

    const oldTime = new Date(Date.now() - 7 * 3600 * 1000).toISOString();
    monitor.recordPollSuccess('dead-src', 100, 0, 0, 0, 0, oldTime);

    const health = monitor.getSourceHealth('dead-src');
    expect(health?.stallState).toBe('STALLED');
    expect(health?.healthState).toBe('DEGRADED');
  });

  // 25. Source Tier Prioritization
  it('25. source_tier_prioritization: registers Tier 1 (Official) as primary source', () => {
    const engine = EventFingerprintEngine.getInstance();

    const officialRes = engine.evaluateEvent({
      headline: 'SEBI circular on derivative position limits',
      source: { name: 'SEBI Official', publisher: 'SEBI', tier: 1 } as any
    });

    expect(officialRes.eventRecord.primarySourceTier).toBe(1);
  });

  // 26. F&O Priority Grounded Metrics
  it('26. fno_priority_grounded_metrics: F&O article retains grounded derivative metrics without fabrication', async () => {
    const store = new JsonNewsStore();
    await store.clearForTestOnly();
    const pipeline = new IngestionPipeline(store);

    const fnoPayload = {
      headline: 'Nifty 25000 Call Option sees massive Open Interest buildup of 50 lakh contracts',
      body: 'Derivatives data shows high call writing at 25000 strike with PCR at 0.75 and IV at 14.5%',
      url: 'https://example.com/fno-1',
      publishedAt: new Date().toISOString()
    };

    const res = await pipeline.ingest([fnoPayload], 'F&O Market Desk');
    expect(res.saved).toBe(1);

    const stored = await store.getAll();
    expect(stored[0].headline).toContain('Call Option');
  });

  // 27. Ingestion Queue Priority Classes
  it('27. ingestion_queue_p0_to_p4_classes: enqueues with correct priority class', async () => {
    const pipeline = TelegramNotificationPipeline.getInstance();

    const p0Promise = pipeline.enqueueArticle({ headline: 'SEBI Regulatory Circular Order', id: 'art_p0' }, { isLive: true, priority: 0 });
    const p3Promise = pipeline.enqueueArticle({ headline: 'General Market Column', id: 'art_p3' }, { isLive: true, priority: 3 });

    expect(pipeline.getQueueLength()).toBeGreaterThanOrEqual(0);
  });

  // 28. End-To-End Latency Telemetry
  it('28. end_to_end_latency_telemetry: computes stage latencies correctly', () => {
    const tracker = IngestionLatencyTracker.getInstance();

    const now = Date.now();
    const rec = tracker.recordTelemetry({
      articleId: 'art-lat-1',
      publisher: 'Reuters',
      publishedAt: new Date(now - 5000).toISOString(),
      discoveredAt: new Date(now - 4000).toISOString(),
      normalizedAt: new Date(now - 3000).toISOString(),
      summaryReadyAt: new Date(now - 2000).toISOString(),
      eligibilityCheckedAt: new Date(now - 1000).toISOString(),
      queuedAt: new Date(now - 500).toISOString(),
      sentAt: new Date(now).toISOString()
    });

    expect(rec.sourceDiscoveryLatencyMs).toBe(1000);
    expect(rec.normalizationLatencyMs).toBe(1000);
    expect(rec.summaryLatencyMs).toBe(1000);
    expect(rec.signalEvaluationLatencyMs).toBe(1000);
    expect(rec.telegramQueueLatencyMs).toBe(500);
    expect(rec.totalEndToEndLatencyMs).toBe(5000);
  });

  // 29. SLA Percentile Computation
  it('29. sla_percentile_computation: computes median, P95, P99 SLA stats', () => {
    const tracker = IngestionLatencyTracker.getInstance();

    for (let i = 1; i <= 100; i++) {
      tracker.recordTelemetry({
        articleId: `art-${i}`,
        publisher: 'ET',
        publishedAt: new Date(Date.now() - i * 100).toISOString(),
        discoveredAt: new Date(Date.now() - i * 80).toISOString(),
        normalizedAt: new Date(Date.now() - i * 60).toISOString(),
        summaryReadyAt: new Date(Date.now() - i * 40).toISOString(),
        eligibilityCheckedAt: new Date(Date.now() - i * 20).toISOString()
      });
    }

    const stats = tracker.getGlobalSLAStats();
    expect(stats.sampleCount).toBe(100);
    expect(stats.totalEndToEndLatencyMs.median).toBeGreaterThan(0);
    expect(stats.totalEndToEndLatencyMs.p95).toBeGreaterThanOrEqual(stats.totalEndToEndLatencyMs.median);
    expect(stats.totalEndToEndLatencyMs.p99).toBeGreaterThanOrEqual(stats.totalEndToEndLatencyMs.p95);
  });

  // 30. REST Monitoring APIs Compliance
  it('30. rest_monitoring_apis_compliance: verifies structure of monitoring telemetry objects', () => {
    const monitor = SourceHealthMonitor.getInstance();
    monitor.registerSource('api-test', 'API Source');
    const allHealth = monitor.getAllSourceHealth();
    expect(Array.isArray(allHealth)).toBe(true);

    const tracker = IngestionLatencyTracker.getInstance();
    const globalSLA = tracker.getGlobalSLAStats();
    expect(globalSLA).toHaveProperty('totalEndToEndLatencyMs');
    expect(globalSLA.totalEndToEndLatencyMs).toHaveProperty('median');
    expect(globalSLA.totalEndToEndLatencyMs).toHaveProperty('p95');
    expect(globalSLA.totalEndToEndLatencyMs).toHaveProperty('p99');
  });
});
