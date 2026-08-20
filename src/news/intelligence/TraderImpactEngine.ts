/**
 * ATHENA NEWS ENGINE — STAGE 7
 * TraderImpactEngine: Deterministic financial intelligence & actionable impact evaluation.
 */

import {
  ImpactDirection,
  ImpactMagnitude,
  TimeHorizon,
  EventType,
  FNORelevance,
  FNOBias,
  RiskLevel,
  EvidenceStrength,
  ImpactRelationship,
  SymbolImpact,
  WhyThisMatters,
  TraderIntelligence,
  SymbolIntelligenceSummary,
  SymbolResolutionState,
  EvidenceClass,
  ObservedMarketReaction,
  EntityAttribution,
  DecomposedEvent,
  EvidenceItem,
  ConfidenceScoreBreakdown,
  FNOEvidenceDetails,
  RewrittenTraderTakeaway
} from '../types/TraderIntelligence';
import { SymbolExtractor, ExtractedEntity } from './SymbolExtractor';
import { SectorIndexMapper } from './SectorIndexMapper';

export class TraderImpactEngine {
  private static FNO_SYMBOLS = new Set<string>([
    'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY',
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
    'ITC', 'KOTAKBANK', 'LT', 'HINDUNILVR', 'AXISBANK', 'TATAMOTORS', 'BAJFINANCE',
    'MARUTI', 'SUNPHARMA', 'TITAN', 'ULTRACEMCO', 'ASIANPAINT', 'NTPC', 'POWERGRID',
    'TATASTEEL', 'JSWSTEEL', 'COALINDIA', 'ADANIENT', 'ADANIPORTS', 'ONGC', 'M&M',
    'HCLTECH', 'TECHM', 'WIPRO', 'BAJAJFINSV', 'DRREDDY', 'CIPLA', 'APOLLOHOSP',
    'DIVISLAB', 'EICHERMOT', 'HEROMOTOCO', 'BAJAJ-AUTO', 'GRASIM', 'INDUSINDBK',
    'NESTLEIND', 'BRITANNIA', 'TATACONSUM', 'VEDL', 'HAL', 'BEL', 'DLF', 'TRENT',
    'SIEMENS', 'ABB', 'PIDILITIND', 'VBL', 'IOC', 'BPCL', 'PFC', 'RECLTD', 'IRCTC',
    'POLYCAB', 'CHOLAFIN', 'SHRIRAMFIN', 'MUTHOOTFIN', 'FEDERALBNK', 'IDFCFIRSTB',
    'AUBANK', 'BANDHANBNK', 'PERSISTENT', 'COFORGE', 'MPHASIS', 'LTTS', 'TATACOMM',
    'JINDALSTEL', 'HINDALCO', 'NMDC', 'SAIL', 'NATIONALUM', 'TVSMOTOR', 'MOTHERSON',
    'ASHOKLEY', 'BALKRISIND', 'MRF', 'BOSCHLTD', 'LUPIN', 'AUROPHARMA', 'ALKEM',
    'TORNTPHARM', 'BIOCON', 'ZYDUSLIFE', 'GLENMARK', 'IPCALAB', 'LAURUSLABS',
    'ABBOTINDIA', 'MANAPPURAM', 'CANBK', 'BANKBARODA', 'PNB', 'UNIONBANK', 'LICHSGFIN'
  ]);

  private static EVENT_TAXONOMY_RULES: { type: EventType; keywords: string[]; priority: number }[] = [
    {
      type: EventType.BUYBACK,
      keywords: ['buyback', 'share repurchase', 'tender offer buyback'],
      priority: 100
    },
    {
      type: EventType.BONUS,
      keywords: ['bonus issue', 'bonus shares', 'bonus 1:', 'bonus 2:', 'bonus 1:1', 'bonus 2:1'],
      priority: 95
    },
    {
      type: EventType.SPLIT,
      keywords: ['stock split', 'sub-division of shares', 'split of shares', 'sub-divided from'],
      priority: 95
    },
    {
      type: EventType.DIVIDEND,
      keywords: ['dividend', 'interim dividend', 'final dividend', 'special dividend', 'payout per share'],
      priority: 90
    },
    {
      type: EventType.EARNINGS,
      keywords: ['q1', 'q2', 'q3', 'q4', 'quarterly net profit', 'net profit up', 'net profit down', 'net loss', 'pat jumps', 'revenue from operations', 'quarterly results', 'financial results', 'ebitda', 'ebit margin'],
      priority: 85
    },
    {
      type: EventType.GUIDANCE,
      keywords: ['guidance', 'revenue guidance', 'fy25 outlook', 'fy26 outlook', 'growth target', 'order inflow target', 'margin guidance'],
      priority: 80
    },
    {
      type: EventType.M_AND_A,
      keywords: ['acquisition', 'acquires', 'merger', 'amalgamation', 'takeover', 'stake sale', 'divestment', 'buys stake', 'sells stake'],
      priority: 75
    },
    {
      type: EventType.ORDER,
      keywords: ['order win', 'bags order', 'secures contract', 'wins contract', 'awarded order', 'order book', 'fresh order', 'loa'],
      priority: 70
    },
    {
      type: EventType.CONTRACT,
      keywords: ['signs agreement', 'deal win', 'multi-year contract', 'pact', 'mou signed', 'strategic partnership'],
      priority: 70
    },
    {
      type: EventType.IPO,
      keywords: ['ipo', 'initial public offering', 'listing day', 'ipo opens', 'ipo subscribed', 'anchor investors', 'ipo allotment', 'sme ipo'],
      priority: 65
    },
    {
      type: EventType.FUNDRAISING,
      keywords: ['qip', 'qualified institutional placement', 'rights issue', 'fundraising', 'preferential allotment', 'warrants', 'fccb'],
      priority: 65
    },
    {
      type: EventType.REGULATORY_ACTION,
      keywords: ['sebi', 'penalty', 'fine imposed', 'show cause notice', 'investigation', 'ed search', 'income tax raid', 'adjudication', 'barred from markets'],
      priority: 60
    },
    {
      type: EventType.CENTRAL_BANK,
      keywords: ['rbi', 'repo rate', 'mpc', 'monetary policy', 'crr', 'reverse repo', 'rate cut', 'rate hike', 'governor das'],
      priority: 60
    },
    {
      type: EventType.POLICY_CHANGE,
      keywords: ['cabinet approves', 'gst rate', 'customs duty', 'import duty', 'export tax', 'windfall tax', 'pli scheme', 'govt policy'],
      priority: 55
    },
    {
      type: EventType.MANAGEMENT_CHANGE,
      keywords: ['resignation', 'resigns', 'appointed as ceo', 'new md & ceo', 'chief executive officer', 'cfo steps down', 'management rejig'],
      priority: 50
    },
    {
      type: EventType.RATING_CHANGE,
      keywords: ['rating upgrade', 'rating downgrade', 'crisil', 'icra', 'care ratings', 'moodys', 's&p', 'fitch', 'target price upgraded', 'target price cut', 'recommends avoid', 'recommends buy', 'recommends subscribe'],
      priority: 45
    },
    {
      type: EventType.CREDIT_EVENT,
      keywords: ['debt default', 'npa', 'insolvency', 'nclt', 'bankruptcy', 'debt restructuring', 'delayed payment'],
      priority: 45
    },
    {
      type: EventType.MACRO_DATA,
      keywords: ['cpi inflation', 'wpi', 'gdp growth', 'iip', 'trade deficit', 'current account deficit', 'manufacturing pmi', 'services pmi'],
      priority: 40
    },
    {
      type: EventType.COMMODITY_EVENT,
      keywords: ['brent crude', 'crude oil', 'gold prices', 'silver prices', 'natural gas', 'opec', 'base metals', 'copper'],
      priority: 35
    },
    {
      type: EventType.GLOBAL_MARKET_EVENT,
      keywords: ['us fed', 'wall street', 'dow jones', 'nasdaq', 'bond yield', 'geopolitical', 'red sea', 'china stimulus'],
      priority: 30
    },
    {
      type: EventType.LEGAL_EVENT,
      keywords: ['supreme court', 'high court', 'nclat', 'arbitration award', 'litigation', 'lawsuit', 'injunction'],
      priority: 25
    },
    {
      type: EventType.CORPORATE_GOVERNANCE,
      keywords: ['auditor resigns', 'forensic audit', 'whistleblower', 'promoter pledging', 'promoter share sale', 'governance lapse'],
      priority: 25
    },
    {
      type: EventType.TECHNOLOGY_EVENT,
      keywords: ['ai platform', 'genai', 'cloud migration', 'data center', 'cyberattack', 'chipset', 'semiconductor plant'],
      priority: 20
    },
    {
      type: EventType.MARKET_MOVEMENT,
      keywords: ['nifty hits record high', 'sensex surges', 'market rally', 'market crash', 'fii buying', 'dii inflow', 'circuit limit'],
      priority: 15
    }
  ];

  /**
   * Main transformer entry point (Stage 7.2 Compliant).
   */
  public static transform(
    article: {
      id?: string;
      headline?: string;
      title?: string;
      body?: string;
      description?: string;
      publishedAt?: string;
      source?: { name?: string; publisher?: string };
      sourceUrl?: string;
      category?: string;
      primaryCategory?: string;
      symbol?: string | null;
      fnoEligible?: boolean;
    }
  ): TraderIntelligence {
    const articleId = article.id || `art_${Math.random().toString(36).substring(2, 10)}`;
    const headline = (article.headline || article.title || '').trim();
    const body = (article.body || article.description || '').trim();
    const fullText = `${headline} ${body}`.toLowerCase();
    const publishedAt = article.publishedAt || new Date().toISOString();

    // 1. Calculate Freshness
    const ageMs = Date.now() - new Date(publishedAt).getTime();
    const freshnessMinutes = Math.max(0, Math.floor(ageMs / (1000 * 60)));

    // 2. Entity Attribution & Symbol Resolution State
    const publisher = article.source?.name || article.source?.publisher || 'Market Wire';
    const sourceAuthority = this.evaluateSourceAuthority(publisher);

    const extracted = SymbolExtractor.extract(headline, body);
    const brokerages = SymbolExtractor.extractBrokerages(headline, body);

    const { entityAttribution, symbolResolutionState } = this.buildEntityAttribution(
      headline,
      body,
      extracted,
      brokerages,
      publisher
    );

    const primarySymbol = article.symbol || entityAttribution.primaryAffectedEntity.symbol;
    const secondarySymbols = entityAttribution.secondaryAffectedEntities
      .map(e => e.symbol)
      .filter((s): s is string => s !== null && s !== primarySymbol);

    // 3. Sector & Index Hierarchy
    const hierarchy = SectorIndexMapper.map(body, headline, extracted);
    const affectedSymbols = Array.from(new Set([
      ...(primarySymbol ? [primarySymbol] : []),
      ...secondarySymbols,
      ...hierarchy.companies
    ]));
    const affectedSectors = Array.from(new Set(hierarchy.sectors));
    const affectedIndices = Array.from(new Set(hierarchy.indices));

    // 4. Multi-Entity Article Decomposition
    const decomposedEvents = this.decomposeMultiEntityArticle(headline, body, extracted);

    // 5. Observed Market Reaction vs Trading Recommendation Separation
    const observedMarketReaction = this.extractObservedMarketReaction(headline, body);

    // 6. Classify Event Type
    const eventType = this.classifyEventType(headline, body);

    // 7. Calculate Impact Direction, Magnitude, Time Horizon, and Recalibrate
    const { impactDirection, impactMagnitude, timeHorizon, evidence, evidenceStrength, impactReasoning } =
      this.evaluateAndRecalibrateImpact(headline, body, eventType, observedMarketReaction);

    // 8. F&O Derivatives Intelligence
    const fnoDetails = this.evaluateFNODetails(
      affectedSymbols,
      affectedIndices,
      impactDirection,
      impactMagnitude,
      eventType,
      fullText,
      evidenceStrength
    );

    // 9. Explainable Confidence Score Calculation
    const confidenceBreakdown = this.computeExplainableConfidence(
      sourceAuthority,
      symbolResolutionState,
      eventType,
      evidence.length,
      observedMarketReaction !== ObservedMarketReaction.UNKNOWN,
      fnoDetails.fnoEvidencePresent,
      evidenceStrength
    );

    // 10. Fact / Derived / Interpretation Evidence Model
    const { evidenceItems, whatRemainsUnknown } = this.buildEvidenceModel(
      headline,
      body,
      evidence,
      fnoDetails
    );

    // 11. Rewritten Evidence-Grounded Trader Takeaway
    const takeawayStructure = this.buildRewrittenTraderTakeaway(
      entityAttribution.primaryAffectedEntity.name,
      primarySymbol,
      symbolResolutionState,
      brokerages,
      headline,
      eventType,
      observedMarketReaction,
      impactDirection,
      fnoDetails.cePeBias,
      fnoDetails.fnoEvidencePresent,
      whatRemainsUnknown
    );

    // 12. Urgency & Breaking Status
    const isBreaking = this.detectBreaking(headline, eventType, impactMagnitude, freshnessMinutes);
    const urgency = isBreaking
      ? (impactMagnitude === ImpactMagnitude.VERY_HIGH ? 'VERY_HIGH' : 'HIGH')
      : (impactMagnitude === ImpactMagnitude.HIGH ? 'HIGH' : 'MEDIUM');

    // 13. Structured "Why This Matters"
    const whyThisMatters = this.buildWhyThisMatters(
      headline,
      body,
      eventType,
      impactDirection,
      impactMagnitude,
      affectedSymbols,
      affectedSectors,
      affectedIndices,
      evidence,
      evidenceStrength,
      evidenceItems,
      whatRemainsUnknown
    );

    // 14. Symbol Impact Graph
    const symbolImpact: SymbolImpact = {
      primarySymbol,
      secondarySymbols,
      sector: affectedSectors[0] || null,
      relatedIndex: affectedIndices[0] || (primarySymbol && this.FNO_SYMBOLS.has(primarySymbol) ? 'NIFTY 50' : null),
      directImpact: primarySymbol ? [primarySymbol] : affectedSymbols.slice(0, 3),
      indirectImpact: secondarySymbols.length > 0 ? secondarySymbols : (affectedSectors.length > 0 ? [affectedSectors[0]] : []),
      relationship: primarySymbol ? ImpactRelationship.DIRECT : ImpactRelationship.INDIRECT
    };

    return {
      articleId,
      headline,
      marketImpact: impactDirection,
      impactDirection,
      impactMagnitude,
      timeHorizon,
      affectedSymbols,
      affectedSectors,
      affectedIndices,
      fnoRelevance: fnoDetails.isFnoEligible ? (fnoDetails.fnoEvidencePresent || impactMagnitude === ImpactMagnitude.VERY_HIGH || impactMagnitude === ImpactMagnitude.HIGH ? FNORelevance.HIGH : FNORelevance.NONE) : FNORelevance.NONE,
      cePeBias: fnoDetails.cePeBias,
      biasConfidence: confidenceBreakdown.totalScore,
      ivImpactRisk: fnoDetails.isFnoEligible ? (eventType === EventType.EARNINGS || eventType === EventType.CENTRAL_BANK || eventType === EventType.REGULATORY_ACTION ? RiskLevel.VERY_HIGH : RiskLevel.MEDIUM) : RiskLevel.LOW,
      gapRisk: fnoDetails.isFnoEligible ? (eventType === EventType.CENTRAL_BANK || eventType === EventType.BUYBACK ? RiskLevel.HIGH : RiskLevel.MEDIUM) : RiskLevel.LOW,
      eventRisk: eventType === EventType.REGULATORY_ACTION ? RiskLevel.VERY_HIGH : RiskLevel.MEDIUM,
      eventType,
      urgency,
      sourceAuthority,
      freshnessMinutes,
      evidenceStrength,
      traderTakeaway: takeawayStructure.formattedText,
      whyThisMatters,
      symbolImpact,
      isBreaking,
      generatedAt: new Date().toISOString(),
      engine: 'deterministic_trader_v7',

      // Stage 7.2 Extensions
      symbolResolutionState,
      entityAttribution,
      decomposedEvents,
      observedMarketReaction,
      impactReasoning,
      confidenceBreakdown,
      fnoDetails,
      takeawayStructure,
      whatRemainsUnknown,
      evidenceModel: evidenceItems
    };
  }

  /**
   * Builds Stage 7.2 Entity Attribution with 0% Brokerage Contamination
   */
  private static buildEntityAttribution(
    headline: string,
    body: string,
    extracted: ExtractedEntity[],
    brokerages: string[],
    publisher: string
  ): { entityAttribution: EntityAttribution; symbolResolutionState: SymbolResolutionState } {
    const fullText = `${headline} ${body}`.toLowerCase();

    // Identify Regulators
    const regulators: string[] = [];
    if (/sebi|sebi notice/i.test(fullText)) regulators.push('SEBI');
    if (/rbi|monetary policy|repo rate/i.test(fullText)) regulators.push('RBI');
    if (/cci|competition commission/i.test(fullText)) regulators.push('CCI');
    if (/irdai/i.test(fullText)) regulators.push('IRDAI');
    if (/us fda|fda warning/i.test(fullText)) regulators.push('US FDA');

    // Identify Exchanges
    const exchanges: string[] = [];
    if (/\bnse\b/i.test(fullText)) exchanges.push('NSE');
    if (/\bbse\b/i.test(fullText)) exchanges.push('BSE');
    if (/\bmcx\b/i.test(fullText)) exchanges.push('MCX');

    // Identify Promoters
    const promoters: string[] = [];
    if (/promoter|promoter group|promoter pledging/i.test(fullText)) {
      promoters.push('Promoters');
    }

    // Determine primary and secondary company entities
    if (extracted.length > 0) {
      const primary = extracted[0];
      const secondary = extracted.slice(1).map(e => ({
        name: e.companyName,
        symbol: e.nseSymbol,
        resolutionState: SymbolResolutionState.LISTED_SYMBOL_CONFIRMED
      }));

      const state = extracted.length > 1
        ? SymbolResolutionState.MULTIPLE_SYMBOLS
        : SymbolResolutionState.LISTED_SYMBOL_CONFIRMED;

      return {
        entityAttribution: {
          primaryAffectedEntity: {
            name: primary.companyName,
            symbol: primary.nseSymbol,
            resolutionState: SymbolResolutionState.LISTED_SYMBOL_CONFIRMED,
            entityType: 'COMPANY'
          },
          secondaryAffectedEntities: secondary,
          analystsAndBrokerages: brokerages,
          promoters,
          regulators,
          exchanges,
          indices: primary.indices || ['NIFTY 50'],
          sectors: primary.sector ? [primary.sector] : [],
          unrelatedEntities: []
        },
        symbolResolutionState: state
      };
    }

    // No listed ticker matched: check unlisted / IPO subject entity
    const unlistedSubject = SymbolExtractor.extractUnlistedSubjectEntity(headline);
    if (unlistedSubject) {
      return {
        entityAttribution: {
          primaryAffectedEntity: {
            name: unlistedSubject,
            symbol: null,
            resolutionState: SymbolResolutionState.UNLISTED_OR_NO_TRADING_SYMBOL,
            entityType: 'UNLISTED'
          },
          secondaryAffectedEntities: [],
          analystsAndBrokerages: brokerages,
          promoters,
          regulators,
          exchanges,
          indices: ['NIFTY 50'],
          sectors: [],
          unrelatedEntities: []
        },
        symbolResolutionState: SymbolResolutionState.UNLISTED_OR_NO_TRADING_SYMBOL
      };
    }

    // Default Macro / Unresolved
    return {
      entityAttribution: {
        primaryAffectedEntity: {
          name: 'General Market / Macro',
          symbol: null,
          resolutionState: SymbolResolutionState.ENTITY_UNRESOLVED,
          entityType: 'MACRO'
        },
        secondaryAffectedEntities: [],
        analystsAndBrokerages: brokerages,
        promoters,
        regulators,
        exchanges,
        indices: ['NIFTY 50'],
        sectors: [],
        unrelatedEntities: []
      },
      symbolResolutionState: SymbolResolutionState.ENTITY_UNRESOLVED
    };
  }

  /**
   * Decomposes multi-entity stock articles into individual stock events.
   */
  private static decomposeMultiEntityArticle(
    headline: string,
    body: string,
    extracted: ExtractedEntity[]
  ): DecomposedEvent[] {
    const text = `${headline} ${body}`;
    const clauses = text.split(/;|\n|\||•/).map(s => s.trim()).filter(s => s.length > 10);
    const events: DecomposedEvent[] = [];

    for (const clause of clauses) {
      // Find matching entity for this clause
      for (const ent of extracted) {
        const lowerClause = clause.toLowerCase();
        if (
          lowerClause.includes(ent.nseSymbol.toLowerCase()) ||
          lowerClause.includes(ent.companyName.toLowerCase()) ||
          ent.companyName.toLowerCase().split(' ')[0].length > 3 && lowerClause.includes(ent.companyName.toLowerCase().split(' ')[0])
        ) {
          let reaction = ObservedMarketReaction.UNKNOWN;
          if (/zoom|surge|up|gain|rise|soar|jump|high/i.test(lowerClause)) reaction = ObservedMarketReaction.BULLISH;
          else if (/fall|drop|down|slump|tumble|loss|decline|low/i.test(lowerClause)) reaction = ObservedMarketReaction.BEARISH;

          let impact = ImpactDirection.NEUTRAL;
          if (reaction === ObservedMarketReaction.BULLISH) impact = ImpactDirection.BULLISH;
          else if (reaction === ObservedMarketReaction.BEARISH) impact = ImpactDirection.BEARISH;

          events.push({
            entityName: ent.companyName,
            symbol: ent.nseSymbol,
            symbolResolutionState: SymbolResolutionState.LISTED_SYMBOL_CONFIRMED,
            eventType: lowerClause.includes('block deal') ? EventType.M_AND_A : (lowerClause.includes('qip') ? EventType.FUNDRAISING : EventType.OTHER),
            sourceEvidence: clause,
            observedPriceReaction: reaction,
            marketImpact: impact,
            traderRelevance: 'HIGH'
          });
          break;
        }
      }
    }

    return events;
  }

  /**
   * Extracts factual price movements stated in the source text.
   */
  private static extractObservedMarketReaction(headline: string, body: string): ObservedMarketReaction {
    const text = `${headline} ${body}`.toLowerCase();

    // Check explicit share price / stock price movements first
    const bearishPricePattern = /(shares?|stock|script|counter|equity)\s+(fell|falls?|dropped?|slipped?|tumbled?|slumped?|down|declined?|plunged?|lost)\s*(\d+(\.\d+)?%|\d+\s*points?)?|(shares?|stock)\s+(fall|drop|slip|tumble|slump|decline)|hits? lower circuit|trading down/i;
    const bullishPricePattern = /(shares?|stock|script|counter|equity)\s+(rose|rises?|gained?|surged?|jumped?|soared?|up|rallied)\s*(\d+(\.\d+)?%|\d+\s*points?)?|(shares?|stock)\s+(rise|gain|surge|jump|soar|rally)|hits? 52-week high|trading up/i;

    const hasBearishPrice = bearishPricePattern.test(text);
    const hasBullishPrice = bullishPricePattern.test(text);

    if (hasBearishPrice && !hasBullishPrice) {
      return ObservedMarketReaction.BEARISH;
    }
    if (hasBullishPrice && !hasBearishPrice) {
      return ObservedMarketReaction.BULLISH;
    }
    if (hasBearishPrice && hasBullishPrice) {
      return ObservedMarketReaction.MIXED;
    }

    // General movement checks if explicit stock verb wasn't matched
    if (/tumbles?|slumps?|(falls?|fell|drops?|dropped|slips?|slipped|declines?|tumbles?|plunges?)\s+(\d+(\.\d+)?%|\d+\s*points?)/i.test(text)) {
      return ObservedMarketReaction.BEARISH;
    }
    if (/surged?|zooms?|jumps?|rallies|rallied|soars?|hits? 52-week high|(gains?|rose|rises?)\s+(\d+(\.\d+)?%|\d+\s*points?)/i.test(text)) {
      return ObservedMarketReaction.BULLISH;
    }

    if (/trades? flat|unchanged|steady|rangebound/i.test(text)) {
      return ObservedMarketReaction.NEUTRAL;
    }

    return ObservedMarketReaction.UNKNOWN;
  }

  /**
   * Evaluates and recalibrates market impact for logical consistency.
   */
  private static evaluateAndRecalibrateImpact(
    headline: string,
    body: string,
    eventType: EventType,
    observedReaction: ObservedMarketReaction
  ): {
    impactDirection: ImpactDirection;
    impactMagnitude: ImpactMagnitude;
    timeHorizon: TimeHorizon;
    evidence: string[];
    evidenceStrength: EvidenceStrength;
    impactReasoning: string;
  } {
    const base = this.evaluateImpact(headline, body, eventType);

    let impactDirection = base.impactDirection;
    let impactMagnitude = base.impactMagnitude;
    let impactReasoning = '';

    // Synchronize observed price reaction with impact direction when factual reaction is present
    if (observedReaction === ObservedMarketReaction.BEARISH && base.impactDirection === ImpactDirection.BULLISH) {
      impactDirection = ImpactDirection.MIXED;
      impactReasoning = 'Positive event catalyst offset by documented negative price reaction. Recalibrated directional impact to MIXED.';
    } else if (observedReaction === ObservedMarketReaction.BULLISH && base.impactDirection === ImpactDirection.BEARISH) {
      impactDirection = ImpactDirection.MIXED;
      impactReasoning = 'Negative event catalyst offset by documented positive price movement. Recalibrated directional impact to MIXED.';
    } else if (observedReaction === ObservedMarketReaction.BULLISH && impactDirection === ImpactDirection.NEUTRAL) {
      impactDirection = ImpactDirection.BULLISH;
      impactReasoning = 'Documented positive market price movement aligns with bullish headline triggers.';
    } else if (observedReaction === ObservedMarketReaction.BEARISH && impactDirection === ImpactDirection.NEUTRAL) {
      impactDirection = ImpactDirection.BEARISH;
      impactReasoning = 'Documented price decline aligns with negative corporate development.';
    } else {
      impactReasoning = `Market impact evaluated to ${impactDirection} based on ${eventType} classification and source evidence.`;
    }

    // Prevent unexplained NEUTRAL + VERY_HIGH
    if (impactDirection === ImpactDirection.NEUTRAL && impactMagnitude === ImpactMagnitude.VERY_HIGH) {
      impactMagnitude = ImpactMagnitude.MEDIUM;
      impactReasoning += ' Recalibrated impact magnitude to MEDIUM due to neutral directional signal.';
    }

    return {
      impactDirection,
      impactMagnitude,
      timeHorizon: base.timeHorizon,
      evidence: base.evidence,
      evidenceStrength: base.evidenceStrength,
      impactReasoning
    };
  }

  /**
   * F&O Evidence Details & Isolation
   */
  private static evaluateFNODetails(
    symbols: string[],
    indices: string[],
    impact: ImpactDirection,
    magnitude: ImpactMagnitude,
    eventType: EventType,
    fullText: string,
    evidenceStrength: EvidenceStrength
  ): FNOEvidenceDetails {
    const fnoSymbolsFound = symbols.filter(s => this.FNO_SYMBOLS.has(s.toUpperCase()));
    const isIndexInvolved = indices.some(idx => idx.includes('NIFTY') || idx.includes('BANKNIFTY'));
    const isFnoEligible = fnoSymbolsFound.length > 0 || isIndexInvolved;

    const detectedFnoMetrics: string[] = [];
    if (/open interest|\boi\b/i.test(fullText)) detectedFnoMetrics.push('OPEN_INTEREST');
    if (/strike|call option|put option/i.test(fullText)) detectedFnoMetrics.push('STRIKE_DATA');
    if (/implied volatility|\biv\b/i.test(fullText)) detectedFnoMetrics.push('IMPLIED_VOLATILITY');
    if (/put call ratio|\bpcr\b/i.test(fullText)) detectedFnoMetrics.push('PUT_CALL_RATIO');
    if (/futures basis|premium/i.test(fullText)) detectedFnoMetrics.push('FUTURES_BASIS');

    const fnoEvidencePresent = detectedFnoMetrics.length > 0;

    let cePeBias = FNOBias.INSUFFICIENT_INFORMATION;
    let biasReasoning = '';

    if (!isFnoEligible) {
      biasReasoning = 'Underlying security is not part of the active F&O derivatives universe.';
    } else if (!fnoEvidencePresent) {
      biasReasoning = 'Underlying is F&O eligible, but source text contains no explicit open interest or options market positioning evidence. Defaulting bias to INSUFFICIENT_INFORMATION.';
    } else if (/call option|\bce\b|call open interest|call buying|call buildup|call writing/i.test(fullText)) {
      cePeBias = FNOBias.CE_BIAS;
      biasReasoning = 'Explicit Call Option (CE) derivatives positioning and open interest buildup detected in source text.';
    } else if (/put option|\bpe\b|put open interest|put buying|put buildup|put writing/i.test(fullText)) {
      cePeBias = FNOBias.PE_BIAS;
      biasReasoning = 'Explicit Put Option (PE) derivatives positioning and open interest buildup detected in source text.';
    } else if (impact === ImpactDirection.BULLISH) {
      cePeBias = FNOBias.CE_BIAS;
      biasReasoning = 'Positive directional catalyst supported by explicit derivatives market context.';
    } else if (impact === ImpactDirection.BEARISH) {
      cePeBias = FNOBias.PE_BIAS;
      biasReasoning = 'Negative directional catalyst supported by explicit derivatives market context.';
    } else {
      cePeBias = FNOBias.NEUTRAL_BIAS;
      biasReasoning = 'Neutral derivatives positioning indicated by source text metrics.';
    }

    return {
      isFnoEligible,
      fnoEvidencePresent,
      detectedFnoMetrics,
      cePeBias,
      biasReasoning
    };
  }

  /**
   * Calculates an explainable, factor-based confidence score breakdown.
   */
  private static computeExplainableConfidence(
    sourceAuthority: number,
    symbolResolutionState: SymbolResolutionState,
    eventType: EventType,
    evidenceCount: number,
    hasObservedReaction: boolean,
    fnoEvidencePresent: boolean,
    evidenceStrength: EvidenceStrength
  ): ConfidenceScoreBreakdown {
    const sourceAuthorityScore = Math.round((sourceAuthority / 100) * 25);

    let directEntityMatchScore = 10;
    if (symbolResolutionState === SymbolResolutionState.LISTED_SYMBOL_CONFIRMED) directEntityMatchScore = 25;
    else if (symbolResolutionState === SymbolResolutionState.MULTIPLE_SYMBOLS) directEntityMatchScore = 20;
    else if (symbolResolutionState === SymbolResolutionState.UNLISTED_OR_NO_TRADING_SYMBOL) directEntityMatchScore = 15;

    const eventCertaintyScore = eventType !== EventType.OTHER ? 20 : 10;
    const quantitativeEvidenceScore = evidenceCount >= 2 ? 15 : (evidenceCount === 1 ? 10 : 5);
    const marketReactionScore = hasObservedReaction ? 15 : 5;

    const totalScore = sourceAuthorityScore + directEntityMatchScore + eventCertaintyScore + quantitativeEvidenceScore + marketReactionScore;

    let rating: 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT' = 'MODERATE';
    if (totalScore >= 75) rating = 'HIGH';
    else if (totalScore >= 50) rating = 'MODERATE';
    else if (totalScore >= 30) rating = 'LOW';
    else rating = 'INSUFFICIENT';

    const reasoning = `Confidence factors: Source Authority (${sourceAuthorityScore}/25), Entity Match (${directEntityMatchScore}/25), Event Certainty (${eventCertaintyScore}/20), Quantitative Evidence (${quantitativeEvidenceScore}/15), Price Reaction (${marketReactionScore}/15). Total Score: ${totalScore}/100 (${rating}).`;

    return {
      sourceAuthorityScore,
      directEntityMatchScore,
      eventCertaintyScore,
      quantitativeEvidenceScore,
      marketReactionScore,
      totalScore,
      rating,
      reasoning
    };
  }

  /**
   * Evidence Model classifier (FACT, DERIVED, INTERPRETATION, UNSUPPORTED)
   */
  private static buildEvidenceModel(
    headline: string,
    body: string,
    evidence: string[],
    fnoDetails: FNOEvidenceDetails
  ): { evidenceItems: EvidenceItem[]; whatRemainsUnknown: string[] } {
    const items: EvidenceItem[] = [];
    const unknowns: string[] = [];

    // Headline is a direct source fact
    items.push({
      text: headline,
      classification: EvidenceClass.FACT,
      sourceLocation: 'HEADLINE',
      confidence: 100
    });

    for (const ev of evidence) {
      items.push({
        text: ev,
        classification: EvidenceClass.FACT,
        sourceLocation: 'BODY',
        confidence: 90
      });
    }

    if (fnoDetails.fnoEvidencePresent) {
      items.push({
        text: `Derivatives Metrics Detected: ${fnoDetails.detectedFnoMetrics.join(', ')}`,
        classification: EvidenceClass.DERIVED,
        sourceLocation: 'BODY',
        confidence: 85
      });
    } else {
      unknowns.push('Explicit Open Interest and options strike positioning not reported in source article.');
    }

    if (!body || body.length < 50) {
      unknowns.push('Detailed financial breakdown and valuation multiples unstated in brief wire report.');
    }

    return {
      evidenceItems: items,
      whatRemainsUnknown: unknowns
    };
  }

  /**
   * Builds an evidence-grounded 3-part trader takeaway.
   */
  private static buildRewrittenTraderTakeaway(
    primaryEntityName: string,
    primarySymbol: string | null,
    symbolState: SymbolResolutionState,
    brokerages: string[],
    headline: string,
    eventType: EventType,
    observedReaction: ObservedMarketReaction,
    impactDirection: ImpactDirection,
    cePeBias: FNOBias,
    fnoEvidencePresent: boolean,
    whatRemainsUnknown: string[]
  ): RewrittenTraderTakeaway {
    const entityLabel = primarySymbol ? `[${primarySymbol}]` : primaryEntityName;

    let traderContext = `${entityLabel}: ${headline}. `;
    if (brokerages.length > 0) {
      traderContext += `Analyst / Brokerage coverage noted from ${brokerages.join(', ')}. `;
    }
    if (observedReaction !== ObservedMarketReaction.UNKNOWN) {
      traderContext += `Observed market reaction is ${observedReaction}. `;
    }

    let marketDirection = '';
    if (cePeBias === FNOBias.CE_BIAS) {
      marketDirection = 'Derivatives evidence shows positive Call Option (CE) bias.';
    } else if (cePeBias === FNOBias.PE_BIAS) {
      marketDirection = 'Derivatives evidence shows Put Option (PE) bias.';
    } else {
      marketDirection = 'No reliable CE/PE directional trade instruction established from article source text.';
    }

    const whatToMonitor = `Monitor key triggers around ${eventType} announcement, volume participation at open, and subsequent official filings.`;

    const formattedText = `**Trader Context**: ${traderContext.trim()}\n**Market Direction**: ${marketDirection}\n**What to Monitor**: ${whatToMonitor}`;

    return {
      traderContext,
      marketDirection,
      whatToMonitor,
      formattedText
    };
  }

  /**
   * Deterministic Event Classification.
   */
  private static classifyEventType(headline: string, body: string): EventType {
    const text = `${headline} ${body}`.toLowerCase();

    for (const rule of this.EVENT_TAXONOMY_RULES) {
      for (const kw of rule.keywords) {
        if (text.includes(kw)) {
          return rule.type;
        }
      }
    }

    return EventType.OTHER;
  }

  /**
   * Deterministic Market Impact Evaluation.
   */
  private static evaluateImpact(
    headline: string,
    body: string,
    eventType: EventType
  ): {
    impactDirection: ImpactDirection;
    impactMagnitude: ImpactMagnitude;
    timeHorizon: TimeHorizon;
    evidence: string[];
    evidenceStrength: EvidenceStrength;
  } {
    const text = `${headline} ${body}`.toLowerCase();
    const evidence: string[] = [];

    // Check Dilution / Debt Overhang first
    if (text.includes('dilution') || text.includes('preferential allotment') || text.includes('heavy debt')) {
      evidence.push('Equity dilution or high leverage risk identified in corporate action.');
      return {
        impactDirection: ImpactDirection.BEARISH,
        impactMagnitude: ImpactMagnitude.MEDIUM,
        timeHorizon: TimeHorizon.SWING,
        evidence,
        evidenceStrength: EvidenceStrength.STRONG
      };
    }

    const bullishSignals = [
      'net profit up', 'pat jumps', 'profit rises', 'revenue up', 'beats estimates',
      'order win', 'bags order', 'wins contract', 'secures contract', 'secures order',
      'signs contract', 'signs deal', 'signs pact', 'contract win', 'deal win', 'enterprise contract',
      'bonus issue', 'dividend declared', 'buyback', 'upgrade', 'target price raised', 'rate cut',
      'cuts repo rate', 'repo rate cut', 'cuts rate', 'cuts rates', 'rate reduction',
      'stimulate growth', 'margin expansion', 'record high', 'all-time high', 'securities clearance',
      'relief from tribunal', 'liquidity infusion'
    ];

    const bearishSignals = [
      'net profit down', 'net loss', 'profit falls', 'revenue down', 'misses estimates',
      'penalty', 'fine imposed', 'sebi notice', 'investigation', 'ed raid',
      'resignation of ceo', 'auditor resigns', 'debt default', 'downgrade',
      'guidance cut', 'margin compression', 'windfall tax', 'import duty hike',
      'hikes repo rate', 'rate hike', 'rate increase', 'tightens liquidity'
    ];

    let bullCount = 0;
    let bearCount = 0;

    for (const s of bullishSignals) {
      if (text.includes(s)) {
        bullCount++;
        evidence.push(`Bullish indicator: '${s}' detected in article text.`);
      }
    }

    for (const s of bearishSignals) {
      if (text.includes(s)) {
        bearCount++;
        evidence.push(`Bearish indicator: '${s}' detected in article text.`);
      }
    }

    // Direction calculation
    let impactDirection: ImpactDirection = ImpactDirection.UNKNOWN;
    if (bullCount > 0 && bearCount === 0) {
      impactDirection = ImpactDirection.BULLISH;
    } else if (bearCount > 0 && bullCount === 0) {
      impactDirection = ImpactDirection.BEARISH;
    } else if (bullCount > 0 && bearCount > 0) {
      impactDirection = ImpactDirection.MIXED;
    } else {
      impactDirection = ImpactDirection.NEUTRAL;
    }

    // Magnitude calculation
    let impactMagnitude: ImpactMagnitude = ImpactMagnitude.LOW;
    if (
      eventType === EventType.CENTRAL_BANK ||
      eventType === EventType.REGULATORY_ACTION ||
      eventType === EventType.BUYBACK ||
      eventType === EventType.CREDIT_EVENT ||
      text.includes('100% jump') || text.includes('doubles') || text.includes('multi-year record') ||
      text.includes('rs 10,000 cr') || text.includes('$1b') || text.includes('billion')
    ) {
      impactMagnitude = ImpactMagnitude.VERY_HIGH;
    } else if (
      eventType === EventType.EARNINGS ||
      eventType === EventType.ORDER ||
      eventType === EventType.BONUS ||
      eventType === EventType.M_AND_A ||
      eventType === EventType.POLICY_CHANGE ||
      bullCount >= 2 || bearCount >= 2
    ) {
      impactMagnitude = ImpactMagnitude.HIGH;
    } else if (bullCount > 0 || bearCount > 0 || eventType === EventType.DIVIDEND) {
      impactMagnitude = ImpactMagnitude.MEDIUM;
    }

    // Time Horizon calculation
    let timeHorizon: TimeHorizon = TimeHorizon.INTRADAY;
    if (eventType === EventType.POLICY_CHANGE || eventType === EventType.CENTRAL_BANK) {
      timeHorizon = TimeHorizon.STRUCTURAL;
    } else if (eventType === EventType.M_AND_A || eventType === EventType.FUNDRAISING || eventType === EventType.BONUS) {
      timeHorizon = TimeHorizon.POSITIONAL;
    } else if (eventType === EventType.EARNINGS || eventType === EventType.GUIDANCE) {
      timeHorizon = TimeHorizon.SWING;
    } else if (eventType === EventType.ORDER || eventType === EventType.DIVIDEND) {
      timeHorizon = TimeHorizon.ONE_TO_THREE_DAYS;
    }

    const evidenceStrength = evidence.length >= 2 ? EvidenceStrength.STRONG : (evidence.length === 1 ? EvidenceStrength.MODERATE : EvidenceStrength.WEAK);

    return {
      impactDirection,
      impactMagnitude,
      timeHorizon,
      evidence: evidence.length > 0 ? evidence : ['General factual news reporting without extreme directional trigger.'],
      evidenceStrength
    };
  }

  /**
   * Evaluates publisher source authority.
   */
  private static evaluateSourceAuthority(publisher: string): number {
    const p = publisher.toUpperCase();
    if (p.includes('NSE') || p.includes('BSE') || p.includes('SEBI') || p.includes('RBI')) return 98;
    if (p.includes('REUTERS') || p.includes('BLOOMBERG')) return 94;
    if (p.includes('ECONOMIC TIMES') || p.includes('ET ') || p.includes('MINT') || p.includes('BUSINESS STANDARD')) return 90;
    if (p.includes('MONEYCONTROL') || p.includes('CNBC')) return 88;
    return 75;
  }

  /**
   * Detects high-priority breaking news without duplicating syndicated stories.
   */
  private static detectBreaking(
    headline: string,
    eventType: EventType,
    magnitude: ImpactMagnitude,
    freshnessMinutes: number
  ): boolean {
    const lower = headline.toLowerCase();
    const isExplicitBreaking = lower.includes('breaking') || lower.includes('flash') || lower.includes('alert');
    const isHighImpactEvent = (
      eventType === EventType.CENTRAL_BANK ||
      eventType === EventType.REGULATORY_ACTION ||
      eventType === EventType.BUYBACK
    ) && magnitude === ImpactMagnitude.VERY_HIGH;

    return (isExplicitBreaking || isHighImpactEvent) && freshnessMinutes <= 120;
  }

  /**
   * Structured "Why This Matters" Engine.
   */
  private static buildWhyThisMatters(
    headline: string,
    body: string,
    eventType: EventType,
    impactDirection: ImpactDirection,
    impactMagnitude: ImpactMagnitude,
    symbols: string[],
    sectors: string[],
    indices: string[],
    evidence: string[],
    evidenceStrength: EvidenceStrength,
    evidenceItems?: EvidenceItem[],
    whatRemainsUnknown?: string[]
  ): WhyThisMatters {
    const whatHappened = headline;

    let whyItMatters = '';
    switch (eventType) {
      case EventType.EARNINGS:
        whyItMatters = `Quarterly financial performance alters corporate valuation fundamentals, operating leverage, and future earnings trajectory.`;
        break;
      case EventType.ORDER:
      case EventType.CONTRACT:
        whyItMatters = `Order book expansion enhances revenue visibility over upcoming quarters and strengthens industry competitive moat.`;
        break;
      case EventType.BUYBACK:
        whyItMatters = `Share buyback reduces floating equity supply, improves EPS metrics, and signals management confidence in stock intrinsic value.`;
        break;
      case EventType.CENTRAL_BANK:
      case EventType.POLICY_CHANGE:
        whyItMatters = `Macro policy directives directly shift cost of capital, systemic liquidity, and broad market valuation multiples.`;
        break;
      case EventType.REGULATORY_ACTION:
        whyItMatters = `Compliance and enforcement actions pose immediate operational risk, reputational impact, and potential governance discount.`;
        break;
      default:
        whyItMatters = `Corporate and market developments influence near-term institutional order flow and positioning.`;
    }

    const traderImpact = `Market bias evaluates to ${impactDirection} with ${impactMagnitude} impact intensity. Watch for initial reaction at market open and volume participation at key technical thresholds.`;

    return {
      whatHappened,
      whyItMatters,
      whoIsAffected: {
        companies: symbols,
        sectors,
        indices,
        fnoInstruments: symbols.filter(s => this.FNO_SYMBOLS.has(s))
      },
      traderImpact,
      evidence,
      evidenceStrength,
      evidenceItems,
      whatRemainsUnknown
    };
  }

  /**
   * Aggregates symbol intelligence summary across articles.
   */
  public static generateSymbolSummary(
    symbol: string,
    articles: {
      id: string;
      headline?: string;
      title?: string;
      body?: string;
      publishedAt?: string;
      symbol?: string | null;
    }[]
  ): SymbolIntelligenceSummary {
    const resolved = SymbolExtractor.resolveSymbol(symbol);
    const sym = resolved ? resolved.nseSymbol : symbol.toUpperCase().trim();
    const isFno = resolved ? resolved.isFOEligible : this.FNO_SYMBOLS.has(sym);
    const aliases = resolved ? [resolved.nseSymbol, ...(resolved.aliases || [])].map(a => a.toUpperCase()) : [sym];

    const matchingArticles = articles.filter(a => {
      const h = (a.headline || a.title || '').toUpperCase();
      const b = (a.body || '').toUpperCase();
      const directSym = (a.symbol || '').toUpperCase();

      if (directSym === sym) return true;
      for (const al of aliases) {
        if (h.includes(al) || b.includes(al)) return true;
      }
      return false;
    });

    const transformed: TraderIntelligence[] = matchingArticles.map(a => this.transform(a));

    let bullish = 0;
    let bearish = 0;
    let neutral = 0;
    let mixed = 0;
    let totalConf = 0;

    for (const item of transformed) {
      if (item.impactDirection === ImpactDirection.BULLISH) bullish++;
      else if (item.impactDirection === ImpactDirection.BEARISH) bearish++;
      else if (item.impactDirection === ImpactDirection.MIXED) mixed++;
      else neutral++;

      totalConf += item.biasConfidence;
    }

    let dominantBias = FNOBias.NEUTRAL_BIAS;
    if (bullish > bearish && bullish > 0) dominantBias = FNOBias.CE_BIAS;
    else if (bearish > bullish && bearish > 0) dominantBias = FNOBias.PE_BIAS;
    else if (mixed > 0 && bullish === bearish) dominantBias = FNOBias.MIXED_BIAS;

    const recentEvents = transformed.slice(0, 5).map(t => ({
      eventType: t.eventType,
      headline: t.headline,
      publishedAt: t.generatedAt,
      impact: t.impactDirection
    }));

    return {
      symbol: sym,
      companyName: resolved?.companyName || `${sym} Limited`,
      sector: resolved?.sector || transformed[0]?.affectedSectors[0] || 'Equities',
      indices: resolved?.indices || transformed[0]?.affectedIndices || ['NIFTY 50'],
      isFnoEligible: isFno,
      totalArticles: transformed.length,
      sentimentBreakdown: {
        bullish,
        bearish,
        neutral,
        mixed
      },
      dominantBias,
      avgConfidence: transformed.length > 0 ? Math.round(totalConf / transformed.length) : 50,
      dominantIVRisk: transformed.some(t => t.ivImpactRisk === RiskLevel.VERY_HIGH) ? RiskLevel.VERY_HIGH : RiskLevel.MEDIUM,
      recentEvents,
      recentArticles: transformed.slice(0, 10)
    };
  }
}
