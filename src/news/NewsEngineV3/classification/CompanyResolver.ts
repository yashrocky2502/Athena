/**
 * ATHENA NEWS ENGINE V3 — COMPANY RESOLVER
 * 
 * Deterministic company resolution engine.
 * Maps article text, primary companies, tickers, and mentions to canonical company entities with market cap bucket, exchange, and Nifty sector index.
 */

import { NormalizedDocument, NormalizedCompany } from '../normalization/types/NormalizationTypes';
import { ResolvedCompany, MarketCapBucket } from './types/ClassificationTypes';
import { SectorMapper } from './SectorMapper';

export interface StaticCompanyInfo {
  name: string;
  ticker: string;
  exchange: 'NSE' | 'BSE' | 'BOTH';
  industry: string;
  marketCapBucket: MarketCapBucket;
  aliases: string[];
}

export class CompanyResolver {
  private static readonly DATABASE: StaticCompanyInfo[] = [
    {
      name: 'Hero MotoCorp Limited',
      ticker: 'HEROMOTOCO',
      exchange: 'NSE',
      industry: 'Automobiles - 2 & 3 Wheelers',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['hero motocorp', 'hero honda', 'heromotoco', 'hero moto']
    },
    {
      name: 'Life Insurance Corporation of India',
      ticker: 'LIC',
      exchange: 'BOTH',
      industry: 'Life Insurance',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['lic', 'life insurance corporation', 'lic india', 'lici']
    },
    {
      name: 'Multi Commodity Exchange of India Limited',
      ticker: 'MCX',
      exchange: 'NSE',
      industry: 'Financial Exchanges',
      marketCapBucket: 'MID_CAP',
      aliases: ['mcx', 'multi commodity exchange', 'multi commodity exchange of india']
    },
    {
      name: 'Trent Limited',
      ticker: 'TRENT',
      exchange: 'NSE',
      industry: 'Retail - Department Stores',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['trent', 'trent limited', 'zudio', 'westside']
    },
    {
      name: 'Britannia Industries Limited',
      ticker: 'BRITANNIA',
      exchange: 'NSE',
      industry: 'Packaged Foods & Bakery',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['britannia', 'britannia industries']
    },
    {
      name: 'Kalyan Jewellers India Limited',
      ticker: 'KALYANKJIL',
      exchange: 'BOTH',
      industry: 'Gems, Jewellery & Watches',
      marketCapBucket: 'MID_CAP',
      aliases: ['kalyan jewellers', 'kalyan jewellers india', 'kalyankjil']
    },
    {
      name: 'ICICI Bank Limited',
      ticker: 'ICICIBANK',
      exchange: 'BOTH',
      industry: 'Private Sector Banking',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['icici bank', 'icicibank', 'icici']
    },
    {
      name: 'HDFC Bank Limited',
      ticker: 'HDFCBANK',
      exchange: 'BOTH',
      industry: 'Private Sector Banking',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['hdfc bank', 'hdfcbank', 'hdfc']
    },
    {
      name: 'Infosys Limited',
      ticker: 'INFY',
      exchange: 'BOTH',
      industry: 'IT Services & Consulting',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['infosys', 'infy', 'infosys limited']
    },
    {
      name: 'Tata Consultancy Services Limited',
      ticker: 'TCS',
      exchange: 'BOTH',
      industry: 'IT Services & Consulting',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['tcs', 'tata consultancy services', 'tata consultancy']
    },
    {
      name: 'Reliance Industries Limited',
      ticker: 'RELIANCE',
      exchange: 'BOTH',
      industry: 'Refining & Petrochemicals',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['reliance', 'reliance industries', 'ril']
    },
    {
      name: 'State Bank of India',
      ticker: 'SBIN',
      exchange: 'BOTH',
      industry: 'Public Sector Banking',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['sbi', 'state bank of india', 'sbin']
    },
    {
      name: 'Tata Motors Limited',
      ticker: 'TATAMOTORS',
      exchange: 'BOTH',
      industry: 'Automobiles - Commercial & Passenger',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['tata motors', 'tatamotors']
    },
    {
      name: 'Axis Bank Limited',
      ticker: 'AXISBANK',
      exchange: 'BOTH',
      industry: 'Private Sector Banking',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['axis bank', 'axisbank']
    },
    {
      name: 'Larsen & Toubro Limited',
      ticker: 'LT',
      exchange: 'BOTH',
      industry: 'Engineering & Construction',
      marketCapBucket: 'LARGE_CAP',
      aliases: ['larsen & toubro', 'l&t', 'larsen and toubro']
    }
  ];

  /**
   * Resolves companies from a NormalizedDocument or raw title/content string.
   */
  public static resolveCompanies(doc: NormalizedDocument): ResolvedCompany[] {
    const resolved: ResolvedCompany[] = [];
    const seenTickers = new Set<string>();

    // 1. Resolve from doc.companies (extracted in normalization)
    doc.companies.forEach(comp => {
      const dbMatch = this.findInDatabase(comp.ticker, comp.name);
      if (dbMatch) {
        if (!seenTickers.has(dbMatch.ticker)) {
          seenTickers.add(dbMatch.ticker);
          resolved.push({
            name: dbMatch.name,
            ticker: dbMatch.ticker,
            exchange: dbMatch.exchange,
            sector: SectorMapper.mapToNiftySector(dbMatch.ticker, dbMatch.industry),
            industry: dbMatch.industry,
            marketCapBucket: dbMatch.marketCapBucket,
            confidence: Math.round(comp.confidence * 100)
          });
        }
      } else {
        // Generic ticker resolution fallback
        if (!seenTickers.has(comp.ticker)) {
          seenTickers.add(comp.ticker);
          resolved.push({
            name: comp.name,
            ticker: comp.ticker,
            exchange: 'NSE',
            sector: SectorMapper.mapToNiftySector(comp.ticker),
            industry: 'General Corporate',
            marketCapBucket: 'MID_CAP',
            confidence: Math.round(comp.confidence * 100)
          });
        }
      }
    });

    // 2. Fallback text scanning if no companies resolved yet
    if (resolved.length === 0) {
      const text = `${doc.title} ${doc.plainText.slice(0, 1000)}`.toLowerCase();
      this.DATABASE.forEach(item => {
        if (!seenTickers.has(item.ticker)) {
          const matched = item.aliases.some(alias => {
            const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return regex.test(text);
          });
          if (matched) {
            seenTickers.add(item.ticker);
            resolved.push({
              name: item.name,
              ticker: item.ticker,
              exchange: item.exchange,
              sector: SectorMapper.mapToNiftySector(item.ticker, item.industry),
              industry: item.industry,
              marketCapBucket: item.marketCapBucket,
              confidence: text.includes(item.ticker.toLowerCase()) ? 95 : 85
            });
          }
        }
      });
    }

    return resolved;
  }

  private static findInDatabase(ticker: string, name: string): StaticCompanyInfo | undefined {
    const tUpper = ticker.toUpperCase();
    const nLower = name.toLowerCase();

    const byTicker = this.DATABASE.find(c => c.ticker === tUpper);
    if (byTicker) return byTicker;

    return this.DATABASE.find(c =>
      c.name.toLowerCase() === nLower ||
      c.aliases.some(a => a.toLowerCase() === nLower)
    );
  }
}
