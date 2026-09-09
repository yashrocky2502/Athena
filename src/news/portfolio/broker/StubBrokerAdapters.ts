/**
 * ATHENA — PHASE 26: PERSONAL BROKER CONNECTION + PORTFOLIO INTELLIGENCE HUB
 * StubBrokerAdapters.ts
 * 
 * Formal interface stubs for future broker connectivity:
 * - BinanceBrokerAdapter
 * - CoinDCXBrokerAdapter
 * - CoinSwitchBrokerAdapter
 * 
 * Complies with the BrokerAdapter interface contract without pretending live connection.
 */

import {
  BrokerAdapter,
  BrokerConnectionState,
  BrokerProfile,
  BrokerHolding,
  BrokerPosition,
  BrokerOrder,
  BrokerTrade,
  BrokerMargin,
  BrokerReconciliationResult,
  TradingExecutionMode,
  BrokerId
} from './types.ts';

abstract class BaseStubBrokerAdapter implements BrokerAdapter {
  abstract brokerName: BrokerId;
  protected tradingMode: TradingExecutionMode = 'READ_ONLY';

  public async connect(): Promise<BrokerConnectionState> {
    return this.getConnectionState();
  }

  public async disconnect(): Promise<void> {
    // No-op for stub
  }

  public getConnectionState(): BrokerConnectionState {
    return {
      broker: this.brokerName,
      status: 'DISCONNECTED',
      accountDescriptor: 'Not Connected',
      tradingMode: this.tradingMode,
      lastError: `${this.brokerName} adapter is an interface stub. Official API connection is planned for a future release.`,
      capabilities: {
        profile: false,
        holdings: false,
        positions: false,
        orders: false,
        trades: false,
        margins: false,
        marketData: false,
        orderPlacement: false
      }
    };
  }

  public setTradingMode(mode: TradingExecutionMode): void {
    this.tradingMode = mode;
  }

  public getTradingMode(): TradingExecutionMode {
    return this.tradingMode;
  }

  public async getProfile(): Promise<BrokerProfile> {
    throw new Error(`${this.brokerName} adapter is not connected.`);
  }

  public async getHoldings(): Promise<BrokerHolding[]> {
    return [];
  }

  public async getPositions(): Promise<BrokerPosition[]> {
    return [];
  }

  public async getOrders(): Promise<BrokerOrder[]> {
    return [];
  }

  public async getTrades(): Promise<BrokerTrade[]> {
    return [];
  }

  public async getMargins(): Promise<BrokerMargin> {
    return {
      equity: { net: 0, availableCash: 0, usedMargin: 0, collateral: 0, adhocMargin: 0 }
    };
  }

  public async reconcile(): Promise<BrokerReconciliationResult> {
    return {
      reconciledAt: new Date().toISOString(),
      isConsistent: true,
      discrepancyCount: 0,
      discrepancies: []
    };
  }
}

export class BinanceBrokerAdapter extends BaseStubBrokerAdapter {
  public brokerName: 'BINANCE' = 'BINANCE';
}

export class CoinDCXBrokerAdapter extends BaseStubBrokerAdapter {
  public brokerName: 'COINDCX' = 'COINDCX';
}

export class CoinSwitchBrokerAdapter extends BaseStubBrokerAdapter {
  public brokerName: 'COINSWITCH' = 'COINSWITCH';
}

export const binanceBrokerAdapter = new BinanceBrokerAdapter();
export const coinDCXBrokerAdapter = new CoinDCXBrokerAdapter();
export const coinSwitchBrokerAdapter = new CoinSwitchBrokerAdapter();
