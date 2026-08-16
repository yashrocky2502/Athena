import { NewsArticle } from '../types/Article';

export interface SearchOptions {
  query?: string;
  category?: string;
  symbol?: string;
  sector?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  articles: NewsArticle[];
  totalMatches: number;
  query: string;
}

export class NewsSearchEngine {
  public static search(articles: NewsArticle[], options: SearchOptions): SearchResult {
    const rawQuery = (options.query || '').trim();
    const queryLower = rawQuery.toLowerCase();
    const categoryFilter = (options.category || '').trim().toLowerCase();
    const symbolFilter = (options.symbol || '').trim().toUpperCase();
    const sectorFilter = (options.sector || '').trim().toLowerCase();

    let matched = articles.filter(article => {
      const artAny = article as any;
      // Category filter check
      if (categoryFilter && categoryFilter !== 'all') {
        const artCat = (article.primaryCategory || artAny.category || '').toLowerCase();
        if (categoryFilter === 'f&o' || categoryFilter === 'fno') {
          if (!article.fnoEligible && !artCat.includes('f&o') && !artCat.includes('fno')) {
            return false;
          }
        } else if (artCat !== categoryFilter) {
          return false;
        }
      }

      // Symbol filter check
      if (symbolFilter) {
        const artSym = (article.symbol || artAny.nseSymbol || '').toString().toUpperCase();
        if (artSym !== symbolFilter) {
          return false;
        }
      }

      // Sector filter check
      if (sectorFilter) {
        const artSec = (artAny.sector || '').toLowerCase();
        if (!artSec.includes(sectorFilter)) {
          return false;
        }
      }

      // Query search check across multiple fields
      if (!queryLower) return true;

      const title = (article.headline || artAny.title || '').toLowerCase();
      const body = (article.body || artAny.summary || artAny.content || '').toLowerCase();
      const pub = (article.source?.name || article.source?.publisher || artAny.publisher?.name || '').toLowerCase();
      const sym = (article.symbol || artAny.nseSymbol || '').toString().toLowerCase();
      const sec = (artAny.sector || '').toLowerCase();
      const cat = (article.primaryCategory || artAny.category || '').toLowerCase();

      return (
        title.includes(queryLower) ||
        body.includes(queryLower) ||
        pub.includes(queryLower) ||
        sym.includes(queryLower) ||
        sec.includes(queryLower) ||
        cat.includes(queryLower)
      );
    });

    const totalMatches = matched.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const paginated = matched.slice(offset, offset + limit);

    return {
      articles: paginated,
      totalMatches,
      query: rawQuery,
    };
  }
}
