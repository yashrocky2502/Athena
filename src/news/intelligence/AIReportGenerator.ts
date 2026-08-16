import { NewsAIService } from "../AI/NewsAIService";
import { SymbolExtractor, ExtractedEntity } from './SymbolExtractor';
import { SectorIndexMapper } from './SectorIndexMapper';
import { FOIntelligenceEngine, DirectionalBias } from './FOIntelligenceEngine';
import { OptionSellingContext } from './OptionSellingContext';
import { MarketImpactEngine, ExpectedMarketImpact } from './MarketImpactEngine';
import { BreakingNewsDetector } from './BreakingNewsDetector';
import { RelevanceEngine } from './RelevanceEngine';
import { SourceCredibilityEngine } from './SourceCredibilityEngine';
import { FreshnessEngine } from './FreshnessEngine';
import { HallucinationGuard } from './HallucinationGuard';

export interface AIIntelligenceReport {
  executiveSummary: string;
  whatHappened: string;
  whyItMatters: string;
  marketImpact: ExpectedMarketImpact;
  stocksAffected: ExtractedEntity[];
  sectorImpact: string;
  foImpact: string;
  cePeBias: DirectionalBias;
  riskFactors: string[];
  whatToWatchNext: string;
  confidence: number;
  relevanceBreakdown: string;
  urgency: string;
  sourceTier: string;
  freshness: string;
  disclaimer: string;
  providerUsed: string;
}

export class AIReportGenerator {
  private static aiRouter = NewsAIService.getInstance();

  public static async generateReport(
    title: string,
    body: string,
    publishedAtISO: string,
    publisherName: string = ''
  ): Promise<AIIntelligenceReport> {
    const extractedEntities = SymbolExtractor.extractEntities(body, title);
    const sectorHierarchy = SectorIndexMapper.map(body, title, extractedEntities);
    const impactRes = MarketImpactEngine.evaluate(title, body);
    const isFO = extractedEntities.some(e => e.isFOEligible);
    const foRes = FOIntelligenceEngine.analyze(title, body, isFO, extractedEntities.length);
    const optRes = OptionSellingContext.evaluate(title, body, isFO, foRes.confidence);
    const breakingRes = BreakingNewsDetector.detect(title, body, publishedAtISO);
    const relRes = RelevanceEngine.calculateRelevance(title, body, publishedAtISO, publisherName, isFO, extractedEntities.length);
    const sourceRes = SourceCredibilityEngine.evaluate(publisherName);
    const freshRes = FreshnessEngine.evaluate(publishedAtISO);

    // Call AIRouter to fetch AI-synthesized executive summary and what to watch
    let aiSummaryText = `${title}. ${body.slice(0, 300)}...`;
    let whatToWatchNext = 'Monitor market open, institutional volume, and official company disclosures.';
    let providerUsed = 'Athena Local Engine';

    try {
      const aiResult = await this.aiRouter.generateSummary({
        headline: title,
        body,
        category: 'Markets',
      });

      if (aiResult?.text) {
        aiSummaryText = aiResult.text || aiSummaryText;
        providerUsed = aiResult.provider || providerUsed;
      }
    } catch (err) {
      console.warn('[AIReportGenerator] AI Router failed over to deterministic engine:', err);
    }

    // Pass through HallucinationGuard to ensure zero invented claims
    const hallucinationCheck = HallucinationGuard.verifyFacts(
      [aiSummaryText, ...foRes.reasons],
      title,
      body
    );

    const verifiedExecutiveSummary = hallucinationCheck.hasSufficientEvidence
      ? hallucinationCheck.verifiedFacts[0] || aiSummaryText
      : `${title} - Insufficient verified information in source body to extract further facts.`;

    const stockSymbols = extractedEntities.map(e => e.nseSymbol).join(', ') || 'Broad Market Securities';

    return {
      executiveSummary: verifiedExecutiveSummary,
      whatHappened: title,
      whyItMatters: `${title} impacts ${sectorHierarchy.sectors.join(', ') || 'broad market'} sector with ${impactRes.impact.toLowerCase()} sentiment.`,
      marketImpact: impactRes.impact,
      stocksAffected: extractedEntities,
      sectorImpact: `Affected Sectors: ${sectorHierarchy.sectors.join(', ') || 'Broad Market'}. Indices: ${sectorHierarchy.indices.join(', ')}`,
      foImpact: `Directional Bias: ${foRes.directionalBias} (${foRes.confidence}% confidence). Time Horizon: ${foRes.timeHorizon}. Volatility Impact: ${optRes.expectedVolatilityImpact}`,
      cePeBias: foRes.directionalBias,
      riskFactors: optRes.cautionNotes.length > 0 ? optRes.cautionNotes : ['Standard market price fluctuation risk.'],
      whatToWatchNext,
      confidence: foRes.confidence,
      relevanceBreakdown: relRes.formattedBreakdown,
      urgency: breakingRes.urgency,
      sourceTier: sourceRes.tier,
      freshness: freshRes.tier,
      disclaimer: foRes.disclaimer,
      providerUsed,
    };
  }
}
