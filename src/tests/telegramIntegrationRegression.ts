import { TelegramService, maskToken, maskChatId, sanitizeTelegramLog } from '../news/NewsEngine/TelegramService';
import { TelegramNotificationPipeline } from '../news/NewsEngine/TelegramNotificationPipeline';
import { TraderTelegramFormatter } from '../news/NewsEngine/TraderTelegramFormatter';
import { NewsArticleV2 } from '../newsCoreV2/domain/NewsArticle';
import { runTelegramQualityGateRegressionSuite } from '../news/NewsEngine/TelegramQualityGateRegression';
import { TelegramNotificationStateStore } from '../news/NewsEngine/TelegramNotificationStateStore';

export async function runTelegramRegressionSuite(): Promise<{ success: boolean; results: string[] }> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(`[TelegramRegression] ${msg}`);
  };

  log("Starting Telegram Integration & Quality Gate Regression Test Suite...");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      log(`❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // Test 1: Token Masking Functions
  const testToken = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz_12345678";
  const masked = maskToken(testToken);
  assert(masked.startsWith("1234****") && masked.endsWith("5678") && !masked.includes("ABCdefGHI"), "maskToken redacts inner secret key");
  assert(!masked.includes(testToken), "Plain token is not present in masked string");

  const chatId = "-1001234567890";
  const maskedChat = maskChatId(chatId);
  assert(maskedChat.startsWith("-10****") && maskedChat.endsWith("90"), "maskChatId redacts inner digits");

  const logWithToken = `Error connecting to https://api.telegram.org/bot${testToken}/sendMessage`;
  const sanitizedLog = sanitizeTelegramLog(logWithToken, testToken);
  assert(!sanitizedLog.includes(testToken), "sanitizeTelegramLog strips plain bot token from logs");

  // Test 2: Local Config Validation
  const telegramService = TelegramService.getInstance();
  const isValidFormat = telegramService.isLocalConfigValid({
    botToken: testToken,
    chatId: chatId
  });
  assert(isValidFormat === true, "isLocalConfigValid recognizes valid Telegram token and chat ID format");

  const isInvalidPlaceholder = telegramService.isLocalConfigValid({
    botToken: "your_bot_token_here",
    chatId: "123456"
  });
  assert(isInvalidPlaceholder === false, "isLocalConfigValid rejects placeholder tokens");

  // Test 3: Trader Message Formatting
  const mockArticle: NewsArticleV2 = {
    id: `reg_art_${Date.now()}`,
    canonicalUrl: "https://cnbctv18.com/article",
    headline: "Tata Motors Q1 PAT drops 80% YoY to Rs 775 crore on JLR softness",
    body: "Tata Motors reported a steep drop in net profit for Q1. Revenue declined 9% YoY. Options traders expect higher volatility.",
    source: { publisher: "CNBC TV18", url: "https://cnbctv18.com/article", collectionMethod: "RSS" },
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    category: "RESULTS",
    sentiment: "BEARISH",
    relevanceScore: 92,
    fno: {
      eligible: true,
      decision: "INCLUDE",
      symbol: "TATAMOTORS",
      confidence: "HIGH",
      reason: "FNO Stock matched"
    }
  };

  const formattedMsg = TraderTelegramFormatter.format(mockArticle);
  assert(formattedMsg.includes("F&O INTELLIGENCE — TATAMOTORS"), "TraderTelegramFormatter includes stock symbol in title");
  assert(formattedMsg.includes("BEARISH"), "TraderTelegramFormatter includes sentiment indicator");
  assert(formattedMsg.includes("Options Seller Impact:"), "TraderTelegramFormatter includes options seller impact guidance");
  assert(formattedMsg.includes("⚠️ Monitor price and IV reaction"), "TraderTelegramFormatter includes risk warning note");

  // Test 4: Pipeline Processing & Quality Gate Decision Suite
  log("Running 12-Step Quality Gate & Watermark Protection Regression Tests...");
  const qgResult = await runTelegramQualityGateRegressionSuite();
  for (const r of qgResult.results) {
    assert(r.passed, `Quality Gate Test #${r.id} (${r.name}): ${r.reason}`);
  }

  // Test 5: Telemetry Stats and History
  const pipeline = TelegramNotificationPipeline.getInstance();
  const stats = pipeline.getTelemetryStats();
  assert(typeof stats.liveNotifications === "number" && typeof stats.suppressedCount === "number" && typeof stats.digestPendingCount === "number", "Telemetry stats returns accurate quality gate telemetry structure");

  const history = pipeline.getHistory(10);
  assert(history.length > 0, "Pipeline history retains notification telemetry records");

  // Test 6: TelegramNotificationStateStore Persisted States
  const stateStore = TelegramNotificationStateStore.getInstance();
  const testStateKey = "test_art_id:test_chat_id:FO_INTEL";
  stateStore.saveState({
    articleId: "test_art_id",
    chatId: "test_chat_id",
    notificationType: "FO_INTEL",
    decision: "IMMEDIATE",
    status: "FAILED",
    deduplicationKey: testStateKey,
    attemptCount: 1,
    lastError: "Mock Error"
  });

  assert(stateStore.hasState(testStateKey), "StateStore saves state successfully");
  const retrievedState = stateStore.getState(testStateKey);
  assert(retrievedState?.status === "FAILED", "StateStore returns correct state and properties");

  // Test 7: Failed Notification Retry Recovery
  pipeline.clearHistory();

  // Re-save a failed state and push corresponding record to queue
  stateStore.saveState({
    articleId: "test_failed_art",
    chatId: "test_chat_id",
    notificationType: "FO_INTEL",
    decision: "IMMEDIATE",
    status: "FAILED",
    deduplicationKey: "test_failed_art:test_chat_id:FO_INTEL",
    attemptCount: 1
  });

  await pipeline.processArticle({
    id: "test_failed_art",
    headline: "Tata Steel Q1 results beat expectations with 40% jump in profit",
    body: "Tata Steel announces stellar growth.",
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    canonicalUrl: "https://example.com/tata",
    source: { publisher: "CNBC", url: "https://example.com/tata", collectionMethod: "DIRECT" },
    category: "RESULTS",
    sentiment: "BULLISH",
    relevanceScore: 90,
    fno: { eligible: true, symbol: "TATASTEEL", confidence: "HIGH", decision: "INCLUDE", reason: "F&O underlying" }
  });

  // Set the record to FAILED to test retry
  const addedRecord = pipeline.getHistory(1)[0];
  if (addedRecord) {
    addedRecord.status = "FAILED";
  }

  const retryResult = await pipeline.retryFailedNotifications();
  assert(retryResult.processed >= 1, "retryFailedNotifications identifies failed items in queue");

  // Test 8: Compact Digest Template Validation
  pipeline.clearHistory();

  const articleA: NewsArticleV2 = {
    id: "digest_art_a",
    headline: "GRASIM Q1 PAT up 51% YoY to Rs 1200 crore, EBITDA Rs 8077 crore",
    body: "Grasim Industries reports strong performance.",
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    canonicalUrl: "https://example.com/grasim",
    source: { publisher: "CNBC", url: "https://example.com/grasim", collectionMethod: "DIRECT" },
    category: "RESULTS",
    sentiment: "BULLISH",
    relevanceScore: 80,
    fno: { eligible: true, symbol: "GRASIM", confidence: "HIGH", decision: "INCLUDE", reason: "F&O" }
  };

  const articleB: NewsArticleV2 = {
    id: "digest_art_b",
    headline: "Reliance Industries signs green hydrogen pact with European energy major",
    body: "Reliance Industries announced a major clean energy development.",
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    canonicalUrl: "https://example.com/reliance",
    source: { publisher: "CNBC", url: "https://example.com/reliance", collectionMethod: "DIRECT" },
    category: "CORPORATE",
    sentiment: "BULLISH",
    relevanceScore: 75,
    fno: { eligible: true, symbol: "RELIANCE", confidence: "HIGH", decision: "INCLUDE", reason: "F&O" }
  };

  await pipeline.processArticle(articleA);
  await pipeline.processArticle(articleB);

  // Force them to DIGEST_PENDING for testing
  pipeline.getHistory(10).forEach(r => {
    r.status = "DIGEST_PENDING";
  });

  const digestResult = await pipeline.dispatchDigest();
  assert(digestResult.sent === true && digestResult.itemCount >= 1, "dispatchDigest correctly aggregates and dispatches pending items");

  // Test 9: Advanced Telegram API Mocks (Phase 23.5 Verification)
  log("Running Test 9: Advanced Telegram API Mock Scenarios...");
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  let simulateTimeout = false;
  let simulateApiError = false;
  let apiErrorCode = 200;
  let apiErrorDescription = "OK";

  try {
    globalThis.fetch = async (urlObj: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      fetchCallCount++;
      const urlStr = urlObj.toString();

      if (simulateTimeout) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      if (simulateApiError) {
        return new Response(JSON.stringify({
          ok: false,
          description: apiErrorDescription,
          error_code: apiErrorCode
        }), {
          status: apiErrorCode,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (urlStr.includes("/getMe")) {
        return new Response(JSON.stringify({
          ok: true,
          result: { id: 12345678, is_bot: true, first_name: "AthenaBot", username: "athena_forensic_bot" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes("/getChat")) {
        return new Response(JSON.stringify({
          ok: true,
          result: { id: -1001234567890, title: "Athena Trades Alert Channel", type: "channel" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes("/sendMessage")) {
        return new Response(JSON.stringify({
          ok: true,
          result: { message_id: 8881234 }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    // Sub-test A: Successful notification
    simulateTimeout = false;
    simulateApiError = false;
    fetchCallCount = 0;
    const sendResult = await telegramService.sendMessage("Test successful message content", "123456:A-Valid-Token-Format-With-More-Than-30-Chars", "-1001234567890");
    assert(sendResult.success && sendResult.messageId === 8881234, "Sub-test A: Successful notification dispatched and received valid message ID");

    // Sub-test B: API Failure mapping
    simulateApiError = true;
    apiErrorCode = 401;
    apiErrorDescription = "Unauthorized";
    const failResult401 = await telegramService.sendMessage("Test content", "123456:A-Valid-Token-Format-With-More-Than-30-Chars", "-1001234567890");
    assert(!failResult401.success && failResult401.errorCode === "AUTH_FAILED", "Sub-test B: Correctly maps 401 API error to AUTH_FAILED");

    apiErrorCode = 403;
    apiErrorDescription = "Forbidden";
    const failResult403 = await telegramService.sendMessage("Test content", "123456:A-Valid-Token-Format-With-More-Than-30-Chars", "-1001234567890");
    assert(!failResult403.success && failResult403.errorCode === "PERMISSION_DENIED", "Sub-test B: Correctly maps 403 API error to PERMISSION_DENIED");

    // Sub-test C: Timeout & Retry Logic
    simulateApiError = false;
    simulateTimeout = true;
    fetchCallCount = 0;
    const timeoutResult = await telegramService.sendMessage("Test content", "123456:A-Valid-Token-Format-With-More-Than-30-Chars", "-1001234567890");
    assert(!timeoutResult.success && timeoutResult.errorCode === "NETWORK_ERROR", "Sub-test C: Aborts on network timeout");
    assert(fetchCallCount === 2, "Sub-test C: Executed exactly 1 retry (total 2 attempts) on network timeout as expected");

    // Sub-test D: Duplicate suppression verification
    pipeline.clearHistory();
    simulateTimeout = false;
    simulateApiError = false;
    const duplicateArt: NewsArticleV2 = {
      id: "dup_art_test_123",
      headline: "SOLARINDS Q1 PAT up 100% YoY to Rs 1200 crore",
      body: "Outstanding Solar Industries results.",
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      canonicalUrl: "https://example.com/solar",
      source: { publisher: "CNBC", url: "https://example.com/solar", collectionMethod: "DIRECT" },
      category: "RESULTS",
      sentiment: "BULLISH",
      relevanceScore: 90,
      fno: { eligible: true, symbol: "SOLARINDS", confidence: "HIGH", decision: "INCLUDE", reason: "F&O" }
    };
    
    pipeline.setAuditMode(false);
    const proc1 = await pipeline.processArticle(duplicateArt);
    assert(proc1.enqueued && proc1.decision === "IMMEDIATE" && proc1.record?.status === "SENT", "Sub-test D: First instance of material article successfully processed and sent");
    
    const proc2 = await pipeline.processArticle(duplicateArt);
    assert(!proc2.enqueued && proc2.decision === "SUPPRESSED" && proc2.reason?.includes("Duplicate"), "Sub-test D: Second instance of same article is suppressed automatically as a duplicate");

    // Sub-test E: Malformed configuration detection
    const malformedTokenResult = telegramService.getLocalConfigValidationError("invalid_token", "-1001234567890");
    assert(malformedTokenResult !== null && malformedTokenResult.includes("format is invalid"), "Sub-test E: Correctly identifies malformed bot tokens lacking digits/secret structure");

    const placeholderTokenResult = telegramService.getLocalConfigValidationError("your_bot_token_here", "-1001234567890");
    assert(placeholderTokenResult !== null && placeholderTokenResult.includes("forbidden pattern"), "Sub-test E: Correctly identifies and rejects placeholder configuration templates");

    // Sub-test F: Non-blocking failure confirmation
    simulateApiError = true;
    apiErrorCode = 500;
    apiErrorDescription = "Internal Server Error";
    
    const nonBlockingArt: NewsArticleV2 = {
      id: "non_blocking_art_test",
      headline: "TCS secure massive Rs 5000 Crore IT contract in North America",
      body: "TATA Consultancy Services announced the large order win today.",
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      canonicalUrl: "https://example.com/tcs",
      source: { publisher: "CNBC", url: "https://example.com/tcs", collectionMethod: "DIRECT" },
      category: "CORPORATE",
      sentiment: "BULLISH",
      relevanceScore: 90,
      fno: { eligible: true, symbol: "TCS", confidence: "HIGH", decision: "INCLUDE", reason: "F&O" }
    };

    let didThrow = false;
    let pipelineProcResult: any = null;
    try {
      pipelineProcResult = await pipeline.processArticle(nonBlockingArt);
    } catch (e) {
      didThrow = true;
    }
    assert(!didThrow, "Sub-test F: Pipeline execution did not throw synchronous exceptions on API failures (non-blocking thread safety)");
    assert(pipelineProcResult !== null && pipelineProcResult.enqueued === true, "Sub-test F: Article is successfully enqueued and tracked in state store despite physical API delivery failure");

  } finally {
    globalThis.fetch = originalFetch;
    pipeline.setAuditMode(true);
  }

  // Clean up
  pipeline.clearHistory();

  log(`Suite finished: ${passed} passed, ${failed} failed.`);

  return {
    success: failed === 0,
    results: logs
  };
}

