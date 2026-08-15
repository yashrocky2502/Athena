import { PipelineEvent, PipelineTrace, PipelineStage, Priority, NotificationChannel } from "../types";
import { safeLocalStorage } from "./storage/safeStorage";

export class PipelineMonitorService {
  private static instance: PipelineMonitorService;
  private traces: Map<string, PipelineTrace> = new Map();
  private maxTraces = 50;

  private constructor() {
    this.loadTraces();
  }

  public static getInstance(): PipelineMonitorService {
    if (!PipelineMonitorService.instance) {
      PipelineMonitorService.instance = new PipelineMonitorService();
    }
    return PipelineMonitorService.instance;
  }

  private loadTraces() {
    const saved = safeLocalStorage.getItem("athena_pipeline_traces");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.traces = new Map(Object.entries(parsed));
      } catch (e) {
        console.error("Failed to load pipeline traces", e);
      }
    }
  }

  private saveTraces() {
    const obj = Object.fromEntries(this.traces);
    safeLocalStorage.setItem("athena_pipeline_traces", JSON.stringify(obj));
  }

  public recordEvent(event: Omit<PipelineEvent, "id" | "timestamp">): string {
    const id = `pe-${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();
    const fullEvent: PipelineEvent = { ...event, id, timestamp };

    let trace = this.traces.get(event.traceId);
    if (!trace) {
      trace = {
        traceId: event.traceId,
        startTime: timestamp,
        status: "In-Progress",
        events: []
      };
      this.traces.set(event.traceId, trace);
      
      // Enforce max traces
      if (this.traces.size > this.maxTraces) {
        const oldestKey = this.traces.keys().next().value;
        if (oldestKey) this.traces.delete(oldestKey);
      }
    }

    trace.events.push(fullEvent);
    
    if (event.stage === PipelineStage.Delivered && event.status === "Success") {
      trace.status = "Completed";
      trace.endTime = timestamp;
    } else if (event.status === "Failure") {
      trace.status = "Failed";
    }

    this.saveTraces();
    return id;
  }

  public getTraces(): PipelineTrace[] {
    return Array.from(this.traces.values()).sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  public getTrace(traceId: string): PipelineTrace | undefined {
    return this.traces.get(traceId);
  }

  public clearTraces() {
    this.traces.clear();
    this.saveTraces();
  }
}
