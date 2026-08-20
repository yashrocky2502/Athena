import { NewsItem } from './NewsItem';
import { isExchangeArticle, getExchangeDocumentType } from '../utils/ExchangeUtils';

export type NewsCategory =
  | 'All'
  | 'F&O'
  | 'Markets'
  | 'Economy'
  | 'Corporate'
  | 'Technology'
  | 'AI'
  | 'IPO'
  | 'Results'
  | 'Exchange'
  | 'Government'
  | 'Global'
  | 'Crypto'
  | 'Commodities'
  | 'Exchange Filing';

export interface NewsArticle extends NewsItem {
  title: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  tags?: string[];
  thumbnail?: string;
  companyName?: string;
  correlationId?: string;
  clusterId?: string;
  originalPublisherUrl?: string;
  collectionUrl?: string;
  collectionMethod?: 'DIRECT' | 'GOOGLE_RSS_FALLBACK';
  
  // Backward compatibility & extra fields
  content?: string;
  raw_text?: string;
  link?: string;
  primaryCategory?: string;
  isFno?: boolean;
  publisher?: string;
  
  // Developer Audit fields
  isFO?: boolean;
  isFnO?: boolean;
  fnoDecision?: 'INCLUDE' | 'EXCLUDE';
  fnoEligible?: boolean;
  fnoSymbol?: string | null;
  matchedEntity?: string | null;
  entityMatchLocation?: 'HEADLINE' | 'TITLE' | 'METADATA' | 'BODY_ONLY' | 'NONE';
  entityConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  foReason?: string;
  cleanBody?: string;
  fullArticleBody?: string;
  telegramEligible?: boolean;
  telegramDecision?: string;
  telegramRejectReason?: string | null;
  queueStatus?: string;
  messageId?: string | number | null;
  delivered?: boolean;

  // Deterministic F&O Relevance Engine fields
  fnoRelevance?: boolean;
  fnoRelevanceScore?: number;
  fnoRelevanceTier?: 'TIER_1' | 'TIER_2' | 'TIER_3';
  fnoReasons?: string[];
  fnoEntities?: string[];
  fnoEvidence?: string[];
  binaryRisk?: string;
  volatilityRisk?: string;
  decisionEligibility?: string;
}

export function newsItemToArticle(item: NewsItem): NewsArticle {
  const companyNames = item.companies?.map((c) => c.name) || [];
  const tickers = item.tickers || item.companies?.map((c) => c.ticker) || [];
  const sectors = item.sectors || item.companies?.map((c) => c.sector).filter(Boolean) || [];
  const industries = item.industries || item.companies?.map((c) => c.industry).filter(Boolean) as string[] || [];

  const isExchangeDoc = isExchangeArticle(item);
  const docType = isExchangeDoc ? (item.documentType || getExchangeDocumentType(item.headline || item.url)) : undefined;

  const allTags = Array.from(
    new Set([
      isExchangeDoc ? 'Exchange Filing' : item.category,
      ...(item.categories || []),
      item.publisher,
      item.feedName,
      ...companyNames,
      ...tickers,
      ...sectors,
      ...industries,
      ...(item.assets || []),
    ].filter(Boolean))
  );

  return {
    ...item,
    title: item.headline,
    category: isExchangeDoc ? 'Exchange Filing' : item.category,
    isExchangeDocument: isExchangeDoc,
    isExchangeFiling: isExchangeDoc,
    documentType: docType,
    tags: allTags,
    thumbnail: item.image,
    companyName: companyNames.length > 0 ? companyNames.join(', ') : undefined,
  };
}

