import { TraderIntelligenceEventType, EvidenceState, EvidenceItem } from './TraderIntelligenceTypes.ts';

export class FundamentalImpactEngine {
  /**
   * Determine the economic transmission mechanism and the status of fundamental impact verification.
   */
  public static analyze(
    eventType: TraderIntelligenceEventType,
    text: string,
    evidenceItems: EvidenceItem[]
  ): {
    status: EvidenceState;
    mechanism: string;
  } {
    const lowerText = text.toLowerCase();
    
    // Check if we have strong TIER_1 or TIER_2 evidence
    const hasFactualEvidence = evidenceItems.some(
      item => item.sourceTier === 'TIER_1' || item.sourceTier === 'TIER_2'
    );

    if (!hasFactualEvidence && evidenceItems.length === 0) {
      return {
        status: 'UNKNOWN',
        mechanism: 'No reliable source evidence exists to determine the economic transmission mechanism.'
      };
    }

    const state: EvidenceState = hasFactualEvidence ? 'VERIFIED' : 'DERIVED';

    switch (eventType) {
      case 'ORDER_WIN': {
        let selected = 'order-book expansion';
        if (lowerText.includes('capacity') || lowerText.includes('utilization')) {
          selected = 'capacity utilization';
        } else if (lowerText.includes('margin') || lowerText.includes('profitability')) {
          selected = 'margin implications';
        } else if (lowerText.includes('execution') || lowerText.includes('delay') || lowerText.includes('risk')) {
          selected = 'execution risk';
        } else if (lowerText.includes('revenue') || lowerText.includes('visibility') || lowerText.includes('multi-year')) {
          selected = 'revenue visibility';
        }
        return {
          status: state,
          mechanism: `Transmission mechanism: ${selected}. Explicit evidence verified via incoming order orderbook and revenue realization guidelines.`
        };
      }

      case 'ACQUISITION':
      case 'M_AND_A':
      case 'STAKE_SALE': {
        let selected = 'capital allocation';
        if (lowerText.includes('diversification') || lowerText.includes('product portfolio')) {
          selected = 'revenue diversification';
        } else if (lowerText.includes('market share') || lowerText.includes('competitor') || lowerText.includes('expansion')) {
          selected = 'market-share expansion';
        } else if (lowerText.includes('leverage') || lowerText.includes('debt') || lowerText.includes('balance sheet')) {
          selected = 'balance-sheet leverage';
        } else if (lowerText.includes('integration') || lowerText.includes('synergy') || lowerText.includes('risk')) {
          selected = 'integration risk';
        }
        return {
          status: state,
          mechanism: `Transmission mechanism: ${selected}. Verified deal boundaries, purchase valuation, or ownership structural modification.`
        };
      }

      case 'DIVIDEND': {
        let selected = 'shareholder yield';
        if (lowerText.includes('cash') || lowerText.includes('balance') || lowerText.includes('surplus')) {
          selected = 'cash distribution';
        } else if (lowerText.includes('capital allocation') || lowerText.includes('reinvest')) {
          selected = 'capital allocation';
        } else if (lowerText.includes('ex-date') || lowerText.includes('record date') || lowerText.includes('book closure')) {
          selected = 'ex-date mechanics';
        }
        return {
          status: state,
          mechanism: `Transmission mechanism: ${selected}. Outlined by board payout resolution and cash balance availability.`
        };
      }

      case 'PRICE_CHANGE': {
        let selected = 'realization improvement';
        if (lowerText.includes('margin') || lowerText.includes('ebitda') || lowerText.includes('profitability')) {
          selected = 'margin expansion';
        } else if (lowerText.includes('elasticity') || lowerText.includes('demand') || lowerText.includes('hike offset')) {
          selected = 'demand elasticity';
        } else if (lowerText.includes('competitive') || lowerText.includes('peer') || lowerText.includes('market position')) {
          selected = 'competitive positioning';
        }
        return {
          status: state,
          mechanism: `Transmission mechanism: ${selected}. Grounded in tariff/product pricing revision updates.`
        };
      }

      case 'REGULATORY_ACTION':
      case 'LEGAL_ACTION':
      case 'TAX_ACTION': {
        let selected = 'compliance cost';
        if (lowerText.includes('restriction') || lowerText.includes('suspension') || lowerText.includes('ban')) {
          selected = 'revenue restriction';
        } else if (lowerText.includes('continuity') || lowerText.includes('shutdown') || lowerText.includes('closure')) {
          selected = 'operating continuity';
        } else if (lowerText.includes('uncertainty') || lowerText.includes('pending') || lowerText.includes('appeal')) {
          selected = 'legal uncertainty';
        } else if (lowerText.includes('reputation') || lowerText.includes('governance') || lowerText.includes('whistleblower')) {
          selected = 'reputational risk';
        }
        return {
          status: state,
          mechanism: `Transmission mechanism: ${selected}. Impacting compliance overhead, asset safety, or operational capability as defined by regulatory action.`
        };
      }

      case 'EARNINGS':
      case 'REVENUE_UPDATE':
      case 'PROFIT_UPDATE': {
        let selected = 'margin trajectory';
        if (lowerText.includes('leverage') || lowerText.includes('fixed cost')) {
          selected = 'operating leverage';
        } else if (lowerText.includes('pricing') || lowerText.includes('realization')) {
          selected = 'pricing power';
        } else if (lowerText.includes('sequential') || lowerText.includes('qoq')) {
          selected = 'sequential growth stability';
        } else if (lowerText.includes('cost') || lowerText.includes('savings') || lowerText.includes('expense')) {
          selected = 'cost control';
        }
        return {
          status: state,
          mechanism: `Transmission mechanism: ${selected}. Grounded in core sales growth, sequential profit trajectory, and operating margins.`
        };
      }

      case 'BUYBACK': {
        let selected = 'equity shrink';
        if (lowerText.includes('restructuring') || lowerText.includes('capital structure')) {
          selected = 'capital restructuring';
        } else if (lowerText.includes('undervalued') || lowerText.includes('intrinsic')) {
          selected = 'valuation signaling';
        }
        return {
          status: state,
          mechanism: `Transmission mechanism: ${selected}. Reduces paid-up capital base, increasing per-share earning metrics.`
        };
      }

      case 'SPLIT':
      case 'BONUS': {
        let selected = 'retail liquidity expansion';
        if (lowerText.includes('signaling') || lowerText.includes('confidence')) {
          selected = 'valuation signaling';
        } else if (lowerText.includes('capital base') || lowerText.includes('volume')) {
          selected = 'share volume adjustment';
        }
        return {
          status: state,
          mechanism: `Transmission mechanism: ${selected}. Non-cash cosmetic adjustment modifying outstanding shares to enhance liquidity.`
        };
      }

      case 'IPO':
      case 'FUNDRAISING':
      case 'DEBT_LISTING': {
        let selected = 'capital buffer';
        if (lowerText.includes('expansion') || lowerText.includes('capex') || lowerText.includes('growth')) {
          selected = 'expansion funding';
        } else if (lowerText.includes('interest') || lowerText.includes('coupon') || lowerText.includes('repay')) {
          selected = 'interest cost burden';
        } else if (lowerText.includes('dilution') || lowerText.includes('dilute') || lowerText.includes('equity issue')) {
          selected = 'equity dilution';
        }
        return {
          status: state,
          mechanism: `Transmission mechanism: ${selected}. Altering corporate leverage, equity share capital base, and financing structure.`
        };
      }

      case 'MANAGEMENT_CHANGE': {
        return {
          status: 'DERIVED',
          mechanism: 'Transmission mechanism: leadership continuity and succession risk. Affects management execution capability and strategic direction.'
        };
      }

      case 'FNO_POSITIONING': {
        return {
          status: 'DERIVED',
          mechanism: 'Transmission mechanism: sentiment amplification and derivatives boundary shifts. Affects immediate spot/OI interactions.'
        };
      }

      default:
        return {
          status: 'NOT_APPLICABLE',
          mechanism: 'Transmission mechanism: general operational cycle. No specific material structural changes identified.'
        };
    }
  }
}
