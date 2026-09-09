/**
 * ATHENA — PHASE 26: PERSONAL BROKER CONNECTION + PORTFOLIO INTELLIGENCE HUB
 * ZerodhaBrokerAdapter.ts
 * 
 * Future Broker Integration Stub (Disabled / Not Required).
 * 
 * Architectural Policy:
 * ATHENA operates primarily as an API-Free Personal Portfolio Hub with deterministic
 * canonical state from Manual entry, Excel, and CSV imports.
 * 
 * Zerodha Kite Connect is decoupled and disabled by default.
 * NO API keys, API secrets, Kite Connect subscriptions, or paid credentials are required.
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
  BrokerConnectionStatus
} from './types.ts';
import { brokerCredentialVault, BrokerCredentialVault } from './BrokerCredentialVault.ts';

export class ZerodhaBrokerAdapter implements BrokerAdapter {
  public brokerName: 'ZERODHA' = 'ZERODHA';
  private vault: BrokerCredentialVault;
  private tradingMode: TradingExecutionMode = 'READ_ONLY';
  private connectionStatus: BrokerConnectionStatus = 'DISABLED';

  constructor(vault: BrokerCredentialVault = brokerCredentialVault) {
    this.vault = vault;
  }

  public setTradingMode(mode: TradingExecutionMode): void {
    this.tradingMode = mode;
  }

  public getTradingMode(): TradingExecutionMode {
    return this.tradingMode;
  }

  public getConnectionState(): BrokerConnectionState {
    return {
      broker: 'ZERODHA',
      status: 'DISABLED',
      accountDescriptor: 'Future Broker Integration (Disabled / Not Required)',
      tradingMode: this.tradingMode,
      lastError: undefined,
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

  public async connect(): Promise<BrokerConnectionState> {
    return this.getConnectionState();
  }

  public async disconnect(): Promise<void> {
    this.connectionStatus = 'DISABLED';
  }

  public async getProfile(): Promise<BrokerProfile> {
    return {
      userId: 'OFFLINE_USER',
      userName: 'Personal Portfolio User',
      userType: 'individual',
      email: 'personal@athena-os.local',
      broker: 'ZERODHA',
      exchanges: ['NSE', 'BSE', 'NFO'],
      orderTypes: ['MARKET', 'LIMIT']
    };
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
      equity: {
        net: 0,
        availableCash: 0,
        usedMargin: 0,
        collateral: 0,
        adhocMargin: 0
      }
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
