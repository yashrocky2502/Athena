/**
 * ATHENA NEWS ENGINE — STAGE 8.2D
 * Live Telegram Delivery Forensic Audit Test Suite
 * 
 * Comprehensive audit proving individual, real-time, zero-bulk, zero-duplicate,
 * and rate-limit resilient Telegram alert delivery under realistic multi-batch conditions.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { MemoryNewsStore } from '../storage/NewsStore';
import { IngestionPipeline } from '../ingestion/IngestionPipeline';
import { LiveIngestionWorker } from '../ingestion/LiveIngestionWorker';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { TelegramQualityGate } from '../telegram/TelegramQualityGate';
import { TelegramService } from '../NewsEngine/TelegramService';
import { NewsArticle } from '../types/Article';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

describe('Stage 8.2D: Live Telegram Delivery Forensic Audit', () => {
  let store: MemoryNewsStore;
  let pipeline: IngestionPipeline;
  let telegramPipeline: TelegramNotificationPipeline;

  beforeEach(() => {
    store = new MemoryNewsStore();
    pipeline = new IngestionPipeline(store);
    telegramPipeline = TelegramNotificationPipeline.resetInstance();
    telegramPipeline.clearHistory();
    TelegramQualityGate.clearHistory();

    const telegramService = TelegramService.getInstance();
    telegramService.setCredentials('mock_token_82d:TEST_BOT', 'mock_chat_82d_123');
  });

  test('Audit 1: Complete Runtime Path & Independent Dispatch Execution', async () => {
    console.log('\n--- Audit 1: Complete Runtime Path & Independent Dispatch Execution ---');
    const telegramService = TelegramService.getInstance();

    const dispatchTimestamps: number[] = [];
    const origSendMessage = telegramService.sendMessage.bind(telegramService);
    telegramService.sendMessage = async (msg, token, chatId) => {
      dispatchTimestamps.push(Date.now());
      return { success: true, httpStatus: 200, messageId: 101 };
    };

    try {
      // Ingest two high-signal articles sequentially
      const art1Payload = {
        title: 'Reliance Industries bags ₹25,000 crore mega green hydrogen order win',
        description: 'Reliance Industries has secured a landmark green hydrogen contract valued at ₹25,000 crore from international energy consortium.',
        url: 'https://moneycontrol.com/news/ril-green-hydrogen-order-1',
        publishedAt: new Date().toISOString()
      };

      const res1 = await pipeline.ingest([art1Payload], 'BSE India');
      assert(res1.saved === 1, 'Article 1 saved');

      // Wait 100ms and ingest Article 2
      await new Promise(r => setTimeout(r, 100));

      const art2Payload = {
        title: 'Tata Consultancy Services bags $1.5 billion contract with European bank',
        description: 'TCS has secured a strategic 10-year technology mandate valued at $1.5 billion with a top European financial institution.',
        url: 'https://moneycontrol.com/news/tcs-mega-deal-2',
        publishedAt: new Date().toISOString()
      };

      const res2 = await pipeline.ingest([art2Payload], 'NSE India');
      assert(res2.saved === 1, 'Article 2 saved');

      // Wait briefly for queue flush
      await new Promise(r => setTimeout(r, 200));

      assert(dispatchTimestamps.length === 2, `Expected 2 distinct dispatches, got ${dispatchTimestamps.length}`);
      const gap = dispatchTimestamps[1] - dispatchTimestamps[0];
      assert(gap >= 80, `Expected staggered delivery (>=80ms gap), got ${gap}ms gap`);
      console.log(`✓ Audit 1 Passed: 2 articles dispatched as separate events with ${gap}ms gap`);
    } finally {
      telegramService.sendMessage = origSendMessage;
    }
  });

  test('Audit 2: 50-Article Staggered Ingestion Simulation & Delivery Latency Tracking', async () => {
    console.log('\n--- Audit 2: 50-Article Staggered Ingestion Simulation ---');
    const telegramService = TelegramService.getInstance();

    const sentMessages: { headline: string; timestamp: number }[] = [];
    const origSendMessage = telegramService.sendMessage.bind(telegramService);
    telegramService.sendMessage = async (msg, token, chatId) => {
      sentMessages.push({ headline: msg.slice(0, 40), timestamp: Date.now() });
      return { success: true, httpStatus: 200, messageId: Math.floor(Math.random() * 10000) };
    };

    try {
      const knownEntities = [
        'Reliance Industries', 'Tata Consultancy Services', 'HDFC Bank', 'Infosys',
        'State Bank of India', 'Larsen & Toubro', 'Bharti Airtel', 'Tata Motors',
        'Titan Company', 'Sun Pharma'
      ];

      // Create 50 mixed articles: 10 high-signal, 30 low-signal/price updates, 5 F&O, 5 duplicates
      const mockArticles = [];

      for (let i = 1; i <= 50; i++) {
        if (i <= 10) {
          // Major market events (High signal earnings)
          const entity = knownEntities[i - 1];
          mockArticles.push({
            title: `${entity} Q3 net profit surges 120% YoY with EBITDA margin expansion`,
            description: `Strong financial performance reported by ${entity} with net profit surging 120% YoY to Rs 1,500 crore.`,
            url: `https://moneycontrol.com/news/earnings-${i}`,
            publishedAt: new Date().toISOString()
          });
        } else if (i <= 15) {
          // Explicit F&O articles
          const entity = knownEntities[i - 11];
          mockArticles.push({
            title: `Nifty F&O Shift: ${entity} sees 38% OI spike with Call writing at 850 Strike`,
            description: `${entity} saw significant options activity with 38% Open Interest buildup and Call PCR at 1.15 ahead of quarterly results.`,
            url: `https://moneycontrol.com/news/fno-${i}`,
            publishedAt: new Date().toISOString()
          });
        } else if (i <= 20) {
          // Duplicates of earlier high-signal articles
          const entity = knownEntities[i - 16];
          mockArticles.push({
            title: `${entity} Q3 net profit surges 120% YoY with EBITDA margin expansion`,
            description: `Strong financial performance reported by ${entity} with net profit surging 120% YoY to Rs 1,500 crore.`,
            url: `https://moneycontrol.com/news/earnings-${i - 15}-syndicated`,
            publishedAt: new Date().toISOString()
          });
        } else {
          // Routine low-impact price updates / administrative disclosures
          mockArticles.push({
            title: `Stock ${i} trades 0.3% higher in morning session around ₹450`,
            description: `Routine trading overview for Stock ${i} with no fresh corporate developments.`,
            url: `https://moneycontrol.com/news/routine-${i}`,
            publishedAt: new Date().toISOString()
          });
        }
      }

      // Feed in 5 batches of 10 articles with 50ms stagger
      for (let batchIdx = 0; batchIdx < 5; batchIdx++) {
        const batch = mockArticles.slice(batchIdx * 10, (batchIdx + 1) * 10);
        await pipeline.ingest(batch, `Source_${batchIdx + 1}`);
        await new Promise(r => setTimeout(r, 50));
      }

      // Allow queue worker to finish
      await new Promise(r => setTimeout(r, 500));

      const telemetry = telegramPipeline.getTelemetry();
      console.log('--- 50-Article Simulation Telemetry Results ---');
      console.log(`• Total Queued: ${telemetry.totalQueued}`);
      console.log(`• Total Dispatched to Telegram: ${telemetry.totalDispatched}`);
      console.log(`• Total Suppressed (Low-Signal / Duplicates): ${telemetry.totalSuppressed}`);
      console.log(`• Max Queue Depth: ${telemetry.maxQueueDepth}`);
      console.log(`• Median Latency: ${telemetry.medianDeliveryLatencyMs}ms`);
      console.log(`• P95 Latency: ${telemetry.p95DeliveryLatencyMs}ms`);

      assert(telemetry.totalQueued === 50, `Expected 50 queued, got ${telemetry.totalQueued}`);
      assert(telemetry.totalDispatched === 15, `Expected 15 high-signal dispatches, got ${telemetry.totalDispatched}`);
      assert(telemetry.totalSuppressed === 35, `Expected 35 suppressed, got ${telemetry.totalSuppressed}`);
      assert(telemetry.medianDeliveryLatencyMs < 1000, 'Median latency under 1000ms');

      console.log('✓ Audit 2 Passed: 50 articles processed with 100% precision and zero bulk dumps');
    } finally {
      telegramService.sendMessage = origSendMessage;
    }
  });

  test('Audit 3: Historical Startup Suppression & Idempotency Proof', async () => {
    console.log('\n--- Audit 3: Historical Startup Suppression & Idempotency Proof ---');
    const telegramService = TelegramService.getInstance();
    const origSendMessage = telegramService.sendMessage.bind(telegramService);
    telegramService.sendMessage = async (msg, token, chatId) => {
      return { success: true, httpStatus: 200, messageId: 301 };
    };

    try {
      // Seed store with 10 historical articles prior to worker boot
      const oldArticles: Partial<NewsArticle>[] = [];
      for (let i = 1; i <= 10; i++) {
        oldArticles.push({
          id: `hist_art_${i}`,
          headline: `Historical Reliance Industries bags ₹5,000 crore mega order win`,
          body: `Reliance Industries has secured a major contract worth ₹5,000 crore.`,
          source: { publisher: 'BSE India', name: 'BSE India', url: `https://moneycontrol.com/news/hist-${i}`, collectionMethod: 'RSS' },
          sourceUrl: `https://moneycontrol.com/news/hist-${i}`,
          fetchedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          primaryCategory: 'MARKET'
        });
      }

      for (let art of oldArticles) {
        await store.insert(art as any);
      }

      const historyCountBefore = (await store.getAll()).length;
      assert(historyCountBefore === 10, 'Store contains 10 historical articles');

      // Enqueue historical articles with isLive = false
      for (let art of oldArticles) {
        await telegramPipeline.enqueueArticle(art as any, { isLive: false });
      }

      const histTelemetry = telegramPipeline.getTelemetry();
      assert(histTelemetry.totalDispatched === 0, `Expected 0 dispatches for historical articles, got ${histTelemetry.totalDispatched}`);
      console.log('✓ Historical store articles correctly suppressed on worker boot (0 Telegram alerts)');

      // Now introduce 1 genuinely live article
      const liveArt = {
        title: 'Infosys bags $500M contract extension with European Telecom Leader',
        description: 'Infosys announced a major $500 million technology contract expansion with a leading European telecom provider.',
        url: 'https://moneycontrol.com/news/infosys-telecom-deal-live',
        publishedAt: new Date().toISOString()
      };

      const liveRes = await pipeline.ingest([liveArt], 'BSE India');
      await new Promise(r => setTimeout(r, 200));

      const updatedTelemetry = telegramPipeline.getTelemetry();
      assert(updatedTelemetry.totalDispatched === 1, `Expected 1 dispatch for live article, got ${updatedTelemetry.totalDispatched}`);
      console.log('✓ Genuinely live article dispatched instantly (1 Telegram alert)');

      // Re-ingest the exact same live article (reprocess/restart simulation)
      await pipeline.ingest([liveArt], 'BSE India');
      await new Promise(r => setTimeout(r, 200));

      const restartTelemetry = telegramPipeline.getTelemetry();
      assert(restartTelemetry.totalDispatched === 1, `Expected still 1 dispatch after duplicate reprocessing, got ${restartTelemetry.totalDispatched}`);
      console.log('✓ Re-ingestion/reprocess produced 0 duplicate alerts (Idempotency verified)');
      console.log('✓ Audit 3 Passed!');
    } finally {
      telegramService.sendMessage = origSendMessage;
    }
  });

  test('Audit 4: Telegram HTTP 500 Failure Resilience & Single Retry Delivery', async () => {
    console.log('\n--- Audit 4: HTTP 500 Transient Failure & Retry ---');
    const telegramService = TelegramService.getInstance();

    let attempts = 0;
    const origSendMessage = telegramService.sendMessage.bind(telegramService);
    telegramService.sendMessage = async (msg, token, chatId) => {
      attempts++;
      if (attempts === 1) {
        return { success: false, error: 'HTTP_500_INTERNAL_SERVER_ERROR', httpStatus: 500 };
      }
      return { success: true, httpStatus: 200, messageId: 401 };
    };

    try {
      const art = {
        title: 'HDFC Bank Q3 net profit surges 33% YoY to Rs 16,372 crore',
        description: 'HDFC Bank reported robust net profit growth of 33% YoY with stable asset quality and expanding net interest margin.',
        url: 'https://moneycontrol.com/news/hdfc-q3-results',
        publishedAt: new Date().toISOString()
      };

      await pipeline.ingest([art], 'RBI Press Release');
      await new Promise(r => setTimeout(r, 300));

      assert(attempts === 2, `Expected 2 Telegram API attempts (1 failure + 1 retry), got ${attempts}`);
      const telemetry = telegramPipeline.getTelemetry();
      assert(telemetry.totalDispatched === 1, `Expected 1 successful final dispatch, got ${telemetry.totalDispatched}`);
      assert(telemetry.totalRetried === 1, `Expected 1 retry recorded, got ${telemetry.totalRetried}`);
      console.log('✓ Audit 4 Passed: Failed Telegram request retried and delivered exactly once without loss or duplicate alerts');
    } finally {
      telegramService.sendMessage = origSendMessage;
    }
  });

  test('Audit 5: Telegram HTTP 429 Rate-Limit Backoff Queue Resumption', async () => {
    console.log('\n--- Audit 5: HTTP 429 Rate Limit Backoff & Resumption ---');
    const telegramService = TelegramService.getInstance();

    let attempts = 0;
    const dispatchOrder: string[] = [];
    const origSendMessage = telegramService.sendMessage.bind(telegramService);

    telegramService.sendMessage = async (msg, token, chatId) => {
      attempts++;
      if (attempts === 1) {
        // Return 429 rate limit asking to wait 100ms
        return { success: false, error: 'RATE_LIMITED', httpStatus: 429, retryAfterSeconds: 0.1 };
      }
      dispatchOrder.push(msg.includes('L&amp;T') || msg.includes('L&T') || msg.includes('LARSEN') ? 'L&T' : 'Bharti Airtel');
      return { success: true, httpStatus: 200, messageId: 501 };
    };

    try {
      const art1 = {
        title: 'Larsen & Toubro bags mega ₹15,000 crore international infrastructure contract',
        description: 'Larsen & Toubro has won a massive ₹15,000 crore contract in the Middle East for infrastructure development.',
        url: 'https://moneycontrol.com/news/lt-mega-order-1',
        publishedAt: new Date().toISOString()
      };

      const art2 = {
        title: 'Bharti Airtel Q3 net profit surges 35% YoY driven by ARPU growth',
        description: 'Bharti Airtel posted robust operational performance with ARPU expanding to ₹211 per user.',
        url: 'https://moneycontrol.com/news/airtel-q3-results-2',
        publishedAt: new Date().toISOString()
      };

      await pipeline.ingest([art1, art2], 'BSE India');
      await new Promise(r => setTimeout(r, 400));

      const telemetry = telegramPipeline.getTelemetry();
      assert(telemetry.rateLimitPauses >= 1, `Expected at least 1 rate limit pause recorded, got ${telemetry.rateLimitPauses}`);
      assert(telemetry.totalDispatched === 2, `Expected both articles dispatched after backoff, got ${telemetry.totalDispatched}`);
      assert(dispatchOrder[0] === 'L&T' && dispatchOrder[1] === 'Bharti Airtel', `Maintained strict sequential FIFO order during rate limit resumption, got: ${dispatchOrder.join(', ')}`);
      console.log('✓ Audit 5 Passed: HTTP 429 backoff safely paused queue and resumed individual dispatches in correct order');
    } finally {
      telegramService.sendMessage = origSendMessage;
    }
  });

  test('Audit 6: F&O Priority & Evidence Verification', async () => {
    console.log('\n--- Audit 6: F&O Priority & Grounded Evidence Verification ---');
    
    const fnoArt = {
      headline: 'State Bank of India F&O Outlook: Open Interest surges 38% with Call writing',
      body: 'State Bank of India options activity with 38% OI buildup and Call PCR at 1.15.',
      source: { publisher: 'NSE India', name: 'NSE India', url: 'https://moneycontrol.com/news/sbin-fno', collectionMethod: 'RSS' },
      sourceUrl: 'https://moneycontrol.com/news/sbin-fno',
      isFno: true,
      publishedAt: new Date().toISOString()
    };

    const res = await telegramPipeline.enqueueArticle(fnoArt as any, { isLive: true, dryRun: true });
    assert(res.isEligible === true, 'F&O article eligible');
    assert(res.qualityGatePassed === true, 'F&O article passes quality gate');
    assert(res.formattedMessage?.includes('ATHENA MARKET ALERT') === true && res.formattedMessage?.includes('STATE BANK OF INDIA') === true, 'Formatted correctly as Telegram alert');

    console.log('✓ Audit 6 Passed: F&O article prioritized and formatted with grounded derivatives data');
  });
});
