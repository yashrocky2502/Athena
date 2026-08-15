import { ArticleContent } from './ArticleContent';
import { StoryClusterEngine, StoryCluster } from './StoryClusterEngine';
import { ThemeDetectionEngine, MarketTheme } from './ThemeDetectionEngine';
import { EventCorrelationEngine, EventCorrelation } from './EventCorrelationEngine';
import { MarketNarrativeEngine, MarketNarrative } from './MarketNarrativeEngine';
import { TrendStrengthEngine, TrendStrength } from './TrendStrengthEngine';
import { SectorImpactEngine, SectorImpactData } from './SectorImpactEngine';
import { InstitutionalFlowEngine, InstitutionalFlow } from './InstitutionalFlowEngine';
import { CompanyDiscussionEngine, CompanyDiscussion } from './CompanyDiscussionEngine';
import { MarketPulseEngine, MarketPulse } from './MarketPulseEngine';
import { MarketTimelineEngine, MarketTimelinePoint } from './MarketTimelineEngine';

export interface MarketMemoryItem {
  companyOrSymbol: string;
  headline: string;
  summary: string;
  category: string;
  timestamp: string;
}

export class CrossArticleEngine {
  private static instance: CrossArticleEngine;

  private recentArticles: ArticleContent[] = [];
  private memoryStore: Map<string, MarketMemoryItem[]> = new Map();

  public static getInstance(): CrossArticleEngine {
    if (!CrossArticleEngine.instance) {
      CrossArticleEngine.instance = new CrossArticleEngine();
    }
    return CrossArticleEngine.instance;
  }

  /**
   * Main entry point to process a single article incrementally.
   */
  public processArticle(article: ArticleContent): {
    cluster: StoryCluster;
    relation: string;
    themes: MarketTheme[];
    correlation: EventCorrelation | null;
    narrative: MarketNarrative;
    institutionalFlow: InstitutionalFlow;
    memoryReference?: string;
  } {
    // 1. Maintain rolling recent articles buffer (max 100)
    this.recentArticles.unshift(article);
    if (this.recentArticles.length > 100) this.recentArticles.pop();

    // 2. Story Clustering & Relationship Detection
    const { cluster, relation } = StoryClusterEngine.getInstance().processArticle(article);

    // 3. Theme Detection
    const themes = ThemeDetectionEngine.getInstance().processArticle(article);

    // 4. Event Correlation
    const correlation = EventCorrelationEngine.getInstance().processArticle(article, this.recentArticles);

    // 5. Sector Impact
    SectorImpactEngine.getInstance().processArticle(article);

    // 6. Company Discussion Analytics
    CompanyDiscussionEngine.getInstance().processArticle(article);

    // 7. Market Timeline Point
    MarketTimelineEngine.getInstance().processCluster(cluster);

    // 8. Market Memory Context Check
    const memoryReference = this.checkMarketMemory(article);

    // 9. Generate Narratives & Institutional Flow
    const allClusters = StoryClusterEngine.getInstance().getClusters();
    const allThemes = ThemeDetectionEngine.getInstance().getThemes();
    const allSectors = SectorImpactEngine.getInstance().getAllSectors();

    const narrative = MarketNarrativeEngine.getInstance().generate(allClusters, allThemes);
    const institutionalFlow = InstitutionalFlowEngine.getInstance().analyze(allSectors, allThemes);

    // 10. Update Memory Store
    this.saveToMarketMemory(article);

    return {
      cluster,
      relation,
      themes,
      correlation,
      narrative,
      institutionalFlow,
      memoryReference
    };
  }

  /**
   * Checks if historical context exists for the company/symbol in memory.
   */
  private checkMarketMemory(article: ArticleContent): string | undefined {
    const symbols: string[] = [];
    if (article.knowledge?.companies) {
      article.knowledge.companies.forEach((c: any) => {
        if (c.symbol) symbols.push(c.symbol.toUpperCase());
        if (c.name) symbols.push(c.name.toUpperCase());
      });
    }

    for (const sym of symbols) {
      const history = this.memoryStore.get(sym);
      if (history && history.length > 0) {
        const prev = history[0];
        return `This follows ${prev.headline.toLowerCase()} reported earlier (${new Date(prev.timestamp).toLocaleDateString()}).`;
      }
    }
    return undefined;
  }

  /**
   * Saves article event to market memory.
   */
  private saveToMarketMemory(article: ArticleContent): void {
    const headline = article.headline || article.title || '';
    const summary = article.athenaIntelligence?.executiveSummary || headline;
    const category = article.intelligence?.classification?.category || 'General';
    const timestamp = new Date().toISOString();

    if (article.knowledge?.companies) {
      article.knowledge.companies.forEach((c: any) => {
        const key = (c.symbol || c.name || '').toUpperCase();
        if (key) {
          let items = this.memoryStore.get(key) || [];
          items.unshift({ companyOrSymbol: key, headline, summary, category, timestamp });
          if (items.length > 5) items.pop();
          this.memoryStore.set(key, items);
        }
      });
    }
  }

  public getIntelligenceSnapshot() {
    const clusters = StoryClusterEngine.getInstance().getClusters();
    const themes = ThemeDetectionEngine.getInstance().getThemes();
    const sectors = SectorImpactEngine.getInstance().getAllSectors();
    const correlations = EventCorrelationEngine.getInstance().getCorrelations();
    const narrative = MarketNarrativeEngine.getInstance().getNarrative();
    const trendStrengths = TrendStrengthEngine.getInstance().analyzeAllThemes(themes);
    const institutionalFlow = InstitutionalFlowEngine.getInstance().analyze(sectors, themes);
    const companies = CompanyDiscussionEngine.getInstance().getRankedCompanies();
    const marketPulse = MarketPulseEngine.getInstance().calculate(clusters, sectors, institutionalFlow);
    const timeline = MarketTimelineEngine.getInstance().getTimeline();

    // Breaking now items: Signal Strength >=70, Confidence >=70 or F&O story
    const breakingNow = clusters.filter(c => 
      ((c.signalStrength ?? c.score) >= 70) || c.isFnO
    );

    return {
      clusters,
      themes,
      sectors,
      correlations,
      narrative,
      trendStrengths,
      institutionalFlow,
      companies,
      marketPulse,
      timeline,
      breakingNow,
      recentArticles: this.recentArticles,
      recentArticlesCount: this.recentArticles.length
    };
  }

  public clear(): void {
    this.recentArticles = [];
    this.memoryStore.clear();
    StoryClusterEngine.getInstance().clear();
    ThemeDetectionEngine.getInstance().clear();
    EventCorrelationEngine.getInstance().clear();
    SectorImpactEngine.getInstance().clear();
    CompanyDiscussionEngine.getInstance().clear();
    MarketTimelineEngine.getInstance().clear();
  }
}
