
import { PipelineStage } from "../types";

export interface LatencyMetric {
  stage: string;
  latencyMs: number;
  timestamp: string;
}

export interface ProfilerSummary {
  stage: string;
  avg: number;
  p95: number;
  max: number;
  count: number;
}

export class ProfilerService {
  private static instance: ProfilerService;
  private metrics: LatencyMetric[] = [];
  private maxMetrics = 1000;

  private constructor() {}

  public static getInstance(): ProfilerService {
    if (!ProfilerService.instance) {
      ProfilerService.instance = new ProfilerService();
    }
    return ProfilerService.instance;
  }

  public record(stage: string | PipelineStage, latencyMs: number) {
    this.metrics.push({
      stage: stage.toString(),
      latencyMs,
      timestamp: new Date().toISOString()
    });

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  public getSummary(): ProfilerSummary[] {
    const stages = Array.from(new Set(this.metrics.map(m => m.stage)));
    
    return stages.map(stage => {
      const stageMetrics = this.metrics.filter(m => m.stage === stage).map(m => m.latencyMs);
      const count = stageMetrics.length;
      if (count === 0) return { stage, avg: 0, p95: 0, max: 0, count: 0 };

      const sorted = [...stageMetrics].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const avg = sum / count;
      const max = sorted[count - 1];
      const p95Idx = Math.floor(count * 0.95);
      const p95 = sorted[p95Idx];

      return {
        stage,
        avg: Math.round(avg),
        p95: Math.round(p95),
        max: Math.round(max),
        count
      };
    });
  }

  public clear() {
    this.metrics = [];
  }

  public addExternalMetrics(metrics: Record<string, number>) {
    Object.entries(metrics).forEach(([stage, latencyMs]) => {
      this.record(stage, latencyMs);
    });
  }

  public getRawMetrics(): LatencyMetric[] {
    return this.metrics;
  }
}
