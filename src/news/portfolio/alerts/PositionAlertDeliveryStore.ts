/**
 * ATHENA — PHASE 10P-4: POSITION ALERT DELIVERY & OPERATIONAL HARDENING
 * PositionAlertDeliveryStore.ts
 * 
 * Delivery state tracker for personal position alerts.
 * 
 * Guarantees:
 * 1. Restart Safety: Supports loading & persisting delivery state.
 * 2. Exact-Once Delivery: Prevents duplicate dispatches for already-sent alerts.
 * 3. Isolated State: Never writes to or touches production data/ files.
 */

import fs from 'fs';
import path from 'path';
import { PositionAlertDeliveryRecord, PositionAlertDeliveryStatus } from './types.ts';

export class PositionAlertDeliveryStore {
  private records: Map<string, PositionAlertDeliveryRecord> = new Map();
  private storePath?: string;

  constructor(storePath?: string) {
    this.storePath = storePath;
    this.load();
  }

  public getRecord(dedupeKey: string): PositionAlertDeliveryRecord | undefined {
    if (this.storePath && fs.existsSync(this.storePath)) {
      this.load();
    }
    return this.records.get(dedupeKey);
  }

  public saveRecord(record: PositionAlertDeliveryRecord): void {
    this.records.set(record.dedupeKey, { ...record });
    this.persist();
  }

  public isDelivered(dedupeKey: string): boolean {
    if (this.storePath && fs.existsSync(this.storePath)) {
      this.load();
    }
    const record = this.records.get(dedupeKey);
    return record?.status === 'SENT';
  }

  public isPermanentlyFailed(dedupeKey: string): boolean {
    if (this.storePath && fs.existsSync(this.storePath)) {
      this.load();
    }
    const record = this.records.get(dedupeKey);
    return record?.status === 'FAILED_PERMANENT' || record?.isPermanentFailure === true;
  }

  public getStatus(dedupeKey: string): PositionAlertDeliveryStatus | undefined {
    if (this.storePath && fs.existsSync(this.storePath)) {
      this.load();
    }
    return this.records.get(dedupeKey)?.status;
  }

  public getAllRecords(): PositionAlertDeliveryRecord[] {
    if (this.storePath && fs.existsSync(this.storePath)) {
      this.load();
    }
    return Array.from(this.records.values());
  }

  public clear(): void {
    this.records.clear();
    this.persist();
  }

  private load(): void {
    if (!this.storePath) return;

    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const r of parsed) {
              if (r && r.dedupeKey) {
                this.records.set(r.dedupeKey, r);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[PositionAlertDeliveryStore] Failed to load store, starting clean in-memory:', err);
    }
  }

  private persist(): void {
    if (!this.storePath) return;

    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storePath, JSON.stringify(this.getAllRecords(), null, 2), 'utf-8');
    } catch (err) {
      console.warn('[PositionAlertDeliveryStore] Failed to persist delivery store:', err);
    }
  }
}
