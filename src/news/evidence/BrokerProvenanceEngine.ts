/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * BrokerProvenanceEngine.ts
 * 
 * End-to-End Order-to-Fill Provenance Tracer:
 * Decision -> ExecutionIntent -> OrderPlan -> Order -> BrokerAdapter -> BrokerResponse -> Fill -> Reconciliation -> Outcome.
 */

import { BrokerProvenanceTrace } from './types.ts';

export class BrokerProvenanceEngine {
  private static instance: BrokerProvenanceEngine;
  private traces: Map<string, BrokerProvenanceTrace> = new Map();

  private constructor() {}

  public static getInstance(): BrokerProvenanceEngine {
    if (!BrokerProvenanceEngine.instance) {
      BrokerProvenanceEngine.instance = new BrokerProvenanceEngine();
    }
    return BrokerProvenanceEngine.instance;
  }

  public recordBrokerTrace(trace: BrokerProvenanceTrace): void {
    this.traces.set(trace.decisionId, trace);
    this.traces.set(trace.executionIntentId, trace);
    if (trace.brokerOrderId) {
      this.traces.set(trace.brokerOrderId, trace);
    }
  }

  public getTrace(id: string): BrokerProvenanceTrace | undefined {
    return this.traces.get(id);
  }

  public getAllTraces(): BrokerProvenanceTrace[] {
    return Array.from(new Set(this.traces.values()));
  }
}

export const brokerProvenanceEngine = BrokerProvenanceEngine.getInstance();
