import fs from 'fs';
import path from 'path';

export type NotificationStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'DIGEST_PENDING' | 'SUPPRESSED';

export interface TelegramNotificationState {
  articleId: string;
  chatId: string;
  notificationType: string; // e.g. 'FO_INTEL'
  decision: string; // 'IMMEDIATE' | 'DIGEST_PENDING' | 'SUPPRESSED' | 'NO_ACTION'
  status: NotificationStatus;
  sentAt?: string;
  telegramMessageId?: number;
  deduplicationKey: string; // `${articleId}:${chatId}:${notificationType}`
  attemptCount: number;
  lastError?: string;
}

export class TelegramNotificationStateStore {
  private static instance: TelegramNotificationStateStore;
  private states: Map<string, TelegramNotificationState> = new Map();
  private filePath: string;

  private constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'telegram_notification_state.json');
    this.loadFromDisk();
  }

  public static getInstance(): TelegramNotificationStateStore {
    if (!TelegramNotificationStateStore.instance) {
      TelegramNotificationStateStore.instance = new TelegramNotificationStateStore();
    }
    return TelegramNotificationStateStore.instance;
  }

  private loadFromDisk() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const s of parsed) {
              this.states.set(s.deduplicationKey, s);
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('[TelegramNotificationStateStore] Failed to load states:', e?.message);
    }
  }

  public saveToDisk() {
    try {
      const list = Array.from(this.states.values());
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e: any) {
      console.error('[TelegramNotificationStateStore] Failed to save states:', e?.message);
    }
  }

  public getState(dedupKey: string): TelegramNotificationState | undefined {
    return this.states.get(dedupKey);
  }

  public hasState(dedupKey: string): boolean {
    return this.states.has(dedupKey);
  }

  public saveState(state: TelegramNotificationState) {
    this.states.set(state.deduplicationKey, state);
    this.saveToDisk();
  }

  public getAllStates(): TelegramNotificationState[] {
    return Array.from(this.states.values());
  }

  public clear(): void {
    this.states.clear();
    this.saveToDisk();
  }
}
