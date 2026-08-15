import { NewsItem } from '../models/NewsItem';
import { CompanyMasterDatabase } from './CompanyMasterDatabase';
import { CanonicalClassificationEngine } from './CanonicalClassificationEngine';
import { CANONICAL_FNO_204_SYMBOLS } from '../registry/FNORegistry';
import { isAuthoritativeFNOStory } from '../FNO/FNOAuthoritativeGate';

export type CategoryName =
  | 'All'
  | 'F&O'
  | 'Markets'
  | 'Economy'
  | 'Corporate'
  | 'Crypto'
  | 'Commodities'
  | 'Technology'
  | 'IPO'
  | 'Global'
  | 'Results'
  | 'Exchange';

export const FO_UNIVERSE = new Set(CANONICAL_FNO_204_SYMBOLS);
export const FO_SYMBOLS_SET = FO_UNIVERSE;

const RAW_CATEGORY_MAP: Record<string, string[]> = {
  'GENERAL_MARKET': ['Markets'],
  'GENERAL_MARKETS': ['Markets'],
  'DOMESTIC_MARKETS': ['Markets'],
  'GLOBAL_MARKETS': ['Global', 'Markets'],
  'GLOBAL': ['Global'],
  'QUARTERLY_RESULTS': ['Results', 'Corporate'],
  'RESULT_REACTION': ['Results', 'Corporate'],
  'RESULT_PREVIEW': ['Results', 'Corporate'],
  'CPI': ['Economy'],
  'RESIGNATION': ['Corporate'],
  'M_AND_A': ['Corporate'],
  'MERGER_ACQUISITION': ['Corporate'],
  'POLICY_UPDATE': ['Economy', 'Exchange'],
  'RBI_POLICY': ['Economy'],
  'SEBI_ACTION': ['Exchange'],
  'EXCHANGE_CIRCULAR': ['Exchange'],
  'EXCHANGE': ['Exchange'],
  'IPO': ['IPO'],
  'SME_IPO': ['IPO'],
  'COMMODITIES': ['Commodities'],
  'COMMODITY': ['Commodities'],
  'CRYPTO': ['Crypto'],
  'TECH': ['Technology'],
  'TECHNOLOGY': ['Technology'],
  'BROKER_REPORT': ['Markets'],
  'FOREX': ['Economy', 'Markets'],
  'GUIDANCE': ['Corporate'],
  'CAPEX': ['Corporate'],
  'ORDER_WIN': ['Corporate'],
  'DIVIDEND': ['Corporate', 'Results'],
  'CORPORATE_ACTION': ['Corporate'],
  'FUND_RAISING': ['Corporate'],
  'MACROECONOMICS': ['Economy']
};

export class NewsClassifier {
  /**
   * Helper to check if an article belongs to the F&O Universe deterministically.
   * Delegates to CanonicalClassificationEngine.
   */
  public static isFOArticle(article: any): boolean {
    const res = CanonicalClassificationEngine.classify(article);
    return res.isFO;
  }

  /**
   * Classifies an article headline + description into category tags.
   * Delegates to CanonicalClassificationEngine.
   */
  public static classifyArticle(headline: string, description: string = '', isExchange: boolean = false): string[] {
    const res = CanonicalClassificationEngine.classify({ headline, description });
    return res.categories;
  }

  /**
   * Helper to organize a list of articles into separate categorized arrays once.
   */
  public static groupArticlesByCategory<T extends { category?: string; categories?: string[]; headline?: string; title?: string; description?: string; symbol?: string; companyName?: string; tickers?: string[]; isFO?: boolean }>(
    articles: T[]
  ): Record<string, T[]> {
    const groups: Record<string, T[]> = {
      All: [],
      'F&O': [],
      Markets: [],
      Economy: [],
      Corporate: [],
      Crypto: [],
      Commodities: [],
      Technology: [],
      IPO: [],
      Global: [],
      Results: [],
      Exchange: [],
    };

    for (const article of articles) {
      groups.All.push(article);

      const canonicalRes = CanonicalClassificationEngine.classify(article);
      const isFO = canonicalRes.isFO;

      const articleCats = new Set<string>(canonicalRes.categories || []);
      if (canonicalRes.primaryCategory) {
        articleCats.add(canonicalRes.primaryCategory);
      }

      if (article.category) {
        articleCats.add(article.category);
        if (RAW_CATEGORY_MAP[article.category]) {
          RAW_CATEGORY_MAP[article.category].forEach(c => articleCats.add(c));
        }
      }

      if (article.categories && Array.isArray(article.categories)) {
        for (const cat of article.categories) {
          articleCats.add(cat);
          if (RAW_CATEGORY_MAP[cat]) {
            RAW_CATEGORY_MAP[cat].forEach(c => articleCats.add(c));
          }
        }
      }

      // Rule: Article enters F&O IF AND ONLY IF it satisfies the single authoritative gate
      const isFOArticle = isAuthoritativeFNOStory(article) || isFO;
      if (isFOArticle) {
        groups['F&O'].push(article);
      }

      for (const catKey of Object.keys(groups)) {
        if (catKey === 'All' || catKey === 'F&O') continue;
        if (articleCats.has(catKey)) {
          groups[catKey].push(article);
        }
      }
    }

    return groups;
  }
}
