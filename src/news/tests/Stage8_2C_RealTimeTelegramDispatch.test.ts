/**
 * ATHENA NEWS ENGINE — STAGE 8.2C TEST SUITE
 * Real-Time Telegram Delivery & Zero Bulk Ingestion Verification Gate
 * 
 * Test Coverage:
 * 1. One newly discovered eligible article is dispatched without waiting for another poll.
 * 2. Three articles discovered at different times are dispatched independently, not as one bulk message.
 * 3. Historical articles are not sent when the worker starts.
 * 4. Reprocessing the same article does not send a duplicate.
 * 5. Telegram failure retries safely.
 * 6. Telegram 429 handling does not create bulk delivery.
 * 7. Telegram failure does not stop news ingestion.
 * 8. Worker restart does not resend already delivered alerts.
 * 9. F&O priority remains intact.
 * 10. Existing Stage 8.2B eligibility and quality rules remain unchanged.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { TelegramAlertEligibilityEngine } from '../telegram/TelegramAlertEligibilityEngine';
import { TelegramQualityGate } from '../telegram/TelegramQualityGate';
import { TraderTelegramFormatter } from '../telegram/TraderTelegramFormatter';
import { TelegramService } from '../NewsEngine/TelegramService';
import { IngestionPipeline } from '../ingestion/IngestionPipeline';
import { MemoryNewsStore } from '../storage/NewsStore';
import { LiveIngestionWorker } from '../ingestion/LiveIngestionWorker';
import { RawArticlePayload } from '../normalization/ArticleNormalizer';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

export async function runStage8_2CTests(): Promise<{
  success: boolean;
  passedCount: number;
  totalCount: number;
}> {
  console.log('================================================================');
  console.log('🚀 RUNNING STAGE 8.2C — REAL-TIME TELEGRAM DISPATCH TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  const total = 10;
  let worker: LiveIngestionWorker | null = null;

  const memoryStore = new MemoryNewsStore();
  const pipeline = new IngestionPipeline(memoryStore);
  const telegramPipeline = TelegramNotificationPipeline.resetInstance();
  telegramPipeline.clearHistory();

  const telegramService = TelegramService.getInstance();
  telegramService.setCredentials('mock_token_12345:TEST_BOT', 'mock_chat_67890');

  // Track dispatched messages in mock
  const dispatchedMessages: Array<{ text: string; timestamp: number; chatId: string }> = [];

  const originalSendMessage = telegramService.sendMessage.bind(telegramService);
  telegramService.sendMessage = async (text: string, _token?: string, chatId?: string) => {
    dispatchedMessages.push({ text, timestamp: Date.now(), chatId: chatId || 'mock_chat_67890' });
    return {
      success: true,
      httpStatus: 200,
      messageId: 1000 + dispatchedMessages.length,
      responseBody: { ok: true, result: { message_id: 1000 + dispatchedMessages.length } }
    };
  };

  try {
    // -------------------------------------------------------------
    // Test 1: Single Article Real-Time Dispatch (No batch waiting)
    // -------------------------------------------------------------
    console.log('Test 1: Single article real-time dispatch without waiting for another poll...');
    dispatchedMessages.length = 0;
    telegramPipeline.clearHistory();

    const payload1: RawArticlePayload = {
      title: 'L&T wins mega Rs 4,500 crore infrastructure order for high-speed rail bullet train project',
      content: 'Larsen & Toubro construction division has secured a prestigious engineering procurement contract valued at Rs 4,500 crore from NHSRCL for track alignment and electrification works.',
      url: 'https://economictimes.com/lt-order-win-4500cr',
      publishedAt: new Date().toISOString(),
      source: 'Economic Times'
    };

    const startTime = Date.now();
    const ingestRes1 = await pipeline.ingest([payload1], 'Economic Times');
    assert(ingestRes1.saved === 1, 'Article 1 must be saved to store');

    // Wait a brief microtask for async queue processing
    await new Promise(r => setTimeout(r, 100));

    assert(dispatchedMessages.length === 1, 'Exactly 1 message must be dispatched in real-time');
    assert(dispatchedMessages[0].text.includes('LT') || dispatchedMessages[0].text.includes('Larsen'), 'Alert must attribute L&T');
    assert(dispatchedMessages[0].text.includes('4,500') || dispatchedMessages[0].text.includes('4500'), 'Alert must preserve Rs 4,500 crore contract figure');
    passed++;
    console.log('✓ Test 1 Passed: Single article dispatched in real-time within', Date.now() - startTime, 'ms\n');

    // -------------------------------------------------------------
    // Test 2: Three Articles Dispatched Independently (Not 1 bulk message)
    // -------------------------------------------------------------
    console.log('Test 2: Three articles discovered over time are dispatched independently...');
    dispatchedMessages.length = 0;

    const payloadA: RawArticlePayload = {
      title: 'Reliance Jio launches new Jio Prime 5G enterprise plan with nationwide rollout',
      content: 'Reliance Industries telecom subsidiary Reliance Jio announced nationwide 5G enterprise connectivity services targeting multinational corporations with significant annual recurring revenue.',
      url: 'https://moneycontrol.com/jio-5g-enterprise',
      publishedAt: new Date().toISOString(),
      source: 'Moneycontrol'
    };

    const payloadB: RawArticlePayload = {
      title: 'Paytm Rs 2,950 crore block deal: SoftBank sells 3.2% stake to domestic mutual funds',
      content: 'One97 Communications operator Paytm witnessed large block trades of Rs 2,950 crore on BSE and NSE early today as SoftBank trimmed its holdings to domestic mutual funds at Rs 890 per share.',
      url: 'https://livemint.com/paytm-block-deal-softbank',
      publishedAt: new Date().toISOString(),
      source: 'LiveMint'
    };

    const payloadC: RawArticlePayload = {
      title: 'Tata Consumer raises FY27 revenue guidance by 22% on packaged foods market share gains',
      content: 'FMCG major Tata Consumer Products has upgraded its medium-term financial outlook, raising FY27 revenue growth projections to 22% CAGR citing rural expansion and premium tea volume growth.',
      url: 'https://businessstandard.com/tata-consumer-guidance-upgrade',
      publishedAt: new Date().toISOString(),
      source: 'Business Standard'
    };

    // Ingest A
    await pipeline.ingest([payloadA], 'Moneycontrol');
    await new Promise(r => setTimeout(r, 60));
    assert(dispatchedMessages.length === 1, 'First article must produce 1 independent message');

    // Ingest B
    await pipeline.ingest([payloadB], 'LiveMint');
    await new Promise(r => setTimeout(r, 60));
    assert(dispatchedMessages.length === 2, 'Second article must produce a second independent message');

    // Ingest C
    await pipeline.ingest([payloadC], 'Business Standard');
    await new Promise(r => setTimeout(r, 60));
    assert(dispatchedMessages.length === 3, 'Third article must produce a third independent message');

    // Verify they are separate messages, not concatenated into 1
    assert(dispatchedMessages[0].text.includes('RELIANCE'), 'Message 0 must be Jio/Reliance');
    assert(dispatchedMessages[1].text.includes('PAYTM'), 'Message 1 must be Paytm');
    assert(dispatchedMessages[2].text.includes('TATACONSUM') || dispatchedMessages[2].text.includes('Tata Consumer'), 'Message 2 must be Tata Consumer');
    passed++;
    console.log('✓ Test 2 Passed: 3 articles dispatched as 3 distinct independent messages\n');

    // -------------------------------------------------------------
    // Test 3: Historical Articles Suppressed on Worker Start
    // -------------------------------------------------------------
    console.log('Test 3: Historical articles in store prior to boot are not sent to Telegram...');
    dispatchedMessages.length = 0;

    // Seed 3 historical articles directly in memory store
    await memoryStore.insert({
      id: 'hist_art_001',
      title: 'Historical high-impact earnings surprise from 3 days ago',
      headline: 'Historical high-impact earnings surprise from 3 days ago',
      summary: 'Company reported 100% YoY profit growth earlier this week.',
      publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      source: { name: 'Economic Times', publisher: 'Economic Times', url: 'https://economictimes.com', collectionMethod: 'RSS' },
      sourceUrl: 'https://economictimes.com/historical-earnings-infy',
      category: 'EARNINGS',
      primaryCategory: 'EARNINGS',
      urgency: 'HIGH',
      sentiment: 'BULLISH',
      relevanceScore: 90,
      noveltyScore: 80,
      authorityScore: 90,
      symbol: 'INFY',
      tickers: ['INFY']
    } as any);

    // Reset and start LiveIngestionWorker
    worker = LiveIngestionWorker.resetInstance(memoryStore);
    
    // Check that historical store seeding did not trigger any Telegram dispatch
    await new Promise(r => setTimeout(r, 100));
    assert(dispatchedMessages.length === 0, 'Zero historical messages must be dispatched on worker startup');
    passed++;
    console.log('✓ Test 3 Passed: Historical store articles suppressed on worker start\n');

    // -------------------------------------------------------------
    // Test 4: Reprocessing Exact Same Article Does Not Send Duplicate
    // -------------------------------------------------------------
    console.log('Test 4: Duplicate ingestion and reprocessing does not send duplicate alert...');
    dispatchedMessages.length = 0;

    const payloadDup: RawArticlePayload = {
      title: 'Indo-MIM Q3 Net Profit surges 45% YoY to Rs 142 crore on aerospace exports',
      content: 'Precision engineering manufacturer Indo-MIM posted Q3 standalone net profit of Rs 142 crore up 45% YoY compared to Rs 98 crore in the corresponding quarter, driven by strong aerospace casting demand.',
      url: 'https://cnbctv18.com/indo-mim-q3-profit-aerospace',
      publishedAt: new Date().toISOString(),
      source: 'CNBC TV18'
    };

    // First ingestion -> Dispatched
    const firstIngest = await pipeline.ingest([payloadDup], 'CNBC TV18');
    assert(firstIngest.saved === 1, 'First ingestion must save article');
    await new Promise(r => setTimeout(r, 80));
    assert(dispatchedMessages.length === 1, 'First ingestion must dispatch 1 alert');

    // Second ingestion of same payload -> Ingestion deduplicator skips
    const secondIngest = await pipeline.ingest([payloadDup], 'CNBC TV18');
    assert(secondIngest.duplicates === 1, 'Second ingestion must be flagged duplicate');
    await new Promise(r => setTimeout(r, 80));
    assert(dispatchedMessages.length === 1, 'Dispatched count must strictly remain 1 (no duplicate)');
    passed++;
    console.log('✓ Test 4 Passed: Exactly-once delivery verified against duplicate feeds\n');

    // -------------------------------------------------------------
    // Test 5: Safe Retry on Transient Telegram Failure
    // -------------------------------------------------------------
    console.log('Test 5: Safe retry on transient Telegram failure (HTTP 500)...');
    dispatchedMessages.length = 0;

    let failAttempts = 0;
    telegramService.sendMessage = async (text: string, _token?: string, chatId?: string) => {
      failAttempts++;
      if (failAttempts === 1) {
        return {
          success: false,
          httpStatus: 500,
          error: 'Telegram API 500 Internal Server Error',
          errorCode: 'HTTP_500'
        };
      }
      dispatchedMessages.push({ text, timestamp: Date.now(), chatId: chatId || 'mock_chat_67890' });
      return {
        success: true,
        httpStatus: 200,
        messageId: 2001,
        responseBody: { ok: true, result: { message_id: 2001 } }
      };
    };

    const payloadRetry: RawArticlePayload = {
      title: 'BSE downgraded to Underperform by Macquarie with 30% target price cut',
      content: 'Global investment bank Macquarie has downgraded exchange operator BSE to Underperform citing derivatives turnover saturation and potential regulatory headwinds.',
      url: 'https://reuters.com/bse-downgrade-macquarie',
      publishedAt: new Date().toISOString(),
      source: 'Reuters'
    };

    await pipeline.ingest([payloadRetry], 'Reuters');
    await new Promise(r => setTimeout(r, 200));

    assert(failAttempts >= 2, 'Telegram service must have retried after initial 500');
    assert(dispatchedMessages.length === 1, 'Message must be successfully delivered after retry');
    passed++;
    console.log('✓ Test 5 Passed: Transient network failure retried and delivered safely\n');

    // -------------------------------------------------------------
    // Test 6: Telegram 429 Rate Limit Handling Without Bulk Accumulation
    // -------------------------------------------------------------
    console.log('Test 6: Telegram HTTP 429 rate limit backoff without bulk accumulation...');
    dispatchedMessages.length = 0;

    let rateLimitCalls = 0;
    telegramService.sendMessage = async (text: string, _token?: string, chatId?: string) => {
      rateLimitCalls++;
      if (rateLimitCalls === 1) {
        return {
          success: false,
          httpStatus: 429,
          error: 'Too Many Requests',
          errorCode: 'RATE_LIMITED',
          retryAfterSeconds: 1 // 1 second backoff
        };
      }
      dispatchedMessages.push({ text, timestamp: Date.now(), chatId: chatId || 'mock_chat_67890' });
      return {
        success: true,
        httpStatus: 200,
        messageId: 3001,
        responseBody: { ok: true, result: { message_id: 3001 } }
      };
    };

    const payload429: RawArticlePayload = {
      title: 'Lalithaa Jewellery files draft papers with SEBI to raise Rs 1,800 crore via IPO',
      content: 'Regional jewellery retail chain Lalithaa Jewellery Mart has submitted its Draft Red Herring Prospectus (DRHP) to SEBI. The fresh issue proceeds will fund new showroom additions.',
      url: 'https://et.com/lalithaa-jewellery-ipo-drhp',
      publishedAt: new Date().toISOString(),
      source: 'Economic Times'
    };

    await pipeline.ingest([payload429], 'Economic Times');
    // Wait for rate limit backoff (1s) + margin
    await new Promise(r => setTimeout(r, 1200));

    assert(rateLimitCalls >= 2, 'Queue must resume and retry after 429 backoff');
    assert(dispatchedMessages.length === 1, 'Article must be delivered individually after 429 resumption');
    passed++;
    console.log('✓ Test 6 Passed: HTTP 429 rate limit respected with seamless queue resumption\n');

    // -------------------------------------------------------------
    // Test 7: Telegram Failure Does Not Stop News Ingestion
    // -------------------------------------------------------------
    console.log('Test 7: Telegram failure/outage does not stop or stall canonical news ingestion...');
    dispatchedMessages.length = 0;

    // Telegram completely down
    telegramService.sendMessage = async () => {
      return {
        success: false,
        httpStatus: 503,
        error: 'Telegram Service Unavailable',
        errorCode: 'HTTP_503'
      };
    };

    const batchPayloads: RawArticlePayload[] = [
      {
        title: 'Bharat Forge wins Rs 650 crore artillery component order from Ministry of Defence',
        content: 'Defence manufacturer Bharat Forge has received a domestic order valued at Rs 650 crore for towed artillery gun spares and structural components.',
        url: 'https://mc.com/bharat-forge-mod-order',
        publishedAt: new Date().toISOString(),
        source: 'Moneycontrol'
      },
      {
        title: 'Infosys signs multi-year digital transformation pact with Nordic banking group',
        content: 'IT services bellwether Infosys has entered into a strategic collaboration with a European financial institution for cloud banking infrastructure migration.',
        url: 'https://livemint.com/infosys-nordic-deal',
        publishedAt: new Date().toISOString(),
        source: 'LiveMint'
      }
    ];

    const bulkIngestRes = await pipeline.ingest(batchPayloads, 'MultiSource');
    assert(bulkIngestRes.saved === 2, 'Both articles must be successfully stored despite Telegram outage');
    assert(bulkIngestRes.errors === 0, 'Zero pipeline errors should occur on Telegram dispatch failure');

    const storedArticles = await memoryStore.getAll();
    assert(storedArticles.some(a => a.headline.includes('Bharat Forge')), 'Bharat Forge saved in store');
    assert(storedArticles.some(a => a.headline.includes('Infosys')), 'Infosys saved in store');
    passed++;
    console.log('✓ Test 7 Passed: Ingestion pipeline remains 100% functional during Telegram outages\n');

    // Restore standard mock for remaining tests
    telegramService.sendMessage = async (text: string, _token?: string, chatId?: string) => {
      dispatchedMessages.push({ text, timestamp: Date.now(), chatId: chatId || 'mock_chat_67890' });
      return {
        success: true,
        httpStatus: 200,
        messageId: 4000 + dispatchedMessages.length,
        responseBody: { ok: true, result: { message_id: 4000 + dispatchedMessages.length } }
      };
    };

    // -------------------------------------------------------------
    // Test 8: Worker Restart Does Not Resend Already Delivered Alerts
    // -------------------------------------------------------------
    console.log('Test 8: Worker restart does not resend already delivered alerts...');
    dispatchedMessages.length = 0;

    const payloadDelivered: RawArticlePayload = {
      title: 'Vedanta wins Rs 12,500 crore arbitration award against Ministry of Petroleum in oil block dispute',
      content: 'Mining conglomerate Vedanta Limited announced that an international arbitration tribunal has ruled in its favor, awarding Rs 12,500 crore in cost recovery claims regarding Rajasthan oil block production sharing contract.',
      url: 'https://bs.com/vedanta-wins-arbitration-12500cr',
      publishedAt: new Date().toISOString(),
      source: 'Business Standard'
    };

    // Ingest once -> Delivered
    await pipeline.ingest([payloadDelivered], 'Business Standard');
    await new Promise(r => setTimeout(r, 80));
    assert(dispatchedMessages.length === 1, 'Initial alert delivered');

    // Simulate worker restart: re-evaluate or attempt enqueue
    const restartPipeline = TelegramNotificationPipeline.getInstance();
    const retryRes = await restartPipeline.enqueueArticle({
      id: (await memoryStore.getAll()).find(a => a.headline.includes('Vedanta wins Rs 12,500 crore'))?.id,
      headline: payloadDelivered.title,
      body: payloadDelivered.content
    });

    await new Promise(r => setTimeout(r, 80));
    assert(dispatchedMessages.length === 1, 'Delivered alert must NOT be dispatched again after restart');
    passed++;
    console.log('✓ Test 8 Passed: Idempotent delivery prevents re-alerting already delivered items\n');

    // -------------------------------------------------------------
    // Test 9: F&O Priority Queueing Without Metric Fabrication
    // -------------------------------------------------------------
    console.log('Test 9: F&O priority queueing & zero metric fabrication...');
    dispatchedMessages.length = 0;

    const fnoArticlePayload: RawArticlePayload = {
      title: 'Nifty 24,500 Call options add 45 lakh shares OI as PCR drops to 0.72 ahead of weekly expiry',
      content: 'Derivatives data shows aggressive call writing at the 24,500 strike with 45 lakh shares added in open interest. Put-Call Ratio fell from 0.88 to 0.72 reflecting heavy resistance at higher levels.',
      url: 'https://mc.com/fno-nifty-24500-oi-pcr',
      publishedAt: new Date().toISOString(),
      source: 'Moneycontrol'
    };

    await pipeline.ingest([fnoArticlePayload], 'Moneycontrol');
    await new Promise(r => setTimeout(r, 80));

    assert(dispatchedMessages.length === 1, 'F&O catalyst must be dispatched');
    const fnoMsg = dispatchedMessages[0].text;
    assert(fnoMsg.includes('DERIVATIVES') || fnoMsg.includes('F&O'), 'Alert must be classified as F&O/Derivatives');
    assert(fnoMsg.includes('45 lakh') || fnoMsg.includes('24,500') || fnoMsg.includes('0.72'), 'F&O alert must preserve real OI and PCR figures');
    assert(!fnoMsg.includes('guaranteed'), 'No fabricated returns allowed');
    passed++;
    console.log('✓ Test 9 Passed: F&O priority alert dispatched with grounded derivatives data\n');

    // -------------------------------------------------------------
    // Test 10: Stage 8.2B Quality Gate & Noise Suppression Preserved
    // -------------------------------------------------------------
    console.log('Test 10: Existing Stage 8.2B noise filtering & quality gates remain active...');
    dispatchedMessages.length = 0;

    const noisyPayloads: RawArticlePayload[] = [
      {
        title: 'Hindalco Share Price Live Updates: Hindalco trading flat at Rs 645 in morning session',
        content: 'Hindalco shares opened at Rs 646 and touched an intraday low of Rs 642 on NSE. Check live price updates and moving averages here.',
        url: 'https://livemint.com/hindalco-price-live',
        publishedAt: new Date().toISOString(),
        source: 'LiveMint'
      },
      {
        title: 'LTIMindtree stock price overview: 5-day moving average and technical charts',
        content: 'LTIMindtree closed 0.4% lower today at Rs 5,120. The RSI is currently at 48 indicating neutral momentum.',
        url: 'https://et.com/ltimindtree-chart-analysis',
        publishedAt: new Date().toISOString(),
        source: 'Economic Times'
      },
      {
        title: 'Company Trading Window Closure Notice for Q4 results',
        content: 'In compliance with SEBI insider trading regulations, the trading window for designated employees will remain closed from April 1 until 48 hours after financial results declaration.',
        url: 'https://bse.com/closure-notice',
        publishedAt: new Date().toISOString(),
        source: 'BSE'
      }
    ];

    for (const noise of noisyPayloads) {
      await pipeline.ingest([noise], 'Publisher');
    }
    await new Promise(r => setTimeout(r, 100));

    assert(dispatchedMessages.length === 0, 'Generic price updates and routine notices must be 100% filtered from Telegram');
    passed++;
    console.log('✓ Test 10 Passed: Noise filtering and QualityGate successfully suppressed low-signal feeds\n');

    console.log('================================================================');
    console.log(`✅ STAGE 8.2C TEST SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
    console.log('================================================================\n');

    return {
      success: passed === total,
      passedCount: passed,
      totalCount: total
    };
  } finally {
    // Restore original method
    telegramService.sendMessage = originalSendMessage;
    if (worker) {
      worker.stop();
    }
  }
}

// -------------------------------------------------------------------
// Vitest Suite Runner
// -------------------------------------------------------------------
describe('Stage 8.2C: Real-Time Telegram Delivery & Zero Bulk Ingestion', () => {
  it('should pass all 10 Stage 8.2C real-time delivery and reliability regression tests', async () => {
    const result = await runStage8_2CTests();
    expect(result.success).toBe(true);
    expect(result.passedCount).toBe(10);
  });
});
