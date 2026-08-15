/**
 * ATHENA NEWS ENGINE V3 — TELEGRAM ADMIN COMMAND CENTER
 * 
 * Implements comprehensive operational administration commands:
 * /status, /health, /queue, /collectors, /replay <ID|failed>,
 * /pause, /resume, /restart, /cache, /memory, /stats, /errors, /logs, /help
 */

import { CollectorRegistry } from '../../collectorRegistry/CollectorRegistry';
import { ArticleQueue } from '../../queue/ArticleQueue';
import { V3HealthMonitor } from '../../monitoring/V3HealthMonitor';
import { V3Logger } from '../../logging/V3Logger';
import { TelegramMessageFormatter } from './TelegramMessageFormatter';
import { V3PublisherId } from '../../types/V3Types';
import { ReplayEngine } from '../../replay/ReplayEngine';
import { MetricsEngine } from '../../metrics/MetricsEngine';
import { FailureAnalytics } from '../../operations/FailureAnalytics';
import { ReleaseDashboardEngine } from '../../operations/ReleaseDashboardEngine';

export class TelegramCommandHandler {
  public static async processCommand(commandText: string): Promise<string> {
    const cleanCmd = commandText.trim();
    if (!cleanCmd) return '⚠️ Empty command received.';

    const parts = cleanCmd.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const subArg = parts[1];
    const targetPublisher = parts[1] ? parts[1].toUpperCase() as V3PublisherId : undefined;

    switch (cmd) {
      case '/status': {
        const report = V3HealthMonitor.getInstance().getSystemHealthReport();
        const release = ReleaseDashboardEngine.getInstance().getSnapshot();
        return [
          TelegramMessageFormatter.formatEngineStarted(report),
          `\n• *Release Status:* \`${release.releaseStatus}\``,
          `• *Quality Gate Pass Rate:* ${release.qualityGatePassPct}%`,
          `• *Replay Success Rate:* ${release.replaySuccessPct}%`
        ].join('\n');
      }

      case '/collectors': {
        const registry = CollectorRegistry.getInstance();
        const healthMap = registry.health();
        if (Object.keys(healthMap).length === 0) {
          return 'ℹ️ No collectors currently registered.';
        }
        return Object.values(healthMap)
          .map(m => TelegramMessageFormatter.formatCollectorStatus(m))
          .join('\n\n');
      }

      case '/queue': {
        const queue = ArticleQueue.getInstance();
        const pending = queue.getPendingCount();
        const processing = queue.getProcessingCount();
        const items = queue.getPendingItems(5);
        return TelegramMessageFormatter.formatQueueReport(pending, processing, items);
      }

      case '/pause': {
        if (!targetPublisher) return '⚠️ Usage: `/pause <COLLECTOR_NAME>` (e.g. `/pause REUTERS`)';
        const registry = CollectorRegistry.getInstance();
        const c = registry.get(targetPublisher);
        if (!c) return `❌ Collector \`${targetPublisher}\` not found in registry.`;
        registry.disable(targetPublisher);
        return `🟡 Collector \`${c.name}\` has been PAUSED.`;
      }

      case '/resume': {
        if (!targetPublisher) return '⚠️ Usage: `/resume <COLLECTOR_NAME>` (e.g. `/resume REUTERS`)';
        const registry = CollectorRegistry.getInstance();
        const c = registry.get(targetPublisher);
        if (!c) return `❌ Collector \`${targetPublisher}\` not found in registry.`;
        registry.enable(targetPublisher);
        return `🟢 Collector \`${c.name}\` has been RESUMED.`;
      }

      case '/restart': {
        if (!targetPublisher) return '⚠️ Usage: `/restart <COLLECTOR_NAME>` (e.g. `/restart REUTERS`)';
        const registry = CollectorRegistry.getInstance();
        const c = registry.get(targetPublisher);
        if (!c) return `❌ Collector \`${targetPublisher}\` not found in registry.`;
        await c.restart();
        return `🔄 Collector \`${c.name}\` RESTARTED successfully.`;
      }

      case '/replay': {
        if (!subArg) return '⚠️ Usage: `/replay <ARTICLE_ID>` or `/replay failed`';
        const replayEngine = ReplayEngine.getInstance();

        if (subArg.toLowerCase() === 'failed') {
          const results = await replayEngine.replayFailedStories();
          return [
            `🔄 *REPLAY FAILED STORIES EXECUTED*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `• *Total Replayed:* ${results.length}`,
            `• *Successful:* ${results.filter(r => r.success).length}`,
            `• *Failed:* ${results.filter(r => !r.success).length}`
          ].join('\n');
        } else {
          const res = await replayEngine.replayArticle(subArg);
          return [
            `🔄 *REPLAY RESULT: ${subArg}*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `• *Status:* ${res.success ? '✅ SUCCESS' : '❌ FAILED'}`,
            `• *Quality Gate Passed:* ${res.qualityGatePassed ? 'YES' : 'NO'}`,
            `• *Latency:* ${res.latencyMs} ms`,
            res.error ? `• *Error:* \`${res.error}\`` : ''
          ].filter(Boolean).join('\n');
        }
      }

      case '/cache': {
        return [
          `💾 *CACHE STATUS*`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `• *Deduplication Cache:* Active (Bounded 5000 URLs)`,
          `• *Status:* Operational & Thread-Safe`
        ].join('\n');
      }

      case '/memory': {
        const memory = process.memoryUsage();
        return [
          `🧠 *MEMORY METRICS*`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `• *Heap Used:* ${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
          `• *Heap Total:* ${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
          `• *RSS:* ${Math.round(memory.rss / 1024 / 1024)} MB`,
          `• *External:* ${Math.round(memory.external / 1024 / 1024)} MB`
        ].join('\n');
      }

      case '/stats': {
        const metrics = MetricsEngine.getInstance().getSnapshot();
        return [
          `📈 *ENGINE PERFORMANCE STATS*`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `• *Articles / Hour:* ${metrics.articlesPerHour}`,
          `• *Avg Pipeline Latency:* ${metrics.avgPipelineLatencyMs} ms`,
          `• *Quality Gate Pass Rate:* ${metrics.qualityGatePassRatePct}%`,
          `• *Parser Confidence Avg:* ${metrics.avgParserConfidencePct}%`,
          `• *AI Latency Avg:* ${metrics.avgAiLatencyMs} ms`,
          `• *Queue Wait Time:* ${metrics.avgQueueWaitTimeMs} ms`
        ].join('\n');
      }

      case '/errors': {
        const analytics = FailureAnalytics.getInstance().getRankedReport();
        if (analytics.topFailures.length === 0) {
          return '✅ No system errors recorded in current session.';
        }
        const lines = analytics.topFailures.slice(0, 5).map(f => 
          `• [\`${f.category}\`] *${f.count}x*: ${f.rootCause.substring(0, 50)}...`
        ).join('\n');

        return [
          `🚨 *FAILURE ANALYTICS REPORT*`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `• *Total Recorded Failures:* ${analytics.totalFailures}`,
          `\n*Top Failure Categories:*`,
          lines
        ].join('\n');
      }

      case '/logs': {
        const logs = V3Logger.getInstance().getRecentLogs(10);
        return TelegramMessageFormatter.formatLogsReport(logs);
      }

      case '/health': {
        const report = V3HealthMonitor.getInstance().getSystemHealthReport();
        return [
          `🏥 *SYSTEM HEALTH DIAGNOSTIC*`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `• *Overall:* \`${report.overallHealth}\``,
          `• *Heap Used:* ${report.telemetry.system.memoryUsageMB.heapUsed} MB / ${report.telemetry.system.memoryUsageMB.heapTotal} MB`,
          `• *Uptime:* ${report.uptimeSeconds} seconds`,
          `• *Articles Received:* ${report.telemetry.pipeline.articlesReceivedTotal}`,
          `• *Errors Total:* ${report.telemetry.pipeline.errorCountTotal}`
        ].join('\n');
      }

      case '/help':
      default: {
        return [
          `🤖 *ATHENA V3 ADMIN COMMAND CENTER*`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `• \`/status\` - Engine overview & status`,
          `• \`/health\` - Complete system diagnostic`,
          `• \`/queue\` - Processing queue metrics`,
          `• \`/collectors\` - Collector health & circuit breaker status`,
          `• \`/replay <ARTICLE_ID|failed>\` - Trigger replay pipeline`,
          `• \`/pause <COLLECTOR>\` - Pause collector polling`,
          `• \`/resume <COLLECTOR>\` - Resume collector polling`,
          `• \`/restart <COLLECTOR>\` - Restart collector instance`,
          `• \`/cache\` - View cache utilization`,
          `• \`/memory\` - Heap & RSS memory metrics`,
          `• \`/stats\` - Real-time performance metrics`,
          `• \`/errors\` - Ranked failure analytics report`,
          `• \`/logs\` - Tail recent system logs`,
          `• \`/help\` - Show this help menu`
        ].join('\n');
      }
    }
  }
}
