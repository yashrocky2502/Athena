/**
 * ATHENA NEWS ENGINE — PHASE 20
 * ExecutionAdapterFactory.ts
 * 
 * Execution Adapter Factory.
 * Manages active broker adapters and enforces PAPER mode as default safety guard.
 */

import { BrokerExecutionAdapter } from './BrokerExecutionAdapter.ts';
import { PaperExecutionAdapter } from './PaperExecutionAdapter.ts';
import { ZerodhaKiteExecutionAdapter } from './ZerodhaKiteExecutionAdapter.ts';
import { BinanceExecutionAdapter } from './BinanceExecutionAdapter.ts';
import { ExecutionMode } from './types.ts';

export const paperExecutionAdapter = new PaperExecutionAdapter();

export class ExecutionAdapterFactory {
  private static instance: ExecutionAdapterFactory;
  private currentAdapter: BrokerExecutionAdapter = paperExecutionAdapter;
  private executionMode: ExecutionMode = 'PAPER';

  private constructor() {}

  public static getInstance(): ExecutionAdapterFactory {
    if (!this.instance) {
      this.instance = new ExecutionAdapterFactory();
    }
    return this.instance;
  }

  public getAdapter(): BrokerExecutionAdapter {
    return this.currentAdapter;
  }

  public getMode(): ExecutionMode {
    return this.executionMode;
  }

  public setAdapter(type: 'PAPER' | 'ZERODHA' | 'BINANCE', mode: ExecutionMode = 'PAPER'): void {
    this.executionMode = mode;

    switch (type) {
      case 'ZERODHA':
        this.currentAdapter = new ZerodhaKiteExecutionAdapter(mode);
        break;
      case 'BINANCE':
        this.currentAdapter = new BinanceExecutionAdapter(mode);
        break;
      case 'PAPER':
      default:
        this.currentAdapter = paperExecutionAdapter;
        this.currentAdapter.mode = mode;
        break;
    }
  }
}

export const executionAdapterFactory = ExecutionAdapterFactory.getInstance();
