import { CompanyMasterDatabase } from './CompanyMasterDatabase';
import { IntelligenceAnalyzer } from './IntelligenceAnalyzer';
import { FinancialFactExtractor } from '../FinancialSummaryEngine/FinancialFactExtractor';

export interface KeyFacts {
  revenue?: string;
  pat?: string;
  eps?: string;
  ebitda?: string;
  margin?: string;
  guidance?: string;
  dividend?: string;
  orderBook?: string;
  loanGrowth?: string;
  npa?: string;
  deposits?: string;
  aum?: string;
  repoRate?: string;
  gdp?: string;
  cpi?: string;
  wpi?: string;
  iip?: string;
  pmi?: string;
  tradeBalance?: string;
  forex?: string;
  fiscalDeficit?: string;
  acquisition?: string;
  merger?: string;
  boardMeeting?: string;
  managementChange?: string;
  capex?: string;
  ipo?: string;
  stakeSale?: string;
  buyback?: string;
  [key: string]: any;
}

export interface MarketImpact {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  reasoning: string;
}

export interface AffectedAssets {
  stocks?: string[];
  indices?: string[];
  sectors?: string[];
  commodities?: string[];
  currencies?: string[];
  crypto?: string[];
}

export interface IntelligenceObject {
  executiveSummary: string;
  keyFacts: KeyFacts;
  marketImpact: MarketImpact;
  impactScore: number;
  confidence: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedAssets: AffectedAssets;
  participants: string[];
  whyItMatters: string;
  risks: string[];
  opportunities: string[];
  historicalContext?: string;
  aiTags: string[];
  followUp: string[];
}

export class IntelligenceEngine {
  private static instance: IntelligenceEngine;

  private constructor() {}

  public static getInstance(): IntelligenceEngine {
    if (!IntelligenceEngine.instance) {
      IntelligenceEngine.instance = new IntelligenceEngine();
    }
    return IntelligenceEngine.instance;
  }

  /**
   * Generates the Single Source of Truth IntelligenceObject for any article or news item.
   */
  public generate(article: any): IntelligenceObject {
    const headline = (article.headline || article.title || article.name || '').trim();
    const body = (article.body || article.cleanText || article.description || article.summary || article.content || '').trim();
    const text = `${headline} ${body}`;
    const publisherStr = typeof article.publisher === 'string' ? article.publisher 
                       : (typeof article.source === 'object' && article.source?.publisher) ? article.source.publisher
                       : typeof article.source === 'string' ? article.source 
                       : "";
    const publisher = (publisherStr || "").trim();
    const category = (article.category || article.primaryCategory || '').trim();

    // 1. Symbol & Entity Resolution
    const resolvedEntities = this.resolveEntities(headline, text, article);

    // 2. Extract Key Facts (Earnings, Economic, Corporate)
    const keyFacts = this.extractKeyFacts(text, category);

    // 3. Market Impact & Dynamic Impact Score
    const { marketImpact, impactScore } = this.calculateImpactAndScore(headline, text, keyFacts, resolvedEntities, category);

    // 4. Dynamic Confidence Score
    const confidence = this.calculateConfidence(publisher, text, keyFacts, marketImpact);

    // 5. Urgency Level
    const urgency = this.determineUrgency(impactScore, headline, text);

    // 6. Affected Assets
    const affectedAssets = this.extractAffectedAssets(text, resolvedEntities, category);

    // 7. Who May Benefit (Relevant Market Participants)
    const participants = this.determineParticipants(marketImpact, impactScore, category, affectedAssets, text);

    // 8. Executive Summary
    const executiveSummary = this.generateExecutiveSummary(headline, text, resolvedEntities, keyFacts, marketImpact);

    // 9. Why It Matters
    const whyItMatters = this.generateWhyItMatters(headline, text, resolvedEntities, keyFacts, marketImpact, category);

    // 10. Risks & Opportunities
    const { risks, opportunities } = this.generateRisksAndOpportunities(headline, text, keyFacts, marketImpact, category);

    // 11. Historical Context
    const historicalContext = this.generateHistoricalContext(text, keyFacts);

    // 12. AI Tags
    const aiTags = this.generateAITags(category, headline, text, resolvedEntities, keyFacts);

    // 13. Suggested Follow-up Actions
    const followUp = this.generateFollowUp(category, headline, text, keyFacts);

    return {
      executiveSummary,
      keyFacts,
      marketImpact,
      impactScore,
      confidence,
      urgency,
      affectedAssets,
      participants,
      whyItMatters,
      risks,
      opportunities,
      historicalContext,
      aiTags,
      followUp
    };
  }

  private resolveEntities(headline: string, text: string, article: any): { symbol: string; companyName: string; isNifty50: boolean } {
    let symbol = (article.symbol || article.ticker || '').toUpperCase();
    let companyName = article.company || '';

    const upperText = `${headline} ${text}`.toUpperCase();

    if (!symbol || symbol === 'NONE') {
      for (const record of CompanyMasterDatabase.MASTER_RECORDS) {
        if (upperText.includes(record.symbol.toUpperCase())) {
          symbol = record.symbol;
          companyName = record.name;
          break;
        }
        for (const alias of record.aliases) {
          if (upperText.includes(alias.toUpperCase())) {
            symbol = record.symbol;
            companyName = record.name;
            break;
          }
        }
        if (symbol) break;
      }
    }

    if (!symbol) symbol = 'NIFTY';
    if (!companyName) {
      const record = CompanyMasterDatabase.MASTER_RECORDS.find(r => r.symbol === symbol);
      companyName = record ? record.name : (symbol !== 'NIFTY' ? symbol : 'Market Heavyweights');
    }

    const nifty50Symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'BHARTIARTL', 'ITC', 'SBIN', 'LTIM', 'LT', 'AXISBANK', 'KOTAKBANK', 'HINDUNILVR', 'TATAMOTORS', 'TATASTEEL', 'BAJFINANCE', 'MARUTI', 'SUNPHARMA', 'NTPC', 'ONGC', 'POWERGRID', 'ADANIENT', 'ADANIPORTS', 'TITAN', 'ULTRACEMCO', 'M&M', 'ASIANPAINT', 'COALINDIA', 'BAJAJFINSV', 'NESTLEIND', 'JSWSTEEL', 'TECHM', 'GRASIM', 'HCLTECH', 'BEL', 'CIPLA', 'HEROMOTOCO', 'EICHERMOT', 'BPCL', 'TATACONSUM', 'BRITANNIA', 'APOLLOHOSP', 'DIVISLAB', 'DRREDDY', 'SBILIFE', 'HDFCLIFE', 'BAJAJ-AUTO', 'INDUSINDBK', 'SHRIRAMFIN', 'TRENT'];
    const isNifty50 = nifty50Symbols.includes(symbol);

    return { symbol, companyName, isNifty50 };
  }

  private extractKeyFacts(text: string, category: string): KeyFacts {
    const keyFacts: KeyFacts = {};

    // 1. Earnings Extraction
    const earnings = IntelligenceAnalyzer.extractEarnings(text);
    if (earnings) {
      if (earnings.revenue) keyFacts.revenue = earnings.revenue;
      if (earnings.pat) keyFacts.pat = earnings.pat;
      if (earnings.ebitda) keyFacts.ebitda = earnings.ebitda;
      if (earnings.orderBook) keyFacts.orderBook = earnings.orderBook;
      if (earnings.guidance) keyFacts.guidance = earnings.guidance;
    }

    // Direct Regex Fallback for Earnings
    if (!keyFacts.revenue) {
      const match = text.match(/(?:revenue|sales)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)\s?(?:cr|crore|bn|billion|mn|million)/i);
      if (match) keyFacts.revenue = match[0];
    }
    if (!keyFacts.pat) {
      const match = text.match(/(?:pat|net profit|profit after tax)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)\s?(?:cr|crore|bn|billion|mn|million)/i);
      if (match) keyFacts.pat = match[0];
    }
    if (!keyFacts.margin) {
      const match = text.match(/(?:ebitda margin|operating margin|margin)(?:[\s\w]*?)(\d+(?:\.\d+)?%)/i);
      if (match) keyFacts.margin = match[0];
    }
    if (!keyFacts.eps) {
      const match = text.match(/(?:eps|earnings per share)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)/i);
      if (match) keyFacts.eps = match[0];
    }
    if (!keyFacts.dividend) {
      const match = text.match(/(?:dividend)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)\s?(?:per share|%)/i);
      if (match) keyFacts.dividend = match[0];
    }

    // 2. Economic News Extraction
    if (text.match(/repo rate|monetary policy|rbi/i)) {
      const repoMatch = text.match(/(?:repo rate)(?:[\s\w]*?)(\d+(?:\.\d+)?%)/i);
      if (repoMatch) keyFacts.repoRate = repoMatch[1];
    }
    if (text.match(/gdp/i)) {
      const gdpMatch = text.match(/(?:gdp)(?:[\s\w]*?)(\d+(?:\.\d+)?%)/i);
      if (gdpMatch) keyFacts.gdp = gdpMatch[1];
    }
    if (text.match(/cpi|inflation/i)) {
      const cpiMatch = text.match(/(?:cpi|inflation)(?:[\s\w]*?)(\d+(?:\.\d+)?%)/i);
      if (cpiMatch) keyFacts.cpi = cpiMatch[1];
    }
    if (text.match(/pmi/i)) {
      const pmiMatch = text.match(/(?:pmi)(?:[\s\w]*?)(\d+(?:\.\d+)?)/i);
      if (pmiMatch) keyFacts.pmi = pmiMatch[1];
    }
    if (text.match(/forex|reserves/i)) {
      const forexMatch = text.match(/(?:forex reserves)(?:[\s\w]*?)(?:₹|\$)\s?(\d+(?:\.\d+)?)\s?(?:billion|bn|million|mn)/i);
      if (forexMatch) keyFacts.forex = forexMatch[0];
    }

    // 3. Corporate Action Extraction
    if (text.match(/acquisition|acquire|bought/i)) {
      const acqMatch = text.match(/(?:acquisition|acquire)(?:[\s\w]*?)(?:for|at)\s?(?:₹|\$)\s?(\d+(?:\.\d+)?)\s?(?:cr|crore|bn|billion|mn|million)/i);
      if (acqMatch) keyFacts.acquisition = acqMatch[0];
    }
    if (text.match(/ipo|initial public offer/i)) {
      const ipo = IntelligenceAnalyzer.extractIPO(text);
      if (ipo) {
        if (ipo.issuePrice) keyFacts.ipo = `Issue Price: ${ipo.issuePrice}`;
        if (ipo.issueSize) keyFacts.ipo = `${keyFacts.ipo || 'IPO'} (Size: ${ipo.issueSize})`;
      }
    }
    if (text.match(/capex|capital expenditure/i)) {
      const capexMatch = text.match(/(?:capex|capital expenditure)(?:[\s\w]*?)(?:₹|\$)\s?(\d+(?:\.\d+)?)\s?(?:cr|crore|bn|billion)/i);
      if (capexMatch) keyFacts.capex = capexMatch[0];
    }

    return keyFacts;
  }

  private calculateImpactAndScore(
    headline: string,
    text: string,
    keyFacts: KeyFacts,
    entities: { symbol: string; companyName: string; isNifty50: boolean },
    category: string
  ): { marketImpact: MarketImpact; impactScore: number } {
    const upperText = `${headline} ${text}`.toUpperCase();

    // Bullish signals
    const bullishKeywords = ['SURGE', 'JUMP', 'BEAT', 'HIGHER', 'APPROVAL', 'GROWTH', 'GAIN', 'RECORD', 'RALLY', 'BOOST', 'ORDER WIN', 'EXPANDS', 'OUTPERFORM', 'DIVIDEND', 'PROFIT RISES', 'REVENUE UP'];
    // Bearish signals
    const bearishKeywords = ['FALL', 'DROP', 'SLIP', 'MISS', 'PENALTY', 'CUT', 'LOSS', 'PROBE', 'CRASH', 'DOWNGRADE', 'WARNING', 'INVESTIGATION', 'DEFAULT', 'FRAUD', 'PLUNGE', 'PROFIT FALLS', 'SLUMPS'];

    let bullishCount = 0;
    let bearishCount = 0;

    bullishKeywords.forEach(k => { if (upperText.includes(k)) bullishCount++; });
    bearishKeywords.forEach(k => { if (upperText.includes(k)) bearishCount++; });

    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' = 'NEUTRAL';
    if (bullishCount > 0 && bearishCount === 0) direction = 'BULLISH';
    else if (bearishCount > 0 && bullishCount === 0) direction = 'BEARISH';
    else if (bullishCount > 0 && bearishCount > 0) direction = 'MIXED';

    // Generate accurate, non-generic reasoning
    let reasoning = '';
    if (direction === 'BULLISH') {
      if (keyFacts.pat || keyFacts.revenue) {
        reasoning = `Positive financial momentum evidenced by ${keyFacts.pat ? `PAT of ${keyFacts.pat}` : ''} ${keyFacts.revenue ? `and Revenue of ${keyFacts.revenue}` : ''}.`;
      } else if (keyFacts.orderBook) {
        reasoning = `Significant order book expansion (${keyFacts.orderBook}).`;
      } else {
        reasoning = `Favorable announcement for ${entities.companyName}.`;
      }
    } else if (direction === 'BEARISH') {
      if (keyFacts.pat || keyFacts.guidance) {
        reasoning = `Underperformance in earnings or guidance cut (${keyFacts.pat || keyFacts.guidance}).`;
      } else {
        reasoning = `Adverse operational update for ${entities.companyName}.`;
      }
    } else if (direction === 'MIXED') {
      reasoning = `Mixed operational signals.`;
    } else {
      reasoning = `Routine operational disclosure.`;
    }

    // Dynamic Impact Score Calculation (Scale 0-100. NEVER default to 55!)
    let baseScore = 35; // Default baseline for routine corporate update

    if (upperText.includes('UNION BUDGET') || upperText.includes('BUDGET 202')) {
      baseScore = 100;
    } else if (upperText.includes('RBI POLICY') || upperText.includes('REPO RATE') || upperText.includes('MONETARY POLICY')) {
      baseScore = 98;
    } else if (upperText.includes('FED') || upperText.includes('FOMC') || upperText.includes('US INFLATION')) {
      baseScore = 97;
    } else if (entities.isNifty50 && (upperText.includes('Q1') || upperText.includes('Q2') || upperText.includes('Q3') || upperText.includes('Q4') || upperText.includes('EARNINGS') || upperText.includes('PAT'))) {
      baseScore = 90; // e.g. Reliance Earnings Beat
    } else if (upperText.includes('GUIDANCE CUT') || upperText.includes('PROFIT WARNING')) {
      baseScore = 86;
    } else if (upperText.includes('ACQUISITION') || upperText.includes('MERGER') || upperText.includes('BUYOUT')) {
      baseScore = 82;
    } else if (upperText.includes('ORDER WIN') || upperText.includes('CONTRACT') || upperText.includes('DEFENCE')) {
      baseScore = 78;
    } else if (keyFacts.pat || keyFacts.revenue) {
      baseScore = 72;
    } else if (keyFacts.dividend || upperText.includes('DIVIDEND')) {
      baseScore = 42;
    } else if (headline.length < 40) {
      baseScore = 18;
    }

    // Fine-tune score
    if (entities.isNifty50 && baseScore < 85) baseScore += 8;
    if (upperText.includes('SURGE') || upperText.includes('CRASH') || upperText.includes('RECORD')) baseScore += 5;

    const impactScore = Math.min(100, Math.max(5, baseScore));

    return {
      marketImpact: { direction, reasoning },
      impactScore
    };
  }

  private calculateConfidence(publisher: string, text: string, keyFacts: KeyFacts, impact: MarketImpact): number {
    let confidence = 85;

    const pubUpper = publisher.toUpperCase();
    if (pubUpper.includes('NSE') || pubUpper.includes('BSE') || pubUpper.includes('RBI') || pubUpper.includes('SEBI') || pubUpper.includes('GOVERNMENT')) {
      confidence = 98; // Official source
    } else if (pubUpper.includes('ECONOMIC TIMES') || pubUpper.includes('MONEYCONTROL') || pubUpper.includes('REUTERS') || pubUpper.includes('LIVEMINT') || pubUpper.includes('BLOOMBERG')) {
      confidence = 94; // Tier 1 source
    }

    // Bonus for structured extracted facts
    if (Object.keys(keyFacts).length >= 2) confidence += 3;
    if (text.length > 300) confidence += 2;

    // Penalty for mixed ambiguity
    if (impact.direction === 'MIXED') confidence -= 5;

    return Math.min(99, Math.max(65, confidence));
  }

  private determineUrgency(impactScore: number, headline: string, text: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const upper = `${headline} ${text}`.toUpperCase();

    if (impactScore >= 95 || upper.includes('BUDGET') || upper.includes('REPO RATE') || upper.includes('WAR') || upper.includes('HALT')) {
      return 'CRITICAL';
    }
    if (impactScore >= 78) return 'HIGH';
    if (impactScore >= 40) return 'MEDIUM';
    return 'LOW';
  }

  private extractAffectedAssets(text: string, entities: { symbol: string; companyName: string }, category: string): AffectedAssets {
    const stocks: string[] = [];
    const indices: string[] = [];
    const sectors: string[] = [];
    const commodities: string[] = [];
    const currencies: string[] = [];
    const crypto: string[] = [];

    if (entities.symbol && entities.symbol !== 'NIFTY') {
      stocks.push(entities.symbol);
    }

    const upper = text.toUpperCase();

    // Indices
    if (upper.includes('NIFTY')) indices.push('NIFTY 50');
    if (upper.includes('BANK NIFTY') || upper.includes('BANKNIFTY')) indices.push('BANK NIFTY');
    if (upper.includes('SENSEX')) indices.push('BSE SENSEX');

    // Sectors
    if (upper.includes('BANK') || upper.includes('LENDER') || upper.includes('NPA')) sectors.push('Banking & Financials');
    if (upper.includes('DEFENCE') || upper.includes('RADAR') || upper.includes('NAVY')) sectors.push('Defence & Aerospace');
    if (upper.includes('IT ') || upper.includes('SOFTWARE') || upper.includes('TECH')) sectors.push('Information Technology');
    if (upper.includes('AUTO') || upper.includes('VEHICLE') || upper.includes('EV ')) sectors.push('Automobiles');
    if (upper.includes('OIL') || upper.includes('GAS') || upper.includes('REFINERY')) sectors.push('Oil & Gas');
    if (upper.includes('PHARMA') || upper.includes('DRUG') || upper.includes('FDA')) sectors.push('Pharmaceuticals');

    // Commodities
    if (upper.includes('GOLD')) commodities.push('Gold');
    if (upper.includes('SILVER')) commodities.push('Silver');
    if (upper.includes('CRUDE') || upper.includes('BRENT')) commodities.push('Crude Oil');

    // Currencies
    if (upper.includes('RUPEE') || upper.includes('USD/INR') || upper.includes('FOREX')) currencies.push('USD/INR');

    // Crypto
    if (upper.includes('BITCOIN') || upper.includes('BTC')) crypto.push('Bitcoin');
    if (upper.includes('ETHEREUM') || upper.includes('ETH')) crypto.push('Ethereum');

    return {
      stocks: Array.from(new Set(stocks)),
      indices: Array.from(new Set(indices)),
      sectors: Array.from(new Set(sectors)),
      commodities: commodities.length > 0 ? Array.from(new Set(commodities)) : undefined,
      currencies: currencies.length > 0 ? Array.from(new Set(currencies)) : undefined,
      crypto: crypto.length > 0 ? Array.from(new Set(crypto)) : undefined
    };
  }

  private determineParticipants(
    impact: MarketImpact,
    impactScore: number,
    category: string,
    assets: AffectedAssets,
    text: string
  ): string[] {
    const allowed = [
      'Long-term Investors',
      'Swing Traders',
      'Intraday Traders',
      'Options Traders',
      'Futures Traders',
      'Commodity Traders',
      'Currency Traders',
      'Crypto Traders',
      'Mutual Fund Investors',
      'ETF Investors'
    ];

    const result = new Set<string>();

    if (assets.crypto && assets.crypto.length > 0) {
      result.add('Crypto Traders');
      result.add('Swing Traders');
      return Array.from(result);
    }

    if (assets.commodities && assets.commodities.length > 0) {
      result.add('Commodity Traders');
      result.add('Futures Traders');
      result.add('Swing Traders');
      return Array.from(result);
    }

    if (assets.currencies && assets.currencies.length > 0) {
      result.add('Currency Traders');
      result.add('Futures Traders');
      return Array.from(result);
    }

    // High Impact Market Event
    if (impactScore >= 75) {
      result.add('Intraday Traders');
      result.add('Swing Traders');
      result.add('Options Traders');
      result.add('Futures Traders');
      result.add('Long-term Investors');
      result.add('Mutual Fund Investors');
    } else if (impactScore >= 40) {
      result.add('Long-term Investors');
      result.add('Swing Traders');
      result.add('Mutual Fund Investors');
    } else {
      result.add('Long-term Investors');
    }

    return Array.from(result).filter(p => allowed.includes(p));
  }

  private generateExecutiveSummary(
    headline: string,
    text: string,
    entities: { symbol: string; companyName: string },
    keyFacts: KeyFacts,
    impact: MarketImpact
  ): string {
    const company = entities.companyName;

    if (keyFacts.pat || keyFacts.revenue) {
      const patStr = keyFacts.pat ? ` reported Net Profit of ${keyFacts.pat}` : '';
      const revStr = keyFacts.revenue ? ` on Revenue of ${keyFacts.revenue}` : '';
      return `${company}${patStr}${revStr}.`;
    }

    if (keyFacts.orderBook) {
      return `${company} secured major contract wins expanding its active order book to ${keyFacts.orderBook}.`;
    }

    if (keyFacts.repoRate) {
      return `The Reserve Bank of India maintained the Repo Rate at ${keyFacts.repoRate}.`;
    }

    return `${company}: ${headline}.`;
  }

  private generateWhyItMatters(
    headline: string,
    text: string,
    entities: { symbol: string; companyName: string },
    keyFacts: KeyFacts,
    impact: MarketImpact,
    category: string
  ): string {
    return "";
  }

  private generateRisksAndOpportunities(
    headline: string,
    text: string,
    keyFacts: KeyFacts,
    impact: MarketImpact,
    category: string
  ): { risks: string[]; opportunities: string[] } {
    return { risks: [], opportunities: [] };
  }

  private generateHistoricalContext(text: string, keyFacts: KeyFacts): string | undefined {
    return undefined;
  }

  private generateAITags(
    category: string,
    headline: string,
    text: string,
    entities: { symbol: string; companyName: string },
    keyFacts: KeyFacts
  ): string[] {
    const tags = new Set<string>();

    if (entities.symbol && entities.symbol !== 'NIFTY') tags.add(entities.symbol);
    if (category) tags.add(category);

    const upper = `${headline} ${text}`.toUpperCase();

    if (keyFacts.pat || keyFacts.revenue) tags.add('Earnings');
    if (keyFacts.dividend) tags.add('Dividend');
    if (upper.includes('DEFENCE')) tags.add('Defence');
    if (upper.includes('BANK')) tags.add('Banking');
    if (upper.includes('RBI') || upper.includes('FED')) tags.add('Macro');
    if (upper.includes('ORDER WIN')) tags.add('Order Win');
    if (upper.includes('F&O') || upper.includes('NIFTY')) tags.add('F&O');

    return Array.from(tags);
  }

  private generateFollowUp(category: string, headline: string, text: string, keyFacts: KeyFacts): string[] {
    const followUp: string[] = [];

    if (keyFacts.pat || keyFacts.revenue) {
      followUp.push("Monitor management commentary during upcoming post-results conference call.");
      followUp.push("Track institutional brokerages' target price revisions over the next 48 hours.");
    } else if (keyFacts.repoRate) {
      followUp.push("Observe RBI Governor's detailed press conference for liquidity commentary.");
      followUp.push("Track Bank Nifty futures open interest building post-announcement.");
    } else {
      followUp.push("Observe institutional volume trends and FII cash market flows.");
      followUp.push("Track follow-up exchange filings for execution timelines.");
    }

    return followUp;
  }
}
