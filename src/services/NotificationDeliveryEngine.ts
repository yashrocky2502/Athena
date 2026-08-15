import { 
  AthenaAlert, 
  NotificationRecord, 
  NotificationChannel, 
  NotificationStatus, 
  NotificationProvider,
  PipelineStage,
  AlertCategory,
  Priority
} from "../types";
import { AlertDecisionEngine } from "./AlertDecisionEngine";
import { PipelineMonitorService } from "./PipelineMonitorService";
import { ProfilerService } from "./ProfilerService";
import { supabaseAdmin } from "../lib/supabase";
import { safeLocalStorage } from "./storage/safeStorage";

export class NotificationDeliveryEngine {
  private static instance: NotificationDeliveryEngine;
  private history: NotificationRecord[] = [];
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();

  private readonly HIGH_VALUE_CATEGORIES = [
    "Quarterly Results",
    "Earnings",
    "Dividend",
    "Bonus",
    "Stock Split",
    "Promoter buying",
    "Promoter selling",
    "M&A",
    "Acquisition",
    "Merger",
    "Major order win",
    "RBI action",
    "SEBI action",
    "Credit rating change",
    "Management change",
    "CEO change"
  ];

  private constructor() {
    this.loadHistory();
    this.startPolling();
  }

  public static getInstance(): NotificationDeliveryEngine {
    if (!NotificationDeliveryEngine.instance) {
      NotificationDeliveryEngine.instance = new NotificationDeliveryEngine();
    }
    return NotificationDeliveryEngine.instance;
  }

  private loadHistory() {
    const saved = safeLocalStorage.getItem("athena_notification_history");
    if (saved) {
      try {
        this.history = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load notification history", e);
      }
    }
  }

  private saveHistory() {
    safeLocalStorage.setItem("athena_notification_history", JSON.stringify(this.history));
  }

  private startPolling() {
    setInterval(async () => {
      const engine = AlertDecisionEngine.getInstance();
      const alerts = engine.getAlertHistory();
      
      for (const alert of alerts) {
        if (!this.history.some(n => n.alertId === alert.id)) {
          this.queueNotification(alert);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  public queueNotification(alert: AthenaAlert) {
    const traceId = alert.traceId || `trace-${Math.random().toString(36).substring(7)}`;
    const monitor = PipelineMonitorService.getInstance();

    // 1. Strict Routing Audit: Separate System Health from User Intelligence
    if (alert.category === AlertCategory.SystemHealth) {
      console.log(`[NotificationDeliveryEngine] Suppressing system health alert ${alert.id} from external notification channels.`);
      monitor.recordEvent({
        traceId,
        stage: PipelineStage.NotificationQueue,
        status: "Suppressed",
        details: `System Health event routed only to internal dashboards.`,
        priority: alert.priority
      });
      return;
    }

    // 2. Data Integrity Audit: Reject incomplete alerts
    const hasCompany = alert.companies && alert.companies.length > 0 && alert.companies.some(c => c && c.trim() !== "");
    const hasTitle = alert.title && alert.title.trim() !== "";

    if (!hasCompany || !hasTitle) {
      console.warn(`[NotificationDeliveryEngine] Rejecting alert ${alert.id} due to missing metadata (title/company).`);
      monitor.recordEvent({
        traceId,
        stage: PipelineStage.NotificationQueue,
        status: "Failure",
        details: `Rejected: Missing mandatory metadata (Company: ${hasCompany}, Title: ${hasTitle}).`,
        priority: alert.priority
      });
      return;
    }

    const channels: NotificationChannel[] = [];
    
    const titleLower = (alert.title || "").toLowerCase();
    const typeLower = (alert.type || "").toLowerCase();
    const descLower = (alert.description || "").toLowerCase();

    // Check if it's a high-value event for mandatory Telegram delivery
    const isCriticalCompanyNews = 
      titleLower.includes("quarterly results") || 
      titleLower.includes("earnings") || 
      titleLower.includes("consensus") || 
      titleLower.includes("promoter") ||
      titleLower.includes("dividend") ||
      descLower.includes("quarterly results") ||
      descLower.includes("earnings") ||
      descLower.includes("consensus");

    const isHighValue = isCriticalCompanyNews || this.HIGH_VALUE_CATEGORIES.some(cat => {
      const catLower = cat.toLowerCase();
      return (
        typeLower.includes(catLower) || 
        titleLower.includes(catLower) ||
        descLower.includes(catLower) ||
        (catLower === "promoter buying/selling" && (titleLower.includes("promoter buying") || titleLower.includes("promoter selling") || typeLower.includes("promoter") || descLower.includes("promoter"))) ||
        (catLower === "rbi/sebi actions" && (titleLower.includes("rbi") || titleLower.includes("sebi") || typeLower.includes("rbi") || typeLower.includes("sebi") || descLower.includes("rbi") || descLower.includes("sebi"))) ||
        (catLower === "major order wins" && (titleLower.includes("order win") || titleLower.includes("secured contract") || typeLower.includes("orderwin") || descLower.includes("order win"))) ||
        (catLower === "management changes" && (titleLower.includes("management change") || titleLower.includes("ceo") || titleLower.includes("cfo") || typeLower.includes("management") || descLower.includes("management change")))
      );
    });

    // Only send to Telegram if Impact Score (severityScore) crosses threshold (e.g. 60)
    // or if it's a Critical/High priority alert, OR if it's a mandatory high-value event.
    const telegramThreshold = 60;
    if (isHighValue || alert.severityScore >= telegramThreshold || alert.priority === Priority.High || alert.priority === Priority.Critical) {
      channels.push(NotificationChannel.Telegram);
      if (isHighValue) {
        console.log(`[NotificationDeliveryEngine] Mandatory Telegram delivery triggered for: ${alert.title}`);
      }
    }

    if (channels.length === 0) {
      monitor.recordEvent({
        traceId,
        stage: PipelineStage.NotificationQueue,
        status: "Suppressed",
        details: `Alert ${alert.id} below delivery threshold for external channels (Score: ${alert.severityScore}).`,
        priority: alert.priority
      });
      return;
    }
    
    monitor.recordEvent({
      traceId,
      stage: PipelineStage.NotificationQueue,
      status: "Success",
      details: `User Intelligence alert ${alert.id} queued for ${alert.companies.join(", ")}. Channels: ${channels.join(", ")}`,
      channel: channels[0],
      priority: alert.priority
    });

    for (const channel of channels) {
      const record: NotificationRecord = {
        id: `notif-${Math.random().toString(36).substring(7)}`,
        alertId: alert.id,
        channel,
        status: NotificationStatus.Queued,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        traceId // Pass traceId
      };
      
      this.history.unshift(record);
      this.saveHistory();
      this.deliverNotification(record, alert);
    }
  }

  private async deliverNotification(notification: NotificationRecord, alert: AthenaAlert) {
    const provider = this.providers.get(notification.channel);
    const traceId = notification.traceId || alert.traceId || `trace-${Math.random().toString(36).substring(7)}`;
    const monitor = PipelineMonitorService.getInstance();
    const startTime = Date.now();

    if (!provider) {
      this.updateNotificationStatus(notification.id, NotificationStatus.Failed, "No provider found");
      monitor.recordEvent({
        traceId,
        stage: PipelineStage.ProviderSend,
        status: "Failure",
        details: `No provider found for channel ${notification.channel}`
      });
      return;
    }

    this.updateNotificationStatus(notification.id, NotificationStatus.Processing);

    monitor.recordEvent({
      traceId,
      stage: PipelineStage.ProviderSend,
      status: "Success",
      details: `Dispatching to ${notification.channel} provider...`
    });

    try {
      const result = await provider.send(notification, alert);
      
      if (result.success) {
        this.updateNotificationStatus(notification.id, NotificationStatus.Delivered);
        
        // Log to Supabase for production audit
        await supabaseAdmin.from('telegram_notifications').insert({
          event_id: alert.id,
          company: alert.companies[0],
          category: alert.type,
          priority: alert.priority,
          delivery_status: 'Delivered',
          telegram_message_id: result.telegramMessageId,
          sent_at: new Date().toISOString()
        });

        monitor.recordEvent({
          traceId,
          stage: PipelineStage.Delivered,
          status: "Success",
          details: `Successfully delivered via ${notification.channel}. MsgId: ${result.telegramMessageId || "N/A"}`,
          latencyMs: result.latency || (Date.now() - startTime),
          providerResponse: result
        });

        ProfilerService.getInstance().record("Notification", result.latency || (Date.now() - startTime));
      } else {
        this.handleFailure(notification, alert, result.errorMessage);
        monitor.recordEvent({
          traceId,
          stage: PipelineStage.ProviderSend,
          status: "Failure",
          details: `Provider error: ${result.errorMessage}`,
          providerResponse: result
        });
      }
    } catch (e) {
      const errorMsg = (e as Error).message;
      this.handleFailure(notification, alert, errorMsg);
      monitor.recordEvent({
        traceId,
        stage: PipelineStage.ProviderSend,
        status: "Failure",
        details: `Exception during delivery: ${errorMsg}`
      });
    }
  }

  private handleFailure(notification: NotificationRecord, alert: AthenaAlert, errorMessage?: string) {
    const traceId = notification.traceId || alert.traceId || "unknown";
    const monitor = PipelineMonitorService.getInstance();

    if (notification.retryCount < 3) {
      const retryCount = notification.retryCount + 1;
      const delays = [60000, 300000, 900000]; // 1m, 5m, 15m
      const nextAttemptAt = new Date(Date.now() + delays[retryCount - 1]).toISOString();
      
      const record = this.history.find(n => n.id === notification.id);
      if (record) {
        record.retryCount = retryCount;
        record.status = NotificationStatus.Retrying;
        record.nextAttemptAt = nextAttemptAt;
        record.errorMessage = errorMessage;
        record.lastAttemptAt = new Date().toISOString();
        this.saveHistory();

        monitor.recordEvent({
          traceId,
          stage: PipelineStage.NotificationQueue,
          status: "Retrying",
          details: `Delivery failed. Scheduled retry #${retryCount} at ${new Date(nextAttemptAt).toLocaleTimeString()}`,
          retryCount
        });
      }
    } else {
      this.updateNotificationStatus(notification.id, NotificationStatus.Failed, errorMessage);
      monitor.recordEvent({
        traceId,
        stage: PipelineStage.Delivered,
        status: "Failure",
        details: `Max retries reached. Delivery failed permanently: ${errorMessage}`
      });
    }
  }

  public async retryFailedNotification(id: string) {
    const record = this.history.find(n => n.id === id);
    if (record && record.status === NotificationStatus.Failed) {
      record.retryCount += 1;
      record.status = NotificationStatus.Queued;
      this.saveHistory();
      
      const engine = AlertDecisionEngine.getInstance();
      const alert = engine.getAlertHistory().find(a => a.id === record.alertId);
      if (alert) {
        this.deliverNotification(record, alert);
      }
    }
  }

  private updateNotificationStatus(id: string, status: NotificationStatus, errorMessage?: string) {
    const record = this.history.find(n => n.id === id);
    if (record) {
      record.status = status;
      if (status === NotificationStatus.Delivered) {
        record.deliveredAt = new Date().toISOString();
      }
      if (errorMessage) {
        record.errorMessage = errorMessage;
      }
      this.saveHistory();
    }
  }

  public getNotificationHistory(): NotificationRecord[] {
    return [...this.history];
  }

  public getDeliveryMetrics() {
    const total = this.history.length;
    const delivered = this.history.filter(n => n.status === NotificationStatus.Delivered).length;
    const failed = this.history.filter(n => n.status === NotificationStatus.Failed).length;
    
    return {
      total,
      delivered,
      failed,
      successRate: total > 0 ? (delivered / total) * 100 : 100
    };
  }
}
