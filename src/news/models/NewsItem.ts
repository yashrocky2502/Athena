export interface DetectedCompany {
  name: string;
  ticker: string;
  sector: string;
  industry?: string;
  isFnO: boolean;
}

export interface RelatedSource {
  publisher: string;
  url: string;
  publishedAt: string;
  headline: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  title?: string;
  description?: string;
  summary?: string;
  publisher: string;
  author?: string;
  publishedAt: string;
  category: string;
  categories: string[]; // Multi-category support (e.g. ['F&O', 'Technology', 'AI', 'Corporate', 'Results'])
  country: string;
  language: string;
  url: string;
  publisherUrl?: string;
  googleDiscoveryUrl?: string;
  canonicalUrl?: string;
  resolutionStatus?: 'RESOLVED' | 'PUBLISHER_URL_UNAVAILABLE';
  image?: string;
  source: string;
  sourceType: 'RSS' | 'SITEMAP' | 'GOOGLE_DISCOVERY' | 'API' | 'EXCHANGE' | 'GOVERNMENT' | 'SCRAPER';
  discoveryLayer?: 'RSS' | 'SITEMAP' | 'GOOGLE_DISCOVERY' | 'EXCHANGE' | 'GOVERNMENT' | 'API' | 'SCRAPER';
  isExchange: boolean;
  isExchangeDocument?: boolean;
  isExchangeFiling?: boolean;
  documentType?: string;
  feedName: string;
  rssSource?: string;
  symbol?: string;
  companies?: DetectedCompany[];
  tickers?: string[];
  sector?: string;
  sectors?: string[];
  industry?: string;
  industries?: string[];
  isFnO?: boolean;
  assets?: string[];
  clusterId?: string;
  relatedSources?: RelatedSource[];
  qualityScore?: number; // 0-100 deterministic article quality score
  freshnessScore?: number; // 0-100 freshness index
  providerRating?: number; // 0-100 provider rating
}

