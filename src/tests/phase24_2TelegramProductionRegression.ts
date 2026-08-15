import { TelegramNotificationPipeline } from '../news/NewsEngine/TelegramNotificationPipeline';
import { TelegramNotificationStateStore } from '../news/NewsEngine/TelegramNotificationStateStore';
import { TelegramService } from '../news/NewsEngine/TelegramService';
import { NewsArticleV2 } from '../newsCoreV2/domain/NewsArticle';

export async function runPhase24_2RegressionSuite(): Promise<{ success: boolean; results: string[] }> {
  console.log("=== RUNNING PHASE 24.2 TELEGRAM PRODUCTION REGRESSION SUITE ===");
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      const msg = `[Phase 24.2] ✅ PASS: ${desc}`;
      results.push(msg);
      console.log(msg);
      passed++;
    } else {
      const msg = `[Phase 24.2] ❌ FAIL: ${desc}`;
      results.push(msg);
      console.log(msg);
      failed++;
    }
  }

  const pipeline = TelegramNotificationPipeline.getInstance();
  const stateStore = TelegramNotificationStateStore.getInstance();
  const telegramService = TelegramService.getInstance();
  const creds = telegramService.getCredentials();
  const chatId = creds.chatId || 'DEFAULT_CHAT';

  const wasAudit = pipeline.getAuditMode();
  pipeline.setAuditMode(true);

  // Clear state for clean testing
  pipeline.clearHistory();
  stateStore.clear();
  stateStore.saveToDisk();

  // Test 1: Deduplication & Replay Protection
  try {
    const article: NewsArticleV2 = {
      id: "p24_2_test_dup",
      headline: "RELIANCE Q1 results: Net Profit surges 20% to ₹15000 Crore exceeding all brokerages estimates",
      body: "Reliance Industries announced stellar results.",
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      canonicalUrl: "https://example.com/reliance_dup",
      source: { publisher: "CNBC", url: "https://example.com/reliance_dup", collectionMethod: "RSS" },
      category: "RESULTS",
      sentiment: "BULLISH",
      relevanceScore: 95,
      fno: { eligible: true, symbol: "RELIANCE", confidence: "HIGH", decision: "INCLUDE", reason: "F&O" }
    };

    // First process
    const res1 = await pipeline.processArticle(article);
    assert(res1.enqueued === true && res1.decision === 'IMMEDIATE', "First evaluation dispatches immediately");

    // Second process
    const res2 = await pipeline.processArticle(article);
    assert(res2.enqueued === false && res2.reason === 'DUPLICATE_SUPPRESSED', "Subsequent duplicate evaluation is safely suppressed");
  } catch (e: any) {
    assert(false, `Test 1 failed: ${e.message}`);
  }

  // Test 2: Persist-First / Dispatch-Second sequence
  try {
    const stateKey = `p24_2_test_dup:${chatId}:FO_INTEL`;
    const state = stateStore.getState(stateKey);
    assert(state !== undefined && state.status === 'SENT', "Atomic state is persisted to StateStore successfully");
  } catch (e: any) {
    assert(false, `Test 2 failed: ${e.message}`);
  }

  // Test 3: IMMEDIATE Rate Limits (Circuit Breaker) & relocation to DIGEST_PENDING
  try {
    // Clear history to start clean
    pipeline.clearHistory();

    // We send 4 different articles within 10 seconds.
    // Limit is 3/minute. The 4th should be relocated to DIGEST_PENDING.
    for (let i = 1; i <= 4; i++) {
      const art: NewsArticleV2 = {
        id: `p24_2_cb_art_${i}`,
        headline: `TATASTEEL results #${i}: Net Profit jumps ${15 * i}% to ₹${4000 + 500 * i} Crore beating estimates`,
        body: "Tata Steel financial impact details.",
        publishedAt: new Date().toISOString(),
        collectedAt: new Date().toISOString(),
        canonicalUrl: `https://example.com/tata_${i}`,
        source: { publisher: "Bloomberg", url: `https://example.com/tata_${i}`, collectionMethod: "RSS" },
        category: "RESULTS",
        sentiment: "BULLISH",
        relevanceScore: 95,
        fno: { eligible: true, symbol: "TATASTEEL", confidence: "HIGH", decision: "INCLUDE", reason: "F&O" }
      };

      const res = await pipeline.processArticle(art);
      if (i <= 3) {
        assert(res.decision === 'IMMEDIATE', `Article #${i} within rate limit is IMMEDIATE`);
      } else {
        assert(res.decision === 'DIGEST_PENDING', "Article #4 exceeding rate limit of 3/minute is relocated to DIGEST_PENDING");
      }
    }
  } catch (e: any) {
    assert(false, `Test 3 failed: ${e.message}`);
  }

  // Test 4: Failed notification retention of original deduplication key & retry recovery producing exactly one success
  try {
    pipeline.clearHistory();
    const testFailedId = "p24_2_test_failed";
    const dedupKey = `${testFailedId}:${chatId}:FO_INTEL`;

    const art: NewsArticleV2 = {
      id: testFailedId,
      headline: "INFY Q1 net profit increases 10% to ₹6000 Crore beating consensus",
      body: "Infosys reports positive metrics.",
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      canonicalUrl: "https://example.com/infy",
      source: { publisher: "CNBC", url: "https://example.com/infy", collectionMethod: "RSS" },
      category: "RESULTS",
      sentiment: "BULLISH",
      relevanceScore: 95,
      fno: { eligible: true, symbol: "INFY", confidence: "HIGH", decision: "INCLUDE", reason: "F&O" }
    };

    // First process to seed the in-memory records and state store
    const initialRes = await pipeline.processArticle(art);
    assert(initialRes.enqueued === true && initialRes.decision === 'IMMEDIATE', "Initial processing succeeds and enqueues");

    // Force its state to FAILED in both stateStore and queueRecord
    stateStore.saveState({
      articleId: testFailedId,
      chatId: chatId,
      notificationType: "FO_INTEL",
      decision: "IMMEDIATE",
      status: "FAILED",
      deduplicationKey: dedupKey,
      attemptCount: 1,
      lastError: "Mock Gateway Timeout"
    });

    const queueRecord = pipeline.getHistory().find(r => r.dedupKey === dedupKey);
    if (queueRecord) {
      queueRecord.status = 'FAILED';
    }

    // Process again -> should block and return ALREADY_FAILED
    const res = await pipeline.processArticle(art);
    assert(res.enqueued === false && res.reason === 'ALREADY_FAILED', "ProcessArticle respects existing failed status and doesn't double-send");

    // Now trigger retry
    const retryRes = await pipeline.retryFailedNotifications();
    assert(retryRes.processed >= 1, "Retry mechanism picks up failed notifications");
    
    // Check that it's now SENT
    const updatedState = stateStore.getState(dedupKey);
    assert(updatedState?.status === 'SENT', "Successful retry updates state to SENT exactly once");
  } catch (e: any) {
    assert(false, `Test 4 failed: ${e.message}`);
  }

  pipeline.clearHistory();
  pipeline.setAuditMode(wasAudit);
  console.log(`Phase 24.2 Results: ${passed} passed, ${failed} failed.`);

  return {
    success: failed === 0,
    results
  };
}

if (process.argv[1] && process.argv[1].endsWith('phase24_2TelegramProductionRegression.ts')) {
  runPhase24_2RegressionSuite().then(res => {
    process.exit(res.success ? 0 : 1);
  });
}
