/**
 * ATHENA NEWS ENGINE V3 — COMPANY DETECTOR
 * 
 * Rule-based financial company and stock ticker extractor.
 * Detects Indian (NSE/BSE) and global companies, mapping them to sectors and exchanges.
 */

import { NormalizedCompany } from './types/NormalizationTypes';

interface CompanyMasterRecord {
  name: string;
  ticker: string;
  exchange: 'BSE' | 'NSE' | 'NASDAQ' | 'NYSE';
  sector: string;
  industry: string;
  keywords: string[];
}

export class CompanyDetector {
  private static readonly MASTER_COMPANIES: CompanyMasterRecord[] = [
    {
      name: 'Hero MotoCorp',
      ticker: 'HEROMOTOCO',
      exchange: 'NSE',
      sector: 'Automotive',
      industry: 'Two Wheelers',
      keywords: ['Hero MotoCorp', 'Hero']
    },
    {
      name: 'Life Insurance Corporation of India',
      ticker: 'LIC',
      exchange: 'NSE',
      sector: 'Insurance',
      industry: 'Life Insurance',
      keywords: ['Life Insurance Corporation of India', 'LIC']
    },
    {
      name: 'Multi Commodity Exchange of India',
      ticker: 'MCX',
      exchange: 'NSE',
      sector: 'Financial Services',
      industry: 'Exchanges',
      keywords: ['Multi Commodity Exchange', 'MCX']
    },
    {
      name: 'Trent Limited',
      ticker: 'TRENT',
      exchange: 'NSE',
      sector: 'Retail',
      industry: 'Apparel & Accessories',
      keywords: ['Trent Limited', 'Trent']
    },
    {
      name: 'Britannia Industries',
      ticker: 'BRITANNIA',
      exchange: 'NSE',
      sector: 'FMCG',
      industry: 'Packaged Foods',
      keywords: ['Britannia Industries', 'Britannia']
    },
    {
      name: 'Kalyan Jewellers India',
      ticker: 'KALYANKJIL',
      exchange: 'NSE',
      sector: 'Retail',
      industry: 'Jewelry',
      keywords: ['Kalyan Jewellers']
    },
    {
      name: 'Reliance Industries Limited',
      ticker: 'RELIANCE',
      exchange: 'NSE',
      sector: 'Oil & Gas',
      industry: 'Refining & Telecommunications',
      keywords: ['Reliance', 'Reliance Industries', 'RIL', 'Jio', 'Reliance Retail']
    },
    {
      name: 'Tata Consultancy Services',
      ticker: 'TCS',
      exchange: 'NSE',
      sector: 'Information Technology',
      industry: 'IT Services',
      keywords: ['TCS', 'Tata Consultancy Services', 'Tata Consultancy']
    },
    {
      name: 'Infosys Limited',
      ticker: 'INFY',
      exchange: 'NSE',
      sector: 'Information Technology',
      industry: 'IT Services',
      keywords: ['Infosys', 'INFY']
    },
    {
      name: 'HDFC Bank Limited',
      ticker: 'HDFCBANK',
      exchange: 'NSE',
      sector: 'Banking & Financial Services',
      industry: 'Private Sector Bank',
      keywords: ['HDFC Bank', 'HDFC', 'HDFCBANK']
    },
    {
      name: 'ICICI Bank Limited',
      ticker: 'ICICIBANK',
      exchange: 'NSE',
      sector: 'Banking & Financial Services',
      industry: 'Private Sector Bank',
      keywords: ['ICICI Bank', 'ICICI']
    },
    {
      name: 'State Bank of India',
      ticker: 'SBIN',
      exchange: 'NSE',
      sector: 'Banking & Financial Services',
      industry: 'Public Sector Bank',
      keywords: ['State Bank of India', 'SBI', 'State Bank']
    },
    {
      name: 'Tata Motors Limited',
      ticker: 'TATAMOTORS',
      exchange: 'NSE',
      sector: 'Automotive',
      industry: 'Commercial & Passenger Vehicles',
      keywords: ['Tata Motors', 'JLR', 'Jaguar Land Rover']
    },
    {
      name: 'Bharti Airtel Limited',
      ticker: 'BHARTIARTL',
      exchange: 'NSE',
      sector: 'Telecommunications',
      industry: 'Telecom Services',
      keywords: ['Bharti Airtel', 'Airtel']
    },
    {
      name: 'Larsen & Toubro Limited',
      ticker: 'LT',
      exchange: 'NSE',
      sector: 'Capital Goods',
      industry: 'Engineering & Construction',
      keywords: ['Larsen & Toubro', 'L&T', 'Larsen and Toubro']
    },
    {
      name: 'ITC Limited',
      ticker: 'ITC',
      exchange: 'NSE',
      sector: 'FMCG',
      industry: 'Diversified FMCG',
      keywords: ['ITC', 'ITC Limited']
    },
    {
      name: 'Maruti Suzuki India Limited',
      ticker: 'MARUTI',
      exchange: 'NSE',
      sector: 'Automotive',
      industry: 'Passenger Cars',
      keywords: ['Maruti Suzuki', 'Maruti']
    },
    {
      name: 'Sun Pharmaceutical Industries',
      ticker: 'SUNPHARMA',
      exchange: 'NSE',
      sector: 'Pharmaceuticals',
      industry: 'Formulations & APIs',
      keywords: ['Sun Pharma', 'Sun Pharmaceutical']
    },
    {
      name: 'Adani Enterprises Limited',
      ticker: 'ADANIENT',
      exchange: 'NSE',
      sector: 'Infrastructure',
      industry: 'Diversified Conglomerate',
      keywords: ['Adani Enterprises', 'Adani Group', 'Adani']
    },
    {
      name: 'Axis Bank Limited',
      ticker: 'AXISBANK',
      exchange: 'NSE',
      sector: 'Banking & Financial Services',
      industry: 'Private Sector Bank',
      keywords: ['Axis Bank']
    },
    {
      name: 'Kotak Mahindra Bank',
      ticker: 'KOTAKBANK',
      exchange: 'NSE',
      sector: 'Banking & Financial Services',
      industry: 'Private Sector Bank',
      keywords: ['Kotak Mahindra Bank', 'Kotak Bank']
    },
    {
      name: 'Bajaj Finance Limited',
      ticker: 'BAJFINANCE',
      exchange: 'NSE',
      sector: 'Banking & Financial Services',
      industry: 'NBFC',
      keywords: ['Bajaj Finance', 'Bajaj Finserv']
    },
    {
      name: 'Tata Steel Limited',
      ticker: 'TATASTEEL',
      exchange: 'NSE',
      sector: 'Metals & Mining',
      industry: 'Steel Manufacturing',
      keywords: ['Tata Steel']
    },
    {
      name: 'Hindalco Industries',
      ticker: 'HINDALCO',
      exchange: 'NSE',
      sector: 'Metals & Mining',
      industry: 'Aluminum & Copper',
      keywords: ['Hindalco', 'Novelis']
    },
    {
      name: 'Zomato Limited',
      ticker: 'ZOMATO',
      exchange: 'NSE',
      sector: 'Consumer Services',
      industry: 'Food Delivery & E-commerce',
      keywords: ['Zomato', 'Blinkit']
    },
    {
      name: 'One97 Communications',
      ticker: 'PAYTM',
      exchange: 'NSE',
      sector: 'Financial Technology',
      industry: 'Payments & Digital Financial Services',
      keywords: ['Paytm', 'One97 Communications']
    }
  ];

  /**
   * Detects companies mentioned in text and title.
   */
  public static detectCompanies(title: string, text: string): NormalizedCompany[] {
    const combined = `${title}\n${text}`;
    const detectedMap = new Map<string, NormalizedCompany>();

    for (const master of this.MASTER_COMPANIES) {
      for (const kw of master.keywords) {
        // Regex word boundary match
        const regex = new RegExp(`\\b${this.escapeRegex(kw)}\\b`, 'i');
        if (regex.test(combined)) {
          // Title mention gives boost
          const inTitle = new RegExp(`\\b${this.escapeRegex(kw)}\\b`, 'i').test(title);
          const confidence = inTitle ? 95 : 85;

          if (!detectedMap.has(master.ticker) || confidence > detectedMap.get(master.ticker)!.confidence) {
            detectedMap.set(master.ticker, {
              name: master.name,
              ticker: master.ticker,
              exchange: master.exchange,
              sector: master.sector,
              industry: master.industry,
              confidence,
              isPrimary: inTitle
            });
          }
          break; // move to next master record
        }
      }
    }

    const results = Array.from(detectedMap.values());

    // If no primary designated yet but results exist, mark highest confidence as primary
    if (results.length > 0 && !results.some(c => c.isPrimary)) {
      results[0].isPrimary = true;
    }

    return results;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
