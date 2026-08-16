import { NewsSectionId, NewsSectionDefinition, FIXED_NEWS_SECTIONS, normalizeSectionId } from '../types/NewsSection';
import { NewsIntelligenceQualityService } from './NewsIntelligenceQualityService';

export interface SectionRoutingResult {
  primarySection: NewsSectionId;
  secondarySections: NewsSectionId[];
  sectionScores: Record<NewsSectionId, number>;
  reasons: Record<NewsSectionId, string[]>;
}

export interface SectionFeedOptions {
  page?: number;
  limit?: number;
  symbol?: string;
  search?: string;
  date?: string;
  freshness?: string;
  impact?: string;
  fno?: boolean;
}

export interface SectionFeedResult {
  section: NewsSectionId;
  sectionName: string;
  explanation: string;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  articles: any[];
}

// Priority Matrix for Primary Section Selection (Highest precedence first)
const PRIORITY_MATRIX: NewsSectionId[] = [
  NewsSectionId.REGULATORY,
  NewsSectionId.RESULTS,
  NewsSectionId.IPO,
  NewsSectionId.FNO,
  NewsSectionId.ECONOMY,
  NewsSectionId.CORPORATE,
  NewsSectionId.COMMODITIES,
  NewsSectionId.GLOBAL,
  NewsSectionId.TECHNOLOGY,
  NewsSectionId.BANKING,
  NewsSectionId.EXCHANGE,
  NewsSectionId.SECTORS,
  NewsSectionId.STOCKS,
  NewsSectionId.MACRO,
  NewsSectionId.MARKET,
  NewsSectionId.BREAKING, // BREAKING is primarily an urgency overlay
];

export class NewsSectionRouter {
  /**
   * Deterministically routes a canonical news article to its primary and secondary sections.
   */
  public static routeArticle(article: any): SectionRoutingResult {
    if (!article) {
      return this.getFallbackRouting();
    }

    const text = `${article.headline || article.title || ''} ${article.summary || article.description || ''} ${article.body || article.cleanBody || ''}`.toLowerCase();
    const headlineLower = (article.headline || article.title || '').toLowerCase();
    const categoryLower = (article.primaryCategory || article.category || '').toLowerCase();
    const publisherVal = typeof article.publisher === 'string' 
      ? article.publisher 
      : (article.publisher?.name || (typeof article.source === 'string' ? article.source : (article.source?.name || '')));
    const publisherLower = String(publisherVal).toLowerCase();

    // Symbols & Companies
    const tickers: string[] = (article.tickers || []).map((t: any) => String(t).toUpperCase());
    const companies: any[] = article.companies || [];
    const companySymbols = companies.map((c: any) => (c.ticker || c.symbol || '').toUpperCase()).filter(Boolean);
    const allSymbols = Array.from(new Set([...tickers, ...companySymbols]));

    // Sectors
    const articleSectors: string[] = (article.sectors || []).map((s: any) => String(s).toLowerCase());

    // Stage 5 Enriched attributes
    const enriched = article.intelligence || NewsIntelligenceQualityService.enrich(article);
    const isFnO = !!(article.isFnO || article.isFO || article.fno?.eligible || enriched.fnoRelevance > 40);

    const scores: Record<NewsSectionId, number> = {
      [NewsSectionId.BREAKING]: 0,
      [NewsSectionId.MARKET]: 0,
      [NewsSectionId.RESULTS]: 0,
      [NewsSectionId.FNO]: 0,
      [NewsSectionId.ECONOMY]: 0,
      [NewsSectionId.CORPORATE]: 0,
      [NewsSectionId.IPO]: 0,
      [NewsSectionId.REGULATORY]: 0,
      [NewsSectionId.EXCHANGE]: 0,
      [NewsSectionId.COMMODITIES]: 0,
      [NewsSectionId.GLOBAL]: 0,
      [NewsSectionId.TECHNOLOGY]: 0,
      [NewsSectionId.BANKING]: 0,
      [NewsSectionId.SECTORS]: 0,
      [NewsSectionId.STOCKS]: 0,
      [NewsSectionId.MACRO]: 0,
    };

    const reasons: Record<NewsSectionId, string[]> = {
      [NewsSectionId.BREAKING]: [],
      [NewsSectionId.MARKET]: [],
      [NewsSectionId.RESULTS]: [],
      [NewsSectionId.FNO]: [],
      [NewsSectionId.ECONOMY]: [],
      [NewsSectionId.CORPORATE]: [],
      [NewsSectionId.IPO]: [],
      [NewsSectionId.REGULATORY]: [],
      [NewsSectionId.EXCHANGE]: [],
      [NewsSectionId.COMMODITIES]: [],
      [NewsSectionId.GLOBAL]: [],
      [NewsSectionId.TECHNOLOGY]: [],
      [NewsSectionId.BANKING]: [],
      [NewsSectionId.SECTORS]: [],
      [NewsSectionId.STOCKS]: [],
      [NewsSectionId.MACRO]: [],
    };

    // 1. BREAKING
    if (article.isBreaking || enriched.urgency === 'BREAKING' || enriched.alertPriority === 'P1_CRITICAL') {
      scores[NewsSectionId.BREAKING] += 85;
      reasons[NewsSectionId.BREAKING].push('Breaking or P1 critical urgency flag');
    }
    if (/\b(breaking|flash|just in|emergency|urgent alert)\b/.test(text)) {
      scores[NewsSectionId.BREAKING] += 40;
      reasons[NewsSectionId.BREAKING].push('Breaking keyword detected in text');
    }

    // 2. RESULTS
    if (categoryLower === 'results' || categoryLower === 'earnings') {
      scores[NewsSectionId.RESULTS] += 80;
      reasons[NewsSectionId.RESULTS].push('Category matched Earnings/Results');
    }
    if (/\b(q1|q2|q3|q4|quarterly results|net profit|pat|pbt|ebitda|profit rises|profit falls|profit jumps|profit dips|revenue grows|revenue up|revenue down|financial results|earnings|dividend declared)\b/.test(headlineLower)) {
      scores[NewsSectionId.RESULTS] += 70;
      reasons[NewsSectionId.RESULTS].push('Headline contains earnings/quarterly results indicators');
    } else if (/\b(quarterly results|net profit|ebitda|pat|q1|q2|q3|q4)\b/.test(text)) {
      scores[NewsSectionId.RESULTS] += 35;
      reasons[NewsSectionId.RESULTS].push('Body text contains financial results mentions');
    }

    // 3. REGULATORY
    if (categoryLower === 'regulatory') {
      scores[NewsSectionId.REGULATORY] += 80;
      reasons[NewsSectionId.REGULATORY].push('Category matched Regulatory');
    }
    if (/\b(sebi|rbi|cci|irdai|pfrda)\b/.test(publisherLower)) {
      scores[NewsSectionId.REGULATORY] += 75;
      reasons[NewsSectionId.REGULATORY].push('Official regulator publisher source');
    }
    if (/\b(sebi|rbi|circular|regulatory|compliance|penalty|framework|mandate|ban|margin rule|weekly options expiry|surveillance measure)\b/.test(text)) {
      scores[NewsSectionId.REGULATORY] += 55;
      reasons[NewsSectionId.REGULATORY].push('Regulatory entity or circular keywords detected');
    }

    // 4. IPO
    if (categoryLower === 'ipo') {
      scores[NewsSectionId.IPO] += 85;
      reasons[NewsSectionId.IPO].push('Category matched IPO');
    }
    if (/\b(ipo|initial public offer|drhp|rhp|prospectus|anchor investor|allotment|grey market|gmp|listing price|issue opens|issue closes|subscribed)\b/.test(text)) {
      scores[NewsSectionId.IPO] += 65;
      reasons[NewsSectionId.IPO].push('IPO prospectus or allotment keywords detected');
    }

    // 5. FNO
    if (categoryLower === 'f&o' || categoryLower === 'fno' || categoryLower === 'derivatives') {
      scores[NewsSectionId.FNO] += 80;
      reasons[NewsSectionId.FNO].push('Category matched F&O');
    }
    if (isFnO) {
      scores[NewsSectionId.FNO] += 40;
      reasons[NewsSectionId.FNO].push('F&O eligible symbol or high derivatives relevance');
    }
    if (/\b(call option|put option|ce bias|pe bias|implied volatility|iv|open interest|oi|banknifty|nifty|expiry|strike price|derivatives|short covering|long unwinding)\b/.test(text)) {
      scores[NewsSectionId.FNO] += 45;
      reasons[NewsSectionId.FNO].push('Options and derivatives trading metrics mentioned');
    }

    // 6. ECONOMY
    if (categoryLower === 'economy') {
      scores[NewsSectionId.ECONOMY] += 80;
      reasons[NewsSectionId.ECONOMY].push('Category matched Economy');
    }
    if (/\b(rbi|pib|mospi)\b/.test(publisherLower)) {
      scores[NewsSectionId.ECONOMY] += 40;
      reasons[NewsSectionId.ECONOMY].push('Macro institution publisher');
    }
    if (/\b(gdp|cpi|wpi|inflation|repo rate|monetary policy|fiscal deficit|trade balance|iip|industrial production|gst collection|economic growth|tax revenue)\b/.test(text)) {
      scores[NewsSectionId.ECONOMY] += 55;
      reasons[NewsSectionId.ECONOMY].push('Macroeconomic indicator terms identified');
    }

    // 7. CORPORATE
    if (categoryLower === 'corporate' || categoryLower === 'corporate action') {
      scores[NewsSectionId.CORPORATE] += 75;
      reasons[NewsSectionId.CORPORATE].push('Category matched Corporate');
    }
    if (/\b(acquisition|merger|demerger|stake sale|joint venture|order win|contract win|board meeting|buyback|rights issue|capex|plant setup|ceo|md & ceo|resignation|appointment|restructuring|fund raise|debenture)\b/.test(text)) {
      scores[NewsSectionId.CORPORATE] += 50;
      reasons[NewsSectionId.CORPORATE].push('Corporate action, management, or M&A keywords detected');
    }

    // 8. BANKING
    if (categoryLower === 'banking') {
      scores[NewsSectionId.BANKING] += 80;
      reasons[NewsSectionId.BANKING].push('Category matched Banking');
    }
    if (articleSectors.some(s => s.includes('bank') || s.includes('financial'))) {
      scores[NewsSectionId.BANKING] += 45;
      reasons[NewsSectionId.BANKING].push('Sector mapped to Banking & Financials');
    }
    if (allSymbols.some(sym => ['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'BANKNIFTY', 'PNB', 'BANKBARODA', 'INDUSINDBK'].includes(sym))) {
      scores[NewsSectionId.BANKING] += 50;
      reasons[NewsSectionId.BANKING].push('Primary banking ticker identified');
    }
    if (/\b(bank|banking|npa|net interest margin|nim|credit growth|deposit growth|bad loans|provision coverage)\b/.test(text)) {
      scores[NewsSectionId.BANKING] += 30;
      reasons[NewsSectionId.BANKING].push('Banking sector metric keywords mentioned');
    }

    // 9. TECHNOLOGY
    if (categoryLower === 'technology' || categoryLower === 'it') {
      scores[NewsSectionId.TECHNOLOGY] += 80;
      reasons[NewsSectionId.TECHNOLOGY].push('Category matched Technology');
    }
    if (articleSectors.some(s => s.includes('tech') || s.includes('information') || s.includes('software'))) {
      scores[NewsSectionId.TECHNOLOGY] += 50;
      reasons[NewsSectionId.TECHNOLOGY].push('Sector mapped to IT & Technology');
    }
    if (allSymbols.some(sym => ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'COFORGE', 'PERSISTENT'].includes(sym))) {
      scores[NewsSectionId.TECHNOLOGY] += 55;
      reasons[NewsSectionId.TECHNOLOGY].push('Primary IT company ticker identified');
    }
    if (/\b(it services|software|artificial intelligence|ai|saas|cloud|digital transformation|attrition|deal win)\b/.test(text)) {
      scores[NewsSectionId.TECHNOLOGY] += 30;
      reasons[NewsSectionId.TECHNOLOGY].push('Tech industry terms detected');
    }

    // 10. COMMODITIES
    if (categoryLower === 'commodities' || categoryLower === 'commodity') {
      scores[NewsSectionId.COMMODITIES] += 85;
      reasons[NewsSectionId.COMMODITIES].push('Category matched Commodities');
    }
    if (/\b(crude oil|brent|gold|silver|copper|aluminum|zinc|natural gas|bullion|agri commodities|opec|mcx)\b/.test(text)) {
      scores[NewsSectionId.COMMODITIES] += 60;
      reasons[NewsSectionId.COMMODITIES].push('Commodities pricing or MCX benchmark mentions');
    }

    // 11. GLOBAL
    if (categoryLower === 'global' || categoryLower === 'international') {
      scores[NewsSectionId.GLOBAL] += 80;
      reasons[NewsSectionId.GLOBAL].push('Category matched Global');
    }
    if (publisherLower.includes('reuters') || publisherLower.includes('bloomberg')) {
      scores[NewsSectionId.GLOBAL] += 25;
      reasons[NewsSectionId.GLOBAL].push('Global news agency publisher');
    }
    if (/\b(fed|federal reserve|wall street|nasdaq|dow jones|s&p 500|us inflation|asia markets|nikkei|hang seng|ecb|bank of japan|geopolitical|china|us dollar|dxy)\b/.test(text)) {
      scores[NewsSectionId.GLOBAL] += 55;
      reasons[NewsSectionId.GLOBAL].push('Global market benchmark or central bank mentions');
    }

    // 12. EXCHANGE
    if (categoryLower === 'exchange') {
      scores[NewsSectionId.EXCHANGE] += 85;
      reasons[NewsSectionId.EXCHANGE].push('Category matched Exchange');
    }
    if (/\b(nse|bse|nse india|bse india)\b/.test(publisherLower) || article.isExchange) {
      scores[NewsSectionId.EXCHANGE] += 70;
      reasons[NewsSectionId.EXCHANGE].push('Official exchange source');
    }
    if (/\b(nse|bse|exchange circular|asm list|gsm list|block deal|bulk deal|trading window|circuit limit|surveillance measure)\b/.test(text)) {
      scores[NewsSectionId.EXCHANGE] += 40;
      reasons[NewsSectionId.EXCHANGE].push('Exchange surveillance or transaction notices mentioned');
    }

    // 13. MARKET
    if (categoryLower === 'market' || categoryLower === 'markets') {
      scores[NewsSectionId.MARKET] += 75;
      reasons[NewsSectionId.MARKET].push('Category matched Market');
    }
    if (/\b(nifty|sensex|banknifty|market closes|market opens|gains|loses|rallies|plunges|bulls|bears|midcap|smallcap|fii|dii|institutional flow)\b/.test(headlineLower)) {
      scores[NewsSectionId.MARKET] += 50;
      reasons[NewsSectionId.MARKET].push('Market benchmark/index trend in headline');
    }

    // 14. SECTORS
    if (categoryLower === 'sectors' || categoryLower === 'sector') {
      scores[NewsSectionId.SECTORS] += 75;
      reasons[NewsSectionId.SECTORS].push('Category matched Sectors');
    }
    if (/\b(auto sector|pharma sector|metal stocks|realty index|fmcg sector|chemical industry|power sector|defence stocks|it sector)\b/.test(text)) {
      scores[NewsSectionId.SECTORS] += 50;
      reasons[NewsSectionId.SECTORS].push('Industry or sector index trend mentions');
    }

    // 15. STOCKS
    if (allSymbols.length > 0 && allSymbols.length <= 3) {
      scores[NewsSectionId.STOCKS] += 50;
      reasons[NewsSectionId.STOCKS].push(`Specific company tickers referenced (${allSymbols.slice(0, 3).join(', ')})`);
    }
    if (categoryLower === 'stocks' || categoryLower === 'equities') {
      scores[NewsSectionId.STOCKS] += 65;
      reasons[NewsSectionId.STOCKS].push('Category matched Stocks');
    }

    // 16. MACRO
    if (categoryLower === 'macro' || categoryLower === 'forex' || categoryLower === 'global macro') {
      scores[NewsSectionId.MACRO] += 80;
      reasons[NewsSectionId.MACRO].push('Category matched Macro');
    }
    if (/\b(us dollar|dxy|inr|rupee|sovereign rating|yield curve|bond yields|forex reserves|trade deficit|central bank policy|fed|treasury|us treasury)\b/.test(text)) {
      scores[NewsSectionId.MACRO] += 55;
      reasons[NewsSectionId.MACRO].push('Macro structural indicator terms detected');
    }

    // Determine Primary Section
    // Rule: Exclude BREAKING from primary selection if any topic section has score >= 35,
    // because BREAKING is an urgency overlay!
    const candidateSections = Object.keys(scores) as NewsSectionId[];
    const nonBreakingCandidates = candidateSections.filter(s => s !== NewsSectionId.BREAKING);
    
    let bestPrimarySection: NewsSectionId = NewsSectionId.MARKET; // Default fallback
    let maxScore = -1;

    for (const section of nonBreakingCandidates) {
      const score = scores[section];
      if (score > maxScore) {
        maxScore = score;
        bestPrimarySection = section;
      } else if (score === maxScore && score > 0) {
        // Tie-breaker using Priority Matrix
        const currentBestIdx = PRIORITY_MATRIX.indexOf(bestPrimarySection);
        const newCandidateIdx = PRIORITY_MATRIX.indexOf(section);
        if (newCandidateIdx < currentBestIdx) {
          bestPrimarySection = section;
        }
      }
    }

    // If no topic section reached a score >= 20 and BREAKING score is very high, allow BREAKING
    if (maxScore < 20 && scores[NewsSectionId.BREAKING] >= 80) {
      bestPrimarySection = NewsSectionId.BREAKING;
    }

    // Determine Secondary Sections (Evidence-based, score >= 35 or specific rules)
    const secondarySections: NewsSectionId[] = [];
    for (const section of candidateSections) {
      if (section === bestPrimarySection) continue;

      const score = scores[section];
      if (score >= 35) {
        secondarySections.push(section);
      } else if (section === NewsSectionId.BREAKING && (article.isBreaking || enriched.urgency === 'BREAKING')) {
        secondarySections.push(NewsSectionId.BREAKING);
      } else if (section === NewsSectionId.FNO && isFnO && !secondarySections.includes(NewsSectionId.FNO)) {
        secondarySections.push(NewsSectionId.FNO);
      } else if (section === NewsSectionId.STOCKS && allSymbols.length > 0 && !secondarySections.includes(NewsSectionId.STOCKS)) {
        secondarySections.push(NewsSectionId.STOCKS);
      }
    }

    // Deduplicate secondary sections
    const uniqueSecondary = Array.from(new Set(secondarySections)).filter(s => s !== bestPrimarySection);

    return {
      primarySection: bestPrimarySection,
      secondarySections: uniqueSecondary,
      sectionScores: scores,
      reasons
    };
  }

  /**
   * Ranks and paginates articles for a specific section using section-specific weighting policy.
   */
  public static getSectionFeed(
    allArticles: any[],
    sectionIdInput: string,
    options: SectionFeedOptions = {}
  ): SectionFeedResult {
    const sectionId = normalizeSectionId(sectionIdInput) || NewsSectionId.MARKET;
    const def = FIXED_NEWS_SECTIONS[sectionId];

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));

    // 1. Filter articles that belong to this section (Primary OR Secondary)
    let sectionArticles = allArticles.filter(art => {
      const routed = art.sectionRouting || this.routeArticle(art);
      return routed.primarySection === sectionId || routed.secondarySections.includes(sectionId);
    });

    // 2. Apply optional filters
    if (options.symbol && options.symbol.trim().length > 0) {
      const sym = options.symbol.trim().toUpperCase();
      sectionArticles = sectionArticles.filter(a => {
        const tickers = (a.tickers || []).map((t: any) => String(t).toUpperCase());
        const companyTickers = (a.companies || []).map((c: any) => String(c.ticker || c.symbol || '').toUpperCase());
        return tickers.includes(sym) || companyTickers.includes(sym) || a.symbol?.toUpperCase() === sym;
      });
    }

    if (options.search && options.search.trim().length > 0) {
      const q = options.search.trim().toLowerCase();
      sectionArticles = sectionArticles.filter(a => {
        const text = `${a.headline || a.title || ''} ${a.summary || a.description || ''} ${a.publisher || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    if (options.impact) {
      const imp = options.impact.toUpperCase();
      sectionArticles = sectionArticles.filter(a => {
        const enriched = a.intelligence || NewsIntelligenceQualityService.enrich(a);
        return enriched.marketImpact === imp || a.sentiment === imp;
      });
    }

    if (options.fno) {
      sectionArticles = sectionArticles.filter(a => !!(a.isFnO || a.isFO || a.fno?.eligible));
    }

    // 3. Section-Specific Ranking
    const rankedArticles = sectionArticles.map(art => {
      const routed = art.sectionRouting || this.routeArticle(art);
      const enriched = art.intelligence || NewsIntelligenceQualityService.enrich(art);
      
      const rankScore = this.calculateSectionRankScore(art, sectionId, routed, enriched);
      return { article: art, rankScore, routed, enriched };
    });

    // Sort descending by rankScore, then by timestamp
    rankedArticles.sort((a, b) => {
      if (Math.abs(b.rankScore - a.rankScore) > 0.1) {
        return b.rankScore - a.rankScore;
      }
      const timeA = new Date(a.article.publishedAt || 0).getTime();
      const timeB = new Date(b.article.publishedAt || 0).getTime();
      return timeB - timeA;
    });

    // Extract sorted articles and attach routing metadata
    const finalArticles = rankedArticles.map(item => ({
      ...item.article,
      primarySection: item.routed.primarySection,
      secondarySections: item.routed.secondarySections,
      sectionScores: item.routed.sectionScores,
      intelligence: item.enriched,
      sectionRankScore: Math.round(item.rankScore)
    }));

    const totalCount = finalArticles.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const startIndex = (page - 1) * limit;
    const paginated = (page >= 1 && page <= totalPages && startIndex < totalCount)
      ? finalArticles.slice(startIndex, startIndex + limit)
      : [];

    return {
      section: sectionId,
      sectionName: def.name,
      explanation: def.explanation,
      totalCount,
      page,
      limit,
      totalPages,
      articles: paginated
    };
  }

  /**
   * Calculates section-specific ranking score based on Section Ranking Policy.
   */
  private static calculateSectionRankScore(
    article: any,
    sectionId: NewsSectionId,
    routed: SectionRoutingResult,
    enriched: any
  ): number {
    const freshnessScore = enriched.freshnessScore || 100;
    const sourceAuthority = article.providerRating || article.qualityScore || 90;
    const impactScore = enriched.marketImpact === 'HIGH' ? 100 : enriched.marketImpact === 'MEDIUM' ? 60 : 30;
    const urgencyScore = enriched.urgency === 'BREAKING' ? 100 : enriched.urgency === 'HIGH' ? 70 : 30;
    const fnoScore = enriched.fnoRelevance || (article.isFnO || article.isFO ? 90 : 20);

    let score = 0;

    switch (sectionId) {
      case NewsSectionId.BREAKING:
        score = (urgencyScore * 0.35) + (freshnessScore * 0.30) + (impactScore * 0.20) + (sourceAuthority * 0.15);
        break;
      case NewsSectionId.RESULTS:
        const resultsMatch = routed.sectionScores[NewsSectionId.RESULTS] || 50;
        score = (resultsMatch * 0.35) + (freshnessScore * 0.25) + (impactScore * 0.20) + (fnoScore * 0.20);
        break;
      case NewsSectionId.FNO:
        score = (fnoScore * 0.40) + (impactScore * 0.25) + (freshnessScore * 0.20) + (sourceAuthority * 0.15);
        break;
      case NewsSectionId.ECONOMY:
      case NewsSectionId.MACRO:
        const macroMatch = routed.sectionScores[sectionId] || 50;
        score = (macroMatch * 0.35) + (impactScore * 0.25) + (sourceAuthority * 0.20) + (freshnessScore * 0.20);
        break;
      case NewsSectionId.REGULATORY:
      case NewsSectionId.EXCHANGE:
        const regMatch = routed.sectionScores[sectionId] || 50;
        score = (sourceAuthority * 0.35) + (regMatch * 0.30) + (freshnessScore * 0.20) + (impactScore * 0.15);
        break;
      case NewsSectionId.CORPORATE:
      case NewsSectionId.IPO:
      case NewsSectionId.STOCKS:
        const corpMatch = routed.sectionScores[sectionId] || 50;
        score = (corpMatch * 0.35) + (freshnessScore * 0.30) + (sourceAuthority * 0.20) + (impactScore * 0.15);
        break;
      default:
        const genMatch = routed.sectionScores[sectionId] || 50;
        score = (genMatch * 0.30) + (impactScore * 0.30) + (freshnessScore * 0.25) + (sourceAuthority * 0.15);
        break;
    }

    return score;
  }

  private static getFallbackRouting(): SectionRoutingResult {
    const scores = Object.values(NewsSectionId).reduce((acc, sec) => {
      acc[sec] = 0;
      return acc;
    }, {} as Record<NewsSectionId, number>);

    const reasons = Object.values(NewsSectionId).reduce((acc, sec) => {
      acc[sec] = [];
      return acc;
    }, {} as Record<NewsSectionId, string[]>);

    return {
      primarySection: NewsSectionId.MARKET,
      secondarySections: [],
      sectionScores: scores,
      reasons
    };
  }
}
