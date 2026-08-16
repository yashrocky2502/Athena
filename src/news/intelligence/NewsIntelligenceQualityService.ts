import { NewsArticle } from '../types/Article';
import { SymbolExtractor } from './SymbolExtractor';
import { SectorIndexMapper } from './SectorIndexMapper';
import { FOIntelligenceEngine } from './FOIntelligenceEngine';
import { OptionSellingContext } from './OptionSellingContext';
import { MarketImpactEngine } from './MarketImpactEngine';
import { BreakingNewsDetector } from './BreakingNewsDetector';
import { RelevanceEngine } from './RelevanceEngine';
import { SourceCredibilityEngine } from './SourceCredibilityEngine';
import { FreshnessEngine } from './FreshnessEngine';
import { AlertPrioritizationEngine } from './AlertPrioritizationEngine';
import { AIReportGenerator, AIIntelligenceReport } from './AIReportGenerator';

export class NewsIntelligenceQualityService {
  /**
   * Enriches a news article dynamically with Stage 5 intelligence metadata.
   * NEVER mutates the canonical article record on disk.
   */
  public static enrich(article: NewsArticle): NewsArticle & {
    intelligenceReport?: AIIntelligenceReport;
    relevanceScore?: number;
    urgency?: string;
    sourceTier?: string;
    freshnessTier?: string;
    extractedSymbols?: string[];
    directionalBias?: string;
    alertPriority?: string;
  } {
    const artAny = article as any;
    const title = article.headline || artAny.title || '';
    const body = article.body || artAny.summary || artAny.content || '';
    const pubAt = article.publishedAt || new Date().toISOString();
    const publisher = article.source?.name || article.source?.publisher || artAny.publisher?.name || '';

    const extractedEntities = SymbolExtractor.extractEntities(body, title);
    const isFO = extractedEntities.some(e => e.isFOEligible) || article.fnoEligible || artAny.isFOEligible;
    const relRes = RelevanceEngine.calculateRelevance(title, body, pubAt, publisher, isFO, extractedEntities.length);
    const breakingRes = BreakingNewsDetector.detect(title, body, pubAt);
    const sourceRes = SourceCredibilityEngine.evaluate(publisher);
    const freshRes = FreshnessEngine.evaluate(pubAt);
    const foRes = FOIntelligenceEngine.analyze(title, body, isFO, extractedEntities.length);
    const alertRes = AlertPrioritizationEngine.evaluate(
      title,
      body,
      breakingRes.urgency,
      relRes.overallScore,
      isFO
    );

    const symbols = extractedEntities.map(e => e.nseSymbol);

    return {
      ...article,
      relevanceScore: relRes.overallScore,
      urgency: breakingRes.urgency,
      sourceTier: sourceRes.tier,
      freshnessTier: freshRes.tier,
      extractedSymbols: symbols.length > 0 ? symbols : [(article as any).symbol].filter(Boolean),
      directionalBias: foRes.directionalBias,
      alertPriority: alertRes.priority,
    };
  }

  /**
   * Generates a full AI Intelligence Report for an article.
   */
  public static async generateFullReport(article: NewsArticle): Promise<AIIntelligenceReport> {
    const artAny = article as any;
    const title = article.headline || artAny.title || '';
    const body = article.body || artAny.summary || artAny.content || '';
    const pubAt = article.publishedAt || new Date().toISOString();
    const publisher = article.source?.name || article.source?.publisher || artAny.publisher?.name || '';

    return AIReportGenerator.generateReport(title, body, pubAt, publisher);
  }
}
