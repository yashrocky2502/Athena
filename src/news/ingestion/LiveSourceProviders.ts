/**
 * ATHENA NEWS ENGINE — STAGE 8.1 LIVE SOURCE PROVIDERS
 * Production-ready source providers for RSS, Official Regulatory Feeds, RSSHub, SearXNG, and Dynamic Discovery.
 */

import Parser from 'rss-parser';
import { ICollectorSource } from './CollectorAdapter';
import { RSSHubSourceProvider, SearXNGSourceProvider, SourceDiscoveryService } from '../services/FutureAdapters';

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 AthenaNewsBot/8.1',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html;q=0.9, */*;q=0.8'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator']
    ]
  }
});

export interface LiveSourceFeedConfig {
  id: string;
  name: string;
  publisher: string;
  category: string;
  url: string;
  tier: 1 | 2 | 3;
  enabled: boolean;
}

export const AUTHORITATIVE_LIVE_FEEDS: LiveSourceFeedConfig[] = [
  // Economic Times
  {
    id: 'et-markets',
    name: 'ET Markets',
    publisher: 'Economic Times',
    category: 'MARKETS',
    url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    tier: 1,
    enabled: true
  },
  {
    id: 'et-industry',
    name: 'ET Industry',
    publisher: 'Economic Times',
    category: 'CORPORATE',
    url: 'https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms',
    tier: 1,
    enabled: true
  },
  {
    id: 'et-economy',
    name: 'ET Economy',
    publisher: 'Economic Times',
    category: 'MACRO',
    url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms',
    tier: 1,
    enabled: true
  },
  // Moneycontrol
  {
    id: 'mc-latest',
    name: 'Moneycontrol Latest',
    publisher: 'Moneycontrol',
    category: 'MARKETS',
    url: 'https://www.moneycontrol.com/rss/latestnews.xml',
    tier: 1,
    enabled: true
  },
  {
    id: 'mc-business',
    name: 'Moneycontrol Business',
    publisher: 'Moneycontrol',
    category: 'CORPORATE',
    url: 'https://www.moneycontrol.com/rss/business.xml',
    tier: 1,
    enabled: true
  },
  {
    id: 'mc-results',
    name: 'Moneycontrol Results',
    publisher: 'Moneycontrol',
    category: 'EARNINGS',
    url: 'https://www.moneycontrol.com/rss/results.xml',
    tier: 1,
    enabled: true
  },
  // LiveMint
  {
    id: 'mint-markets',
    name: 'LiveMint Markets',
    publisher: 'LiveMint',
    category: 'MARKETS',
    url: 'https://www.livemint.com/rss/markets',
    tier: 1,
    enabled: true
  },
  {
    id: 'mint-companies',
    name: 'LiveMint Companies',
    publisher: 'LiveMint',
    category: 'CORPORATE',
    url: 'https://www.livemint.com/rss/companies',
    tier: 1,
    enabled: true
  },
  // Business Standard
  {
    id: 'bs-markets',
    name: 'Business Standard Markets',
    publisher: 'Business Standard',
    category: 'MARKETS',
    url: 'https://news.google.com/rss/search?q=site:business-standard.com+markets&hl=en-IN&gl=IN&ceid=IN:en',
    tier: 1,
    enabled: true
  },
  // CNBC TV18
  {
    id: 'cnbc-markets',
    name: 'CNBC TV18 Markets',
    publisher: 'CNBC TV18',
    category: 'MARKETS',
    url: 'https://news.google.com/rss/search?q=site:cnbctv18.com+market&hl=en-IN&gl=IN&ceid=IN:en',
    tier: 1,
    enabled: true
  },
  // Reuters Business
  {
    id: 'reuters-business',
    name: 'Reuters Business',
    publisher: 'Reuters',
    category: 'GLOBAL',
    url: 'https://news.google.com/rss/search?q=site:reuters.com+business&hl=en-US&gl=US&ceid=US:en',
    tier: 1,
    enabled: true
  },
  // Google Discovery
  {
    id: 'google-indian-equities',
    name: 'Google Indian Equities',
    publisher: 'Google News',
    category: 'MARKETS',
    url: 'https://news.google.com/rss/search?q=NSE+BSE+Nifty+Sensex+Stock+Market+India&hl=en-IN&gl=IN&ceid=IN:en',
    tier: 1,
    enabled: true
  }
];

export class LiveRssSourceProvider implements ICollectorSource {
  public name: string;
  private config: LiveSourceFeedConfig;

  constructor(config: LiveSourceFeedConfig) {
    this.config = config;
    this.name = config.name;
  }

  public async collect(): Promise<any[]> {
    if (!this.config.enabled) {
      return [];
    }

    try {
      const feed = await rssParser.parseURL(this.config.url);
      if (!feed || !Array.isArray(feed.items)) {
        return [];
      }

      return feed.items.map((item) => {
        const headline = (item.title || '').trim();
        const url = (item.link || item.guid || '').trim();
        const rawContent = item.contentEncoded || item.content || item.contentSnippet || item.summary || headline;
        const publishedAt = item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString());

        return {
          headline,
          title: headline,
          url,
          link: url,
          body: rawContent,
          content: rawContent,
          publisher: this.config.publisher,
          category: this.config.category,
          publishedAt,
          collectionMethod: 'RSS_LIVE',
          tier: this.config.tier,
          feedId: this.config.id
        };
      });
    } catch (err: any) {
      // Graceful error logging without crashing caller
      console.warn(`[LiveRssSourceProvider] Failed to fetch feed ${this.config.name} (${this.config.url}): ${err.message}`);
      return [];
    }
  }
}

/**
 * Official Regulatory / Exchange Announcements Provider (NSE, BSE, SEBI, RBI, PIB)
 */
export class OfficialFeedsSourceProvider implements ICollectorSource {
  public name = 'Official Regulatory & Exchange Feeds';

  public async collect(): Promise<any[]> {
    // Official exchange feeds through verified RSS/discovery channels
    const officialFeeds: LiveSourceFeedConfig[] = [
      {
        id: 'sebi-circulars',
        name: 'SEBI Circulars',
        publisher: 'SEBI',
        category: 'REGULATORY',
        url: 'https://news.google.com/rss/search?q=site:sebi.gov.in+circular&hl=en-IN&gl=IN&ceid=IN:en',
        tier: 1,
        enabled: true
      },
      {
        id: 'rbi-press',
        name: 'RBI Press Releases',
        publisher: 'RBI',
        category: 'MACRO',
        url: 'https://news.google.com/rss/search?q=site:rbi.org.in+press+release&hl=en-IN&gl=IN&ceid=IN:en',
        tier: 1,
        enabled: true
      },
      {
        id: 'pib-finance',
        name: 'PIB Ministry of Finance',
        publisher: 'PIB',
        category: 'GOVERNMENT',
        url: 'https://news.google.com/rss/search?q=site:pib.gov.in+Ministry+of+Finance&hl=en-IN&gl=IN&ceid=IN:en',
        tier: 1,
        enabled: true
      }
    ];

    const results: any[] = [];
    for (const feedCfg of officialFeeds) {
      const provider = new LiveRssSourceProvider(feedCfg);
      try {
        const items = await provider.collect();
        results.push(...items);
      } catch (err: any) {
        console.warn(`[OfficialFeedsSourceProvider] Sub-feed ${feedCfg.name} failed:`, err.message);
      }
    }
    return results;
  }
}

/**
 * Optional RSSHub Source Provider
 */
export class RSSHubSourceProviderImpl implements RSSHubSourceProvider {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.RSSHUB_URL || 'https://rsshub.app') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public isAvailable(): boolean {
    return !!process.env.RSSHUB_URL || true;
  }

  public async fetchRSSHubFeed(route: string): Promise<any[]> {
    const cleanRoute = route.startsWith('/') ? route : `/${route}`;
    const targetUrl = `${this.baseUrl}${cleanRoute}`;

    try {
      const feed = await rssParser.parseURL(targetUrl);
      if (!feed || !Array.isArray(feed.items)) return [];

      return feed.items.map(item => ({
        headline: (item.title || '').trim(),
        url: (item.link || '').trim(),
        body: item.contentSnippet || item.content || item.title,
        publishedAt: item.isoDate || new Date().toISOString(),
        publisher: 'RSSHub',
        collectionMethod: 'RSSHUB'
      }));
    } catch (err: any) {
      console.warn(`[RSSHubSourceProvider] Route ${route} unavailable: ${err.message}`);
      return [];
    }
  }
}

/**
 * Optional SearXNG Source Provider
 */
export class SearXNGSourceProviderImpl implements SearXNGSourceProvider {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.SEARXNG_URL || '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public isAvailable(): boolean {
    return !!this.baseUrl;
  }

  public async searchMeta(query: string): Promise<any[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const targetUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=news`;
      const res = await fetch(targetUrl, {
        headers: { 'User-Agent': 'AthenaNewsEngine/8.1' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];

      return results.map((r: any) => ({
        headline: r.title || '',
        url: r.url || '',
        body: r.content || r.title || '',
        publishedAt: r.publishedDate || new Date().toISOString(),
        publisher: r.engine || 'SearXNG',
        collectionMethod: 'SEARXNG'
      }));
    } catch (err: any) {
      console.warn(`[SearXNGSourceProvider] Query "${query}" failed: ${err.message}`);
      return [];
    }
  }
}

/**
 * Dynamic Source Discovery Service
 */
export class SourceDiscoveryServiceImpl implements SourceDiscoveryService {
  public async discoverFeeds(topic: string): Promise<string[]> {
    // Generate verified financial RSS search endpoints for Indian & global market topics
    const encodedTopic = encodeURIComponent(topic);
    return [
      `https://news.google.com/rss/search?q=${encodedTopic}+when:2d&hl=en-IN&gl=IN&ceid=IN:en`,
      `https://news.google.com/rss/search?q=${encodedTopic}+stock+market&hl=en-IN&gl=IN&ceid=IN:en`
    ];
  }
}
