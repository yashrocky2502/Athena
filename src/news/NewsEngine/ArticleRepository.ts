import crypto from 'crypto';
import { NewsItem } from '../models/NewsItem';
import { ArticleContent } from './ArticleContent';
import { ResolvedArticle, createResolvedArticle } from '../models/ResolvedArticle';

export class ArticleRepository {
  private static instance: ArticleRepository;

  // Single Central Storage for Articles and URLs
  private itemsMap = new Map<string, ResolvedArticle>();
  private urlToIdMap = new Map<string, string>();
  private enrichedContentMap = new Map<string, ArticleContent>();

  private constructor() {}

  public static getInstance(): ArticleRepository {
    if (!ArticleRepository.instance) {
      ArticleRepository.instance = new ArticleRepository();
    }
    return ArticleRepository.instance;
  }

  /**
   * Generates or retrieves an immutable ID for an article URL / headline based on canonical URL, publisher, and timestamp.
   */
  public getOrCreateId(
    url: string,
    headline: string,
    canonicalUrl?: string,
    publisher?: string,
    publishedAt?: string
  ): string {
    const canonical = (canonicalUrl || url || '').trim().toLowerCase();
    const pub = (publisher || '').trim().toLowerCase();
    const timestamp = (publishedAt || '').trim().toLowerCase();

    // Combine canonical, publisher, and timestamp for immutable isolation key
    const cacheKeyString = `${canonical}|${pub}|${timestamp}`;
    const keyToUse = (canonicalUrl || publisher || publishedAt) ? cacheKeyString : (url || headline);

    const normUrl = (url || '').trim().toLowerCase();
    if (normUrl && this.urlToIdMap.has(normUrl)) {
      return this.urlToIdMap.get(normUrl)!;
    }

    const id = crypto.createHash('md5').update(keyToUse).digest('hex');
    if (normUrl) {
      this.urlToIdMap.set(normUrl, id);
    }
    return id;
  }

  /**
   * Saves or updates a feed item in the central repository.
   * Guarantees immutable ID and prevents duplication.
   */
  public saveItem(item: NewsItem): ResolvedArticle {
    const immutableId = this.getOrCreateId(
      item.url,
      item.headline,
      item.canonicalUrl,
      item.publisher,
      item.publishedAt
    );
    const updatedItem: NewsItem = {
      ...item,
      id: immutableId,
    };

    const resolved = createResolvedArticle(updatedItem);
    this.itemsMap.set(immutableId, resolved);
    if (item.url) {
      this.urlToIdMap.set(item.url.trim().toLowerCase(), immutableId);
    }

    return resolved;
  }

  /**
   * Saves multiple items into the repository and returns details on which items were newly discovered.
   */
  public saveItemsDetailed(items: NewsItem[]): {
    saved: ResolvedArticle[];
    newlyDiscovered: ResolvedArticle[];
  } {
    const saved: ResolvedArticle[] = [];
    const newlyDiscovered: ResolvedArticle[] = [];

    for (const item of items) {
      const immutableId = this.getOrCreateId(
        item.url,
        item.headline,
        item.canonicalUrl,
        item.publisher,
        item.publishedAt
      );
      const isNew = !this.itemsMap.has(immutableId);
      const resolved = this.saveItem(item);

      saved.push(resolved);
      if (isNew) {
        newlyDiscovered.push(resolved);
      }
    }

    return { saved, newlyDiscovered };
  }

  /**
   * Saves multiple items into the repository.
   */
  public saveItems(items: NewsItem[]): ResolvedArticle[] {
    return this.saveItemsDetailed(items).saved;
  }

  /**
   * Retrieves an item by its immutable ID.
   */
  public getItem(id: string): ResolvedArticle | null {
    return this.itemsMap.get(id) || null;
  }

  /**
   * Retrieves all items currently in the repository.
   */
  public getAllItems(): ResolvedArticle[] {
    return Array.from(this.itemsMap.values());
  }

  /**
   * Saves enriched/extracted content for an article.
   */
  public saveEnrichedContent(id: string, content: ArticleContent): void {
    this.enrichedContentMap.set(id, content);
  }

  /**
   * Retrieves saved enriched content for an article.
   */
  public getEnrichedContent(id: string): ArticleContent | null {
    return this.enrichedContentMap.get(id) || null;
  }

  /**
   * Returns repository size metrics.
   */
  public getStats() {
    return {
      totalArticles: this.itemsMap.size,
      totalUrlsMapped: this.urlToIdMap.size,
      totalEnrichedArticles: this.enrichedContentMap.size,
    };
  }
}
