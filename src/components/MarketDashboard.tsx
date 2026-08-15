import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MarketIndex, TrendingStock } from "../types";
import { 
  TrendingUp, TrendingDown, Search, Activity, Sparkles, Globe, Coins, Box, 
  DollarSign, ListFilter, Sliders, Info, ShieldAlert, History, X, RefreshCw, 
  Flame, ArrowUpDown, Zap, SlidersHorizontal, Check, Filter, ChevronRight 
} from "lucide-react";
import { useLiveMarket } from "../hooks/useLiveMarket";
import { useHistoricalData } from "../hooks/useHistoricalData";
import { FinancialChart } from "./FinancialChart";
import { getHumanMarketName, MASTER_MARKET_ITEMS } from "../lib/marketUtils";
import { CompanyIdentityResolver } from "../lib/CompanyIdentityResolver";
import { CompanyDeduplicationEngine } from "../lib/CompanyDeduplicationEngine";
import { TrendingStockEngine, ExtendedTrendingStock } from "../services/TrendingStockEngine";
import ManageMarkets from "./ManageMarkets";
import MarketMovers from "./MarketMovers";
import { safeLocalStorage } from "../services/storage/safeStorage";

interface MarketDashboardProps {
  onSelectStock: (query: string) => void;
  onSelectCompany?: (symbol: string) => void;
  defaultTab?: MarketTab;
  highlightedSymbol?: string;
}

type MarketTab = "India" | "Global" | "Crypto" | "Commodities" | "Currencies";
type CapFilter = "All" | "Large Cap" | "Mid Cap" | "Small Cap";
type SortOption = 
  | "Trending Score" 
  | "Highest Volume" 
  | "Most News" 
  | "Most F&O Activity" 
  | "Top Gainers" 
  | "Top Losers" 
  | "Highest Delivery" 
  | "Alphabetical" 
  | "Market Cap";

const SECTOR_MAPPING: Record<string, (stock: ExtendedTrendingStock) => boolean> = {
  "Banking": (s) => (s.sector || "").includes("Financial") || (s.industry || "").includes("Bank"),
  "IT": (s) => (s.sector || "").includes("Technology") || (s.industry || "").includes("IT") || (s.sector || "").includes("IT"),
  "Defence": (s) => (s.industry || "").includes("Defense") || (s.industry || "").includes("Aerospace") || (s.industry || "").includes("Shipbuilding"),
  "Auto": (s) => (s.sector || "").includes("Automobile") || (s.industry || "").includes("Auto") || (s.industry || "").includes("Vehicle") || (s.industry || "").includes("Tractor"),
  "Pharma": (s) => (s.sector || "").includes("Healthcare") || (s.industry || "").includes("Pharma"),
  "Energy": (s) => (s.sector || "").includes("Energy") || (s.industry || "").includes("Power") || (s.industry || "").includes("Mining"),
  "PSU": (s) => !!s.isPSU,
  "FMCG": (s) => (s.sector || "").includes("Consumer Discretionary") || (s.sector || "").includes("Consumer") || (s.industry || "").includes("Retail") || (s.industry || "").includes("Paints"),
  "Metal": (s) => (s.sector || "").includes("Basic Materials") || (s.industry || "").includes("Steel") || (s.industry || "").includes("Mining") || (s.industry || "").includes("Cement"),
  "Telecom": (s) => (s.sector || "").includes("Communication") || (s.industry || "").includes("Telecom") || (s.sector || "").includes("Telecom"),
  "Realty": (s) => (s.industry || "").includes("Construction") || (s.industry || "").includes("Engineering") || (s.sector || "").includes("Real Estate"),
  "Infrastructure": (s) => (s.sector || "").includes("Industrials") || (s.industry || "").includes("Construction") || (s.industry || "").includes("Logistics") || (s.industry || "").includes("Ports")
};

const TAB_CONFIG: Record<MarketTab, { 
  indices: string[], 
  stocks: string[], 
  label: string, 
  indexLabel: string, 
  stockLabel: string,
  currency: string,
  icon: any
}> = {
  India: {
    indices: ['^NSEI', '^BSESN', '^NSEBANK', 'NIFTY_FIN_SERVICE.NS', 'NIFTY_MIDCAP_100.NS'],
    stocks: [
      'RELIANCE', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'LT', 'INFY', 'TCS', 
      'BHARTIARTL', 'ETERNAL', 'TATASTEEL', 'TATAMOTORS', 'TATAMTRDVR', 'M&M', 
      'ADANIENT', 'ADANIPORTS', 'BEL', 'HAL', 'BDL', 'MAZDOCK', 'COCHINSHIP', 
      'NTPC', 'POWERGRID', 'COALINDIA', 'JSWSTEEL', 'TRENT', 'ASIANPAINT', 
      'BAJFINANCE', 'SUNPHARMA', 'MARUTI', 'ULTRACEMCO', 'ITC', 'CDSL'
    ],
    label: "India",
    indexLabel: "Major Indian Indices",
    stockLabel: "Trending Stocks (NSE)",
    currency: "₹",
    icon: Activity
  },
  Global: {
    indices: ['^GSPC', '^IXIC', '^DJI', '^FTSE', '^GDAXI', '^N225', '^HSI'],
    stocks: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'LLY', 'AVGO'],
    label: "Global",
    indexLabel: "World Indices",
    stockLabel: "Global Leaders",
    currency: "$",
    icon: Globe
  },
  Crypto: {
    indices: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
    stocks: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'DOGE-USD', 'ADA-USD', 'MATIC-USD', 'TRX-USD', 'LINK-USD'],
    label: "Crypto",
    indexLabel: "Primary Assets",
    stockLabel: "Top Cryptocurrencies",
    currency: "$",
    icon: Coins
  },
  Commodities: {
    indices: ['GC=F', 'SI=F', 'CL=F'],
    stocks: ['GC=F', 'SI=F', 'CL=F', 'BZ=F', 'NG=F', 'HG=F', 'PL=F', 'PA=F', 'ZC=F', 'ZS=F'],
    label: "Commodities",
    indexLabel: "Core Commodities",
    stockLabel: "Energy & Metals",
    currency: "$",
    icon: Box
  },
  Currencies: {
    indices: ['USDINR=X', 'EURINR=X'],
    stocks: ['USDINR=X', 'EURINR=X', 'GBPINR=X', 'JPYINR=X', 'AEDINR=X', 'SARINR=X', 'CNYINR=X', 'AUDINR=X', 'SGDINR=X', 'CADINR=X'],
    label: "Currencies",
    indexLabel: "Major Crosses",
    stockLabel: "Forex Rates (INR)",
    currency: "₹",
    icon: DollarSign
  }
};

function MiniSparkline({ data, isUp }: { data?: number[]; isUp: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 65;
  const height = 22;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color = isUp ? "#10b981" : "#f43f5e";

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function MarketDashboard({ 
  onSelectStock, 
  onSelectCompany,
  defaultTab,
  highlightedSymbol
}: MarketDashboardProps) {
  const [activeTab, setActiveTab] = useState<MarketTab>(defaultTab || "India");

  const [marketOrder, setMarketOrder] = useState<string[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("athena-market-order");
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return [];
  });

  const handleMarketConfigChanged = () => {
    try {
      const saved = safeLocalStorage.getItem("athena-market-order");
      if (saved) setMarketOrder(JSON.parse(saved));
    } catch (e) { }
  };

  useEffect(() => {
    if (defaultTab && defaultTab !== activeTab) {
      setActiveTab(defaultTab);
      setSelectedIndex(0);
      setStockSearch("");
    }
  }, [defaultTab]);

  useEffect(() => {
    if (highlightedSymbol) {
      setStockSearch(highlightedSymbol);
    }
  }, [highlightedSymbol]);

  useEffect(() => {
    handleMarketConfigChanged();
  }, []);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [stockSearch, setStockSearch] = useState("");
  const [activeCapFilter, setActiveCapFilter] = useState<CapFilter>("All");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [fnoOnly, setFnoOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    try {
      const saved = safeLocalStorage.getItem("athena-trending-sort-pref");
      if (saved) return saved as SortOption;
    } catch (e) {}
    return "Trending Score";
  });

  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showAllTrending, setShowAllTrending] = useState(false);

  const [showLiveTooltip, setShowLiveTooltip] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [hiddenSymbols, setHiddenSymbols] = useState<string[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("athena-hidden-stocks");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const handleRemoveStock = (sym: string) => {
    setHiddenSymbols((prev) => {
      const next = prev.includes(sym) ? prev : [...prev, sym];
      try {
        safeLocalStorage.setItem("athena-hidden-stocks", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleRestoreHiddenStocks = () => {
    setHiddenSymbols([]);
    try {
      safeLocalStorage.removeItem("athena-hidden-stocks");
    } catch (e) {}
  };

  const config = TAB_CONFIG[activeTab];

  const handleTabChange = (tab: MarketTab) => {
    setActiveTab(tab);
    setSelectedIndex(0);
    setStockSearch("");
    setActiveCapFilter("All");
    setSelectedSectors([]);
    setFnoOnly(false);
    setShowAllTrending(false);
  };

  const activeTabSymbols = useMemo(() => {
    const tabToCat: Record<MarketTab, string> = {
      "India": "Indian Markets",
      "Global": "Global Markets",
      "Commodities": "Commodities",
      "Currencies": "Forex",
      "Crypto": "Crypto"
    };
    const cat = tabToCat[activeTab];
    const itemsForTab = marketOrder.filter(sym => {
      const def = MASTER_MARKET_ITEMS.find(i => i.symbol === sym);
      return def && def.category === cat;
    });
    return itemsForTab.length > 0 ? itemsForTab : config.indices; 
  }, [marketOrder, activeTab, config.indices]);

  const { indices: liveIndices } = useLiveMarket(activeTabSymbols, "index");
  const { stocks: liveStocks } = useLiveMarket(config.stocks, "background");

  const activeIndices = useMemo(() => {
    return activeTabSymbols.map(sym => 
      liveIndices.find(ind => ind.symbol === sym || ind.name === sym)
    ).filter(Boolean) as MarketIndex[];
  }, [liveIndices, activeTabSymbols]);

  const activeTrendingStocks = useMemo(() => {
    if (activeTab === "India") {
      const rawRelevant = liveStocks.filter(stock => config.stocks.includes(stock.symbol) || config.stocks.includes(stock.symbol.replace('.NS', '')));
      return TrendingStockEngine.getInstance().processAndRankStocks(rawRelevant);
    }

    const resolver = CompanyIdentityResolver.getInstance();
    const rawList = liveStocks
      .filter(stock => config.stocks.includes(stock.symbol))
      .map(stock => {
        const canonical = resolver.resolve(stock.symbol);
        return {
          ...stock,
          canonicalSymbol: canonical.canonicalSymbol,
          officialName: canonical.officialName,
          displaySymbol: canonical.canonicalSymbol,
          displayName: canonical.officialName,
          previousNames: canonical.previousNames || [],
          brandAliases: canonical.brandAliases || [],
          corporateActions: canonical.corporateActions || [],
          industry: canonical.industry || (stock as any).industry,
          sector: canonical.sector || (stock as any).sector,
          volume: 5000000,
          volumeFormatted: "5.0M",
          deliveryVolume: 3000000,
          deliveryVolumePercent: 60,
          fnoActivity: "Active Trading",
          newsCount: 12,
          trendingScore: 82,
          scoreBreakdown: { volumeScore: 18, priceMovementScore: 18, fnoScore: 12, newsScore: 10, institutionalScore: 12 },
          sparklineData: [stock.price * 0.98, stock.price * 0.99, stock.price * 0.985, stock.price * 1.01, stock.price],
          marketCapCategory: (stock.cap as any) || "Large Cap",
          isFnO: true,
          isPSU: false
        } as ExtendedTrendingStock;
      });

    return CompanyDeduplicationEngine.getInstance().deduplicateList<ExtendedTrendingStock>(rawList, s => s.canonicalSymbol || s.symbol);
  }, [liveStocks, config.stocks, activeTab]);

  const activeIndexSymbol = useMemo(() => {
    if (activeIndices.length > 0 && activeIndices[selectedIndex]) {
      return activeIndices[selectedIndex].symbol || activeIndices[selectedIndex].name;
    }
    return config.indices[0];
  }, [activeIndices, selectedIndex, config.indices]);

  const { data: historicalData } = useHistoricalData(activeIndexSymbol);

  const isDataUnavailable = activeIndices.length === 0 && activeTrendingStocks.length === 0;

  // Active filter counter
  const activeFilterCount = useMemo(() => {
    return (activeCapFilter !== "All" ? 1 : 0) + selectedSectors.length + (fnoOnly ? 1 : 0);
  }, [activeCapFilter, selectedSectors, fnoOnly]);

  // Filter and Sort stocks
  const filteredStocks = useMemo(() => {
    const filtered = activeTrendingStocks.filter((stock) => {
      if (hiddenSymbols.includes(stock.symbol) || hiddenSymbols.includes(stock.canonicalSymbol)) {
        return false;
      }

      const q = (stockSearch || "").toLowerCase();
      const matchesSearch =
        !q ||
        (stock.symbol || "").toLowerCase().includes(q) ||
        (stock.name || "").toLowerCase().includes(q) ||
        (stock.officialName || "").toLowerCase().includes(q) ||
        (stock.canonicalSymbol || "").toLowerCase().includes(q) ||
        (stock.sector || "").toLowerCase().includes(q) ||
        (stock.industry || "").toLowerCase().includes(q) ||
        (stock.previousNames || []).some(p => p.toLowerCase().includes(q)) ||
        (stock.brandAliases || []).some(a => a.toLowerCase().includes(q));
      
      const matchesCap = activeCapFilter === "All" || stock.marketCapCategory === activeCapFilter || stock.cap === activeCapFilter;
      
      const matchesFnO = !fnoOnly || !!stock.isFnO;

      let matchesSectors = true;
      if (selectedSectors.length > 0) {
        matchesSectors = selectedSectors.some(sec => {
          const matcher = SECTOR_MAPPING[sec];
          return matcher ? matcher(stock) : false;
        });
      }

      return matchesSearch && matchesCap && matchesFnO && matchesSectors;
    });

    return [...filtered].sort((a, b) => {
      const extA = a as ExtendedTrendingStock;
      const extB = b as ExtendedTrendingStock;

      switch (sortBy) {
        case "Highest Volume":
          return (extB.volume || 0) - (extA.volume || 0);
        case "Most News":
          return (extB.newsCount || 0) - (extA.newsCount || 0);
        case "Most F&O Activity":
          return (extB.isFnO ? 1 : 0) - (extA.isFnO ? 1 : 0) || (extB.trendingScore || 0) - (extA.trendingScore || 0);
        case "Top Gainers":
          return (extB.changePercent || 0) - (extA.changePercent || 0);
        case "Top Losers":
          return (extA.changePercent || 0) - (extB.changePercent || 0);
        case "Highest Delivery":
          return (extB.deliveryVolumePercent || 0) - (extA.deliveryVolumePercent || 0);
        case "Alphabetical":
          return (extA.officialName || extA.symbol).localeCompare(extB.officialName || extB.symbol);
        case "Market Cap": {
          const order: Record<string, number> = { "Large Cap": 3, "Mid Cap": 2, "Small Cap": 1 };
          return (order[extB.marketCapCategory || "Large Cap"] || 0) - (order[extA.marketCapCategory || "Large Cap"] || 0);
        }
        case "Trending Score":
        default:
          return (extB.trendingScore || 0) - (extA.trendingScore || 0);
      }
    });
  }, [activeTrendingStocks, hiddenSymbols, stockSearch, activeCapFilter, selectedSectors, fnoOnly, sortBy]);

  const visibleStocks = useMemo(() => {
    return showAllTrending ? filteredStocks : filteredStocks.slice(0, 10);
  }, [filteredStocks, showAllTrending]);

  const selectedIdxData = activeIndices[selectedIndex] || activeIndices[0];

  return (
    <div className="flex flex-col gap-4" id="athena-markets-hub">
      
      {/* Markets Hub Tab Navigator */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {(Object.keys(TAB_CONFIG) as MarketTab[]).map((tab) => {
          const Icon = TAB_CONFIG[tab].icon;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-display font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive 
                  ? "bg-slate-800 text-white shadow-lg shadow-black/20 border border-slate-700" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
              <span>{TAB_CONFIG[tab].label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT / MAIN COLUMN: Index Grid & Chart */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-slate-100">
                {config.indexLabel}
              </h2>

              <div className="relative">
                <span 
                  onMouseEnter={() => setShowLiveTooltip(true)}
                  onMouseLeave={() => setShowLiveTooltip(false)}
                  onClick={() => setShowLiveTooltip(!showLiveTooltip)}
                  className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full cursor-help font-bold tracking-wider uppercase"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE REALTIME
                </span>

                {showLiveTooltip && (
                  <div className="absolute top-full left-0 mt-1.5 w-64 p-2.5 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl z-50 text-[11px] text-slate-300 backdrop-blur-md">
                    <p className="font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Real-time Streaming Enabled
                    </p>
                    <p className="text-slate-400">
                      Index and stock tickers update automatically with live market ticks.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowManageModal(true)}
              className="text-xs text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sliders className="h-3.5 w-3.5 text-indigo-400" />
              <span>Customize</span>
            </button>
          </div>

          {/* Indices Selector Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {activeIndices.map((idx, index) => {
              const isSelected = selectedIndex === index;
              const isUp = idx.change >= 0;
              return (
                <button
                  key={idx.symbol || idx.name}
                  onClick={() => setSelectedIndex(index)}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected 
                      ? "bg-slate-800/90 border-indigo-500/60 shadow-lg shadow-indigo-500/10" 
                      : "bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-slate-200 truncate">
                      {getHumanMarketName(idx.symbol || idx.name, idx.name)}
                    </span>
                  </div>

                  <div>
                    <div className="font-mono text-sm font-bold text-white">
                      {config.currency}{idx.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className={`flex items-center gap-1 text-[11px] font-mono font-semibold mt-0.5 ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>{isUp ? "+" : ""}{idx.changePercent.toFixed(2)}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main Financial Chart Component */}
          {selectedIdxData && (
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    {getHumanMarketName(selectedIdxData.symbol || selectedIdxData.name, selectedIdxData.name)}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedIdxData.symbol || selectedIdxData.name}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-lg font-bold text-white">
                    {config.currency}{selectedIdxData.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`text-xs font-semibold ${selectedIdxData.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {selectedIdxData.change >= 0 ? "+" : ""}{selectedIdxData.change.toFixed(2)} ({selectedIdxData.changePercent.toFixed(2)}%)
                  </div>
                </div>
              </div>

              <div className="h-[280px] w-full">
                <FinancialChart
                  data={historicalData}
                  title={getHumanMarketName(selectedIdxData.symbol || selectedIdxData.name, selectedIdxData.name)}
                  symbol={selectedIdxData.symbol || selectedIdxData.name}
                />
              </div>
            </div>
          )}

        </div>

        {/* RIGHT SIDE: Market Movers & F&O Leaders */}
        <div className="flex flex-col gap-4">
          <MarketMovers 
            onSelectCompany={onSelectCompany}
            onSelectNews={(sym) => onSelectStock(`${sym} News`)}
            onSelectStock={onSelectStock}
          />
        </div>
      </div>

      {/* FILTER BOTTOM SHEET MODAL */}
      <AnimatePresence>
        {showFilterSheet && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4.5 w-4.5 text-indigo-400" />
                  <h3 className="font-display font-bold text-base text-slate-100">Filter Stocks</h3>
                </div>
                <button 
                  onClick={() => setShowFilterSheet(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Market Cap Section */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Market Cap</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["All", "Large Cap", "Mid Cap", "Small Cap"] as CapFilter[]).map((cap) => (
                    <button
                      key={cap}
                      onClick={() => setActiveCapFilter(cap)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                        activeCapFilter === cap
                          ? "bg-indigo-600 border-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sectors Section */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Sector / Industry</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "Banking", "IT", "Defence", "Auto", 
                    "Pharma", "Energy", "PSU", "FMCG", 
                    "Metal", "Telecom", "Realty", "Infrastructure"
                  ].map((sec) => {
                    const isSelected = selectedSectors.includes(sec);
                    return (
                      <button
                        key={sec}
                        onClick={() => {
                          setSelectedSectors(prev => 
                            prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]
                          );
                        }}
                        className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                        }`}
                      >
                        <span>{sec}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* F&O Only Toggle */}
              <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-slate-200">F&O Segment Only</p>
                  <p className="text-[11px] text-slate-400">Filter stocks with active Futures & Options contracts</p>
                </div>
                <button
                  onClick={() => setFnoOnly(!fnoOnly)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    fnoOnly ? "bg-indigo-600" : "bg-slate-800"
                  }`}
                >
                  <span 
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                      fnoOnly ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setActiveCapFilter("All");
                    setSelectedSectors([]);
                    setFnoOnly(false);
                  }}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  Reset Filters
                </button>
                <button
                  onClick={() => setShowFilterSheet(false)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  Apply Filters ({filteredStocks.length} Results)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SORT BOTTOM SHEET MODAL */}
      <AnimatePresence>
        {showSortSheet && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-3 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4.5 w-4.5 text-indigo-400" />
                  <h3 className="font-display font-bold text-base text-slate-100">Sort Stocks By</h3>
                </div>
                <button 
                  onClick={() => setShowSortSheet(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 py-1">
                {[
                  { id: "Trending Score", label: "🔥 Trending Score", desc: "Ranked by AI volume, momentum & coverage model" },
                  { id: "Highest Volume", label: "📊 Highest Volume", desc: "Stocks with largest total daily traded volume" },
                  { id: "Most News", label: "📰 Most News Coverage", desc: "Stocks with highest media announcements" },
                  { id: "Most F&O Activity", label: "⚡ Most F&O Activity", desc: "Active futures & options open interest surge" },
                  { id: "Top Gainers", label: "📈 Top Gainers", desc: "Highest positive price change % today" },
                  { id: "Top Losers", label: "📉 Top Losers", desc: "Largest negative price drop % today" },
                  { id: "Highest Delivery", label: "📦 Highest Delivery %", desc: "Stocks with highest delivery volume %" },
                  { id: "Alphabetical", label: "🔤 Alphabetical (A-Z)", desc: "Sorted by company official name" },
                  { id: "Market Cap", label: "💎 Market Cap", desc: "Large Cap → Mid Cap → Small Cap" }
                ].map((option) => {
                  const isSelected = sortBy === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id as SortOption);
                        try {
                          safeLocalStorage.setItem("athena-trending-sort-pref", option.id);
                        } catch (e) {}
                        setShowSortSheet(false);
                      }}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500/50 text-white shadow-sm"
                          : "bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">{option.label}</p>
                        <p className="text-[11px] text-slate-400">{option.desc}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-indigo-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showManageModal && (
        <ManageMarkets 
          onClose={() => setShowManageModal(false)}
          onMarketConfigChanged={handleMarketConfigChanged}
        />
      )}
    </div>
  );
}
