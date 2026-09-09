/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Telegram Opportunity Alert Payload Formatter & Dispatch Engine
 */

import { CanonicalOpportunity } from './types';

export interface TelegramOpportunityAlertPayload {
  messageText: string;
  parseMode: 'HTML' | 'Markdown';
  opportunityId: string;
  instrument: string;
  direction: string;
  confidenceScore: number;
  priorityTier: string;
  actionRecommendation: string;
  evidenceRoot: string;
}

export class TelegramOpportunityAlertEngine {
  private static instance: TelegramOpportunityAlertEngine;

  public static getInstance(): TelegramOpportunityAlertEngine {
    if (!TelegramOpportunityAlertEngine.instance) {
      TelegramOpportunityAlertEngine.instance = new TelegramOpportunityAlertEngine();
    }
    return TelegramOpportunityAlertEngine.instance;
  }

  /**
   * Generates a rich, verified, Telegram alert payload for high-conviction opportunities
   */
  public generateAlertPayload(opportunity: CanonicalOpportunity): TelegramOpportunityAlertPayload {
    const opp = opportunity;
    const isBullish = opp.direction === 'LONG';
    const dirEmoji = isBullish ? '🟢 LONG' : opp.direction === 'SHORT' ? '🔴 SHORT' : '⚪ NEUTRAL';
    const actionBadge = opp.actionRecommendation === 'TRADE' ? '⚡ ACTION: TRADE' 
                      : opp.actionRecommendation === 'WATCH' ? '👀 ACTION: WATCH'
                      : opp.actionRecommendation === 'WAIT' ? '⏳ ACTION: WAIT'
                      : '🚫 ACTION: AVOID';

    const confirmedDims = Object.entries(opp.confirmationBreakdown.dimensionResults)
      .filter(([_, res]) => res.status === 'CONFIRMED' || res.status === 'STRONGLY_CONFIRMED')
      .map(([dim, res]) => `${dim} (${res.metricValue})`)
      .slice(0, 4)
      .join(', ');

    const inv = opp.invalidationConditions[0] ? opp.invalidationConditions[0].description : 'Standard Stop Breach';

    const messageText = `
🎯 <b>ATHENA OPPORTUNITY INTELLIGENCE</b>
<b>${opp.instrument}</b> | <b>${dirEmoji}</b> [${opp.opportunityType}]
<b>Tier:</b> <code>${opp.priorityTier}</code> | <b>${actionBadge}</b>

━━━━━━━━━━━━━━━━━━━━
📊 <b>Quantitative Expectancy:</b>
• Confidence: <b>${opp.confidenceScore}/100</b>
• Deterministic EV: <b>+${opp.expectedValue}%</b>
• Risk / Reward: <b>1 : ${opp.riskReward}</b>
• Evidence Quality: <b>${opp.evidenceQualityScore}/100</b>

💡 <b>Thesis & Catalyst:</b>
${opp.thesis}
<i>Catalyst:</i> ${opp.catalyst}

🔍 <b>Multi-Source Confirmation (${opp.confirmationScore}/100):</b>
Confirmed by: ${confirmedDims || 'Multi-factor alignment'}

⚠️ <b>Invalidation Level:</b>
${inv}

🛡️ <b>12-Gate Execution:</b> <code>${opp.executionEligibility.status}</code> (${opp.executionEligibility.passedGatesCount}/${opp.executionEligibility.totalGatesCount} passed)
🔗 <b>Evidence Root:</b> <code>${opp.provenanceRootId}</code>
    `.trim();

    return {
      messageText,
      parseMode: 'HTML',
      opportunityId: opp.opportunityId,
      instrument: opp.instrument,
      direction: opp.direction,
      confidenceScore: opp.confidenceScore,
      priorityTier: opp.priorityTier,
      actionRecommendation: opp.actionRecommendation,
      evidenceRoot: opp.provenanceRootId
    };
  }
}
