/**
 * ATHENA NEWS ENGINE V3 — COLLECTOR INTERFACE & CONTRACTS
 */

import { V3PublisherId, V3RawArticle } from '../types/V3Types';

export type V3CollectorState =
  | 'STARTING'
  | 'RUNNING'
  | 'RETRYING'
  | 'PAUSED'
  | 'FAILED'
  | 'OFFLINE';

export interface V3CollectorHealthMetrics {
  collectorId: V3PublisherId;
  name: string;
  state: V3CollectorState;
  lastFetchAt?: string;
  totalArticlesFetched: number;
  totalFetchAttempts: number;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  avgLatencyMs: number;
  healthPercentage: number; // 0-100
  lastError?: string;
}

export interface ICollector {
  id: V3PublisherId;
  name: string;
  getState(): V3CollectorState;
  getHealth(): V3CollectorHealthMetrics;
  initialize(): Promise<void>;
  fetch(): Promise<V3RawArticle[]>;
  validate(article: V3RawArticle): boolean;
  pause(): void;
  resume(): void;
  restart(): Promise<void>;
  shutdown(): Promise<void>;
}
