import { SourceCredibilityEngine } from './SourceCredibilityEngine';
import { FreshnessEngine } from './FreshnessEngine';

export interface ScoreBreakdown {
  marketImpact: number; // Max 25
  foRelevance: number;  // Max 25
  freshness: number;    // Max 20
  sourceQuality: number;// Max 15
  companyImpact: number;// Max 15
  overallScore: number; // Total 100
  formattedBreakdown: string;
}

export class RelevanceEngine {
  public static calculateRelevance(
    title: string,
    body: string,
    publishedAtISO: string,
    publisherName: string = '',
    isFOEligible: boolean = false,
    extractedEntitiesCount: number = 0
  ): ScoreBreakdown {
    const text = `${title} ${body}`.toLowerCase();

    // 1. Market Impact (Max 25)
    let marketImpact = 10;
    if (text.includes('rbi') || text.includes('sebi') || text.includes('fed') || text.includes('rate') || text.includes('nifty') || text.includes('sensex')) {
      marketImpact = 25;
    } else if (text.includes('earnings') || text.includes('profit') || text.includes('revenue') || text.includes('order')) {
      marketImpact = 20;
    } else if (text.includes('market') || text.includes('stock') || text.includes('shares')) {
      marketImpact = 15;
    }

    // 2. F&O Relevance (Max 25)
    let foRelevance = 5;
    if (isFOEligible) {
      foRelevance = 25;
    } else if (text.includes('f&o') || text.includes('options') || text.includes('futures') || text.includes('banknifty') || text.includes('nifty')) {
      foRelevance = 20;
    } else if (extractedEntitiesCount > 0) {
      foRelevance = 15;
    }

    // 3. Freshness (Max 20)
    const freshRes = FreshnessEngine.evaluate(publishedAtISO);
    const freshness = freshRes.score;

    // 4. Source Quality (Max 15)
    const sourceRes = SourceCredibilityEngine.evaluate(publisherName);
    const sourceQuality = Math.min(15, Math.round((sourceRes.score / 100) * 15));

    // 5. Company Impact (Max 15)
    let companyImpact = 5;
    if (extractedEntitiesCount >= 3) {
      companyImpact = 15;
    } else if (extractedEntitiesCount >= 1) {
      companyImpact = 12;
    } else if (text.includes('company') || text.includes('firm') || text.includes('corp')) {
      companyImpact = 8;
    }

    const overallScore = Math.min(100, Math.max(0, marketImpact + foRelevance + freshness + sourceQuality + companyImpact));

    const formattedBreakdown = `Overall Relevance: ${overallScore}/100\n` +
      `Market Impact       ${marketImpact}/25\n` +
      `F&O Relevance       ${foRelevance}/25\n` +
      `Freshness           ${freshness}/20\n` +
      `Source Quality      ${sourceQuality}/15\n` +
      `Company Impact      ${companyImpact}/15`;

    return {
      marketImpact,
      foRelevance,
      freshness,
      sourceQuality,
      companyImpact,
      overallScore,
      formattedBreakdown,
    };
  }
}
