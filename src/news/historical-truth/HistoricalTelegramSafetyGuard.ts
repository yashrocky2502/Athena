/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalTelegramSafetyGuard.ts
 * 
 * Safety interceptor that blocks any live Telegram API transmissions during historical replay
 * and generates immutable HistoricalAlertProof artifacts instead.
 */

import { HistoricalAlertProof } from './types.ts';

export class HistoricalTelegramSafetyGuard {
  private static instance: HistoricalTelegramSafetyGuard;
  private proofs: HistoricalAlertProof[] = [];

  private constructor() {}

  public static getInstance(): HistoricalTelegramSafetyGuard {
    if (!HistoricalTelegramSafetyGuard.instance) {
      HistoricalTelegramSafetyGuard.instance = new HistoricalTelegramSafetyGuard();
    }
    return HistoricalTelegramSafetyGuard.instance;
  }

  /**
   * Intercepts an alert and formats it as an isolated HistoricalAlertProof
   */
  public interceptAndCreateProof(params: {
    symbol: string;
    timestamp: string;
    title: string;
    body: string;
  }): HistoricalAlertProof {
    const proof: HistoricalAlertProof = {
      alertId: `proof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: params.timestamp,
      symbol: params.symbol,
      title: `[HISTORICAL REPLAY] ${params.title}`,
      body: params.body,
      isSimulated: true,
      isHistoricalReplay: true,
      safetyWatermark: 'SIMULATED | HISTORICAL_REPLAY | NOT_FOR_LIVE_EXECUTION',
      dispatchedToLiveTelegram: false
    };

    this.proofs.push(proof);
    return proof;
  }

  public getProofs(): HistoricalAlertProof[] {
    return [...this.proofs];
  }

  public clear(): void {
    this.proofs = [];
  }
}

export const historicalTelegramSafetyGuard = HistoricalTelegramSafetyGuard.getInstance();
