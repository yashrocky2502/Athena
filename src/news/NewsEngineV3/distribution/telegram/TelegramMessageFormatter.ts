/**
 * ATHENA NEWS ENGINE V3 — TELEGRAM MESSAGE FORMATTER
 * 
 * Generates formatted Markdown/HTML messages for Telegram monitor.
 */

import { V3CollectorHealthMetrics } from '../../collectors/ICollector';
import { V3QueueItem } from '../../queue/ArticleQueue';
import { V3LogEntry } from '../../logging/V3Logger';
import { V3SystemHealthReport } from '../../monitoring/V3HealthMonitor';
import { V3RawArticle } from '../../types/V3Types';

export class TelegramMessageFormatter {
  public static formatEngineStarted(report: V3SystemHealthReport): string {
    return [
      `🚀 *ATHENA NEWS ENGINE V3 STARTED*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• *Version:* ${report.version}`,
      `• *Environment:* ${report.environment}`,
      `• *Uptime:* ${report.uptimeSeconds}s`,
      `• *Overall Health:* \`${report.overallHealth}\``,
      `• *Memory Used:* ${report.telemetry.system.memoryUsageMB.heapUsed} MB`,
      `• *Queue Length:* ${report.telemetry.pipeline.queueLength}`
    ].join('\n');
  }

  public static formatCollectorStatus(metrics: V3CollectorHealthMetrics): string {
    const statusEmoji = metrics.state === 'RUNNING' ? '🟢' : metrics.state === 'PAUSED' ? '🟡' : '🔴';
    return [
      `📡 *COLLECTOR STATUS: ${metrics.name}*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• *Status:* ${statusEmoji} \`${metrics.state}\``,
      `• *Articles Fetched:* ${metrics.totalArticlesFetched}`,
      `• *Avg Latency:* ${metrics.avgLatencyMs} ms`,
      `• *Health:* ${metrics.healthPercentage}%`,
      `• *Circuit Breaker:* ${metrics.circuitBreakerOpen ? '❌ OPEN' : '✅ CLOSED'}`,
      metrics.lastError ? `• *Last Error:* \`${metrics.lastError}\`` : ''
    ].filter(Boolean).join('\n');
  }

  public static formatNewArticle(article: V3RawArticle, queueId: string, procTimeMs?: number): string {
    return [
      `📰 *NEW ARTICLE RECEIVED*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• *Source:* ${article.publisherId}`,
      `• *Headline:* ${article.title}`,
      `• *Published:* ${article.publishedAt}`,
      `• *Queue ID:* \`${queueId}\``,
      procTimeMs !== undefined ? `• *Processing Time:* ${procTimeMs} ms` : '',
      `• [Read Original](${article.sourceUrl})`
    ].filter(Boolean).join('\n');
  }

  public static formatCollectorFailed(collectorName: string, errorMsg: string, failures: number): string {
    return [
      `❌ *COLLECTOR FAILURE ALERT*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• *Collector:* ${collectorName}`,
      `• *Consecutive Failures:* ${failures}`,
      `• *Error:* \`${errorMsg}\``,
      `• *Action:* Circuit Breaker engaged.`
    ].join('\n');
  }

  public static formatCollectorRecovered(collectorName: string): string {
    return [
      `✅ *COLLECTOR RECOVERED*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• *Collector:* ${collectorName}`,
      `• *Status:* Normal fetch resumed.`
    ].join('\n');
  }

  public static formatQueueReport(pendingCount: number, processingCount: number, items: V3QueueItem[]): string {
    const header = [
      `📊 *ARTICLE PROCESSING QUEUE*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• *Pending:* ${pendingCount}`,
      `• *Processing:* ${processingCount}`,
      `\n*Recent Pending Items:*`
    ].join('\n');

    if (items.length === 0) {
      return `${header}\n_Queue is currently empty._`;
    }

    const itemLines = items.slice(0, 5).map(item => 
      `• [\`${item.queueId}\`] *${item.collectorId}*: ${item.article.title.substring(0, 45)}...`
    ).join('\n');

    return `${header}\n${itemLines}`;
  }

  public static formatLogsReport(logs: V3LogEntry[]): string {
    const header = `📜 *RECENT SYSTEM LOGS (Last ${logs.length})*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    const logLines = logs.map(l => {
      const emoji = l.level === 'ERROR' ? '❌' : l.level === 'WARN' ? '⚠️' : 'ℹ️';
      return `${emoji} [\`${l.level}\`] *${l.module}*: ${l.message}`;
    }).join('\n');

    return header + logLines;
  }

  public static formatFNOSignal(signal: any): string {
    const severityEmoji = signal.alertSeverity === 'CRITICAL' ? '🚨' : '⚡';
    return [
      `${severityEmoji} *ATHENA F&O DECISION SIGNAL [${signal.alertSeverity}]*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `• *Symbol:* \`${signal.symbol}\` (${signal.underlyingType})`,
      `• *Event:* ${signal.eventType}`,
      `• *Directional Bias:* *${signal.directionalBias}* (${signal.directionalConfidence}%)`,
      `• *Recommendation:* *${signal.recommendation}*`,
      `• *Preferred Strategy:* ${signal.preferredStrategy}`,
      `• *Binary Event Risk:* ${signal.binaryEventRisk}`,
      `• *Freshness:* ${signal.freshnessStatus}`,
      `• *Hedge Required:* ${signal.hedgeRequired ? 'YES (' + signal.hedgeReason + ')' : 'NO'}`,
      `• *Source:* ${signal.sourcePublisher}`,
      signal.blockedReason ? `• *Blocked Reason:* \`${signal.blockedReason}\`` : '',
      `• *Timestamp:* ${signal.timestamp}`
    ].filter(Boolean).join('\n');
  }
}
