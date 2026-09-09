/**
 * ATHENA NEWS ENGINE — PHASE 15
 * LearningTelegramSnapshot.ts
 * 
 * Formats post-trade intelligence notifications for Telegram channel parity.
 */

import { ClosedLoopIntelligenceResult } from './types.ts';

export class LearningTelegramSnapshot {
  public static formatTelegramPostTrade(result: ClosedLoopIntelligenceResult): string {
    const trade = result.tradeOutcome;
    const attr = result.attribution.components;
    const icon = trade.isWin ? '🟢' : '🔴';
    const pnlFormatted = `${trade.netPnLINR >= 0 ? '+' : ''}₹${Math.abs(trade.netPnLINR).toLocaleString('en-IN')}`;
    const rFormatted = `${trade.realizedRMultiple >= 0 ? '+' : ''}${trade.realizedRMultiple}R`;

    const lesson = result.forensics
      ? result.forensics.preventativeLesson
      : `Setup performed optimally under ${trade.marketRegime} market regime.`;

    return `⚡ ATHENA TRADE OUTCOME

${trade.symbol} (${trade.side})

Result:
${icon} ${pnlFormatted} (${rFormatted})

Execution:
Quality: EXCELLENT
Slippage: ${trade.slippageCostINR > 0 ? '-' : ''}₹${Math.abs(trade.slippageCostINR)}

Attribution:
Signal: +₹${attr.signalContributionINR}
Strategy: +₹${attr.strategyContributionINR}
Portfolio: +₹${attr.portfolioContributionINR}
Execution: +₹${attr.executionContributionINR}
Costs: -₹${Math.abs(attr.transactionCostContributionINR)}
Slippage: -₹${Math.abs(attr.slippageContributionINR)}

🧠 Lesson:
${lesson}`;
  }
}
