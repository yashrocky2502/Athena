import { FNORegistryService, CANONICAL_FNO_204_SYMBOLS } from '../registry/FNORegistry';
import { FNOEligibilityResult } from './FOTypes';

export function resolveFNOEligibility(article: any): FNOEligibilityResult {
  const fnoRegistry = FNORegistryService.getInstance();

  if (!article) {
    return {
      eligible: false,
      symbol: null,
      matchedEntity: null,
      confidence: "LOW",
      matchLocation: "NONE",
      reason: "Empty or null article provided"
    };
  }

  const rawTitle = (article.title || article.headline || '').toString();
  const rawBody = (article.summary || article.description || article.content || article.body || article.cleanBody || '').toString();

  const title = rawTitle.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const body = rawBody.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

  // Check explicit symbol/ticker on article object
  const explicitSymbol = (article.symbol || article.ticker || article.fnoSymbol || article.primaryCompany?.symbol || article.primaryCompany?.ticker || '')
    .toString()
    .trim()
    .toUpperCase();

  // 1. Broad Market Wrap / Multi-Stock List Detection
  // If headline is a generic market wrap or list of stocks (e.g. "Stocks to watch: Reliance, TCS, SBI" or "Indian markets volatile as investors await RBI decision"),
  // it must not be treated as a single-stock F&O subject unless a specific material corporate catalyst (earnings, FDA, order win, M&A) is in headline.
  const BROAD_MARKET_WRAP_REGEX = /\b(stocks\s+to\s+watch|stocks\s+in\s+news|top\s+stocks|stocks\s+in\s+focus|key\s+stocks|buy\s+or\s+sell|market\s+wrap|indices\s+trade|markets\s+live|sensex\s+(?:gains|falls|rises|flat)|nifty\s+(?:gains|falls|rises|flat)|await\s+rbi|investors\s+await|analysts?\s+expect\s+pressure|brokerage\s+says?\s+indian\s+stocks)\b/i;
  const HAS_SPECIFIC_CATALYST = /\b(q[1-4]|earnings|net\s+profit|pat|results?|fda|order\s+win|merger|acquisition|demerger|sebi|usfda|f&o\s+ban)\b/i;

  if (BROAD_MARKET_WRAP_REGEX.test(title) && !HAS_SPECIFIC_CATALYST.test(title)) {
    return {
      eligible: false,
      symbol: explicitSymbol || null,
      matchedEntity: null,
      confidence: "LOW",
      matchLocation: "HEADLINE",
      reason: "Headline is a broad market wrap or multi-stock focus list without a single qualifying corporate subject"
    };
  }

  // 2. Index Symbol Check (NIFTY / BANKNIFTY / FINNIFTY) in Headline
  if (/\b(NIFTY|BANKNIFTY|NIFTY50|BANK NIFTY|NIFTY 50|FINNIFTY)\b/i.test(title)) {
    let indexSym = 'NIFTY';
    if (/BANK\s*NIFTY/i.test(title)) indexSym = 'BANKNIFTY';
    else if (/FIN\s*NIFTY/i.test(title)) indexSym = 'FINNIFTY';

    return {
      eligible: true,
      symbol: indexSym,
      matchedEntity: `${indexSym} Index`,
      confidence: "HIGH",
      matchLocation: "HEADLINE",
      reason: `Index F&O symbol ${indexSym} detected in headline`
    };
  }

  // 3. Headline/Title Match against Canonical 204 F&O Universe (HIGH confidence)
  const allCompanies = fnoRegistry.getAllCompanies();

  // Check if title mentions multiple F&O companies (3 or more) -> multi-stock comparison list
  let matchedCountInTitle = 0;
  let firstMatchedComp: any = null;

  for (const comp of allCompanies) {
    let matchedInTitle = false;

    // Check symbol whole word in title
    if (comp.symbol.length >= 2) {
      const symRegex = new RegExp(`\\b${comp.symbol.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (symRegex.test(title)) {
        matchedInTitle = true;
      }
    }

    // Check full name in title
    if (!matchedInTitle) {
      const nameRegex = new RegExp(`\\b${comp.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (nameRegex.test(title)) {
        matchedInTitle = true;
      }
    }

    // Check aliases in title
    if (!matchedInTitle) {
      for (const alias of comp.aliases) {
        if (alias.length < 3) continue;
        const aliasRegex = new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (aliasRegex.test(title)) {
          matchedInTitle = true;
          break;
        }
      }
    }

    if (matchedInTitle) {
      matchedCountInTitle++;
      if (!firstMatchedComp) firstMatchedComp = comp;
    }
  }

  if (matchedCountInTitle >= 3 && !HAS_SPECIFIC_CATALYST.test(title)) {
    return {
      eligible: false,
      symbol: firstMatchedComp ? firstMatchedComp.symbol : null,
      matchedEntity: firstMatchedComp ? firstMatchedComp.name : null,
      confidence: "LOW",
      matchLocation: "HEADLINE",
      reason: "Headline mentions multiple F&O companies in a market-wide list without a single corporate subject"
    };
  }

  if (matchedCountInTitle === 1 || (matchedCountInTitle === 2 && HAS_SPECIFIC_CATALYST.test(title))) {
    return {
      eligible: true,
      symbol: firstMatchedComp.symbol,
      matchedEntity: firstMatchedComp.name,
      confidence: "HIGH",
      matchLocation: "HEADLINE",
      reason: `Company ${firstMatchedComp.name} (${firstMatchedComp.symbol}) resolved as primary subject in headline`
    };
  }

  // 4. Verify Explicit Symbol from Metadata
  if (explicitSymbol) {
    if (!fnoRegistry.isFNOCompany(explicitSymbol)) {
      return {
        eligible: false,
        symbol: explicitSymbol,
        matchedEntity: explicitSymbol,
        confidence: "HIGH",
        matchLocation: "METADATA",
        reason: `Symbol ${explicitSymbol} is not part of the canonical 204 F&O universe`
      };
    }

    const company = fnoRegistry.getBySymbol(explicitSymbol);
    // Verify if explicit symbol or company name/alias is in title
    const compName = company ? company.name : explicitSymbol;
    const nameRegex = new RegExp(`\\b${compName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    const symRegex = new RegExp(`\\b${explicitSymbol.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');

    if (symRegex.test(title) || nameRegex.test(title)) {
      return {
        eligible: true,
        symbol: explicitSymbol,
        matchedEntity: compName,
        confidence: "HIGH",
        matchLocation: "HEADLINE",
        reason: `Explicitly tagged F&O symbol ${explicitSymbol} confirmed as subject in headline`
      };
    } else {
      // Explicit symbol exists in metadata/body but NOT in headline
      return {
        eligible: false,
        symbol: explicitSymbol,
        matchedEntity: compName,
        confidence: "MEDIUM",
        matchLocation: "METADATA",
        reason: `Symbol ${explicitSymbol} present in metadata/tags but not subject in headline (confidence MEDIUM)`
      };
    }
  }

  // 5. Body-Only Match Check (MEDIUM confidence - NOT eligible for F&O)
  for (const comp of allCompanies) {
    const nameRegex = new RegExp(`\\b${comp.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (nameRegex.test(body)) {
      return {
        eligible: false,
        symbol: comp.symbol,
        matchedEntity: comp.name,
        confidence: "MEDIUM",
        matchLocation: "BODY_ONLY",
        reason: `Entity ${comp.symbol} only detected in article body (BODY_ONLY, confidence MEDIUM)`
      };
    }
  }

  // 6. No Match
  return {
    eligible: false,
    symbol: null,
    matchedEntity: null,
    confidence: "LOW",
    matchLocation: "NONE",
    reason: "No canonical F&O entity resolved in headline or title"
  };
}
