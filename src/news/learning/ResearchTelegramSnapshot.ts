/**
 * ATHENA NEWS ENGINE — PHASE 16
 * ResearchTelegramSnapshot.ts
 * 
 * Formats precise Phase 16 Research Alerts for Telegram channel parity.
 */

import { DiscoveryRegimeType } from './MarketRegimeDiscoveryEngine.ts';

export class ResearchTelegramSnapshot {
  /**
   * Generates a beautifully structured Telegram alert on Regime transition
   */
  public static formatRegimeChangeAlert(
    fromRegime: DiscoveryRegimeType,
    toRegime: DiscoveryRegimeType,
    evidenceString: string,
    actionability: 'WATCH' | 'EXECUTE' | 'SUSPEND' | 'DECREASE_SIZING',
    reason: string
  ): string {
    return `🚨 ATHENA RESEARCH ALERT

Regime Change ${fromRegime} ➔ ${toRegime}

Affected Strategies:
• Iron Condor: DEGRADED
• Breakout: IMPROVING

Evidence:
${evidenceString}

Actionability: ${actionability}

Reason:
${reason}`;
  }
}
