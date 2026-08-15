import Parser from 'rss-parser';
import { NewsConnector, fetchWithTimeout } from './BaseConnector';
import { NewsItem } from '../models/NewsItem';

const parser = new Parser({
  customFields: {
    item: [['media:content', 'mediaContent'], ['enclosure', 'enclosure']],
  },
});

interface FeedConfig {
  publisher: string;
  feedName: string;
  category: string;
  url: string;
}

export class IndianNewsPublishersConnector implements NewsConnector {
  public name = 'Major Financial News Publishers';
  public sourceType: 'RSS' = 'RSS';

  private feedList: FeedConfig[] = [
    // Reuters
    { publisher: 'Reuters', feedName: 'Reuters Business', category: 'Corporate', url: 'https://news.google.com/rss/search?q=site:reuters.com+business&hl=en-US&gl=US&ceid=US:en' },
    { publisher: 'Reuters', feedName: 'Reuters World', category: 'Global', url: 'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en' },
    { publisher: 'Reuters', feedName: 'Reuters Tech', category: 'Technology', url: 'https://news.google.com/rss/search?q=site:reuters.com+technology&hl=en-US&gl=US&ceid=US:en' },

    // CNBC TV18
    { publisher: 'CNBC TV18', feedName: 'CNBC TV18 Markets', category: 'Markets', url: 'https://news.google.com/rss/search?q=site:cnbctv18.com+market&hl=en-IN&gl=IN&ceid=IN:en' },
    { publisher: 'CNBC TV18', feedName: 'CNBC TV18 Business', category: 'Corporate', url: 'https://news.google.com/rss/search?q=site:cnbctv18.com+business&hl=en-IN&gl=IN&ceid=IN:en' },
    { publisher: 'CNBC TV18', feedName: 'CNBC TV18 Economy', category: 'Economy', url: 'https://news.google.com/rss/search?q=site:cnbctv18.com+economy&hl=en-IN&gl=IN&ceid=IN:en' },
    { publisher: 'CNBC TV18', feedName: 'CNBC TV18 Tech', category: 'Technology', url: 'https://news.google.com/rss/search?q=site:cnbctv18.com+tech&hl=en-IN&gl=IN&ceid=IN:en' },

    // Economic Times
    { publisher: 'Economic Times', feedName: 'ET Markets', category: 'Markets', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
    { publisher: 'Economic Times', feedName: 'ET Industry', category: 'Corporate', url: 'https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms' },
    { publisher: 'Economic Times', feedName: 'ET Economy', category: 'Economy', url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms' },
    { publisher: 'Economic Times', feedName: 'ET Tech', category: 'Technology', url: 'https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms' },

    // LiveMint
    { publisher: 'LiveMint', feedName: 'LiveMint Markets', category: 'Markets', url: 'https://www.livemint.com/rss/markets' },
    { publisher: 'LiveMint', feedName: 'LiveMint Companies', category: 'Corporate', url: 'https://www.livemint.com/rss/companies' },
    { publisher: 'LiveMint', feedName: 'LiveMint Economy', category: 'Economy', url: 'https://www.livemint.com/rss/economy' },

    // Moneycontrol
    { publisher: 'Moneycontrol', feedName: 'Moneycontrol Latest', category: 'Markets', url: 'https://www.moneycontrol.com/rss/latestnews.xml' },
    { publisher: 'Moneycontrol', feedName: 'F&O Derivatives', category: 'F&O', url: 'https://news.google.com/rss/search?q=site:moneycontrol.com+F%26O+derivatives&hl=en-IN&gl=IN&ceid=IN:en' },
    { publisher: 'Moneycontrol', feedName: 'Moneycontrol Business', category: 'Corporate', url: 'https://www.moneycontrol.com/rss/business.xml' },
    { publisher: 'Moneycontrol', feedName: 'Moneycontrol Results', category: 'Results', url: 'https://www.moneycontrol.com/rss/results.xml' },
    { publisher: 'Moneycontrol', feedName: 'Moneycontrol Technology', category: 'Technology', url: 'https://www.moneycontrol.com/rss/technology.xml' },

    // Business Standard
    { publisher: 'Business Standard', feedName: 'BS Markets', category: 'Markets', url: 'https://news.google.com/rss/search?q=site:business-standard.com+markets&hl=en-IN&gl=IN&ceid=IN:en' },
    { publisher: 'Business Standard', feedName: 'BS Companies', category: 'Corporate', url: 'https://news.google.com/rss/search?q=site:business-standard.com+companies&hl=en-IN&gl=IN&ceid=IN:en' },
    { publisher: 'Business Standard', feedName: 'BS Economy', category: 'Economy', url: 'https://news.google.com/rss/search?q=site:business-standard.com+economy&hl=en-IN&gl=IN&ceid=IN:en' },
    { publisher: 'Business Standard', feedName: 'BS Tech', category: 'Technology', url: 'https://news.google.com/rss/search?q=site:business-standard.com+technology&hl=en-IN&gl=IN&ceid=IN:en' },
  ];

  public async fetchLatest(): Promise<NewsItem[]> {
    const results = await Promise.allSettled(
      this.feedList.map((cfg) => this.fetchSingleFeed(cfg))
    );

    const items: NewsItem[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled') {
        items.push(...res.value);
      }
    }
    return items;
  }

  private async fetchSingleFeed(cfg: FeedConfig): Promise<NewsItem[]> {
    try {
      const response = await fetchWithTimeout(cfg.url, {}, 8000);
      if (!response.ok) return [];
      const xml = await response.text();
      const parsed = await parser.parseString(xml);

      return (parsed.items || []).map((item, idx) => {
        const headline = (item.title || '').trim() || 'Financial Update';
        let imageUrl: string | undefined = undefined;

        if (item.enclosure && item.enclosure.url) {
          imageUrl = item.enclosure.url;
        } else if ((item as any).mediaContent && (item as any).mediaContent.$ && (item as any).mediaContent.$.url) {
          imageUrl = (item as any).mediaContent.$.url;
        }

        const link = item.link || cfg.url;

        return {
          id: `pub-${cfg.publisher}-${idx}-${Date.now()}`,
          headline,
          description: (item.contentSnippet || item.content || headline).substring(0, 500),
          publisher: cfg.publisher,
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          category: cfg.category,
          categories: [cfg.category],
          country: 'India',
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
