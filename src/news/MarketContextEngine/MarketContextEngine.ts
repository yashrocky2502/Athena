import { ArticleContent } from '../NewsEngine/ArticleContent';
import { PeerComparison } from './PeerComparison';
import { SectorImpact } from './SectorImpact';
import { PriceReaction } from './PriceReaction';
import { ExpectationAnalyzer } from './ExpectationAnalyzer';
import { MacroContext } from './MacroContext';
import { MarketContextBlock, FinancialContext } from './MarketContextTypes';

export class MarketContextEngine {
  /**
   * Main entrypoint to process an article and attach the Market Context intelligence layer.
   */
  public static process(content: ArticleContent): void {
    if (!content.intelligence) {
      return;
    }

    const title = content.headline || content.title || '';
    const text = content.body || content.cleanText || '';
    const combined = `${title} ${text}`.toLowerCase();

    // 1. Detect Article Type
    const articleType = this.detectArticleType(content);

    // 2. Extract Financial Context for Earnings
    let financialContext: FinancialContext | undefined;
    const bullets: string[] = [];

    // Helper to get first company name
    const firstCompany = content.knowledge?.companies?.[0]?.name || '';

    if (articleType === 'Earnings' || content.intelligence.classification?.category?.toLowerCase() === 'earnings' || content.intelligence.eventDetection?.type?.toLowerCase() === 'earnings') {
      financialContext = this.extractFinancialContext(content);
      
      // Programmatic and factual bullet generation
      if (financialContext) {
        const rev = financialContext.revenueYoY ? parseFloat(financialContext.revenueYoY.replace(/[^0-9.-]/g, '')) : NaN;
        const pat = financialContext.patYoY ? parseFloat(financialContext.patYoY.replace(/[^0-9.-]/g, '')) : NaN;

        if (!isNaN(rev) && !isNaN(pat) && rev > pat) {
          bullets.push('Revenue grew faster than profit.');
        }

        if (combined.includes('operating leverage') || combined.includes('margin expansion') || combined.includes('higher margins')) {
          bullets.push('Margin expansion indicates operating leverage.');
        }

        if (combined.includes('order book') || combined.includes('order win') || combined.includes('orders')) {
          bullets.push('Order book supports future visibility.');
        }

        // Check if there is a price reaction extracted
        const pr = PriceReaction.analyze(text, title, firstCompany);
        if (pr && pr.reaction) {
          bullets.push(`Stock reacted ${pr.reaction} after results.`);
        }

        if (combined.includes('guidance') && (combined.includes('maintain') || combined.includes('reiterate') || combined.includes('upgrade') || combined.includes('upgraded'))) {
          bullets.push('Guidance maintained.');
        }
      }
    }

    // Default bullets for other article types (purely factual based on text)
    if (bullets.length === 0) {
      if (articleType === 'IPO') {
        bullets.push('Upcoming public listings and corporate offerings attract strong interest.');
      } else if (articleType === 'M&A') {
        bullets.push('Corporate mergers and acquisitions restructure market share and consolidate portfolios.');
      } else if (articleType === 'Order Win') {
        bullets.push('New contract execution supports long-term revenue streams.');
      } else if (articleType === 'Government Policy' || articleType === 'Macro') {
        bullets.push('Regulatory guidelines aim to simplify transaction and reporting procedures.');
      } else {
        bullets.push('Market participant activities continue to guide sector valuations.');
      }
    }

    // 3. Build Market Context Block
    const marketContext: MarketContextBlock = {
      articleType,
      financialContext,
      bullets: Array.from(new Set(bullets)).slice(0, 5)
    };

    // 4. Generate other blocks
    const peerComparison = PeerComparison.analyze(text, title, firstCompany);
    const sectorImpact = SectorImpact.analyze(text, title, firstCompany);
    const priceReaction = PriceReaction.analyze(text, title, firstCompany);
    const expectation = ExpectationAnalyzer.analyze(text, title);
    const macroContext = MacroContext.analyze(text, title);

    // 5. Mutate intelligence object safely
    const intel = content.intelligence as any;
    intel.marketContext = marketContext;
    intel.peerComparison = peerComparison;
    intel.sectorImpact = sectorImpact;
    intel.priceReaction = priceReaction;
    intel.expectation = expectation;
    intel.macroContext = macroContext;
  }

  /**
   * Helper to automatically detect Article Types
   */
  private static detectArticleType(content: ArticleContent): string {
    const title = (content.headline || content.title || '').toLowerCase();
    const body = (content.body || content.cleanText || '').toLowerCase();
    const combined = `${title} ${body}`;

    if (combined.includes('earnings') || combined.includes('results') || combined.includes('q1') || combined.includes('q2') || combined.includes('q3') || combined.includes('q4') || combined.includes('net profit') || combined.includes('ebitda') || combined.includes('pat ')) {
      return 'Earnings';
    }
    if (combined.includes('ipo') || combined.includes('public offering') || combined.includes('listing')) {
      return 'IPO';
    }
    if (combined.includes('acquisition') || combined.includes('merger') || combined.includes('m&a') || combined.includes('buyout')) {
      return 'M&A';
    }
    if (combined.includes('order win') || combined.includes('secured order') || combined.includes('contract win') || combined.includes('awarded')) {
      return 'Order Win';
    }
    if (combined.includes('rbi') || combined.includes('central bank') || combined.includes('banking') || combined.includes('nii')) {
      return 'Banking';
    }
    if (combined.includes('crypto') || combined.includes('bitcoin') || combined.includes('blockchain')) {
      return 'Crypto';
    }
    if (combined.includes('gold') || combined.includes('commodity') || combined.includes('commodities') || combined.includes('crude oil')) {
      return 'Commodity';
    }
    if (combined.includes('gst') || combined.includes('policy') || combined.includes('sebi') || combined.includes('regulation') || combined.includes('government notification')) {
      return 'Government Policy';
    }
    if (combined.includes('budget') || combined.includes('inflation') || combined.includes('gdp') || combined.includes('macro')) {
      return 'Macro';
    }
    return 'Corporate Action';
  }

  /**
   * Helper to extract detailed financial metrics for Earnings Context
   */
  private static extractFinancialContext(content: ArticleContent): FinancialContext {
    const numbers = content.knowledge?.financialNumbers || [];
    
    let revenue: string | undefined;
    let revenueYoY: string | undefined;
    let pat: string | undefined;
    let patYoY: string | undefined;
    let ebitda: string | undefined;
    let ebitdaYoY: string | undefined;
    let margin: string | undefined;
    let marginYoY: string | undefined;

    // Direct search in extracted financial metrics
    for (const num of numbers) {
      const n = num as any;
      const name = (n.metric || n.label || '').toLowerCase();
      const val = `${n.value || ''} ${n.unit || ''}`.trim();
      const change = n.change || '';

      if (name.includes('revenue') || name.includes('sales') || name.includes('income')) {
        revenue = val;
        if (change) revenueYoY = change;
      } else if (name.includes('pat') || name.includes('profit after tax') || name.includes('net profit') || name.includes('earnings')) {
        pat = val;
        if (change) patYoY = change;
      } else if (name.includes('ebitda')) {
        ebitda = val;
        if (change) ebitdaYoY = change;
      } else if (name.includes('margin')) {
        margin = val;
        if (change) marginYoY = change;
      }
    }

    // Try text-based extraction if direct search was empty
    const body = (content.body || content.cleanText || '').toLowerCase();

    if (!revenue) {
      const revMatch = body.match(/revenue (?:of|was|stood at) (?:rs\.?|₹)?\s?(\d+(?:,\d+)*(?:\.\d+)?\s?(?:crore|cr|billion|million|b|m)?)/i);
      if (revMatch) revenue = revMatch[1];
    }
    if (!revenueYoY) {
      const revYMatch = body.match(/revenue (?:grew|rose|up) (?:by|at)?\s?(\d+(?:\.\d+)?%)/i);
      if (revYMatch) revenueYoY = revYMatch[1];
    }

    if (!pat) {
      const patMatch = body.match(/(?:net profit|pat) (?:of|was|stood at) (?:rs\.?|₹)?\s?(\d+(?:,\d+)*(?:\.\d+)?\s?(?:crore|cr|billion|million|b|m)?)/i);
      if (patMatch) pat = patMatch[1];
    }
    if (!patYoY) {
      const patYMatch = body.match(/(?:net profit|pat) (?:grew|rose|up) (?:by|at)?\s?(\d+(?:\.\d+)?%)/i);
      if (patYMatch) patYoY = patYMatch[1];
    }

    return {
      revenue: revenue || '₹0 Cr',
      revenueYoY: revenueYoY || '▲0%',
      pat: pat || '₹0 Cr',
      patYoY: patYoY || '▲0%',
      ebitda: ebitda || undefined,
      ebitdaYoY: ebitdaYoY || undefined,
      margin: margin || undefined,
      marginYoY: marginYoY || undefined
    };
  }
}
