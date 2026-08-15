import { ExtractedEntities } from './EntityExtractor';
import { IntelligenceObject } from './IntelligenceEngine';

export interface ArticleIntelligence {
  summary: string;
  athenaIntelligence?: IntelligenceObject;
  highlights: string[];
  whyItMatters: string;
  investorTakeaway: string;
  classification: {
    domain: string;
    category: string;
    sector: string;
    industry: string;
    theme: string;
    topic: string;
  };
  eventDetection: {
    type: string;
    confidence: number;
  };
  entities: Array<{
    name: string;
    type: string;
    ticker?: string;
    sector?: string;
    country?: string;
    confidence: number;
    mentions: number;
    aliases?: string[];
  }>;
  financialMetrics: Array<{
    metric: string;
    value: string;
    direction?: string;
    period?: string;
    unit?: string;
    growth?: string;
    context?: string;
  }>;
  earnings?: {
    revenue?: string;
    pat?: string;
    ebitda?: string;
    orderBook?: string;
    guidance?: string;
    commentary?: string;
  };
  ipo?: {
    issuePrice?: string;
    listingPrice?: string;
    premiumDiscount?: string;
    subscription?: string;
    lotSize?: string;
    issueSize?: string;
    gmp?: string;
    type?: string;
  };
  regulatory?: {
    regulator?: string;
    law?: string;
    policy?: string;
    affectedIndustry?: string;
    implementationDate?: string;
    affectedCompanies?: string[];
  };
  quotes: Array<{
    speaker: string;
    designation: string;
    quote: string;
    importance: string;
  }>;
  timeline: {
    publicationDate?: string;
    quarter?: string;
    fy?: string;
    historicalReferences?: string[];
    upcomingDeadlines?: string[];
    chronologicalEvents?: Array<{ date: string; event: string }>;
    chain?: string[];
  };
  quality: {
    parserScore: number;
    bodyCompleteness: number;
    metadata: number;
    entities: number;
    metrics: number;
    timeline: number;
    quotes: number;
    tables: number;
    boilerplate: number;
    readability: number;
    overall: number;
  };
  parser: string;
  readingTime: number;
  wordCount: number;

  // Market Context Intelligence Engine (Additive Layer)
  marketContext?: {
    articleType?: string;
    industryTrend?: string;
    macroTailwind?: string;
    macroHeadwind?: string;
    peerComparison?: string;
    managementGuidance?: string;
    demandOutlook?: string;
    executionRisk?: string;
    financialContext?: {
      revenue?: string;
      revenueYoY?: string;
      pat?: string;
      patYoY?: string;
      ebitda?: string;
      ebitdaYoY?: string;
      margin?: string;
      marginYoY?: string;
    };
    bullets?: string[];
  };
  peerComparison?: {
    company: string;
    peers: string[];
  };
  sectorImpact?: {
    sentiment: 'Positive' | 'Neutral' | 'Negative';
    sector: string;
    explanation: string;
  };
  priceReaction?: {
    stock: string;
    reaction: string;
    volume: string;
  };
  expectation?: {
    status: 'Beat' | 'Miss' | 'Inline' | 'Unknown';
    detail?: string;
  };
  macroContext?: {
    topic: string;
    explanation: string;
  };
}

export interface ArticleContent {
  originalUrl?: string;
  finalUrl?: string;
  resolvedDomain?: string;
  type?: string;
  documentType?: string;
  isExchangeDocument?: boolean;
  isExchangeFiling?: boolean;
  id: string;
  url: string;
  canonicalUrl?: string;
  headline: string;
  title?: string;
  summary?: string;
  description?: string;
  content?: string;
  publisher: string;
  author?: string;
  publishedAt?: string;
  category?: string;
  image?: string;

  // Body content aliases
  body: string;
  cleanText: string;
  cleanedText: string;
  rawText: string;
  articleBody: string;

  // Parser info
  parser: string;
  extractedBy: string;
  extractionMethod: string;

  // Quality metrics
  quality?: number;
  qualityScore?: number;
  extractionQuality?: string | number;

  // Counts & Structured Data
  wordCount?: number;
  readingTime?: number;
  readingTimeMin?: number;
  paragraphCount?: number;

  tables?: any[];
  tableCount?: number;

  entities?: any[];
  entityCount?: number;

  financialMetrics?: any[];
  financialMetricsCount?: number;

  timeline?: {
    publicationDate?: string;
    quarter?: string;
    fy?: string;
    historicalReferences?: string[];
    upcomingDeadlines?: string[];
    chronologicalEvents?: Array<{ date: string; event: string }>;
  };

  knowledge?: ExtractedEntities;
  extractionTrace?: string;

  extractedAt?: string;
  timeTakenMs?: number;
  metadata?: {
    downloadTimeMs: number;
  };
  cached?: boolean;
  status?: 'FULL_EXTRACT' | 'PARTIAL' | 'RSS_BODY' | 'FALLBACK' | 'SUCCESS' | string;
  extractionState?: 'FULL_ARTICLE' | 'PARTIAL_ARTICLE' | 'RSS_FALLBACK';
  intelligence?: ArticleIntelligence;
  athenaIntelligence?: IntelligenceObject;
}

