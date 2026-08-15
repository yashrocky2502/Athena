import { ArticleContent } from './ArticleContent';
import { IntelligenceAnalyzer } from './IntelligenceAnalyzer';
import { FilingIntelligenceEngine } from './FilingIntelligenceEngine';
import { CompanyMasterDatabase } from './CompanyMasterDatabase';

export interface ExtractedEntities {
  companies: Array<{ name: string; ticker: string; sector: string; exchange?: string; industry?: string; country?: string }>;
  tickers: string[];
  sectors: string[];
  industries: string[];
  governmentBodies?: Array<{ name: string; category: string }>;
  regulators?: string[];
  organizations?: Array<{ name: string; type: string }>;
  countries?: Array<{ name: string; code: string }>;
  actsAndPolicies?: string[];
  economicTerms?: string[];
  people?: Array<{ name: string; title?: string }>;
  productsAndAssets?: string[];
  standards?: string[];
  events?: Array<{ name: string; category: string }>;
  commodities?: string[];
  financialNumbers: Array<{
    label: string;
    value: string;
    unit?: string;
    period?: string;
    comparison?: string;
    rawText?: string;
  }>;
  percentages: string[];
  dates: string[];
  currencies: string[];
  corporateActions: string[];
  results: string[];
  dividends: string[];
  classification: {
    category: 'Earnings' | 'Macro' | 'Policy' | 'Markets' | 'IPO' | 'Crypto' | 'Global' | 'Commodities' | 'Corporate' | 'Banking' | 'Economy' | 'M&A' | 'Technology' | 'Healthcare' | 'Energy';
    confidence: number;
  };
  confidenceScores: {
    global: number;
    companyConfidence: number;
    entityRichness: number;
  };
  v3Entities?: Array<{ name: string; type: string; confidence: number; mentions: number }>;
  timeline?: {
    publicationDate?: string;
    quarter?: string;
    fy?: string;
    historicalReferences?: string[];
    upcomingDeadlines?: string[];
    chronologicalEvents?: Array<{ date: string; event: string }>;
  };
  earnings?: any;
  ipo?: any;
  regulatory?: any;
  quotes?: any[];
}

export class EntityExtractor {
  private static instance: EntityExtractor;

  private static readonly KNOWN_COMPANIES: Array<{ name: string; ticker: string; sector: string; keywords: string[] }> = [
    { name: 'Eternal Ltd', ticker: 'ETERNAL', sector: 'Consumer Discretionary', keywords: ['eternal', 'zomato', 'blinkit', 'hyperpure'] },
    { name: 'Reliance Industries', ticker: 'RELIANCE', sector: 'Energy', keywords: ['reliance', 'jio', 'ril', 'mukesh ambani', 'reliance industries'] },
    { name: 'Tata Consultancy Services', ticker: 'TCS', sector: 'Technology', keywords: ['tcs', 'tata consultancy'] },
    { name: 'HDFC Bank', ticker: 'HDFCBANK', sector: 'Banking', keywords: ['hdfc bank', 'hdfc'] },
    { name: 'ICICI Bank', ticker: 'ICICIBANK', sector: 'Banking', keywords: ['icici bank', 'icici'] },
    { name: 'Infosys', ticker: 'INFY', sector: 'Technology', keywords: ['infosys', 'infy'] },
    { name: 'Tata Motors Passenger Vehicles', ticker: 'TATAMOTORS', sector: 'Automobile', keywords: ['tata motors', 'jlr', 'tata motors pv'] },
    { name: 'Tata Motors Commercial Vehicles', ticker: 'TATAMTRDVR', sector: 'Automobile', keywords: ['tata motors cv', 'tata trucks', 'tata commercial vehicles'] },
    { name: 'State Bank of India', ticker: 'SBIN', sector: 'Banking', keywords: ['state bank of india', 'sbi', 'sbin'] },
    { name: 'Bharti Airtel', ticker: 'BHARTIARTL', sector: 'Telecom', keywords: ['bharti airtel', 'airtel'] },
    { name: 'Larsen & Toubro', ticker: 'LT', sector: 'Construction', keywords: ['larsen & toubro', 'l&t', 'larsen and toubro'] },
    { name: 'ITC Limited', ticker: 'ITC', sector: 'FMCG', keywords: ['itc', 'itc limited'] },
    { name: 'Hindustan Unilever', ticker: 'HINDUNILVR', sector: 'FMCG', keywords: ['hindustan unilever', 'hul'] },
    { name: 'Bajaj Finance', ticker: 'BAJFINANCE', sector: 'Financial Services', keywords: ['bajaj finance'] },
    { name: 'Maruti Suzuki', ticker: 'MARUTI', sector: 'Automobile', keywords: ['maruti', 'maruti suzuki'] },
    { name: 'Axis Bank', ticker: 'AXISBANK', sector: 'Banking', keywords: ['axis bank'] },
    { name: 'Kotak Mahindra Bank', ticker: 'KOTAKBANK', sector: 'Banking', keywords: ['kotak bank', 'kotak mahindra'] },
    { name: 'Wipro', ticker: 'WIPRO', sector: 'Technology', keywords: ['wipro'] },
    { name: 'HCL Technologies', ticker: 'HCLTECH', sector: 'Technology', keywords: ['hcl tech', 'hcl technologies'] },
    { name: 'Adani Enterprises', ticker: 'ADANIENT', sector: 'Conglomerate', keywords: ['adani enterprises', 'adani'] },
    { name: 'Tata Steel', ticker: 'TATASTEEL', sector: 'Metals', keywords: ['tata steel'] },
    { name: 'Sun Pharma', ticker: 'SUNPHARMA', sector: 'Pharma', keywords: ['sun pharma', 'sun pharmaceutical'] },
    { name: 'Coinbase', ticker: 'COIN', sector: 'Crypto', keywords: ['coinbase'] },
    { name: 'Binance', ticker: 'BNB', sector: 'Crypto', keywords: ['binance'] },
    { name: 'Bharat Electronics Ltd', ticker: 'BEL', sector: 'Defence', keywords: ['bharat electronics', 'bel', 'bharat electronics limited'] },
    { name: 'BlackRock', ticker: 'BLK', sector: 'Financial Services', keywords: ['blackrock'] },
  ];

  private static readonly REGULATORS_AND_GOVT = [
    { name: 'CBDT', fullName: 'Central Board of Direct Taxes', category: 'Tax Authority', keywords: ['cbdt', 'central board of direct taxes'] },
    { name: 'SEBI', fullName: 'Securities and Exchange Board of India', category: 'Capital Markets Regulator', keywords: ['sebi', 'securities and exchange board'] },
    { name: 'RBI', fullName: 'Reserve Bank of India', category: 'Central Bank', keywords: ['rbi', 'reserve bank of india', 'reserve bank'] },
    { name: 'Income Tax Department', fullName: 'Income-tax Department', category: 'Tax Authority', keywords: ['income tax department', 'income-tax department', 'income tax dept'] },
    { name: 'Ministry of Finance', fullName: 'Ministry of Finance', category: 'Government Ministry', keywords: ['ministry of finance', 'finance ministry', 'finmin'] },
    { name: 'Enforcement Directorate', fullName: 'Enforcement Directorate', category: 'Law Enforcement', keywords: ['enforcement directorate', 'ed'] },
    { name: 'SEC', fullName: 'Securities and Exchange Commission', category: 'US Regulator', keywords: ['sec', 'securities and exchange commission'] },
    { name: 'CFTC', fullName: 'Commodity Futures Trading Commission', category: 'US Regulator', keywords: ['cftc'] },
    { name: 'Federal Reserve', fullName: 'Federal Reserve', category: 'Central Bank', keywords: ['federal reserve', 'fed', 'us fed'] },
    { name: 'ECB', fullName: 'European Central Bank', category: 'Central Bank', keywords: ['ecb', 'european central bank'] },
    { name: 'IRS', fullName: 'Internal Revenue Service', category: 'Tax Authority', keywords: ['irs', 'internal revenue service'] },
  ];

  private static readonly ACTS_POLICIES_STANDARDS = [
    { name: 'Income-tax Act 2025', keywords: ['income-tax act 2025', 'income tax act 2025', 'income-tax act'] },
    { name: 'CARF', fullName: 'Crypto-Asset Reporting Framework', keywords: ['carf', 'crypto-asset reporting framework', 'crypto asset reporting framework'] },
    { name: 'OECD', fullName: 'Organisation for Economic Co-operation and Development', keywords: ['oecd'] },
    { name: 'FATF', fullName: 'Financial Action Task Force', keywords: ['fatf', 'financial action task force'] },
    { name: 'FEMA', fullName: 'Foreign Exchange Management Act', keywords: ['fema', 'foreign exchange management act'] },
    { name: 'GST Act', fullName: 'Goods and Services Tax Act', keywords: ['gst act', 'goods and services tax'] },
    { name: 'PMLA', fullName: 'Prevention of Money Laundering Act', keywords: ['pmla', 'prevention of money laundering'] },
    { name: 'Companies Act', fullName: 'Companies Act 2013', keywords: ['companies act'] },
  ];

  private static readonly ECONOMIC_TERMS = [
    'FII', 'DII', 'MSME', 'NPA', 'Repo Rate', 'CPI', 'WPI', 'GDP', 'Inflation', 'Forex', 'SLR', 'CRR', 'Basis Points', 'BPS', 'Capex', 'EBITDA', 'PAT', 'NII'
  ];

  private static readonly PROMINENT_PEOPLE = [
    { name: 'Ravi Agarwal', title: 'CBDT Chairman', keywords: ['ravi agarwal'] },
    { name: 'Shaktikanta Das', title: 'RBI Governor', keywords: ['shaktikanta das'] },
    { name: 'Nirmala Sitharaman', title: 'Finance Minister', keywords: ['nirmala sitharaman'] },
    { name: 'Mukesh Ambani', title: 'RIL Chairman', keywords: ['mukesh ambani'] },
    { name: 'Gautam Adani', title: 'Adani Group Chairman', keywords: ['gautam adani'] },
    { name: 'Elon Musk', title: 'Tesla & SpaceX CEO', keywords: ['elon musk'] },
    { name: 'Jerome Powell', title: 'Fed Chair', keywords: ['jerome powell'] },
    { name: 'Satoshi Nakamoto', title: 'Bitcoin Founder', keywords: ['satoshi nakamoto'] },
  ];

  private static readonly PRODUCTS_AND_ASSETS = [
    { name: 'Bitcoin', symbol: 'BTC', keywords: ['bitcoin', 'btc'] },
    { name: 'Ethereum', symbol: 'ETH', keywords: ['ethereum', 'eth'] },
    { name: 'Crypto Assets', symbol: 'CRYPTO', keywords: ['crypto asset', 'crypto assets', 'cryptocurrency', 'virtual digital assets', 'vda'] },
    { name: 'Digital Rupee', symbol: 'e-Rupee', keywords: ['digital rupee', 'e-rupee', 'cbdc'] },
    { name: 'UPI', symbol: 'UPI', keywords: ['upi', 'unified payments interface'] },
    { name: 'Gold', symbol: 'GOLD', keywords: ['gold', 'sovereign gold bond', 'sgb'] },
    { name: 'Crude Oil', symbol: 'CRUDE', keywords: ['crude oil', 'brent crude'] },
  ];

  private static readonly COUNTRIES = [
    { name: 'India', code: 'IN', keywords: ['india', 'indian', 'delhi', 'mumbai'] },
    { name: 'United States', code: 'US', keywords: ['united states', 'us', 'usa', 'washington', 'new york'] },
    { name: 'United Kingdom', code: 'UK', keywords: ['united kingdom', 'uk', 'britain', 'london'] },
    { name: 'China', code: 'CN', keywords: ['china', 'beijing'] },
    { name: 'UAE', code: 'AE', keywords: ['uae', 'dubai', 'abu dhabi'] },
    { name: 'Singapore', code: 'SG', keywords: ['singapore'] },
    { name: 'Japan', code: 'JP', keywords: ['japan', 'tokyo'] },
  ];

  // Comprehensive, low-overhead V3 Dictionary to completely prevent hallucinations
  private static readonly V3_DICTIONARY: Array<{ name: string; type: string; keywords: string[] }> = [
    // Companies
    { name: 'Reliance Industries', type: 'Company', keywords: ['Reliance Industries', 'RIL', 'Jio', 'Mukesh Ambani'] },
    { name: 'Tata Consultancy Services', type: 'Company', keywords: ['Tata Consultancy Services', 'TCS'] },
    { name: 'HDFC Bank', type: 'Company', keywords: ['HDFC Bank', 'HDFC'] },
    { name: 'ICICI Bank', type: 'Company', keywords: ['ICICI Bank', 'ICICI'] },
    { name: 'Infosys', type: 'Company', keywords: ['Infosys', 'INFY'] },
    { name: 'Tata Motors', type: 'Company', keywords: ['Tata Motors', 'JLR'] },
    { name: 'State Bank of India', type: 'Company', keywords: ['State Bank of India', 'SBI', 'SBIN'] },
    { name: 'Bharti Airtel', type: 'Company', keywords: ['Bharti Airtel', 'Airtel'] },
    { name: 'Larsen & Toubro', type: 'Company', keywords: ['Larsen & Toubro', 'L&T', 'Larsen and Toubro'] },
    { name: 'ITC Limited', type: 'Company', keywords: ['ITC Limited', 'ITC'] },
    { name: 'Hindustan Unilever', type: 'Company', keywords: ['Hindustan Unilever', 'HUL'] },
    { name: 'Bajaj Finance', type: 'Company', keywords: ['Bajaj Finance'] },
    { name: 'Maruti Suzuki', type: 'Company', keywords: ['Maruti Suzuki', 'Maruti'] },
    { name: 'Axis Bank', type: 'Company', keywords: ['Axis Bank'] },
    { name: 'Kotak Mahindra Bank', type: 'Company', keywords: ['Kotak Mahindra Bank', 'Kotak Bank'] },
    { name: 'Wipro', type: 'Company', keywords: ['Wipro'] },
    { name: 'HCL Technologies', type: 'Company', keywords: ['HCL Technologies', 'HCL Tech'] },
    { name: 'Adani Enterprises', type: 'Company', keywords: ['Adani Enterprises', 'Adani'] },
    { name: 'Tata Steel', type: 'Company', keywords: ['Tata Steel'] },
    { name: 'Sun Pharma', type: 'Company', keywords: ['Sun Pharma', 'Sun Pharmaceutical'] },
    { name: 'Coinbase', type: 'Company', keywords: ['Coinbase'] },
    { name: 'Binance', type: 'Company', keywords: ['Binance'] },
    { name: 'BlackRock', type: 'Company', keywords: ['BlackRock'] },
    { name: 'Google', type: 'Company', keywords: ['Google', 'Alphabet'] },
    { name: 'Apple', type: 'Company', keywords: ['Apple', 'iPhone'] },
    { name: 'Microsoft', type: 'Company', keywords: ['Microsoft', 'MSFT'] },
    { name: 'Amazon', type: 'Company', keywords: ['Amazon', 'AMZN'] },
    { name: 'Meta', type: 'Company', keywords: ['Meta', 'Facebook'] },
    { name: 'NVIDIA', type: 'Company', keywords: ['NVIDIA', 'NVDA'] },
    { name: 'Tesla', type: 'Company', keywords: ['Tesla', 'TSLA'] },
    { name: 'Netflix', type: 'Company', keywords: ['Netflix', 'NFLX'] },

    // Tickers
    { name: 'RELIANCE', type: 'Ticker', keywords: ['RELIANCE'] },
    { name: 'TCS', type: 'Ticker', keywords: ['TCS'] },
    { name: 'HDFCBANK', type: 'Ticker', keywords: ['HDFCBANK'] },
    { name: 'ICICIBANK', type: 'Ticker', keywords: ['ICICIBANK'] },
    { name: 'INFY', type: 'Ticker', keywords: ['INFY'] },
    { name: 'TATAMOTORS', type: 'Ticker', keywords: ['TATAMOTORS'] },
    { name: 'SBIN', type: 'Ticker', keywords: ['SBIN'] },
    { name: 'BHARTIARTL', type: 'Ticker', keywords: ['BHARTIARTL'] },
    { name: 'LT', type: 'Ticker', keywords: ['LT'] },
    { name: 'ITC', type: 'Ticker', keywords: ['ITC'] },
    { name: 'HINDUNILVR', type: 'Ticker', keywords: ['HINDUNILVR'] },
    { name: 'BAJFINANCE', type: 'Ticker', keywords: ['BAJFINANCE'] },
    { name: 'MARUTI', type: 'Ticker', keywords: ['MARUTI'] },
    { name: 'AXISBANK', type: 'Ticker', keywords: ['AXISBANK'] },
    { name: 'KOTAKBANK', type: 'Ticker', keywords: ['KOTAKBANK'] },
    { name: 'WIPRO', type: 'Ticker', keywords: ['WIPRO'] },
    { name: 'HCLTECH', type: 'Ticker', keywords: ['HCLTECH'] },
    { name: 'ADANIENT', type: 'Ticker', keywords: ['ADANIENT'] },
    { name: 'TATASTEEL', type: 'Ticker', keywords: ['TATASTEEL'] },
    { name: 'SUNPHARMA', type: 'Ticker', keywords: ['SUNPHARMA'] },
    { name: 'COIN', type: 'Ticker', keywords: ['COIN'] },
    { name: 'BNB', type: 'Ticker', keywords: ['BNB'] },
    { name: 'BLK', type: 'Ticker', keywords: ['BLK'] },
    { name: 'GOOG', type: 'Ticker', keywords: ['GOOG'] },
    { name: 'AAPL', type: 'Ticker', keywords: ['AAPL'] },
    { name: 'MSFT', type: 'Ticker', keywords: ['MSFT'] },
    { name: 'AMZN', type: 'Ticker', keywords: ['AMZN'] },
    { name: 'META', type: 'Ticker', keywords: ['META'] },
    { name: 'NVDA', type: 'Ticker', keywords: ['NVDA'] },
    { name: 'TSLA', type: 'Ticker', keywords: ['TSLA'] },
    { name: 'NFLX', type: 'Ticker', keywords: ['NFLX'] },

    // Persons
    { name: 'Ravi Agarwal', type: 'Person', keywords: ['Ravi Agarwal'] },
    { name: 'Shaktikanta Das', type: 'Person', keywords: ['Shaktikanta Das'] },
    { name: 'Nirmala Sitharaman', type: 'Person', keywords: ['Nirmala Sitharaman'] },
    { name: 'Mukesh Ambani', type: 'Person', keywords: ['Mukesh Ambani'] },
    { name: 'Gautam Adani', type: 'Person', keywords: ['Gautam Adani'] },
    { name: 'Elon Musk', type: 'Person', keywords: ['Elon Musk'] },
    { name: 'Jerome Powell', type: 'Person', keywords: ['Jerome Powell'] },
    { name: 'Satoshi Nakamoto', type: 'Person', keywords: ['Satoshi Nakamoto'] },
    { name: 'Narendra Modi', type: 'Person', keywords: ['Narendra Modi', 'PM Modi'] },
    { name: 'Joe Biden', type: 'Person', keywords: ['Joe Biden'] },
    { name: 'Donald Trump', type: 'Person', keywords: ['Donald Trump'] },
    { name: 'Kamala Harris', type: 'Person', keywords: ['Kamala Harris'] },
    { name: 'Tim Cook', type: 'Person', keywords: ['Tim Cook'] },
    { name: 'Satya Nadella', type: 'Person', keywords: ['Satya Nadella'] },
    { name: 'Sundar Pichai', type: 'Person', keywords: ['Sundar Pichai'] },
    { name: 'Jensen Huang', type: 'Person', keywords: ['Jensen Huang'] },

    // Governments
    { name: 'CBDT', type: 'Regulator', keywords: ['CBDT', 'Central Board of Direct Taxes'] },
    { name: 'Income Tax Department', type: 'Government', keywords: ['Income Tax Department', 'Income-tax Department'] },
    { name: 'Ministry of Finance', type: 'Government', keywords: ['Ministry of Finance', 'Finance Ministry'] },
    { name: 'Government of India', type: 'Government', keywords: ['Government of India', 'Indian Government'] },
    { name: 'US Government', type: 'Government', keywords: ['US Government', 'United States Government'] },

    // Regulators
    { name: 'SEBI', type: 'Regulator', keywords: ['SEBI', 'Securities and Exchange Board of India'] },
    { name: 'RBI', type: 'Regulator', keywords: ['RBI', 'Reserve Bank of India'] },
    { name: 'SEC', type: 'Regulator', keywords: ['SEC', 'Securities and Exchange Commission'] },
    { name: 'CFTC', type: 'Regulator', keywords: ['CFTC', 'Commodity Futures Trading Commission'] },
    { name: 'Federal Reserve', type: 'Regulator', keywords: ['Federal Reserve', 'the Fed', 'US Fed'] },
    { name: 'ECB', type: 'Regulator', keywords: ['ECB', 'European Central Bank'] },
    { name: 'IRS', type: 'Regulator', keywords: ['IRS', 'Internal Revenue Service'] },

    // Acts
    { name: 'Income-tax Act 2025', type: 'Act', keywords: ['Income-tax Act 2025', 'Income tax Act 2025', 'Income-tax Act'] },
    { name: 'Companies Act 2013', type: 'Act', keywords: ['Companies Act 2013', 'Companies Act'] },
    { name: 'GST Act', type: 'Act', keywords: ['GST Act', 'Goods and Services Tax Act'] },
    { name: 'FEMA', type: 'Act', keywords: ['FEMA', 'Foreign Exchange Management Act'] },
    { name: 'PMLA', type: 'Act', keywords: ['PMLA', 'Prevention of Money Laundering Act'] },
    { name: 'Dodd-Frank Act', type: 'Act', keywords: ['Dodd-Frank Act'] },
    { name: 'Securities Act', type: 'Act', keywords: ['Securities Act'] },

    // Policies
    { name: 'Crypto-Asset Reporting Framework', type: 'Policy', keywords: ['CARF', 'Crypto-Asset Reporting Framework', 'Crypto Asset Reporting Framework'] },
    { name: 'Monetary Policy', type: 'Policy', keywords: ['Monetary Policy'] },
    { name: 'Fiscal Policy', type: 'Policy', keywords: ['Fiscal Policy'] },
    { name: 'Foreign Direct Investment Policy', type: 'Policy', keywords: ['FDI Policy', 'Foreign Direct Investment Policy'] },

    // Frameworks
    { name: 'Basel III', type: 'Framework', keywords: ['Basel III'] },
    { name: 'FATF Standards', type: 'Framework', keywords: ['FATF Standards', 'Financial Action Task Force'] },
    { name: 'Crypto-Asset Reporting Framework', type: 'Framework', keywords: ['CARF', 'Crypto-Asset Reporting Framework', 'Crypto Asset Reporting Framework'] },

    // Countries
    { name: 'India', type: 'Country', keywords: ['India', 'Indian'] },
    { name: 'United States', type: 'Country', keywords: ['United States', 'US', 'USA', 'America'] },
    { name: 'United Kingdom', type: 'Country', keywords: ['United Kingdom', 'UK', 'Britain'] },
    { name: 'China', type: 'Country', keywords: ['China', 'Chinese'] },
    { name: 'UAE', type: 'Country', keywords: ['UAE', 'United Arab Emirates', 'Dubai'] },
    { name: 'Singapore', type: 'Country', keywords: ['Singapore'] },
    { name: 'Japan', type: 'Country', keywords: ['Japan', 'Japanese'] },
    { name: 'Germany', type: 'Country', keywords: ['Germany'] },
    { name: 'France', type: 'Country', keywords: ['France'] },
    { name: 'Canada', type: 'Country', keywords: ['Canada'] },
    { name: 'Australia', type: 'Country', keywords: ['Australia'] },
    { name: 'Switzerland', type: 'Country', keywords: ['Switzerland'] },

    // States
    { name: 'Maharashtra', type: 'State', keywords: ['Maharashtra'] },
    { name: 'Karnataka', type: 'State', keywords: ['Karnataka'] },
    { name: 'California', type: 'State', keywords: ['California'] },
    { name: 'New York State', type: 'State', keywords: ['New York State', 'State of New York'] },
    { name: 'Texas', type: 'State', keywords: ['Texas'] },
    { name: 'Delaware', type: 'State', keywords: ['Delaware'] },

    // Cities
    { name: 'Mumbai', type: 'City', keywords: ['Mumbai'] },
    { name: 'New Delhi', type: 'City', keywords: ['New Delhi', 'Delhi'] },
    { name: 'New York City', type: 'City', keywords: ['New York City', 'New York', 'NYC'] },
    { name: 'Washington', type: 'City', keywords: ['Washington', 'Washington D.C.'] },
    { name: 'London', type: 'City', keywords: ['London'] },
    { name: 'Beijing', type: 'City', keywords: ['Beijing'] },
    { name: 'Shanghai', type: 'City', keywords: ['Shanghai'] },
    { name: 'Tokyo', type: 'City', keywords: ['Tokyo'] },
    { name: 'Singapore City', type: 'City', keywords: ['Singapore'] },
    { name: 'Dubai', type: 'City', keywords: ['Dubai'] },
    { name: 'Abu Dhabi', type: 'City', keywords: ['Abu Dhabi'] },
    { name: 'San Francisco', type: 'City', keywords: ['San Francisco'] },
    { name: 'Bengaluru', type: 'City', keywords: ['Bengaluru', 'Bangalore'] },

    // Commodities
    { name: 'Gold', type: 'Commodity', keywords: ['Gold'] },
    { name: 'Crude Oil', type: 'Commodity', keywords: ['Crude Oil', 'Brent Crude', 'Oil'] },
    { name: 'Silver', type: 'Commodity', keywords: ['Silver'] },
    { name: 'Platinum', type: 'Commodity', keywords: ['Platinum'] },
    { name: 'Natural Gas', type: 'Commodity', keywords: ['Natural Gas'] },
    { name: 'Copper', type: 'Commodity', keywords: ['Copper'] },
    { name: 'Steel', type: 'Commodity', keywords: ['Steel'] },
    { name: 'Wheat', type: 'Commodity', keywords: ['Wheat'] },
    { name: 'Corn', type: 'Commodity', keywords: ['Corn'] },

    // Cryptos
    { name: 'Bitcoin', type: 'Crypto', keywords: ['Bitcoin', 'BTC'] },
    { name: 'Ethereum', type: 'Crypto', keywords: ['Ethereum', 'ETH'] },
    { name: 'Solana', type: 'Crypto', keywords: ['Solana', 'SOL'] },
    { name: 'Ripple', type: 'Crypto', keywords: ['Ripple', 'XRP'] },
    { name: 'Cardano', type: 'Crypto', keywords: ['Cardano', 'ADA'] },
    { name: 'Dogecoin', type: 'Crypto', keywords: ['Dogecoin', 'DOGE'] },
    { name: 'Binance Coin', type: 'Crypto', keywords: ['Binance Coin', 'BNB'] },
    { name: 'Tether', type: 'Crypto', keywords: ['Tether', 'USDT'] },
    { name: 'USDC', type: 'Crypto', keywords: ['USDC'] },

    // Currencies
    { name: 'INR', type: 'Currency', keywords: ['INR', 'Rupees', 'Rupee', '₹'] },
    { name: 'USD', type: 'Currency', keywords: ['USD', 'Dollars', 'Dollar', '$'] },
    { name: 'EUR', type: 'Currency', keywords: ['EUR', 'Euros', 'Euro', '€'] },
    { name: 'GBP', type: 'Currency', keywords: ['GBP', 'Pounds', 'Pound', '£'] },
    { name: 'JPY', type: 'Currency', keywords: ['JPY', 'Yen'] },
    { name: 'CAD', type: 'Currency', keywords: ['CAD'] },
    { name: 'AUD', type: 'Currency', keywords: ['AUD'] },
    { name: 'CHF', type: 'Currency', keywords: ['CHF'] },

    // Sectors
    { name: 'Technology', type: 'Sector', keywords: ['Technology', 'Tech', 'IT'] },
    { name: 'Banking', type: 'Sector', keywords: ['Banking', 'Banks', 'Lenders'] },
    { name: 'Finance', type: 'Sector', keywords: ['Finance', 'Financial Services', 'NBFC'] },
    { name: 'Energy', type: 'Sector', keywords: ['Energy', 'Power', 'Oil & Gas'] },
    { name: 'Automobile', type: 'Sector', keywords: ['Automobile', 'Automotive', 'EV'] },
    { name: 'FMCG', type: 'Sector', keywords: ['FMCG', 'Consumer Goods'] },
    { name: 'Telecom', type: 'Sector', keywords: ['Telecom', 'Telecommunications'] },
    { name: 'Construction', type: 'Sector', keywords: ['Construction', 'Infrastructure'] },
    { name: 'Metals', type: 'Sector', keywords: ['Metals', 'Steel', 'Mining'] },
    { name: 'Pharma', type: 'Sector', keywords: ['Pharma', 'Pharmaceuticals', 'Healthcare'] },
    { name: 'Crypto Sector', type: 'Sector', keywords: ['Crypto', 'Cryptocurrency', 'Digital Assets'] },
    { name: 'Real Estate', type: 'Sector', keywords: ['Real Estate', 'Property'] },

    // ETFs
    { name: 'SPY', type: 'ETF', keywords: ['SPY'] },
    { name: 'QQQ', type: 'ETF', keywords: ['QQQ'] },
    { name: 'IWM', type: 'ETF', keywords: ['IWM'] },
    { name: 'GLD', type: 'ETF', keywords: ['GLD'] },
    { name: 'USO', type: 'ETF', keywords: ['USO'] },
    { name: 'IBIT', type: 'ETF', keywords: ['IBIT'] },
    { name: 'FBTC', type: 'ETF', keywords: ['FBTC'] },

    // Indices
    { name: 'Nifty 50', type: 'Index', keywords: ['Nifty 50', 'Nifty', 'NIFTY'] },
    { name: 'Sensex', type: 'Index', keywords: ['Sensex', 'SENSEX'] },
    { name: 'S&P 500', type: 'Index', keywords: ['S&P 500', 'S&P500'] },
    { name: 'Nasdaq', type: 'Index', keywords: ['Nasdaq', 'NASDAQ'] },
    { name: 'Dow Jones', type: 'Index', keywords: ['Dow Jones', 'DJIA'] },
    { name: 'FTSE 100', type: 'Index', keywords: ['FTSE 100', 'FTSE'] },
    { name: 'Nikkei 225', type: 'Index', keywords: ['Nikkei 225', 'Nikkei'] },

    // Stores
    { name: 'Reliance Retail', type: 'Store', keywords: ['Reliance Retail'] },
    { name: 'D-Mart', type: 'Store', keywords: ['D-Mart', 'DMart', 'Avenue Supermarts'] },
    { name: 'Apple Store', type: 'Store', keywords: ['Apple Store'] },
    { name: 'Amazon Store', type: 'Store', keywords: ['Amazon Store'] },
    { name: 'Walmart', type: 'Store', keywords: ['Walmart'] },
    { name: 'Target', type: 'Store', keywords: ['Target Store', 'Target Corporation'] },
    { name: 'Costco', type: 'Store', keywords: ['Costco'] },
  ];

  private constructor() {}

  public static getInstance(): EntityExtractor {
    if (!EntityExtractor.instance) {
      EntityExtractor.instance = new EntityExtractor();
    }
    return EntityExtractor.instance;
  }

  /**
   * Helper to perform safe whole-word/boundary matching to prevent dictionary-only hallucination
   */
  public static safeContains(text: string, keyword: string): boolean {
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let pattern = '';
    if (/^\w/.test(keyword)) {
      pattern += '\\b';
    }
    pattern += escaped;
    if (/\w$/.test(keyword)) {
      pattern += '\\b';
    }
    const regex = new RegExp(pattern, 'i');
    return regex.test(text);
  }

  /**
   * Helper to count whole-word/boundary occurrences
   */
  public static countMentions(text: string, keyword: string): number {
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let pattern = '';
    if (/^\w/.test(keyword)) {
      pattern += '\\b';
    }
    pattern += escaped;
    if (/\w$/.test(keyword)) {
      pattern += '\\b';
    }
    const regex = new RegExp(pattern, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }

  /**
   * Structured Financial Metric Extraction Engine
   */
  public static extractFinancialMetrics(text: string): any[] {
    const metrics: any[] = [];
    const metricConfigs = [
      { metric: 'Revenue', keywords: ['revenue', 'sales', 'topline', 'turnover', 'income from operations'] },
      { metric: 'Revenue Growth', keywords: ['revenue growth', 'sales growth', 'topline growth', 'revenue up', 'sales up'] },
      { metric: 'PAT', keywords: ['pat', 'profit after tax', 'net profit'] },
      { metric: 'PAT Growth', keywords: ['pat growth', 'profit growth', 'net profit up', 'pat jumped'] },
      { metric: 'EBITDA', keywords: ['ebitda', 'operating profit'] },
      { metric: 'EBITDA Margin', keywords: ['ebitda margin', 'ebitda margins', 'operating margin'] },
      { metric: 'EPS', keywords: ['eps', 'earnings per share'] },
      { metric: 'Operating Margin', keywords: ['operating margin', 'opm', 'operating profit margin'] },
      { metric: 'Order Book', keywords: ['order book', 'order pipeline', 'order intake', 'orders won'] },
      { metric: 'Debt', keywords: ['total debt', 'borrowings', 'net debt', 'debt'] },
      { metric: 'Cash', keywords: ['cash balance', 'cash reserves', 'cash and cash equivalents', 'net cash'] },
      { metric: 'Dividend', keywords: ['dividend', 'dividend per share', 'interim dividend', 'final dividend'] },
      { metric: 'Market Cap', keywords: ['market cap', 'mcap', 'market capitalization', 'm-cap'] },
      { metric: '52W High', keywords: ['52-week high', '52w high', '52 week high', 'yearly high'] },
      { metric: '52W Low', keywords: ['52-week low', '52w low', '52 week low', 'yearly low'] },
      { metric: 'Margins', keywords: ['margin', 'margins', 'net margin'] },
      { metric: 'NIM', keywords: ['nim', 'net interest margin'] },
      { metric: 'ROE', keywords: ['roe', 'return on equity'] },
      { metric: 'ROA', keywords: ['roa', 'return on assets'] },
      { metric: 'Capex', keywords: ['capex', 'capital expenditure'] }
    ];

    const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);

    for (const config of metricConfigs) {
      for (const sentence of sentences) {
        const sentenceLower = sentence.toLowerCase();
        if (config.keywords.some(kw => sentenceLower.includes(kw))) {
          const currencyRegex = /(?:₹|\$|Rs\.?|USD|INR)\s?\d+(?:,\d+)*(?:\.\d+)?\s*(?:cr|crore|lakh|bn|billion|mn|million)?/gi;
          const currencyMatches = sentence.match(currencyRegex);

          const percentRegex = /\b\d+(?:\.\d+)?%/g;
          const percentMatches = sentence.match(percentRegex);

          const bpsRegex = /\b\d+\s*(?:bps|basis points)\b/gi;
          const bpsMatches = sentence.match(bpsRegex);

          const numberRegex = /\b\d+(?:\.\d+)?\b/g;
          const numberMatches = sentence.match(numberRegex);

          let value = '';
          let unit = '';

          if (currencyMatches && currencyMatches.length > 0) {
            value = currencyMatches[0];
          } else if (percentMatches && percentMatches.length > 0) {
            value = percentMatches[0];
          } else if (bpsMatches && bpsMatches.length > 0) {
            value = bpsMatches[0];
          } else if (numberMatches && numberMatches.length > 0) {
            value = numberMatches[0];
          }

          if (value) {
            const valueLower = value.toLowerCase();
            if (valueLower.includes('cr') || valueLower.includes('crore')) unit = 'Cr';
            else if (valueLower.includes('bn') || valueLower.includes('billion')) unit = 'B';
            else if (valueLower.includes('mn') || valueLower.includes('million')) unit = 'M';
            else if (valueLower.includes('%')) unit = '%';
            else if (valueLower.includes('bps') || valueLower.includes('basis')) unit = 'bps';
            else if (value.startsWith('₹') || value.toLowerCase().includes('rs') || value.toLowerCase().includes('inr')) unit = '₹';
            else if (value.startsWith('$') || value.toLowerCase().includes('usd')) unit = '$';

            const qMatch = sentence.match(/\bQ[1-4]\b/i);
            const fyMatch = sentence.match(/\bFY\d{2,4}\b/i);

            let cleanNumericValue = value.replace(/[₹$Rs\. ]/gi, '').trim();
            const numMatch = value.match(/\d+(?:,\d+)*(?:\.\d+)?/);
            if (numMatch) {
              cleanNumericValue = numMatch[0];
            }

            metrics.push({
              metric: config.metric,
              value: cleanNumericValue,
              unit: unit || undefined,
              context: sentence.slice(0, 120),
              quarter: qMatch ? qMatch[0].toUpperCase() : undefined,
              fy: fyMatch ? fyMatch[0].toUpperCase() : undefined
            });
            break;
          }
        }
      }
    }

    return metrics;
  }

  /**
   * Structured Article Timeline Extraction Engine
   */
  public static extractTimeline(text: string, publishedAt?: string): any {
    const publicationDate = publishedAt || new Date().toISOString();
    const qMatch = text.match(/\bQ[1-4]\b/i);
    const fyMatch = text.match(/\bFY\d{2,4}\b/i);

    const historicalReferences: string[] = [];
    const pastYears = text.match(/\b(19\d{2}|20[0-1]\d|202[0-4])\b/g) || [];
    for (const yr of Array.from(new Set(pastYears))) {
      historicalReferences.push(yr);
    }

    const upcomingDeadlines: string[] = [];
    const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
    const deadlineKeywords = ['deadline', 'by ', 'effective', 'target', 'until', 'schedule'];
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      if (deadlineKeywords.some(kw => sentenceLower.includes(kw))) {
        const yearMatch = sentence.match(/\b(202[5-9]|203\d)\b/);
        const monthMatch = sentence.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i);
        if (yearMatch || monthMatch) {
          upcomingDeadlines.push(sentence.slice(0, 120));
        }
      }
    }

    const chronologicalEvents: Array<{ date: string; event: string }> = [];
    const eventRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s+\d{4})?|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b202[4-9]\b/gi;
    for (const sentence of sentences) {
      const dateMatches = sentence.match(eventRegex);
      if (dateMatches && dateMatches.length > 0) {
        const dateStr = dateMatches[0];
        if (!chronologicalEvents.some(e => e.date === dateStr && e.event === sentence.slice(0, 100))) {
          chronologicalEvents.push({
            date: dateStr,
            event: sentence.slice(0, 120)
          });
        }
      }
    }

    chronologicalEvents.sort((a, b) => {
      const yearA = a.date.match(/\b(20\d{2})\b/);
      const yearB = b.date.match(/\b(20\d{2})\b/);
      if (yearA && yearB) {
        return parseInt(yearA[0]) - parseInt(yearB[0]);
      }
      return 0;
    });

    const chain: string[] = [];
    chain.push('Today');
    if (qMatch) chain.push(qMatch[0].toUpperCase());
    if (fyMatch && fyMatch[0].toUpperCase() !== qMatch?.[0].toUpperCase()) chain.push(fyMatch[0].toUpperCase());
    
    // Add up to 3 upcoming deadlines/events to the chain
    let futureCount = 0;
    for (const d of upcomingDeadlines) {
      if (futureCount < 3) {
        chain.push(`Deadline: ${d.slice(0, 40)}...`);
        futureCount++;
      }
    }

    return {
      publicationDate,
      quarter: qMatch ? qMatch[0].toUpperCase() : 'N/A',
      fy: fyMatch ? fyMatch[0].toUpperCase() : 'N/A',
      historicalReferences: historicalReferences.slice(0, 5),
      upcomingDeadlines: upcomingDeadlines.slice(0, 4),
      chronologicalEvents: chronologicalEvents.slice(0, 6),
      chain
    };
  }

  /**
   * Deterministic entity & financial metric extraction V3
   */
  public extract(content: ArticleContent): ExtractedEntities {
    const text = `${content.headline || ''} ${content.title || ''} ${content.body || ''} ${content.articleBody || ''} ${content.cleanedText || ''}`;
    const lowerText = text.toLowerCase();

    // V3 Entities List
    const v3EntitiesList: Array<{ name: string; type: string; confidence: number; mentions: number }> = [];
    const seenEntities = new Set<string>();

    if (FilingIntelligenceEngine.getInstance().isCorporateFiling(content)) {
      const facts = FilingIntelligenceEngine.getInstance().extractFilingFacts(content);
      if (facts.companyName && facts.companyName !== 'Listed Entity') {
        const compKey = `${facts.companyName.toLowerCase()}_company`;
        if (!seenEntities.has(compKey)) {
          seenEntities.add(compKey);
          v3EntitiesList.push({
            name: facts.companyName,
            type: 'Company',
            confidence: 0.99,
            mentions: 5
          });
        }
      }
      if (facts.exchange) {
        const exKey = `${facts.exchange.toLowerCase()}_exchange`;
        if (!seenEntities.has(exKey)) {
          seenEntities.add(exKey);
          v3EntitiesList.push({
            name: facts.exchange,
            type: 'Exchange',
            confidence: 0.99,
            mentions: 3
          });
        }
      }
      if (facts.isin) {
        v3EntitiesList.push({
          name: `ISIN: ${facts.isin}`,
          type: 'ISIN',
          confidence: 1.0,
          mentions: 1
        });
      }
      if (facts.scripCode) {
        v3EntitiesList.push({
          name: `Scrip Code: ${facts.scripCode}`,
          type: 'ScripCode',
          confidence: 1.0,
          mentions: 1
        });
      }
    }

    for (const item of EntityExtractor.V3_DICTIONARY) {
      if (item.keywords.some((kw) => EntityExtractor.safeContains(text, kw))) {
        let totalMentions = 0;
        for (const kw of item.keywords) {
          totalMentions += EntityExtractor.countMentions(text, kw);
        }

        if (totalMentions > 0) {
          const key = `${item.name.toLowerCase()}_${item.type}`;
          if (!seenEntities.has(key)) {
            seenEntities.add(key);
            v3EntitiesList.push({
              name: item.name,
              type: item.type,
              confidence: 0.95,
              mentions: totalMentions,
            });
          }
        }
      }
    }

    // Traditional mappings (V2 backward compatibility)
    const matchedCompanies: Array<{ name: string; ticker: string; sector: string; exchange?: string; industry?: string; country?: string }> = [];
    const tickersSet = new Set<string>();
    const sectorsSet = new Set<string>();

    // Forbidden entity detector (prevents headline fragments, market action phrases, publishers, and journalists)
    const isForbiddenEntity = (str: string): boolean => {
      if (!str || str.length < 2) return true;
      const lower = str.toLowerCase().trim();
      const forbiddenPhrases = [
        'shares soar', 'stock jumps', 'top gainer', 'top loser', 'market rally', 'bull run',
        'quarterly results', 'q1 results', 'q2 results', 'q3 results', 'q4 results', 'net profit up',
        'livemint', 'economic times', 'reuters', 'bloomberg', 'business standard', 'moneycontrol',
        'cnbc', 'yahoo finance', 'financial express', 'mint', 'ndtv', 'cnbc-tv18',
        'by reuters', 'by staff', 'written by', 'special correspondent', 'author', 'reporter',
        'buy rating', 'target price raised', 'upper circuit', 'lower circuit', '52-week high'
      ];
      return forbiddenPhrases.some(fp => lower.includes(fp));
    };

    for (const v3 of v3EntitiesList) {
      if (v3.type === 'Company' && !isForbiddenEntity(v3.name)) {
        const masterMatch = CompanyMasterDatabase.findByNameOrAlias(v3.name);
        const original = EntityExtractor.KNOWN_COMPANIES.find(c => c.name === v3.name);
        
        if (masterMatch) {
          const exchangeVal = masterMatch.exchange || (masterMatch.scripCode ? 'NSE' : 'NSE');
          const countryVal = masterMatch.country || 'India';
          matchedCompanies.push({
            name: masterMatch.name,
            ticker: masterMatch.symbol,
            exchange: exchangeVal,
            sector: masterMatch.sector,
            industry: masterMatch.industry,
            country: countryVal
          });
          tickersSet.add(masterMatch.symbol);
          sectorsSet.add(masterMatch.sector);
        } else {
          matchedCompanies.push({
            name: v3.name,
            ticker: original ? original.ticker : v3.name.toUpperCase().replace(/\s+/g, ''),
            sector: original ? original.sector : 'Markets',
            industry: 'General Corporate',
            exchange: 'NSE',
            country: 'India'
          });
        }
      } else if (v3.type === 'Ticker') {
        tickersSet.add(v3.name);
      } else if (v3.type === 'Sector') {
        sectorsSet.add(v3.name);
      }
    }

    const govtBodiesList: Array<{ name: string; category: string }> = [];
    const regulatorsList: string[] = [];
    const orgsList: Array<{ name: string; type: string }> = [];

    for (const v3 of v3EntitiesList) {
      if (v3.type === 'Government') {
        govtBodiesList.push({ name: v3.name, category: 'Government Body' });
        orgsList.push({ name: v3.name, type: 'Government' });
      } else if (v3.type === 'Regulator') {
        regulatorsList.push(v3.name);
        govtBodiesList.push({ name: v3.name, category: 'Regulator' });
        orgsList.push({ name: v3.name, type: 'Regulator' });
      }
    }

    const actsList: string[] = [];
    const standardsList: string[] = [];
    for (const v3 of v3EntitiesList) {
      if (v3.type === 'Act') {
        actsList.push(v3.name);
      } else if (v3.type === 'Policy' || v3.type === 'Framework') {
        standardsList.push(v3.name);
      }
    }

    const economicTermsList: string[] = [];
    for (const term of EntityExtractor.ECONOMIC_TERMS) {
      if (EntityExtractor.safeContains(text, term)) {
        economicTermsList.push(term);
      }
    }

    const peopleList: Array<{ name: string; title?: string }> = [];
    for (const v3 of v3EntitiesList) {
      if (v3.type === 'Person') {
        const original = EntityExtractor.PROMINENT_PEOPLE.find(p => p.name === v3.name);
        peopleList.push({ name: v3.name, title: original ? original.title : 'Executive' });
      }
    }

    const productsList: string[] = [];
    const commoditiesList: string[] = [];
    for (const v3 of v3EntitiesList) {
      if (v3.type === 'Crypto' || v3.type === 'Currency') {
        productsList.push(v3.name);
      } else if (v3.type === 'Commodity') {
        productsList.push(v3.name);
        commoditiesList.push(v3.name);
      }
    }

    const countriesList: Array<{ name: string; code: string }> = [];
    for (const v3 of v3EntitiesList) {
      if (v3.type === 'Country') {
        const original = EntityExtractor.COUNTRIES.find(c => c.name === v3.name);
        countriesList.push({ name: v3.name, code: original ? original.code : v3.name.slice(0, 2).toUpperCase() });
      }
    }

    // Structured Metrics extraction
    const financialNumbers = EntityExtractor.extractFinancialMetrics(text);
    const percentages = Array.from(new Set(text.match(/\b\d+(?:\.\d+)?%/g) || [])).slice(0, 8);
    const dates = Array.from(new Set(text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s+\d{4})?\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b202[4-9]\b/gi) || [])).slice(0, 5);
    const currencies = Array.from(new Set(text.match(/\b(INR|USD|EUR|GBP|JPY|Rupees|Dollars)\b|₹|\$|€|£/g) || [])).slice(0, 5);

    const corporateActions: string[] = [];
    if (lowerText.includes('dividend')) corporateActions.push('Dividend');
    if (lowerText.includes('bonus')) corporateActions.push('Bonus Issue');
    if (lowerText.includes('stock split') || lowerText.includes('split')) corporateActions.push('Stock Split');
    if (lowerText.includes('buyback')) corporateActions.push('Buyback');
    if (lowerText.includes('merger') || lowerText.includes('acquisition')) corporateActions.push('M&A');

    const results: string[] = [];
    if (lowerText.includes('q1') || lowerText.includes('q2') || lowerText.includes('q3') || lowerText.includes('q4')) results.push('Quarterly Results');
    if (lowerText.includes('pat') || lowerText.includes('net profit')) results.push('Net Profit');
    if (lowerText.includes('ebitda') || lowerText.includes('operating margin')) results.push('EBITDA Margin');

    const dividends: string[] = [];
    const divMatch = text.match(/dividend of (?:₹|\$|Rs\.?)\s?\d+(?:\.\d+)?/gi);
    if (divMatch) dividends.push(...divMatch);

    let category: 'Earnings' | 'Macro' | 'Policy' | 'Markets' | 'IPO' | 'Crypto' | 'Global' | 'Commodities' | 'Corporate' | 'Banking' | 'Economy' | 'M&A' | 'Technology' | 'Healthcare' | 'Energy' = 'Markets';
    let classConfidence = 0.85;

    if (lowerText.includes('crypto') || lowerText.includes('bitcoin') || lowerText.includes('carf') || (lowerText.includes('cbdt') && lowerText.includes('exchanges'))) {
      category = 'Crypto';
      classConfidence = 0.98;
    } else if (lowerText.includes('cbdt') || lowerText.includes('income-tax') || lowerText.includes('policy') || lowerText.includes('guidelines') || lowerText.includes('regulation') || lowerText.includes('sebi')) {
      category = 'Policy';
      classConfidence = 0.95;
    } else if (lowerText.includes('rbi') || lowerText.includes('repo rate') || lowerText.includes('bank') || lowerText.includes('lending')) {
      category = 'Banking';
      classConfidence = 0.92;
    } else if (lowerText.includes('q1') || lowerText.includes('q2') || lowerText.includes('q3') || lowerText.includes('q4') || lowerText.includes('net profit') || lowerText.includes('pat') || lowerText.includes('revenue')) {
      category = 'Earnings';
      classConfidence = 0.95;
    } else if (lowerText.includes('ipo') || lowerText.includes('listing') || lowerText.includes('issue')) {
      category = 'IPO';
      classConfidence = 0.90;
    } else if (lowerText.includes('inflation') || lowerText.includes('gdp') || lowerText.includes('cpi') || lowerText.includes('macro')) {
      category = 'Macro';
      classConfidence = 0.90;
    } else if (lowerText.includes('gold') || lowerText.includes('crude') || lowerText.includes('oil')) {
      category = 'Commodities';
      classConfidence = 0.90;
    } else if (sectorsSet.has('Technology') || lowerText.includes('ai') || lowerText.includes('software')) {
      category = 'Technology';
      classConfidence = 0.88;
    }

    const companyConfidence = matchedCompanies.length > 0 ? 0.95 : 0.6;
    const entityRichness = v3EntitiesList.length;
    const globalConfidence = Math.min(0.99, Number((0.5 + (entityRichness * 0.05) + (financialNumbers.length * 0.05)).toFixed(2)));

    const bodyOnlyText = content.body || content.cleanText || content.cleanedText || content.articleBody || '';
    const bodyLowerForCheck = bodyOnlyText.toLowerCase();

    // Timeline extraction strictly from body to prevent false positives from headline
    const timeline = EntityExtractor.extractTimeline(bodyOnlyText, content.publishedAt);

    if (timeline.quarter && timeline.quarter !== 'N/A') {
      if (!bodyLowerForCheck.includes(timeline.quarter.toLowerCase())) {
        timeline.quarter = 'N/A';
      }
    }
    if (timeline.fy && timeline.fy !== 'N/A') {
      if (!bodyLowerForCheck.includes(timeline.fy.toLowerCase())) {
        timeline.fy = 'N/A';
      }
    }
    if (timeline.historicalReferences) {
      timeline.historicalReferences = timeline.historicalReferences.filter((ref: string) => {
        return bodyOnlyText.includes(ref);
      });
    }

    // Filter financial numbers to only those whose values exist in the body
    const filteredFinancialNumbers = financialNumbers.filter(fn => {
      return bodyOnlyText.includes(fn.value) || bodyOnlyText.replace(/,/g, '').includes(fn.value);
    });

    return {
      companies: matchedCompanies,
      tickers: Array.from(tickersSet),
      sectors: Array.from(sectorsSet),
      industries: Array.from(sectorsSet).length > 0 ? Array.from(sectorsSet) : ['Financial Services', 'Markets'],
      governmentBodies: govtBodiesList,
      regulators: regulatorsList,
      organizations: orgsList,
      countries: countriesList,
      actsAndPolicies: actsList,
      economicTerms: economicTermsList,
      people: peopleList,
      productsAndAssets: productsList,
      standards: standardsList,
      events: results.map((r) => ({ name: r, category: 'Results' })),
      commodities: commoditiesList,
      financialNumbers: filteredFinancialNumbers,
      percentages,
      dates,
      currencies,
      corporateActions,
      results,
      dividends,
      classification: {
        category,
        confidence: classConfidence,
      },
      confidenceScores: {
        global: globalConfidence,
        companyConfidence,
        entityRichness,
      },
      v3Entities: v3EntitiesList,
      timeline,
      earnings: category === 'Earnings' ? IntelligenceAnalyzer.extractEarnings(text) : undefined,
      ipo: category === 'IPO' ? IntelligenceAnalyzer.extractIPO(text) : undefined,
      regulatory: (category === 'Policy' || category === 'Crypto' || category === 'Banking') ? IntelligenceAnalyzer.extractRegulatory(text) : undefined,
      quotes: IntelligenceAnalyzer.extractQuotes(text)
    };
  }

  public static isJunkEntity(name: string, headline: string): boolean {
    if (!name) return true;
    const n = name.toLowerCase().trim();
    const h = (headline || '').toLowerCase().trim();
    
    // Rule 1: Exclude empty or very short names
    if (n.length < 2) return true;

    // Rule 2: Market action / noise verbs and headline fragments
    const actionVerbs = [
      'shares crash', 'shares soar', 'shares slump', 'shares plunge', 'shares drop', 'shares surge',
      'shares tumble', 'shares fall', 'shares rise', 'stock falls', 'stock rises', 'stock plummets',
      'profit rises', 'profit falls', 'profit jumps', 'profit drops', 'q1 results', 'q2 results',
      'q3 results', 'q4 results', 'results', 'down 10%', 'up 10%', 'crash 10%', 'soar 10%',
      'target price', 'buy rating', 'sell rating', 'shares slide', 'shares gain', 'shares lose'
    ];
    if (actionVerbs.some(verb => n.includes(verb))) {
      return true;
    }

    // Rule 3: Exclude generic financial/earnings words, exchanges, regulators, and news outlets
    const junkPatterns = [
      'nse/bse', 'nse', 'bse', 'sebi', 'reuters', 'moneycontrol', 'bloomberg', 'livemint',
      'economic times', 'business standard', 'q1', 'q2', 'q3', 'q4', 'quarter', 'outcome', 'board meeting', 
      'press release', 'filing', 'disclosure', 'regulatory', 'notification', 
      'circular', 'budget', 'stock price', 'share price', 'shares', 'percent', 
      'percentage', 'crore', 'lakh', 'dividend', 'm&a', 'acquisition', 'merger',
      'annual report', 'balance sheet', 'cash flow', 'statement', 'announcement',
      'corporation', 'limited', 'pvt', 'private limited'
    ];
    if (junkPatterns.some(pattern => n === pattern || n === 'nse/bse' || n === 'sebi' || n === 'nse' || n === 'bse' || n === 'outcome' || n === 'disclosure')) {
      return true;
    }

    // Rule 4: Exclude if it is the headline or contains headline / headline contains it if long
    if (n === h || (h.length > 0 && n.includes(h)) || (h.length > 0 && h.includes(n) && n.length > 25)) {
      return true;
    }

    // Rule 5: Reject long names > 35 chars without a valid corporate suffix
    if (n.length > 35 && !/\b(limited|ltd|inc|corp|corporation|gmbh|plc)\b/i.test(n)) {
      return true;
    }

    return false;
  }

  /**
   * Final Validation & Verification Engine
   */
  public static validateExtraction(content: ArticleContent): ArticleContent {
    const text = `${content.headline || ''} ${content.body || ''}`.toLowerCase();
    const headline = content.headline || '';

    // 1. Entity presence validation (strictly remove hallucinated ones)
    if (content.entities) {
      const unique = new Map<string, any>();
      for (const ent of content.entities) {
        if (ent && ent.name && EntityExtractor.safeContains(text, ent.name)) {
          if (!EntityExtractor.isJunkEntity(ent.name, headline)) {
            const key = `${ent.name.toLowerCase()}_${ent.type}`;
            if (!unique.has(key)) {
              unique.set(key, ent);
            }
          }
        }
      }
      content.entities = Array.from(unique.values());
      content.entityCount = content.entities.length;
    }

    // 2. Financial Metrics validation against actual text
    if (content.financialMetrics) {
      content.financialMetrics = content.financialMetrics.filter((metric: any) => {
        if (typeof metric === 'string') {
          return text.includes(metric.toLowerCase());
        } else if (metric && metric.value) {
          return text.includes(metric.value.toLowerCase()) || (metric.metric && text.includes(metric.metric.toLowerCase()));
        }
        return false;
      });
      content.financialMetricsCount = content.financialMetrics.length;
    }

    // 3. Ensure Timeline exists
    if (!content.timeline) {
      content.timeline = EntityExtractor.extractTimeline(content.body || '', content.publishedAt);
    }

    return content;
  }
}

