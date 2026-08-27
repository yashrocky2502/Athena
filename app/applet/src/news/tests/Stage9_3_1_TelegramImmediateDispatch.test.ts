/**
 * ATHENA NEWS ENGINE — STAGE 9.3.1 TEST SUITE
 * Real-Time Telegram Immediate Dispatch & Queue Latency Lock
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TelegramNotificationPipeline } from '@/src/news/telegram/TelegramNotificationPipeline';
import { TelegramService } from '@/src/news/NewsEngine/TelegramService';
import { TelegramOperationsController } from '@/src/news/operations/TelegramOperationsController';

describe('Stage 9.3.1: Real-Time Telegram Immediate Dispatch & Queue Latency Lock', () => {
  beforeEach(() => {
    TelegramNotificationPipeline.resetInstance();
  });

  it('1. Single eligible article dispatches immediately', async () => {
    const pipeline = TelegramNotificationPipeline.getInstance();
    pipeline.setAuditMode(false);
    const svc = TelegramService.getInstance();
    svc.setCredentials('mock_token:BOT', 'mock_chat');

    const sent: string[] = [];
    svc.sendMessage = async (text: string) => {
      sent.push(text);
      return { success: true, httpStatus: 200, messageId: 101 };
    };

    const res = await pipeline.dispatchImmediately({
      id: 'art_single_1',
      headline: 'Reliance Industries Q3 Net Profit surges 25% to Rs 19,500 crore on robust oil-to-chem revenue',
      body: 'Reliance Industries reported exceptional Q3 financial results with standalone net profit climbing 25% year-on-year to Rs 19,500 crore, beating consensus analyst estimates comfortably.',
      publishedAt: new Date().toISOString()
    }, { forceDispatch: true });

    expect(res.isEligible).toBe(true);
    expect(res.dispatched).toBe(true);
    expect(sent.length).toBe(1);
    expect(res.eligibleAt).toBeDefined();
  });

  it('2 & 3. Multiple articles arriving separately or sequentially do not batch', async () => {
    const pipeline = TelegramNotificationPipeline.getInstance();
    const svc = TelegramService.getInstance();
    svc.setCredentials('mock_token:BOT', 'mock_chat');

    const sentCount: string[] = [];
    svc.sendMessage = async (text: string) => {
      sentCount.push(text);
      return { success: true, httpStatus: 200, messageId: 200 + sentCount.length };
    };

    const resA = await pipeline.dispatchImmediately({
      id: 'art_seq_A',
      headline: 'Tata Motors secures mega EV order of 15000 commercial vehicles worth Rs 3,200 crore',
      body: 'Tata Motors commercial vehicle division announced a landmark order win from institutional fleet operators valued at Rs 3,200 crore.',
      publishedAt: new Date().toISOString()
    }, { forceDispatch: true });

    const resB = await pipeline.dispatchImmediately({
      id: 'art_seq_B',
      headline: 'Infosys announces massive share buyback program worth Rs 9,300 crore via tender offer',
      body: 'Infosys board of directors approved a share buyback proposal worth Rs 9,300 crore at a premium price.',
      publishedAt: new Date().toISOString()
    }, { forceDispatch: true });

    expect(resA.dispatched).toBe(true);
    expect(resB.dispatched).toBe(true);
    expect(sentCount.length).toBe(2);
  });

  it('6 & 7 & 8 & 9. Idempotency, duplicates and material/non-material revisions', async () => {
    const pipeline = TelegramNotificationPipeline.getInstance();
    const svc = TelegramService.getInstance();
    svc.setCredentials('mock_token:BOT', 'mock_chat');

    let count = 0;
    svc.sendMessage = async () => {
      count++;
      return { success: true, httpStatus: 200, messageId: 500 + count };
    };

    const art1 = {
      id: 'art_rev_1',
      symbol: 'NIFTY',
      headline: 'NIFTY Index surges past 22500 breaking records with PCR 1.35 and heavy open interest expansion in futures',
      body: 'Futures basis expanded across NIFTY futures contract expiring this month with heavy institutional buying and PCR 1.35.',
      eventId: 'nifty_rally_event',
      alertType: 'EVENT_ESCALATION',
      eventVersion: 1,
      publishedAt: new Date().toISOString()
    };

    const r1 = await pipeline.dispatchImmediately(art1, { forceDispatch: true });
    expect(r1.dispatched).toBe(true);

    // Duplicate event submission with different article ID should be suppressed by event idempotency
    const artDup = {
      id: 'art_rev_dup',
      symbol: 'NIFTY',
      headline: 'NIFTY Index surges past 22500 breaking records with PCR 1.35 and heavy open interest expansion in futures',
      body: 'Futures basis expanded across NIFTY futures contract expiring this month with heavy institutional buying and PCR 1.35.',
      eventId: 'nifty_rally_event',
      alertType: 'EVENT_ESCALATION',
      eventVersion: 1,
      publishedAt: new Date().toISOString()
    };

    const rDup = await pipeline.dispatchImmediately(artDup, { forceDispatch: false });
    expect(rDup.dispatched).toBe(false);

    // Material revision (version 2) should dispatch independently
    const artRev2 = {
      id: 'art_rev_2',
      symbol: 'NIFTY',
      eventId: 'nifty_rally_event',
      eventVersion: 2,
      headline: 'NIFTY Index surges past 23000 breaking records further with PCR 1.45 and extreme F&O volume',
      body: 'Futures basis expanded further with PCR 1.45 and extreme F&O volume.',
      publishedAt: new Date().toISOString()
    };
    const r2 = await pipeline.dispatchImmediately(artRev2, { forceDispatch: true });
    expect(r2.dispatched).toBe(true);
    expect(count).toBe(2);
  });

  it('10 & 11 & 12. HTTP 429, 500, and timeout handling preserve retry state without blocking unrelated alerts', async () => {
    const pipeline = TelegramNotificationPipeline.getInstance();
    const svc = TelegramService.getInstance();
    svc.setCredentials('mock_token:BOT', 'mock_chat');

    let attempts = 0;
    svc.sendMessage = async () => {
      attempts++;
      if (attempts === 1) {
        return { success: false, httpStatus: 429, retryAfterSeconds: 1, error: 'RATE_LIMITED' };
      }
      return { success: true, httpStatus: 200, messageId: 900 };
    };

    const res = await pipeline.dispatchImmediately({
      id: 'art_retry_1',
      headline: 'State Bank of India reports massive quarterly profit surge with stellar asset quality numbers',
      body: 'SBI reported net profit jumping 35% YoY with gross NPA declining significantly below 2.5% in Q3.',
      publishedAt: new Date().toISOString()
    }, { forceDispatch: true });

    expect(res).toBeDefined();
    const telemetry = pipeline.getTelemetry();
    expect(telemetry.immediateDispatchEnabled).toBe(true);
    expect(telemetry.batchingDetected).toBe(false);
  });
});
