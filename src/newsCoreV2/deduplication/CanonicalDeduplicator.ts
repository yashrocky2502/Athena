import { NewsArticleV2 } from "../domain/NewsArticle";
import { NewsNormalizer } from "../normalization/NewsNormalizer";

export class CanonicalDeduplicator {
  /**
   * Generates a deterministic content hash for an article based on headline and body prefix.
   */
  public static generateContentHash(headline: string, body: string): string {
    const normHeadline = NewsNormalizer.normalizeHeadlineForMatching(headline);
    const normBodyPrefix = NewsNormalizer.cleanText(body).toLowerCase().slice(0, 100);
    const combined = `${normHeadline}|${normBodyPrefix}`;

    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `hash_${Math.abs(hash)}`;
  }

  /**
   * Calculates Jaccard similarity index between two headlines.
   */
  public static calculateHeadlineSimilarity(headlineA: string, headlineB: string): number {
    const normA = NewsNormalizer.normalizeHeadlineForMatching(headlineA);
    const normB = NewsNormalizer.normalizeHeadlineForMatching(headlineB);

    if (normA === normB) return 1.0;

    const setA = new Set(normA.split(" ").filter((w) => w.length >= 1));
    const setB = new Set(normB.split(" ").filter((w) => w.length >= 1));

    if (setA.size === 0 || setB.size === 0) return 0;

    let intersectionCount = 0;
    setA.forEach((word) => {
      if (setB.has(word)) intersectionCount++;
    });

    const unionSize = new Set([...setA, ...setB]).size;
    return unionSize === 0 ? 0 : intersectionCount / unionSize;
  }

  /**
   * Deduplicates a candidate list of articles against existing articles.
   * Returns unique candidates, resolving duplicates with priority rules:
   * DIRECT > RSS, and longer body preferred.
   */
  public static deduplicate(
    newArticles: NewsArticleV2[],
    existingArticles: NewsArticleV2[] = []
  ): { uniqueArticles: NewsArticleV2[]; duplicatesRemovedCount: number } {
    let duplicatesRemoved = 0;
    const combinedMap = new Map<string, NewsArticleV2>();

    // Index existing articles
    const urlMap = new Map<string, NewsArticleV2>();
    const publisherHeadlineMap = new Map<string, NewsArticleV2>();
    const contentHashMap = new Map<string, NewsArticleV2>();
    const existingList: NewsArticleV2[] = [];

    const registerArticle = (article: NewsArticleV2) => {
      combinedMap.set(article.id, article);
      existingList.push(article);

      if (article.canonicalUrl) {
        urlMap.set(article.canonicalUrl, article);
      }

      const pubHeadlineKey = `${article.source.publisher.toLowerCase()}:${NewsNormalizer.normalizeHeadlineForMatching(
        article.headline
      )}`;
      publisherHeadlineMap.set(pubHeadlineKey, article);

      const hash = this.generateContentHash(article.headline, article.body);
      contentHashMap.set(hash, article);
    };

    // Load existing articles into index
    for (const existing of existingArticles) {
      registerArticle(existing);
    }

    const uniqueNew: NewsArticleV2[] = [];

    for (const newArt of newArticles) {
      let duplicateMatch: NewsArticleV2 | null = null;

      // Level 1: Canonical URL Match
      if (newArt.canonicalUrl && urlMap.has(newArt.canonicalUrl)) {
        duplicateMatch = urlMap.get(newArt.canonicalUrl)!;
      }

      // Level 2: Publisher + Normalized Headline Match
      if (!duplicateMatch) {
        const pubHeadlineKey = `${newArt.source.publisher.toLowerCase()}:${NewsNormalizer.normalizeHeadlineForMatching(
          newArt.headline
        )}`;
        if (publisherHeadlineMap.has(pubHeadlineKey)) {
          duplicateMatch = publisherHeadlineMap.get(pubHeadlineKey)!;
        }
      }

      // Level 3: Content Hash Match
      if (!duplicateMatch) {
        const hash = this.generateContentHash(newArt.headline, newArt.body);
        if (contentHashMap.has(hash)) {
          duplicateMatch = contentHashMap.get(hash)!;
        }
      }

      // Level 4: Headline Similarity (> 0.85)
      if (!duplicateMatch) {
        for (const existing of existingList) {
          const sim = this.calculateHeadlineSimilarity(newArt.headline, existing.headline);
          if (sim >= 0.85) {
            duplicateMatch = existing;
            break;
          }
        }
      }

      if (duplicateMatch) {
        duplicatesRemoved++;
        // Priority rule: DIRECT > RSS, or if body is significantly more complete
        const isNewDirect = newArt.source.collectionMethod === "DIRECT";
        const isDupDirect = duplicateMatch.source.collectionMethod === "DIRECT";

        const newBodyLength = (newArt.body || "").length;
        const dupBodyLength = (duplicateMatch.body || "").length;

        const shouldReplace =
          (isNewDirect && !isDupDirect) ||
          (isNewDirect === isDupDirect && newBodyLength > dupBodyLength + 100);

        if (shouldReplace) {
          // Keep existing ID so we don't assign new random ID to known story
          const updatedArticle: NewsArticleV2 = {
            ...newArt,
            id: duplicateMatch.id
          };
          registerArticle(updatedArticle);
          uniqueNew.push(updatedArticle);
        }
      } else {
        // Unique new article!
        registerArticle(newArt);
        uniqueNew.push(newArt);
      }
    }

    return {
      uniqueArticles: uniqueNew,
      duplicatesRemovedCount: duplicatesRemoved
    };
  }
}
