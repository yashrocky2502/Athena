import { StoryCluster } from './StoryClusterEngine';
import { SectorImpactData } from './SectorImpactEngine';
import { InstitutionalFlow } from './InstitutionalFlowEngine';

export interface MarketPulse {
  score: number; // 0–100
  label: string; // e.g. "Strong Bullish Session"
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  confidence: number; // 0-100%
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  volatilityLevel: 'Low' | 'Normal' | 'Elevated' | 'High';
  narrativeSummary: string;
}

export class MarketPulseEngine {
  private static instance: MarketPulseEngine;

  public static getInstance(): MarketPulseEngine {
    if (!MarketPulseEngine.instance) {
      MarketPulseEngine.instance = new MarketPulseEngine();
    }
    return MarketPulseEngine.instance;
  }

  public calculate(
    clusters: StoryCluster[],
    sectors: SectorImpactData[],
    flow: InstitutionalFlow
  ): MarketPulse {
    let totalScore = 50;
    let bullishWeight = 0;
    let bearishWeight = 0;

    clusters.forEach(c => {
      if (c.marketImpact === 'BULLISH') bullishWeight += c.signalStrength;
      else if (c.marketImpact === 'BEARISH') bearishWeight += c.signalStrength;
    });

    sectors.forEach(s => {
      if (s.sentiment === 'BULLISH') bullishWeight += s.score;
      else if (s.sentiment === 'BEARISH') bearishWeight += Math.abs(s.score);
    });

    const netWeight = bullishWeight - bearishWeight;
    if (netWeight > 0) {
      totalScore = Math.min(98, Math.round(50 + Math.min(48, netWeight / 10)));
    } else if (netWeight < 0) {
      totalScore = Math.max(10, Math.round(50 - Math.min(40, Math.abs(netWeight) / 10)));
    }

    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' = 'NEUTRAL';
    let label = 'Balanced Market Session';

    if (totalScore >= 75) {
      direction = 'BULLISH';
      label = 'Strong Bullish Session';
    } else if (totalScore >= 60) {
      direction = 'BULLISH';
      label = 'Moderate Bullish Bias';
    } else if (totalScore <= 35) {
      direction = 'BEARISH';
      label = 'Weak / Risk-Off Session';
    } else if (bullishWeight > 0 && bearishWeight > 0) {
      direction = 'MIXED';
      label = 'Consolidating / Mixed Session';
    }

    let riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical' = 'Moderate';
    let volatilityLevel: 'Low' | 'Normal' | 'Elevated' | 'High' = 'Normal';

    if (flow.regime === 'RISK_OFF' || totalScore <= 30) {
      riskLevel = 'High';
      volatilityLevel = 'Elevated';
    } else if (flow.regime === 'CYCLICAL_ROTATION' || flow.regime === 'RISK_ON') {
      riskLevel = 'Low';
      volatilityLevel = 'Normal';
    }

    const narrativeSummary = `Overall market pulse stands at ${totalScore}/100 indicating a ${label.toLowerCase()}. Institutional flow shows ${flow.regime.replace(/_/g, ' ')} with ${flow.confidence}% confidence across key benchmark sectors.`;

    return {
      score: totalScore,
      label,
      direction,
      confidence: Math.min(98, 85 + clusters.length * 2),
      riskLevel,
      volatilityLevel,
      narrativeSummary
    };
  }
}
