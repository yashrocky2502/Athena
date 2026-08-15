import Parser from 'rss-parser';
import { NewsConnector, fetchWithTimeout } from './BaseConnector';
import { NewsItem } from '../models/NewsItem';

const parser = new Parser();

interface RegulatoryFeed {
  publisher: string;
  feedName: string;
  category: string;
  url: string;
  isExchange: boolean;
}

export class ExchangeAndGovConnector implements NewsConnector {
  public name = 'Exchange & Government Regulatory Feeds';
  public sourceType: 'EXCHANGE' | 'GOVERNMENT' | 'RSS' = 'EXCHANGE';

  private feeds: RegulatoryFeed[] = [
    // NSE & BSE Google News / Direct RSS Feeds
    { publisher: 'NSE India', feedName: 'NSE Corporate Announcements', category: 'Exchange', url: 'https://news.google.com/rss/search?q=site:nseindia.com+OR+"NSE+Announcements"&hl=en-IN&gl=IN&ceid=IN:en', isExchange: true },
    { publisher: 'BSE India', feedName: 'BSE Corporate Announcements', category: 'Exchange', url: 'https://news.google.com/rss/search?q=site:bseindia.com+OR+"BSE+Corporate+Announcements"&hl=en-IN&gl=IN&ceid=IN:en', isExchange: true },
    { publisher: 'NSE India', feedName: 'NSE Circulars & Results', category: 'Results', url: 'https://news.google.com/rss/search?q="NSE"+financial+results+board+meeting&hl=en-IN&gl=IN&ceid=IN:en', isExchange: true },
    { publisher: 'BSE India', feedName: 'BSE Board Meetings & Actions', category: 'Exchange', url: 'https://news.google.com/rss/search?q="BSE"+board+meeting+dividend+bonus&hl=en-IN&gl=IN&ceid=IN:en', isExchange: true },

    // SEBI
    { publisher: 'SEBI', feedName: 'SEBI Press Releases & Orders', category: 'Government', url: 'https://news.google.com/rss/search?q="SEBI"+press+release+order+circular&hl=en-IN&gl=IN&ceid=IN:en', isExchange: false },

    // RBI
    { publisher: 'RBI', feedName: 'RBI Policy & Notifications', category: 'Government', url: 'https://news.google.com/rss/search?q="Reserve+Bank+of+India"+OR+"RBI"+monetary+policy+notification&hl=en-IN&gl=IN&ceid=IN:en', isExchange: false },

    // PIB & MCA
    { publisher: 'PIB', feedName: 'PIB Finance & Cabinet Releases', category: 'Government', url: 'https://news.google.com/rss/search?q="Press+Information+Bureau"+Finance+Ministry+Cabinet&hl=en-IN&gl=IN&ceid=IN:en', isExchange: false },
    { publisher: 'MCA', feedName: 'MCA Corporate Notifications', category: 'Government', url: 'https://news.google.com/rss/search?q="Ministry+of+Corporate+Affairs"+ROC+notification&hl=en-IN&gl=IN&ceid=IN:en', isExchange: false },
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

  private async fetchSingleFeed(feed: RegulatoryFeed): Promise<NewsItem[]> {
    try {
      const response = await fetchWithTimeout(feed.url, {}, 8000);
      if (!response.ok) return [];
      const xml = await response.text();
      const parsed = await parser.parseString(xml);

      return (parsed.items || []).map((item, idx) => {
        const headline = (item.title || '').replace(/ - [^-]+$/, '').trim() || `${feed.publisher} Announcement`;

        const link = item.link || feed.url;

        return {
          id: `gov-${feed.publisher}-${idx}-${Date.now()}`,
          headline,
          description: (item.contentSnippet || item.content || headline).substring(0, 500),
          publisher: feed.publisher,
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          category: feed.category,
          categories: [feed.category, feed.isExchange ? 'Exchange' : 'Government'],
          country: 'India',
          language: 'en',
          url: link,
          publisherUrl: link,
          canonicalUrl: link,
          resolutionStatus: 'RESOLVED',
          image: undefined,
          source: feed.publisher,
          sourceType: feed.isExchange ? 'EXCHANGE' : 'GOVERNMENT',
          discoveryLayer: feed.isExchange ? 'EXCHANGE' : 'GOVERNMENT',
          isExchange: feed.isExchange,
          feedName: feed.feedName,
          rssSource: feed.url,
        };
      });
    } catch {
      return [];
    }
  }
}
