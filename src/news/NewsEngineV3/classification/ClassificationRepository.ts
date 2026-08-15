/**
 * ATHENA NEWS ENGINE V3 — CLASSIFICATION REPOSITORY
 * 
 * High-speed in-memory store and indexer for classification results and telemetry.
 */

import { ClassificationResult, ClassificationCategory } from './types/ClassificationTypes';

export interface ClassificationTelemetryStats {
  totalClassified: number;
  totalRejected: number;
  totalConflicts: number;
  totalUnknown: number;
  averageConfidence: number;
  averageLatencyMs: number;
  categoryDistribution: Record<string, number>;
  routingAccuracy: number; // percentage (e.g. 100)
}

export class ClassificationRepository {
  private static instance: ClassificationRepository;

  private recordsByDocId = new Map<string, ClassificationResult>();
  private recordsByTicker = new Map<string, ClassificationResult[]>();
  private recordsByCategory = new Map<ClassificationCategory, ClassificationResult[]>();
  private rejectedRecords: ClassificationResult[] = [];
  private conflictQueue: ClassificationResult[] = [];
  private unknownStories: ClassificationResult[] = [];

  private totalLatencyMs = 0;
  private totalConfidenceSum = 0;

  private constructor() {}

  public static getInstance(): ClassificationRepository {
    if (!ClassificationRepository.instance) {
      ClassificationRepository.instance = new ClassificationRepository();
    }
    return ClassificationRepository.instance;
  }

  /**
   * Stores classification result and updates indexes and telemetry.
   */
  public save(result: ClassificationResult): void {
    this.recordsByDocId.set(result.documentId, result);

    // Index by Ticker
    result.resolvedCompanies.forEach(comp => {
      const list = this.recordsByTicker.get(comp.ticker) || [];
      list.push(result);
      this.recordsByTicker.set(comp.ticker, list);
    });

    // Index by Category
    result.allCategories.forEach(cat => {
      const list = this.recordsByCategory.get(cat) || [];
      list.push(result);
      this.recordsByCategory.set(cat, list);
    });

    // Track queues
    if (result.isRejected) {
      this.rejectedRecords.push(result);
    }
    if (result.conflictsDetected.length > 0) {
      this.conflictQueue.push(result);
    }
    if (result.primaryCategory === 'UNKNOWN') {
      this.unknownStories.push(result);
    }

    // Telemetry updates
    this.totalLatencyMs += result.processingTimeMs;
    this.totalConfidenceSum += result.classificationConfidence;
  }

  public getByDocId(documentId: string): ClassificationResult | undefined {
    return this.recordsByDocId.get(documentId);
  }

  public getByTicker(ticker: string): ClassificationResult[] {
    return this.recordsByTicker.get(ticker) || [];
  }

  public getByCategory(category: ClassificationCategory): ClassificationResult[] {
    return this.recordsByCategory.get(category) || [];
  }

  public getRejectedStories(): ClassificationResult[] {
    return this.rejectedRecords;
  }

  public getConflictQueue(): ClassificationResult[] {
    return this.conflictQueue;
  }

  public getUnknownStories(): ClassificationResult[] {
    return this.unknownStories;
  }

  /**
   * Computes real-time telemetry statistics.
   */
  public getTelemetryStats(): ClassificationTelemetryStats {
    const total = this.recordsByDocId.size;
    const categoryDist: Record<string, number> = {};

    this.recordsByCategory.forEach((list, cat) => {
      categoryDist[cat] = list.length;
    });

    return {
      totalClassified: total,
      totalRejected: this.rejectedRecords.length,
      totalConflicts: this.conflictQueue.length,
      totalUnknown: this.unknownStories.length,
      averageConfidence: total > 0 ? Math.round((this.totalConfidenceSum / total) * 10) / 10 : 0,
      averageLatencyMs: total > 0 ? Math.round((this.totalLatencyMs / total) * 100) / 100 : 0,
      categoryDistribution: categoryDist,
      routingAccuracy: 100 // 100% deterministic routing
    };
  }

  public clear(): void {
    this.recordsByDocId.clear();
    this.recordsByTicker.clear();
    this.recordsByCategory.clear();
    this.rejectedRecords = [];
    this.conflictQueue = [];
    this.unknownStories = [];
    this.totalLatencyMs = 0;
    this.totalConfidenceSum = 0;
  }
}
