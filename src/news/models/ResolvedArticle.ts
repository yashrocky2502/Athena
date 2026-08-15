import { NewsItem } from './NewsItem';
import { NewsArticle } from './NewsArticle';
import { CompanyMasterDatabase } from '../NewsEngine/CompanyMasterDatabase';
import { NewsClassifier, FO_UNIVERSE } from '../NewsEngine/Classifier';
import { CanonicalClassificationEngine } from '../NewsEngine/CanonicalClassificationEngine';
import { isExchangeArticle, getExchangeDocumentType } from '../utils/ExchangeUtils';

export interface ResolvedArticle extends NewsArticle {
  readonly id: string;
  readonly headline: string;
  readonly url: string;
  readonly publisher: string;
  readonly publishedAt: string;
  readonly companyName?: string;
  readonly symbol?: string;
  readonly exchange?: string;
  readonly isin?: string;
  readonly sector?: string;
  readonly industry?: string;
  readonly country: string;
  readonly isFO: boolean;
  readonly foReason?: string;
  readonly category: string;
  readonly categories: string[];
  readonly priorityScore: number;
  readonly priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly isBreaking: boolean;
  readonly verifiedPublishers: string[];
  readonly metrics?: any;
  readonly financialSnapshot?: any;
  readonly telegramEligible?: boolean;
  readonly relatedCompanies?: string[];
  readonly relatedTickers?: string[];
  readonly entityConfidence?: 'LOW' | 'MEDIUM' | 'HIGH';

  // Compatibility fields for the frontend
  readonly title: string;
  readonly tags: string[];
  readonly thumbnail?: string;
  readonly sentiment?: 'bullish' | 'bearish' | 'neutral' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  readonly isExchangeDocument?: boolean;
  readonly isExchangeFiling?: boolean;
  readonly documentType?: string;
  readonly description?: string;
  readonly summary?: string;
}

export function createResolvedArticle(item: NewsItem): ResolvedArticle {
  const headline = item.headline || item.title || 'Untitled Article';
  const description = item.description || item.summary || '';
  const textLower = `${headline} ${description}`.toLowerCase();

  // Single source of truth: Canonical Classification Engine
  const canonical = CanonicalClassificationEngine.classify(item);

  const resolvedCompany = canonical.resolvedCompany;
  const companyName = resolvedCompany ? resolvedCompany.name : 'NONE';
  const symbol = resolvedCompany ? resolvedCompany.symbol : 'NONE';
  const exchange = resolvedCompany ? (resolvedCompany.exchange || 'NSE') : undefined;
  const isin = resolvedCompany ? resolvedCompany.isin : undefined;
  const sector = resolvedCompany ? resolvedCompany.sector : undefined;
  const industry = resolvedCompany ? resolvedCompany.industry : undefined;
  const country = resolvedCompany ? (resolvedCompany.country || 'India') : (item.country || 'India');

  const isExchangeDoc = isExchangeArticle(item);
  const primaryCategory = isExchangeDoc ? 'Exchange Filing' : canonical.primaryCategory;

  const isFO = canonical.isFO;
  const foReason = canonical.foReason;
  const telegramEligible = canonical.telegramEligible;
  const categories = canonical.categories;

  // Priority Engine: calculated ONCE
  let priorityScore = 50;

  if (isFO) priorityScore += 25;
  if (textLower.includes('q1') || textLower.includes('q2') || textLower.includes('q3') || textLower.includes('q4') || textLower.includes('results') || textLower.includes('profit')) {
    priorityScore += 20;
  }
  if (textLower.includes('breaking') || textLower.includes('acquisition') || textLower.includes('sebi') || textLower.includes('rbi')) {
    priorityScore += 20;
  }
  priorityScore = Math.min(100, Math.max(10, priorityScore));

  const isFOCompany = resolvedCompany ? FO_UNIVERSE.has(resolvedCompany.symbol.toUpperCase()) : false;
  const isSEBIOverride = isFOCompany && textLower.includes('sebi');
  const hasQuarterTerm = textLower.includes('q1') || textLower.includes('q2') || textLower.includes('q3') || textLower.includes('q4');
  const hasResultsTerm = textLower.includes('results') || textLower.includes('profit') || textLower.includes('revenue');
  const isQuarterlyOverride = isFOCompany && hasQuarterTerm && hasResultsTerm;
  const isDeterministicOverride = isSEBIOverride || isQuarterlyOverride;

  let priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = priorityScore >= 70 ? 'HIGH' : priorityScore >= 40 ? 'MEDIUM' : 'LOW';

  if (isDeterministicOverride) {
    priorityScore = 100;
    priorityLevel = 'CRITICAL';
  }

  const isBreaking = priorityLevel === 'CRITICAL' || textLower.includes('breaking') || (item as any).isBreaking || false;

  const docType = isExchangeDoc ? (item.documentType || getExchangeDocumentType(headline || item.url)) : undefined;

  // Generate standard tags for UI tags field
  const tagsList = Array.from(
    new Set([
      primaryCategory,
      ...categories,
      item.publisher,
      item.feedName,
      companyName,
      symbol,
      sector,
      industry,
    ].filter(Boolean) as string[])
  );

  const resolved: ResolvedArticle = {
    ...item,
    id: item.id || `art_${Math.random().toString(36).substring(2, 9)}`,
    headline,
    url: item.url,
    publisher: item.publisher || item.source || 'Unknown Publisher',
    publishedAt: item.publishedAt || new Date().toISOString(),
    companyName,
    symbol,
    exchange,
    isin,
    sector,
    industry,
    country,
    isFO,
    foReason,
    category: primaryCategory,
    categories,
    priorityScore,
    priorityLevel,
    isBreaking,
    verifiedPublishers: [item.publisher || item.source].filter(Boolean),
    metrics: item.qualityScore,
    financialSnapshot: undefined,
    telegramEligible,
    relatedCompanies: companyName && companyName !== 'NONE' ? [companyName] : [],
    relatedTickers: symbol && symbol !== 'NONE' ? [symbol] : [],
    entityConfidence: (item as any).entityConfidence || (canonical.confidence >= 0.8 ? 'HIGH' : canonical.confidence >= 0.5 ? 'MEDIUM' : 'LOW'),

    // Compatibility fields
    title: headline,
    tags: tagsList,
    thumbnail: item.image,
    sentiment: (item as any).sentiment || 'NEUTRAL',
    isExchangeDocument: isExchangeDoc,
    isExchangeFiling: isExchangeDoc,
    documentType: docType,
    description,
    summary: item.summary || description,
  };

  return Object.freeze(resolved);
}
