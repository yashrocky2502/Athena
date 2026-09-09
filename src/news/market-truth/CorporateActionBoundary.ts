/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * CorporateActionBoundary.ts
 * 
 * Deterministic corporate action adjustment tracker and price discontinuity filter.
 * Prevents false volatility/anomaly alerts caused by stock splits, bonuses, or dividends.
 * ZERO-AI: Deterministic adjustment factors & registry.
 */

import { CorporateActionStatus } from './types.ts';

export interface CorporateActionRecord {
  symbol: string;
  actionType: 'SPLIT' | 'BONUS' | 'DIVIDEND' | 'MERGER' | 'DEMERGER' | 'SYMBOL_CHANGE';
  exDate: string; // YYYY-MM-DD
  ratioNumerator: number;
  ratioDenominator: number;
  dividendAmountINR?: number;
  oldSymbol?: string;
  newSymbol?: string;
  confirmed: boolean;
}

export class CorporateActionBoundary {
  private static instance: CorporateActionBoundary;

  private registry: Map<string, CorporateActionRecord[]> = new Map();

  private constructor() {
    // Seed some representative historical corporate actions for testing and verification
    this.registerAction({
      symbol: 'TATASTEEL',
      actionType: 'SPLIT',
      exDate: '2026-07-28',
      ratioNumerator: 10,
      ratioDenominator: 1,
      confirmed: true
    });
    this.registerAction({
      symbol: 'RELIANCE',
      actionType: 'BONUS',
      exDate: '2026-10-28',
      ratioNumerator: 1,
      ratioDenominator: 1,
      confirmed: true
    });
  }

  public static getInstance(): CorporateActionBoundary {
    if (!CorporateActionBoundary.instance) {
      CorporateActionBoundary.instance = new CorporateActionBoundary();
    }
    return CorporateActionBoundary.instance;
  }

  public registerAction(record: CorporateActionRecord): void {
    const sym = record.symbol.toUpperCase();
    const existing = this.registry.get(sym) || [];
    existing.push(record);
    this.registry.set(sym, existing);
  }

  /**
   * Checks if an observed price drop/surge on a given date matches a corporate action.
   */
  public evaluateCorporateAction(
    symbol: string,
    currentPrice: number,
    previousPrice: number,
    dateStr: string = new Date().toISOString().split('T')[0]
  ): {
    status: CorporateActionStatus;
    actionType?: string;
    adjustedPreviousPrice: number;
    explanation?: string;
  } {
    const sym = symbol.toUpperCase();
    const actions = this.registry.get(sym) || [];
    const matched = actions.find(a => a.exDate === dateStr);

    if (!matched) {
      return {
        status: 'NONE',
        adjustedPreviousPrice: previousPrice
      };
    }

    if (!matched.confirmed) {
      return {
        status: 'CORPORATE_ACTION_UNCERTAIN',
        actionType: matched.actionType,
        adjustedPreviousPrice: previousPrice,
        explanation: `Unconfirmed corporate action (${matched.actionType}) pending exchange verification`
      };
    }

    let adjustedPreviousPrice = previousPrice;
    let explanation = '';

    if (matched.actionType === 'SPLIT' || matched.actionType === 'BONUS') {
      const multiplier = (matched.ratioNumerator + matched.ratioDenominator) / matched.ratioDenominator;
      adjustedPreviousPrice = Number((previousPrice / multiplier).toFixed(2));
      explanation = `Adjusted for ${matched.ratioNumerator}:${matched.ratioDenominator} ${matched.actionType}`;
    } else if (matched.actionType === 'DIVIDEND' && matched.dividendAmountINR) {
      adjustedPreviousPrice = Number((previousPrice - matched.dividendAmountINR).toFixed(2));
      explanation = `Adjusted for INR ${matched.dividendAmountINR} dividend`;
    }

    return {
      status: 'ADJUSTED',
      actionType: matched.actionType,
      adjustedPreviousPrice,
      explanation
    };
  }
}

export const corporateActionBoundary = CorporateActionBoundary.getInstance();
