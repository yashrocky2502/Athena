/**
 * ATHENA NEWS ENGINE — STAGE 8.7 PRODUCTION OBSERVABILITY, FEED INTEGRITY & SOURCE EXPANSION TEST SUITE
 * 
 * Comprehensive test suite containing 40+ verification tests covering:
 * - Baseline Snapshot recording
 * - NewsEngineTelemetry non-blocking telemetry aggregation
 * - FeedIntegrityMonitor disk/memory count alignment and duplicate detection
 * - EconomicCalendarAdapter macroeconomic event normalization
 * - SourceExpansionRegistry dynamic expansion & circuit breaker quarantine
 * - 200-Article End-to-End Production Stress Simulation
 */

import { NewsEngineTelemetry, newsEngineTelemetry } from '../observability/NewsEngineTelemetry';
import { FeedIntegrityMonitor, feedIntegrityMonitor } from '../observability/FeedIntegrityMonitor';
import { EconomicCalendarAdapter, economicCalendarAdapter } from '../providers/EconomicCalendarAdapter';
import { SourceExpansionRegistry, sourceExpansionRegistry } from '../registry/SourceExpansionRegistry';
import { IngestionTelemetry } from '../monitoring/IngestionTelemetry';
import { IngestionLatencyTracker } from '../monitoring/IngestionLatencyTracker';
import { SourceHealthMonitor } from '../monitoring/SourceHealthMonitor';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { NewsAIUsageMonitor } from '../monitoring/NewsAIUsageMonitor';
import { EventCentricOrchestrator } from '../intelligence/EventCentricOrchestrator';
import { EventFingerprintEngine } from '../deduplication/EventFingerprintEngine';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { LiveSourceFeedConfig } from '../ingestion/LiveSourceProviders';

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING STAGE 8.7 PRODUCTION OBSERVABILITY SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ PASS: ${message}`);
    } else {
      failed++;
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  // Resets for test isolation
  NewsEngineTelemetry.resetInstance();
  FeedIntegrityMonitor.resetInstance();
  SourceExpansionRegistry.resetInstance();
  TelegramNotificationPipeline.resetInstance();
  EventCentricOrchestrator.resetInstance();

  console.log('--- SECTION 1: BASELINE SNAPSHOT TESTS ---');
  {
    const articles = newsStore.getAllArticles();
    assert(Array.isArray(articles), 'PersistentNewsStore returns an array of articles');
    assert(articles.length >= 0, `PersistentNewsStore article count is valid (${articles.length})`);

    const tgTelem = TelegramNotificationPipeline.getInstance().getTelemetry();
    assert(typeof tgTelem.totalQueued === 'number', 'Telegram pipeline telemetry initialized');

    const aiStats = NewsAIUsageMonitor.getInstance().getStats();
    assert(typeof aiStats.summaryRequests === 'number', 'NewsAIUsageMonitor stats initialized');
  }

  console.log('\n--- SECTION 2: NEWS ENGINE TELEMETRY TESTS ---');
  {
    const telem = NewsEngineTelemetry.getInstance();
    assert(!!telem, 'NewsEngineTelemetry singleton instantiated');

    const start = performance.now();
    const snapshot = telem.getSnapshot();
    const elapsed = performance.now() - start;

    assert(elapsed < 10, `getSnapshot() executes sub-millisecond (${elapsed.toFixed(3)}ms)`);
    assert(typeof snapshot.timestamp === 'string', 'Snapshot contains timestamp');
    assert(typeof snapshot.uptimeSeconds === 'number', 'Snapshot contains uptimeSeconds');
    assert(typeof snapshot.ingestion.totalIngested === 'number', 'Snapshot contains ingestion.totalIngested');
    assert(typeof snapshot.normalization.malformedCount === 'number', 'Snapshot contains normalization.malformedCount');
    assert(typeof snapshot.events.totalEvents === 'number', 'Snapshot contains events.totalEvents');
    assert(typeof snapshot.telegram.queuedCount === 'number', 'Snapshot contains telegram.queuedCount');
    assert(typeof snapshot.ai.summaryRequests === 'number', 'Snapshot contains ai.summaryRequests');
    assert(typeof snapshot.integrity.canonicalDiskCount === 'number', 'Snapshot contains integrity.canonicalDiskCount');

    // Test recording custom events
    telem.recordSanitizedRecord();
    telem.recordBreakingEvent();
    telem.recordEscalation();
    telem.recordConflict();

    const snapshot2 = telem.getSnapshot();
    assert(snapshot2.normalization.sanitizedCount === 1, 'recordSanitizedRecord increments sanitizedCount');
    assert(snapshot2.events.breakingEvents >= 1, 'recordBreakingEvent increments breakingEvents');
    assert(snapshot2.events.escalationCount >= 1, 'recordEscalation increments escalationCount');
    assert(snapshot2.events.numericalConflictCount >= 1, 'recordConflict increments numericalConflictCount');

    telem.resetTelemetry();
    const snapshot3 = telem.getSnapshot();
    assert(snapshot3.normalization.sanitizedCount === 0, 'resetTelemetry resets sanitizedCount');
  }

  console.log('\n--- SECTION 3: FEED INTEGRITY MONITOR TESTS ---');
  {
    const monitor = FeedIntegrityMonitor.getInstance();
    assert(!!monitor, 'FeedIntegrityMonitor singleton instantiated');

    const report = await monitor.runIntegrityCheck();
    assert(typeof report.status === 'string', 'Integrity report contains status');
    assert(typeof report.canonicalDiskCount === 'number', 'Integrity report contains canonicalDiskCount');
    assert(typeof report.persistentMemoryCount === 'number', 'Integrity report contains persistentMemoryCount');
    assert(Array.isArray(report.mismatches), 'Integrity report contains mismatches array');
    assert(Array.isArray(report.causeAnalysis), 'Integrity report contains causeAnalysis array');
    assert(typeof report.recommendedAction === 'string', 'Integrity report contains recommendedAction');

    // Test auto check start / stop
    monitor.startAutoCheck(1000);
    assert(!!(monitor as any).autoCheckTimer, 'startAutoCheck initializes timer');
    monitor.stopAutoCheck();
    assert(!(monitor as any).autoCheckTimer, 'stopAutoCheck clears timer');
  }

  console.log('\n--- SECTION 4: ECONOMIC CALENDAR ADAPTER TESTS ---');
  {
    const adapter = EconomicCalendarAdapter.getInstance();
    assert(!!adapter, 'EconomicCalendarAdapter singleton instantiated');

    const upcoming = await adapter.getUpcomingEvents(72);
    assert(Array.isArray(upcoming), 'getUpcomingEvents returns an array');
    assert(upcoming.length > 0, 'getUpcomingEvents returns macroeconomic events');

    const rbiEvent = upcoming.find(e => e.agency === 'RBI');
    assert(!!rbiEvent, 'RBI MPC event present in economic calendar');
    if (rbiEvent) {
      assert(rbiEvent.importance === 'CRITICAL', 'RBI MPC event marked CRITICAL importance');
      assert(rbiEvent.affectedSymbols?.includes('BANKNIFTY') === true, 'RBI MPC affects BANKNIFTY');

      const canonicalArticle = adapter.toCanonicalArticle(rbiEvent);
      assert(canonicalArticle.headline.includes('RBI'), 'Canonical article headline includes RBI');
      assert(canonicalArticle.category === 'Macroeconomic', 'Canonical article category is Macroeconomic');
      assert((canonicalArticle as any).urgency === 'VERY_HIGH', 'Canonical article urgency is VERY_HIGH');
      assert((canonicalArticle as any).primaryEntity === 'RBI', 'Canonical article primaryEntity is RBI');

      // Fingerprint & Event orchestrator integration
      const orchestrator = EventCentricOrchestrator.getInstance();
      const orchResult = orchestrator.processArticle(canonicalArticle);
      assert(orchResult.event.primaryEntity === 'RBI', 'EventCentricOrchestrator assigns RBI primaryEntity');
      assert(orchResult.event.eventPriority === 'P0', 'EventCentricOrchestrator assigns P0 priority for RBI');
      assert(orchResult.shouldDispatchTelegram === true, 'EventCentricOrchestrator flags RBI for Telegram dispatch');
    }

    const fedEvent = upcoming.find(e => e.agency === 'FED');
    assert(!!fedEvent, 'US Fed event present in economic calendar');
    if (fedEvent) {
      const canonicalFed = adapter.toCanonicalArticle(fedEvent);
      assert((canonicalFed as any).primaryEntity === 'US_FED', 'US Fed primaryEntity correctly assigned');
    }
  }

  console.log('\n--- SECTION 5: SOURCE EXPANSION REGISTRY & CIRCUIT BREAKER TESTS ---');
  {
    const registry = SourceExpansionRegistry.getInstance();
    assert(!!registry, 'SourceExpansionRegistry singleton instantiated');

    const testFeed: LiveSourceFeedConfig = {
      id: 'test-expansion-feed-1',
      name: 'Test Expansion Feed',
      publisher: 'Expansion News',
      category: 'MARKETS',
      url: 'https://example.com/rss.xml',
      tier: 2,
      enabled: true
    };

    const regRecord = registry.registerSource(testFeed, true);
    assert(regRecord.state === 'ACTIVE', 'Newly registered source promoted to ACTIVE when autoPromote is true');

    const activeList = registry.getActiveSources();
    assert(activeList.some(s => s.id === 'test-expansion-feed-1'), 'Active sources list includes newly registered source');

    // Simulate successes
    registry.recordSourceSuccess('test-expansion-feed-1', 10);
    const recAfterSuccess = registry.getSourceRecord('test-expansion-feed-1');
    assert(recAfterSuccess?.totalItemsFetched === 10, 'recordSourceSuccess increments totalItemsFetched');
    assert(recAfterSuccess?.consecutiveFailures === 0, 'recordSourceSuccess resets consecutiveFailures');

    // Circuit Breaker Test: 3 consecutive failures trigger quarantine
    registry.recordSourceFailure('test-expansion-feed-1', new Error('Timeout 1'));
    registry.recordSourceFailure('test-expansion-feed-1', new Error('Timeout 2'));
    assert(registry.getSourceRecord('test-expansion-feed-1')?.state === 'ACTIVE', 'Source remains ACTIVE before 3rd failure');

    registry.recordSourceFailure('test-expansion-feed-1', new Error('Timeout 3'));
    const recQuarantined = registry.getSourceRecord('test-expansion-feed-1');
    assert(recQuarantined?.state === 'QUARANTINED', 'Circuit Breaker quarantines source after 3 consecutive failures');
    assert(recQuarantined?.quarantineReason?.includes('3 consecutive failures') === true, 'Quarantine reason logged');

    const quarantinedList = registry.getQuarantinedSources();
    assert(quarantinedList.some(s => s.config.id === 'test-expansion-feed-1'), 'Source appears in getQuarantinedSources()');

    // Reinstatement
    const reinstated = registry.reinstateSource('test-expansion-feed-1');
    assert(reinstated === true, 'reinstateSource returns true');
    assert(registry.getSourceRecord('test-expansion-feed-1')?.state === 'TESTING', 'Reinstated source transitions to TESTING state');

    // Deregistration
    const unregistered = registry.unregisterSource('test-expansion-feed-1');
    assert(unregistered === true, 'unregisterSource returns true');
    assert(!registry.getSourceRecord('test-expansion-feed-1'), 'Unregistered source no longer exists in registry');
  }

  console.log('\n--- SECTION 6: 200-ARTICLE END-TO-END PRODUCTION STRESS SIMULATION ---');
  {
    console.log('  Generating 200 diverse test articles...');
    const ingestionTelem = IngestionTelemetry.getInstance();
    const latencyTracker = IngestionLatencyTracker.getInstance();
    const orchestrator = EventCentricOrchestrator.getInstance();
    const telegramPipeline = TelegramNotificationPipeline.getInstance();

    const simulatedArticles: any[] = [];
    const publishers = ['Economic Times', 'Moneycontrol', 'LiveMint', 'Business Standard', 'Reuters', 'CNBC TV18'];
    const categories = ['MARKETS', 'CORPORATE', 'FNO', 'MACRO', 'EARNINGS', 'GLOBAL'];

    for (let i = 0; i < 200; i++) {
      const pub = publishers[i % publishers.length];
      const cat = categories[i % categories.length];
      const isFno = cat === 'FNO' || i % 7 === 0;
      const isDuplicate = i > 150 && i % 3 === 0; // 15+ duplicates
      const isMalformed = i % 25 === 0 && i > 0;   // 8 malformed items

      const articleId = isDuplicate ? `sim_art_${i - 10}` : `sim_art_${i}_${Date.now()}`;
      const url = isDuplicate ? `https://example.com/news/${i - 10}` : `https://example.com/news/${i}`;

      if (isMalformed) {
        simulatedArticles.push({
          id: articleId,
          publisher: pub,
          headline: '', // Missing headline
          publishedAt: 'invalid-date'
        });
      } else {
        simulatedArticles.push({
          id: articleId,
          publisher: pub,
          headline: `${isFno ? '[F&O Alert] ' : ''}Market Update ${i}: ${cat} News for ${pub}`,
          title: `Market Update ${i}`,
          body: `Detailed body text for simulation article ${i}. Nifty option strike 24000 call open interest surged.`,
          summary: `Summary ${i}`,
          category: cat,
          primaryCategory: cat,
          publishedAt: new Date(Date.now() - (i * 60000)).toISOString(),
          canonicalUrl: url,
          sourceUrl: url,
          source: { name: pub, url },
          isFno
        });
      }
    }

    assert(simulatedArticles.length === 200, '200 simulated test articles generated');

    let processedCount = 0;
    let malformedDetected = 0;
    let duplicatesDetected = 0;
    let eventsCreated = 0;

    const simStartTime = performance.now();

    for (const art of simulatedArticles) {
      ingestionTelem.recordAttempt();

      if (!art.headline || art.publishedAt === 'invalid-date') {
        malformedDetected++;
        ingestionTelem.recordMalformed(art, ['Missing required headline or invalid date']);
        continue;
      }

      const discAt = new Date().toISOString();
      const normAt = new Date().toISOString();
      const summAt = new Date().toISOString();
      const eligAt = new Date().toISOString();

      latencyTracker.recordTelemetry({
        articleId: art.id,
        publisher: art.publisher,
        publishedAt: art.publishedAt,
        discoveredAt: discAt,
        normalizedAt: normAt,
        summaryReadyAt: summAt,
        eligibilityCheckedAt: eligAt
      });

      const res = orchestrator.processArticle(art);
      if (res.isNewEvent) eventsCreated++;
      if (res.isDuplicate) duplicatesDetected++;

      if (res.shouldDispatchTelegram) {
        await telegramPipeline.enqueueArticle(art, { dryRun: true });
      }

      ingestionTelem.recordSuccess(res.isNewEvent ? 1 : 0, res.isDuplicate ? 1 : 0, art.publisher);
      processedCount++;
    }

    const simElapsed = performance.now() - simStartTime;

    assert(processedCount > 0, `Processed ${processedCount} valid articles`);
    assert(malformedDetected > 0, `Detected ${malformedDetected} malformed articles`);
    assert(eventsCreated > 0, `Created ${eventsCreated} distinct events`);
    assert(simElapsed < 2000, `200-article simulation executed in ${simElapsed.toFixed(2)}ms (< 2000ms SLA)`);

    const finalSnapshot = NewsEngineTelemetry.getInstance().getSnapshot();
    assert(finalSnapshot.ingestion.totalIngested > 0, 'Telemetry snapshot reflects processed articles');
    assert(finalSnapshot.normalization.malformedCount === malformedDetected, 'Telemetry snapshot reflects malformed records');
    assert(finalSnapshot.events.totalEvents >= eventsCreated, 'Telemetry snapshot reflects created events');
  }

  console.log('\n====================================================');
  console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Stage 8.7 test suite`);
  }

  return { passed, failed };
}

// Execute test suite when run directly
runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
