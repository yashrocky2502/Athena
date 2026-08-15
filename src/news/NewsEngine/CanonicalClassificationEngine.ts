import { CompanyMasterDatabase, CompanyMasterRecord } from './CompanyMasterDatabase';
import { CompanyDetector } from '../detection/CompanyDetector';
import { NewsItem } from '../models/NewsItem';
import { FNORelevanceEngine } from '../FNO/FNORelevanceEngine';
import { FNOAuditResult } from '../FNO/FOTypes';
import { isAuthoritativeFNOStory } from '../FNO/FNOAuthoritativeGate';

export type PrimaryClass =
  | 'F&O'
  | 'Markets'
  | 'Economy'
  | 'Corporate'
  | 'Global'
  | 'Commodities'
  | 'Crypto'
  | 'Politics'
  | 'Other';

export interface CanonicalClassificationResult {
  primaryCategory: PrimaryClass;
  isFO: boolean;
  foReason: string;
  telegramEligible: boolean;
  categories: string[];
  resolvedCompany: CompanyMasterRecord | null;
  confidence: number;
  fnoAudit: FNOAuditResult;
}

export class CanonicalClassificationEngine {
  // Macro / Commodity / Global / Politics keywords that MUST NEVER enter F&O unless a specific F&O company is detected
  private static readonly MACRO_BLOCK_REGEX =
    /\b(imd|weather|meteorological|monsoon|election|elections|political|politics|voting|poll|parliament|war|geopolitical|fed|fomc)\b/i;

  private static readonly POLITICS_REGEX =
    /\b(election|elections|political|politics|voting|poll|parliament|minister|government party|electoral)\b/i;

  private static readonly COMMODITY_REGEX =
    /\b(gold|silver|oil|crude|brent|wti|copper|natural gas|metals|metal|opec|bullion|commodity|commodities)\b/i;

  private static readonly CRYPTO_REGEX =
    /\b(bitcoin|ethereum|crypto|cryptocurrency|solana|btc|eth|blockchain|dogecoin|xrp|cardano)\b/i;

  private static readonly GLOBAL_REGEX =
    /\b(us markets|nasdaq|s&p 500|s&p500|dow|dow jones|wall street|nikkei|ftse|global economy|global markets|fed|federal reserve|fomc|asian markets|european markets)\b/i;

  private static readonly ECONOMY_REGEX =
    /\b(imd|weather|monsoon|rbi|reserve bank|inflation|gdp|cpi|wpi|repo rate|monetary policy|fiscal policy|tax policy|union budget|economic growth|rupee|macro|forex)\b/i;

  private static readonly CORPORATE_REGEX =
    /\b(merger|mergers|acquisition|acquisitions|quarterly results|q1|q2|q3|q4|net profit|revenue|ebitda|pat|dividend|buyback|demerger|promoter|stake sale|corporate action|rights issue|stock split|bonus issue|board meeting|ceo|cfo|managing director|guidance|concall)\b/i;

  private static readonly MARKETS_REGEX =
    /\b(nifty|sensex|bse|nse|stocks|stock|indices|fii|dii|market update|bulls|bears|trading session|market rally|dalal street|equity|equities|market cap|volumes)\b/i;

  /**
   * Classifies an article using the ATHENA Phase 20.5 Hardened F&O Engine.
   */
  public static classify(item: Partial<NewsItem>): CanonicalClassificationResult {
    const headline = item.headline || item.title || '';
    const description = item.description || item.summary || '';
    const fullBody = (item as any).fullArticleBody || (item as any).cleanBody || (item as any).content || '';
    const textLower = `${headline} ${description} ${fullBody}`.toLowerCase();

    // 1. Run Phase 20.5 Deterministic F&O Audit
    const fnoAudit = FNORelevanceEngine.evaluateAudit({
      ...item,
      title: headline,
      body: fullBody || description,
      symbol: (item as any).symbol || (item as any).fnoSymbol
    });

    // Universal Entity Detection
    const detection = CompanyDetector.detectUniversal({
      headline,
      subheadline: description,
      summary: item.summary || '',
      articleBody: fullBody,
      keywords: item.categories || (item as any).keywords || [],
      metadata: item.publisher || item.source
    });

    let resolvedCompany: CompanyMasterRecord | null = detection.masterRecords.length > 0 ? detection.masterRecords[0] : null;
    let confidence = detection.highestConfidence > 0 ? Math.min(1.0, detection.highestConfidence / 100) : 0;

    if (!resolvedCompany && fnoAudit.fnoSymbol) {
      resolvedCompany = CompanyMasterDatabase.findBySymbol(fnoAudit.fnoSymbol);
      if (resolvedCompany) confidence = 1.0;
    }

    // Macro block check
    const macroMatch = textLower.match(this.MACRO_BLOCK_REGEX);
    const hasMacroBlock = !!macroMatch && !fnoAudit.fnoSymbol;

    const tempItem = {
      ...item,
      fnoDecision: fnoAudit.fnoDecision,
      fnoEligible: fnoAudit.fnoEligible,
      fnoSymbol: fnoAudit.fnoSymbol,
      fnoRelevance: fnoAudit.fnoDecision === "INCLUDE" ? "HIGH" : fnoAudit.fnoRelevance,
      entityConfidence: fnoAudit.entityConfidence,
      entityMatchLocation: fnoAudit.entityMatchLocation
    };

    const isAuthoritative = isAuthoritativeFNOStory(tempItem);
    let isFO = isAuthoritative && !hasMacroBlock;
    let foReason = fnoAudit.fnoReasons.join('; ');

    if (hasMacroBlock) {
      isFO = false;
      foReason = `Rejected: Contains macro block term '${macroMatch![0]}' without specific F&O underlying.`;
    }

    // Primary Category
    let primaryCategory: PrimaryClass = 'Other';
    if (isFO) {
      primaryCategory = 'F&O';
    } else if (this.POLITICS_REGEX.test(textLower)) {
      primaryCategory = 'Politics';
    } else if (this.COMMODITY_REGEX.test(textLower)) {
      primaryCategory = 'Commodities';
    } else if (this.CRYPTO_REGEX.test(textLower)) {
      primaryCategory = 'Crypto';
    } else if (this.GLOBAL_REGEX.test(textLower)) {
      primaryCategory = 'Global';
    } else if (this.ECONOMY_REGEX.test(textLower)) {
      primaryCategory = 'Economy';
    } else if (resolvedCompany || this.CORPORATE_REGEX.test(textLower)) {
      primaryCategory = 'Corporate';
    } else {
      primaryCategory = 'Markets';
    }

    const categoriesSet = new Set<string>([primaryCategory]);
    if (isFO) categoriesSet.add('F&O');
    if (this.POLITICS_REGEX.test(textLower)) categoriesSet.add('Politics');
    if (this.COMMODITY_REGEX.test(textLower)) categoriesSet.add('Commodities');
    if (this.CRYPTO_REGEX.test(textLower)) categoriesSet.add('Crypto');
    if (this.GLOBAL_REGEX.test(textLower)) categoriesSet.add('Global');
    if (this.ECONOMY_REGEX.test(textLower)) categoriesSet.add('Economy');
    if (this.CORPORATE_REGEX.test(textLower)) categoriesSet.add('Corporate');
    if (this.MARKETS_REGEX.test(textLower)) categoriesSet.add('Markets');

    return {
      primaryCategory,
      isFO,
      foReason,
      telegramEligible: isFO,
      categories: Array.from(categoriesSet),
      resolvedCompany,
      confidence,
      fnoAudit
    };
  }
}
