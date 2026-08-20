import { CompanyMasterDatabase, CompanyMasterRecord } from '../NewsEngine/CompanyMasterDatabase';
import { SymbolResolutionState } from '../types/TraderIntelligence';

export interface ExtractedEntity {
  nseSymbol: string;
  bseSymbol?: string;
  companyName: string;
  sector: string;
  industry?: string;
  indices: string[];
  isFOEligible: boolean;
  confidence: number;
}

interface CompanyRegistryEntry {
  nseSymbol: string;
  bseSymbol?: string;
  companyName: string;
  sector: string;
  industry?: string;
  indices: string[];
  isFOEligible: boolean;
  aliases: string[];
}

export class SymbolExtractor {
  public static readonly BROKERAGE_PATTERNS = [
    'sbi securities', 'sbi cap', 'sbi capital', 'sbi mutual fund', 'sbi research',
    'hdfc securities', 'hdfc capital', 'hdfc mutual fund', 'hdfc sec',
    'icici direct', 'icici securities', 'icicidirect', 'icici sec',
    'kotak securities', 'kotak institutional', 'kotak sec',
    'axis capital', 'axis securities', 'axis direct',
    'motilal oswal', 'motilal oswal financial', 'motilal oswal securities',
    'choice broking', 'sharekhan', 'zerodha', 'groww', 'angel one', '5paisa',
    'iifl securities', 'prabhudas lilladher', 'anand rathi', 'geojit', 'monarch networth',
    'systematix', 'nirmal bang', 'ventura securities', 'smc global', 'elara capital',
    'nuvama', 'incred equities', 'jm financial', 'centrum broking', 'equirus',
    'bob capital', 'canara bank securities', 'pnb securities', 'yes securities', 'idbi capital',
    'goldman sachs', 'morgan stanley', 'j.p. morgan', 'jp morgan', 'jefferies',
    'clsa', 'nomura', 'ubs', 'citi', 'citigroup', 'credit suisse', 'macquarie',
    'bank of america', 'bofa securities', 'hsbc', 'hsbc global', 'bernstein', 'stifel',
    'master capital', 'master capital services', 'investec', 'dolat capital'
  ];

  private static companyMap: CompanyRegistryEntry[] = [
    {
      nseSymbol: 'RELIANCE',
      bseSymbol: '500325',
      companyName: 'Reliance Industries Limited',
      sector: 'Energy & Petrochemicals',
      industry: 'Oil & Gas',
      indices: ['NIFTY 50', 'SENSEX', 'NIFTY 100', 'NIFTY ENERGY'],
      isFOEligible: true,
      aliases: ['reliance', 'ril', 'jio', 'reliance industries', 'ambani', 'reliance retail'],
    },
    {
      nseSymbol: 'TCS',
      bseSymbol: '532540',
      companyName: 'Tata Consultancy Services Limited',
      sector: 'Information Technology',
      industry: 'IT Services',
      indices: ['NIFTY 50', 'SENSEX', 'NIFTY IT', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['tcs', 'tata consultancy', 'tata consultancy services'],
    },
    {
      nseSymbol: 'INFY',
      bseSymbol: '500209',
      companyName: 'Infosys Limited',
      sector: 'Information Technology',
      industry: 'IT Services',
      indices: ['NIFTY 50', 'SENSEX', 'NIFTY IT', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['infosys', 'infy'],
    },
    {
      nseSymbol: 'HDFCBANK',
      bseSymbol: '500180',
      companyName: 'HDFC Bank Limited',
      sector: 'Financial Services',
      industry: 'Banking',
      indices: ['NIFTY 50', 'BANKNIFTY', 'SENSEX', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['hdfc bank', 'hdfcbank', 'hdfc'],
    },
    {
      nseSymbol: 'ICICIBANK',
      bseSymbol: '532174',
      companyName: 'ICICI Bank Limited',
      sector: 'Financial Services',
      industry: 'Banking',
      indices: ['NIFTY 50', 'BANKNIFTY', 'SENSEX', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['icici bank', 'icicibank', 'icici'],
    },
    {
      nseSymbol: 'SBIN',
      bseSymbol: '500112',
      companyName: 'State Bank of India',
      sector: 'Financial Services',
      industry: 'Banking',
      indices: ['NIFTY 50', 'BANKNIFTY', 'SENSEX', 'NIFTY 100', 'NIFTY PSU BANK'],
      isFOEligible: true,
      aliases: ['state bank of india', 'sbin'], // Removed standalone 'sbi' to prevent brokerage false positives
    },
    {
      nseSymbol: 'TATAMOTORS',
      bseSymbol: '500570',
      companyName: 'Tata Motors Limited',
      sector: 'Automobile',
      industry: 'Auto - Passenger & Commercial',
      indices: ['NIFTY 50', 'SENSEX', 'NIFTY AUTO', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['tata motors', 'tatamotors', 'jlr', 'jaguar land rover'],
    },
    {
      nseSymbol: 'BHARTIARTL',
      bseSymbol: '532454',
      companyName: 'Bharti Airtel Limited',
      sector: 'Telecommunication',
      industry: 'Telecom Services',
      indices: ['NIFTY 50', 'SENSEX', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['bharti airtel', 'airtel', 'bhartiartl'],
    },
    {
      nseSymbol: 'LTIM',
      bseSymbol: '540005',
      companyName: 'LTIMindtree Limited',
      sector: 'Information Technology',
      industry: 'IT Services',
      indices: ['NIFTY 50', 'NIFTY IT', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['ltimindtree', 'ltim', 'l&t infotech', 'mindtree'],
    },
    {
      nseSymbol: 'AXISBANK',
      bseSymbol: '532215',
      companyName: 'Axis Bank Limited',
      sector: 'Financial Services',
      industry: 'Banking',
      indices: ['NIFTY 50', 'BANKNIFTY', 'SENSEX', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['axis bank', 'axisbank'],
    },
    {
      nseSymbol: 'KOTAKBANK',
      bseSymbol: '500247',
      companyName: 'Kotak Mahindra Bank Limited',
      sector: 'Financial Services',
      industry: 'Banking',
      indices: ['NIFTY 50', 'BANKNIFTY', 'SENSEX', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['kotak bank', 'kotak mahindra bank', 'kotakbank'],
    },
    {
      nseSymbol: 'LT',
      bseSymbol: '500510',
      companyName: 'Larsen & Toubro Limited',
      sector: 'Construction & Capital Goods',
      industry: 'Infrastructure',
      indices: ['NIFTY 50', 'SENSEX', 'NIFTY 100', 'NIFTY INFRA'],
      isFOEligible: true,
      aliases: ['larsen & toubro', 'l&t', 'larsen and toubro'],
    },
    {
      nseSymbol: 'MARUTI',
      bseSymbol: '532500',
      companyName: 'Maruti Suzuki India Limited',
      sector: 'Automobile',
      industry: 'Auto - Passenger',
      indices: ['NIFTY 50', 'SENSEX', 'NIFTY AUTO', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['maruti suzuki', 'maruti'],
    },
    {
      nseSymbol: 'SUNPHARMA',
      bseSymbol: '524715',
      companyName: 'Sun Pharmaceutical Industries Limited',
      sector: 'Healthcare & Pharma',
      industry: 'Pharmaceuticals',
      indices: ['NIFTY 50', 'SENSEX', 'NIFTY PHARMA', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['sun pharma', 'sun pharmaceutical', 'sunpharma'],
    },
    {
      nseSymbol: 'ADANIENT',
      bseSymbol: '512599',
      companyName: 'Adani Enterprises Limited',
      sector: 'Metals & Mining',
      industry: 'Trading & Incubation',
      indices: ['NIFTY 50', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['adani enterprises', 'adanient', 'adani group'],
    },
    {
      nseSymbol: 'ITC',
      bseSymbol: '500875',
      companyName: 'ITC Limited',
      sector: 'Consumer Goods',
      industry: 'FMCG',
      indices: ['NIFTY 50', 'SENSEX', 'NIFTY FMCG', 'NIFTY 100'],
      isFOEligible: true,
      aliases: ['itc', 'itc limited'],
    },
  ];

  public static sanitizeTextForCompanyExtraction(text: string): string {
    let sanitized = text;
    for (const b of this.BROKERAGE_PATTERNS) {
      const escaped = b.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '[ANALYST_BROKERAGE_ENTITY]');
    }
    return sanitized;
  }

  public static extractBrokerages(headline: string = '', body: string = ''): string[] {
    const combined = `${headline} ${body}`.toLowerCase();
    const found = new Set<string>();
    for (const b of this.BROKERAGE_PATTERNS) {
      if (combined.includes(b)) {
        // Format acronyms properly: SBI, HDFC, ICICI, etc.
        const formatted = b.split(' ').map(w => {
          const upper = w.toUpperCase();
          if (['SBI', 'HDFC', 'ICICI', 'KOTAK', 'IIFL', 'SMC', 'JM', 'BOB', 'IDBI', 'CLSA', 'UBS', 'CITI', 'HSBC', 'FDA', 'SEBI', 'RBI', 'BSE', 'NSE'].includes(upper)) {
            return upper;
          }
          return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(' ');
        found.add(formatted);
      }
    }
    return Array.from(found);
  }

  public static resolveSymbol(input: string): CompanyRegistryEntry | null {
    if (!input) return null;
    const clean = input.trim().toLowerCase();
    const upper = input.trim().toUpperCase();

    // 1. Direct NSE symbol check in companyMap
    const directMatch = this.companyMap.find(c => c.nseSymbol.toUpperCase() === upper);
    if (directMatch) return directMatch;

    // 2. Check CompanyMasterDatabase
    const masterMatch = CompanyMasterDatabase.MASTER_RECORDS.find(
      r => r.symbol.toUpperCase() === upper || r.scripCode === upper
    );
    if (masterMatch) {
      return {
        nseSymbol: masterMatch.symbol,
        bseSymbol: masterMatch.scripCode,
        companyName: masterMatch.name,
        sector: masterMatch.sector,
        industry: masterMatch.industry,
        indices: masterMatch.indices || ['NIFTY 500'],
        isFOEligible: masterMatch.fo,
        aliases: masterMatch.aliases || [masterMatch.name]
      };
    }

    // 3. Alias check
    for (const entry of this.companyMap) {
      for (const alias of entry.aliases) {
        if (alias.toLowerCase() === clean) {
          return entry;
        }
      }
    }

    // 4. Check Master Database aliases
    const masterAliasMatch = CompanyMasterDatabase.MASTER_RECORDS.find(
      r => (r.aliases || []).some(a => a.toLowerCase() === clean) || r.name.toLowerCase() === clean
    );
    if (masterAliasMatch) {
      return {
        nseSymbol: masterAliasMatch.symbol,
        bseSymbol: masterAliasMatch.scripCode,
        companyName: masterAliasMatch.name,
        sector: masterAliasMatch.sector,
        industry: masterAliasMatch.industry,
        indices: masterAliasMatch.indices || ['NIFTY 500'],
        isFOEligible: masterAliasMatch.fo,
        aliases: masterAliasMatch.aliases || [masterAliasMatch.name]
      };
    }

    return null;
  }

  public static extractEntities(text: string, title: string = ''): ExtractedEntity[] {
    // Crucial Step: Sanitize text to remove brokerage names before matching stock tickers!
    const rawCombined = `${title} ${text}`;
    const sanitizedCombined = this.sanitizeTextForCompanyExtraction(rawCombined).toLowerCase();

    const results: ExtractedEntity[] = [];
    const matchedSymbols = new Set<string>();

    // 1. Check local companyMap first
    for (const entry of this.companyMap) {
      let isMatch = false;

      // Exact symbol match check
      const symbolRegex = new RegExp(`\\b${entry.nseSymbol.toLowerCase()}\\b`, 'i');
      if (symbolRegex.test(sanitizedCombined)) {
        isMatch = true;
      }

      // Alias match check
      if (!isMatch) {
        for (const alias of entry.aliases) {
          if (alias.length <= 3) {
            const aliasRegex = new RegExp(`\\b${alias}\\b`, 'i');
            if (aliasRegex.test(sanitizedCombined)) {
              isMatch = true;
              break;
            }
          } else if (sanitizedCombined.includes(alias)) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch && !matchedSymbols.has(entry.nseSymbol)) {
        matchedSymbols.add(entry.nseSymbol);
        results.push({
          nseSymbol: entry.nseSymbol,
          bseSymbol: entry.bseSymbol,
          companyName: entry.companyName,
          sector: entry.sector,
          industry: entry.industry,
          indices: entry.indices,
          isFOEligible: entry.isFOEligible,
          confidence: 90,
        });
      }
    }

    // 2. Check full Master Records
    for (const record of CompanyMasterDatabase.MASTER_RECORDS) {
      if (matchedSymbols.has(record.symbol)) continue;

      let isMatch = false;

      // Symbol match
      if (record.symbol.length >= 3) {
        const symRegex = new RegExp(`\\b${record.symbol.toLowerCase()}\\b`, 'i');
        if (symRegex.test(sanitizedCombined)) {
          isMatch = true;
        }
      }

      // Alias match
      if (!isMatch && record.aliases) {
        for (const alias of record.aliases) {
          const cleanAlias = alias.toLowerCase();
          if (cleanAlias.length <= 3) {
            const aliasRegex = new RegExp(`\\b${cleanAlias}\\b`, 'i');
            if (aliasRegex.test(sanitizedCombined)) {
              isMatch = true;
              break;
            }
          } else if (sanitizedCombined.includes(cleanAlias)) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch && !matchedSymbols.has(record.symbol)) {
        matchedSymbols.add(record.symbol);
        results.push({
          nseSymbol: record.symbol,
          bseSymbol: record.scripCode,
          companyName: record.name,
          sector: record.sector,
          industry: record.industry,
          indices: record.indices || ['NIFTY 500'],
          isFOEligible: record.fo,
          confidence: 85,
        });
      }
    }

    return results;
  }

  /**
   * Primary entry point for extracting entities.
   */
  public static extract(headline: string = '', body: string = ''): ExtractedEntity[] {
    return this.extractEntities(body, headline);
  }

  /**
   * Unlisted / Subject Entity Extractor for articles without listed tickers (e.g. IPOs)
   */
  public static extractUnlistedSubjectEntity(headline: string): string | null {
    if (!headline) return null;

    // Check upgrade/downgrade/rating subject: "SBI Securities Upgrades Sunshine Pictures Target Price"
    const ratingMatch = headline.match(/(?:upgrades?|downgrades?|rates?|recommends?|initiates?\s+(?:coverage\s+on)?|buy rating on|target price on)\s+([A-Z0-9\&\s\-]{2,30}?)\s+(?:target\s+price|tp|rating|to|at|buy|hold|sell|outperform|underperform)/i);
    if (ratingMatch && ratingMatch[1]) {
      const candidate = ratingMatch[1].trim();
      if (!/buzzing|upcoming|market|top|how to|stocks|news|today|sbi|hdfc|icici/i.test(candidate)) {
        return candidate;
      }
    }

    // Check for IPO patterns: "Sunshine Pictures IPO", "Swiggy IPO", etc.
    const ipoMatch = headline.match(/([A-Z0-9\&\s\-]{3,35})\s+(?:IPO|SME IPO|listing|opens today|public issue)/i);
    if (ipoMatch && ipoMatch[1]) {
      const candidate = ipoMatch[1].trim();
      if (!/buzzing|upcoming|market|top|how to|stocks|news|today/i.test(candidate)) {
        return candidate;
      }
    }

    // Check for company name before action verbs
    const actionMatch = headline.match(/([A-Z0-9\&\s\-]{3,35})\s+(?:shares|stock|qip|block deal|secures|bags|launches)/i);
    if (actionMatch && actionMatch[1]) {
      const candidate = actionMatch[1].trim();
      if (!/buzzing|market|nifty|sensex|indian|top|sbi|hdfc|icici/i.test(candidate)) {
        return candidate;
      }
    }

    return null;
  }
}
