import React, { useState, useEffect, useMemo } from "react";
import { Sliders, TrendingUp, TrendingDown, Activity, X } from "lucide-react";
import { 
  MASTER_MARKET_ITEMS, 
  MarketItemDefinition, 
  getHumanMarketName, 
  getDefaultEnabledSymbols 
} from "../lib/marketUtils";
import { useLiveMarket } from "../hooks/useLiveMarket";
import ManageMarkets from "./ManageMarkets";
import { MarketIndex } from "../types";
import { safeLocalStorage } from "../services/storage/safeStorage";

interface HomeMarketBarProps {
  onSelectStock?: (symbol: string) => void;
  onSelectCompany?: (symbol: string) => void;
  highlightedSymbol?: string;
  onClearHighlight?: () => void;
}

export default function HomeMarketBar({ onSelectStock, onSelectCompany, highlightedSymbol, onClearHighlight }: HomeMarketBarProps) {
  const [showManageModal, setShowManageModal] = useState(false);

  // Enabled symbols & order
  const [enabledSymbols, setEnabledSymbols] = useState<string[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("athena-enabled-markets");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load enabled markets", e);
    }
    return getDefaultEnabledSymbols();
  });

  const [marketOrder, setMarketOrder] = useState<string[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("athena-market-order");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load market order", e);
    }
    return getDefaultEnabledSymbols();
  });

  useEffect(() => {
    if (highlightedSymbol) {
      if (!enabledSymbols.includes(highlightedSymbol)) {
        setEnabledSymbols(prev => {
          const next = [...prev, highlightedSymbol];
          safeLocalStorage.setItem("athena-enabled-markets", JSON.stringify(next));
          return next;
        });
      }

      const timer = setTimeout(() => {
        if (onClearHighlight) onClearHighlight();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [highlightedSymbol]);

  // Reload settings from localStorage when modal changes or mounts
  const refreshConfig = () => {
    try {
      const savedEnabled = safeLocalStorage.getItem("athena-enabled-markets");
      if (savedEnabled) setEnabledSymbols(JSON.parse(savedEnabled));

      const savedOrder = safeLocalStorage.getItem("athena-market-order");
      if (savedOrder) setMarketOrder(JSON.parse(savedOrder));
    } catch (e) {
      console.error("Failed to refresh market config", e);
    }
  };

  // Subscribe to live market data
  const { indices: liveIndices, stocks: liveStocks } = useLiveMarket(enabledSymbols, "index");

  // Map market items in user specified order
  const activeItems = useMemo(() => {
    const orderedSymbols = [...enabledSymbols].sort((a, b) => {
      const idxA = marketOrder.indexOf(a);
      const idxB = marketOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });

    return orderedSymbols.map(sym => {
      const def = MASTER_MARKET_ITEMS.find(i => i.symbol === sym) || {
        symbol: sym,
        name: getHumanMarketName(sym),
        category: "Global Markets",
        type: "index" as const,
        defaultEnabled: true,
        currencySymbol: "$",
        aliases: [sym]
      };

      const liveData = liveIndices.find(i => i.symbol === sym || i.name === sym) ||
                       liveStocks.find(s => s.symbol === sym) as any;

      return {
        ...def,
        name: getHumanMarketName(sym, def.name),
        live: liveData as MarketIndex | undefined
      };
    });
  }, [enabledSymbols, marketOrder, liveIndices, liveStocks]);

  // Helper to generate a mini SVG sparkline
  const renderSparkline = (isUp: boolean, price: number, high: number, low: number) => {
    const p = price || 100;
    const h = high || p * 1.01;
    const l = low || p * 0.99;
    
    const range = h - l || 1;
    const normPrice = ((p - l) / range) * 20;
    
    const points = isUp 
      ? `0,24 8,18 16,21 24,12 32,15 40,8 48,14 56,${28 - normPrice}`
      : `0,6 8,12 16,9 24,18 32,15 40,22 48,19 56,${28 - normPrice}`;

    return (
      <svg className="w-14 h-6 overflow-visible" viewBox="0 0 56 28">
        <path
          d={`M ${points}`}
          fill="none"
          stroke={isUp ? "#10b981" : "#f43f5e"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-3 text-left" id="athena-home-market-bar">
      {/* Flat Horizontal Scrollable Market Bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {activeItems.map(item => {
          const price = item.live?.price || 0;
          const change = item.live?.change || 0;
          const changePct = item.live?.changePercent || 0;
          const high = item.live?.high || price * 1.008;
          const low = item.live?.low || price * 0.992;
          const isUp = change >= 0;

          const formattedPrice = price > 0 
            ? `${item.currencySymbol}${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "--";

          const displayName = getHumanMarketName(item.symbol, item.name);

          return (
            <div
              key={item.symbol}
              onClick={() => {
                if (onSelectStock) onSelectStock(displayName);
                else if (onSelectCompany) onSelectCompany(item.symbol);
              }}
              className="min-w-[190px] max-w-[220px] flex-shrink-0 bg-slate-950 hover:bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 p-3.5 rounded-xl flex flex-col justify-between gap-2.5 transition-all cursor-pointer group shadow-sm select-none"
            >
              {/* Top row: Name & Sparkline */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="font-display font-bold text-sm text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    {item.symbol}
                  </span>
                </div>

                <div className="flex-shrink-0 pt-0.5">
                  {renderSparkline(isUp, price, high, low)}
                </div>
              </div>

              {/* Bottom row: Price & Change % */}
              <div className="flex items-baseline justify-between gap-2 border-t border-slate-900/80 pt-2">
                <span className="font-display font-bold text-sm text-white">
                  {formattedPrice}
                </span>

                <span className={`flex items-center gap-1 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isUp 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}>
                  {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {isUp ? "+" : ""}{changePct.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}

        {/* Manage Markets button at the end of horizontal bar */}
        <button
          onClick={() => setShowManageModal(true)}
          className="flex-shrink-0 min-w-[120px] bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm select-none"
        >
          <Sliders className="h-4 w-4 text-indigo-400" />
          <span>Manage</span>
        </button>
      </div>

      {/* Manage Markets Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-4 border-b border-slate-900">
            <h2 className="font-display font-bold text-lg text-white">Manage Dashboard Markets</h2>
            <button 
              onClick={() => { setShowManageModal(false); refreshConfig(); }}
              className="p-2 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full custom-scrollbar">
            <ManageMarkets onClose={() => setShowManageModal(false)} onMarketConfigChanged={refreshConfig} />
          </div>
        </div>
      )}
    </div>
  );
}

