import { NewsArticleV2 } from "../domain/NewsArticle.ts";
import { UnifiedIntelligenceEngine } from "../intelligenceV2/UnifiedIntelligenceEngine.ts";

export interface UIAdaptedArticle {
  id: string;
  headline: string;
  title: string;
  body: string;
  summary: string;
  cleanBody: string;
  fullArticleBody: string;
  url: string;
  publisher: string;
  source: string;
  feedName: string;
  publishedAt: string;
  time: string;
  timestamp: string;
  category: string;
  categories: string[];
  sentiment: string;
  relevanceScore: number;
  aiImpact: number;
  aiImpactScore: number;
  priority: string;
  tickers: string[];
  country: string;
  language: string;
  sourceType: string;
  isExchange: boolean;
  // F&O specific properties
  isFO: boolean;
  isFnO: boolean;
  fnoEligible: boolean;
  fnoSymbol: string | null;
  fnoDecision: string;
  foReason: string;
  entityConfidence: string;
  // Canonical Intelligence Record Fields
  companyName: string;
  whatChanged: string[];
  keyMetrics: any[];
  whyItMatters: string;
  marketImpact: string;
  optionsSellerImpact: string;
  riskWatchpoints: string[];
  summaryConfidence: number;
  summaryProcessingMode: string;
  intelligenceVersion: string;
  primaryCategory?: string;
  secondaryCategories?: string[];
  eventType?: string;
  categoryConfidence?: string;
  classificationEvidence?: string[];
}

export class NewsCoreV2UIAdapter {
  /**
   * Adapts a canonical V2 article into a UI-friendly representation backed by UnifiedIntelligenceEngine.
   */
  public static adapt(art: NewsArticleV2): UIAdaptedArticle {
    const isFno = !!(art.fno && art.fno.eligible && art.fno.decision === "INCLUDE");
    const tickerList = art.fno?.symbol ? [art.fno.symbol] : [];

    // Map sentiment to UI expectations
    let sentimentStr = "NEUTRAL";
    if (art.sentiment === "BULLISH") sentimentStr = "BULLISH";
    else if (art.sentiment === "BEARISH") sentimentStr = "BEARISH";

    // Priority based on relevance/F&O
    let priorityStr = "⚪ Standby";
    if (art.relevanceScore >= 85 || isFno) {
      priorityStr = "🟡 High";
    }
    if (art.relevanceScore >= 95) {
      priorityStr = "🔴 Critical";
    }

    const publisherName = art.source?.publisher || "Market Wire";
    const publishedIso = art.publishedAt || art.collectedAt || new Date().toISOString();

    const intel = UnifiedIntelligenceEngine.build(art);

    return {
      id: art.id,
      headline: art.headline,
      title: art.headline,
      body: art.body,
      summary: intel.executiveSummary,
      cleanBody: art.body,
      fullArticleBody: art.body,
      url: art.canonicalUrl || art.source?.url || "",
      publisher: publisherName,
      source: publisherName,
      feedName: publisherName,
      publishedAt: publishedIso,
      time: publishedIso,
      timestamp: publishedIso,
      category: art.category || intel.category || "GENERAL",
      categories: [art.category || intel.category || "GENERAL"],
      sentiment: sentimentStr,
      relevanceScore: art.relevanceScore || 50,
      aiImpact: art.relevanceScore || 50,
      aiImpactScore: art.relevanceScore || 50,
      priority: priorityStr,
      tickers: tickerList,
      country: "IN",
      language: "en",
      sourceType: art.source?.collectionMethod || "RSS",
      isExchange: publisherName === "NSE" || publisherName === "BSE" || publisherName === "SEBI",
      isFO: isFno,
      isFnO: isFno,
      fnoEligible: intel.fnoEligible,
      fnoSymbol: intel.symbol,
      fnoDecision: art.fno?.decision || (intel.fnoEligible ? "INCLUDE" : "EXCLUDE"),
      foReason: art.fno?.reason || "Canonical intelligence evaluation",
      entityConfidence: intel.entityConfidence,
      companyName: intel.companyName,
      whatChanged: intel.keyFacts,
      keyMetrics: intel.financialMetrics,
      whyItMatters: intel.whyItMatters,
      marketImpact: intel.marketImpact,
      optionsSellerImpact: intel.optionsSellerImpact,
      riskWatchpoints: intel.risk,
      summaryConfidence: intel.materialityScore,
      summaryProcessingMode: "DETERMINISTIC",
      intelligenceVersion: intel.intelligenceVersion,
      primaryCategory: art.primaryCategory,
      secondaryCategories: art.secondaryCategories,
      eventType: art.eventType,
      categoryConfidence: art.categoryConfidence,
      classificationEvidence: art.classificationEvidence
    };
  }

  public static adaptMany(articles: NewsArticleV2[]): UIAdaptedArticle[] {
    return (articles || []).map((art) => this.adapt(art));
  }
}
