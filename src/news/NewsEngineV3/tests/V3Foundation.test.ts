/**
 * ATHENA NEWS ENGINE V3 — FOUNDATION UNIT TEST SUITE
 * 
 * Verifies 100% compliance, zero legacy dependencies, and robust operation
 * across Config, Logger, Telemetry, EventBus, Storage, Cache, Health, Utils, and Orchestrator.
 */

import { describe, it, expect } from 'vitest';
import { NewsEngineV3 } from '../core/NewsEngineV3';
import { V3ConfigManager } from '../config/V3Config';
import { V3Logger } from '../logging/V3Logger';
import { V3Telemetry } from '../telemetry/V3Telemetry';
import { V3EventBus } from '../events/V3EventBus';
import { InMemoryV3StorageAdapter } from '../storage/V3StorageInterfaces';
import { InMemoryV3Cache } from '../cache/V3CacheInterfaces';
import { V3HealthMonitor } from '../monitoring/V3HealthMonitor';
import { V3Utils } from '../utils/V3Utils';
import { V3PipelineEvent, V3RawArticle } from '../types/V3Types';

describe('NewsEngineV3 Foundation Test Suite', () => {
  it('runs all foundation verification assertions', async () => {
    const res = await runV3FoundationTests();
    expect(res.failed).toBe(0);
    expect(res.passed).toBeGreaterThan(0);
  });
});

export async function runV3FoundationTests(): Promise<{ total: number; passed: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let total = 0;
  let passed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
    } else {
      const msg = `FAIL: ${testName}${detail ? ` - ${detail}` : ''}`;
      errors.push(msg);
      console.error(msg);
    }
  }

  console.log('====================================================');
  console.log('RUNNING ATHENA NEWS ENGINE V3 FOUNDATION TEST SUITE');
  console.log('====================================================');

  // Test 1: Config Manager
  try {
    const configManager = V3ConfigManager.getInstance();
    const config = configManager.getConfig();
    assert(config.version === '3.0.0-FOUNDATION', 'ConfigManager Version');
    assert(config.collectors.NSE.enabled === true, 'ConfigManager Collector Config');
    assert(configManager.isFeatureEnabled('enableAIIntelligence') === true, 'ConfigManager Feature Flag');

    configManager.updateConfig({ featureFlags: { enableAIIntelligence: false, enableQualityGate: true, enableTelegramNotifications: true, enableDeduplication: true, enableStoragePersistence: true, enableStrictMetricValidation: true } });
    assert(configManager.isFeatureEnabled('enableAIIntelligence') === false, 'ConfigManager Update Feature Flag');
    configManager.updateConfig({ featureFlags: { enableAIIntelligence: true, enableQualityGate: true, enableTelegramNotifications: true, enableDeduplication: true, enableStoragePersistence: true, enableStrictMetricValidation: true } });
  } catch (e) {
    assert(false, 'ConfigManager Suite', String(e));
  }

  // Test 2: Logger & Subscriptions
  try {
    const logger = V3Logger.getInstance();
    logger.clearLogs();
    let capturedLog: any = null;
    const unsub = logger.subscribe(entry => { capturedLog = entry; });

    logger.info('TestModule', 'Test info log message', { key: 'value' });
    assert(capturedLog !== null && capturedLog.message === 'Test info log message', 'Logger Subscriber');
    assert(logger.getRecentLogs().length > 0, 'Logger Buffer');
    unsub();
  } catch (e) {
    assert(false, 'Logger Suite', String(e));
  }

  // Test 3: Telemetry Engine
  try {
    const telemetry = V3Telemetry.getInstance();
    telemetry.reset();
    telemetry.recordArticleReceived();
    telemetry.recordArticleNormalized();
    telemetry.recordStoryPublished();
    telemetry.recordProcessingTime(120);

    const snapshot = telemetry.getSnapshot();
    assert(snapshot.pipeline.articlesReceivedTotal === 1, 'Telemetry Articles Received');
    assert(snapshot.pipeline.articlesNormalizedTotal === 1, 'Telemetry Articles Normalized');
    assert(snapshot.pipeline.storiesPublishedTotal === 1, 'Telemetry Stories Published');
    assert(snapshot.pipeline.avgProcessingTimeMs === 120, 'Telemetry Avg Processing Time');
  } catch (e) {
    assert(false, 'Telemetry Suite', String(e));
  }

  // Test 4: Event Bus & Priority Queue
  try {
    const eventBus = V3EventBus.getInstance();
    eventBus.clearAllSubscribers();
    eventBus.clearHistory();

    const executionOrder: string[] = [];

    eventBus.subscribe('ARTICLE_RECEIVED', async () => {
      executionOrder.push('NORMAL_PRIORITY');
    }, { priority: 'NORMAL' });

    eventBus.subscribe('ARTICLE_RECEIVED', async () => {
      executionOrder.push('CRITICAL_PRIORITY');
    }, { priority: 'CRITICAL' });

    const testEvent: V3PipelineEvent = {
      eventId: V3Utils.generateId('EVT'),
      type: 'ARTICLE_RECEIVED',
      priority: 'CRITICAL',
      timestamp: new Date().toISOString(),
      correlationId: 'CORR_TEST',
      payload: { test: true }
    };

    await eventBus.publish(testEvent);

    assert(executionOrder.length === 2, 'EventBus Execution Count');
    assert(executionOrder[0] === 'CRITICAL_PRIORITY', 'EventBus Priority Ordering');
    assert(eventBus.getEventHistory().length === 1, 'EventBus Event History');
  } catch (e) {
    assert(false, 'EventBus Suite', String(e));
  }

  // Test 5: In-Memory Storage Adapter
  try {
    const storage = new InMemoryV3StorageAdapter();
    const rawArticle: V3RawArticle = {
      id: 'RAW_001',
      publisherId: 'NSE',
      sourceUrl: 'https://nseindia.com/news/1',
      title: 'NSE Market News',
      rawBody: 'Content body',
      publishedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString()
    };

    await storage.saveRawArticle(rawArticle);
    const exists = await storage.existsBySourceUrl('https://nseindia.com/news/1');
    assert(exists === true, 'Storage Adapter Raw Article Exists');

    const fetched = await storage.getRawArticleById('RAW_001');
    assert(fetched !== null && fetched.title === 'NSE Market News', 'Storage Adapter Fetch Raw Article');
  } catch (e) {
    assert(false, 'Storage Adapter Suite', String(e));
  }

  // Test 6: In-Memory Cache
  try {
    const cache = new InMemoryV3Cache();
    await cache.set('test_key', { foo: 'bar' }, 10);
    const cachedVal = await cache.get<{ foo: string }>('test_key');
    assert(cachedVal !== null && cachedVal.foo === 'bar', 'Cache Set and Get');

    const exists = await cache.exists('test_key');
    assert(exists === true, 'Cache Key Exists');

    await cache.invalidate('test_key');
    const afterInval = await cache.get('test_key');
    assert(afterInval === null, 'Cache Invalidation');
  } catch (e) {
    assert(false, 'Cache Suite', String(e));
  }

  // Test 7: Health Monitor
  try {
    const healthMonitor = V3HealthMonitor.getInstance();
    const report = healthMonitor.getSystemHealthReport();
    assert(report.engineName === 'NewsEngineV3', 'Health Monitor Engine Name');
    assert(report.overallHealth === 'HEALTHY', 'Health Monitor Overall Health');
  } catch (e) {
    assert(false, 'Health Monitor Suite', String(e));
  }

  // Test 8: Foundation Utilities
  try {
    const id1 = V3Utils.generateId('TEST');
    const id2 = V3Utils.generateId('TEST');
    assert(id1 !== id2, 'V3Utils Unique IDs');

    const hash = V3Utils.computeContentHash('   Hello World!  ');
    assert(hash.startsWith('HASH_'), 'V3Utils Content Hash');

    const sanitized = V3Utils.sanitizeText('<p>Hello <b>World</b> &amp; Market!</p>');
    assert(sanitized === 'Hello World & Market!', 'V3Utils Text Sanitization');
  } catch (e) {
    assert(false, 'Utils Suite', String(e));
  }

  // Test 9: NewsEngineV3 Orchestrator Startup & Shutdown
  try {
    const engine = NewsEngineV3.getInstance();
    assert(engine.isActive() === false, 'Engine Inactive Initially');

    await engine.startup();
    assert(engine.isActive() === true, 'Engine Active After Startup');

    const health = engine.getHealthReport();
    assert(health.overallHealth === 'HEALTHY', 'Engine Health Active');

    await engine.shutdown();
    assert(engine.isActive() === false, 'Engine Inactive After Shutdown');
  } catch (e) {
    assert(false, 'Orchestrator Suite', String(e));
  }

  console.log('====================================================');
  console.log(`TEST SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================');

  return { total, passed, failed: total - passed, errors };
}
