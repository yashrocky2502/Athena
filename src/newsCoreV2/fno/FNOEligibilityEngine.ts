import { FNOClassificationResult } from "../domain/FNOClassification";
import { findFNOEntityInHeadline } from "./FNOUniverse";

const TIER_1_DERIVATIVE_TERMS = [
  "options",
  "option chain",
  "call writing",
  "put writing",
  "strike price",
  "implied volatility",
  "\\biv\\b",
  "\\bpcr\\b",
  "put-call ratio",
  "futures oi",
  "open interest",
  "rollover",
  "futures",
  "options activity",
  "call option",
  "put option",
  "long unwinding",
  "short covering",
  "fresh long",
  "fresh short",
  "f&o ban",
  "fo ban"
];

const TIER_2_CATALYST_TERMS = [
  "earnings",
  "profit",
  "pat",
  "revenue",
  "ebitda",
  "guidance",
  "fda action",
  "fda approval",
  "usfda",
  "sebi action",
  "regulatory action",
  "merger",
  "acquisition",
  "demerger",
  "ceo resignation",
  "cfo resignation",
  "court verdict",
  "order win",
  "order cancellation",
  "default",
  "credit event",
  "buyback",
  "dividend",
  "q1 results",
  "q2 results",
  "q3 results",
  "q4 results",
  "q1 profit",
  "q2 profit",
  "q3 profit",
  "q4 profit",
  "net profit",
  "net loss",
  "eps"
];

const HARD_BLOCK_TERMS = [
  "mutual fund",
  "\\betf\\b",
  "live blog",
  "live updates",
  "market live",
  "subscription",
  "comparison",
  "versus",
  "\\bvs\\b"
];

const ROUTINE_COMMENTARY_TERMS = [
  "stocks to watch",
  "top stocks to watch",
  "hot stocks",
  "top gainers",
  "top losers",
  "stocks in focus",
  "market wrap",
  "indian market today",
  "market today",
  "target price",
  "price target",
  "brokerage target",
  "broker target",
  "retains buy",
  "maintains buy",
  "retains sell",
  "maintains sell",
  "downgrades to",
  "upgrades to",
  "analyst rating",
  "brokerage maintains",
  "brokerage upgrades",
  "brokerage downgrades",
  "sector commentary",
  "sector outlook",
  "bank nifty outlook",
  "nifty outlook",
  "market outlook",
  "put pressure",
  "called for",
  "call for",
  "calls for",
  "conference call",
  "analyst call",
  "concall",
  "stock comparison",
  "nifty rises",
  "nifty falls",
  "bank nifty rises",
  "bank nifty falls",
  "sector gains"
];

const INDEX_SYMBOLS = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]);

function checkTermMatch(text: string, term: string): boolean {
  if (term.includes("\\b")) {
    const regex = new RegExp(term, "i");
    return regex.test(text);
  }
  return text.toLowerCase().includes(term.toLowerCase());
}

export class FNOEligibilityEngine {
  /**
   * Evaluates whether an article qualifies for the F&O feed under strict Phase 26 rules.
   * Prioritizes primary corporate catalysts over secondary market commentary.
   */
  public static evaluate(headline: string, body: string): FNOClassificationResult {
    if (!headline || typeof headline !== "string") {
      return {
        eligible: false,
        symbol: null,
        confidence: "NONE",
        decision: "EXCLUDE",
        reason: "Missing headline"
      };
    }

    const lowerHeadline = headline.toLowerCase();
    const lowerBody = (body || "").toLowerCase();
    const combinedText = `${lowerHeadline} ${lowerBody}`;

    // 1. Requirement A & B: F&O entity match IN HEADLINE
    const headlineMatch = findFNOEntityInHeadline(headline);
    if (!headlineMatch) {
      return {
        eligible: false,
        symbol: null,
        confidence: "NONE",
        decision: "EXCLUDE",
        reason: "No canonical F&O entity identified in headline"
      };
    }

    const { company, matchedAlias } = headlineMatch;

    // 2. Check for explicit Tier 1 Derivatives
    let matchedTier1: string | null = null;
    for (const term of TIER_1_DERIVATIVE_TERMS) {
      if (checkTermMatch(combinedText, term)) {
        matchedTier1 = term.replace(/\\b/g, "");
        break;
      }
    }

    // 3. Index Symbol Special Rule: Index stories REQUIRE Tier 1 derivative evidence
    if (INDEX_SYMBOLS.has(company.symbol) && !matchedTier1) {
      return {
        eligible: false,
        symbol: company.symbol,
        confidence: "HIGH",
        decision: "EXCLUDE",
        reason: `Index symbol ${company.symbol} requires explicit derivative metrics (options, futures, strike, OI, PCR, rollover)`
      };
    }

    // 4. Hard Block check (Non-negotiable rejections)
    for (const term of HARD_BLOCK_TERMS) {
      if (checkTermMatch(combinedText, term)) {
        return {
          eligible: false,
          symbol: company.symbol,
          confidence: "HIGH",
          decision: "EXCLUDE",
          reason: `Hard block: Article contains disallowed generic term "${term.replace(/\\b/g, "")}"`
        };
      }
    }

    // 5. Tier 2 Catalyst Check
    let matchedTier2: string | null = null;
    for (const term of TIER_2_CATALYST_TERMS) {
      if (checkTermMatch(combinedText, term)) {
        matchedTier2 = term;
        break;
      }
    }

    // 6. Routine Commentary Check
    let matchedRoutine: string | null = null;
    for (const term of ROUTINE_COMMENTARY_TERMS) {
      if (checkTermMatch(combinedText, term)) {
        matchedRoutine = term;
        break;
      }
    }

    // 7. Decision Logic
    // RULE: If Tier 1 (Derivatives) OR Tier 2 (Material Catalyst) is present, 
    // routine commentary (like target price) does NOT disqualify the story.
    
    if (matchedTier1 || matchedTier2) {
      const reasonDetail = matchedTier1
        ? `Tier 1 Derivative Match: "${matchedTier1}"`
        : `Tier 2 Catalyst Match: "${matchedTier2}"`;
        
      const commentaryNote = matchedRoutine ? ` (Routine commentary "${matchedRoutine}" bypassed due to primary catalyst)` : "";

      return {
        eligible: true,
        symbol: company.symbol,
        confidence: "HIGH",
        decision: "INCLUDE",
        reason: `Headline alias "${matchedAlias}" matched ${company.symbol}. ${reasonDetail}${commentaryNote}`
      };
    }

    // If no catalysts found, but routine commentary exists
    if (matchedRoutine) {
      return {
        eligible: false,
        symbol: company.symbol,
        confidence: "HIGH",
        decision: "EXCLUDE",
        reason: `Excluded as routine market commentary: "${matchedRoutine}"`
      };
    }

    return {
      eligible: false,
      symbol: company.symbol,
      confidence: "HIGH",
      decision: "EXCLUDE",
      reason: "Lacks explicit Tier 1 derivative metrics and Tier 2 material corporate catalysts"
    };
  }
}
