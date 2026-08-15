/**
 * ATHENA NEWS ENGINE V3 — TELEGRAM OBSERVER SUBSYSTEM
 * 
 * Non-blocking, fault-tolerant observer listening to V3 Event Bus.
 * Formats pipeline events and dispatches notifications to Telegram chat.
 * 
 * FAIL-SAFE GUARANTEE:
 * Telegram network errors, invalid tokens, rate limits, or API outages
 * will NEVER block or crash the collector pipeline, queue, or core engine.
 */

import { V3EventBus } from '../../events/V3EventBus';
import { V3ConfigManager } from '../../config/V3Config';
import { V3Logger } from '../../logging/V3Logger';
import { V3PipelineEvent } from '../../types/V3Types';
import { TelegramMessageFormatter } from './TelegramMessageFormatter';

export class TelegramObserver {
  private static instance: TelegramObserver;
  private isSubscribed = false;
  private sentCount = 0;
  private failedCount = 0;

  private constructor() {}

  public static getInstance(): TelegramObserver {
    if (!TelegramObserver.instance) {
      TelegramObserver.instance = new TelegramObserver();
    }
    return TelegramObserver.instance;
  }

  public initialize(): void {
    if (this.isSubscribed) return;

    const bus = V3EventBus.getInstance();

    bus.subscribe('SYSTEM_HEALTH_CHECK', async (event: V3PipelineEvent) => {
      await this.safeSend(event.payload.message || 'System Health Check Notification');
    });

    bus.subscribe('ARTICLE_RECEIVED', async (event: V3PipelineEvent) => {
      const article = event.payload.article;
      if (article) {
        const msg = TelegramMessageFormatter.formatNewArticle(article, event.payload.queueId || 'N/A');
        await this.safeSend(msg);
      }
    });

    bus.subscribe('COLLECTOR_FAILED', async (event: V3PipelineEvent) => {
      const msg = TelegramMessageFormatter.formatCollectorFailed(
        event.payload.collectorName || 'Collector',
        event.payload.error || 'Unknown Failure',
        event.payload.consecutiveFailures || 1
      );
      await this.safeSend(msg);
    });

    bus.subscribe('FNO_SIGNAL_GENERATED', async (event: V3PipelineEvent) => {
      const signal = event.payload.signal;
      if (signal && (signal.alertSeverity === 'ACTIONABLE' || signal.alertSeverity === 'CRITICAL')) {
        const msg = TelegramMessageFormatter.formatFNOSignal(signal);
        await this.safeSend(msg);
      }
    });

    this.isSubscribed = true;
    V3Logger.getInstance().info('TelegramObserver', 'Telegram Observer initialized and listening to event bus.');
  }

  public async safeSend(text: string): Promise<boolean> {
    try {
      const config = V3ConfigManager.getInstance().getConfig();
      const botToken = config.apiKeys.telegramBotToken;
      const chatId = config.apiKeys.telegramChatId;

      if (!botToken || !chatId) {
        // Fallback mode: log without failing
        V3Logger.getInstance().debug('TelegramObserver', 'Telegram credentials not set. Message logged in observer mode:', { textSnippet: text.substring(0, 50) });
        this.sentCount++;
        return true;
      }

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const body = {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      };

      // Non-blocking timeout fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.sentCount++;
        return true;
      } else {
        this.failedCount++;
        V3Logger.getInstance().warn('TelegramObserver', `Telegram API responded with HTTP ${response.status}`);
        return false;
      }
    } catch (err) {
      // Catch all network and timeout errors safely
      this.failedCount++;
      V3Logger.getInstance().warn('TelegramObserver', 'Failed to send Telegram notification (non-blocking failure)', {
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  }

  public getStats(): { sentCount: number; failedCount: number } {
    return {
      sentCount: this.sentCount,
      failedCount: this.failedCount
    };
  }

  public resetStats(): void {
    this.sentCount = 0;
    this.failedCount = 0;
  }
}
