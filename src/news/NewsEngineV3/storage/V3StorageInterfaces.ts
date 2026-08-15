/**
 * ATHENA NEWS ENGINE V3 — STORAGE REPOSITORY INTERFACES
 * 
 * Storage interface abstractions separating persistence logic from core pipeline.
 * Includes an in-memory reference implementation for isolated testing & fallback.
 */

import { 
  V3RawArticle, 
  V3NormalizedArticle, 
  V3StructuredData, 
  V3AIIntelligence, 
  V3Story,
  V3ProcessingContext
} from '../types/V3Types';
import { CanonicalUrlResolver } from '../normalization/CanonicalUrlResolver';
import { HeadlineSimilarity } from '../deduplication/HeadlineSimilarity';

export interface IRawArticleRepository {
  saveRawArticle(article: V3RawArticle): Promise<void>;
  getRawArticleById(id: string): Promise<V3RawArticle | null>;
  getRawArticlesByPublisher(publisherId: string, limit?: number): Promise<V3RawArticle[]>;
  existsBySourceUrl(url: string): Promise<boolean>;
  getAllRawArticles(limit?: number): Promise<V3RawArticle[]>;
}

export interface INormalizedRepository {
  saveNormalizedArticle(article: V3NormalizedArticle): Promise<void>;
  getNormalizedArticleById(id: string): Promise<V3NormalizedArticle | null>;
  getNormalizedArticleByHash(contentHash: string): Promise<V3NormalizedArticle | null>;
}

export interface IStructuredRepository {
  saveStructuredData(articleId: string, data: V3StructuredData): Promise<void>;
  getStructuredDataByArticleId(articleId: string): Promise<V3StructuredData | null>;
}

export interface IIntelligenceRepository {
  saveIntelligence(storyId: string, intelligence: V3AIIntelligence): Promise<void>;
  getIntelligenceByStoryId(storyId: string): Promise<V3AIIntelligence | null>;
}

export interface IAuditRepository {
  saveStory(story: V3Story): Promise<void>;
  getStoryById(storyId: string): Promise<V3Story | null>;
  getAllStories(limit?: number): Promise<V3Story[]>;
  saveProcessingAudit(context: V3ProcessingContext): Promise<void>;
  getAuditLogs(correlationId: string): Promise<V3ProcessingContext | null>;
}

/**
 * In-Memory Reference Storage Adapter for unit testing and local execution
 */
export class InMemoryV3StorageAdapter implements 
  IRawArticleRepository, 
  INormalizedRepository, 
  IStructuredRepository, 
  IIntelligenceRepository, 
  IAuditRepository 
{
  private rawArticles: Map<string, V3RawArticle> = new Map();
  private normalizedArticles: Map<string, V3NormalizedArticle> = new Map();
  private structuredDataMap: Map<string, V3StructuredData> = new Map();
  private intelligenceMap: Map<string, V3AIIntelligence> = new Map();
  private storiesMap: Map<string, V3Story> = new Map();
  private auditLogsMap: Map<string, V3ProcessingContext> = new Map();

  // IRawArticleRepository
  async saveRawArticle(article: V3RawArticle): Promise<void> {
    this.rawArticles.set(article.id, { ...article });
  }

  async getRawArticleById(id: string): Promise<V3RawArticle | null> {
    return this.rawArticles.get(id) || null;
  }

  async getRawArticlesByPublisher(publisherId: string, limit = 50): Promise<V3RawArticle[]> {
    return Array.from(this.rawArticles.values())
      .filter(a => a.publisherId === publisherId)
      .slice(0, limit);
  }

  async existsBySourceUrl(url: string): Promise<boolean> {
    return Array.from(this.rawArticles.values()).some(a => a.sourceUrl === url);
  }

  async getAllRawArticles(limit = 100): Promise<V3RawArticle[]> {
    return Array.from(this.rawArticles.values()).slice(0, limit);
  }

  // INormalizedRepository
  async saveNormalizedArticle(article: V3NormalizedArticle): Promise<void> {
    this.normalizedArticles.set(article.id, { ...article });
  }

  async getNormalizedArticleById(id: string): Promise<V3NormalizedArticle | null> {
    return this.normalizedArticles.get(id) || null;
  }

  async getNormalizedArticleByHash(contentHash: string): Promise<V3NormalizedArticle | null> {
    return Array.from(this.normalizedArticles.values()).find(a => a.contentHash === contentHash) || null;
  }

  // IStructuredRepository
  async saveStructuredData(articleId: string, data: V3StructuredData): Promise<void> {
    this.structuredDataMap.set(articleId, { ...data });
  }

  async getStructuredDataByArticleId(articleId: string): Promise<V3StructuredData | null> {
    return this.structuredDataMap.get(articleId) || null;
  }

  // IIntelligenceRepository
  async saveIntelligence(storyId: string, intelligence: V3AIIntelligence): Promise<void> {
    this.intelligenceMap.set(storyId, { ...intelligence });
  }

  async getIntelligenceByStoryId(storyId: string): Promise<V3AIIntelligence | null> {
    return this.intelligenceMap.get(storyId) || null;
  }

  // IAuditRepository
  async saveStory(story: V3Story): Promise<void> {
    const existingStories = Array.from(this.storiesMap.values());
    const duplicate = findDuplicateStory(story, existingStories);

    if (duplicate) {
      const mergedStory = mergeStories(duplicate, story);
      this.storiesMap.set(duplicate.storyId, mergedStory);
      return;
    }

    this.storiesMap.set(story.storyId, { ...story });
  }

  async getStoryById(storyId: string): Promise<V3Story | null> {
    return this.storiesMap.get(storyId) || null;
  }

  async getAllStories(limit = 500): Promise<V3Story[]> {
    return Array.from(this.storiesMap.values())
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, limit);
  }

  async saveProcessingAudit(context: V3ProcessingContext): Promise<void> {
    this.auditLogsMap.set(context.correlationId, { ...context });
  }

  async getAuditLogs(correlationId: string): Promise<V3ProcessingContext | null> {
    return this.auditLogsMap.get(correlationId) || null;
  }

  public clearAll(): void {
    this.rawArticles.clear();
    this.normalizedArticles.clear();
    this.structuredDataMap.clear();
    this.intelligenceMap.clear();
    this.storiesMap.clear();
    this.auditLogsMap.clear();
  }
}

// --- DUPLICATE DETECTION & MERGING UTILITIES FOR STORAGE LAYER ---

export function extractDirectUrl(url: string): string {
  if (!url) return url;
  if (url.includes('news.google.com')) {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/');
      for (const segment of segments) {
        if (segment.length > 30 && (segment.startsWith('CBM') || /^[A-Za-z0-9+/=]+$/.test(segment))) {
          try {
            const decoded = Buffer.from(segment, 'base64').toString('utf8');
            const httpIdx = decoded.indexOf('http://');
            const httpsIdx = decoded.indexOf('https://');
            const idx = httpsIdx !== -1 ? httpsIdx : httpIdx;
            if (idx !== -1) {
              const sub = decoded.slice(idx);
              const match = sub.match(/^https?:\/\/[^\s"'\x00-\x1F\x7F-\x9F<>]+/);
              if (match) {
                return match[0];
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }
  return url;
}

export function normalizeHeadline(title: string): string {
  if (!title) return '';
  let clean = title.toLowerCase();
  const suffixes = [
    ' - the economic times',
    ' - economic times',
    ' - reuters',
    ' - pib.gov.in',
    ' - pib',
    ' - investor relations',
    ' - scanx.trade',
    ' - blog.google',
    ' - kalkine',
    ' - pr newswire',
    ' - cnbc tv18',
    ' - moneycontrol',
    ' - livemint',
    ' - business standard'
  ];
  for (const suffix of suffixes) {
    if (clean.endsWith(suffix)) {
      clean = clean.slice(0, -suffix.length);
    }
  }
  return clean.replace(/[^a-z0-9]/g, '');
}

export function extractHeadlineNumbers(headline: string): string[] {
  if (!headline) return [];
  const clean = headline.replace(/,/g, '');
  const matches = clean.match(/\b(?:\d+%|\d{3,})\b/g) || [];
  return matches;
}

export function findDuplicateStory(incoming: V3Story, existingStories: V3Story[]): V3Story | null {
  const incomingCleanUrl = CanonicalUrlResolver.resolve(extractDirectUrl(incoming.primaryArticle.canonicalUrl || incoming.publisher.baseUrl || ''));
  const incomingNormHeadline = normalizeHeadline(incoming.headline);
  const incomingCompanySymbol = incoming.structuredData?.primaryCompany?.symbol;

  for (const existing of existingStories) {
    if (existing.storyId === incoming.storyId) {
      return existing;
    }

    // 1. Canonical URL Match
    const existingCleanUrl = CanonicalUrlResolver.resolve(extractDirectUrl(existing.primaryArticle.canonicalUrl || existing.publisher.baseUrl || ''));
    if (incomingCleanUrl && existingCleanUrl && incomingCleanUrl === existingCleanUrl && !incomingCleanUrl.includes('news.example.com')) {
      return existing;
    }

    // 2. Content Hash Match
    if (incoming.primaryArticle.contentHash && existing.primaryArticle.contentHash && incoming.primaryArticle.contentHash === existing.primaryArticle.contentHash) {
      return existing;
    }

    // 3. Same-Publisher Same-Content Match
    const existingNormHeadline = normalizeHeadline(existing.headline);
    if (incoming.publisher.id === existing.publisher.id && incomingNormHeadline === existingNormHeadline) {
      return existing;
    }

    // 4. Same Company & Same Category Event Match
    if (incomingCompanySymbol && existing.structuredData?.primaryCompany?.symbol === incomingCompanySymbol) {
      const sim = HeadlineSimilarity.calculate(incoming.headline, existing.headline);
      
      // If same company and same category (e.g. QUARTERLY_RESULTS), a moderate headline similarity is enough
      if (incoming.category === existing.category && sim >= 0.50) {
        return existing;
      }

      // If they share significant financial numbers in their headlines
      const numsIncoming = extractHeadlineNumbers(incoming.headline);
      const numsExisting = extractHeadlineNumbers(existing.headline);
      const overlap = numsIncoming.filter(num => numsExisting.includes(num));
      if (overlap.length > 0 && sim >= 0.40) {
        return existing;
      }

      // Default high-similarity threshold
      if (sim >= 0.80) {
        return existing;
      }
    }
  }

  return null;
}

export function mergeStories(existing: V3Story, incoming: V3Story): V3Story {
  const existingIsGoogle = existing.primaryArticle.canonicalUrl.includes('news.google.com') || existing.publisher.id === 'GOOGLE_NEWS_RSS';
  const incomingIsGoogle = incoming.primaryArticle.canonicalUrl.includes('news.google.com') || incoming.publisher.id === 'GOOGLE_NEWS_RSS';

  let merged: V3Story;

  if (existingIsGoogle && !incomingIsGoogle) {
    // Incoming is DIRECT, Existing is GOOGLE_RSS_FALLBACK. DIRECT wins!
    merged = {
      ...incoming,
      storyId: existing.storyId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
  } else {
    // Existing is DIRECT or both are of same type. Existing wins!
    merged = {
      ...existing,
      updatedAt: new Date().toISOString()
    };
    
    // Merge structured details if existing is lacking
    if (!existing.structuredData?.financialMetrics?.length && incoming.structuredData?.financialMetrics?.length) {
      merged.structuredData = {
        ...merged.structuredData,
        financialMetrics: incoming.structuredData.financialMetrics
      };
    }
    if (!existing.intelligence?.institutionalSummary && incoming.intelligence?.institutionalSummary) {
      merged.intelligence = incoming.intelligence;
    }
  }

  // Merge companies securely
  const companies = new Map<string, any>();
  existing.structuredData?.mentionedCompanies?.forEach(c => companies.set(c.symbol, c));
  incoming.structuredData?.mentionedCompanies?.forEach(c => companies.set(c.symbol, c));
  
  merged.structuredData = {
    ...merged.structuredData,
    mentionedCompanies: Array.from(companies.values())
  };

  return merged;
}
