import { supabaseAdmin } from "../lib/supabase";
import { CompanyIdentityResolver } from "../lib/CompanyIdentityResolver";

export interface CompanyAlias {
  alias: string;
  canonicalName: string;
  symbol: string;
}

export class CompanyRegistry {
  private static instance: CompanyRegistry;
  private resolver = CompanyIdentityResolver.getInstance();
  private aliases: Map<string, CompanyAlias> = new Map();
  private canonicalMap: Map<string, string> = new Map();

  private constructor() {
    this.seedDefaults();
    this.syncFromSupabase();
  }

  public static getInstance(): CompanyRegistry {
    if (!CompanyRegistry.instance) {
      CompanyRegistry.instance = new CompanyRegistry();
    }
    return CompanyRegistry.instance;
  }

  private seedDefaults() {
    const defaults: CompanyAlias[] = [
      { alias: "Zomato", canonicalName: "Eternal Ltd", symbol: "ETERNAL" },
      { alias: "ZOMATO", canonicalName: "Eternal Ltd", symbol: "ETERNAL" },
      { alias: "Eternal", canonicalName: "Eternal Ltd", symbol: "ETERNAL" },
      { alias: "Facebook", canonicalName: "Meta", symbol: "META" },
      { alias: "Reliance", canonicalName: "Reliance Industries Ltd", symbol: "RELIANCE" },
      { alias: "Reliance Industries", canonicalName: "Reliance Industries Ltd", symbol: "RELIANCE" },
      { alias: "RIL", canonicalName: "Reliance Industries Ltd", symbol: "RELIANCE" },
      { alias: "Tata Motors", canonicalName: "Tata Motors Passenger Vehicles Ltd", symbol: "TATAMOTORS" },
      { alias: "Tata Motors PV", canonicalName: "Tata Motors Passenger Vehicles Ltd", symbol: "TATAMOTORS" },
      { alias: "Tata Motors CV", canonicalName: "Tata Motors Commercial Vehicles Ltd", symbol: "TATAMTRDVR" },
      { alias: "TCS", canonicalName: "Tata Consultancy Services Ltd", symbol: "TCS" },
      { alias: "Infosys", canonicalName: "Infosys Ltd", symbol: "INFY" },
      { alias: "HDFC Bank", canonicalName: "HDFC Bank Ltd", symbol: "HDFCBANK" }
    ];

    defaults.forEach(a => {
      this.aliases.set(a.alias.toLowerCase(), a);
      this.canonicalMap.set(a.symbol, a.canonicalName);
    });
  }

  private async syncFromSupabase() {
    try {
      const { data, error } = await supabaseAdmin.from('companies').select('*');
      if (!error && data) {
        data.forEach(d => {
          this.canonicalMap.set(d.symbol, d.company_name);
        });
      }
    } catch (e) {
      console.error("[CompanyRegistry] Sync failed", e);
    }
  }

  /**
   * Resolves any name or alias to the canonical company information.
   */
  public resolve(input: string): { symbol: string; name: string } {
    const canonical = this.resolver.resolve(input);
    if (canonical && canonical.officialName) {
      return { symbol: canonical.canonicalSymbol, name: canonical.officialName };
    }

    const normalized = (input || "").trim().toLowerCase();
    
    // Check alias map
    const aliasMatch = this.aliases.get(normalized);
    if (aliasMatch) {
      return { symbol: aliasMatch.symbol, name: aliasMatch.canonicalName };
    }

    // Check symbol match directly (assuming uppercase symbols)
    const symbolMatch = this.canonicalMap.get(input.toUpperCase());
    if (symbolMatch) {
      return { symbol: input.toUpperCase(), name: symbolMatch };
    }

    // Fallback: return as is if no mapping found
    return { symbol: input.toUpperCase(), name: input };
  }

  public getCanonicalName(symbol: string): string {
    const canonical = this.resolver.resolve(symbol);
    if (canonical && canonical.officialName) {
      return canonical.officialName;
    }
    return this.canonicalMap.get(symbol.toUpperCase()) || symbol;
  }
}

