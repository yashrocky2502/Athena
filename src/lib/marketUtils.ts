export interface MarketItemDefinition {
  symbol: string;
  name: string;
  category: "Indian Markets" | "Global Markets" | "Commodities" | "Forex" | "Crypto";
  type: "index" | "commodity" | "currency" | "crypto" | "stock";
  defaultEnabled: boolean;
  currencySymbol: string;
  aliases: string[];
}

export const MASTER_MARKET_ITEMS: MarketItemDefinition[] = [
  // INDIAN MARKETS
  { symbol: "^NSEI", name: "Nifty 50", category: "Indian Markets", type: "index", defaultEnabled: true, currencySymbol: "₹", aliases: ["NIFTY", "NIFTY50", "NIFTY 50", "^NSEI"] },
  { symbol: "^BSESN", name: "Sensex", category: "Indian Markets", type: "index", defaultEnabled: true, currencySymbol: "₹", aliases: ["SENSEX", "BSESN", "^BSESN"] },
  { symbol: "^NSEBANK", name: "Bank Nifty", category: "Indian Markets", type: "index", defaultEnabled: true, currencySymbol: "₹", aliases: ["BANKNIFTY", "BANK NIFTY", "NIFTY BANK", "^NSEBANK"] },
  { symbol: "NIFTY_FIN_SERVICE.NS", name: "FINNIFTY", category: "Indian Markets", type: "index", defaultEnabled: false, currencySymbol: "₹", aliases: ["FINNIFTY", "FIN NIFTY", "NIFTY FINANCIAL"] },
  { symbol: "NIFTY_MIDCAP_100.NS", name: "MIDCAP NIFTY", category: "Indian Markets", type: "index", defaultEnabled: false, currencySymbol: "₹", aliases: ["MIDCAP", "MIDCAP NIFTY", "NIFTY MIDCAP"] },
  { symbol: "BSEBANK", name: "BANKEX", category: "Indian Markets", type: "index", defaultEnabled: false, currencySymbol: "₹", aliases: ["BANKEX", "BSE BANKEX"] },

  // GLOBAL MARKETS
  { symbol: "^GSPC", name: "S&P 500", category: "Global Markets", type: "index", defaultEnabled: true, currencySymbol: "$", aliases: ["S&P500", "S&P 500", "SP500", "^GSPC", "SPX"] },
  { symbol: "^DJI", name: "Dow Jones", category: "Global Markets", type: "index", defaultEnabled: true, currencySymbol: "$", aliases: ["DOW", "DOW JONES", "DJIA", "^DJI"] },
  { symbol: "^IXIC", name: "Nasdaq Composite", category: "Global Markets", type: "index", defaultEnabled: true, currencySymbol: "$", aliases: ["NASDAQ", "NASDAQ COMPOSITE", "^IXIC", "IXIC"] },
  { symbol: "^RUT", name: "Russell 2000", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "$", aliases: ["RUSSELL", "RUSSELL 2000", "^RUT"] },
  { symbol: "^VIX", name: "VIX", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "$", aliases: ["VOLATILITY INDEX", "VIX", "^VIX"] },
  { symbol: "^FTSE", name: "FTSE 100", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "£", aliases: ["FTSE", "FTSE 100", "^FTSE"] },
  { symbol: "^GDAXI", name: "DAX", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "€", aliases: ["DAX", "GERMANY 40", "^GDAXI"] },
  { symbol: "^FCHI", name: "CAC 40", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "€", aliases: ["CAC", "CAC 40", "^FCHI"] },
  { symbol: "^N225", name: "Nikkei 225", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "¥", aliases: ["NIKKEI", "NIKKEI 225", "^N225"] },
  { symbol: "^HSI", name: "Hang Seng", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "HK$", aliases: ["HANG SENG", "HSI", "^HSI"] },
  { symbol: "000001.SS", name: "Shanghai Composite", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "¥", aliases: ["SHANGHAI", "SHANGHAI COMPOSITE", "000001.SS"] },
  { symbol: "^KS11", name: "KOSPI", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "₩", aliases: ["KOSPI", "KOSPI 200", "SOUTH KOREA", "^KS11"] },
  { symbol: "^STI", name: "Straits Times", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "S$", aliases: ["STRAITS TIMES", "STI", "SINGAPORE", "^STI"] },
  { symbol: "^AXJO", name: "ASX 200", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "A$", aliases: ["ASX", "ASX 200", "AUSTRALIA", "^AXJO"] },
  { symbol: "^TWII", name: "Taiwan Weighted", category: "Global Markets", type: "index", defaultEnabled: false, currencySymbol: "NT$", aliases: ["TAIWAN", "TAIWAN WEIGHTED", "TWII", "^TWII"] },

  // COMMODITIES
  { symbol: "GC=F", name: "Gold", category: "Commodities", type: "commodity", defaultEnabled: true, currencySymbol: "$", aliases: ["GOLD", "GC=F", "GOLD FUTURES"] },
  { symbol: "SI=F", name: "Silver", category: "Commodities", type: "commodity", defaultEnabled: true, currencySymbol: "$", aliases: ["SILVER", "SI=F", "SILVER FUTURES"] },
  { symbol: "CL=F", name: "WTI Crude", category: "Commodities", type: "commodity", defaultEnabled: true, currencySymbol: "$", aliases: ["WTI", "WTI CRUDE", "CRUDE OIL", "CL=F"] },
  { symbol: "BZ=F", name: "Brent Crude", category: "Commodities", type: "commodity", defaultEnabled: true, currencySymbol: "$", aliases: ["BRENT", "BRENT CRUDE", "BZ=F"] },
  { symbol: "NG=F", name: "Natural Gas", category: "Commodities", type: "commodity", defaultEnabled: false, currencySymbol: "$", aliases: ["NATURAL GAS", "NAT GAS", "NG=F"] },
  { symbol: "HG=F", name: "Copper", category: "Commodities", type: "commodity", defaultEnabled: false, currencySymbol: "$", aliases: ["COPPER", "HG=F"] },
  { symbol: "PL=F", name: "Platinum", category: "Commodities", type: "commodity", defaultEnabled: false, currencySymbol: "$", aliases: ["PLATINUM", "PL=F"] },
  { symbol: "PA=F", name: "Palladium", category: "Commodities", type: "commodity", defaultEnabled: false, currencySymbol: "$", aliases: ["PALLADIUM", "PA=F"] },
  { symbol: "ZC=F", name: "Corn", category: "Commodities", type: "commodity", defaultEnabled: false, currencySymbol: "$", aliases: ["CORN", "ZC=F"] },
  { symbol: "ZS=F", name: "Soybeans", category: "Commodities", type: "commodity", defaultEnabled: false, currencySymbol: "$", aliases: ["SOYBEANS", "SOYBEAN", "ZS=F"] },

  // FOREX
  { symbol: "USDINR=X", name: "USDINR", category: "Forex", type: "currency", defaultEnabled: false, currencySymbol: "₹", aliases: ["USDINR", "USD/INR", "USDINR=X", "DOLLAR RUPEE"] },
  { symbol: "EURINR=X", name: "EURINR", category: "Forex", type: "currency", defaultEnabled: false, currencySymbol: "₹", aliases: ["EURINR", "EUR/INR", "EURINR=X", "EURO RUPEE"] },
  { symbol: "GBPINR=X", name: "GBPINR", category: "Forex", type: "currency", defaultEnabled: false, currencySymbol: "₹", aliases: ["GBPINR", "GBP/INR", "GBPINR=X", "POUND RUPEE"] },
  { symbol: "JPYINR=X", name: "JPYINR", category: "Forex", type: "currency", defaultEnabled: false, currencySymbol: "₹", aliases: ["JPYINR", "JPY/INR", "JPYINR=X", "YEN RUPEE"] },
  { symbol: "DX-Y.NYB", name: "Dollar Index", category: "Forex", type: "currency", defaultEnabled: false, currencySymbol: "$", aliases: ["DOLLAR INDEX", "DXY", "DX-Y.NYB", "DX=F"] },

  // CRYPTO
  { symbol: "BTC-USD", name: "Bitcoin", category: "Crypto", type: "crypto", defaultEnabled: true, currencySymbol: "$", aliases: ["BITCOIN", "BTC", "BTC-USD"] },
  { symbol: "ETH-USD", name: "Ethereum", category: "Crypto", type: "crypto", defaultEnabled: false, currencySymbol: "$", aliases: ["ETHEREUM", "ETH", "ETH-USD"] },
  { symbol: "SOL-USD", name: "Solana", category: "Crypto", type: "crypto", defaultEnabled: false, currencySymbol: "$", aliases: ["SOLANA", "SOL", "SOL-USD"] },
  { symbol: "BNB-USD", name: "BNB", category: "Crypto", type: "crypto", defaultEnabled: false, currencySymbol: "$", aliases: ["BNB", "BINANCE COIN", "BNB-USD"] },
  { symbol: "XRP-USD", name: "XRP", category: "Crypto", type: "crypto", defaultEnabled: false, currencySymbol: "$", aliases: ["XRP", "RIPPLE", "XRP-USD"] },
  { symbol: "DOGE-USD", name: "Dogecoin", category: "Crypto", type: "crypto", defaultEnabled: false, currencySymbol: "$", aliases: ["DOGECOIN", "DOGE", "DOGE-USD"] },
  { symbol: "ADA-USD", name: "Cardano", category: "Crypto", type: "crypto", defaultEnabled: false, currencySymbol: "$", aliases: ["CARDANO", "ADA", "ADA-USD"] },
  { symbol: "POL-USD", name: "Polygon", category: "Crypto", type: "crypto", defaultEnabled: false, currencySymbol: "$", aliases: ["POLYGON", "POL", "MATIC", "POL-USD", "MATIC-USD"] }
];

export const SYMBOL_NAME_MAP: Record<string, string> = {
  "GC=F": "Gold",
  "SI=F": "Silver",
  "CL=F": "WTI Crude",
  "BZ=F": "Brent Crude",
  "NG=F": "Natural Gas",
  "HG=F": "Copper",
  "PL=F": "Platinum",
  "PA=F": "Palladium",
  "ZC=F": "Corn",
  "ZS=F": "Soybeans",
  "^GSPC": "S&P 500",
  "^DJI": "Dow Jones",
  "^IXIC": "Nasdaq Composite",
  "^RUT": "Russell 2000",
  "^VIX": "VIX",
  "^FTSE": "FTSE 100",
  "^GDAXI": "DAX",
  "^FCHI": "CAC 40",
  "^N225": "Nikkei 225",
  "^HSI": "Hang Seng",
  "000001.SS": "Shanghai Composite",
  "^KS11": "KOSPI",
  "^STI": "Straits Times",
  "^AXJO": "ASX 200",
  "TWII": "Taiwan Weighted",
  "^TWII": "Taiwan Weighted",
  "^NSEI": "Nifty 50",
  "^BSESN": "Sensex",
  "^NSEBANK": "Bank Nifty",
  "NIFTY_FIN_SERVICE.NS": "FINNIFTY",
  "NIFTY_MIDCAP_100.NS": "MIDCAP NIFTY",
  "BSEBANK": "BANKEX",
  "USDINR=X": "USDINR",
  "USDINR": "USDINR",
  "EURINR=X": "EURINR",
  "EURINR": "EURINR",
  "GBPINR=X": "GBPINR",
  "GBPINR": "GBPINR",
  "JPYINR=X": "JPYINR",
  "JPYINR": "JPYINR",
  "DX-Y.NYB": "Dollar Index",
  "DX=F": "Dollar Index",
  "DXY": "Dollar Index",
  "BTC-USD": "Bitcoin",
  "ETH-USD": "Ethereum",
  "SOL-USD": "Solana",
  "BNB-USD": "BNB",
  "XRP-USD": "XRP",
  "DOGE-USD": "Dogecoin",
  "ADA-USD": "Cardano",
  "POL-USD": "Polygon",
  "MATIC-USD": "Polygon"
};

/**
 * Returns a human-friendly display name for any raw ticker symbol or symbol string.
 */
export function getHumanMarketName(symbol: string, rawName?: string): string {
  if (!symbol) return rawName || "Market Asset";
  const cleanSym = symbol.trim().toUpperCase();
  if (SYMBOL_NAME_MAP[cleanSym]) {
    return SYMBOL_NAME_MAP[cleanSym];
  }
  if (SYMBOL_NAME_MAP[symbol]) {
    return SYMBOL_NAME_MAP[symbol];
  }

  const def = MASTER_MARKET_ITEMS.find(i => i.symbol.toUpperCase() === cleanSym);
  if (def) return def.name;

  // Clean rawName if it looks like a ticker or raw code
  if (rawName) {
    if (SYMBOL_NAME_MAP[rawName.trim().toUpperCase()]) {
      return SYMBOL_NAME_MAP[rawName.trim().toUpperCase()];
    }
    // Clean up trailing =F or =X or ^
    return rawName.replace(/^[\^]/, "").replace(/=[FX]$/, "");
  }

  return cleanSym.replace(/^[\^]/, "").replace(/=[FX]$/, "");
}

/**
 * Get default enabled symbols
 */
export function getDefaultEnabledSymbols(): string[] {
  return MASTER_MARKET_ITEMS.filter(i => i.defaultEnabled).map(i => i.symbol);
}

/**
 * Search market definitions by string query
 */
export function searchMarketDefinitions(query: string): MarketItemDefinition[] {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  return MASTER_MARKET_ITEMS.filter(item => {
    if (item.name.toLowerCase().includes(q)) return true;
    if (item.symbol.toLowerCase().includes(q)) return true;
    if (item.aliases.some(a => a.toLowerCase().includes(q))) return true;
    return false;
  });
}
