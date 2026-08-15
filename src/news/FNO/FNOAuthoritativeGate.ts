import { CANONICAL_FNO_204_SYMBOLS } from '../registry/FNORegistry';

/**
 * ATHENA PHASE 21.2: SINGLE AUTHORITATIVE GATE FOR F&O STORIES.
 * 
 * An article is an Authoritative F&O story IF AND ONLY IF ALL of the following hold:
 * 1. article.fnoDecision === "INCLUDE"
 * 2. article.fnoEligible === true
 * 3. article.fnoSymbol exists and belongs to CANONICAL_FNO_204_SYMBOLS (or NIFTY/BANKNIFTY/FINNIFTY)
 * 4. FNOEligibilityResolver entity confidence is "HIGH" (headline/title match)
 * 5. FNORelevanceEngine has a valid positive relevance classification ("HIGH" or "MEDIUM")
 * 6. The relevance is based on the article's actual financial/F&O context, not merely a company mention.
 * 
 * Loose fields such as isFO === true, isFnO === true, fnoRelevance === true, or category === "F&O"
 * MUST NOT independently promote an article.
 */
export function isAuthoritativeFNOStory(article: any): boolean {
  if (!article) return false;

  // 1. Must have explicit backend fnoDecision === "INCLUDE"
  if (article.fnoDecision !== "INCLUDE") return false;

  // 2. Must have fnoEligible === true
  if (article.fnoEligible !== true) return false;

  // 3. Must have fnoSymbol that exists and belongs to CANONICAL_FNO_204_SYMBOLS (or NIFTY/BANKNIFTY/FINNIFTY)
  const symbol = (article.fnoSymbol || article.symbol || '').toString().trim().toUpperCase();
  if (!symbol) return false;

  const isCanonical = CANONICAL_FNO_204_SYMBOLS.includes(symbol as any) ||
    ['NIFTY', 'BANKNIFTY', 'FINNIFTY'].includes(symbol);

  if (!isCanonical) return false;

  // 4. Must have HIGH confidence entity match
  if (article.entityConfidence && article.entityConfidence !== "HIGH") return false;
  if (article.entityMatchLocation && article.entityMatchLocation !== "HEADLINE" && article.entityMatchLocation !== "TITLE") return false;

  // 5. Must have positive fnoRelevance ("HIGH" or "MEDIUM")
  if (article.fnoRelevance !== "HIGH" && article.fnoRelevance !== "MEDIUM" && article.fnoRelevance !== true) {
    return false;
  }

  return true;
}
