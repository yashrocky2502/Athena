import { TraderIntelligence as ITraderIntelligence, TraderIntelligenceEventType, EvidenceState, EvidenceItem, TraderProfileType, TraderRelevanceProfile, WhatChangedData, ConfidenceData } from './TraderIntelligenceTypes.ts';
import { TraderIntelligence } from './TraderIntelligence.ts';
import { TraderIntelligenceEvidence } from './TraderIntelligenceEvidence.ts';
import { FundamentalImpactEngine } from './FundamentalImpactEngine.ts';
import { MarketReactionEngine } from './MarketReactionEngine.ts';
import { FnoEvidenceEngine } from './FnoEvidenceEngine.ts';
import { SymbolExtractor } from './SymbolExtractor.ts';

export class TraderIntelligenceEngine {
  private static VERSION = 'ATHENA_TRADER_V9.0';

  /**
   * Orchestrates the complete truth and intelligence pipeline for an incoming article.
   */
  public static process(article: {
    id: string;
    headline?: string;
    title?: string;
    body?: string;
    content?: string;
    description?: string;
    publishedAt?: string;
    source?: { name?: string; publisher?: string };
    category?: string;
    primaryCategory?: string;
    symbol?: string | null;
    fnoEligible?: boolean;
  }): TraderIntelligence {
    const articleId = article.id;
    const headline = (article.headline || article.title || '').trim();
    const body = (article.body || article.content || article.description || '').trim();
    const publishedAt = article.publishedAt || new Date().toISOString();
    const publisher = article.source?.publisher || article.source?.name || 'Unknown';
    const sourceTier = TraderIntelligenceEvidence.evaluateSourceTier(publisher);

    // 1. Determine entity & symbol
    const extracted = SymbolExtractor.extract(headline, body);
    const symbol = article.symbol || (extracted[0] ? extracted[0].nseSymbol : null);
    const entity = extracted[0] ? extracted[0].companyName : 'Broad Market';

    // 2. Deterministic Event Classification (27 Types)
    const eventType = this.classifyEvent(headline, body);

    // 3. Evidence Harvesting
    const evidence: EvidenceItem[] = [];
    
    // Add Headline as source fact
    evidence.push(
      TraderIntelligenceEvidence.createEvidenceItem({
        id: `${articleId}-headline-fact`,
        source: publisher,
        sourceTier,
        articleId,
        publishedAt,
        evidenceText: headline,
        evidenceType: 'SOURCE_FACT'
      })
    );

    // Harvest explicit numerical / financial facts
    const numFacts = TraderIntelligenceEvidence.extractNumericalFacts(body, publisher, articleId, publishedAt);
    evidence.push(...numFacts);

    // 4. Fundamental Impact & Mechanism Evaluation
    const fundAnalysis = FundamentalImpactEngine.analyze(eventType, body, evidence);

    // 5. "What Changed" Comparative Logic
    const whatChanged = this.evaluateWhatChanged(body, eventType);

    // 6. Market Reaction Evaluation
    const marketReaction = MarketReactionEngine.analyze(headline, body);
    const reactionCat = MarketReactionEngine.getReactionCategory(marketReaction);
    
    let marketImpact: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' | 'UNKNOWN' = 'UNKNOWN';
    if (reactionCat === 'POSITIVE_REACTION') marketImpact = 'BULLISH';
    else if (reactionCat === 'NEGATIVE_REACTION') marketImpact = 'BEARISH';
    else if (reactionCat === 'NO_MATERIAL_REACTION') marketImpact = 'NEUTRAL';
    else if (reactionCat === 'MIXED_REACTION') marketImpact = 'MIXED';

    // Determine Market Direction string
    const marketDirection = this.determineMarketDirection(eventType, marketImpact);

    // 7. F&O Derivatives Intelligence
    const fnoIntelligence = FnoEvidenceEngine.analyze(body, publisher);

    // 8. Assign Multi-Profile Trader Relevance
    const traderRelevance = this.evaluateTraderRelevance(eventType, fnoIntelligence.available);

    // 9. Explainable Confidence Engine
    const confidence = this.computeConfidence(sourceTier, evidence, marketReaction.status, fnoIntelligence.available, publishedAt);

    // 10. Uncertainty Identification
    const uncertainty = this.identifyUncertainties(body, marketReaction.status, fnoIntelligence.available);

    // 11. "What to Monitor" Logic
    const whatToMonitor = this.determineWhatToMonitor(eventType, body);

    // 12. Executive Interpretation (2-3 sentences: what happened, why it matters, what next)
    const executiveInterpretation = this.buildExecutiveInterpretation(headline, eventType, fundAnalysis.mechanism, marketImpact);

    return new TraderIntelligence({
      articleId,
      entity,
      symbol,
      category: article.category || article.primaryCategory || 'Market',
      eventType,
      executiveInterpretation,
      fundamentalImpact: fundAnalysis.status,
      fundamentalMechanism: fundAnalysis.mechanism,
      marketImpact,
      marketDirection,
      marketReaction,
      traderRelevance,
      fnoIntelligence,
      evidence,
      evidenceQuality: sourceTier === 'TIER_1' ? 'HIGH' : sourceTier === 'TIER_2' ? 'MEDIUM' : 'LOW',
      confidence,
      uncertainty,
      whatChanged,
      whatToMonitor,
      generatedAt: new Date().toISOString(),
      engineVersion: this.VERSION
    });
  }

  /**
   * Deterministic event router matching 27 distinct financial event categories.
   */
  private static classifyEvent(headline: string, body: string): TraderIntelligenceEventType {
    const text = `${headline} ${body}`.toLowerCase();

    if (text.includes('buyback') || text.includes('share repurchase')) return 'BUYBACK';
    if (text.includes('bonus issue') || text.includes('bonus share')) return 'BONUS';
    if (text.includes('stock split') || text.includes('sub-division of share')) return 'SPLIT';
    if (text.includes('dividend') || text.includes('payout per share')) return 'DIVIDEND';
    if (text.includes('q1') || text.includes('q2') || text.includes('q3') || text.includes('q4') || text.includes('quarterly results')) {
      if (text.includes('revenue') && !text.includes('net profit')) return 'REVENUE_UPDATE';
      if (text.includes('net profit') || text.includes('pat') || text.includes('net loss')) return 'PROFIT_UPDATE';
      return 'EARNINGS';
    }
    if (text.includes('order win') || text.includes('bags order') || text.includes('secures contract') || text.includes('awarded contract')) return 'ORDER_WIN';
    if (text.includes('order cancel') || text.includes('contract terminated') || text.includes('order terminated')) return 'ORDER_CANCELLATION';
    if (text.includes('merger') || text.includes('amalgamation') || text.includes('demerger')) return 'M_AND_A';
    if (text.includes('acquisition') || text.includes('acquire')) return 'ACQUISITION';
    if (text.includes('stake sale') || text.includes('sells stake') || text.includes('divestment')) return 'STAKE_SALE';
    if (text.includes('block deal') || text.includes('bulk deal')) return 'BLOCK_DEAL';
    if (text.includes('senior notes') || text.includes('debt listing') || text.includes('bonds listing')) return 'DEBT_LISTING';
    if (text.includes('qip') || text.includes('rights issue') || text.includes('fundraising') || text.includes('preferential allotment')) return 'FUNDRAISING';
    if (text.includes('sebi') || text.includes('penalty') || text.includes('fine imposed') || text.includes('show cause notice')) return 'REGULATORY_ACTION';
    if (text.includes('court order') || text.includes('litigation') || text.includes('lawsuit') || text.includes('legal dispute')) return 'LEGAL_ACTION';
    if (text.includes('windfall tax') || text.includes('customs duty') || text.includes('tax raid') || text.includes('income tax')) return 'TAX_ACTION';
    if (text.includes('capex') || text.includes('capital expenditure')) return 'CAPEX';
    if (text.includes('capacity expansion') || text.includes('new facility') || text.includes('plant commissioning')) return 'CAPACITY_EXPANSION';
    if (text.includes('resignation') || text.includes('appointed as ceo') || text.includes('new managing director')) return 'MANAGEMENT_CHANGE';
    if (text.includes('rating upgrade') || text.includes('rating downgrade') || text.includes('crisil') || text.includes('care ratings')) return 'CREDIT_RATING';
    if (text.includes('ipo') || text.includes('initial public offering')) return 'IPO';
    if (text.includes('rbi repo rate') || text.includes('gdp inflation') || text.includes('monetary policy') || text.includes('cpi inflation')) return 'MACROECONOMIC';
    if (text.includes('open interest') || text.includes('implied volatility') || text.includes('options chain')) return 'FNO_POSITIONING';
    if (text.includes('shares surged') || text.includes('stock tumbles') || text.includes('price target')) return 'PRICE_CHANGE';

    return 'OTHER';
  }

  /**
   * Tracks historical context changes and "what changed" triggers.
   */
  private static evaluateWhatChanged(body: string, eventType: TraderIntelligenceEventType): WhatChangedData {
    const lower = body.toLowerCase();

    // Look for previous values vs new values
    const comparativeRegex = /(?:rose|fell|increased|decreased|to|stood at)\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:crore|cr)?\s*(?:from|compared with|against|versus)\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i;
    const match = body.match(comparativeRegex);

    if (match) {
      const newValue = match[1];
      const previousValue = match[2];
      const dir = lower.includes('rose') || lower.includes('increased') ? 'UP' : 'DOWN';

      return {
        status: 'REVISION',
        previousValue,
        newValue,
        changeDirection: dir,
        details: `Factual adjustment from previous value (${previousValue}) to new value (${newValue}) as verified from the text.`
      };
    }

    if (lower.includes('confirm') || lower.includes('approved by board') || lower.includes('reiterated')) {
      return {
        status: 'CONFIRMATION',
        details: 'Event confirms previous rumors or preliminary corporate announcements.'
      };
    }

    if (lower.includes('revised') || lower.includes('updated guidance') || lower.includes('amended')) {
      return {
        status: 'REVISION',
        details: 'Revision detected in operational metrics, guidance figures, or regulatory guidelines.'
      };
    }

    return {
      status: 'NEW_INFORMATION',
      details: `First-time disclosure of ${eventType} corporate announcement.`
    };
  }

  /**
   * Formulates the expected market direction.
   */
  private static determineMarketDirection(eventType: TraderIntelligenceEventType, impact: string): string {
    if (impact === 'BULLISH') return 'CE_BIAS';
    if (impact === 'BEARISH') return 'PE_BIAS';
    if (impact === 'MIXED') return 'MIXED_BIAS';
    return 'NEUTRAL_BIAS';
  }

  /**
   * Maps event types and derivatives metrics to specific trader profiles.
   */
  private static evaluateTraderRelevance(eventType: TraderIntelligenceEventType, hasFno: boolean): TraderRelevanceProfile[] {
    const profiles: { profile: TraderProfileType; relevanceLevel: 'HIGH' | 'MEDIUM' | 'LOW'; relevanceReason: string }[] = [];

    // Intraday Trader
    const intradayHigh: TraderIntelligenceEventType[] = ['EARNINGS', 'ORDER_WIN', 'STAKE_SALE', 'BLOCK_DEAL', 'PRICE_CHANGE', 'REGULATORY_ACTION'];
    profiles.push({
      profile: 'INTRADAY_TRADER',
      relevanceLevel: intradayHigh.includes(eventType) ? 'HIGH' : 'MEDIUM',
      relevanceReason: intradayHigh.includes(eventType)
        ? 'High intraday volatility expected. Significant volume surge triggers trading opportunities.'
        : 'Moderate catalyst. Intraday price ranges likely range-bound.'
    });

    // Swing Trader
    const swingHigh: TraderIntelligenceEventType[] = ['EARNINGS', 'ACQUISITION', 'ORDER_WIN', 'CAPACITY_EXPANSION', 'CAPEX'];
    profiles.push({
      profile: 'SWING_TRADER',
      relevanceLevel: swingHigh.includes(eventType) ? 'HIGH' : 'MEDIUM',
      relevanceReason: swingHigh.includes(eventType)
        ? 'Catalyst expected to trigger a multi-session directional trend. Excellent risk-reward for swing setups.'
        : 'Short-term noise. Multi-day trend continuation unlikely.'
    });

    // Long Term Investor
    const longTermHigh: TraderIntelligenceEventType[] = ['CAPACITY_EXPANSION', 'CAPEX', 'ACQUISITION', 'EARNINGS', 'CREDIT_RATING'];
    profiles.push({
      profile: 'LONG_TERM_INVESTOR',
      relevanceLevel: longTermHigh.includes(eventType) ? 'HIGH' : 'MEDIUM',
      relevanceReason: longTermHigh.includes(eventType)
        ? 'Structural fundamental enhancement affecting multi-year cash flow models.'
        : 'Transient operational event with negligible terminal value impact.'
    });

    // F&O Trader & Options Seller
    profiles.push({
      profile: 'FNO_TRADER',
      relevanceLevel: hasFno ? 'HIGH' : 'LOW',
      relevanceReason: hasFno
        ? 'Underlying derivatives are highly liquid. High open interest signals momentum setup.'
        : 'No active derivative contracts. Restricted to spot cash segment.'
    });

    profiles.push({
      profile: 'OPTIONS_SELLER',
      relevanceLevel: hasFno && eventType === 'EARNINGS' ? 'HIGH' : 'LOW',
      relevanceReason: hasFno && eventType === 'EARNINGS'
        ? 'Earnings announcement triggers post-event IV collapse. Ideal setup for theta decaying premium writing.'
        : 'Lack of option writing triggers or low volatility premium pricing.'
    });

    // Volatility Trader
    const volHigh: TraderIntelligenceEventType[] = ['EARNINGS', 'REGULATORY_ACTION', 'MACROECONOMIC'];
    profiles.push({
      profile: 'VOLATILITY_TRADER',
      relevanceLevel: volHigh.includes(eventType) ? 'HIGH' : 'MEDIUM',
      relevanceReason: volHigh.includes(eventType)
        ? 'Major pricing catalyst triggers significant volatility band expansions.'
        : 'Standard operating development. Volatility expected to contract.'
    });

    // Event Driven Trader
    const eventHigh: TraderIntelligenceEventType[] = ['BUYBACK', 'SPLIT', 'BONUS', 'ACQUISITION', 'M_AND_A', 'ORDER_WIN'];
    profiles.push({
      profile: 'EVENT_DRIVEN_TRADER',
      relevanceLevel: eventHigh.includes(eventType) ? 'HIGH' : 'MEDIUM',
      relevanceReason: eventHigh.includes(eventType)
        ? 'Classic corporate action arbitrage or catalyst capture event. Standard trading playbook applicable.'
        : 'Standard news story with no special corporate action milestones.'
    });

    // Arbitrage Trader
    const arbHigh: TraderIntelligenceEventType[] = ['SPLIT', 'BONUS', 'M_AND_A', 'ACQUISITION'];
    profiles.push({
      profile: 'ARBITRAGE_TRADER',
      relevanceLevel: arbHigh.includes(eventType) ? 'HIGH' : 'LOW',
      relevanceReason: arbHigh.includes(eventType)
        ? 'Potential cash-futures or cross-border spread opportunities during corporate restructuring.'
        : 'No structural discrepancy or conversion mechanics detected.'
    });

    // Mutual Fund Investor
    profiles.push({
      profile: 'MUTUAL_FUND_INVESTOR',
      relevanceLevel: eventType === 'REGULATORY_ACTION' ? 'HIGH' : 'LOW',
      relevanceReason: eventType === 'REGULATORY_ACTION'
        ? 'High compliance risk. Active fund managers likely rebalancing portfolio weightings.'
        : 'Operational update with zero portfolio rebalancing significance.'
    });

    return profiles;
  }

  /**
   * Computes an explainable confidence scorecard based on data attributes.
   */
  private static computeConfidence(
    sourceTier: 'TIER_1' | 'TIER_2' | 'TIER_3',
    evidence: EvidenceItem[],
    reactionStatus: EvidenceState,
    hasFno: boolean,
    publishedAt: string
  ): ConfidenceData {
    // 1. Source Authority (Max 30)
    const sourceAuthority = sourceTier === 'TIER_1' ? 30 : sourceTier === 'TIER_2' ? 25 : 15;

    // 2. Data Completeness (Max 30)
    let completed = 10; // baseline
    if (reactionStatus === 'VERIFIED') completed += 10;
    if (hasFno) completed += 10;
    const dataCompleteness = completed;

    // 3. Cross-Referencing Evidence volume (Max 20)
    const crossReferencing = Math.min(20, evidence.length * 5);

    // 4. Temporal Freshness (Max 20)
    const ageMs = Date.now() - new Date(publishedAt).getTime();
    const ageMin = Math.max(0, Math.floor(ageMs / (1000 * 60)));
    const temporalFreshness = Math.max(0, 20 - Math.min(20, Math.floor(ageMin / 30)));

    const confidenceScore = sourceAuthority + dataCompleteness + crossReferencing + temporalFreshness;

    let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE' = 'MEDIUM';
    if (confidenceScore >= 75) confidenceLevel = 'HIGH';
    else if (confidenceScore >= 50) confidenceLevel = 'MEDIUM';
    else if (confidenceScore >= 30) confidenceLevel = 'LOW';
    else confidenceLevel = 'INSUFFICIENT_EVIDENCE';

    const confidenceReasons: string[] = [
      `Source publisher evaluated at Tier ${sourceTier === 'TIER_1' ? '1 (Official)' : sourceTier === 'TIER_2' ? '2 (Financial Media)' : '3 (General)'}.`,
      `Harvested ${evidence.length} distinct factual checkpoints.`,
      `Derivatives evidence is ${hasFno ? 'actively verified' : 'unavailable in source text'}.`
    ];

    return {
      confidenceScore,
      confidenceLevel,
      confidenceReasons
    };
  }

  /**
   * Identifies what elements of the event ATHENA does not know yet.
   */
  private static identifyUncertainties(body: string, reactionStatus: EvidenceState, hasFno: boolean): string[] {
    const uncertainties: string[] = [];
    const lower = body.toLowerCase();

    if (reactionStatus !== 'VERIFIED') {
      uncertainties.push('Post-event intraday stock price response and volume spikes not recorded in text.');
    }
    if (!hasFno) {
      uncertainties.push('Derivatives open interest, PCR, and option chain boundaries unstated.');
    }
    if (!lower.includes('valuation') && !lower.includes('pe ratio') && !lower.includes('ev/ebitda')) {
      uncertainties.push('Detailed valuation multiples and comparative peer premium/discount metrics missing.');
    }
    if (!lower.includes('promoter') && !lower.includes('institutional holding')) {
      uncertainties.push('Promoter pledging changes or bulk institutional buyer footprints unspecified.');
    }

    return uncertainties;
  }

  /**
   * Formulates specific conditions to monitor going forward.
   */
  private static determineWhatToMonitor(eventType: TraderIntelligenceEventType, body: string): string[] {
    const monitors: string[] = [];
    const lower = body.toLowerCase();

    switch (eventType) {
      case 'EARNINGS':
      case 'REVENUE_UPDATE':
      case 'PROFIT_UPDATE':
        monitors.push('Monitor sequential operating margin stability and cost control trajectory.');
        monitors.push('Watch for official post-earnings management conference call commentary.');
        break;
      case 'ORDER_WIN':
        monitors.push('Monitor official project execution schedule and milestone guidelines.');
        monitors.push('Track quarterly orderbook expansion metrics.');
        break;
      case 'REGULATORY_ACTION':
        monitors.push('Monitor SEBI/RBI final adjudication hearings and penalty payments.');
        monitors.push('Watch for corporate management governance and compliance reviews.');
        break;
      case 'ACQUISITION':
      case 'M_AND_A':
        monitors.push('Monitor balance sheet debt leverage changes post-acquisition.');
        monitors.push('Track integration timelines and synergy realization benefits.');
        break;
      default:
        monitors.push('Monitor volume accumulation around critical support/resistance boundaries.');
        monitors.push('Watch for subsequent exchanges and regulatory disclosure filings.');
    }

    return monitors;
  }

  /**
   * Builds executive summary representation.
   */
  private static buildExecutiveInterpretation(headline: string, eventType: TraderIntelligenceEventType, mechanism: string, impact: string): string {
    return `${headline}. This event is classified as ${eventType}, operating via the fundamental transmission mechanism of ${mechanism.replace('Transmission mechanism: ', '')}. Market price reaction currently evaluates to ${impact}.`;
  }
}
