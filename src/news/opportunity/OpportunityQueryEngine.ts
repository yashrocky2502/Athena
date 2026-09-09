/**
 * ATHENA — Phase 25: Autonomous Decision Intelligence
 * Ask ATHENA Decision Intelligence Query Engine
 */

import { CanonicalOpportunity } from './types';
import { OpportunityStore } from './OpportunityStore';

export interface OpportunityQueryResponse {
  query: string;
  matchedOpportunities: CanonicalOpportunity[];
  structuredAnswer: string;
  forensicBreakdown?: {
    confidence: number;
    evidenceQuality: number;
    expectedValue: number;
    riskReward: number;
    actionRecommendation: string;
    invalidationSummary: string[];
    mathematicalFormula: string;
    causalChainSummary: string[];
  };
}

export class OpportunityQueryEngine {
  private static instance: OpportunityQueryEngine;

  public static getInstance(): OpportunityQueryEngine {
    if (!OpportunityQueryEngine.instance) {
      OpportunityQueryEngine.instance = new OpportunityQueryEngine();
    }
    return OpportunityQueryEngine.instance;
  }

  /**
   * Evaluates natural language decision queries against the deterministic opportunity store
   */
  public query(queryText: string): OpportunityQueryResponse {
    const store = OpportunityStore.getInstance();
    const all = store.getAllOpportunities();
    const q = queryText.toLowerCase().trim();

    // 1. Symbol-specific query (e.g., "Why is RELIANCE tradeable?" or "Show evidence for HDFCBANK")
    const symbolMatches = all.filter(o => q.includes(o.instrument.toLowerCase()));
    if (symbolMatches.length > 0) {
      const opp = symbolMatches[0];

      if (q.includes('invalidate') || q.includes('stop') || q.includes('risk')) {
        const invSummary = opp.invalidationConditions.map(c => `• [${c.conditionType}] ${c.description} (Triggered: ${c.isTriggered ? 'YES' : 'NO'})`);
        return {
          query: queryText,
          matchedOpportunities: [opp],
          structuredAnswer: `### Invalidation & Risk Conditions for ${opp.instrument} (${opp.direction} ${opp.opportunityType})\n\n` +
            `The opportunity is invalidated if any of the following deterministic rules trigger:\n\n` +
            invSummary.join('\n') + `\n\n` +
            `**Current Decision State:** \`${opp.decisionState}\` | **Action:** \`${opp.actionRecommendation}\``,
          forensicBreakdown: this.extractForensicBreakdown(opp)
        };
      }

      if (q.includes('formula') || q.includes('math') || q.includes('equation') || q.includes('decomposition')) {
        return {
          query: queryText,
          matchedOpportunities: [opp],
          structuredAnswer: `### Mathematical Decomposition for ${opp.instrument}\n\n` +
            `**Equation:**\n\`${opp.mathematicalDecomposition.equationFormula}\`\n\n` +
            `**Factor Breakdown:**\n` +
            `• Evidence Component: +${opp.mathematicalDecomposition.evidenceScoreComponent} (Weight: ${opp.mathematicalDecomposition.weights.evidenceWeight})\n` +
            `• Confirmation Component: +${opp.mathematicalDecomposition.confirmationScoreComponent} (Weight: ${opp.mathematicalDecomposition.weights.confirmationWeight})\n` +
            `• Historical Analogue Component: +${opp.mathematicalDecomposition.historicalSupportComponent} (Weight: ${opp.mathematicalDecomposition.weights.historicalWeight})\n` +
            `• Regime Compatibility: +${opp.mathematicalDecomposition.regimeCompatibilityComponent} (Weight: ${opp.mathematicalDecomposition.weights.regimeWeight})\n` +
            `• Liquidity Component: +${opp.mathematicalDecomposition.liquidityComponent} (Weight: ${opp.mathematicalDecomposition.weights.liquidityWeight})\n` +
            `• Expected Value Component: +${opp.mathematicalDecomposition.expectedValueComponent} (Weight: ${opp.mathematicalDecomposition.weights.expectedValueWeight})\n` +
            `• Contradiction Penalty: -${opp.mathematicalDecomposition.contradictionPenalty}\n` +
            `• Risk Penalty: -${opp.mathematicalDecomposition.riskPenalty}\n\n` +
            `**Raw Sum:** ${opp.mathematicalDecomposition.rawScore} → **Final Deterministic Score:** \`${opp.mathematicalDecomposition.finalScore}/100\``,
          forensicBreakdown: this.extractForensicBreakdown(opp)
        };
      }

      // Default symbol explanation
      return {
        query: queryText,
        matchedOpportunities: [opp],
        structuredAnswer: `### Opportunity Intelligence: ${opp.instrument} (${opp.direction} ${opp.opportunityType})\n\n` +
          `**Decision:** \`${opp.actionRecommendation}\` (State: \`${opp.decisionState}\`)\n` +
          `**Confidence:** \`${opp.confidenceScore}/100\` | **Expected Value:** \`+${opp.expectedValue}%\` | **R:R:** \`1:${opp.riskReward}\`\n\n` +
          `**Thesis:** ${opp.thesis}\n\n` +
          `**Catalyst:** ${opp.catalyst}\n\n` +
          `**Multi-Source Confirmation (${opp.confirmationScore}/100):**\n` +
          `• Price: ${opp.confirmationBreakdown.dimensionResults.PRICE.status} (${opp.confirmationBreakdown.dimensionResults.PRICE.metricValue})\n` +
          `• Volume: ${opp.confirmationBreakdown.dimensionResults.VOLUME.status} (${opp.confirmationBreakdown.dimensionResults.VOLUME.metricValue})\n` +
          `• Derivatives OI: ${opp.confirmationBreakdown.dimensionResults.OPEN_INTEREST.status} (${opp.confirmationBreakdown.dimensionResults.OPEN_INTEREST.metricValue})\n` +
          `• Sector: ${opp.confirmationBreakdown.dimensionResults.SECTOR.status} (${opp.confirmationBreakdown.dimensionResults.SECTOR.metricValue})\n\n` +
          `**Execution 12-Gate Status:** \`${opp.executionEligibility.status}\` (${opp.executionEligibility.passedGatesCount}/${opp.executionEligibility.totalGatesCount} gates passed)`,
        forensicBreakdown: this.extractForensicBreakdown(opp)
      };
    }

    // 2. Filter query: "top opportunities" / "highest confidence"
    if (q.includes('top') || q.includes('best') || q.includes('highest') || q.includes('ranked')) {
      const top = all.slice(0, 5);
      const items = top.map((o, i) => `${i + 1}. **${o.instrument}** [${o.direction} ${o.opportunityType}] — Score: **${o.confidenceScore}**, EV: **+${o.expectedValue}%**, Action: \`${o.actionRecommendation}\``);
      return {
        query: queryText,
        matchedOpportunities: top,
        structuredAnswer: `### Top Ranked ATHENA Opportunities\n\n` +
          items.join('\n') + `\n\n` +
          `Rankings are deterministic, incorporating multi-source confirmation, historical analogues, and 12 pre-trade risk gates.`
      };
    }

    // 3. Contradictions query: "contradictions" / "conflicts"
    if (q.includes('contradict') || q.includes('conflict') || q.includes('divergence')) {
      const contradicted = all.filter(o => o.contradictionScore > 25 || o.decisionState === 'CONTRADICTED');
      if (contradicted.length === 0) {
        return {
          query: queryText,
          matchedOpportunities: [],
          structuredAnswer: 'No active opportunities currently exhibit critical contradictions.'
        };
      }
      const items = contradicted.map(o => `• **${o.instrument}**: Contradiction Score: ${o.contradictionScore}/100, Reason: ${o.confirmationBreakdown.criticalContradictionReason || 'Divergent market indicators'}`);
      return {
        query: queryText,
        matchedOpportunities: contradicted,
        structuredAnswer: `### Contradicted Opportunities\n\n` + items.join('\n')
      };
    }

    // 4. Default overview
    const top = all.slice(0, 4);
    const summary = top.map(o => `• **${o.instrument}** (${o.direction} ${o.opportunityType}): Confidence **${o.confidenceScore}/100**, Action \`${o.actionRecommendation}\``).join('\n');
    return {
      query: queryText,
      matchedOpportunities: top,
      structuredAnswer: `### ATHENA Opportunity Intelligence\n\nCurrently tracking ${all.length} active opportunities across markets:\n\n${summary}\n\n*Ask about specific symbols, invalidation levels, mathematical decomposition, or execution eligibility.*`
    };
  }

  private extractForensicBreakdown(opp: CanonicalOpportunity) {
    return {
      confidence: opp.confidenceScore,
      evidenceQuality: opp.evidenceQualityScore,
      expectedValue: opp.expectedValue,
      riskReward: opp.riskReward,
      actionRecommendation: opp.actionRecommendation,
      invalidationSummary: opp.invalidationConditions.map(c => `${c.conditionType}: ${c.description}`),
      mathematicalFormula: opp.mathematicalDecomposition.equationFormula,
      causalChainSummary: opp.causalChain.map(node => `${node.stage}: ${node.title} (${node.status})`)
    };
  }
}
