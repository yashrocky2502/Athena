import { NewsArticle } from '../types/Article';

export interface ClusteredStory {
  storyId: string;
  headline: string;
  primaryArticle: NewsArticle;
  syndicatedArticles: NewsArticle[];
  sourceCount: number;
  sources: string[];
  firstReportedAt: string;
  latestUpdateAt: string;
  summaryText: string;
}

export class SyndicationEngine {
  /**
   * Clusters a list of articles into deduplicated, multi-source stories.
   */
  public static clusterArticles(articles: NewsArticle[]): ClusteredStory[] {
    const storiesMap = new Map<string, ClusteredStory>();

    for (const article of articles) {
      const artAny = article as any;
      const headline = article.headline || artAny.title || '';
      const headlineKey = headline
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 40);

      const publisherName = article.source?.name || article.source?.publisher || artAny.publisher?.name || 'Unknown';

      if (!headlineKey) continue;

      if (storiesMap.has(headlineKey)) {
        const existing = storiesMap.get(headlineKey)!;
        existing.syndicatedArticles.push(article);
        existing.sourceCount++;
        if (!existing.sources.includes(publisherName)) {
          existing.sources.push(publisherName);
        }

        const pubTime = new Date(article.publishedAt).getTime();
        const firstTime = new Date(existing.firstReportedAt).getTime();
        const latestTime = new Date(existing.latestUpdateAt).getTime();

        if (!isNaN(pubTime)) {
          if (pubTime < firstTime) existing.firstReportedAt = article.publishedAt;
          if (pubTime > latestTime) existing.latestUpdateAt = article.publishedAt;
        }

        existing.summaryText = `${existing.headline}\n${existing.sourceCount} sources | First reported: ${existing.firstReportedAt} | Latest update: ${existing.latestUpdateAt}\nSources: ${existing.sources.join(', ')}`;
      } else {
        storiesMap.set(headlineKey, {
          storyId: `STORY_${article.id}`,
          headline: headline || 'Market Update',
          primaryArticle: article,
          syndicatedArticles: [],
          sourceCount: 1,
          sources: [publisherName],
          firstReportedAt: article.publishedAt || new Date().toISOString(),
          latestUpdateAt: article.publishedAt || new Date().toISOString(),
          summaryText: `${headline}\n1 source | Published: ${article.publishedAt}\nSource: ${publisherName}`,
        });
      }
    }

    return Array.from(storiesMap.values());
  }
}
