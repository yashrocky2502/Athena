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

  constructor(customFilePath?: string) {
    this.filePath = customFilePath || path.join(process.cwd(), "data", "telegram_outbox.json");
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
    if (!this.filePath) return;
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${this.filePath}.${Date.now()}_${Math.random().toString(36).substring(2, 8)}.tmp`;
    try {
      const jsonStr = JSON.stringify(this.entries, null, 2);
      fs.writeFileSync(tempPath, jsonStr, "utf-8");

      const tempContent = fs.readFileSync(tempPath, "utf-8");
      const parsed = JSON.parse(tempContent);

      if (!Array.isArray(parsed)) {
        throw new Error(`[TelegramOutbox] Save validation failed: expected array for ${this.filePath}`);
      }

      fs.renameSync(tempPath, this.filePath);
    } catch (e) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
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
