import { FNOClassificationResult } from "../domain/FNOClassification.ts";
import { NewsNormalizer } from "../normalization/NewsNormalizer.ts";

export interface ResolvedCategory {
  primaryCategory: string;
  secondaryCategories: string[];
  eventType: string;
  categoryConfidence: "HIGH" | "MEDIUM" | "LOW";
  classificationEvidence: string[];
}

export const CANONICAL_CATEGORIES = [
  "F&O",
  "Crypto",
  "Commodities",
  "IPO",
  "Results",
  "Market",
  "Corporate",
  "Economy",
  "Global",
  "Technology",
  "Exchange",
  "Other"
] as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

class WordMatcher {
  public static hasWord(text: string, keyword: string): boolean {
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped + '\\b', 'i');
    return regex.test(text);
  }

  public static anyWord(text: string, keywords: string[]): boolean {
    return keywords.some(kw => this.hasWord(text, kw));
  }

  public static countWords(text: string, keywords: string[]): number {
    let count = 0;
    for (const kw of keywords) {
      if (this.hasWord(text, kw)) {
        count++;
      }
    }
    return count;
  }
}

const CRYPTO_SPECIFIC = [
  "bitcoin", "btc", "ethereum", "eth", "solana", "sol", "xrp", "crypto", "cryptocurrency",
  "altcoin", "memecoin", "binance", "coinbase", "digital asset", "digital assets", "blockchain token",
  "crypto exchange"
];

const IPO_CORE = [
  "ipo", "initial public offering", "grey market", "gmp", "drhp", "rhp", "allotment", "subscription",
  "public offer", "oversubscribed", "listing gain", "fresh issue", "offer for sale"
];

const RESULTS_PERIOD = [
  "q1", "q2", "q3", "q4", "q1fy25", "q2fy25", "q3fy25", "q4fy25", "q1fy26", "q2fy26", "q3fy26", "q4fy26",
  "q1fy27", "q2fy27", "q3fy27", "q4fy27", "quarterly results", "annual results", "financial results",
  "quarterly profit", "quarterly loss", "quarterly net", "quarterly earnings", "earnings release",
  "earnings report", "june quarter", "september quarter", "december quarter", "march quarter"
];

const RESULTS_PERF = [
  "net profit", "pat", "ebitda", "eps", "profit rises", "profit surges", "profit jumps", "profit drops",
  "profit declines", "profit slips", "profit falls", "loss widens", "loss narrows", "revenue from operations",
  "operating revenue", "consolidated net", "standalone net"
];

const COMMODITIES_KEYWORDS = [
  "crude oil", "brent", "wti", "gold", "silver", "copper", "aluminium", "natural gas", "mcx", "commodity",
  "bullion", "opec", "crude futures", "metals market"
];

const EXCHANGE_KEYWORDS = [
  "nse circular", "bse notice", "mcx circular", "expiry day change", "index rebalancing", "surveillance measure",
  "asm list", "gsm list", "block deal circular", "settlement cycle", "trading halts", "exchange notice"
];

const ECONOMY_KEYWORDS = [
  "rbi", "sebi", "gdp", "inflation", "cpi", "iip", "repo rate", "monetary policy", "fiscal deficit",
  "interest rate", "gst council", "central bank", "economic growth", "forex reserves", "taxation policy",
  "government policy", "discussion paper", "consultation paper", "regulator", "regulatory"
];

const CORPORATE_KEYWORDS = [
  "acquisition", "acquire", "acquires", "acquired", "takeover", "merger", "merges", "merged", "amalgamation", "demerger",
  "order win", "bags order", "secures order", "contract win", "awarded contract", "awarded order", "receives order", "epc order", "work order",
  "partnership", "partners", "collaborates", "collaboration", "joint venture", "mou",
  "resigns", "resignation", "appointed", "appointment", "ceo", "cfo", "board approves", "managing director",
  "dividend", "buyback", "bonus issue", "capex", "capacity expansion", "stake sale", "stake purchase", "senior notes",
  "suspension", "revokes suspension", "manufacturing unit", "plant shutdown", "plant operations", "manufacturing facility"
];

const TECH_KEYWORDS = [
  "artificial intelligence", "ai model", "cloud computing", "cybersecurity", "software", "saas",
  "semiconductor", "chipmaker", "tech platform", "digital transformation", "data center", "5g", "generative ai"
];

const MARKET_KEYWORDS = [
  "nifty", "sensex", "bank nifty", "dalal street", "bulls", "bears", "top gainers", "top losers",
  "market wrap", "stocks in focus", "stock market", "fii", "dii", "market breadth", "sectoral indices",
  "midcap index", "smallcap index"
];

const GLOBAL_KEYWORDS = [
  "us fed", "wall street", "nasdaq", "dow jones", "s&p 500", "asia pacific", "geopolitical", "us inflation",
  "fomc", "ecb", "global markets", "china economy"
];

export class NewsCategoryResolver {
  /**
   * Deterministically resolves canonical primary and secondary categories, event type,
   * confidence, and evidence for an article based on an Event-First & Subject-Aware classification.
   */
  public static resolve(
    headline: string,
    body: string,
    publisher: string,
    fnoResult?: FNOClassificationResult
  ): ResolvedCategory {
    const cleanHeadline = NewsNormalizer.cleanText(headline || "");
    const cleanBody = NewsNormalizer.cleanText(body || "");
    const lowerHeadline = cleanHeadline.toLowerCase();
    const lowerBody = cleanBody.toLowerCase();
    const pubLower = (publisher || "").toLowerCase();

    const isFno = !!(fnoResult && fnoResult.eligible && fnoResult.decision === "INCLUDE");

    const scores: Record<CanonicalCategory, number> = {
      "F&O": 0,
      "Crypto": 0,
      "Commodities": 0,
      "IPO": 0,
      "Results": 0,
      "Market": 0,
      "Corporate": 0,
      "Economy": 0,
      "Global": 0,
      "Technology": 0,
      "Exchange": 0,
      "Other": 0
    };

    const evidenceMap: Partial<Record<CanonicalCategory, string>> = {};

    // 1. CRYPTO
    const cryptoHeadlineMatches = WordMatcher.countWords(lowerHeadline, CRYPTO_SPECIFIC);
    const cryptoBodyMatches = WordMatcher.countWords(lowerBody, CRYPTO_SPECIFIC);
    if (cryptoHeadlineMatches > 0) {
      scores["Crypto"] = cryptoHeadlineMatches * 50 + 30;
      evidenceMap["Crypto"] = `Crypto tokens/exchanges matched in headline (${cryptoHeadlineMatches})`;
    } else if (cryptoBodyMatches >= 2) {
      scores["Crypto"] = cryptoBodyMatches * 10;
      evidenceMap["Crypto"] = `Crypto tokens/exchanges matched in body (${cryptoBodyMatches})`;
    }

    // 2. IPO
    const ipoHeadlineMatches = WordMatcher.countWords(lowerHeadline, IPO_CORE);
    const ipoBodyMatches = WordMatcher.countWords(lowerBody, IPO_CORE);
    const isHistoricalIpo = /listed (since|after) (its|the) \bipo\b|previous \bipo\b/i.test(lowerHeadline);
    if (ipoHeadlineMatches > 0 && !isHistoricalIpo) {
      scores["IPO"] = ipoHeadlineMatches * 50 + 40;
      evidenceMap["IPO"] = `IPO indicators matched in headline (${ipoHeadlineMatches})`;
    } else if (ipoBodyMatches > 0 && !isHistoricalIpo) {
      const activeIpoBody = WordMatcher.anyWord(lowerBody, ["gmp", "drhp", "rhp", "allotment status", "subscription status", "grey market premium", "oversubscribed"]);
      if (activeIpoBody) {
        scores["IPO"] = ipoBodyMatches * 15;
        evidenceMap["IPO"] = `Active IPO indicators matched in body (${ipoBodyMatches})`;
      }
    }

    // 3. RESULTS (Earnings & PAT)
    const hasGenericYearHeadline = /\bfy\d{2}\b/i.test(lowerHeadline);
    const actualQuarterEvidence = WordMatcher.anyWord(lowerHeadline, RESULTS_PERIOD) || /\bq[1-4]\b/i.test(lowerHeadline);
    const hasPerfHeadline = WordMatcher.anyWord(lowerHeadline, RESULTS_PERF) || /\bpat\b|net profit|ebitda/i.test(lowerHeadline);
    
    const explicitEarningsEvidence = hasPerfHeadline || (hasGenericYearHeadline && WordMatcher.anyWord(lowerHeadline, ["revenue", "sales", "earnings", "profit", "loss", "income"]));
    
    const hasPeriodBody = WordMatcher.anyWord(lowerBody, RESULTS_PERIOD) || /\bq[1-4]\b/i.test(lowerBody);
    const hasPerfBody = WordMatcher.anyWord(lowerBody, RESULTS_PERF) || /\bpat\b|net profit|ebitda/i.test(lowerBody);
    
    const isOrderHeadline = WordMatcher.anyWord(lowerHeadline, ["order win", "contract win", "order book", "bags order", "bags contract"]) || 
      (WordMatcher.hasWord(lowerHeadline, "bags") && (WordMatcher.hasWord(lowerHeadline, "order") || WordMatcher.hasWord(lowerHeadline, "contract") || WordMatcher.hasWord(lowerHeadline, "deal") || WordMatcher.hasWord(lowerHeadline, "project"))) ||
      (WordMatcher.hasWord(lowerHeadline, "secures") && (WordMatcher.hasWord(lowerHeadline, "order") || WordMatcher.hasWord(lowerHeadline, "contract") || WordMatcher.hasWord(lowerHeadline, "deal") || WordMatcher.hasWord(lowerHeadline, "project"))) ||
      (WordMatcher.hasWord(lowerHeadline, "wins") && (WordMatcher.hasWord(lowerHeadline, "order") || WordMatcher.hasWord(lowerHeadline, "contract") || WordMatcher.hasWord(lowerHeadline, "deal") || WordMatcher.hasWord(lowerHeadline, "project") || WordMatcher.hasWord(lowerHeadline, "bid")));

    const isAcqHeadline = WordMatcher.anyWord(lowerHeadline, ["acquisition", "acquire", "acquires", "acquired", "takeover", "stake purchase", "stake sale", "buys stake", "sell stake"]) ||
      (WordMatcher.hasWord(lowerHeadline, "buys") && (WordMatcher.hasWord(lowerHeadline, "stake") || WordMatcher.hasWord(lowerHeadline, "share") || WordMatcher.hasWord(lowerHeadline, "shares") || WordMatcher.hasWord(lowerHeadline, "equity") || WordMatcher.hasWord(lowerHeadline, "company"))) ||
      (WordMatcher.hasWord(lowerHeadline, "acquires") && (WordMatcher.hasWord(lowerHeadline, "stake") || WordMatcher.hasWord(lowerHeadline, "share") || WordMatcher.hasWord(lowerHeadline, "shares") || WordMatcher.hasWord(lowerHeadline, "equity") || WordMatcher.hasWord(lowerHeadline, "company")));
    
    if ((actualQuarterEvidence || explicitEarningsEvidence) && !isOrderHeadline && !isAcqHeadline) {
      // If we have extremely strong quarterly results evidence in the headline (both period and performance keywords),
      // give it a higher score (150) so it takes precedence over secondary corporate action keywords (like "board approves" or "dividend")
      scores["Results"] = (actualQuarterEvidence && hasPerfHeadline) ? 150 : 80;
      evidenceMap["Results"] = `Financial results indicators matched in headline`;
    } else if (hasPeriodBody && hasPerfBody && !isOrderHeadline && !isAcqHeadline) {
      const isOtherCorporateHeadline = WordMatcher.anyWord(lowerHeadline, ["dividend", "buyback", "partnership", "partners", "collaborates", "collaboration", "joint venture", "mou"]);
      if (!isOtherCorporateHeadline) {
        scores["Results"] = 30;
        evidenceMap["Results"] = `Financial results indicators matched in body`;
      }
    }

    // 4. COMMODITIES
    const commHeadlineMatches = WordMatcher.countWords(lowerHeadline, COMMODITIES_KEYWORDS);
    const commBodyMatches = WordMatcher.countWords(lowerBody, COMMODITIES_KEYWORDS);
    if (commHeadlineMatches > 0) {
      scores["Commodities"] = commHeadlineMatches * 50 + 20;
      evidenceMap["Commodities"] = `Commodity assets/futures matched in headline (${commHeadlineMatches})`;
    } else if (commBodyMatches > 0) {
      scores["Commodities"] = commBodyMatches * 15;
      evidenceMap["Commodities"] = `Commodity assets/futures matched in body (${commBodyMatches})`;
    }

    // 5. EXCHANGE
    const isExchangePub = pubLower.includes("nse") || pubLower.includes("bse") || pubLower.includes("mcx");
    const exchHeadlineMatches = WordMatcher.countWords(lowerHeadline, EXCHANGE_KEYWORDS);
    const exchBodyMatches = WordMatcher.countWords(lowerBody, EXCHANGE_KEYWORDS);
    if (exchHeadlineMatches > 0 || isExchangePub) {
      scores["Exchange"] = (isExchangePub ? 60 : 0) + exchHeadlineMatches * 50 + 20;
      evidenceMap["Exchange"] = `Exchange regulatory/circular indicators matched in headline`;
    } else if (exchBodyMatches > 0) {
      scores["Exchange"] = exchBodyMatches * 15;
      evidenceMap["Exchange"] = `Exchange regulatory/circular indicators matched in body`;
    }

    // 6. ECONOMY / REGULATORY
    const isRegPub = pubLower.includes("sebi") || pubLower.includes("rbi") || pubLower.includes("pib");
    const econHeadlineMatches = WordMatcher.countWords(lowerHeadline, ECONOMY_KEYWORDS);
    const econBodyMatches = WordMatcher.countWords(lowerBody, ECONOMY_KEYWORDS);
    if (econHeadlineMatches > 0 || isRegPub) {
      scores["Economy"] = (isRegPub ? 40 : 0) + econHeadlineMatches * 50 + 20;
      evidenceMap["Economy"] = `Economy/regulatory keywords matched in headline`;
    } else if (econBodyMatches > 0) {
      scores["Economy"] = econBodyMatches * 10;
      evidenceMap["Economy"] = `Economy/regulatory keywords matched in body`;
    }

    // 7. CORPORATE
    const corpHeadlineMatches = WordMatcher.countWords(lowerHeadline, CORPORATE_KEYWORDS);
    const corpBodyMatches = WordMatcher.countWords(lowerBody, CORPORATE_KEYWORDS);
    if (corpHeadlineMatches > 0) {
      scores["Corporate"] = corpHeadlineMatches * 50 + 20;
      evidenceMap["Corporate"] = `Corporate action/order win keywords matched in headline`;
    } else if (corpBodyMatches > 0) {
      scores["Corporate"] = corpBodyMatches * 10;
      evidenceMap["Corporate"] = `Corporate action/order win keywords matched in body`;
    }

    // 8. TECHNOLOGY
    const techHeadlineMatches = WordMatcher.countWords(lowerHeadline, TECH_KEYWORDS);
    const techBodyMatches = WordMatcher.countWords(lowerBody, TECH_KEYWORDS);
    if (techHeadlineMatches > 0) {
      scores["Technology"] = techHeadlineMatches * 50 + 20;
      evidenceMap["Technology"] = `Technology & AI keywords matched in headline`;
    } else if (techBodyMatches > 0) {
      scores["Technology"] = techBodyMatches * 10;
      evidenceMap["Technology"] = `Technology & AI keywords matched in body`;
    }

    // 9. MARKET
    const mktHeadlineMatches = WordMatcher.countWords(lowerHeadline, MARKET_KEYWORDS);
    const mktBodyMatches = WordMatcher.countWords(lowerBody, MARKET_KEYWORDS);
    if (mktHeadlineMatches > 0) {
      scores["Market"] = mktHeadlineMatches * 50 + 20;
      evidenceMap["Market"] = `Broad market commentary keywords matched in headline`;
    } else if (mktBodyMatches > 0) {
      scores["Market"] = mktBodyMatches * 10;
      evidenceMap["Market"] = `Broad market commentary keywords matched in body`;
    }

    // 10. GLOBAL
    const globHeadlineMatches = WordMatcher.countWords(lowerHeadline, GLOBAL_KEYWORDS);
    const globBodyMatches = WordMatcher.countWords(lowerBody, GLOBAL_KEYWORDS);
    if (globHeadlineMatches > 0) {
      scores["Global"] = globHeadlineMatches * 50 + 20;
      evidenceMap["Global"] = `Global market/fed macro keywords matched in headline`;
    } else if (globBodyMatches > 0) {
      scores["Global"] = globBodyMatches * 10;
      evidenceMap["Global"] = `Global market/fed macro keywords matched in body`;
    }

    // Determine the highest non-F&O scoring category
    let primaryCategory: CanonicalCategory = "Other";
    let highestScore = 0;

    const CATEGORY_PRIORITY: CanonicalCategory[] = [
      "IPO", "Results", "Crypto", "Commodities", "Exchange", "Economy", "Corporate", "Technology", "Market", "Global"
    ];

    for (const cat of CATEGORY_PRIORITY) {
      if (scores[cat] > highestScore) {
        highestScore = scores[cat];
        primaryCategory = cat;
      }
    }

    const secondaryCategoriesSet = new Set<string>();

    const isPureDerivativesHeadline = WordMatcher.anyWord(lowerHeadline, ["futures", "options", "expiry", "open interest", "options chain", "call options", "put options", "derivative", "derivatives"]);

    // If F&O eligible:
    if (isFno) {
      if (isPureDerivativesHeadline) {
        primaryCategory = "F&O";
      } else if (primaryCategory !== "Other" && highestScore >= 30) {
        // If we have another robust primary category, F&O becomes secondary
        secondaryCategoriesSet.add("F&O");
      } else {
        primaryCategory = "F&O";
      }
    }

    // Add other active categories with score > 0 to secondary categories
    for (const cat of CATEGORY_PRIORITY) {
      if (cat !== primaryCategory && scores[cat] > 0) {
        secondaryCategoriesSet.add(cat);
      }
    }

    // Build evidence list
    const classificationEvidence: string[] = [];
    if (primaryCategory === "F&O") {
      classificationEvidence.push(`[F&O] F&O Eligible Symbol: ${fnoResult?.symbol || "DERIVATIVES"}`);
    } else if (primaryCategory !== "Other" && evidenceMap[primaryCategory]) {
      classificationEvidence.push(`[${primaryCategory}] ${evidenceMap[primaryCategory]}`);
    }

    for (const sec of secondaryCategoriesSet) {
      const cat = sec as CanonicalCategory;
      if (cat === "F&O") {
        classificationEvidence.push(`[F&O] F&O Eligible Symbol: ${fnoResult?.symbol || "DERIVATIVES"}`);
      } else if (evidenceMap[cat]) {
        classificationEvidence.push(`[${cat}] ${evidenceMap[cat]}`);
      }
    }

    if (primaryCategory === "Other" && classificationEvidence.length === 0) {
      classificationEvidence.push("Default fallback classification for general news story");
    }

    // Determine eventType based on primaryCategory
    let eventType = "OTHER";
    if (primaryCategory === "Results") {
      eventType = "EARNINGS";
    } else if (primaryCategory === "IPO") {
      eventType = "IPO";
    } else if (primaryCategory === "Crypto") {
      eventType = "CRYPTO";
    } else if (primaryCategory === "Commodities") {
      eventType = "COMMODITY";
    } else if (primaryCategory === "Exchange") {
      eventType = "EXCHANGE_NOTICE";
    } else if (primaryCategory === "Economy") {
      eventType = lowerHeadline.includes("sebi") || lowerHeadline.includes("rbi") || lowerHeadline.includes("fssai") || lowerHeadline.includes("regulat") ? "REGULATORY" : "MACRO";
    } else if (primaryCategory === "Corporate") {
      if (/revokes order|court order|sebi order|interim order|stay order|quashes order|fssai|rbi order|tribunal|nclt|nclat/i.test(lowerHeadline)) eventType = "REGULATORY";
      else if (/senior notes|debt listing|list \$?\d+|bonds listing/i.test(lowerHeadline)) eventType = "LISTING";
      else if (/acquisition|acquire|takeover/i.test(lowerHeadline)) eventType = "ACQUISITION";
      else if (/merger|amalgamation|demerger/i.test(lowerHeadline)) eventType = "MERGER";
      else if (/\b(order win|contract win|bags order|awarded order|secures order|won order|secures contract|bags contract|epc order|work order|receives order)\b/i.test(lowerHeadline)) eventType = "ORDER_CONTRACT";
      else if (/dividend/i.test(lowerHeadline)) eventType = "DIVIDEND";
      else if (/buyback/i.test(lowerHeadline)) eventType = "BUYBACK";
      else if (/resigns|appointed|ceo|cfo/i.test(lowerHeadline)) eventType = "MANAGEMENT_COMMENTARY";
      else if (/partnership|partners|collaborate/i.test(lowerHeadline)) eventType = "PARTNERSHIP";
      else eventType = "CORPORATE_ACTION";
    } else if (primaryCategory === "Technology") {
      eventType = "PRODUCT_TECHNOLOGY";
    } else if (primaryCategory === "Market") {
      eventType = "MARKET_MOVEMENT";
    } else if (primaryCategory === "Global") {
      eventType = "MACRO";
    } else if (primaryCategory === "F&O") {
      eventType = "DERIVATIVE_VOLATILITY";
    }

    let categoryConfidence: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    if (primaryCategory === "F&O") {
      categoryConfidence = "HIGH";
    } else if (primaryCategory !== "Other" && highestScore >= 50) {
      categoryConfidence = "HIGH";
    } else if (primaryCategory === "Other") {
      categoryConfidence = "LOW";
    }

    return {
      primaryCategory,
      secondaryCategories: Array.from(secondaryCategoriesSet),
      eventType,
      categoryConfidence,
      classificationEvidence
    };
  }
}
