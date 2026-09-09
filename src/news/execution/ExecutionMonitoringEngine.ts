/**
 * ATHENA NEWS ENGINE — PHASE 14
 * ExecutionMonitoringEngine.ts
 * 
 * Execution Monitoring Engine.
 * Tracks execution health metrics: fill rates, latencies, slippage, rejection rates, and connectivity.
 */

import { ExecutionHealthReport, ExecutionOrder } from './types.ts';
import { executionAdapterFactory } from './ExecutionAdapterFactory.ts';
import { executionKillSwitch } from './ExecutionKillSwitch.ts';

export class ExecutionMonitoringEngine {
  private static instance: ExecutionMonitoringEngine;
  private submittedOrders: ExecutionOrder[] = [];

  private constructor() {}

  public static getInstance(): ExecutionMonitoringEngine {
    if (!this.instance) {
      this.instance = new ExecutionMonitoringEngine();
    }
    return this.instance;
  }

  public recordOrder(order: ExecutionOrder) {
    this.submittedOrders.push(order);
  }

  /**
   * Generates a comprehensive Execution Health Report.
   */
  public generateHealthReport(): ExecutionHealthReport {
    const adapter = executionAdapterFactory.getAdapter();
    const mode = executionAdapterFactory.getMode();
    const killSwitch = executionKillSwitch.getStatus();

    const totalOrdersSubmitted = this.submittedOrders.length;
    const filledOrders = this.submittedOrders.filter(o => o.status === 'FILLED');
    const rejectedOrders = this.submittedOrders.filter(o => o.status === 'REJECTED' || o.status === 'FAILED');

    const filledOrdersCount = filledOrders.length;
    const rejectedOrdersCount = rejectedOrders.length;

    const fillRatePct = totalOrdersSubmitted > 0 ? Number(((filledOrdersCount / totalOrdersSubmitted) * 100).toFixed(1)) : 100;
    const rejectionRatePct = totalOrdersSubmitted > 0 ? Number(((rejectedOrdersCount / totalOrdersSubmitted) * 100).toFixed(1)) : 0;

    const avgSlippagePct = filledOrders.length > 0
      ? Number((filledOrders.reduce((sum, o) => sum + o.slippagePct, 0) / filledOrders.length).toFixed(2))
      : 0;

    return {
      brokerConnected: adapter.isAuthenticated(),
      adapterName: adapter.adapterName,
      mode,
      totalOrdersSubmitted,
      filledOrdersCount,
      rejectedOrdersCount,
      fillRatePct,
      avgOrderLatencyMs: 240, // Simulated network/API latency in milliseconds
      avgSlippagePct,
      rejectionRatePct,
      killSwitchStatus: killSwitch,
      lastHealthCheckTimestamp: new Date().toISOString()
    };
  }

  public clearMetrics() {
    this.submittedOrders = [];
  }
}

export const executionMonitoringEngine = ExecutionMonitoringEngine.getInstance();
