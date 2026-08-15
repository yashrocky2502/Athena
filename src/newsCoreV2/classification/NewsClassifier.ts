import { NewsCategoryV2, SentimentV2, NewsClassificationResult } from "../domain/NewsClassification.ts";
import { FNOClassificationResult } from "../domain/FNOClassification.ts";
import { NewsNormalizer } from "../normalization/NewsNormalizer.ts";
import { NewsCategoryResolver } from "./NewsCategoryResolver.ts";

const BULLISH_KEYWORDS = [
  "surge", "surges", "jump", "jumps", "rally", "rallies", "profit rises", "profit jumps",
  "record high", "outperform", "beat estimates", "gain", "gains", "upward", "bullish",
  "revenue up", "order win", "order wins", "upgrade", "upgrades", "soar", "soars"
];

const BEARISH_KEYWORDS = [
  "plunge", "plunges", "slump", "slumps", "loss", "losses", "crash", "crashes",
  "decline", "declines", "fall", "falls", "misses", "default", "downgrade", "downgrades",
  "bearish", "loss widens", "revenue drops", "penalty", "investigation", "fraud", "probe"
];

export class NewsClassifier {
  /**
   * Deterministically classifies category, sentiment, and relevance score for an article using NewsCategoryResolver.
   */
  public static classify(
    headline: string,
    body: string,
    publisher: string,
    fnoResult: FNOClassificationResult
  ): NewsClassificationResult {
    const cleanHeadline = NewsNormalizer.cleanText(headline);
    const cleanBodyText = NewsNormalizer.cleanText(body);
    const lowerHeadline = cleanHeadline.toLowerCase();
    const lowerCombined = `${lowerHeadline} ${cleanBodyText.toLowerCase()}`;

    // 1. Authoritative Category Resolution via NewsCategoryResolver
    const resolved = NewsCategoryResolver.resolve(headline, body, publisher, fnoResult);

    // 2. Determine Sentiment
    let bullishCount = 0;
    let bearishCount = 0;

    for (const word of BULLISH_KEYWORDS) {
      if (lowerHeadline.includes(word)) bullishCount += 2;
      else if (lowerCombined.includes(word)) bullishCount += 1;
    }

    for (const word of BEARISH_KEYWORDS) {
      if (lowerHeadline.includes(word)) bearishCount += 2;
      else if (lowerCombined.includes(word)) bearishCount += 1;
    }

    let sentiment: SentimentV2 = "NEUTRAL";
    if (bullishCount > bearishCount && bullishCount >= 2) {
      sentiment = "BULLISH";
    } else if (bearishCount > bullishCount && bearishCount >= 2) {
      sentiment = "BEARISH";
    }

    // 3. Determine Relevance Score (0 - 100)
    let score = 50;

    // Headline length quality
    if (cleanHeadline.length >= 30 && cleanHeadline.length <= 120) score += 15;
    if (cleanBodyText.length > 200) score += 15;

    // Publisher authority tier
    const pubLower = (publisher || "").toLowerCase();
    if (
      pubLower.includes("reuters") ||
      pubLower.includes("economic times") ||
      pubLower.includes("livemint") ||
      pubLower.includes("business standard") ||
      pubLower.includes("moneycontrol") ||
      pubLower.includes("nse") ||
      pubLower.includes("bse") ||
      pubLower.includes("sebi") ||
      pubLower.includes("rbi")
    ) {
      score += 20;
    }

    score = Math.min(100, Math.max(10, score));

    return {
      category: resolved.primaryCategory as NewsCategoryV2,
      sentiment,
      relevanceScore: score,
      primaryCategory: resolved.primaryCategory,
      secondaryCategories: resolved.secondaryCategories,
      eventType: resolved.eventType,
      categoryConfidence: resolved.categoryConfidence,
      classificationEvidence: resolved.classificationEvidence
    };
  }
}
