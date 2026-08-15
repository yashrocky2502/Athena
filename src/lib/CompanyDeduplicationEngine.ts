import { CompanyIdentityResolver, CanonicalCompanyRecord } from "./CompanyIdentityResolver";

export class CompanyDeduplicationEngine {
  private static instance: CompanyDeduplicationEngine;
  private resolver = CompanyIdentityResolver.getInstance();

  public static getInstance(): CompanyDeduplicationEngine {
    if (!CompanyDeduplicationEngine.instance) {
      CompanyDeduplicationEngine.instance = new CompanyDeduplicationEngine();
    }
    return CompanyDeduplicationEngine.instance;
  }

  /**
   * Deduplicates an array of company objects or symbols by resolving each to its canonical entity.
   * Eliminates duplicate ISINs, duplicate canonical symbols, and legacy records.
   */
  public deduplicateList<T extends any>(items: T[], getSymbolOrQuery?: (item: T) => string): T[] {
    if (!Array.isArray(items) || items.length === 0) return [];

    const seenISINs = new Set<string>();
    const seenSymbols = new Set<string>();
    const deduplicated: T[] = [];

    for (const item of items) {
      const rawQuery = getSymbolOrQuery 
        ? getSymbolOrQuery(item) 
        : (typeof item === 'string' 
            ? item 
            : ((item as any).canonicalSymbol || (item as any).symbol || (item as any).companyId || (item as any).name || ''));
      if (!rawQuery) continue;

      const canonical = this.resolver.resolve(String(rawQuery));
      if (!canonical) continue;

      // Duplicate detection using ISIN and canonical symbol
      const isinKey = canonical.isin && canonical.isin !== "INE000A00000" ? canonical.isin : null;
      const symbolKey = canonical.canonicalSymbol;

      if (isinKey && seenISINs.has(isinKey)) {
        continue; // Skip duplicate ISIN (e.g. Zomato & Eternal sharing INE758T01015)
      }
      if (symbolKey && seenSymbols.has(symbolKey)) {
        continue; // Skip duplicate canonical symbol
      }

      if (isinKey) seenISINs.add(isinKey);
      if (symbolKey) seenSymbols.add(symbolKey);

      // Mutate or wrap item if it's an object to ensure canonical fields are set
      if (typeof item === 'object' && item !== null) {
        const cleanedItem = {
          ...item,
          symbol: canonical.canonicalSymbol,
          canonicalSymbol: canonical.canonicalSymbol,
          officialName: canonical.officialName,
          name: canonical.officialName,
          companyId: canonical.canonicalSymbol,
          isin: canonical.isin !== "INE000A00000" ? canonical.isin : ((item as any).isin || canonical.isin),
          industry: canonical.industry || (item as any).industry,
          sector: canonical.sector || (item as any).sector,
          corporateActions: canonical.corporateActions
        };
        deduplicated.push(cleanedItem as T);
      } else if (typeof item === 'string') {
        deduplicated.push(canonical.canonicalSymbol as unknown as T);
      } else {
        deduplicated.push(item);
      }
    }

    return deduplicated;
  }

  /**
   * Deduplicates search results for any query.
   * Searching "Zomato" returns ONLY 1 result: "Eternal Ltd (ETERNAL)".
   * Searching "Tata Motors" returns ONLY active listed entities:
   * "Tata Motors Passenger Vehicles Ltd (TATAMOTORS)" and "Tata Motors Commercial Vehicles Ltd (TATAMTRDVR)".
   */
  public filterSearchResults(query: string): CanonicalCompanyRecord[] {
    if (!query || !query.trim()) return this.resolver.getTrendingCompanies();

    const matches = this.resolver.resolveAllMatches(query);
    
    // Deduplicate by ISIN or canonical symbol
    const seenISINs = new Set<string>();
    const seenSymbols = new Set<string>();
    const cleanResults: CanonicalCompanyRecord[] = [];

    for (const match of matches) {
      const isinKey = match.isin && match.isin !== "INE000A00000" ? match.isin : null;
      const symbolKey = match.canonicalSymbol;

      if (isinKey && seenISINs.has(isinKey)) continue;
      if (symbolKey && seenSymbols.has(symbolKey)) continue;

      if (isinKey) seenISINs.add(isinKey);
      if (symbolKey) seenSymbols.add(symbolKey);

      cleanResults.push(match);
    }

    return cleanResults;
  }

  /**
   * Validates dataset before rendering to UI:
   * Performs Duplicate ISIN check, Duplicate ticker check, Duplicate company check, Corporate Action replacement check.
   */
  public validateBeforeUiRender<T extends any>(records: T[], getSymbolFn?: (item: T) => string): T[] {
    return this.deduplicateList(records, getSymbolFn);
  }
}
