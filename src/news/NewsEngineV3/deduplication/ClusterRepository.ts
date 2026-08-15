/**
 * ATHENA NEWS ENGINE V3 — CLUSTER REPOSITORY
 * 
 * In-memory high-speed indexing and storage for active StoryClusters.
 * Provides fast lookup by ticker, document ID, event type, and recency window.
 */

import { StoryCluster, ClusterType } from './types/DeduplicationTypes';

export class ClusterRepository {
  private static instance: ClusterRepository;
  private clusters: Map<string, StoryCluster> = new Map();
  private tickerIndex: Map<string, Set<string>> = new Map();
  private docIdIndex: Map<string, string> = new Map(); // docId -> clusterId

  private constructor() {}

  public static getInstance(): ClusterRepository {
    if (!ClusterRepository.instance) {
      ClusterRepository.instance = new ClusterRepository();
    }
    return ClusterRepository.instance;
  }

  public saveCluster(cluster: StoryCluster): void {
    this.clusters.set(cluster.clusterId, cluster);

    // Index by tickers
    cluster.tickers.forEach(ticker => {
      if (!this.tickerIndex.has(ticker)) {
        this.tickerIndex.set(ticker, new Set());
      }
      this.tickerIndex.get(ticker)!.add(cluster.clusterId);
    });

    // Index by document IDs
    cluster.documents.forEach(doc => {
      this.docIdIndex.set(doc.documentId, cluster.clusterId);
    });
  }

  public getClusterById(clusterId: string): StoryCluster | undefined {
    return this.clusters.get(clusterId);
  }

  public getClusterByDocId(documentId: string): StoryCluster | undefined {
    const clusterId = this.docIdIndex.get(documentId);
    return clusterId ? this.clusters.get(clusterId) : undefined;
  }

  /**
   * Finds candidate clusters matching any of the tickers or created within recent window (e.g., 7 days).
   */
  public findCandidates(tickers: string[], maxAgeHours = 168): StoryCluster[] {
    const candidateIds = new Set<string>();

    // 1. Ticker matches
    tickers.forEach(ticker => {
      const ids = this.tickerIndex.get(ticker);
      if (ids) {
        ids.forEach(id => candidateIds.add(id));
      }
    });

    // If no tickers provided or no ticker match, return recent active clusters
    if (candidateIds.size === 0) {
      const now = Date.now();
      this.clusters.forEach(cluster => {
        const ageHours = (now - new Date(cluster.metadata.firstSeenAt).getTime()) / (1000 * 3600);
        if (ageHours <= maxAgeHours) {
          candidateIds.add(cluster.clusterId);
        }
      });
    }

    const candidates: StoryCluster[] = [];
    candidateIds.forEach(id => {
      const c = this.clusters.get(id);
      if (c) candidates.push(c);
    });

    return candidates;
  }

  public getAllClusters(): StoryCluster[] {
    return Array.from(this.clusters.values());
  }

  public getClustersByType(eventType: ClusterType): StoryCluster[] {
    return this.getAllClusters().filter(c => c.eventType === eventType);
  }

  public clear(): void {
    this.clusters.clear();
    this.tickerIndex.clear();
    this.docIdIndex.clear();
  }
}
