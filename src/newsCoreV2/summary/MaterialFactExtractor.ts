/**
 * ATHENA NEWS ENGINE — ADAPTIVE SUMMARY SUITE
 * MaterialFactExtractor
 * 
 * Production Full-Article Material Fact Traversal & Evidence Extractor.
 * 
 * Traverses the COMPLETE cleaned article body across:
 * - HEADLINE
 * - LEAD (Paragraph 1)
 * - EARLY_BODY (Paragraph 2–3)
 * - MIDDLE_BODY (Paragraph 4–6)
 * - LATE_BODY / CONCLUSION
 * 
 * Features:
 * 1. Multi-Entity Detection & Segment Matrix Extraction (e.g., multiple IPOs, peer results, sector roundups).
 * 2. High-precision quantitative metric extraction (GMP, listing gains, subscriptions, price bands, issue size,
 *    order values, revenue, net profit, margins, spot prices, MCX prices, Fed odds, Treasury operations, technical levels).
 * 3. Builds a structured EvidenceMap grounding every synthesized claim.
 */

import { SemanticArticleType } from './ArticleTypeClassifier.ts';
import { StructuredKeyNumber } from '../types/CanonicalSchema.ts';
import { ArticleContentSanitizer } from './ArticleContentSanitizer.ts';
import { EvidenceMap, EntityFactItem, SectionFact, ArticleSection, CoverageScope } from './EvidenceMap.ts';

export interface DomainSpecificDetails {
  gmpSentence?: string;
  subscriptionSentence?: string;
  priceBandSentence?: string;
  structureSentence?: string;
  commodityPriceSentence?: string;
  macroCatalystSentence?: string;
  technicalLevelSentence?: string;
  orderSentence?: string;
  lawsuitSentence?: string;
  defenseSentence?: string;
  dealSentence?: string;
  mgmtSentence?: string;
  multiEntitySentences?: string[];
}

export interface ExtractedMaterialFacts {
  primaryEvent: string;
  numbers: StructuredKeyNumber[];
  keyDevelopments: string[];
  marketReaction?: string;
  affectedEntities: string[];
  domainDetails: DomainSpecificDetails;
  totalCandidateFactsCount: number;
  uncertaintyLanguage?: string;
  attribution?: string;
  evidenceMap: EvidenceMap;
}

export class MaterialFactExtractor {
  /**
   * Traverses the complete article body and returns extracted facts with an EvidenceMap.
   */
  public static extract(
    headline: string,
    body: string,
    articleType: SemanticArticleType,
    entities: string[] = []
  ): ExtractedMaterialFacts {
    const cleanHeadline = ArticleContentSanitizer.sanitizeString(headline);
    const cleanBody = ArticleContentSanitizer.sanitizeString(body);

    // 1. Break into structured paragraphs cleanly
    const rawParagraphs = cleanBody
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 20);

    const paragraphs = rawParagraphs.length > 0 
      ? rawParagraphs 
      : cleanBody.split(/(?<=[.?!])\s+/).filter(p => p.length > 25);

    // 2. Extract Entities from Headline & Text
    const discoveredEntities = this.resolveEntities(cleanHeadline, cleanBody, entities);

    // 3. Multi-Entity Comparison Check
    const coverageScope: CoverageScope = this.determineCoverageScope(cleanHeadline, cleanBody, discoveredEntities, articleType);

    // 4. Section Partitioning & Traversal
    const sectionFacts: SectionFact[] = [];
    const extractedNumbers: StructuredKeyNumber[] = [];
    const keyDevelopments: string[] = [];
    const macroCatalysts: string[] = [];
    const technicalLevels: string[] = [];
    const companyResponses: string[] = [];
    const marketReactions: string[] = [];
    const uncertaintyPhrases: string[] = [];

    const totalParas = paragraphs.length;

    for (let pIdx = 0; pIdx < totalParas; pIdx++) {
      const paraText = paragraphs[pIdx];
      const section = this.getSectionLabel(pIdx, totalParas);

      const paraSentences = paraText.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 15);

      for (const sent of paraSentences) {
        const cleanSent = ArticleContentSanitizer.sanitizeString(sent);
        if (!cleanSent) continue;

        // Structured Numbers
        const nums = this.extractStructuredNumbers(cleanSent, articleType);
        for (const n of nums) {
          if (!extractedNumbers.some(existing => existing.value === n.value && existing.context === n.context)) {
            extractedNumbers.push(n);
          }
        }

        // Entities mentioned in sentence
        const sentEntities = discoveredEntities.filter(e => 
          cleanSent.toLowerCase().includes(e.toLowerCase())
        );

        // Section Fact entry
        sectionFacts.push({
          section,
          text: cleanSent,
          numbers: nums,
          entities: sentEntities
        });

        // Key developments
        if (cleanSent.length > 25 && cleanSent.length < 280) {
          if (!keyDevelopments.includes(cleanSent)) {
            keyDevelopments.push(cleanSent);
          }
        }

        // Macro Catalysts (strict catalyst detection)
        if (/\b(federal reserve|fed officials?|rate hike|rate cut|interest rates?|treasury yields?|treasury buybacks?|cpi inflation|central-bank|debasement|bond buyback|safe-haven|dollar index|dxy)\b/i.test(cleanSent)) {
          if (!macroCatalysts.includes(cleanSent)) macroCatalysts.push(cleanSent);
        }

        // Technical levels
        if (/\b(resistance|support|50-day ema|200-day|moving average|target of|targets of|range of|technical chart)\b/i.test(cleanSent)) {
          if (!technicalLevels.includes(cleanSent)) technicalLevels.push(cleanSent);
        }

        // Company responses / denials
        if (/\b(denied|denies|frivolous|without merit|vigorously defend|rejected allegations|refuted|clarified|stated in filing)\b/i.test(cleanSent)) {
          if (!companyResponses.includes(cleanSent)) companyResponses.push(cleanSent);
        }

        // Market Reactions
        if (/\b(shares?|stock|traded|fell|rose|surged|slumped|closed|rallied|ended)\s+(\d+(?:\.\d+)?%|\bup\b|\bdown\b)/i.test(cleanSent) &&
            !cleanSent.toLowerCase().includes('year-to-date')) {
          if (!marketReactions.includes(cleanSent)) marketReactions.push(cleanSent);
        }

        // Uncertainty phrases
        if (/\b(unconfirmed|sources said|people familiar|under discussion|deliberations ongoing|preliminary|subject to approval)\b/i.test(cleanSent)) {
          if (!uncertaintyPhrases.includes(cleanSent)) uncertaintyPhrases.push(cleanSent);
        }
      }
    }

    // 5. Build Entity Fact Matrix (for Multi-Entity & Single Entity)
    const allSentences = sectionFacts.map(sf => sf.text);
    const entityFactMatrix = this.buildEntityFactMatrix(cleanHeadline, allSentences, discoveredEntities, articleType);

    // 6. Domain-specific detail sentences
    const domainDetails = this.extractDomainDetails(allSentences, articleType, entityFactMatrix);

    // Primary event determination
    const primaryEvent = keyDevelopments[0] || cleanHeadline;

    // Presence flags
    const sectionPresence = {
      lead: sectionFacts.some(sf => sf.section === 'LEAD'),
      middle: sectionFacts.some(sf => sf.section === 'MIDDLE_BODY' || sf.section === 'EARLY_BODY'),
      late: sectionFacts.some(sf => sf.section === 'LATE_BODY'),
      conclusion: sectionFacts.some(sf => sf.section === 'CONCLUSION')
    };

    const evidenceMap: EvidenceMap = {
      headline: cleanHeadline,
      articleType,
      coverageScope,
      entities: discoveredEntities,
      entityFactMatrix,
      sectionFacts,
      structuredNumbers: extractedNumbers,
      primaryEvent,
      macroCatalysts,
      technicalLevels,
      companyResponses,
      marketReactions,
      uncertaintyPhrases,
      sectionPresence,
      totalExtractedFactsCount: extractedNumbers.length + keyDevelopments.length + entityFactMatrix.length
    };

    return {
      primaryEvent,
      numbers: extractedNumbers,
      keyDevelopments,
      marketReaction: marketReactions[0],
      affectedEntities: discoveredEntities,
      domainDetails,
      totalCandidateFactsCount: evidenceMap.totalExtractedFactsCount,
      uncertaintyLanguage: uncertaintyPhrases[0],
      attribution: undefined,
      evidenceMap
    };
  }

  private static getSectionLabel(index: number, total: number): ArticleSection {
    if (index === 0) return 'LEAD';
    if (total <= 3) {
      if (index === total - 1) return 'LATE_BODY';
      return 'EARLY_BODY';
    }
    const ratio = index / total;
    if (ratio <= 0.33) return 'EARLY_BODY';
    if (ratio <= 0.70) return 'MIDDLE_BODY';
    if (ratio <= 0.90) return 'LATE_BODY';
    return 'CONCLUSION';
  }

  private static determineCoverageScope(
    headline: string,
    body: string,
    entities: string[],
    articleType: SemanticArticleType
  ): CoverageScope {
    if (articleType === 'COMMODITY' || articleType === 'MACRO_CENTRAL_BANK' || articleType === 'SECTOR_MOVEMENT' || articleType === 'GLOBAL_MARKET') {
      return 'MARKET_THEMATIC';
    }

    if (articleType === 'IPO_GMP') {
      // Must have at least 2 distinct real companies
      if (entities.length >= 2) {
        return 'MULTI_ENTITY_COMPARISON';
      }
    }

    if (entities.length >= 3) {
      return 'MULTI_ENTITY_COMPARISON';
    }

    return 'SINGLE_ENTITY';
  }

  private static cleanEntityName(raw: string): string {
    return raw
      .replace(/\s+(?:IPO|GMP|IPO\s+GMP|Grey\s+Market\s+Premium|Ltd|Limited|Private\s+Limited|Pvt\s+Ltd|Inc|LLC)$/gi, '')
      .replace(/^(?:and|,|to|from)\s+/i, '')
      .trim();
  }

  private static resolveEntities(headline: string, body: string, inputEntities: string[] = []): string[] {
    const map = new Map<string, string>(); // lowercase -> canonical

    const addEntity = (name: string) => {
      const cleaned = this.cleanEntityName(name);
      if (cleaned.length > 2 && !/^(?:the|an|all|new|upcoming|latest|various|these|what|signals|market|wire|company|shares|stocks|investors|trading)$/i.test(cleaned)) {
        const lower = cleaned.toLowerCase();
        if (!map.has(lower)) {
          map.set(lower, cleaned);
        }
      }
    };

    for (const e of inputEntities) {
      if (e) addEntity(e);
    }

    // Known IPO / Company patterns in financial headlines:
    // e.g. "IPO GMPs: Hy-Tech Engineers IPO, Symbiotec Pharmalab IPO to Lumino Industries IPO"
    const ipoMatches = headline.matchAll(/([A-Z][A-Za-z0-9&.\s-]{2,30}?)\s+IPO\b/gi);
    for (const match of ipoMatches) {
      addEntity(match[1]);
    }

    // Company matches at start of headline
    // e.g. "Sterling and Wilson bags...", "L&T Q3 Results...", "HDFC Bank faces..."
    const headStartMatch = headline.match(/^([A-Z][A-Za-z0-9&.\s-]{2,35}?)(?:\s+(?:Q[1-4]|bags|secures|wins|faces|sued|reports|rallies|surges|falls|announces|to\s+acquire|signs|denies|revisiting))/);
    if (headStartMatch && headStartMatch[1]) {
      addEntity(headStartMatch[1]);
    }

    // Body entity occurrences (e.g. "Hy-Tech Engineers", "Symbiotec Pharmalab", "Skyways Air Services", "Annu Projects", "Lumino Industries")
    const bodyIpoMatches = body.matchAll(/([A-Z][A-Za-z0-9&.\s-]{2,30}?)\s+(?:IPO|Industries|Services|Projects|Engineers|Pharmalab|Energy|Bank|Technologies)\b/g);
    for (const match of bodyIpoMatches) {
      addEntity(match[1]);
    }

    // Remove duplicates where one is a substring of another
    const list = Array.from(map.values()).filter(name => {
      const lower = name.toLowerCase();
      return !['the company', 'company', 'market wire', 'stock exchange', 'national stock exchange', 'bombay stock exchange', 'sebi', 'rbi', 'gold', 'silver', 'crude', 'sensex', 'nifty'].includes(lower);
    });

    // Prune redundant sub-names (e.g. "Hy-Tech" if "Hy-Tech Engineers" exists)
    const pruned = list.filter((name, idx) => {
      return !list.some((other, oIdx) => oIdx !== idx && other.toLowerCase().includes(name.toLowerCase()) && other.length > name.length);
    });

    if (pruned.length > 0) return pruned;

    // Fallback: extract first capitalized words from headline
    const fallbackMatch = headline.match(/^([A-Z][A-Za-z0-9&.\s]{2,25}?)(?:\s+|$)/);
    if (fallbackMatch && fallbackMatch[1] && !['Gold', 'Silver', 'Crude', 'Market', 'Rupee', 'Fed'].includes(fallbackMatch[1])) {
      return [this.cleanEntityName(fallbackMatch[1])];
    }

    return [];
  }

  private static buildEntityFactMatrix(
    headline: string,
    sentences: string[],
    entities: string[],
    articleType: SemanticArticleType
  ): EntityFactItem[] {
    const matrix: EntityFactItem[] = [];

    for (const entity of entities) {
      const entityLower = entity.toLowerCase();
      // Find the specific sentence or cluster of sentences talking about this entity
      const relevantSentences = sentences.filter(s => s.toLowerCase().includes(entityLower));
      const entityText = relevantSentences.length > 0 ? relevantSentences.join(' ') : '';

      if (!entityText) continue;

      const rawMetrics = this.extractStructuredNumbers(entityText, articleType);

      // Extract entity-specific GMP
      let gmp: string | undefined;
      const gmpMatch = entityText.match(/(?:gmp|grey\s+market\s+premium)\s*(?:is|at|of|stands\s+at|trades?\s+at|quotes?\s+at|is\s+quoting\s+at)?\s*(₹|rs\.?|\$)?\s*(\d+(?:\.\d+)?)/i) ||
                       entityText.match(/(?:₹|rs\.?|\$)\s*(\d+(?:\.\d+)?)\s*(?:per\s+share\s+)?(?:gmp|grey\s+market\s+premium)/i);
      if (gmpMatch) {
        gmp = `₹${gmpMatch[2] || gmpMatch[1]}`;
      }

      // Extract estimated listing price
      let estListingPrice: string | undefined;
      const estPriceMatch = entityText.match(/estimated\s+listing\s+price\s*(?:of|at|is)?\s*(₹|rs\.?|\$)?\s*([\d,]+(?:\.\d+)?)/i);
      if (estPriceMatch) {
        estListingPrice = `₹${estPriceMatch[2]}`;
      }

      // Extract estimated listing premium
      let estListingPremium: string | undefined;
      const estPremMatch = entityText.match(/(?:estimated\s+listing\s+premium|listing\s+gain)\s*(?:of|at|is)?\s*(\d+(?:\.\d+)?%)/i) ||
                           entityText.match(/(\d+(?:\.\d+)?%)\s*(?:estimated\s+)?(?:listing\s+)?(?:premium|gain)/i) ||
                           entityText.match(/\((?:estimated\s+)?(\d+(?:\.\d+)?%)\s*(?:listing\s+)?premium\)/i);
      if (estPremMatch) {
        estListingPremium = estPremMatch[1];
      }

      // Extract subscription
      let subscription: string | undefined;
      const subMatch = entityText.match(/(\d+(?:\.\d+)?)\s*x\s*(?:subscription|subscribed|times|demand)/i) ||
                       entityText.match(/(?:subscribed|subscription)\s*(?:of|by|over)?\s*(\d+(?:\.\d+)?)\s*(?:times|x|%)/i) ||
                       entityText.match(/subscribed\s+(\d+(?:\.\d+)?%)/i);
      if (subMatch) {
        subscription = subMatch[0].includes('%') || subMatch[1].includes('%') ? `${subMatch[1]}%` : `${subMatch[1]}x`;
      }

      // Extract price band
      let priceBand: string | undefined;
      const bandMatch = entityText.match(/price\s+band\s*(?:of|at|is)?\s*(?:₹|rs\.?)\s*(\d+(?:\s*(?:-|to)\s*(?:₹|rs\.?)?\d+)?)/i) ||
                        entityText.match(/fixed\s+at\s*(?:₹|rs\.?)\s*(\d+)/i);
      if (bandMatch) {
        priceBand = bandMatch[1].startsWith('₹') ? bandMatch[1] : `₹${bandMatch[1]}`;
      }

      // Extract issue size / order value / PAT / revenue
      let issueSize: string | undefined;
      let orderValue: string | undefined;
      let revenue: string | undefined;
      let netProfit: string | undefined;
      let margin: string | undefined;

      const croreMatch = entityText.match(/(₹|rs\.?|\$)\s*([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|million|billion)\b/i);
      if (croreMatch) {
        const valStr = `₹${croreMatch[2]} ${croreMatch[3].toLowerCase()}`;
        if (articleType === 'IPO_GMP' || /\b(issue|fresh|ofs|raise)\b/i.test(entityText)) issueSize = valStr;
        else if (articleType === 'ORDER_WIN' || /\b(order|contract)\b/i.test(entityText)) orderValue = valStr;
        else if (articleType === 'EARNINGS_RESULTS') {
          if (/\b(pat|net profit)\b/i.test(entityText)) netProfit = valStr;
          else if (/\brevenue\b/i.test(entityText)) revenue = valStr;
        }
      }

      // Status
      let actionOrStatus: string | undefined;
      if (/\b(closes today|final day|bidding closes)\b/i.test(entityText)) actionOrStatus = 'Closes today';
      else if (/\b(opens today|bidding opens)\b/i.test(entityText)) actionOrStatus = 'Opens today';
      else if (/\b(allotment today|allotment status)\b/i.test(entityText)) actionOrStatus = 'Allotment stage';

      const keySentence = relevantSentences[0] || undefined;

      if (gmp || subscription || priceBand || issueSize || orderValue || netProfit || rawMetrics.length > 0) {
        matrix.push({
          entityName: entity,
          gmp,
          estListingPrice,
          estListingPremium,
          subscription,
          priceBand,
          issueSize,
          orderValue,
          revenue,
          netProfit,
          margin,
          actionOrStatus,
          keySentence,
          rawMetrics
        });
      }
    }

    return matrix;
  }

  private static extractDomainDetails(
    sentences: string[],
    articleType: SemanticArticleType,
    entityMatrix: EntityFactItem[]
  ): DomainSpecificDetails {
    const details: DomainSpecificDetails = {};
    const multiEntitySentences: string[] = [];

    for (const s of sentences) {
      const clean = ArticleContentSanitizer.sanitizeString(s);
      if (!clean) continue;

      if (articleType === 'IPO_GMP') {
        if (!details.gmpSentence && /\b(gmp|grey market|gray market)\b/i.test(clean)) {
          details.gmpSentence = clean;
        }
        if (!details.subscriptionSentence && /\b(subscribed|subscription|bidding|oversubscribed|times)\b/i.test(clean)) {
          details.subscriptionSentence = clean;
        }
        if (!details.priceBandSentence && /\b(price band|issue price|fixed at|per share)\b/i.test(clean)) {
          details.priceBandSentence = clean;
        }
        if (!details.structureSentence && /\b(fresh issue|offer for sale|ofs|net proceeds|raise)\b/i.test(clean)) {
          details.structureSentence = clean;
        }
      }

      if (articleType === 'COMMODITY') {
        if (!details.commodityPriceSentence && /\b(spot|mcx|futures|\$\d+|₹\d+[\d,]*\s*per\s*10|per ounce)\b/i.test(clean)) {
          details.commodityPriceSentence = clean;
        }
        if (!details.macroCatalystSentence && /\b(federal reserve|fed officials?|rate hike|rate cut|interest rates?|treasury|inflation|cpi|central-bank|safe-haven|dollar index|dxy)\b/i.test(clean)) {
          details.macroCatalystSentence = clean;
        }
        if (!details.technicalLevelSentence && /\b(resistance|support|50-day ema|200-day|moving average|technical charts?|target of)\b/i.test(clean)) {
          details.technicalLevelSentence = clean;
        }
      }

      if (articleType === 'ORDER_WIN') {
        if (!details.orderSentence && /\b(order|contract|epc|transmission|substation|timeline|power grid|adani|railways|worth|valued at)\b/i.test(clean)) {
          details.orderSentence = clean;
        }
      }

      if (articleType === 'LAWSUIT_REGULATORY') {
        if (!details.lawsuitSentence && /\b(lawsuit|class action|district court|damages|misleading|allegation|petition|stay|fined)\b/i.test(clean)) {
          details.lawsuitSentence = clean;
        }
        if (!details.defenseSentence && /\b(denied|denies|frivolous|without merit|vigorously defend|rejected allegations|refuted)\b/i.test(clean)) {
          details.defenseSentence = clean;
        }
      }

      if (articleType === 'BLOCK_DEAL') {
        if (!details.dealSentence && /\b(block deal|bulk deal|promoter|offloaded|stake|shares|executed)\b/i.test(clean)) {
          details.dealSentence = clean;
        }
      }

      if (articleType === 'MANAGEMENT_CHANGE') {
        if (!details.mgmtSentence && /\b(appointed|resigned|stepped down|ceo|cfo|managing director|effective)\b/i.test(clean)) {
          details.mgmtSentence = clean;
        }
      }
    }

    // Build multi-entity structured lines
    if (entityMatrix.length >= 2) {
      for (const item of entityMatrix) {
        const parts: string[] = [];
        if (item.gmp) parts.push(`GMP of ${item.gmp}`);
        if (item.estListingPrice) parts.push(`est. listing ${item.estListingPrice}`);
        if (item.estListingPremium) parts.push(`(${item.estListingPremium} premium)`);
        if (item.subscription) parts.push(`subscribed ${item.subscription}`);
        if (item.priceBand) parts.push(`price band ${item.priceBand}`);
        if (item.issueSize) parts.push(`issue size ${item.issueSize}`);

        if (parts.length > 0) {
          multiEntitySentences.push(`${item.entityName}: ${parts.join(', ')}.`);
        }
      }
      details.multiEntitySentences = multiEntitySentences;
    }

    return details;
  }

  private static extractStructuredNumbers(sentence: string, articleType: SemanticArticleType): StructuredKeyNumber[] {
    const list: StructuredKeyNumber[] = [];
    const clean = sentence;

    // 1. GMP Extraction
    const gmpMatch = clean.match(/(?:gmp|grey\s+market\s+premium)\s*(?:is|at|of|stands\s+at|trades?\s+at|is\s+trading\s+at|quotes?\s+at|is\s+quoting\s+at|rose\s+to|surged\s+to)?\s*(₹|rs\.?|\$)?\s*(\d+(?:\.\d+)?)/i) ||
                     clean.match(/(?:₹|rs\.?|\$)\s*(\d+(?:\.\d+)?)\s*(?:per\s+share\s+)?(?:gmp|grey\s+market\s+premium)/i);
    if (gmpMatch) {
      const val = gmpMatch[2] || gmpMatch[1];
      list.push({
        value: `₹${val}`,
        unit: '₹',
        context: 'Grey Market Premium (GMP)',
        sourceSpan: clean
      });
    }

    // 2. Estimated Listing Price
    const estPriceMatch = clean.match(/estimated\s+listing\s+price\s*(?:of|at|is)?\s*(₹|rs\.?|\$)?\s*(\d+(?:\.\d+)?)/i);
    if (estPriceMatch) {
      list.push({
        value: `₹${estPriceMatch[2]}`,
        unit: '₹',
        context: 'Estimated Listing Price',
        sourceSpan: clean
      });
    }

    // 3. Estimated Listing Premium / Gain
    const estPremMatch = clean.match(/(?:estimated\s+listing\s+premium|listing\s+gain)\s*(?:of|at|is)?\s*(\d+(?:\.\d+)?%)/i);
    if (estPremMatch) {
      list.push({
        value: estPremMatch[1],
        unit: '%',
        context: 'Estimated Listing Premium',
        sourceSpan: clean
      });
    }

    // 4. Subscription Multiples
    const subMatch = clean.match(/(\d+(?:\.\d+)?)\s*x\s*(?:subscription|subscribed|times|demand)/i) ||
                     clean.match(/subscription\s+of\s+(\d+(?:\.\d+)?)\s*x/i) ||
                     clean.match(/booked\s+(\d+(?:\.\d+)?)\s*x/i);
    if (subMatch) {
      list.push({
        value: `${subMatch[1]}x`,
        unit: 'multiple',
        context: 'Subscription Multiple',
        sourceSpan: clean
      });
    }

    // 5. Order / Contract / Litigation / Earnings / Issue Size (Crore / Lakh / Million / Billion)
    const croreMatch = clean.match(/(₹|rs\.?|\$)\s*([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|million|billion)\b/i);
    if (croreMatch) {
      const currency = croreMatch[1].startsWith('$') ? '$' : '₹';
      const unit = croreMatch[3].toLowerCase();
      const valStr = `${currency}${croreMatch[2]} ${unit}`;
      
      let context = 'Financial Metric';
      if (articleType === 'ORDER_WIN' || /\b(order|contract|deal|bid|loa)\b/i.test(clean)) context = 'Order Value';
      else if (articleType === 'LAWSUIT_REGULATORY' || /\b(damages|claim|penalty|fine)\b/i.test(clean)) context = 'Litigation Claim';
      else if (articleType === 'EARNINGS_RESULTS' && /\b(net profit|pat)\b/i.test(clean)) context = 'Net Profit (PAT)';
      else if (articleType === 'EARNINGS_RESULTS' && /\brevenue\b/i.test(clean)) context = 'Revenue';
      else if (articleType === 'IPO_GMP' && /\b(fresh issue|raise|size|ofs|offer for sale)\b/i.test(clean)) context = 'Issue Size';

      list.push({
        value: valStr,
        unit: `${currency} ${unit}`,
        context,
        sourceSpan: clean
      });
    }

    // 6. Commodity Prices ($/oz or ₹/10g or ₹/bbl or $/bbl)
    const dollarOzMatch = clean.match(/\$([\d,]+(?:\.\d+)?)\s*(?:per\s*ounce|\/oz)?/i);
    if (dollarOzMatch && (articleType === 'COMMODITY' || /\bgold|silver|crude\b/i.test(clean))) {
      list.push({
        value: `$${dollarOzMatch[1]}`,
        unit: '$/oz',
        context: 'Spot Price',
        sourceSpan: clean
      });
    }

    const mcxMatch = clean.match(/(?:mcx|futures|domestic)?\s*(?:₹|rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(?:per\s*10\s*grams?|\/10g)?/i);
    if (mcxMatch && (articleType === 'COMMODITY' || /\bgold|silver\b/i.test(clean))) {
      list.push({
        value: `₹${mcxMatch[1]}`,
        unit: '₹/10g',
        context: 'MCX Futures Price',
        sourceSpan: clean
      });
    }

    // 7. Rate hike / hike probabilities (e.g. 36.1% September, 72.1% December)
    const probMatches = clean.matchAll(/(\d+(?:\.\d+)?%)\s*(?:chance|probability|likelihood|odds)?\s*(?:of|for)?\s*(?:a\s+)?(?:rate\s+hike|rate\s+cut|september|december|fomc)?/gi);
    for (const pm of probMatches) {
      if (/\b(september|december|hike|cut|probability|chance)\b/i.test(clean)) {
        list.push({
          value: pm[1],
          unit: '%',
          context: 'Policy Probability',
          sourceSpan: clean
        });
      }
    }

    // 8. General Percentage Movements
    const pctMatch = clean.match(/(\d+(?:\.\d+)?%)\s*(?:yoy|qoq|margin|rally|surge|jump|gain|fall|drop|decline)?/i);
    if (pctMatch && !list.some(n => n.value === pctMatch[1])) {
      let context = 'Percentage Change';
      if (/\bmargin\b/i.test(clean)) context = 'EBITDA Margin';
      else if (/\b(shares?|stock|traded|fell|rose|surged|slumped)\b/i.test(clean)) context = 'Share Price Reaction';

      list.push({
        value: pctMatch[1],
        unit: '%',
        context,
        sourceSpan: clean
      });
    }

    return list;
  }
}
