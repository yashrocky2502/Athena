import Parser from 'rss-parser';
import { NewsConnector, fetchWithTimeout } from './BaseConnector';
import { NewsItem } from '../models/NewsItem';

const parser = new Parser({
  customFields: {
    item: [['media:content', 'mediaContent'], ['content:encoded', 'contentEncoded']],
  },
});

export class GoogleNewsConnector implements NewsConnector {
  public name = 'Google News Discovery';
  public sourceType: 'GOOGLE_DISCOVERY' = 'GOOGLE_DISCOVERY';

  private feeds: Record<string, { url: string; category: string }> = {
    General: { url: 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en', category: 'General' },
    Markets: { url: 'https://news.google.com/rss/search?q=Indian+Stock+Markets+NSE+BSE&hl=en-IN&gl=IN&ceid=IN:en', category: 'Markets' },
    Technology: { url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en', category: 'Technology' },
    Crypto: { url: 'https://news.google.com/rss/search?q=cryptocurrency+bitcoin+ethereum&hl=en-IN&gl=IN&ceid=IN:en', category: 'Crypto' },
    AI: { url: 'https://news.google.com/rss/search?q=Artificial+Intelligence+AI+tech&hl=en-IN&gl=IN&ceid=IN:en', category: 'AI' },
    Economy: { url: 'https://news.google.com/rss/search?q=Indian+Economy+GDP+Inflation&hl=en-IN&gl=IN&ceid=IN:en', category: 'Economy' },
    Companies: { url: 'https://news.google.com/rss/search?q=Indian+Companies+Corporate+Earnings&hl=en-IN&gl=IN&ceid=IN:en', category: 'Corporate' },
    IPO: { url: 'https://news.google.com/rss/search?q=IPO+Indian+market+listing&hl=en-IN&gl=IN&ceid=IN:en', category: 'IPO' },
    Commodities: { url: 'https://news.google.com/rss/search?q=Gold+Oil+Commodities+prices&hl=en-IN&gl=IN&ceid=IN:en', category: 'Commodities' },
    FNO: { url: 'https://news.google.com/rss/search?q=NSE+FNO+futures+options+stocks&hl=en-IN&gl=IN&ceid=IN:en', category: 'F&O' },
  };

  public async fetchLatest(): Promise<NewsItem[]> {
    const results = await Promise.allSettled(
      Object.entries(this.feeds).map(([feedKey, feedInfo]) =>
        this.fetchSingleFeed(feedKey, feedInfo.url, feedInfo.category)
      )
    );

    const items: NewsItem[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled') {
        items.push(...res.value);
      }
    }
    return items;
  }

  private async fetchSingleFeed(feedName: string, url: string, category: string): Promise<NewsItem[]> {
    try {
      const response = await fetchWithTimeout(url, {}, 8000);
      if (!response.ok) return [];
      const xml = await response.text();
      const parsedFeed = await parser.parseString(xml);

      return (parsedFeed.items || []).map((item, idx) => {
        const rawTitle = item.title || '';
        let headline = rawTitle;
        let pubName = 'Financial News Wire';

        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          pubName = parts.pop()!.trim();
          headline = parts.join(' - ').trim();
        }

        // Ensure Google News is NEVER displayed as publisher
        if (pubName.toLowerCase().includes('google') || !pubName) {
          pubName = 'Financial Publisher';
        }

        const link = item.link || url;

        return {
          id: `gn-${feedName}-${item.guid || idx}-${Date.now()}`,
          headline,
          description: item.contentSnippet || item.content || headline,
          publisher: pubName,
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          category,
          categories: [category],
          country: 'India',
          language: 'en',
          url: link,
          googleDiscoveryUrl: link,
          publisherUrl: undefined,
          canonicalUrl: link,
          resolutionStatus: 'PUBLISHER_URL_UNAVAILABLE',
          image: undefined,
          source: pubName,
          sourceType: 'GOOGLE_DISCOVERY',
          discoveryLayer: 'GOOGLE_DISCOVERY',
          isExchange: false,
          feedName: `Google Discovery (${feedName})`,
          rssSource: url,
        };
      });
    } catch {
      return [];
    }
  }

  public async healthCheck(): Promise<{ ok: boolean; message?: string; itemsFetched?: number }> {
    try {
      const items = await this.fetchSingleFeed('General', this.feeds.General.url, 'General');
      return { ok: items.length > 0, itemsFetched: items.length };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Google News discovery feed check failed' };
    }
  }
}
