/**
 * ATHENA NEWS ENGINE V3 — SECTOR MAPPER
 * 
 * Maps corporate industries, sectors, and stock tickers to official NIFTY Sectoral Indices.
 * Fully deterministic dictionary-backed mapping engine.
 */

import { NiftySectorIndex } from './types/ClassificationTypes';

export class SectorMapper {
  private static readonly TICKER_SECTOR_MAP: Record<string, NiftySectorIndex> = {
    // Banks & Financials
    'HDFCBANK': 'NIFTY BANK',
    'ICICIBANK': 'NIFTY BANK',
    'AXISBANK': 'NIFTY BANK',
    'KOTAKBANK': 'NIFTY BANK',
    'INDUSINDBK': 'NIFTY BANK',
    'SBIN': 'NIFTY PSU BANK',
    'BANKBARODA': 'NIFTY PSU BANK',
    'CANBK': 'NIFTY PSU BANK',
    'PNB': 'NIFTY PSU BANK',
    'BAJFINANCE': 'NIFTY FINANCIAL SERVICES',
    'BAJAJFINSV': 'NIFTY FINANCIAL SERVICES',
    'LICHSGFIN': 'NIFTY FINANCIAL SERVICES',
    'LICI': 'NIFTY FINANCIAL SERVICES',
    'LIC': 'NIFTY FINANCIAL SERVICES',
    'MCX': 'NIFTY FINANCIAL SERVICES',

    // IT
    'TCS': 'NIFTY IT',
    'INFY': 'NIFTY IT',
    'HCLTECH': 'NIFTY IT',
    'WIPRO': 'NIFTY IT',
    'TECHM': 'NIFTY IT',
    'LTIM': 'NIFTY IT',
    'PERSISTENT': 'NIFTY IT',
    'COFORGE': 'NIFTY IT',

    // Auto
    'TATAMOTORS': 'NIFTY AUTO',
    'M&M': 'NIFTY AUTO',
    'MARUTI': 'NIFTY AUTO',
    'HEROMOTOCO': 'NIFTY AUTO',
    'BAJAJ-AUTO': 'NIFTY AUTO',
    'EICHERMOT': 'NIFTY AUTO',
    'TVSMOTOR': 'NIFTY AUTO',
    'BHARATFORG': 'NIFTY AUTO',

    // FMCG & Retail
    'HINDUNILVR': 'NIFTY FMCG',
    'ITC': 'NIFTY FMCG',
    'NESTLEIND': 'NIFTY FMCG',
    'BRITANNIA': 'NIFTY FMCG',
    'TATACONSUM': 'NIFTY FMCG',
    'DABUR': 'NIFTY FMCG',
    'MARICO': 'NIFTY FMCG',
    'GODREJCP': 'NIFTY FMCG',
    'TRENT': 'NIFTY CONSUMPTION',
    'KALYANKJIL': 'NIFTY CONSUMPTION',
    'TITAN': 'NIFTY CONSUMPTION',

    // Metals
    'TATASTEEL': 'NIFTY METAL',
    'JSWSTEEL': 'NIFTY METAL',
    'HINDALCO': 'NIFTY METAL',
    'COALINDIA': 'NIFTY METAL',
    'VEDL': 'NIFTY METAL',
    'NMDC': 'NIFTY METAL',

    // Pharma & Healthcare
    'SUNPHARMA': 'NIFTY PHARMA',
    'DRREDDY': 'NIFTY PHARMA',
    'CIPLA': 'NIFTY PHARMA',
    'DIVISLAB': 'NIFTY PHARMA',
    'APOLLOHOSP': 'NIFTY PHARMA',
    'MANKIND': 'NIFTY PHARMA',

    // Energy & Oil
    'RELIANCE': 'NIFTY OIL & GAS',
    'ONGC': 'NIFTY OIL & GAS',
    'BPCL': 'NIFTY OIL & GAS',
    'IOC': 'NIFTY OIL & GAS',
    'GAIL': 'NIFTY OIL & GAS',
    'NTPC': 'NIFTY ENERGY',
    'POWERGRID': 'NIFTY ENERGY',
    'TATAPOWER': 'NIFTY ENERGY',
    'ADANIGREEN': 'NIFTY ENERGY',

    // Realty
    'DLF': 'NIFTY REALTY',
    'LODHA': 'NIFTY REALTY',
    'GODREJPROP': 'NIFTY REALTY',
    'OBEROIRLTY': 'NIFTY REALTY'
  };

  /**
   * Resolves NiftySectorIndex based on ticker, industry string, or default keywords.
   */
  public static mapToNiftySector(ticker?: string, industryStr?: string): NiftySectorIndex {
    if (ticker && this.TICKER_SECTOR_MAP[ticker.toUpperCase()]) {
      return this.TICKER_SECTOR_MAP[ticker.toUpperCase()];
    }

    if (industryStr) {
      const lower = industryStr.toLowerCase();
      if (lower.includes('bank') && lower.includes('psu')) return 'NIFTY PSU BANK';
      if (lower.includes('bank')) return 'NIFTY BANK';
      if (lower.includes('software') || lower.includes('information technology') || lower.includes('it services')) return 'NIFTY IT';
      if (lower.includes('auto') || lower.includes('automobile') || lower.includes('vehicle')) return 'NIFTY AUTO';
      if (lower.includes('fmcg') || lower.includes('consumer goods') || lower.includes('food')) return 'NIFTY FMCG';
      if (lower.includes('metal') || lower.includes('steel') || lower.includes('mining')) return 'NIFTY METAL';
      if (lower.includes('pharma') || lower.includes('healthcare') || lower.includes('drug')) return 'NIFTY PHARMA';
      if (lower.includes('oil') || lower.includes('gas') || lower.includes('petroleum')) return 'NIFTY OIL & GAS';
      if (lower.includes('power') || lower.includes('energy') || lower.includes('renewable')) return 'NIFTY ENERGY';
      if (lower.includes('realty') || lower.includes('real estate') || lower.includes('construction')) return 'NIFTY REALTY';
      if (lower.includes('financial') || lower.includes('finance') || lower.includes('insurance') || lower.includes('broking')) return 'NIFTY FINANCIAL SERVICES';
    }

    return 'GENERAL';
  }
}
