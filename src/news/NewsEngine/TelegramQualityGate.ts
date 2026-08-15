import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle';
import { FinancialMetricEngine } from '../../newsCoreV2/intelligence/FinancialMetricEngine';
import { FNO_UNIVERSE, findFNOEntityInHeadline } from '../../newsCoreV2/fno/FNOUniverse';

export type QualityGateDecision = 'IMMEDIATE' | 'DIGEST_PENDING' | 'SUPPRESSED' | 'NO_ACTION';
export type QualityGatePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface QualityGateResult {
  decision: QualityGateDecision;
  priority: QualityGatePriority;
  reason: string;
  symbol: string;
  qualityScore: number;
  materialityScore: number;
  companyMatchConfidence: number;
  isGenericCalendar: boolean;
  isDuplicateCluster: boolean;
  optionsImpactSummary: string;
  clusterKey: string;
}

export class TelegramQualityGate {
  private static recentClusterKeys: Map<string, { timestamp: number; articleId: string }> = new Map();

  /**
   * Evaluates an article against production quality standards.
   */
  public static evaluate(
    article: NewsArticleV2,
    options?: {
      watermarkIso?: string;
      circuitBreakerActive?: boolean;
    }
  ): QualityGateResult {
    const headline = (article.headline || '').trim();
    const body = (article.body || '').trim();
    const fullText = `${headline} ${body}`;
    const watermarkTime = options?.watermarkIso ? new Date(options.watermarkIso).getTime() : 0;
    const articleTime = new Date(article.publishedAt || article.collectedAt || Date.now()).getTime();

    // Default result structure
    let decision: QualityGateDecision = 'NO_ACTION';
    let priority: QualityGatePriority = 'LOW';
    let reason = 'Did not meet quality thresholds';
    let qualityScore = 0;
    let materialityScore = 0;
    let companyMatchConfidence = 0;
    let isGenericCalendar = false;
    let isDuplicateCluster = false;
    let symbol = (article.fno?.symbol || 'MARKET').toUpperCase();

    // ----------------------------------------------------
    // STEP 1: HISTORICAL BACKLOG PROTECTION (WATERMARK)
    // ----------------------------------------------------
    if (watermarkTime > 0 && articleTime < watermarkTime) {
      return {
        decision: 'NO_ACTION',
        priority: 'LOW',
        reason: 'Historical article collected before Telegram activation watermark',
        symbol,
        qualityScore: 0,
        materialityScore: 0,
        companyMatchConfidence: 0,
        isGenericCalendar: false,
        isDuplicateCluster: false,
        optionsImpactSummary: 'No actionable F&O setup from this article alone.',
        clusterKey: `hist_${article.id}`
      };
    }

    // ----------------------------------------------------
    // STEP 2: GENERIC EARNINGS-CALENDAR & MULTI-COMPANY LIST FILTER
    // ----------------------------------------------------
    const calendarPatterns = [
      /over \d+ companies/i,
      /\d+ companies to (announce|report|declare) earnings/i,
      /q[1-4] results today.*\d+ companies/i,
      /stocks in (focus|news) today/i,
      /stocks to watch (today|this week)/i,
      /buzzing stocks/i,
      /top stocks to (buy|trade|watch)/i,
      /market (wrap|live|update|outlook)/i,
      /trade setup for/i,
      /board meeting today/i,
      /earnings (today|this week)/i
    ];

    const isCalendarPattern = calendarPatterns.some(pattern => pattern.test(headline));
    const multipleCompaniesMentioned = (headline.match(/, /g) || []).length >= 2 && /including|and|along with/i.test(headline);

    if (isCalendarPattern || multipleCompaniesMentioned) {
      isGenericCalendar = true;
      // Unless headline contains explicit single-company PAT/Profit numbers
      const metricsInHeadline = FinancialMetricEngine.extractMetrics(headline);
      if (metricsInHeadline.length === 0) {
        return {
          decision: 'NO_ACTION',
          priority: 'LOW',
          reason: 'Generic earnings calendar or multi-company list without single-company materiality',
          symbol: 'MARKET',
          qualityScore: 10,
          materialityScore: 10,
          companyMatchConfidence: 20,
          isGenericCalendar: true,
          isDuplicateCluster: false,
          optionsImpactSummary: 'No actionable F&O setup from this article alone.',
          clusterKey: `calendar_${article.id}`
        };
      }
    }

    // ----------------------------------------------------
    // STEP 3: COMPANY SPECIFICITY & SYMBOL CONFIDENCE (PHASE 26 REFINED)
    // ----------------------------------------------------
    let resolvedSymbol = 'MARKET';
    let resolvedConfidence = 0;

    // Check LEVEL 1: Authoritative Metadata Bypass
    const metaSymbol = article.fno?.symbol ? article.fno.symbol.toUpperCase() : '';
    const isMetaEligible = article.fno?.eligible === true && !!metaSymbol;
    const metaCompany = isMetaEligible ? FNO_UNIVERSE.find(c => c.symbol.toUpperCase() === metaSymbol) : null;

    if (metaCompany) {
      resolvedSymbol = metaSymbol;
      resolvedConfidence = 100; // Trust the FNOEligibilityEngine
    }

    // Check LEVEL 2: Canonical company/alias resolution (Fallback for non-eligible or missed meta)
    if (resolvedSymbol === 'MARKET') {
      const entityMatch = findFNOEntityInHeadline(headline);
      if (entityMatch) {
        resolvedSymbol = entityMatch.company.symbol.toUpperCase();
        resolvedConfidence = 95;
      }
    }

    // Check LEVEL 3: Literal ticker matching / Body matching (Fallback)
    if (resolvedSymbol === 'MARKET') {
      const metaEligibleSymbol = article.fno?.symbol ? article.fno.symbol.toUpperCase() : '';
      if (metaEligibleSymbol && metaEligibleSymbol !== 'MARKET') {
        const symbolRegex = new RegExp(`\\b${metaEligibleSymbol}\\b`, 'i');
        const symbolInHeadline = symbolRegex.test(headline);

        if (symbolInHeadline) {
          resolvedSymbol = metaEligibleSymbol;
          resolvedConfidence = 95;
        } else if (symbolRegex.test(body.slice(0, 300))) {
          resolvedSymbol = metaEligibleSymbol;
          resolvedConfidence = 70;
        } else {
          resolvedSymbol = metaEligibleSymbol;
          resolvedConfidence = 40;
        }
      }
    }

    // Assign final symbol and confidence values
    symbol = resolvedSymbol;
    companyMatchConfidence = resolvedConfidence;

    // If symbol mentioned inside list without being primary subject
    if (symbol !== 'MARKET' && multipleCompaniesMentioned) {
      const metaCompanyObj = FNO_UNIVERSE.find(c => c.symbol.toUpperCase() === symbol);
      const isCompanyInHeadline = metaCompanyObj && (
        headline.toLowerCase().includes(metaCompanyObj.name.toLowerCase()) ||
        metaCompanyObj.aliases.some(a => headline.toLowerCase().includes(a.toLowerCase()))
      );
      if (!isCompanyInHeadline) {
        companyMatchConfidence = 30;
      }
    }

    if (symbol === 'MARKET') {
      if ((article.category === 'MACRO' || article.category === 'POLICY') && article.relevanceScore >= 85) {
        companyMatchConfidence = 90;
      } else {
        return {
          decision: 'NO_ACTION',
          priority: 'LOW',
          reason: 'No specific F&O company matched',
          symbol: 'MARKET',
          qualityScore: 20,
          materialityScore: 20,
          companyMatchConfidence: 0,
          isGenericCalendar,
          isDuplicateCluster: false,
          optionsImpactSummary: 'No actionable F&O setup from this article alone.',
          clusterKey: `nosym_${article.id}`
        };
      }
    } else {
      if (companyMatchConfidence < 60) {
        return {
          decision: 'NO_ACTION',
          priority: 'LOW',
          reason: 'Company match confidence insufficient or merely mentioned in passing list',
          symbol,
          qualityScore: 25,
          materialityScore: 25,
          companyMatchConfidence,
          isGenericCalendar,
          isDuplicateCluster: false,
          optionsImpactSummary: 'No actionable F&O setup from this article alone.',
          clusterKey: `lowconf_${symbol}_${article.id}`
        };
      }
    }

    // ----------------------------------------------------
    // STEP 4: MATERIALITY & FINANCIAL SIGNIFICANCE
    // ----------------------------------------------------
    const metrics = FinancialMetricEngine.extractMetrics(fullText);

    // Material event indicators
    const highMaterialityKeywords = [
      /q[1-4]|pat|net profit|revenue|ebitda|margin/i,
      /profit (jumps|surges|drops|falls|plunges|rises|soars|slips|down|up)/i,
      /guidance (cut|raised|revised|lowered)/i,
      /order win|contract worth|receives order/i,
      /acquisition|merger|demerger|stake sale|buyback/i,
      /sebi|rbi|penalty|investigation|enforcement|notice/i,
      /credit rating|rating\s+(?:downgrade|upgrade)|default/i,
      /resigns|appointed|ceo|cfo|md/i,
      /dividend|bonus|stock split/i,
      /collaboration|expansion|launches|opens|partnership/i,
      /board approves|capital expenditure|investment|announces major/i
    ];

    const lowMaterialityKeywords = [
      /stocks to watch/i,
      /brokerage (gives|maintains|retains|recommends|target|upgrade|downgrade)/i,
      /target price|target hike|price target/i,
      /gains \d+%/i,
      /falls \d+%/i,
      /early trade/i,
      /shares (rise|fall|gain|slip|drop|jump) \d+%/i,
      /shares (rise|fall) (most|marginally)/i,
      /market commentary|analyst|brokerage/i,
      /upgrades to Buy|downgrades to Sell/i,
      /upgrades (?:\w+\s+){0,3}to\s+(?:Buy|Hold|Neutral)/i,
      /downgrades (?:\w+\s+){0,3}to\s+(?:Sell|Hold|Neutral)/i
    ];

    let matScore = isMetaEligible ? 50 : 30; // Boost baseline if already confirmed as F&O
    if (metrics.length > 0) matScore += 35;

    for (const kw of highMaterialityKeywords) {
      if (kw.test(headline)) matScore += 20;
      else if (kw.test(body)) matScore += 10;
    }

    // Penalize routine commentary ONLY if not already confirmed as high-value F&O
    if (!isMetaEligible) {
      for (const kw of lowMaterialityKeywords) {
        if (kw.test(headline)) matScore -= 25;
      }
    } else {
       // Mild penalty even for F&O if headline is generic list
       if (/stocks to watch|top stocks/i.test(headline)) matScore -= 15;
    }

    materialityScore = Math.max(0, Math.min(100, matScore));

    if (materialityScore < 45) {
      return {
        decision: 'NO_ACTION',
        priority: 'LOW',
        reason: 'Low materiality or routine market commentary',
        symbol,
        qualityScore: materialityScore,
        materialityScore,
        companyMatchConfidence,
        isGenericCalendar,
        isDuplicateCluster: false,
        optionsImpactSummary: 'No actionable F&O setup from this article alone.',
        clusterKey: `lowmat_${symbol}_${article.id}`
      };
    }

    // ----------------------------------------------------
    // STEP 5: STORY CLUSTER DEDUPLICATION
    // ----------------------------------------------------
    // Formulate normalized cluster key based on Symbol + Event Keywords
    const headlineWords = headline.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).slice(0, 5).join('_');
    const clusterKey = `${symbol}_${headlineWords}`;

    const now = Date.now();
    this.cleanStaleClusters(now);

    if (this.recentClusterKeys.has(clusterKey)) {
      const existing = this.recentClusterKeys.get(clusterKey);
      if (existing && existing.articleId !== article.id) {
        isDuplicateCluster = true;
        return {
          decision: 'SUPPRESSED',
          priority: 'LOW',
          reason: 'Duplicate story cluster from another source',
          symbol,
          qualityScore: materialityScore,
          materialityScore,
          companyMatchConfidence,
          isGenericCalendar,
          isDuplicateCluster: true,
          optionsImpactSummary: 'No actionable F&O setup from this article alone.',
          clusterKey
        };
      }
    }

    // ----------------------------------------------------
    // STEP 6: QUALITY SCORE & OPTIONS IMPACT SUMMARY
    // ----------------------------------------------------
    qualityScore = Math.round((materialityScore * 0.5) + (companyMatchConfidence * 0.3) + (article.relevanceScore * 0.2));

    let optionsImpactSummary = 'No actionable F&O setup from this article alone.';
    const isEarningsArticle = article.category === 'RESULTS' || 
                             /q[1-4]|earnings|quarterly|net profit|pat/i.test(headline);

    if (isEarningsArticle && materialityScore >= 50) {
      optionsImpactSummary = `Material earnings catalyst for ${symbol}. Expect potential volatility expansion around the result; option sellers should wait for price/IV stabilization before initiating a position.`;
    } else if (article.sentiment === 'BEARISH' && materialityScore >= 50) {
      optionsImpactSummary = `Negative catalyst may increase near-term volatility in ${symbol}. Monitor call option writing and elevated gamma risk.`;
    } else if (article.sentiment === 'BULLISH' && materialityScore >= 50) {
      optionsImpactSummary = `Positive price momentum may trigger short covering in ${symbol}. Put option sellers should track key support levels.`;
    } else if (article.sentiment === 'NEUTRAL' && metrics.length > 0) {
      optionsImpactSummary = `Mixed financial metrics for ${symbol}. Range-bound potential; suitable for wide strike buffers with strict risk stops.`;
    }

    // ----------------------------------------------------
    // STEP 7: PRIORITY ASSIGNMENT & CIRCUIT BREAKER
    // ----------------------------------------------------
    if (qualityScore >= 75 && materialityScore >= 60) {
      priority = (qualityScore >= 88 || article.category === 'MACRO') ? 'CRITICAL' : 'HIGH';
      decision = 'IMMEDIATE';
      reason = 'Material company-specific F&O intelligence';
    } else if (qualityScore >= 50) {
      priority = 'MEDIUM';
      decision = 'DIGEST_PENDING';
      reason = 'Moderate F&O relevance -> Grouped for digest';
    } else {
      priority = 'LOW';
      decision = 'NO_ACTION';
      reason = 'Sub-threshold quality score';
    }

    // Apply Circuit Breaker if active
    if (options?.circuitBreakerActive && decision === 'IMMEDIATE') {
      decision = 'DIGEST_PENDING';
      reason = 'Circuit breaker active (rate limit exceeded) -> Moved to Digest';
    }

    // Register cluster key
    if (decision === 'IMMEDIATE' || decision === 'DIGEST_PENDING') {
      this.recentClusterKeys.set(clusterKey, { timestamp: now, articleId: article.id });
    }

    return {
      decision,
      priority,
      reason,
      symbol,
      qualityScore,
      materialityScore,
      companyMatchConfidence,
      isGenericCalendar,
      isDuplicateCluster: false,
      optionsImpactSummary,
      clusterKey
    };
  }

  private static cleanStaleClusters(now: number): void {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    for (const [key, val] of this.recentClusterKeys.entries()) {
      if (now - val.timestamp > TWENTY_FOUR_HOURS) {
        this.recentClusterKeys.delete(key);
      }
    }
  }

  public static clearClusterHistory(): void {
    this.recentClusterKeys.clear();
  }
}
