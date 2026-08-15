export interface ProviderConfig {
  id: string;
  publisherName: string;
  rssUrl: string;
  sitemapUrl?: string;
  country: 'India' | 'US' | 'Global' | 'Europe' | 'China' | 'Japan' | 'Middle East';
  language: string;
  priority: number; // 1 = Official Publisher, 2 = Exchange, 3 = Government, 4 = Google Discovery
  supportedDiscoveryMethods: ('RSS' | 'SITEMAP' | 'GOOGLE_DISCOVERY')[];
  categoryMapping?: Record<string, string>;
  defaultCategory: string;
  enabled: boolean;
}

export class FeedRegistry {
  private static instance: FeedRegistry;
  private providers: Map<string, ProviderConfig> = new Map();

  private constructor() {
    this.registerDefaultProviders();
  }

  public static getInstance(): FeedRegistry {
    if (!FeedRegistry.instance) {
      FeedRegistry.instance = new FeedRegistry();
    }
    return FeedRegistry.instance;
  }

  private registerDefaultProviders() {
    const defaultList: ProviderConfig[] = [
      {
        id: 'reuters',
        publisherName: 'Reuters',
        rssUrl: 'https://www.reutersagency.com/feed/?best-topics=business-finance',
        sitemapUrl: 'https://www.reuters.com/arc/outboundfeeds/sitemap-news.xml',
        country: 'Global',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS', 'SITEMAP'],
        defaultCategory: 'Global',
        enabled: true,
      },
      {
        id: 'cnbc_tv18',
        publisherName: 'CNBC TV18',
        rssUrl: 'https://www.cnbctv18.com/common/rss/market.xml',
        sitemapUrl: 'https://www.cnbctv18.com/sitemap_news.xml',
        country: 'India',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS', 'SITEMAP'],
        defaultCategory: 'Markets',
        enabled: true,
      },
      {
        id: 'livemint',
        publisherName: 'LiveMint',
        rssUrl: 'https://www.livemint.com/rss/markets',
        sitemapUrl: 'https://www.livemint.com/sitemap/news.xml',
        country: 'India',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS', 'SITEMAP'],
        defaultCategory: 'Markets',
        enabled: true,
      },
      {
        id: 'economic_times',
        publisherName: 'Economic Times',
        rssUrl: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
        sitemapUrl: 'https://economictimes.indiatimes.com/sitemap/news.xml',
        country: 'India',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS', 'SITEMAP'],
        defaultCategory: 'Markets',
        enabled: true,
      },
      {
        id: 'business_standard',
        publisherName: 'Business Standard',
        rssUrl: 'https://www.business-standard.com/rss/markets-106.rss',
        sitemapUrl: 'https://www.business-standard.com/sitemap/news.xml',
        country: 'India',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS', 'SITEMAP'],
        defaultCategory: 'Markets',
        enabled: true,
      },
      {
        id: 'moneycontrol',
        publisherName: 'Moneycontrol',
        rssUrl: 'https://www.moneycontrol.com/rss/latestnews.xml',
        sitemapUrl: 'https://www.moneycontrol.com/google-sitemap/news.xml',
        country: 'India',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS', 'SITEMAP'],
        defaultCategory: 'Markets',
        enabled: true,
      },
      {
        id: 'coindesk',
        publisherName: 'CoinDesk',
        rssUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
        country: 'Global',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS'],
        defaultCategory: 'Crypto',
        enabled: true,
      },
      {
        id: 'cointelegraph',
        publisherName: 'CoinTelegraph',
        rssUrl: 'https://cointelegraph.com/rss',
        country: 'Global',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS'],
        defaultCategory: 'Crypto',
        enabled: true,
      },
      {
        id: 'yahoo_finance',
        publisherName: 'Yahoo Finance',
        rssUrl: 'https://finance.yahoo.com/news/rssindex',
        country: 'US',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS'],
        defaultCategory: 'Markets',
        enabled: true,
      },
      {
        id: 'marketwatch',
        publisherName: 'MarketWatch',
        rssUrl: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
        country: 'US',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS'],
        defaultCategory: 'Markets',
        enabled: true,
      },
      {
        id: 'investing_com',
        publisherName: 'Investing.com',
        rssUrl: 'https://www.investing.com/rss/news.rss',
        country: 'Global',
        language: 'en',
        priority: 1,
        supportedDiscoveryMethods: ['RSS'],
        defaultCategory: 'Markets',
        enabled: true,
      },
      {
        id: 'nse',
        publisherName: 'NSE',
        rssUrl: 'https://news.google.com/rss/search?q=site:nseindia.com',
        country: 'India',
        language: 'en',
        priority: 2,
        supportedDiscoveryMethods: ['GOOGLE_DISCOVERY'],
        defaultCategory: 'Exchange',
        enabled: true,
      },
      {
        id: 'bse',
        publisherName: 'BSE',
        rssUrl: 'https://news.google.com/rss/search?q=site:bseindia.com',
        country: 'India',
        language: 'en',
        priority: 2,
        supportedDiscoveryMethods: ['GOOGLE_DISCOVERY'],
        defaultCategory: 'Exchange',
        enabled: true,
      },
      {
        id: 'sebi',
        publisherName: 'SEBI',
        rssUrl: 'https://news.google.com/rss/search?q=SEBI+press+release',
        country: 'India',
        language: 'en',
        priority: 3,
        supportedDiscoveryMethods: ['GOOGLE_DISCOVERY'],
        defaultCategory: 'Government',
        enabled: true,
      },
      {
        id: 'rbi',
        publisherName: 'RBI',
        rssUrl: 'https://news.google.com/rss/search?q=RBI+monetary+policy',
        country: 'India',
        language: 'en',
        priority: 3,
        supportedDiscoveryMethods: ['GOOGLE_DISCOVERY'],
        defaultCategory: 'Government',
        enabled: true,
      },
      {
        id: 'pib',
        publisherName: 'PIB',
        rssUrl: 'https://news.google.com/rss/search?q=Press+Information+Bureau',
        country: 'India',
        language: 'en',
        priority: 3,
        supportedDiscoveryMethods: ['GOOGLE_DISCOVERY'],
        defaultCategory: 'Government',
        enabled: true,
      },
      {
        id: 'mca',
        publisherName: 'MCA',
        rssUrl: 'https://news.google.com/rss/search?q=Ministry+of+Corporate+Affairs',
        country: 'India',
        language: 'en',
        priority: 3,
        supportedDiscoveryMethods: ['GOOGLE_DISCOVERY'],
        defaultCategory: 'Government',
        enabled: true,
      },
      {
        id: 'bloomberg_disc',
        publisherName: 'Bloomberg',
        rssUrl: 'https://news.google.com/rss/search?q=site:bloomberg.com',
        country: 'US',
        language: 'en',
        priority: 4,
        supportedDiscoveryMethods: ['GOOGLE_DISCOVERY'],
        defaultCategory: 'Global',
        enabled: true,
      },
      {
        id: 'google_news_top',
        publisherName: 'Google News Discovery',
        rssUrl: 'https://news.google.com/rss',
        country: 'India',
        language: 'en',
        priority: 4,
        supportedDiscoveryMethods: ['GOOGLE_DISCOVERY'],
        defaultCategory: 'Markets',
        enabled: true,
      },
    ];

    for (const p of defaultList) {
      this.providers.set(p.id, p);
    }
  }

  public registerProvider(config: ProviderConfig): void {
    this.providers.set(config.id, config);
  }

  public getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values()).filter((p) => p.enabled);
  }

  public getProviderById(id: string): ProviderConfig | undefined {
    return this.providers.get(id);
  }
}
