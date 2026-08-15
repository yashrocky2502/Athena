import { AthenaAlert } from "../types";

export interface AlertMetric {
  alertId: string;
  timestamp: string;
  action: "delivered" | "opened" | "dismissed" | "suppressed";
  reason?: string;
  isDuplicate?: boolean;
}

export class LearningEngine {
  private static instance: LearningEngine;
  private metrics: AlertMetric[] = [];

  private constructor() {}

  public static getInstance(): LearningEngine {
    if (!LearningEngine.instance) {
      LearningEngine.instance = new LearningEngine();
    }
    return LearningEngine.instance;
  }

  public track(metric: AlertMetric) {
    this.metrics.unshift(metric);
    if (this.metrics.length > 1000) this.metrics.pop();
    
    // In a real app, this would persist to a database and periodically 
    // adjust scoring thresholds in AlertDecisionEngine
    console.log(`[LearningEngine] Tracked ${metric.action} for alert ${metric.alertId}`);
  }

  public getStats() {
    const total = this.metrics.length;
    const delivered = this.metrics.filter(m => m.action === "delivered").length;
    const suppressed = this.metrics.filter(m => m.action === "suppressed").length;
    const duplicates = this.metrics.filter(m => m.isDuplicate).length;

    return {
      totalProcessed: total,
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      suppressionRate: total > 0 ? (suppressed / total) * 100 : 0,
      duplicateCount: duplicates
    };
  }
}
