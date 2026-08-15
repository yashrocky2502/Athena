import { NewsArticleV2 } from "../domain/NewsArticle";
import { CanonicalDeduplicator } from "../deduplication/CanonicalDeduplicator";
import { FNOEligibilityEngine } from "../fno/FNOEligibilityEngine";

export class NewsNormalizer {
  /**
   * Sanitizes text by removing HTML tags, unescaping HTML entities, and trimming extra spaces.
   */
  public static cleanText(text: string): string {
    if (!text) return "";
    let cleaned = text
      .replace(/<[^>]*>/g, "") // Strip HTML tags
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned;
  }

  /**
   * Normalizes a URL to a clean canonical URL.
   * Strips tracking parameters, Google redirect wrappers, fragment identifiers, and query noise.
   */
  public static normalizeCanonicalUrl(url: string): string {
    if (!url) return "";

    let raw = url.trim();

    // Unwrap Google News RSS articles redirect wrapper if possible
    if (raw.includes("news.google.com/rss/articles/") || raw.includes("news.google.com/articles/")) {
      // If there is a direct URL embedded in query params
      const match = raw.match(/url=([^&]+)/i);
      if (match && match[1]) {
        try {
          raw = decodeURIComponent(match[1]);
        } catch (e) {
          // ignore error
        }
      }
    }

    try {
      const parsed = new URL(raw);

      // Strip fragment
      parsed.hash = "";

      // List of tracking query parameters to remove
      const trackingParams = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "utm_id",
        "fbclid",
        "gclid",
        "ref",
        "source",
        "ncid",
        "cmpid"
      ];

      trackingParams.forEach((param) => parsed.searchParams.delete(param));

      let cleanPath = parsed.origin + parsed.pathname;
      const searchStr = parsed.searchParams.toString();
      if (searchStr) {
        cleanPath += "?" + searchStr;
      }

      // Remove trailing slash if at end of path without search params
      if (cleanPath.endsWith("/") && cleanPath.length > 10 && !searchStr) {
        cleanPath = cleanPath.slice(0, -1);
      }

      return cleanPath;
    } catch (err) {
      // Fallback if URL parsing fails
      return raw.split("#")[0].split("?")[0];
    }
  }

  /**
   * Normalizes headline for similarity comparisons.
   */
  public static normalizeHeadlineForMatching(headline: string): string {
    let cleaned = this.cleanText(headline).toLowerCase();
    cleaned = cleaned
      .replace(/\bpercent\b/g, "%")
      .replace(/\bpercentage\b/g, "%")
      .replace(/\bcrores?\b/g, "cr")
      .replace(/\bbillions?\b/g, "bn")
      .replace(/\bmillions?\b/g, "mn")
      .replace(/\s*%\s*/g, " % ");
    // Remove punctuation except %, keep letters and numbers
    return cleaned.replace(/[^a-z0-9%\s]/g, "").replace(/\s+/g, " ").trim();
  }

  /**
   * Formats dates to standard ISO 8601 string.
   */
  public static normalizeDate(dateInput?: string | number | Date): string {
    if (!dateInput) return new Date().toISOString();
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return new Date().toISOString();
      return d.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  }

  /**
   * Standardized article normalization method.
   */
  public static normalizeArticle(raw: Partial<NewsArticleV2>): NewsArticleV2 {
    const headline = this.cleanText(raw.headline || "Untitled Market Report");
    const body = this.cleanText(raw.body || raw.headline || "");
    const publishedAt = this.normalizeDate(raw.publishedAt);
    const canonicalUrl = this.normalizeCanonicalUrl(
      raw.canonicalUrl || raw.source?.url || `https://athena.news/v2/${Date.now()}`
    );
    const id = raw.id || `v2_${CanonicalDeduplicator.generateContentHash(headline, canonicalUrl).slice(0, 16)}`;
    const fno = raw.fno || FNOEligibilityEngine.evaluate(headline, body);

    return {
      id,
      canonicalUrl,
      headline,
      body,
      source: {
        publisher: raw.source?.publisher || "Unknown",
        url: canonicalUrl,
        collectionMethod: raw.source?.collectionMethod || "RSS"
      },
      publishedAt,
      collectedAt: raw.collectedAt || new Date().toISOString(),
      category: raw.category || "MARKET",
      sentiment: raw.sentiment || "NEUTRAL",
      relevanceScore: raw.relevanceScore || 90,
      fno
    };
  }
}
