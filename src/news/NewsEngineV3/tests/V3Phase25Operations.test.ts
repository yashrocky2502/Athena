/**
 * ATHENA NEWS ENGINE V3 — PHASE 2.5 UNIT TESTS
 * 
 * Verifies operations, observability, replay engine, human review queue,
 * metrics engine, failure analytics, and admin commands.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationHub } from '../notificationHub/NotificationHub';
import { TelegramMultiChannelRouter } from '../distribution/telegram/TelegramMultiChannelRouter';
import { ReplayEngine } from '../replay/ReplayEngine';
import { HumanReviewQueue } from '../humanReview/HumanReviewQueue';
import { MetricsEngine } from '../metrics/MetricsEngine';
import { FailureAnalytics } from '../operations/FailureAnalytics';
import { ReleaseDashboardEngine } from '../operations/ReleaseDashboardEngine';
import { TelegramCommandHandler } from '../distribution/telegram/TelegramCommandHandler';
import { V3RawArticle } from '../types/V3Types';

describe('NewsEngineV3 — Phase 2.5 Operations Suite', () => {
  beforeEach(() => {
    NotificationHub.getInstance().clearHistory();
    ReplayEngine.getInstance().clear();
    HumanReviewQueue.getInstance().clear();
    MetricsEngine.getInstance().reset();
    FailureAnalytics.getInstance().clear();
  });

  it('1. NotificationHub should dispatch and record notifications', async () => {
    const hub = NotificationHub.getInstance();
    const id = await hub.dispatch({
      type: 'PIPELINE',
      title: 'Test Notification',
      message: 'Testing dispatch mechanism',
      priority: 'NORMAL'
    });

    expect(id).toBeDefined();
    const history = hub.getHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].title).toBe('Test Notification');
  });

  it('2. TelegramMultiChannelRouter should maintain channel stats', async () => {
    const router = TelegramMultiChannelRouter.getInstance();
    const sent = await router.sendToChannel('DEVELOPERS', {
      title: 'Dev Test Alert',
      message: 'Testing multi-channel router',
      type: 'PIPELINE',
      priority: 'LOW'
    });

    expect(sent).toBe(true);
    const stats = router.getChannelStats();
    expect(stats.DEVELOPERS.messagesSent).toBeGreaterThan(0);
  });

  it('3. ReplayEngine should execute 10-stage timeline replay', async () => {
    const replayEngine = ReplayEngine.getInstance();
    const result = await replayEngine.replayArticle('RAW_TEST_100', 'Test Replay Execution');

    expect(result.replayId).toBeDefined();
    expect(result.articleId).toBe('RAW_TEST_100');
    expect(result.success).toBe(true);
    expect(result.timeline.length).toBe(10);
    expect(result.timeline[0].stage).toBe('COLLECTION');
    expect(result.timeline[9].stage).toBe('TELEGRAM_PUBLISHING');
  });

  it('4. HumanReviewQueue should enqueue items and handle reviewer actions', () => {
    const hr = HumanReviewQueue.getInstance();
    const sampleArt: V3RawArticle = {
      id: 'ART_REVIEW_01',
      publisherId: 'REUTERS',
      sourceUrl: 'https://reuters.com/test',
      title: 'Test Review Title',
      rawBody: 'Test raw body',
      publishedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString()
    };

    const item = hr.enqueueForReview(sampleArt, 'LOW_PARSER_CONFIDENCE', 78);
    expect(item.reviewId).toBeDefined();
    expect(item.status).toBe('PENDING_REVIEW');

    const updated = hr.processReviewAction(item.reviewId, 'APPROVE', 'REVIEWER_1', 'Approved after inspection');
    expect(updated.status).toBe('APPROVED');
    expect(updated.reviewedBy).toBe('REVIEWER_1');
  });

  it('5. MetricsEngine should compute system performance snapshots', () => {
    const metrics = MetricsEngine.getInstance();
    metrics.recordArticleProcessed(150, true, 98);
    metrics.recordRetry();

    const snapshot = metrics.getSnapshot();
    expect(snapshot.totalSuccessCount).toBe(1);
    expect(snapshot.totalRetriesCount).toBe(1);
    expect(snapshot.qualityGatePassRatePct).toBe(100);
    expect(snapshot.memoryUsageMB.heapUsed).toBeGreaterThan(0);
  });

  it('6. FailureAnalytics should record and rank errors', () => {
    const analytics = FailureAnalytics.getInstance();
    analytics.recordFailure('COLLECTOR_FAILURE', 'HTTP 500 Server Error');
    analytics.recordFailure('COLLECTOR_FAILURE', 'HTTP 500 Server Error');
    analytics.recordFailure('PARSER_FAILURE', 'Unparsed metric key');

    const report = analytics.getRankedReport();
    expect(report.totalFailures).toBe(3);
    expect(report.topFailures[0].category).toBe('COLLECTOR_FAILURE');
    expect(report.topFailures[0].count).toBe(2);
  });

  it('7. ReleaseDashboardEngine should calculate overall score and release status', () => {
    const release = ReleaseDashboardEngine.getInstance();
    const snapshot = release.getSnapshot();

    expect(snapshot.overallScore).toBeGreaterThanOrEqual(0);
    expect(['GREEN', 'YELLOW', 'RED']).toContain(snapshot.releaseStatus);
  });

  it('8. TelegramCommandHandler should process admin commands', async () => {
    FailureAnalytics.getInstance().recordFailure('COLLECTOR_FAILURE', 'HTTP 500 Test Error');

    const helpOutput = await TelegramCommandHandler.processCommand('/help');
    expect(helpOutput).toContain('ATHENA V3 ADMIN COMMAND CENTER');

    const statusOutput = await TelegramCommandHandler.processCommand('/status');
    expect(statusOutput).toContain('Release Status');

    const replayOutput = await TelegramCommandHandler.processCommand('/replay RAW_TEST_99');
    expect(replayOutput).toContain('REPLAY RESULT');

    const errorsOutput = await TelegramCommandHandler.processCommand('/errors');
    expect(errorsOutput).toContain('FAILURE ANALYTICS REPORT');
  });
});
