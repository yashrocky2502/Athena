/**
 * ATHENA NEWS ENGINE — PHASE 13
 * PortfolioTelegramSnapshot.ts
 * 
 * Telegram Grounded Portfolio Snapshot Generator.
 * Formats canonical PortfolioDecision outputs into concise, high-density Telegram text snippets
 * with strict numerical parity to UI metrics.
 * 
 * ZERO-AI COST CONTRACT: Deterministic string template formatting.
 */

import { PortfolioDecision } from './types.ts';

export class PortfolioTelegramSnapshot {
  private static instance: PortfolioTelegramSnapshot;

  private constructor() {}

  public static getInstance(): PortfolioTelegramSnapshot {
    if (!this.instance) {
      this.instance = new PortfolioTelegramSnapshot();
    }
    return this.instance;
  }

  /**
   * Formats a PortfolioDecision object into a concise Telegram Markdown string
   */
  public generateTelegramSnapshot(decision: PortfolioDecision): string {
    const qty = decision.positionSizing?.recommendedQuantity || 1;
    const gateStatus = decision.riskGateStatus || 'APPROVED';
    const decisionType = decision.decision || 'ADD';

    const firstRationale = (decision.rationales && decision.rationales.length > 0)
      ? decision.rationales[0]
      : 'Evaluated portfolio risk-reward and margin capacity.';

    return `
📊 *PORTFOLIO IMPACT & DECISION*

*Strategy Candidate:* ${decision.candidateStrategyName} (${decision.symbol})
*Athena Decision:* \`${decisionType}\`
*Risk Gate:* \`${gateStatus}\`

📉 *Position Sizing:*
• Recommended Qty: *${qty}*
• Max Allowed Qty: *${decision.positionSizing?.maxAllowedQuantity || 1}*
• Limiting Factor: _${decision.positionSizing?.limitingFactor || 'Capital Risk'}_

🛡 *Portfolio Delta Shift:*
• Delta Shift: *${decision.deltaImpact > 0 ? '+' : ''}${decision.deltaImpact.toFixed(2)}*
• Margin Impact: *+₹${(decision.marginImpactINR || 0).toLocaleString('en-IN')}*
• Concentration Score: *${decision.concentrationImpactScore}/100*
• Stress Worst-Case Loss: *₹${(decision.stressImpactLossINR || 0).toLocaleString('en-IN')}*

📋 *Rationale:*
_${firstRationale}_

⚖️ _Deterministic ATHENA Portfolio Intelligence v13.0 | Research Only_
`.trim();
  }
}

export const portfolioTelegramSnapshot = PortfolioTelegramSnapshot.getInstance();
