export type SyncState = "IDLE" | "SYNCING" | "COMPLETED" | "FAILED";

export interface SyncStatusReport {
  syncState: SyncState;
  lastSuccessfulSyncAt: string | null;
  lastAttemptAt: string | null;
  nextSyncAt: string | null;
  lastSyncItemCount: number;
  lastSyncDurationMs?: number | null;
  lastError?: string | null;
}
