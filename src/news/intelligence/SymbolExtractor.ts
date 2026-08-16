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
      aliases: ['state bank of india', 'sbi', 'sbin'],
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

  public static extractEntities(text: string, title: string = ''): ExtractedEntity[] {
    const combined = `${title} ${text}`.toLowerCase();
    const results: ExtractedEntity[] = [];
    const matchedSymbols = new Set<string>();

    for (const entry of this.companyMap) {
      let isMatch = false;

      // Exact symbol match check
      const symbolRegex = new RegExp(`\\b${entry.nseSymbol.toLowerCase()}\\b`, 'i');
      if (symbolRegex.test(combined)) {
        isMatch = true;
      }

      // Alias match check
      if (!isMatch) {
        for (const alias of entry.aliases) {
          if (alias.length <= 3) {
            // Short alias needs word boundary
            const aliasRegex = new RegExp(`\\b${alias}\\b`, 'i');
            if (aliasRegex.test(combined)) {
              isMatch = true;
              break;
            }
          } else if (combined.includes(alias)) {
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

    return results;
  }
}
