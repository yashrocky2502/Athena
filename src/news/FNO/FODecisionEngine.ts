import {
  FODecisionSignal,
  DirectionalBias,
  RecommendationType,
  AlertSeverity
} from './FOTypes.js';
import { BinaryEventRiskEngine } from './BinaryEventRiskEngine.js';
import { VolatilityImpactEngine } from './VolatilityImpactEngine.js';
import { FNODataAvailabilityGuard } from './FNODataAvailabilityGuard.js';
import { DecisionFreshnessEngine } from './DecisionFreshnessEngine.js';

export interface ArticleInput {
  articleId: string;
  storyClusterId?: string;
  publishedAt: string | number;
  publisher?: string;
  canonicalUrl?: string;
  category?: string;
  title: string;
  body: string;
  extractedEntities?: string[];
  financialMetrics?: any[];
  quotes?: any[];
  impactDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
}

export interface ClusteredStoryInput {
  storyClusterId: string;
  primaryArticle: ArticleInput;
  syndicatedArticles?: ArticleInput[];
}

export interface PositionContext {
  existingPositions?: Array<{ symbol: string; optionType: 'CE' | 'PE'; delta: number }>;
  positionStatus?: 'AVAILABLE' | 'UNAVAILABLE';
}

export class FODecisionEngine {
  private binaryEngine = new BinaryEventRiskEngine();
  private volatilityEngine = new VolatilityImpactEngine();
  private guardEngine = new FNODataAvailabilityGuard();
  private freshnessEngine = new DecisionFreshnessEngine();

  /**
   * Generates a deterministic F&O Decision Signal for a given article or cluster of articles.
   */
  public generateDecision(
    input: ArticleInput | ClusteredStoryInput,
    liveMarketData?: { underlyingPrice?: number; optionChain?: any; positions?: any },
    positionContext?: PositionContext
  ): FODecisionSignal {
    const isCluster = 'primaryArticle' in input;
    const primary = isCluster ? (input as ClusteredStoryInput).primaryArticle : (input as ArticleInput);
    const clusterArticles = isCluster ? [(input as ClusteredStoryInput).primaryArticle, ...((input as ClusteredStoryInput).syndicatedArticles || [])] : [primary];

    const articleId = primary.articleId || `ART_${Date.now()}`;
    const storyClusterId = (isCluster ? (input as ClusteredStoryInput).storyClusterId : primary.storyClusterId) || `CLUST_${articleId}`;
    const timestamp = new Date(primary.publishedAt || Date.now()).toISOString();

    // 1. Publisher Deduplication & Multi-Story Consolidation
    const publishersSet = new Set<string>();
    const urlsSet = new Set<string>();
    clusterArticles.forEach(a => {
      if (a.publisher) publishersSet.add(a.publisher);
      if (a.canonicalUrl) urlsSet.add(a.canonicalUrl);
    });
    const independentPublisherCount = publishersSet.size || 1;
    const sourceUrls = Array.from(urlsSet);
    const sourcePublisher = primary.publisher || 'Canonical Media Source';
    const evidenceCount = clusterArticles.length;

    // Calculate source agreement score
    let positiveCount = 0;
    let negativeCount = 0;
    clusterArticles.forEach(a => {
      const text = ` ${a.title} ${a.body} `.toLowerCase();
      
      const isCostSurge = text.includes('cost surge') || text.includes('costs surge') || text.includes('input costs') || text.includes('cost inflation');
      const isGrowthCut = (text.includes('growth') && (text.includes('cuts') || text.includes('slashes') || text.includes('reduced') || text.includes('slowing'))) || text.includes('growth slowdown') || text.includes('cuts full-year') || text.includes('slashes');
      const isContractCancelled = text.includes('terminates') || text.includes('cancelled') || text.includes('cancellation') || text.includes('contract termination');

      const isPositive = a.impactDirection === 'BULLISH' || (
        (text.includes('jump') || (text.includes('surge') && !isCostSurge) || text.includes('beat estimates') || text.includes('beats') || text.includes('upgrade') || text.includes('upgraded') ||
        text.includes('profit up') || text.includes('rises') || text.includes('wins') || text.includes('secures') || text.includes('acquired') ||
        text.includes('acquires') || text.includes('expanded') || (text.includes('growth') && !isGrowthCut) || text.includes('eir') || text.includes('inspection report') ||
        text.includes('approval') || text.includes('grew') || text.includes('launches') || text.includes('order win') || text.includes('commissioned') ||
        text.includes('commissions') || text.includes('dividend') || text.includes('contract win') || text.includes('secured contract') || text.includes('awarded contract')) &&
        !isContractCancelled
      );

      const isNegative = a.impactDirection === 'BEARISH' || (
        text.includes('fall') || text.includes('slump') || text.includes('misses') || text.includes('missed') || text.includes('earnings miss') || text.includes('downgrade') || text.includes('downgraded') ||
        text.includes('net loss') || text.includes('penalty') || text.includes('cuts') || text.includes('slashes') || text.includes('guidance cut') || text.includes('resigns') ||
        text.includes('terminates') || text.includes('cancelled') || text.includes('reduces') || text.includes('reduction') || text.includes('warns') ||
        text.includes('pressure') || text.includes('recalls') || text.includes('recall') || text.includes('denies') || text.includes('denied') || isCostSurge || isGrowthCut || isContractCancelled
      );

      if (isPositive && !isNegative) {
        positiveCount++;
      } else if (isNegative && !isPositive) {
        negativeCount++;
      } else if (isPositive && isNegative) {
        // If both positive and negative keywords triggered, check if negative dominates or positive dominates
        if (isContractCancelled || isGrowthCut || isCostSurge) {
          negativeCount++;
        } else {
          positiveCount++;
          negativeCount++;
        }
      }
    });

    let sourceAgreementScore = 100;
    if (positiveCount > 0 && negativeCount > 0) {
      sourceAgreementScore = Math.round((Math.max(positiveCount, negativeCount) / (positiveCount + negativeCount)) * 100);
    }

    // 2. Data Availability Guard & F&O Entity Mapping
    const rawSymbol = (primary.extractedEntities && primary.extractedEntities[0]) || primary.title || '';
    const guardResult = this.guardEngine.auditAvailability(rawSymbol, liveMarketData);

    // 3. Freshness Engine
    const freshnessResult = this.freshnessEngine.evaluateFreshness(primary.publishedAt, primary.category || '');

    // 4. Binary Event Risk Engine
    const binaryResult = this.binaryEngine.evaluateRisk(primary.category || '', primary.title, primary.body);

    // 5. Volatility Impact Engine
    const volatilityResult = this.volatilityEngine.evaluateVolatility(
      primary.category || '',
      primary.title,
      primary.body,
      guardResult.optionChainStatus === 'AVAILABLE'
    );

    // 6. Directional Bias Analysis & Conflict Detection
    let directionalBias: DirectionalBias = 'NEUTRAL';
    let directionalConfidence = 75;
    let eventPolarity: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED' = 'NEUTRAL';
    let marketImpact: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' | 'UNKNOWN' = 'NEUTRAL';

    const fullText = ` ${primary.title} ${primary.body} `.toLowerCase();
    const hasPositive = positiveCount > 0 || fullText.includes('order win') || fullText.includes('wins') || fullText.includes('secures') || fullText.includes('profit rises') || fullText.includes('jumps') || fullText.includes('beat estimates') || fullText.includes('beats') || fullText.includes('guidance raised') || fullText.includes('eir issued') || fullText.includes('upgrade') || fullText.includes('acquires') || fullText.includes('commissioned') || fullText.includes('expanded') || fullText.includes('grew') || fullText.includes('approval');
    const hasNegative = negativeCount > 0 || fullText.includes('net loss') || fullText.includes('falls') || fullText.includes('slump') || fullText.includes('guidance cut') || fullText.includes('cuts') || fullText.includes('penalty') || fullText.includes('resigns') || fullText.includes('downgrade') || fullText.includes('order cancelled') || fullText.includes('terminates') || fullText.includes('recalls');

    if (hasPositive && hasNegative) {
      directionalBias = 'MIXED';
      eventPolarity = 'MIXED';
      marketImpact = 'MIXED';
      directionalConfidence = 50;
    } else if (hasPositive) {
      directionalBias = 'BULLISH';
      eventPolarity = 'POSITIVE';
      marketImpact = 'BULLISH';
      directionalConfidence = Math.min(95, 80 + (independentPublisherCount > 1 ? 10 : 0));
    } else if (hasNegative) {
      directionalBias = 'BEARISH';
      eventPolarity = 'NEGATIVE';
      marketImpact = 'BEARISH';
      directionalConfidence = Math.min(95, 80 + (independentPublisherCount > 1 ? 10 : 0));
    }

    // 7. Decision Matrix Policy Enforcement
    let recommendation: RecommendationType = 'WAIT';
    let preferredOptionSide: 'CE' | 'PE' | 'BOTH' | 'NONE' = 'NONE';
    let preferredStrategy: 'Naked CE' | 'Naked PE' | 'Iron Condor' | 'Strangle' | 'Wait / Hold' | 'No Trade' = 'Wait / Hold';
    let decisionStatus: 'ACTIVE' | 'DOWNGRADED' | 'EXPIRED' | 'BLOCKED' = 'ACTIVE';
    let blockedReason: string | undefined = undefined;
    let hedgeRequired = false;
    let hedgeReason = 'None';

    // Check Guard Gates
    if (!guardResult.isFnOEligible) {
      recommendation = 'NO_TRADE';
      preferredStrategy = 'No Trade';
      decisionStatus = 'BLOCKED';
      blockedReason = `Symbol '${guardResult.symbol}' is non-F&O or unmapped in derivatives registry`;
    } else if (!freshnessResult.isActionable) {
      recommendation = 'WAIT';
      preferredStrategy = 'Wait / Hold';
      decisionStatus = 'EXPIRED';
      blockedReason = `Intelligence is ${freshnessResult.freshnessStatus} (Age: ${freshnessResult.ageInMinutes} mins)`;
    } else if (directionalBias === 'MIXED') {
      recommendation = 'WAIT';
      preferredStrategy = 'Wait / Hold';
      decisionStatus = 'BLOCKED';
      blockedReason = 'Conflicting positive and negative event evidence detected';
    } else if (binaryResult.riskLevel === 'EXTREME') {
      recommendation = 'NO_TRADE';
      preferredStrategy = 'No Trade';
      decisionStatus = 'BLOCKED';
      blockedReason = `Blocked by EXTREME Binary Event Risk: ${binaryResult.reasons.join(', ')}`;
    } else if (binaryResult.riskLevel === 'HIGH') {
      recommendation = 'WAIT';
      preferredStrategy = 'Wait / Hold';
      decisionStatus = 'BLOCKED';
      blockedReason = `Blocked by HIGH Binary Event Risk: ${binaryResult.reasons.join(', ')}`;
    } else if (guardResult.optionChainStatus === 'UNAVAILABLE') {
      // If no option chain data available, convert to INFORMATIONAL_ONLY
      recommendation = 'INFORMATIONAL_ONLY';
      preferredStrategy = directionalBias === 'BULLISH' ? 'Naked PE' : directionalBias === 'BEARISH' ? 'Naked CE' : 'Iron Condor';
      preferredOptionSide = directionalBias === 'BULLISH' ? 'PE' : directionalBias === 'BEARISH' ? 'CE' : 'BOTH';
      decisionStatus = 'ACTIVE';
      blockedReason = 'Live option chain feed unavailable — Signal issued as INFORMATIONAL_ONLY';
    } else if (directionalBias === 'BULLISH') {
      recommendation = 'SELL_PE';
      preferredOptionSide = 'PE';
      preferredStrategy = 'Naked PE';
      if (binaryResult.riskLevel === 'MEDIUM') {
        hedgeRequired = true;
        hedgeReason = 'Medium binary risk requires hedging via long put wing (Iron Condor or Put Spread)';
      }
    } else if (directionalBias === 'BEARISH') {
      recommendation = 'SELL_CE';
      preferredOptionSide = 'CE';
      preferredStrategy = 'Naked CE';
      if (binaryResult.riskLevel === 'MEDIUM') {
        hedgeRequired = true;
        hedgeReason = 'Medium binary risk requires hedging via long call wing (Call Credit Spread)';
      }
    } else {
      recommendation = 'SELL_CONDOR';
      preferredStrategy = 'Iron Condor';
      preferredOptionSide = 'BOTH';
    }

    // 8. Position-Aware Safety Checks
    if (positionContext?.existingPositions && positionContext.existingPositions.length > 0) {
      const activeSymbolPositions = positionContext.existingPositions.filter(p => p.symbol === guardResult.symbol);
      if (activeSymbolPositions.length >= 3) {
        recommendation = 'WAIT';
        preferredStrategy = 'Wait / Hold';
        decisionStatus = 'BLOCKED';
        blockedReason = `Position Risk Gate: Maximum concentration limit reached for ${guardResult.symbol} (${activeSymbolPositions.length} active positions)`;
      }
    }

    // 9. Alert Severity Classification
    let alertSeverity: AlertSeverity = 'INFO';
    if (recommendation === 'SELL_PE' || recommendation === 'SELL_CE') {
      alertSeverity = binaryResult.riskLevel === 'LOW' ? 'ACTIONABLE' : 'WATCH';
    } else if (binaryResult.riskLevel === 'EXTREME') {
      alertSeverity = 'CRITICAL';
    } else if (recommendation === 'WAIT') {
      alertSeverity = 'WATCH';
    }

    // 10. Rationale & Supporting Facts
    const supportingFacts: string[] = [];
    if (primary.financialMetrics && primary.financialMetrics.length > 0) {
      primary.financialMetrics.forEach(m => {
        supportingFacts.push(`Financial Metric: ${m.metricName} = ${m.value} ${m.unit || ''} (${m.period || 'Reported'})`);
      });
    }
    supportingFacts.push(`Verified Publisher: ${sourcePublisher}`);
    supportingFacts.push(`Independent Confirming Publishers: ${independentPublisherCount}`);

    const rationale = `[${guardResult.symbol}] Event: '${primary.title}'. Directional Bias: ${directionalBias} (${directionalConfidence}% confidence). Binary Risk: ${binaryResult.riskLevel}. F&O Relevance: ${guardResult.isFnOEligible ? 'HIGH' : 'NONE'}. Recommendation: ${recommendation}.`;

    const entryConditions = [
      `Confirm underlying price stability above support / resistance`,
      `Verify F&O lot liquidity and bid-ask spread <= 0.5%`,
      `Ensure execution occurs strictly during normal market trading hours`
    ];

    const invalidationConditions = [
      `Immediate counter-filing or management retraction`,
      `Underlying price breaching key support/resistance level by > 2%`,
      `Unscheduled binary risk event announcement`
    ];

    const stopLossLogic = guardResult.optionChainStatus === 'AVAILABLE'
      ? 'Exit position if short leg delta expands beyond 0.25 (or premium increases 100%)'
      : 'Delta status UNAVAILABLE — Exit position if underlying asset moves > 2.5% against position';

    return {
      signalId: `SIG_${storyClusterId}_${Date.now()}`,
      articleId,
      storyClusterId,
      timestamp,
      symbol: guardResult.symbol,
      underlyingType: guardResult.underlyingType,
      indexOrStock: guardResult.symbol,
      eventType: primary.category || 'Corporate',
      eventPolarity,
      marketImpact,
      impactMagnitude: binaryResult.riskLevel === 'EXTREME' ? 'EXTREME' : 'HIGH',
      catalystHorizon: 'SHORT_TERM',
      fnoRelevance: guardResult.isFnOEligible ? 'HIGH' : 'NONE',
      directionalBias,
      directionalConfidence,
      volatilityBias: volatilityResult.volatilityBias,
      binaryEventRisk: binaryResult.riskLevel,
      gapRisk: volatilityResult.gapRisk,
      overnightRisk: volatilityResult.overnightRisk,
      liquidityRisk: volatilityResult.liquidityRisk,
      recommendation,
      preferredOptionSide,
      preferredStrategy,
      entryConditions,
      invalidationConditions,
      stopLossLogic,
      hedgeRequired,
      hedgeReason,
      rationale,
      supportingFacts,
      sourceUrls,
      sourcePublisher,
      intelligenceStatus: 'VERIFIED',
      freshnessStatus: freshnessResult.freshnessStatus,
      decisionStatus,
      dataAvailability: {
        underlyingPrice: guardResult.underlyingPriceStatus,
        optionChain: guardResult.optionChainStatus,
        ivData: guardResult.ivStatus,
        deltaStatus: guardResult.deltaStatus,
        positionsData: positionContext?.positionStatus || guardResult.positionsStatus
      },
      alertSeverity,
      evidenceCount,
      independentPublisherCount,
      sourceAgreementScore,
      blockedReason
    };
  }
}
