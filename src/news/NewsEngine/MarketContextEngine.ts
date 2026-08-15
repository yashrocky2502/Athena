import { ArticleContent } from './ArticleContent';
import { CrossArticleEngine } from './CrossArticleEngine';
import { StoryCluster } from './StoryClusterEngine';
import { MarketTheme } from './ThemeDetectionEngine';
import { EventCorrelation } from './EventCorrelationEngine';
import { MarketNarrative } from './MarketNarrativeEngine';
import { InstitutionalFlow } from './InstitutionalFlowEngine';

export interface ExtendedMarketContext {
  cluster: StoryCluster;
  relation: string;
  themes: MarketTheme[];
  correlation: EventCorrelation | null;
  narrative: MarketNarrative;
  institutionalFlow: InstitutionalFlow;
  memoryReference?: string;
}

export class MarketContextEngine {
  /**
   * Main entry point to process an article and attach Cross-Article Intelligence & Market Context.
   */
  public static process(content: ArticleContent): ExtendedMarketContext {
    // Execute incremental Cross-Article Intelligence pipeline
    const crossArticleResult = CrossArticleEngine.getInstance().processArticle(content);

    // Create a sanitized crossArticle payload that strips circular references (such as cluster.articles containing `content`)
    const sanitizedCluster = {
      ...crossArticleResult.cluster,
      articles: crossArticleResult.cluster.articles ? crossArticleResult.cluster.articles.map((a: any) => ({
        id: a.id,
        headline: a.headline || a.title,
        publisher: a.publisher,
        url: a.url,
        publishedAt: a.publishedAt
      })) : [],
      canonicalArticle: crossArticleResult.cluster.canonicalArticle ? {
        id: crossArticleResult.cluster.canonicalArticle.id,
        headline: crossArticleResult.cluster.canonicalArticle.headline || crossArticleResult.cluster.canonicalArticle.title,
        publisher: crossArticleResult.cluster.canonicalArticle.publisher,
        url: crossArticleResult.cluster.canonicalArticle.url,
        publishedAt: crossArticleResult.cluster.canonicalArticle.publishedAt
      } as any : undefined
    };

    const sanitizedCrossArticle = {
      ...crossArticleResult,
      cluster: sanitizedCluster as any
    };

    // Attach non-circular cross-article layer to content
    (content as any).crossArticle = sanitizedCrossArticle;

    if (content.athenaIntelligence) {
      // Enhance executive summary if market memory reference exists
      if (crossArticleResult.memoryReference) {
        content.athenaIntelligence.executiveSummary = `${content.athenaIntelligence.executiveSummary} (${crossArticleResult.memoryReference})`;
      }

      // Attach cross-article context
      (content as any).athenaIntelligence.crossArticle = {
        clusterId: crossArticleResult.cluster.id,
        clusterTitle: crossArticleResult.cluster.title,
        signalStrength: crossArticleResult.cluster.signalStrength,
        themes: crossArticleResult.themes.map(t => t.theme),
        storyType: crossArticleResult.relation,
        regime: crossArticleResult.institutionalFlow.regime,
        regimeReasoning: crossArticleResult.institutionalFlow.reasoning
      };
    }

    return crossArticleResult;
  }
}
