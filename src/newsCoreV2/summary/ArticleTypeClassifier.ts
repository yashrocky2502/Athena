/**
 * ATHENA NEWS ENGINE — ADAPTIVE SUMMARY SUITE
 * ArticleTypeClassifier
 * 
 * Classifies financial and market news articles into 20+ deterministic semantic types.
 * The detected article type determines which facts are prioritized during extraction and synthesis.
 */

export type SemanticArticleType =
  | 'IPO_GMP'
  | 'EARNINGS_RESULTS'
  | 'ORDER_WIN'
  | 'LAWSUIT_REGULATORY'
  | 'MA_ACQUISITION'
  | 'MANAGEMENT_CHANGE'
  | 'BLOCK_DEAL'
  | 'DIVIDEND_BUYBACK'
  | 'CAPEX_PROJECT'
  | 'PARTNERSHIP'
  | 'COMMODITY'
  | 'MACRO_CENTRAL_BANK'
  | 'CURRENCY'
  | 'SECTOR_MOVEMENT'
  | 'STOCK_PRICE_MOVEMENT'
  | 'BROKER_ANALYST_VIEW'
  | 'CORPORATE_ACTION'
  | 'FUNDRAISING'
  | 'GOVERNMENT_POLICY'
  | 'PRODUCT_BUSINESS_UPDATE'
  | 'MARKET_EVENT'
  | 'GLOBAL_MARKET'
  | 'GENERAL_FINANCIAL'
  | 'GENERAL_NEWS';

export interface ArticleTypeClassification {
  primaryType: SemanticArticleType;
  secondaryTypes: SemanticArticleType[];
  confidence: number;
  signals: string[];
}

export class ArticleTypeClassifier {
  /**
   * Classifies an article into a primary SemanticArticleType and any secondary types.
   */
  public static classify(headline: string, body: string, existingCategory?: string): ArticleTypeClassification {
    const text = `${headline || ''} ${body || ''}`.toLowerCase();
    const head = (headline || '').toLowerCase();
    const signals: string[] = [];
    const scores: Record<SemanticArticleType, number> = {
      IPO_GMP: 0,
      EARNINGS_RESULTS: 0,
      ORDER_WIN: 0,
      LAWSUIT_REGULATORY: 0,
      MA_ACQUISITION: 0,
      MANAGEMENT_CHANGE: 0,
      BLOCK_DEAL: 0,
      DIVIDEND_BUYBACK: 0,
      CAPEX_PROJECT: 0,
      PARTNERSHIP: 0,
      COMMODITY: 0,
      MACRO_CENTRAL_BANK: 0,
      CURRENCY: 0,
      SECTOR_MOVEMENT: 0,
      STOCK_PRICE_MOVEMENT: 0,
      BROKER_ANALYST_VIEW: 0,
      CORPORATE_ACTION: 0,
      FUNDRAISING: 0,
      GOVERNMENT_POLICY: 0,
      PRODUCT_BUSINESS_UPDATE: 0,
      MARKET_EVENT: 0,
      GLOBAL_MARKET: 0,
      GENERAL_FINANCIAL: 0,
      GENERAL_NEWS: 0
    };

    // 1. IPO / IPO GMP / Subscription
    if (/\b(ipo|gmp|grey market premium|grey market signals|initial public offer|listing date|issue price|price band|allotment status|subscribed \d+x|bidding opens|bidding closes|ofs|fresh issue|anchor investors?)\b/i.test(head)) {
      scores.IPO_GMP += 90;
      signals.push('Headline IPO / GMP match');
    }
    if (/\b(gmp|grey market premium|grey market|subscription rate|times subscribed|allotment|drhp|rhp|issue size of ₹|fresh issue of ₹)\b/i.test(text)) {
      scores.IPO_GMP += 45;
    }

    // 2. Earnings / Results
    if (/\b(q[1-4]\s*(?:fy\d{2,4}|results|pat|profit|loss|earnings)|quarterly results|net profit (?:surges|jumps|falls|slumps|up|down)|ebitda|operating profit|pat rises|pat up|revenue up|revenue rose|results review)\b/i.test(head)) {
      scores.EARNINGS_RESULTS += 90;
      signals.push('Headline Earnings / Results match');
    }
    if (/\b(q[1-4]\s*fy\d{2,4}|quarterly revenue|ebitda margin|net profit|yoy|qoq|guidance for fy)\b/i.test(text)) {
      scores.EARNINGS_RESULTS += 40;
    }

    // 3. Order Win / Contract Win
    if (/\b(order win|bags order|bags contract|secures order|awarded order|won order|secures contract|bags ₹\d+|secures ₹\d+|bags \$\d+|epc contract|l1 bidder|secures project)\b/i.test(head) &&
        !/\b(revokes order|court order|sebi order|interim order|stay order)\b/i.test(head)) {
      scores.ORDER_WIN += 90;
      signals.push('Headline Order Win match');
    }
    if (/\b(transmission and distribution order|work order|letter of award|loa|order book stands at|contract worth|order valued at)\b/i.test(text)) {
      scores.ORDER_WIN += 45;
    }

    // 4. Lawsuit / Regulatory
    if (/\b(lawsuit|sued|court|nclt|nclat|supreme court|high court|sebi|rbi penalty|ed raids|cbi|fssai|show cause|quashes order|interim stay|allegations|plea|petition|fraud|class-action)\b/i.test(head)) {
      scores.LAWSUIT_REGULATORY += 90;
      signals.push('Headline Lawsuit / Regulatory match');
    }
    if (/\b(tribunal|litigation|damages claimed|regulatory probe|inquiry|fined ₹|penalty of ₹|class action lawsuit|contested claims)\b/i.test(text)) {
      scores.LAWSUIT_REGULATORY += 40;
    }

    // 5. Block Deals / Bulk Deals
    if (/\b(block deal|bulk deal|promoter sells|promoter buys|offloads \d+%|stake sale in block|large trade|gqg buys|sells stake via block)\b/i.test(head)) {
      scores.BLOCK_DEAL += 90;
      signals.push('Headline Block Deal match');
    }
    if (/\b(block window|bulk deal data|executed via block|promoter group sold|equity shares changed hands)\b/i.test(text)) {
      scores.BLOCK_DEAL += 40;
    }

    // 6. Dividend & Buyback (Corporate Action)
    if (/\b(dividend|interim dividend|final dividend|buyback|bonus share|bonus issue|stock split|split 1:|face value split|record date for dividend|share repurchase)\b/i.test(head)) {
      scores.DIVIDEND_BUYBACK += 90;
      scores.CORPORATE_ACTION += 70;
      signals.push('Headline Dividend / Buyback match');
    }
    if (/\b(dividend of ₹|buyback price of ₹|record date set as|ex-dividend date)\b/i.test(text)) {
      scores.DIVIDEND_BUYBACK += 40;
    }

    // 7. M&A / Acquisition / Deals
    if (/\b(acquires|to acquire|acquisition|merger|takes over|stake purchase|buys \d+% stake|amalgamation|consolidation|joint venture)\b/i.test(head)) {
      scores.MA_ACQUISITION += 85;
      signals.push('Headline M&A match');
    }
    if (/\b(definitive agreement|enterprise value of|all-cash deal|share purchase agreement|spa)\b/i.test(text)) {
      scores.MA_ACQUISITION += 35;
    }

    // 8. Management Change
    if (/\b(ceo|cfo|md & ceo|managing director|steps down|resigns|appointed|appoints new|board reconstitution|leadership change|executive director)\b/i.test(head)) {
      scores.MANAGEMENT_CHANGE += 85;
      signals.push('Headline Management Change match');
    }

    // 9. Capex / Projects / Expansion
    if (/\b(capex|investment of ₹|to invest ₹|sets up new plant|manufacturing facility|greenfield project|brownfield expansion|capacity expansion)\b/i.test(head)) {
      scores.CAPEX_PROJECT += 80;
      signals.push('Headline Capex / Project match');
    }

    // 10. Partnerships / Tie-ups
    if (/\b(partners with|strategic partnership|signs mou|collaborates with|pact with|tie-up with|joint development)\b/i.test(head)) {
      scores.PARTNERSHIP += 80;
      signals.push('Headline Partnership match');
    }

    // 11. Commodity (Gold, Crude Oil, Silver, Copper, Natural Gas)
    if (/\b(gold prices?|silver prices?|crude oil|brent crude|wti|mcx gold|mcx silver|bullion|comex gold|precious metals?|natural gas|copper)\b/i.test(head)) {
      scores.COMMODITY += 90;
      signals.push('Headline Commodity match');
    }
    if (/\b(spot gold|mcx|per 10 grams|per ounce|brent|us cpi|treasury buyback|fed rate cut|safe-haven|dollar index|resistance at|support at|50-day ema)\b/i.test(text)) {
      scores.COMMODITY += 40;
    }

    // 12. Macro / Central Bank / Economic Data
    if (/\b(fed|federal reserve|jerome powell|rbi|monetary policy|mpc|repo rate|rate cut|rate hike|inflation|cpi|wpi|gdp|jackson hole|treasury yields|us 10y|fomc)\b/i.test(head)) {
      scores.MACRO_CENTRAL_BANK += 85;
      signals.push('Headline Macro / Central Bank match');
    }
    if (/\b(interest rate path|central bank|basis points|rate trajectory|bond yields|macroeconomic|rate-hike probabilities)\b/i.test(text)) {
      scores.MACRO_CENTRAL_BANK += 35;
    }

    // 13. Currency / FX
    if (/\b(rupee|usd\/inr|dollar index|dxy|forex reserves|depreciates against dollar|appreciates against dollar)\b/i.test(head)) {
      scores.CURRENCY += 85;
      signals.push('Headline Currency match');
    }

    // 14. Sector Movement
    if (/\b(railway stocks|rail stocks|psu bank stocks|defence stocks|realty stocks|metal stocks|auto pack|it stocks rally|pharma stocks surge|sector rally|sectoral index|four-laning)\b/i.test(head)) {
      scores.SECTOR_MOVEMENT += 85;
      signals.push('Headline Sector Movement match');
    }

    // 15. Stock Price Movement
    if (/\b(shares surge|shares jump|shares plunge|shares tank|rallies \d+.*%|surges \d+.*%|hits 52-week high|hits lower circuit|upper circuit|stock slides)\b/i.test(head)) {
      scores.STOCK_PRICE_MOVEMENT += 70;
      signals.push('Headline Stock Price Movement match');
    }

    // 16. Broker / Analyst View
    if (/\b(target price|brokerage|jefferies|clsa|morgan stanley|nomura|goldman sachs|motilal oswal|icici securities|upgrades to buy|downgrades|initiates coverage)\b/i.test(head)) {
      scores.BROKER_ANALYST_VIEW += 80;
      signals.push('Headline Broker / Analyst match');
    }

    // 17. Global Market
    if (/\b(wall street|nasdaq|dow jones|s&p 500|asian markets|hang seng|nikkei|european markets|gift nifty)\b/i.test(head)) {
      scores.GLOBAL_MARKET += 75;
      signals.push('Headline Global Market match');
    }

    // Category overrides/boosts
    if (existingCategory) {
      const cat = existingCategory.toUpperCase();
      if (cat.includes('IPO')) scores.IPO_GMP += 30;
      if (cat.includes('RESULTS') || cat.includes('EARNINGS')) scores.EARNINGS_RESULTS += 30;
      if (cat.includes('ORDER')) scores.ORDER_WIN += 30;
      if (cat.includes('REGULATORY')) scores.LAWSUIT_REGULATORY += 30;
      if (cat.includes('MACRO') || cat.includes('CENTRAL_BANK')) scores.MACRO_CENTRAL_BANK += 30;
      if (cat.includes('COMMODITY') || cat.includes('COMMODITIES')) scores.COMMODITY += 30;
    }

    // Sort types by score
    const sortedTypes = (Object.keys(scores) as SemanticArticleType[])
      .filter(t => scores[t] > 0)
      .sort((a, b) => scores[b] - a[b]);

    const primaryType = sortedTypes[0] || 'GENERAL_FINANCIAL';
    const secondaryTypes = sortedTypes.slice(1, 3);
    const confidence = sortedTypes.length > 0 ? Math.min(100, scores[primaryType]) : 50;

    return {
      primaryType,
      secondaryTypes,
      confidence,
      signals
    };
  }
}
