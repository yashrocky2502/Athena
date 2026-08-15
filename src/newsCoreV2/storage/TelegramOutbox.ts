import fs from "fs";
import path from "path";

export interface TelegramOutboxEntry {
  articleId: string;
  payload: any; // Notification payload
  attempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
}

export class TelegramOutbox {
  private filePath: string;
  private entries: TelegramOutboxEntry[] = [];

  constructor() {
    this.filePath = path.join(process.cwd(), "data", "telegram_outbox.json");
    this.hydrate();
  }

  private hydrate() {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, "utf-8");
        this.entries = JSON.parse(data);
      } catch (e) {
        console.error("[TelegramOutbox] Hydration failed:", e);
      }
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
    } catch (e) {
      console.error("[TelegramOutbox] Save failed:", e);
    }
  }

  public addEntry(articleId: string, payload: any) {
    this.entries.push({
      articleId,
      payload,
      attempts: 0
    });
    this.save();
  }

  public removeEntry(articleId: string) {
    this.entries = this.entries.filter(e => e.articleId !== articleId);
    this.save();
  }

  public getEntries(): TelegramOutboxEntry[] {
    return this.entries;
  }
}
