/**
 * ATHENA NEWS ENGINE — ADAPTIVE SUMMARY SUITE
 * FactPrioritizer
 * 
 * Ranks and prioritizes candidate material facts according to the detected SemanticArticleType
 * and CoverageScope (Single Entity vs Multi-Entity Comparison vs Market Thematic).
 * 
 * Ensures critical domain data (GMPs across all IPOs in comparison pieces, EBITDA margins in Earnings,
 * order backlog & execution timelines in Contracts, lawsuit damages/defenses, and commodity prices/Fed odds)
 * are prioritized for full-article evidence-grounded synthesis.
 */

import { SemanticArticleType } from './ArticleTypeClassifier.ts';
import { ExtractedMaterialFacts } from './MaterialFactExtractor.ts';
import { StructuredKeyNumber } from '../types/CanonicalSchema.ts';
import { EntityFactItem } from './EvidenceMap.ts';

export interface PrioritizedFacts {
  leadFact: string;
  supportingFacts: string[];
  vitalNumbers: StructuredKeyNumber[];
  marketReactionText?: string;
  articleSpecificContext: string;
  whyItMattersContext: string;
  whatHappenedTakeaway: string;
  multiEntityHighlights?: string[];
}

export class FactPrioritizer {
  /**
   * Prioritizes extracted facts tailored to the specific domain archetype and coverage scope.
   */
  public static prioritize(
    headline: string,
    extracted: ExtractedMaterialFacts,
    articleType: SemanticArticleType
  ): PrioritizedFacts {
    const { primaryEvent, numbers, keyDevelopments, marketReaction, affectedEntities, domainDetails, evidenceMap } = extracted;
    const supportingFacts: string[] = [];
    const vitalNumbers: StructuredKeyNumber[] = [...numbers];

    let whyItMattersContext = '';
    let whatHappenedTakeaway = '';
    let multiEntityHighlights: string[] | undefined;

    const primaryEntity = affectedEntities[0] || 'The company';
    const isMultiEntity = evidenceMap.coverageScope === 'MULTI_ENTITY_COMPARISON' && evidenceMap.entityFactMatrix.length >= 2;

    switch (articleType) {
      case 'IPO_GMP': {
        if (isMultiEntity) {
          // Multi-Entity IPO Comparison Prioritization
          multiEntityHighlights = [];
          for (const item of evidenceMap.entityFactMatrix) {
            const parts: string[] = [];
            if (item.gmp) parts.push(`GMP of ${item.gmp}`);
            if (item.estListingPrice) parts.push(`est. listing ${item.estListingPrice}`);
            if (item.estListingPremium) parts.push(`(${item.estListingPremium} premium)`);
            if (item.subscription) parts.push(`subscription ${item.subscription}`);
            if (item.priceBand) parts.push(`price band ${item.priceBand}`);
            if (item.issueSize) parts.push(`size ${item.issueSize}`);

            if (parts.length > 0) {
              const summaryLine = `${item.entityName} (${parts.join(', ')})`;
              multiEntityHighlights.push(summaryLine);
              supportingFacts.push(`${item.entityName}: ${parts.join(', ')}.`);
            }
          }

          whatHappenedTakeaway = this.buildMultiIpoWhatHappened(headline, evidenceMap.entityFactMatrix);
          whyItMattersContext = 'Grey market premiums across active IPOs provide unofficial indicators of retail and HNI listing expectations, reflecting relative investor appetite across ongoing public offerings.';
        } else {
          // Single-Entity IPO Prioritization
          const gmpNum = numbers.find(n => n.context.includes('GMP'));
          const subNum = numbers.find(n => n.context.includes('Subscription'));
          const priceNum = numbers.find(n => n.context.includes('Price') || n.context.includes('Band'));
          const estListingPriceNum = numbers.find(n => n.context.includes('Listing Price'));
          const estListingPremNum = numbers.find(n => n.context.includes('Listing Premium'));
          const issueSizeNum = numbers.find(n => n.context.includes('Issue') || n.context.includes('Fresh'));

          if (domainDetails.gmpSentence && !supportingFacts.includes(domainDetails.gmpSentence)) {
            supportingFacts.push(domainDetails.gmpSentence);
          }
          if (domainDetails.subscriptionSentence && !supportingFacts.includes(domainDetails.subscriptionSentence)) {
            supportingFacts.push(domainDetails.subscriptionSentence);
          }
          if (domainDetails.structureSentence && !supportingFacts.includes(domainDetails.structureSentence)) {
            supportingFacts.push(domainDetails.structureSentence);
          }

          for (const dev of keyDevelopments) {
            if (/\b(gmp|grey market|subscribed|subscription|closes today|price band|issue price|fresh issue|ofs|anchor|allotment)\b/i.test(dev)) {
              if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
            }
          }

          whatHappenedTakeaway = this.buildIpoWhatHappened(headline, gmpNum, subNum, estListingPriceNum, estListingPremNum, primaryEntity);
          whyItMattersContext = 'GMP and subscription data provide an indication of investor demand and potential listing sentiment, although grey-market trading is unofficial.';
        }
        break;
      }

      case 'COMMODITY': {
        const spotNum = numbers.find(n => n.context.includes('Spot') || n.unit?.includes('/oz') || n.unit?.includes('$/oz'));
        const mcxNum = numbers.find(n => n.context.includes('MCX') || n.unit?.includes('/10g') || n.value.includes('/10g'));
        const pctNum = numbers.find(n => n.context.includes('Percentage') || n.unit === '%');

        if (domainDetails.commodityPriceSentence) supportingFacts.push(domainDetails.commodityPriceSentence);
        if (domainDetails.macroCatalystSentence) supportingFacts.push(domainDetails.macroCatalystSentence);
        if (domainDetails.technicalLevelSentence) supportingFacts.push(domainDetails.technicalLevelSentence);

        // Add additional macro catalysts & technical levels from full body
        for (const cat of evidenceMap.macroCatalysts) {
          if (!supportingFacts.includes(cat) && supportingFacts.length < 5) supportingFacts.push(cat);
        }
        for (const lvl of evidenceMap.technicalLevels) {
          if (!supportingFacts.includes(lvl) && supportingFacts.length < 5) supportingFacts.push(lvl);
        }

        for (const dev of keyDevelopments) {
          if (/\b(gold|silver|crude|mcx|spot|fed|rate cut|rate hike|treasury|inflation|cpi|yields|resistance|support|50-day ema|debasement)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev) && supportingFacts.length < 5) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = this.buildCommodityWhatHappened(headline, spotNum, mcxNum, pctNum, primaryEntity);
        whyItMattersContext = 'Precious metal and commodity price trajectories reflect global macroeconomic liquidity, sovereign bond yields, currency debasement hedges, and safe-haven risk dynamics.';
        break;
      }

      case 'ORDER_WIN': {
        const orderNum = numbers.find(n => n.context.includes('Order') || n.context.includes('Contract') || n.unit?.includes('crore'));
        const stockNum = numbers.find(n => n.context.includes('Share Price'));

        if (domainDetails.orderSentence) supportingFacts.push(domainDetails.orderSentence);

        for (const dev of keyDevelopments) {
          if (/\b(order|contract|epc|transmission|timeline|client|execution|tender|supply|loa|power grid|railways)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = this.buildOrderWhatHappened(headline, orderNum, stockNum, primaryEntity);
        const orderValStr = orderNum ? `The ${orderNum.value} contract ` : 'The newly secured contract ';
        whyItMattersContext = `${orderValStr}strengthens ${primaryEntity}'s order pipeline and provides additional multi-year revenue visibility for its core business execution.`;
        break;
      }

      case 'LAWSUIT_REGULATORY': {
        const damageNum = numbers.find(n => n.context.includes('Litigation') || n.context.includes('Claim') || n.context.includes('Financial'));
        const penaltyNum = numbers.find(n => n.context.includes('Penalty') || n.context.includes('Contested'));

        if (domainDetails.lawsuitSentence) supportingFacts.push(domainDetails.lawsuitSentence);
        if (domainDetails.defenseSentence) supportingFacts.push(domainDetails.defenseSentence);

        for (const resp of evidenceMap.companyResponses) {
          if (!supportingFacts.includes(resp)) supportingFacts.push(resp);
        }

        for (const dev of keyDevelopments) {
          // Reject historical YTD statistics from taking over lawsuit facts
          if (/\b(court|lawsuit|allegation|petition|tribunal|stay|probe|penalty|fined|response|denied|frivolous|defense|merit)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = this.buildLawsuitWhatHappened(headline, damageNum || penaltyNum, primaryEntity);
        whyItMattersContext = 'The legal or regulatory proceedings introduce operational scrutiny and headline uncertainty, while market participants evaluate contingent liabilities and compliance posture.';
        break;
      }

      case 'EARNINGS_RESULTS': {
        const patNum = numbers.find(n => n.context.includes('PAT') || n.context.includes('Net Profit'));
        const revNum = numbers.find(n => n.context.includes('Revenue'));
        const marginNum = numbers.find(n => n.context.includes('Margin'));
        const ebitdaNum = numbers.find(n => n.context.includes('EBITDA'));
        const orderBook = numbers.find(n => n.context.includes('Issue Size') || n.context.includes('Order') || n.value.includes('lakh crore'));

        for (const dev of keyDevelopments) {
          if (/\b(revenue|pat|profit|ebitda|margin|guidance|yoy|growth|segment|order book)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = this.buildEarningsWhatHappened(headline, revNum, patNum, marginNum, primaryEntity);
        whyItMattersContext = 'Discloses quarterly operating margins, revenue trajectories, and order backlog, providing baseline metrics for fundamental earnings estimates and valuation multiples.';
        break;
      }

      case 'BLOCK_DEAL': {
        const dealNum = numbers.find(n => n.context.includes('Financial') || n.unit?.includes('crore'));
        const sharesNum = numbers.find(n => n.context.includes('Shares'));
        const stakeNum = numbers.find(n => n.context.includes('Percentage') || n.context.includes('Equity'));

        if (domainDetails.dealSentence) supportingFacts.push(domainDetails.dealSentence);

        for (const dev of keyDevelopments) {
          if (/\b(block deal|bulk deal|promoter|offloaded|stake|shares|executed|floor price)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = this.buildBlockDealWhatHappened(headline, dealNum, stakeNum, primaryEntity);
        whyItMattersContext = 'Large-scale secondary transactions alter public floating supply and institutional concentration while signaling promoter capital allocation.';
        break;
      }

      case 'DIVIDEND_BUYBACK': {
        const divNum = numbers.find(n => n.context.includes('Financial') || n.unit?.includes('₹'));
        const buybackNum = numbers.find(n => n.context.includes('Buyback'));

        for (const dev of keyDevelopments) {
          if (/\b(dividend|buyback|record date|ex-date|per share|bonus|split|shareholders)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = this.buildDividendWhatHappened(headline, divNum || buybackNum, primaryEntity);
        whyItMattersContext = 'Direct capital return initiatives improve shareholder yield and signal management confidence in balance sheet resilience.';
        break;
      }

      case 'MANAGEMENT_CHANGE': {
        if (domainDetails.mgmtSentence) supportingFacts.push(domainDetails.mgmtSentence);

        for (const dev of keyDevelopments) {
          if (/\b(ceo|cfo|managing director|appointed|resigned|stepped down|effective|tenure)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = primaryEntity !== 'The company' ? `${primaryEntity} announced leadership transition.` : headline;
        whyItMattersContext = 'Leadership transitions influence organizational execution, corporate governance, and medium-term strategic alignment.';
        break;
      }

      case 'MA_ACQUISITION': {
        const valNum = numbers.find(n => n.context.includes('Transaction') || n.unit?.includes('crore') || n.unit?.includes('$'));
        const stakeNum = numbers.find(n => n.context.includes('Equity') || n.unit === '%');

        for (const dev of keyDevelopments) {
          if (/\b(acquire|acquisition|merger|stake|consideration|valuation|synergies|regulatory approval)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = headline;
        whyItMattersContext = 'Strategic acquisitions expand operational scale, customer base, and geographical presence while creating integration milestones.';
        break;
      }

      case 'MACRO_CENTRAL_BANK': {
        for (const dev of keyDevelopments) {
          if (/\b(rate|inflation|fed|rbi|powell|yield|policy|interest rate|growth|basis points|fomc|mpc)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = headline;
        whyItMattersContext = 'Central bank policy decisions and macroeconomic trends directly influence sovereign yields, currency valuations, and broad capital market liquidity.';
        break;
      }

      case 'SECTOR_MOVEMENT': {
        for (const dev of keyDevelopments) {
          if (/\b(stocks|shares|rally|government|four-laning|cabinet|ministry|demand|capacity|capex)\b/i.test(dev)) {
            if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
          }
        }

        whatHappenedTakeaway = headline;
        whyItMattersContext = 'Sector-wide policy and capex initiatives provide structural growth drivers across thematic supply chains and listed industry participants.';
        break;
      }

      default: {
        for (const dev of keyDevelopments) {
          if (!supportingFacts.includes(dev)) supportingFacts.push(dev);
        }
        whatHappenedTakeaway = primaryEvent || headline;
        whyItMattersContext = 'Material development altering operational milestones, commercial positioning, or market expectations for the entity.';
        break;
      }
    }

    // Fill supporting facts if still empty
    if (supportingFacts.length === 0) {
      for (const dev of keyDevelopments) {
        if (!supportingFacts.includes(dev)) {
          supportingFacts.push(dev);
        }
      }
    }

    const leadFact = isMultiEntity 
      ? whatHappenedTakeaway 
      : (primaryEntity !== 'The company' && !primaryEvent.toLowerCase().includes(primaryEntity.toLowerCase())
          ? `${primaryEntity}: ${primaryEvent}`
          : primaryEvent || headline);

    const articleSpecificContext = supportingFacts.join(' ');

    return {
      leadFact,
      supportingFacts: supportingFacts.slice(0, 6),
      vitalNumbers,
      marketReactionText: marketReaction,
      articleSpecificContext,
      whyItMattersContext,
      whatHappenedTakeaway,
      multiEntityHighlights
    };
  }

  private static buildMultiIpoWhatHappened(headline: string, matrix: EntityFactItem[]): string {
    const summaryItems: string[] = [];
    for (const item of matrix.slice(0, 3)) {
      const parts: string[] = [];
      if (item.gmp) parts.push(`GMP at ${item.gmp}`);
      if (item.estListingPremium) parts.push(`${item.estListingPremium} premium`);
      if (item.subscription) parts.push(`${item.subscription} sub`);
      if (parts.length > 0) {
        summaryItems.push(`${item.entityName} (${parts.join(', ')})`);
      }
    }
    if (summaryItems.length > 0) {
      return `Grey market signals indicate active demand across public offerings: ${summaryItems.join('; ')}.`;
    }
    return headline;
  }

  private static buildIpoWhatHappened(
    headline: string,
    gmpNum?: StructuredKeyNumber,
    subNum?: StructuredKeyNumber,
    estListingPriceNum?: StructuredKeyNumber,
    estListingPremNum?: StructuredKeyNumber,
    entity?: string
  ): string {
    const entityTitle = entity && entity !== 'The company' ? entity : 'The IPO';
    if (gmpNum && subNum) {
      const premStr = estListingPremNum ? ` (${estListingPremNum.value} premium)` : '';
      return `${entityTitle} recorded ${subNum.value} subscription with grey market premium (GMP) at ${gmpNum.value}${premStr} ahead of listing.`;
    }
    if (gmpNum) {
      return `${entityTitle} grey market premium indicates ${gmpNum.value} per share.`;
    }
    return headline;
  }

  private static buildCommodityWhatHappened(
    headline: string,
    spotNum?: StructuredKeyNumber,
    mcxNum?: StructuredKeyNumber,
    pctNum?: StructuredKeyNumber,
    entity?: string
  ): string {
    const prices: string[] = [];
    if (spotNum) prices.push(`Spot: ${spotNum.value}`);
    if (mcxNum) prices.push(`MCX: ${mcxNum.value}`);
    const pctStr = pctNum ? ` (${pctNum.value})` : '';

    if (prices.length > 0) {
      const asset = entity && !['The company', 'Market Wire'].includes(entity) ? entity : 'Gold';
      return `${asset} prices reflected trading levels at ${prices.join(', ')}${pctStr} amid macroeconomic catalysts.`;
    }
    return headline;
  }

  private static buildEarningsWhatHappened(
    headline: string,
    revNum?: StructuredKeyNumber,
    patNum?: StructuredKeyNumber,
    marginNum?: StructuredKeyNumber,
    entity?: string
  ): string {
    const parts: string[] = [];
    if (revNum) parts.push(`Revenue: ${revNum.value}`);
    if (patNum) parts.push(`PAT: ${patNum.value}`);
    if (marginNum) parts.push(`Margin: ${marginNum.value}`);

    const name = entity && entity !== 'The company' ? entity : 'The company';
    if (parts.length > 0) {
      return `${name} reported quarterly financial results (${parts.join(', ')}).`;
    }
    return headline;
  }

  private static buildOrderWhatHappened(
    headline: string,
    orderNum?: StructuredKeyNumber,
    stockNum?: StructuredKeyNumber,
    entity?: string
  ): string {
    const name = entity && entity !== 'The company' ? entity : 'The company';
    if (orderNum && stockNum) {
      return `${name} secured ${orderNum.value} in new commercial orders, with shares reacting ${stockNum.value}.`;
    }
    if (orderNum) {
      return `${name} secured a commercial contract valued at ${orderNum.value}.`;
    }
    return headline;
  }

  private static buildLawsuitWhatHappened(
    headline: string,
    damageNum?: StructuredKeyNumber,
    entity?: string
  ): string {
    const name = entity && entity !== 'The company' ? entity : 'The company';
    if (damageNum) {
      return `${name} is responding to litigation involving ${damageNum.value} in contested claims, denying all allegations.`;
    }
    return headline;
  }

  private static buildBlockDealWhatHappened(
    headline: string,
    dealNum?: StructuredKeyNumber,
    stakeNum?: StructuredKeyNumber,
    entity?: string
  ): string {
    const name = entity && entity !== 'The company' ? entity : 'The company';
    if (dealNum && stakeNum) {
      return `${name} executed a ${dealNum.value} block transaction involving a ${stakeNum.value} equity stake.`;
    }
    if (dealNum) {
      return `${name} witnessed a block transaction valued at ${dealNum.value}.`;
    }
    return headline;
  }

  private static buildDividendWhatHappened(
    headline: string,
    divNum?: StructuredKeyNumber,
    entity?: string
  ): string {
    const name = entity && entity !== 'The company' ? entity : 'The company';
    if (divNum) {
      return `${name} announced corporate distribution of ${divNum.value}.`;
    }
    return headline;
  }
}
