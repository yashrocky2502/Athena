import { FNO_COMPANIES_REGISTRY, FNORegistryService } from '../registry/FNORegistry';
import { resolveFNOEligibility } from './FNOEligibilityResolver';
import { FNOAuditResult, FNORelevanceLevel, OptionsSellerRelevanceLevel } from './FOTypes';

export interface FNORelevanceResult {
  fnoRelevance: boolean;
  fnoRelevanceScore: number;
  fnoRelevanceTier: 'TIER_1' | 'TIER_2' | 'TIER_3';
  fnoReasons: string[];
  fnoEntities: string[];
  fnoEvidence: string[];
  binaryRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' | 'BINARY';
  volatilityRisk: 'VOLATILITY_EXPANSION' | 'VOLATILITY_COMPRESSION' | 'NEUTRAL' | 'HIGH_VOLATILITY_AVOID';
  decisionEligibility: 'ELIGIBLE_FOR_FO_ANALYSIS' | 'INELIGIBLE_NON_FO_STOCK' | 'INELIGIBLE_NOT_TRADE_RELEVANT';
}

export class FNORelevanceEngine {
  // TIER 1 - Explicit Derivatives Evidence Patterns
  public static readonly TIER_1_PATTERNS = [
    { id: 'OPTION_CHAIN', regex: /\b(option\s+chain|options\s+chain)\b/i, label: 'Option chain movement' },
    { id: 'FUTURES_OI', regex: /\b(futures?\s+oi|futures?\s+open\s+interest|futures?\s+price|long\s+buildup|short\s+buildup|short\s+covering|long\s+unwinding)\b/i, label: 'Futures price/open interest/positioning' },
    { id: 'OPTIONS_OI', regex: /\b(options?\s+oi|options?\s+open\s+interest)\b/i, label: 'Options open interest' },
    { id: 'CALL_PUT_WRITING', regex: /\b(call\s+writing|put\s+writing|call\s+writers?|put\s+writers?|writing\s+calls|writing\s+puts|call\s+buying|put\s+buying)\b/i, label: 'Call/put writing or buying activity' },
    { id: 'STRIKE_ACTIVITY', regex: /\b(strike\s+price|strike\s+activity|strikes?\s+(?:active|heavy|massive))\b/i, label: 'Strike price activity' },
    { id: 'IMPLIED_VOLATILITY', regex: /\b(implied\s+volatility|iv\s+percentile|iv\s+crush|iv\s+expansion|iv\s+spike|high\s+iv)\b/i, label: 'Implied Volatility (IV) metrics' },
    { id: 'OPTION_PREMIUM', regex: /\b(option\s+premiums?|premium\s+movement|premium\s+decay|premium\s+erosion)\b/i, label: 'Option premium activity' },
    { id: 'FUTURES_ROLLOVER', regex: /\b(futures?\s+rollover|futures?\s+basis)\b/i, label: 'Futures rollover or basis' },
    { id: 'EXPIRY_POSITIONING', regex: /\b(expiry\s+positioning|expiry\s+day|expiry\s+specific|near\s+expiry|monthly\s+expiry|weekly\s+expiry)\b/i, label: 'Expiry positioning' },
    { id: 'PUT_CALL_RATIO', regex: /\b(put-call\s+ratio|pcr)\b/i, label: 'Put-Call Ratio (PCR)' },
    { id: 'UNUSUAL_OPTIONS', regex: /\b(unusual\s+options?\s+activity|derivative\s+volumes?|derivative\s+open\s+interest|derivative\s+positioning)\b/i, label: 'Unusual options/derivative activity' },
    { id: 'FO_BAN', regex: /\b(f&o\s+ban|fno\s+ban|entering\s+f&o\s+ban|exiting\s+f&o\s+ban|ban\s+period\s+in\s+f&o)\b/i, label: 'F&O ban adjustments' },
    { id: 'FO_CONTRACT_CHANGES', regex: /\b(futures?\s+and\s+options?\s+changes?|nse\s+derivatives?\s+circular)\b/i, label: 'F&O contract specifications' },
    { id: 'DERIVATIVES_SPECIFIC', regex: /\b(call\s+option|put\s+option|call\s+options|put\s+options|ce\s+option|pe\s+option|\bce\b|\bpe\b|(?:f&o|f&amp;o|fno|futures\s+and\s+options)\s+(?:segment|stocks?|counters?|space|market|trading|calls?|trade|positions?))\b/i, label: 'Explicit options contracts' }
  ];

  // TIER 2 - Material Underlying Event Patterns
  public static readonly TIER_2_PATTERNS = [
    { id: 'EARNINGS_RESULTS', regex: /\b(quarterly\s+results?|earnings|net\s+profit\s+(?:rises|falls|beats|misses|surges|drops)|pat\s+(?:rises|falls)|ebitda|revenue\s+surprise|profit\s+surprise|(?:q[1-4]|quarterly)\s+(?:profit|net\s+profit|pat|results?|earnings)|(?:profit|net\s+profit|pat)\s+(?:soars|jumps|surges|rises|falls|drops|zooms|doubles|triples|quadruples|\d+x))\b/i, label: 'Earnings/Quarterly Results' },
    { id: 'GUIDANCE_CHANGE', regex: /\b(guidance|outlook|guidance\s+(?:cut|raised|revised))\b/i, label: 'Major Guidance Change' },
    { id: 'ORDER_WIN_LOSS', regex: /\b(bags?|wins?|secures?|gets?|awarded|receives?)\b.*?\b(order|contract|mandate|project)\b|\b(order|contract)\s+(win|cancellation|loss)\b|\bmaterial\s+government\s+contract\b/i, label: 'Major Order Win or Loss' },
    { id: 'MERGER_ACQUISITION', regex: /\b(merger|acquisition|takeover|demerger|stake\s+buy|stake\s+sale|buys?\s+stake|sells?\s+stake|corporate\s+restructuring)\b/i, label: 'M&A or Corporate Restructuring' },
    { id: 'REGULATORY_ACTION', regex: /\b(sebi\s+(?:penalty|order|investigation|bans|bars|action)|usfda\s+(?:warning|alert|observation|form\s+483|observations?|non-compliance)|eir|establishment\s+inspection\s+report|regulatory\s+action|penalty|settlement|antitrust|lawsuit|fine)\b/i, label: 'Regulatory Action / SEBI / USFDA' },
    { id: 'COURT_VERDICT', regex: /\b(court\s+verdict|supreme\s+court|nclt\s+order)\b/i, label: 'Material Court Verdict' },
    { id: 'PROMOTER_EVENT', regex: /\b(promoter\s+stake|pledge|unpledge|block\s+deal|bulk\s+deal|promoter\s+event)\b/i, label: 'Promoter Action or Large Stake Deals' },
    { id: 'MANAGEMENT_CHANGE', regex: /\b(?:appoints?|appointment\s+of|resignation\s+of|replacement\s+of|ouster\s+of|firing\s+of)\s+(?:new\s+)?\b(ceo|cfo)\b|\b(ceo|cfo)\b(?:\s+[\w'-]+){0,3}\s+(?:resigns?|resignation|steps?\s+down|appointed|appointment|replaced|ousted|fired|quits|exit|exits|departure|leaves|quitting)\b/i, label: 'Key Executive Management Change' },
    { id: 'DEBT_DEFAULT_CAPEX', regex: /\b(default\s+event|debt\s+restructuring|major\s+capex\s+announcement)\b/i, label: 'Major Debt/Default or Capex Announcement' }
  ];

  // Banned Patterns to reduce false-positive noise
  public static readonly NEGATIVE_PATTERNS = [
    { id: 'GENERIC_MOVEMENT', regex: /\b(shares?\s+gains?|shares?\s+falls?|stock\s+rises?|stock\s+falls?|shares?\s+rises?|stock\s+up|stock\s+down|gains?\s+\d+%|falls?\s+\d+%|up\s+\d+%|down\s+\d+%|rises?\s+after|gains?\s+after|gains?\s+in\s+early\s+trade|falls?\s+after\s+market\s+opens|trades?\s+higher)\b/i, weight: 35, label: 'Generic stock price movement' },
    { id: 'MARKET_COMMENTARY', regex: /\b(market\s+wrap|market\s+closes|market\s+opens|indices\s+trade|sensex\s+gains|nifty\s+gains|indices\s+flat|market\s+live)\b/i, weight: 35, label: 'Generic market commentary' },
    { id: 'BROKER_REPORT', regex: /\b(brokerage|analyst\s+rating|credit\s+rating|sovereign\s+rating|brokerage\s+rating|target\s+price|price\s+target|upgrade|downgrade|recommends|jefferies|goldman|morgan\s+stanley|clsa|nomura|jp\s+morgan|citi|ubs)\b/i, weight: 35, label: 'Generic broker report / rating / price target' },
    { id: 'ROUTINE_DIVIDEND', regex: /\b(dividend|split|bonus)\b/i, weight: 25, label: 'Routine corporate actions (dividend/split/bonus)' },
    { id: 'ROUTINE_ANNOUNCEMENT', regex: /\b(schedules?|hosts?|invites?)\b.*?\b(conference\s+call|concall|analyst\s+call|earnings\s+call)\b|\b(investor\s+presentation|quarterly\s+update|board\s+meeting|board\s+to\s+meet|routine|business\s+update)\b/i, weight: 35, label: 'Routine corporate announcement / call scheduling' },
    { id: 'MACRO_ARTICLE', regex: /\b(gdp|cpi|wpi|inflation|forex|monetary\s+policy|repo\s+rate|rbi|union\s+budget|tax\s+collection)\b/i, weight: 45, label: 'Generic macroeconomic article' },
    { id: 'COMMODITY_ARTICLE', regex: /\b(crude\s+oil|brent\s+crude|gold\s+prices?|silver\s+prices?|commodity\s+market)\b/i, weight: 45, label: 'Commodity news' },
    { id: 'CRYPTO_ARTICLE', regex: /\b(bitcoin|ethereum|crypto|cryptocurrency|btc|eth)\b/i, weight: 45, label: 'Crypto news' },
    { id: 'IPO_ARTICLE', regex: /\b(ipo|grey\s+market|listing\s+gain|gmp|ipo\s+opens)\b/i, weight: 45, label: 'IPO-related news' }
  ];

  // Ordinary language context blocks for "call" and "put"
  private static readonly CALL_ORDINARY_BLOCK = /\b(earnings\s+call|concall|conference\s+call|analyst\s+call|phone\s+call|call\s+with|calls?\s+with|call\s+for|calls?\s+for|on\s+call|issue\s+buy\s+call|brokerage\s+buy\s+call|buy\s+call\s+on)\b/i;
  private static readonly PUT_ORDINARY_BLOCK = /\b(put\s+on|put\s+forward|put\s+pressure|put\s+aside|put\s+up|put\s+in|put\s+down|put\s+off|put\s+together|stay\s+put|put\s+to|put\s+it)\b/i;

  public static evaluateAudit(article: any): FNOAuditResult {
    const title = (article.title || article.headline || '').toString();
    const body = (article.summary || article.description || article.content || article.body || article.cleanBody || '').toString();

    // 1. Resolve Eligibility
    const eligibility = resolveFNOEligibility(article);

    if (!eligibility.eligible || eligibility.confidence !== "HIGH") {
      return {
        fnoEligible: false,
        fnoSymbol: eligibility.symbol,
        matchedEntity: eligibility.matchedEntity,
        entityMatchLocation: eligibility.matchLocation,
        entityConfidence: eligibility.confidence,
        fnoRelevance: "NONE",
        fnoScore: 0,
        fnoReasons: [eligibility.reason],
        fnoDecision: "EXCLUDE",
        fnoRuleVersion: "21.2",
        optionsSellerRelevance: "NONE"
      };
    }

    // 2. Evaluate Relevance on eligible F&O underlying
    const textUnescaped = `${title} \n ${body}`.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const textLower = textUnescaped.toLowerCase();
    const fnoReasons: string[] = [eligibility.reason];
    const fnoEvidence: string[] = [];

    // Scan Tier 1 (Explicit Derivatives)
    let tier1Score = 0;
    let matchedTier1Count = 0;
    for (const pat of this.TIER_1_PATTERNS) {
      if (pat.regex.test(textLower)) {
        // Exclude ordinary "call" / "put" without option context
        const isPlainCallPut = /\b(call|put)\b/i.test(textLower) && !/\b(option|options|ce|pe|oi|open\s+interest|strike|premium|iv|implied|pcr|futures?|writing|writers?|buying|buildup|unwinding|covering)\b/i.test(textLower);
        if (isPlainCallPut) {
          if (this.CALL_ORDINARY_BLOCK.test(textLower) || this.PUT_ORDINARY_BLOCK.test(textLower)) {
            continue;
          }
        }
        matchedTier1Count++;
        fnoEvidence.push(pat.label);
        fnoReasons.push(`Derivatives evidence: ${pat.label}`);
        tier1Score += 70;
      }
    }

    // Scan Tier 2 (Material Underlying Events with Volatility Impact)
    let tier2Score = 0;
    let matchedTier2Count = 0;
    for (const pat of this.TIER_2_PATTERNS) {
      if (pat.regex.test(textLower)) {
        matchedTier2Count++;
        fnoEvidence.push(pat.label);
        fnoReasons.push(`Material event: ${pat.label}`);
        tier2Score += 35;
      }
    }

    // Scan Negative Patterns
    let negativeDeduction = 0;
    const matchedNegatives: string[] = [];
    for (const pat of this.NEGATIVE_PATTERNS) {
      if (pat.regex.test(textLower)) {
        if ((matchedTier1Count > 0 || matchedTier2Count > 0) && (pat.id === 'GENERIC_MOVEMENT' || pat.id === 'BROKER_REPORT' || pat.id === 'COMMODITY_ARTICLE')) {
          continue; // Don't penalize broker report, generic movement, or commodity mentions if tier 1 derivatives or tier 2 material stock event is present
        }
        matchedNegatives.push(pat.label);
        negativeDeduction += pat.weight;
      }
    }

    // Compute Base Score
    let score = 20; // Base score for high confidence F&O underlying match
    if (matchedTier1Count > 0) {
      score += Math.max(50, tier1Score);
    } else if (matchedTier2Count > 0) {
      score += tier2Score;
    }

    score = Math.max(0, score - negativeDeduction);
    score = Math.min(100, score);

    // Mandate: Story MUST contain at least one Tier 1 or Tier 2 signal to qualify
    const hasQualifyingSignal = matchedTier1Count > 0 || matchedTier2Count > 0;

    // Determine Relevance Level
    let fnoRelevance: FNORelevanceLevel = "NONE";
    if (hasQualifyingSignal && matchedTier1Count > 0 && score >= 50) {
      fnoRelevance = "HIGH";
    } else if (hasQualifyingSignal && matchedTier1Count > 0 && score >= 40) {
      fnoRelevance = "MEDIUM";
    } else if (hasQualifyingSignal && matchedTier2Count > 0 && score >= 45) {
      fnoRelevance = "MEDIUM";
    } else if (score >= 30) {
      fnoRelevance = "LOW";
      fnoReasons.push(`Classified as LOW relevance due to: ${matchedNegatives.join(', ') || 'lack of explicit derivative or material event signal'}`);
    } else {
      fnoRelevance = "NONE";
      fnoReasons.push(`Filtered out due to negative signals or lack of qualifying F&O catalyst: ${matchedNegatives.join(', ') || 'no qualifying signal'}`);
    }

    // Determine Authoritative Decision Gate
    // FNO_TAB_ARTICLE = FNO_ELIGIBLE (HIGH confidence) AND HAS_QUALIFYING_SIGNAL AND RELEVANCE >= MEDIUM
    const fnoDecision: "INCLUDE" | "EXCLUDE" = (
      eligibility.eligible &&
      eligibility.confidence === "HIGH" &&
      hasQualifyingSignal &&
      (fnoRelevance === "HIGH" || fnoRelevance === "MEDIUM")
    ) ? "INCLUDE" : "EXCLUDE";

    // Options Seller Relevance
    let optionsSellerRelevance: OptionsSellerRelevanceLevel = "NONE";
    const isBinaryEvent = /\b(q[1-4]|earnings|quarterly|results|sebi|usfda|court|verdict|m&a|takeover|f&o\s+ban)\b/i.test(textLower);
    const isHighIV = /\b(iv\s+expansion|iv\s+spike|implied\s+volatility|unusual\s+options|open\s+interest|oi\s+buildup)\b/i.test(textLower);

    if (fnoDecision === "INCLUDE") {
      if (isBinaryEvent && (isHighIV || matchedTier1Count > 0)) {
        optionsSellerRelevance = "VERY_HIGH";
      } else if (matchedTier1Count > 0 || isBinaryEvent) {
        optionsSellerRelevance = "HIGH";
      } else {
        optionsSellerRelevance = "MEDIUM";
      }
    } else if (fnoRelevance === "LOW") {
      optionsSellerRelevance = "LOW";
    } else {
      optionsSellerRelevance = "NONE";
    }

    return {
      fnoEligible: eligibility.eligible && eligibility.confidence === "HIGH",
      fnoSymbol: eligibility.symbol,
      matchedEntity: eligibility.matchedEntity,
      entityMatchLocation: eligibility.matchLocation,
      entityConfidence: eligibility.confidence,
      fnoRelevance,
      fnoScore: score,
      fnoReasons,
      fnoDecision,
      fnoRuleVersion: "21.2",
      optionsSellerRelevance
    };
  }

  public static evaluateRelevance(
    title: string,
    body: string,
    resolvedCompanyTicker?: string
  ): FNORelevanceResult {
    const audit = this.evaluateAudit({ title, body, symbol: resolvedCompanyTicker });
    
    return {
      fnoRelevance: audit.fnoDecision === "INCLUDE",
      fnoRelevanceScore: audit.fnoScore,
      fnoRelevanceTier: audit.fnoRelevance === "HIGH" ? "TIER_1" : (audit.fnoRelevance === "MEDIUM" ? "TIER_2" : "TIER_3"),
      fnoReasons: audit.fnoReasons,
      fnoEntities: audit.fnoSymbol ? [audit.fnoSymbol] : [],
      fnoEvidence: [],
      binaryRisk: audit.optionsSellerRelevance === "VERY_HIGH" ? "BINARY" : "LOW",
      volatilityRisk: "NEUTRAL",
      decisionEligibility: audit.fnoDecision === "INCLUDE" ? "ELIGIBLE_FOR_FO_ANALYSIS" : "INELIGIBLE_NOT_TRADE_RELEVANT"
    };
  }
}
