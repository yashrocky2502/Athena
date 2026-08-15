import Parser from 'rss-parser';
import { NewsConnector, fetchWithTimeout } from './BaseConnector';
import { NewsItem } from '../models/NewsItem';

const parser = new Parser({
  customFields: {
    item: [['media:content', 'mediaContent'], ['enclosure', 'enclosure']],
  },
});

interface GlobalFeedConfig {
  publisher: string;
  feedName: string;
  category: string;
  url: string;
}

export class GlobalAndCryptoConnector implements NewsConnector {
  public name = 'Global Financial & Crypto Feeds';
  public sourceType: 'RSS' = 'RSS';

  private feeds: GlobalFeedConfig[] = [
    // CoinDesk & CoinTelegraph
    { publisher: 'CoinDesk', feedName: 'CoinDesk News', category: 'Crypto', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { publisher: 'CoinTelegraph', feedName: 'CoinTelegraph News', category: 'Crypto', url: 'https://cointelegraph.com/rss' },

    // Yahoo Finance
    { publisher: 'Yahoo Finance', feedName: 'Yahoo Finance Top News', category: 'Global', url: 'https://finance.yahoo.com/news/rssindex' },

    // MarketWatch
    { publisher: 'MarketWatch', feedName: 'MarketWatch Top Stories', category: 'Global', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },

    // Investing.com
    { publisher: 'Investing.com', feedName: 'Investing.com News', category: 'Markets', url: 'https://www.investing.com/rss/news.rss' },

    // Bloomberg
    { publisher: 'Bloomberg', feedName: 'Bloomberg Markets', category: 'Global', url: 'https://news.google.com/rss/search?q=site:bloomberg.com+markets&hl=en-US&gl=US&ceid=US:en' },
  ];

  public async fetchLatest(): Promise<NewsItem[]> {
    const results = await Promise.allSettled(
      this.feeds.map((f) => this.fetchSingleFeed(f))
    );

    const items: NewsItem[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled') {
        items.push(...res.value);
      }
    }
    return items;
  }

  private async fetchSingleFeed(cfg: GlobalFeedConfig): Promise<NewsItem[]> {
    try {
      const response = await fetchWithTimeout(cfg.url, {}, 8000);
      if (!response.ok) return [];
      const xml = await response.text();
      const parsed = await parser.parseString(xml);

      return (parsed.items || []).map((item, idx) => {
        const headline = (item.title || '').trim() || 'Global Financial News';
        let imageUrl: string | undefined = undefined;

        if (item.enclosure && item.enclosure.url) {
          imageUrl = item.enclosure.url;
        } else if ((item as any).mediaContent && (item as any).mediaContent.$ && (item as any).mediaContent.$.url) {
          imageUrl = (item as any).mediaContent.$.url;
        }

        const link = item.link || cfg.url;

        return {
          id: `global-${cfg.publisher}-${idx}-${Date.now()}`,
          headline,
          description: (item.contentSnippet || item.content || headline).substring(0, 500),
          publisher: cfg.publisher,
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          category: cfg.category,
          categories: [cfg.category, 'Global'],
          country: 'Global',
          language: 'en',
          url: link,
          publisherUrl: link,
          canonicalUrl: link,
          resolutionStatus: 'RESOLVED',
          image: imageUrl,
          source: cfg.publisher,
          sourceType: 'RSS',
          discoveryLayer: 'RSS',
          isExchange: false,
          feedName: cfg.feedName,
          rssSource: cfg.url,
        };
      });
    } catch {
      return [];
    }
  }
}
