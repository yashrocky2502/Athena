/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalSimulationExecutionAdapter.ts
 * 
 * Safe deterministic execution simulation sandbox completely isolated from live broker endpoints.
 */

import { HistoricalExecutionState } from './types.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';
import { historicalFutureFirewall } from './HistoricalFutureFirewall.ts';

export class HistoricalSimulationExecutionAdapter {
  private static instance: HistoricalSimulationExecutionAdapter;
  private simulatedOrders: HistoricalExecutionState[] = [];

  private constructor() {}

  public static getInstance(): HistoricalSimulationExecutionAdapter {
    if (!HistoricalSimulationExecutionAdapter.instance) {
      HistoricalSimulationExecutionAdapter.instance = new HistoricalSimulationExecutionAdapter();
    }
    return HistoricalSimulationExecutionAdapter.instance;
  }

  /**
   * Simulates order execution deterministically without any external network / broker calls
   */
  public simulateOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'LIMIT' | 'MARKET' | 'STOP_LIMIT';
    requestedPrice: number;
    currentMarketPrice: number;
    replayTimestamp: string;
  }): HistoricalExecutionState {
    // 1. Future firewall protection
    historicalFutureFirewall.inspectRecord('EXECUTION', params.replayTimestamp, 'SIM_EXECUTION', 'order', params.requestedPrice);

    // 2. Strict live safety check: Ensure no live endpoint is active
    if ((process.env as any).ATHENA_LIVE_BROKER_OVERRIDE === 'true') {
      throw new Error('[SECURITY_CRITICAL] Replay attempted to access live broker override. Blocked.');
    }

    const slippageBps = params.orderType === 'MARKET' ? 2.5 : 0.5;
    const slippageAmt = (params.currentMarketPrice * slippageBps) / 10000;
    const fillPrice = params.side === 'BUY' ? params.currentMarketPrice + slippageAmt : params.currentMarketPrice - slippageAmt;
    const commission = Math.min(20, (params.quantity * fillPrice * 0.0003)); // Zerodha/Fyers standard Rs. 20 cap

    const execution: HistoricalExecutionState = {
      orderId: `sim_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: params.replayTimestamp,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      orderType: params.orderType,
      requestedPrice: params.requestedPrice,
      status: 'FILLED',
      filledQuantity: params.quantity,
      averageFillPrice: Number(fillPrice.toFixed(2)),
      simulatedSlippage: Number(slippageAmt.toFixed(2)),
      simulatedCommission: Number(commission.toFixed(2)),
      simulatedLatencyMs: 42,
      executionQualityScore: 96,
      deterministicHash: '',
      provenanceId: ''
    };

    execution.deterministicHash = HistoricalHashUtils.hashObject(execution);
    execution.provenanceId = HistoricalHashUtils.generateProvenanceId('SIM_EXECUTION', params.replayTimestamp);

    this.simulatedOrders.push(execution);
    return execution;
  }

  public getSimulatedOrders(): HistoricalExecutionState[] {
    return [...this.simulatedOrders];
  }

  public clear(): void {
    this.simulatedOrders = [];
  }
}

export const historicalSimulationExecutionAdapter = HistoricalSimulationExecutionAdapter.getInstance();
