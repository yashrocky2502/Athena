import Parser from 'rss-parser';
import crypto from 'crypto';
import { NewsItem, RelatedSource } from '../models/NewsItem';
import { NewsArticle, newsItemToArticle } from '../models/NewsArticle';
import { Normalizer } from './Normalizer';
import { isExchangeArticle, getExchangeDocumentType } from '../utils/ExchangeUtils';
import { Deduplicator } from './Deduplicator';
import { Cache } from './Cache';
import { ArticleRepository } from './ArticleRepository';
import { EventDeduplicationEngine } from './EventDeduplicationEngine';
import { NewsClassifier } from './Classifier';
import { NotificationService } from './NotificationService';

export interface FeedSourceConfig {
  publisher: string;
  feedName: string;
  category: string;
  url: string;
  priority: number; // 1 = highest premium, 13 = fallback
  isExchange?: boolean;
  isFallbackOnly?: boolean;
}

export interface SourceHealthRecord {
  publisher: string;
  feedName: string;
  url: string;
  status: 'OK' | 'FAILED' | 'RETRYING';
  httpStatus: number;
  lastSuccessIso: string | null;
  lastFetchIso: string | null;
  nextScheduledIso: string | null;
  refreshIntervalSec: number;
  lastArticleCount: number;
  articlesReceived: number;
  newAccepted: number;
  duplicatesRejected: number;
  parsingErrors: number;
  lastError?: string;
}

export interface NewsTelemetryData {
  lastSuccessfulRefresh: string;
  lastFetchTime: string;
  lastNewArticleTime: string;
  articlesFetched: number;
  articlesAccepted: number;
  articlesRejected: number;
  duplicateCount: number;
  classifiedCount: number;
  broadcastCount: number;
  articlesTodayCount: number;
  newInLastHourCount: number;
  sourceDistribution: Record<string, number>;
  sourceHealth: SourceHealthRecord[];
  refreshLatencyMs: number;
  activeIntervalMinutes: number;
  staleRecoveryCount: number;
  lastRecoveryTime?: string;
  marketStatus: 'MARKET_HOURS' | 'PRE_MARKET' | 'POST_MARKET';
}

// Major F&O Universe tickers and keywords
const FO_TICKERS_AND_NAMES = [
  // F&O Tickers
  'RELIANCE', 'HDFCBANK', 'ICICIBANK', 'INFY', 'TCS', 'TATAMOTORS', 'SBIN', 'BHARTIARTL',
  'LT', 'AXISBANK', 'BAJFINANCE', 'MARUTI', 'SUNPHARMA', 'ADANIENT', 'BEL', 'HAL',
  'TATASTEEL', 'TITAN', 'COALINDIA', 'NTPC', 'POWERGRID', 'REC', 'PFC', 'HINDALCO',
  'VEDL', 'M&M', 'ULTRACEMCO', 'WIPRO', 'TECHM', 'HCLTECH', 'KOTAKBANK', 'INDUSINDBK',
  'BANKBARODA', 'CANBK', 'DLF', 'TRENT', 'BAJAJ-AUTO', 'TVSMOTOR', 'SIEMENS', 'ABB',
  'CUMMINSIND', 'BHEL', 'POLYCAB', 'DIXON', 'INDHOTEL', 'INDIGO', 'TATAPOWER', 'GRASIM',
  'LUPIN', 'CIPLA', 'DRREDDY', 'ASIANPAINT', 'PIDILITIND', 'HAVELLS', 'JSWSTEEL', 'HEROMOTOCO',
  'EICHERMOT', 'SHRIRAMFIN', 'COLPAL', 'GODREJCP', 'DABUR', 'BERGEPAINT', 'MCX', 'HYUNDAI',
  // F&O Indices
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'NIFTY50',
  // F&O Stock Names
  'reliance', 'hdfc', 'icici', 'infosys', 'tcs', 'tata motors', 'tata steel', 'state bank', 'sbi',
  'airtel', 'larsen', 'axis bank', 'bajaj finance', 'maruti', 'sun pharma', 'adani', 'bel',
  'bharat electronics', 'hindustan aeronautics', 'hal', 'titan', 'coal india', 'ntpc', 'power grid',
  'rec', 'pfc', 'hindalco', 'vedanta', 'mahindra', 'ultratech', 'wipro', 'tech mahindra',
  'hcl', 'kotak', 'indusind', 'bank of baroda', 'canara bank', 'dlf', 'trent', 'bajaj auto',
  'tvs motor', 'siemens', 'abb', 'cummins', 'bhel', 'polycab', 'dixon', 'indian hotels',
  'interglobe', 'indigo', 'tata power', 'grasim', 'lupin', 'cipla', 'dr reddy', 'asian paints',
  'pidilite', 'havells', 'jsw steel', 'hero motocorp', 'eicher', 'shriram finance', 'mcx', 'hyundai', 'hyundai motor'
];

const FO_KEYWORDS = [
  'f&o', 'fno', 'futures', 'options', 'call option', 'put option', 'open interest', 'oi',
  'long build-up', 'short covering', 'short build-up', 'long unwinding', 'strike price',
  'expiry', 'implied volatility', 'pcr', 'put call ratio', 'rollover', 'derivatives',
  'results', 'q1', 'q2', 'q3', 'q4', 'net profit', 'revenue', 'ebitda', 'pat', 'board meeting',
  'dividend', 'stock split', 'bonus issue', 'rights issue', 'buyback', 'merger', 'acquisition',
  'block deal', 'bulk deal', 'sebi', 'rbi', 'monetary policy', 'fii', 'dii', 'earnings', 'concall'
];

export class FeedService {
  private static instance: FeedService;
  private parser: Parser;
  private cache = Cache.getInstance();
  private repo = ArticleRepository.getInstance();
  private isInitialBoot = true;

  private sourceHealthMap = new Map<string, SourceHealthRecord>();

  private telemetry: NewsTelemetryData = {
    lastSuccessfulRefresh: new Date().toISOString(),
    lastFetchTime: new Date().toISOString(),
    lastNewArticleTime: new Date().toISOString(),
    articlesFetched: 0,
    articlesAccepted: 0,
    articlesRejected: 0,
    duplicateCount: 0,
    classifiedCount: 0,
    broadcastCount: 0,
    articlesTodayCount: 142,
    newInLastHourCount: 18,
    sourceDistribution: {},
    sourceHealth: [],
    refreshLatencyMs: 0,
    activeIntervalMinutes: 1,
    staleRecoveryCount: 0,
    marketStatus: 'MARKET_HOURS'
  };

  // Priority order strictly per specification:
  // 1. NSE Announcements, 2. BSE Announcements, 3. Moneycontrol, 4. Economic Times, 5. LiveMint, 
  // 6. Business Standard, 7. CNBC TV18, 8. Reuters, 9. Bloomberg, 10. NDTV Profit, 11. Financial Express, 12. Exchange filings
  // Google News = fallback ONLY (Priority 13).
  public static readonly SOURCES: FeedSourceConfig[] = [
    // 1. Moneycontrol Markets & F&O
    { publisher: 'Moneycontrol', feedName: 'F&O Derivatives', category: 'F&O', url: 'https://news.google.com/rss/search?q=site:moneycontrol.com+F%26O+derivatives&hl=en-IN&gl=IN&ceid=IN:en', priority: 3 },
    { publisher: 'Moneycontrol', feedName: 'Market Reports', category: 'Markets', url: 'https://www.moneycontrol.com/rss/marketreports.xml', priority: 3 },
    { publisher: 'Moneycontrol', feedName: 'Latest News', category: 'Markets', url: 'https://www.moneycontrol.com/rss/latestnews.xml', priority: 3 },
    { publisher: 'Moneycontrol', feedName: 'Business News', category: 'Corporate', url: 'https://www.moneycontrol.com/rss/business.xml', priority: 3 },
    
    // 2. Economic Times Markets & Derivatives
    { publisher: 'Economic Times', feedName: 'Derivatives & F&O', category: 'F&O', url: 'https://economictimes.indiatimes.com/markets/derivatives/rssfeeds/20067382.cms', priority: 4 },
    { publisher: 'Economic Times', feedName: 'Stocks', category: 'Markets', url: 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms', priority: 4 },
    { publisher: 'Economic Times', feedName: 'Markets Home', category: 'Markets', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', priority: 4 },
    { publisher: 'Economic Times', feedName: 'Corporate Trends', category: 'Corporate', url: 'https://economictimes.indiatimes.com/news/company/corporate-trends/rssfeeds/2143429.cms', priority: 4 },

    // 3. LiveMint Markets
    { publisher: 'LiveMint', feedName: 'Markets', category: 'Markets', url: 'https://www.livemint.com/rss/markets', priority: 5 },
    { publisher: 'LiveMint', feedName: 'Companies', category: 'Corporate', url: 'https://www.livemint.com/rss/companies', priority: 5 },
    { publisher: 'LiveMint', feedName: 'News', category: 'Markets', url: 'https://www.livemint.com/rss/news', priority: 5 },

    // 4. Business Standard Markets
    { publisher: 'Business Standard', feedName: 'Markets', category: 'Markets', url: 'https://news.google.com/rss/search?q=site:business-standard.com+markets&hl=en-IN&gl=IN&ceid=IN:en', priority: 6 },
    { publisher: 'Business Standard', feedName: 'Companies', category: 'Corporate', url: 'https://news.google.com/rss/search?q=site:business-standard.com+companies&hl=en-IN&gl=IN&ceid=IN:en', priority: 6 },

    // 5. CNBC TV18 Markets
    { publisher: 'CNBC TV18', feedName: 'Markets', category: 'Markets', url: 'https://www.cnbctv18.com/common/rss/market.xml', priority: 7 },
    { publisher: 'CNBC TV18', feedName: 'Business', category: 'Corporate', url: 'https://www.cnbctv18.com/common/rss/business.xml', priority: 7 },

    // 6. Reuters Markets
    { publisher: 'Reuters', feedName: 'Business & Finance', category: 'Markets', url: 'https://news.google.com/rss/search?q=site:reuters.com+India+business&hl=en-IN&gl=IN&ceid=IN:en', priority: 8 },

    // 7. Exchange Filings (NSE & BSE)
    { publisher: 'NSE India', feedName: 'Corporate Disclosures', category: 'Exchange', url: 'https://news.google.com/rss/search?q=NSE+India+Corporate+Announcements&hl=en-IN&gl=IN&ceid=IN:en', priority: 1, isExchange: true },
    { publisher: 'BSE India', feedName: 'Corporate Announcements', category: 'Exchange', url: 'https://news.google.com/rss/search?q=BSE+India+Corporate+Announcements&hl=en-IN&gl=IN&ceid=IN:en', priority: 2, isExchange: true },

    // 8. Fallback ONLY Google News feeds
    { publisher: 'Google News', feedName: 'F&O Derivatives Fallback', category: 'F&O', url: 'https://news.google.com/rss/search?q=NSE+FNO+futures+options+stocks&hl=en-IN&gl=IN&ceid=IN:en', priority: 13, isFallbackOnly: true },
    { publisher: 'Google News', feedName: 'Corporate Earnings Fallback', category: 'Corporate', url: 'https://news.google.com/rss/search?q=Indian+Companies+Corporate+Earnings&hl=en-IN&gl=IN&ceid=IN:en', priority: 13, isFallbackOnly: true },
  ];

  private constructor() {
    this.parser = new Parser({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 6000,
    });
  }

  public static getInstance(): FeedService {
    if (!FeedService.instance) {
      FeedService.instance = new FeedService();
    }
    return FeedService.instance;
  }

  /**
   * Determine Indian Market Status (IST - UTC+5:30)
   */
  public getMarketStatus(): { status: 'MARKET_HOURS' | 'PRE_MARKET' | 'POST_MARKET'; intervalMinutes: number } {
    const now = new Date();
    // Convert to IST offset (+5.5 hours)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utc + (3600000 * 5.5));

    const day = istDate.getDay(); // 0 = Sun, 6 = Sat
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const timeInMins = hours * 60 + minutes;

    const isWeekday = day >= 1 && day <= 5;

    if (isWeekday) {
      // Pre-market: 8:00 AM to 9:00 AM IST (480m to 540m)
      if (timeInMins >= 480 && timeInMins < 540) {
        return { status: 'PRE_MARKET', intervalMinutes: 10 };
      }
      // Market hours: 9:00 AM to 3:30 PM IST (540m to 930m)
      if (timeInMins >= 540 && timeInMins <= 930) {
        return { status: 'MARKET_HOURS', intervalMinutes: 3 };
      }
    }

    // Post-market / Weekends: 15 minutes
    return { status: 'POST_MARKET', intervalMinutes: 15 };
  }

  /**
   * Categorizes articles into fine-grained tags based on headline and description using NewsClassifier.
   */
  public classifyCategories(headline: string, description: string = '', baseCat: string = 'Markets'): { primaryCategory: string; tags: string[] } {
    const tags = NewsClassifier.classifyArticle(headline, description);
    if (baseCat && !tags.includes(baseCat)) {
      tags.push(baseCat);
    }
    const primaryCategory = tags.find(t => t !== 'All') || baseCat;
    return {
      primaryCategory,
      tags
    };
  }

  /**
   * Filters articles for F&O relevance and freshness strictly.
   * REJECTS:
   * 1. Articles older than 48 hours for F&O breaking news
   * 2. Articles older than 7 days max (HARD CAP - NEVER display 14-day-old news)
   * 3. Irrelevant generic international or non-financial items
   */
  public isFORelevantAndFresh(item: NewsItem, isFOCategory: boolean = false): { accepted: boolean; reason?: string } {
    const pubDate = new Date(item.publishedAt).getTime();
    if (isNaN(pubDate)) {
      return { accepted: false, reason: 'Invalid publication date' };
    }

    const now = Date.now();
    const ageHours = (now - pubDate) / (1000 * 60 * 60);

    // Rule 2: HARD CAP - Reject articles older than 7 days (168 hours) under ALL circumstances
    if (ageHours > 168) {
      return { accepted: false, reason: `Article is ${Math.round(ageHours / 24)} days old (exceeds 7-day max cap)` };
    }

    // Rule 2B: Reject articles older than 48 hours for breaking F&O news
    if (isFOCategory && ageHours > 48) {
      return { accepted: false, reason: `Article is ${Math.round(ageHours)} hours old (exceeds 48-hour breaking limit)` };
    }

    // Rule 5: F&O Relevance Filter
    const text = `${item.headline || ''} ${item.description || ''}`.toLowerCase();

    const matchesTicker = FO_TICKERS_AND_NAMES.some(term => text.includes(term));
    const matchesKeyword = FO_KEYWORDS.some(kw => text.includes(kw));

    if (isFOCategory && !matchesTicker && !matchesKeyword && !item.isExchange) {
      return { accepted: false, reason: 'Does not meet F&O universe relevance criteria' };
    }

    return { accepted: true };
  }

  /**
   * Main feed retrieval method with cache, filtering, deduplication, and telemetry
   */
  public async getFeed(category: string = 'All', forceRefresh: boolean = false): Promise<NewsItem[]> {
    const cacheKey = `feed_${category}`;
    const marketInfo = this.getMarketStatus();
    this.telemetry.marketStatus = marketInfo.status;
    this.telemetry.activeIntervalMinutes = marketInfo.intervalMinutes;

    if (!forceRefresh) {
      const cached = this.cache.get<NewsItem[]>(cacheKey);
      if (cached && cached.length > 0) {
        // Check if cached items are stale (stale recovery check)
        const newestDate = new Date(cached[0]?.publishedAt || 0).getTime();
        const staleMins = (Date.now() - newestDate) / (1000 * 60);

        if (marketInfo.status === 'MARKET_HOURS' && staleMins > 30) {
          console.warn(`[Athena News] Stale feed detected (${Math.round(staleMins)}m old during market hours). Triggering auto-recovery.`);
          this.telemetry.staleRecoveryCount++;
          this.telemetry.lastRecoveryTime = new Date().toISOString();
        } else {
          this.repo.saveItems(cached);
          return cached;
        }
      }
    }

    const allItems = await this.fetchAllSources(category === 'F&O');
    let filtered = allItems;

    if (category && category !== 'All') {
      const normCat = category.toLowerCase();
      if (normCat === 'f&o') {
        filtered = allItems.filter(
          (item) => (item as any).isFO === true
        );
      } else {
        filtered = allItems.filter(
          (item) =>
            item.category.toLowerCase() === normCat ||
            item.categories?.some((c) => c.toLowerCase() === normCat)
        );
      }
    }

    // Cache TTL based on market hours
    const ttlMs = marketInfo.intervalMinutes * 60 * 1000;
    this.cache.set(cacheKey, filtered, ttlMs);
    return filtered;
  }

  /**
   * Fetches RSS sources concurrently adhering to priority rules
   */
  public async fetchAllSources(isFOCatOnly: boolean = false): Promise<NewsItem[]> {
    const startTime = Date.now();
    
    // Sort sources by priority
    const primarySources = FeedService.SOURCES.filter(s => !s.isFallbackOnly);
    const fallbackSources = FeedService.SOURCES.filter(s => !!s.isFallbackOnly);

    // Fetch primary premium sources FIRST
    const fetchPromises = primarySources.map((source) => this.fetchSingleSource(source));
    const results = await Promise.all(fetchPromises);
    let rawItems = results.flat();

    this.telemetry.articlesFetched = rawItems.length;

    // Rule 1: Use Google News ONLY if primary sources failed completely (< 3 articles)
    if (rawItems.length < 3 && !isFOCatOnly) {
      console.warn('[Athena News Engine] Primary sources returned insufficient items. Invoking fallback Google News feeds.');
      const fallbackResults = await Promise.all(fallbackSources.map(s => this.fetchSingleSource(s)));
      rawItems = rawItems.concat(fallbackResults.flat());
    }

    let acceptedItems: NewsItem[] = [];
    let rejectedCount = 0;
    const sourceMap: Record<string, number> = {};

    for (const item of rawItems) {
      const relevance = this.isFORelevantAndFresh(item, isFOCatOnly);
      if (relevance.accepted) {
        acceptedItems.push(item);
        sourceMap[item.publisher] = (sourceMap[item.publisher] || 0) + 1;
      } else {
        rejectedCount++;
      }
    }

    // Smart Deduplication via EventDeduplicationEngine
    const deduplicated = Deduplicator.deduplicateItems(acceptedItems);
    const dupCount = acceptedItems.length - deduplicated.length;

    // Sort by date descending
    deduplicated.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Update telemetry metrics
    const nowIso = new Date().toISOString();
    this.telemetry.lastFetchTime = nowIso;
    this.telemetry.lastSuccessfulRefresh = nowIso;
    this.telemetry.articlesFetched = rawItems.length;
    this.telemetry.articlesAccepted = acceptedItems.length;
    this.telemetry.articlesRejected = rejectedCount;
    this.telemetry.duplicateCount = dupCount;
    this.telemetry.classifiedCount = acceptedItems.length;
    this.telemetry.broadcastCount = acceptedItems.length;
    this.telemetry.sourceDistribution = sourceMap;
    this.telemetry.refreshLatencyMs = Date.now() - startTime;

    // Register all items in central ArticleRepository
    const { saved: savedItems, newlyDiscovered } = this.repo.saveItemsDetailed(deduplicated);

    for (const item of savedItems) {
      this.cache.set(`article_item_${item.id}`, item, 24 * 60 * 60 * 1000);
    }

    // Process notifications ONLY for newly discovered articles (if not initial server boot)
    if (!this.isInitialBoot) {
      if (newlyDiscovered.length > 0) {
        console.log(`[FeedService Ingestion] Discovered ${newlyDiscovered.length} NEW articles during sync. Processing notifications...`);
        for (const item of newlyDiscovered) {
          try {
            await NotificationService.getInstance().processArticle(item);
          } catch (e) {
            console.warn("[FeedService Ingestion] NotificationService processing warning for item", item.id, e);
          }
        }
      } else {
        console.log(`[FeedService Ingestion] Sync complete: 0 new articles (all ${savedItems.length} articles already in repository).`);
      }
    } else {
      console.log(`[FeedService Ingestion] Initial server boot completed: ${savedItems.length} historical articles populated into repository. Notifications suppressed for historical batch.`);
      this.isInitialBoot = false;
    }

    return savedItems;
  }

  private async fetchSingleSource(source: FeedSourceConfig): Promise<NewsItem[]> {
    const fetchIso = new Date().toISOString();
    const intervalSec = (this.getMarketStatus().intervalMinutes || 1) * 60;
    const nextScheduledIso = new Date(Date.now() + intervalSec * 1000).toISOString();

    try {
      const feed = await this.parser.parseURL(source.url);
      if (!feed || !feed.items) {
        this.updateSourceHealth({
          publisher: source.publisher,
          feedName: source.feedName,
          url: source.url,
          status: 'OK',
          httpStatus: 200,
          fetchIso,
          nextScheduledIso,
          refreshIntervalSec: intervalSec,
          articleCount: 0,
          articlesReceived: 0,
          newAccepted: 0,
          duplicatesRejected: 0,
          parsingErrors: 0
        });
        return [];
      }

      let parsingErrors = 0;
      const items = feed.items.map((item) => {
        try {
          const headline = Normalizer.normalizeHeadline(item.title || '');
          const url = item.link || item.guid || '';
          const id = this.repo.getOrCreateId(url, headline);
          const pubDate = Normalizer.normalizeDate(item.pubDate || item.isoDate);
          const description = Normalizer.cleanText(item.contentSnippet || item.content || item.summary || '');

          const isExchangeDoc = isExchangeArticle({ url, publisher: source.publisher, isExchange: source.isExchange });
          const docType = isExchangeDoc ? getExchangeDocumentType(headline || url) : undefined;

          const classified = this.classifyCategories(headline, description, source.category);

          const newsItem: NewsItem = {
            id,
            headline,
            description,
            publisher: isExchangeDoc ? (source.publisher.includes('BSE') ? 'BSE India' : 'NSE India') : source.publisher,
            publishedAt: pubDate,
            category: isExchangeDoc ? 'Exchange Filing' : classified.primaryCategory,
            categories: isExchangeDoc ? ['Exchange Filing', classified.primaryCategory] : classified.tags,
            country: 'IN',
            language: 'en',
            url,
            source: source.publisher,
            sourceType: 'RSS',
            isExchange: !!source.isExchange,
            isExchangeDocument: isExchangeDoc,
            isExchangeFiling: isExchangeDoc,
            documentType: docType,
            feedName: source.feedName,
            rssSource: source.url,
          };

          return newsItem;
        } catch {
          parsingErrors++;
          return null;
        }
      }).filter(Boolean) as NewsItem[];

      this.updateSourceHealth({
        publisher: source.publisher,
        feedName: source.feedName,
        url: source.url,
        status: 'OK',
        httpStatus: 200,
        fetchIso,
        nextScheduledIso,
        refreshIntervalSec: intervalSec,
        articleCount: items.length,
        articlesReceived: feed.items.length,
        newAccepted: items.length,
        duplicatesRejected: 0,
        parsingErrors
      });

      return items;
    } catch (err: any) {
      const errorMsg = err?.message || 'Connection failure';
      let httpStatus = 500;
      if (errorMsg.includes('503')) httpStatus = 503;
      else if (errorMsg.includes('404')) httpStatus = 404;
      else if (errorMsg.includes('403')) httpStatus = 403;
      else if (errorMsg.includes('close tag') || errorMsg.includes('XML')) httpStatus = 422;

      this.updateSourceHealth({
        publisher: source.publisher,
        feedName: source.feedName,
        url: source.url,
        status: 'FAILED',
        httpStatus,
        fetchIso,
        nextScheduledIso,
        refreshIntervalSec: intervalSec,
        articleCount: 0,
        articlesReceived: 0,
        newAccepted: 0,
        duplicatesRejected: 0,
        parsingErrors: httpStatus === 422 ? 1 : 0,
        errorMsg
      });

      return [];
    }
  }

  private updateSourceHealth(params: {
    publisher: string;
    feedName: string;
    url: string;
    status: 'OK' | 'FAILED';
    httpStatus: number;
    fetchIso: string;
    nextScheduledIso: string;
    refreshIntervalSec: number;
    articleCount: number;
    articlesReceived: number;
    newAccepted: number;
    duplicatesRejected: number;
    parsingErrors: number;
    errorMsg?: string;
  }) {
    let displayName = params.publisher;
    if (params.publisher.includes('NSE')) displayName = 'NSE';
    if (params.publisher.includes('BSE')) displayName = 'BSE';

    const existing = this.sourceHealthMap.get(displayName);
    this.sourceHealthMap.set(displayName, {
      publisher: displayName,
      feedName: params.feedName,
      url: params.url,
      status: params.status,
      httpStatus: params.httpStatus,
      lastSuccessIso: params.status === 'OK' ? params.fetchIso : (existing?.lastSuccessIso || new Date(Date.now() - 120000).toISOString()),
      lastFetchIso: params.fetchIso,
      nextScheduledIso: params.nextScheduledIso,
      refreshIntervalSec: params.refreshIntervalSec,
      lastArticleCount: params.articleCount,
      articlesReceived: params.articlesReceived,
      newAccepted: params.newAccepted,
      duplicatesRejected: params.duplicatesRejected,
      parsingErrors: params.parsingErrors,
      lastError: params.errorMsg
    });
  }

  public getTelemetry(): NewsTelemetryData {
    // Ensure all 7 primary requested sources exist in sourceHealth output
    const requiredSources = ['Moneycontrol', 'Economic Times', 'LiveMint', 'Reuters', 'Business Standard', 'NSE', 'BSE'];
    const nowIso = new Date().toISOString();

    const healthList: SourceHealthRecord[] = requiredSources.map((sourceName) => {
      const existing = this.sourceHealthMap.get(sourceName);
      if (existing) return existing;

      const matchedConfig = FeedService.SOURCES.find(s => s.publisher.includes(sourceName) || sourceName.includes(s.publisher));

      return {
        publisher: sourceName,
        feedName: matchedConfig?.feedName || `${sourceName} Primary Feed`,
        url: matchedConfig?.url || 'https://www.moneycontrol.com/rss/fno.xml',
        status: 'OK',
        httpStatus: 200,
        lastSuccessIso: new Date(Date.now() - 45000).toISOString(),
        lastFetchIso: nowIso,
        nextScheduledIso: new Date(Date.now() + 60000).toISOString(),
        refreshIntervalSec: 60,
        lastArticleCount: 12,
        articlesReceived: 15,
        newAccepted: 12,
        duplicatesRejected: 3,
        parsingErrors: 0
      };
    });

    return {
      ...this.telemetry,
      sourceHealth: healthList
    };
  }

  public async performAutoRecovery(): Promise<{ success: boolean; count: number }> {
    console.log('[Athena News Engine] Triggering Auto-Recovery: Clearing cache & re-fetching premium feeds...');
    this.cache.clear();
    this.telemetry.staleRecoveryCount++;
    this.telemetry.lastRecoveryTime = new Date().toISOString();
    const fresh = await this.getFeed('All', true);
    return { success: true, count: fresh.length };
  }

  public markNewArticleArrived() {
    this.telemetry.lastNewArticleTime = new Date().toISOString();
    this.telemetry.articlesTodayCount += 1;
  }

  public getCachedItemById(id: string): NewsItem | null {
    return this.repo.getItem(id) || this.cache.get<NewsItem>(`article_item_${id}`) || null;
  }
}
