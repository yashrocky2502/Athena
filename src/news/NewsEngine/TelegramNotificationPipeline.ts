import fs from 'fs';
import path from 'path';
import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { UnifiedIntelligenceEngine } from '../../newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine';
import { TelegramService, TelegramSendResult, sanitizeTelegramLog } from './TelegramService';
import { TraderTelegramFormatter } from './TraderTelegramFormatter';
import { TelegramQualityGate, QualityGateDecision, QualityGatePriority, QualityGateResult } from './TelegramQualityGate';
import { TelegramNotificationStateStore, TelegramNotificationState, NotificationStatus } from './TelegramNotificationStateStore';
import { FinancialMetricEngine } from '../../newsCoreV2/intelligence/FinancialMetricEngine';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TelegramNotificationRecord {
  notificationId: string;
  articleId: string;
  chatId: string;
  stock: string;
  headline: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  attemptCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  httpStatus?: number;
  telegramOk?: boolean;
  telegramMessageId?: number;
  errorCode?: string;
  errorDescription?: string;
  dedupKey: string;
  formattedMessage: string;
  decisionReason?: string;
}

export interface TelegramNotificationDecision {
  articleId: string;
  notificationKey: string;
  symbol: string;
  headline: string;
  decision: QualityGateDecision;
  priority: QualityGatePriority;
  reason: string;
  evaluatedAt: string;
  sentAt?: string;
  telegramMessageId?: number;
  auditModeOnly?: boolean;
}

export interface TelemetryStats {
  connected: boolean;
  auditModeOnly: boolean;
  activatedAt: string;
  liveNotifications: number;
  suppressedCount: number;
  digestPendingCount: number;
  sentCount: number;
  failedCount: number;
  lastAlert: TelegramNotificationRecord | null;
  lastSuccessfulMessageId: number | null;
  lastSuccessfulMessageAt: string | null;
  lastError: string | null;
  decisionsHistory: TelegramNotificationDecision[];
}

export class TelegramNotificationPipeline {
  private static instance: TelegramNotificationPipeline;
  private records: TelegramNotificationRecord[] = [];
  private decisions: TelegramNotificationDecision[] = [];
  private dedupKeys: Set<string> = new Set();
  private dataDir: string;
  private filePath: string;
  private configPath: string;
  private decisionsPath: string;

  private auditModeOnly = true; // Default DRY RUN AUDIT MODE to prevent accidental floods
  private activatedAt: string = new Date().toISOString();

  private lastSuccessfulMessageId: number | null = null;
  private lastSuccessfulMessageAt: string | null = null;
  private lastError: string | null = null;

  private constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.filePath = path.join(this.dataDir, 'telegram_notifications.json');
    this.configPath = path.join(this.dataDir, 'telegram_pipeline_config.json');
    this.decisionsPath = path.join(this.dataDir, 'telegram_decisions.json');

    this.ensureDirExists();
    this.loadConfig();
    this.loadFromDisk();

    // Start background intervals for dispatch digest and retry recovery
    setInterval(() => {
      this.dispatchDigest().catch(err => console.error('[TelegramNotificationPipeline] Auto digest error:', err));
    }, 30 * 60 * 1000); // 30 minutes

    setInterval(() => {
      this.retryFailedNotifications().catch(err => console.error('[TelegramNotificationPipeline] Auto retry error:', err));
    }, 5 * 60 * 1000); // 5 minutes
  }

  public static getInstance(): TelegramNotificationPipeline {
    if (!TelegramNotificationPipeline.instance) {
      TelegramNotificationPipeline.instance = new TelegramNotificationPipeline();
    }
    return TelegramNotificationPipeline.instance;
  }

  private ensureDirExists() {
    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch (e) {
        // Fallback
      }
    }
  }

  private loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const cfg = JSON.parse(raw);
        if (typeof cfg.auditModeOnly === 'boolean') {
          this.auditModeOnly = cfg.auditModeOnly;
        }
        if (cfg.activatedAt) {
          this.activatedAt = cfg.activatedAt;
        }
      } else {
        this.saveConfig();
      }
    } catch (e: any) {
      console.warn('[TelegramNotificationPipeline] Failed loading config:', e?.message);
    }
  }

  private saveConfig() {
    try {
      this.ensureDirExists();
      fs.writeFileSync(
        this.configPath,
        JSON.stringify({ auditModeOnly: this.auditModeOnly, activatedAt: this.activatedAt }, null, 2),
        'utf-8'
      );
    } catch (e: any) {
      console.error('[TelegramNotificationPipeline] Failed saving config:', e?.message);
    }
  }

  private loadFromDisk() {
    try {
      this.ensureDirExists();
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.records = parsed;
          for (const rec of this.records) {
            if (rec.dedupKey) {
              this.dedupKeys.add(rec.dedupKey);
            }
            if (rec.status === 'SENT' && rec.telegramMessageId) {
              if (!this.lastSuccessfulMessageId || rec.telegramMessageId > this.lastSuccessfulMessageId) {
                this.lastSuccessfulMessageId = rec.telegramMessageId;
                this.lastSuccessfulMessageAt = rec.lastAttemptAt || rec.createdAt;
              }
            }
          }
        }
      }

      if (fs.existsSync(this.decisionsPath)) {
        const rawDec = fs.readFileSync(this.decisionsPath, 'utf-8');
        const parsedDec = JSON.parse(rawDec);
        if (Array.isArray(parsedDec)) {
          this.decisions = parsedDec;
        }
      }
    } catch (err: any) {
      console.warn('[TelegramNotificationPipeline] Disk load warning:', err?.message);
    }
  }

  private saveToDisk() {
    try {
      this.ensureDirExists();
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.records.slice(0, 500), null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);

      const tempDecPath = `${this.decisionsPath}.tmp`;
      fs.writeFileSync(tempDecPath, JSON.stringify(this.decisions.slice(0, 500), null, 2), 'utf-8');
      fs.renameSync(tempDecPath, this.decisionsPath);
    } catch (err: any) {
      console.error('[TelegramNotificationPipeline] Disk save error:', err?.message);
    }
  }

  public getAuditMode(): boolean {
    return this.auditModeOnly;
  }

  public setAuditMode(enabled: boolean) {
    this.auditModeOnly = enabled;
    this.saveConfig();
  }

  public getWatermark(): string {
    return this.activatedAt;
  }

  public setWatermark(isoTimestamp: string) {
    this.activatedAt = isoTimestamp;
    this.saveConfig();
  }

  private checkCircuitBreaker(): boolean {
    const now = Date.now();
    const stateStore = TelegramNotificationStateStore.getInstance();
    const allStates = stateStore.getAllStates();

    // Gather SENT records in the last hour
    const sentLastHour = allStates.filter(s => {
      if (s.status !== 'SENT') return false;
      const sentTime = s.sentAt ? new Date(s.sentAt).getTime() : 0;
      return now - sentTime < 3600 * 1000;
    });

    const countLastMin = sentLastHour.filter(s => {
      const sentTime = s.sentAt ? new Date(s.sentAt).getTime() : 0;
      return now - sentTime < 60 * 1000;
    }).length;

    const countLastHour = sentLastHour.length;

    // Limit: 3 per minute or 10 per hour
    return countLastMin >= 3 || countLastHour >= 10;
  }

  public async processArticle(
    article: NewsArticleV2,
    overridePriority?: NotificationPriority
  ): Promise<{ enqueued: boolean; record?: TelegramNotificationRecord; reason?: string; decision?: QualityGateDecision; auditMode?: boolean }> {
    if (!article || !article.id) {
      return { enqueued: false, reason: 'INVALID_ARTICLE', decision: 'NO_ACTION' };
    }

    const telegramService = TelegramService.getInstance();
    const creds = telegramService.getCredentials();
    const chatId = creds.chatId || 'DEFAULT_CHAT';
    const dedupKey = `${article.id}:${chatId}:FO_INTEL`;

    const stateStore = TelegramNotificationStateStore.getInstance();

    // 0. Article Existence Guarantee: Verify article exists in PersistentNewsStore
    const canonicalArt = newsStore.getArticle(article.id) || newsStore.getAllArticles().find(a => a.id === article.id);
    if (!canonicalArt) {
      this.recordDecision({
        articleId: article.id,
        notificationKey: dedupKey,
        symbol: (article.fno?.symbol || 'MARKET').toUpperCase(),
        headline: article.headline,
        decision: 'NO_ACTION',
        priority: 'LOW',
        reason: 'SUMMARY_ORPHAN_BLOCKED: Article does not exist in PersistentNewsStore',
        evaluatedAt: new Date().toISOString(),
        auditModeOnly: this.auditModeOnly
      });
      return { enqueued: false, reason: 'SUMMARY_ORPHAN_BLOCKED', decision: 'NO_ACTION' };
    }

    // 1. Deduplication Check using persistent State Store (Replay-Proof)
    if (stateStore.hasState(dedupKey)) {
      const existingState = stateStore.getState(dedupKey);
      if (existingState && existingState.status === 'SENT') {
        this.recordDecision({
          articleId: article.id,
          notificationKey: dedupKey,
          symbol: (article.fno?.symbol || 'MARKET').toUpperCase(),
          headline: article.headline,
          decision: 'SUPPRESSED',
          priority: 'LOW',
          reason: 'Duplicate article already sent',
          evaluatedAt: new Date().toISOString()
        });
        const existingRecord = this.records.find(r => r.dedupKey === dedupKey);
        return { enqueued: false, reason: 'DUPLICATE_SUPPRESSED', record: existingRecord, decision: 'SUPPRESSED' };
      } else if (existingState) {
        // Already processed but in a non-terminal or failed state, do not recreate
        const existingRecord = this.records.find(r => r.dedupKey === dedupKey);
        return { enqueued: false, reason: `ALREADY_${existingState.status}`, record: existingRecord, decision: existingState.decision as QualityGateDecision };
      }
    }

    // 2. Evaluate via Telegram Quality Gate
    const circuitBreakerActive = this.checkCircuitBreaker();
    const evalResult: QualityGateResult = TelegramQualityGate.evaluate(article, {
      watermarkIso: this.activatedAt,
      circuitBreakerActive
    });

    const priority: NotificationPriority = overridePriority || (evalResult.priority as NotificationPriority);
    const stock = evalResult.symbol;

    // Record Decision in Audit Log
    const decisionRecord: TelegramNotificationDecision = {
      articleId: article.id,
      notificationKey: dedupKey,
      symbol: stock,
      headline: article.headline,
      decision: evalResult.decision,
      priority: priority,
      reason: evalResult.reason,
      evaluatedAt: new Date().toISOString(),
      auditModeOnly: this.auditModeOnly
    };

    if (evalResult.decision === 'NO_ACTION') {
      this.recordDecision(decisionRecord);
      return { enqueued: false, reason: evalResult.reason, decision: 'NO_ACTION' };
    }

    if (evalResult.decision === 'SUPPRESSED') {
      this.recordDecision(decisionRecord);
      // Suppress state save too
      stateStore.saveState({
        articleId: article.id,
        chatId,
        notificationType: 'FO_INTEL',
        decision: 'SUPPRESSED',
        status: 'SUPPRESSED',
        deduplicationKey: dedupKey,
        attemptCount: 0
      });
      return { enqueued: false, reason: evalResult.reason, decision: 'SUPPRESSED' };
    }

    // Prepare message content
    const formattedMessage = TraderTelegramFormatter.format(article, evalResult.optionsImpactSummary);

    const initialStatus: NotificationStatus = evalResult.decision === 'DIGEST_PENDING' ? 'DIGEST_PENDING' : 'QUEUED';

    const record: TelegramNotificationRecord = {
      notificationId: `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      articleId: article.id,
      chatId,
      stock,
      headline: article.headline,
      priority,
      status: initialStatus,
      attemptCount: 0,
      createdAt: new Date().toISOString(),
      dedupKey,
      formattedMessage,
      decisionReason: evalResult.reason
    };

    this.records.unshift(record);
    this.dedupKeys.add(dedupKey);

    // Save state before dispatching to keep it fully atomic (Persist first, dispatch second)
    stateStore.saveState({
      articleId: article.id,
      chatId,
      notificationType: 'FO_INTEL',
      decision: evalResult.decision,
      status: initialStatus,
      deduplicationKey: dedupKey,
      attemptCount: 0
    });

    // 3. Dispatch handling according to Decision & Audit Mode
    if (evalResult.decision === 'DIGEST_PENDING') {
      this.recordDecision(decisionRecord);
      this.saveToDisk();
      return { enqueued: true, record, decision: 'DIGEST_PENDING', reason: evalResult.reason };
    }

    // Immediate Alert handling
    if (this.auditModeOnly) {
      // AUDIT / DRY-RUN MODE: Log decision without sending live Telegram HTTP request
      record.status = 'SENT';
      record.httpStatus = 200;
      record.telegramOk = true;
      record.telegramMessageId = 9999000 + Math.floor(Math.random() * 900);
      record.lastAttemptAt = new Date().toISOString();

      stateStore.saveState({
        articleId: article.id,
        chatId,
        notificationType: 'FO_INTEL',
        decision: evalResult.decision,
        status: 'SENT',
        sentAt: record.lastAttemptAt,
        telegramMessageId: record.telegramMessageId,
        deduplicationKey: dedupKey,
        attemptCount: 1
      });

      decisionRecord.sentAt = record.lastAttemptAt;
      decisionRecord.telegramMessageId = record.telegramMessageId;
      this.recordDecision(decisionRecord);
      this.saveToDisk();

      return { enqueued: true, record, decision: 'IMMEDIATE', auditMode: true };
    } else {
      // LIVE DISPATCH MODE
      const sendRes = await this.dispatchRecord(record);
      if (sendRes.success) {
        decisionRecord.sentAt = record.lastAttemptAt;
        decisionRecord.telegramMessageId = record.telegramMessageId;
      }
      this.recordDecision(decisionRecord);
      return { enqueued: true, record, decision: 'IMMEDIATE', auditMode: false };
    }
  }

  private recordDecision(dec: TelegramNotificationDecision) {
    this.decisions.unshift(dec);
    if (this.decisions.length > 500) {
      this.decisions = this.decisions.slice(0, 500);
    }
    this.saveToDisk();
  }

  private async dispatchRecord(record: TelegramNotificationRecord): Promise<TelegramSendResult> {
    const stateStore = TelegramNotificationStateStore.getInstance();
    
    record.status = 'SENDING';
    record.attemptCount++;
    record.lastAttemptAt = new Date().toISOString();

    stateStore.saveState({
      articleId: record.articleId,
      chatId: record.chatId,
      notificationType: 'FO_INTEL',
      decision: 'IMMEDIATE',
      status: 'SENDING',
      deduplicationKey: record.dedupKey,
      attemptCount: record.attemptCount
    });

    const telegramService = TelegramService.getInstance();
    const result = await telegramService.sendMessage(record.formattedMessage);

    if (result.success && result.messageId) {
      record.status = 'SENT';
      record.httpStatus = 200;
      record.telegramOk = true;
      record.telegramMessageId = result.messageId;
      record.errorCode = undefined;
      record.errorDescription = undefined;

      stateStore.saveState({
        articleId: record.articleId,
        chatId: record.chatId,
        notificationType: 'FO_INTEL',
        decision: 'IMMEDIATE',
        status: 'SENT',
        sentAt: record.lastAttemptAt,
        telegramMessageId: result.messageId,
        deduplicationKey: record.dedupKey,
        attemptCount: record.attemptCount
      });

      this.lastSuccessfulMessageId = result.messageId;
      this.lastSuccessfulMessageAt = record.lastAttemptAt;
      this.lastError = null;
    } else {
      record.httpStatus = result.httpStatus || 500;
      record.telegramOk = false;
      record.errorCode = result.errorCode || `HTTP_${result.httpStatus}`;
      record.errorDescription = result.error || 'Telegram delivery failed';
      this.lastError = record.errorDescription;

      let nextStatus: NotificationStatus = 'QUEUED';
      if (result.httpStatus === 401 || result.httpStatus === 403 || result.httpStatus === 400) {
        nextStatus = 'FAILED';
      } else {
        if (record.attemptCount >= 3) {
          nextStatus = 'FAILED';
          record.errorDescription = `Max retries (3) exceeded: ${record.errorDescription}`;
        }
      }

      record.status = nextStatus;

      stateStore.saveState({
        articleId: record.articleId,
        chatId: record.chatId,
        notificationType: 'FO_INTEL',
        decision: 'IMMEDIATE',
        status: nextStatus,
        deduplicationKey: record.dedupKey,
        attemptCount: record.attemptCount,
        lastError: record.errorDescription
      });
    }

    this.saveToDisk();
    return result;
  }

  public async dispatchDigest(): Promise<{ sent: boolean; itemCount: number; messageId?: number; error?: string }> {
    const pendingItems = this.records.filter(r => r.status === 'DIGEST_PENDING');
    if (pendingItems.length === 0) {
      return { sent: false, itemCount: 0, error: 'No items pending digest' };
    }

    // Sort pending items descending by priority weight
    const priorityWeights: Record<string, number> = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0 };
    pendingItems.sort((a, b) => {
      const weightA = priorityWeights[a.priority] ?? 0;
      const weightB = priorityWeights[b.priority] ?? 0;
      return weightB - weightA;
    });

    const itemsToDigest = pendingItems.slice(0, 10);
    const stateStore = TelegramNotificationStateStore.getInstance();

    // Build compact high-density digest message template
    let digestMsg = `📰 <b>ATHENA F&O DIGEST</b>\n━━━━━━━━━━━━━━\n\n`;
    digestMsg += `<b>${itemsToDigest.length} material developments</b>\n\n`;

    itemsToDigest.forEach((item) => {
      digestMsg += `<b>${item.stock.toUpperCase()}</b>\n`;
      const metrics = FinancialMetricEngine.extractMetrics(item.headline);
      if (metrics && metrics.length > 0) {
        for (const m of metrics.slice(0, 2)) {
          let changeStr = '';
          if (m.changePercent !== undefined && m.changePercent !== null) {
            const sign = m.changePercent >= 0 ? '+' : '-';
            changeStr = ` (${sign}${Math.abs(m.changePercent)}%)`;
          }
          digestMsg += `• ${m.metricName} ${m.displayText}${changeStr}\n`;
        }
      } else {
        const cleanHeadline = item.headline.length > 80 ? item.headline.slice(0, 77) + '...' : item.headline;
        digestMsg += `• ${cleanHeadline}\n`;
      }
      digestMsg += `Impact: ${item.priority}\n\n`;
    });

    digestMsg += `<b>Source:</b> ATHENA Real-Time Intelligence Engine`;

    if (this.auditModeOnly) {
      const mockMsgId = 8888000 + Math.floor(Math.random() * 900);
      const sentTime = new Date().toISOString();

      itemsToDigest.forEach(item => {
        item.status = 'SENT';
        item.telegramMessageId = mockMsgId;
        item.lastAttemptAt = sentTime;
        item.telegramOk = true;
        item.httpStatus = 200;

        stateStore.saveState({
          articleId: item.articleId,
          chatId: item.chatId,
          notificationType: 'FO_INTEL',
          decision: 'DIGEST_PENDING',
          status: 'SENT',
          sentAt: sentTime,
          telegramMessageId: mockMsgId,
          deduplicationKey: item.dedupKey,
          attemptCount: 1
        });
      });

      this.lastSuccessfulMessageId = mockMsgId;
      this.lastSuccessfulMessageAt = sentTime;
      this.saveToDisk();
      return { sent: true, itemCount: itemsToDigest.length, messageId: mockMsgId };
    }

    const telegramService = TelegramService.getInstance();
    const result = await telegramService.sendMessage(digestMsg);

    if (result.success && result.messageId) {
      const sentTime = new Date().toISOString();

      itemsToDigest.forEach(item => {
        item.status = 'SENT';
        item.telegramMessageId = result.messageId;
        item.lastAttemptAt = sentTime;
        item.telegramOk = true;
        item.httpStatus = 200;

        stateStore.saveState({
          articleId: item.articleId,
          chatId: item.chatId,
          notificationType: 'FO_INTEL',
          decision: 'DIGEST_PENDING',
          status: 'SENT',
          sentAt: sentTime,
          telegramMessageId: result.messageId,
          deduplicationKey: item.dedupKey,
          attemptCount: 1
        });
      });

      this.lastSuccessfulMessageId = result.messageId;
      this.lastSuccessfulMessageAt = sentTime;
      this.saveToDisk();
      return { sent: true, itemCount: itemsToDigest.length, messageId: result.messageId };
    } else {
      return { sent: false, itemCount: 0, error: result.error || 'Digest delivery failed' };
    }
  }

  public async retryFailedNotifications(): Promise<{ processed: number; succeeded: number }> {
    const stateStore = TelegramNotificationStateStore.getInstance();
    const failedStates = stateStore.getAllStates().filter(s => s.status === 'FAILED');
    let succeeded = 0;

    for (const state of failedStates) {
      const record = this.records.find(r => r.dedupKey === state.deduplicationKey);
      if (record) {
        const result = await this.dispatchRecord(record);
        if (result.success) {
          succeeded++;
        }
      }
    }

    return { processed: failedStates.length, succeeded };
  }

  public async sendTestMessage(
    customText?: string,
    customToken?: string,
    customChatId?: string
  ): Promise<TelegramSendResult> {
    const telegramService = TelegramService.getInstance();
    const creds = telegramService.getCredentials();

    const targetChat = (customChatId || creds.chatId || 'TEST_CHAT').trim();
    const textToSend = customText || `🔴 <b>ATHENA TELEGRAM TEST SIGNAL</b>\n\n<b>Stock:</b> TATAMOTORS\n<b>Catalyst:</b> End-To-End Verification Ping\n<b>Status:</b> System Connected & Verified\n\n<b>Source:</b> ATHENA Real-Time Dispatch`;

    const record: TelegramNotificationRecord = {
      notificationId: `ntf_test_${Date.now()}`,
      articleId: `art_test_${Date.now()}`,
      chatId: targetChat,
      stock: 'TATAMOTORS',
      headline: 'Athena Telegram Verification Ping',
      priority: 'CRITICAL',
      status: 'SENDING',
      attemptCount: 1,
      createdAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
      dedupKey: `test:${Date.now()}`,
      formattedMessage: textToSend
    };

    const res = await telegramService.sendMessage(textToSend, customToken, customChatId);
    const stateStore = TelegramNotificationStateStore.getInstance();

    if (res.success && res.messageId) {
      record.status = 'SENT';
      record.httpStatus = 200;
      record.telegramOk = true;
      record.telegramMessageId = res.messageId;

      stateStore.saveState({
        articleId: record.articleId,
        chatId: record.chatId,
        notificationType: 'TEST_ALERT',
        decision: 'IMMEDIATE',
        status: 'SENT',
        sentAt: record.lastAttemptAt,
        telegramMessageId: res.messageId,
        deduplicationKey: record.dedupKey,
        attemptCount: 1
      });

      this.lastSuccessfulMessageId = res.messageId;
      this.lastSuccessfulMessageAt = record.lastAttemptAt;
      this.lastError = null;
    } else {
      record.status = 'FAILED';
      record.httpStatus = res.httpStatus || 500;
      record.telegramOk = false;
      record.errorCode = res.errorCode || `HTTP_${res.httpStatus}`;
      record.errorDescription = sanitizeTelegramLog(res.error || 'Delivery failed');
      this.lastError = record.errorDescription;

      stateStore.saveState({
        articleId: record.articleId,
        chatId: record.chatId,
        notificationType: 'TEST_ALERT',
        decision: 'IMMEDIATE',
        status: 'FAILED',
        deduplicationKey: record.dedupKey,
        attemptCount: 1,
        lastError: record.errorDescription
      });
    }

    this.records.unshift(record);
    this.saveToDisk();

    return res;
  }

  public getHistory(limit = 100): TelegramNotificationRecord[] {
    return this.records.slice(0, limit);
  }

  public getDecisionsHistory(limit = 100): TelegramNotificationDecision[] {
    return this.decisions.slice(0, limit);
  }

  public getTelemetryStats(): TelemetryStats {
    const telegramService = TelegramService.getInstance();
    const conn = telegramService.getStatusReport().connected;

    const stateStore = TelegramNotificationStateStore.getInstance();
    const allStates = stateStore.getAllStates();

    const liveNotifications = allStates.filter(s => s.status === 'SENT' && s.decision === 'IMMEDIATE' && s.notificationType !== 'TEST_ALERT').length;
    const suppressedCount = this.decisions.filter(d => d.decision === 'SUPPRESSED' || d.decision === 'NO_ACTION').length;
    const digestPendingCount = allStates.filter(s => s.status === 'DIGEST_PENDING').length;
    const sentCount = allStates.filter(s => s.status === 'SENT').length;
    const failedCount = allStates.filter(s => s.status === 'FAILED').length;
    const lastAlert = this.records.find(r => r.status === 'SENT') || null;

    return {
      connected: conn,
      auditModeOnly: this.auditModeOnly,
      activatedAt: this.activatedAt,
      liveNotifications,
      suppressedCount,
      digestPendingCount,
      sentCount,
      failedCount,
      lastAlert,
      lastSuccessfulMessageId: this.lastSuccessfulMessageId,
      lastSuccessfulMessageAt: this.lastSuccessfulMessageAt,
      lastError: this.lastError,
      decisionsHistory: this.decisions.slice(0, 100)
    };
  }

  public clearHistory(): void {
    this.records = [];
    this.decisions = [];
    this.dedupKeys.clear();
    TelegramQualityGate.clearClusterHistory();
    TelegramNotificationStateStore.getInstance().clear();
    this.lastSuccessfulMessageId = null;
    this.lastSuccessfulMessageAt = null;
    this.lastError = null;
    this.saveToDisk();
  }
}
