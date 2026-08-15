import React, { useState, useEffect, useMemo } from "react";
import { Search, GripVertical, X } from "lucide-react";
import { 
  MASTER_MARKET_ITEMS, 
  MarketItemDefinition, 
  getDefaultEnabledSymbols, 
  searchMarketDefinitions 
} from "../lib/marketUtils";
import { useLiveMarket } from "../hooks/useLiveMarket";
import { safeLocalStorage } from "../services/storage/safeStorage";

interface ManageMarketsProps {
  onClose?: () => void;
  onMarketConfigChanged?: () => void;
}

type ManageTab = "Indian" | "Global" | "Commodities" | "Forex" | "Crypto";

export default function ManageMarkets({ onClose, onMarketConfigChanged }: ManageMarketsProps) {
  const [enabledSymbols, setEnabledSymbols] = useState<string[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("athena-enabled-markets");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return getDefaultEnabledSymbols();
  });

  const [marketOrder, setMarketOrder] = useState<string[]>(() => {
    try {
      const saved = safeLocalStorage.getItem("athena-market-order");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return getDefaultEnabledSymbols();
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ManageTab>("Indian");

  // Save changes instantly
  useEffect(() => {
    safeLocalStorage.setItem("athena-enabled-markets", JSON.stringify(enabledSymbols));
    safeLocalStorage.setItem("athena-market-order", JSON.stringify(marketOrder));
    if (onMarketConfigChanged) onMarketConfigChanged();
  }, [enabledSymbols, marketOrder]);

  const toggleMarket = (symbol: string) => {
    if (enabledSymbols.includes(symbol)) {
      setEnabledSymbols(prev => prev.filter(s => s !== symbol));
      setMarketOrder(prev => prev.filter(s => s !== symbol));
    } else {
      setEnabledSymbols(prev => [...prev, symbol]);
      if (!marketOrder.includes(symbol)) {
        setMarketOrder(prev => [...prev, symbol]);
      }
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...marketOrder];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setMarketOrder(next);
  };

  const moveDown = (index: number) => {
    if (index === marketOrder.length - 1) return;
    const next = [...marketOrder];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setMarketOrder(next);
  };

  // Determine what to display based on search or active tab
  const displayItems = useMemo(() => {
    if (searchQuery.trim()) {
      return searchMarketDefinitions(searchQuery);
    }
    const catMap: Record<ManageTab, string> = {
      "Indian": "Indian Markets",
      "Global": "Global Markets",
      "Commodities": "Commodities",
      "Forex": "Forex",
      "Crypto": "Crypto"
    };
    return MASTER_MARKET_ITEMS.filter(i => i.category === catMap[activeTab]);
  }, [searchQuery, activeTab]);

  // Sort displayItems to show enabled ones at the top, following marketOrder
  const sortedDisplayItems = useMemo(() => {
    const enabled = displayItems.filter(i => enabledSymbols.includes(i.symbol))
      .sort((a, b) => marketOrder.indexOf(a.symbol) - marketOrder.indexOf(b.symbol));
    const disabled = displayItems.filter(i => !enabledSymbols.includes(i.symbol));
    return [...enabled, ...disabled];
  }, [displayItems, enabledSymbols, marketOrder]);

  const symbolsToFetch = useMemo(() => sortedDisplayItems.map(i => i.symbol), [sortedDisplayItems]);
  const { indices: liveData } = useLiveMarket(symbolsToFetch, "index");

  const renderChips = () => {
    return marketOrder.map(sym => {
      const def = MASTER_MARKET_ITEMS.find(i => i.symbol === sym);
      return (
        <span key={sym} className="px-2.5 py-1 bg-slate-800 text-slate-300 text-[11px] rounded-lg border border-slate-700 whitespace-nowrap font-mono">
          {def ? def.name : sym}
        </span>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div className="relative bg-slate-900 border-t border-slate-800 rounded-t-3xl w-full max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-250 shadow-2xl shadow-black overflow-hidden">
        
        {/* Drag Handle & Close */}
        <div className="w-full flex items-center justify-between px-6 pt-4 pb-2">
          <div className="w-8"></div> {/* Spacer */}
          <div 
            className="w-12 h-1.5 bg-slate-700 rounded-full cursor-pointer hover:bg-slate-600 transition-colors"
            onClick={onClose}
          ></div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Header */}
        <div className="px-6 pb-4 border-b border-slate-800">
          <h2 className="font-display font-bold text-xl text-white">Manage Market Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">Customize the markets shown on your dashboard.</p>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Nifty, Sensex, Gold, Bitcoin..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Segmented Tabs (only if not searching) */}
        {!searchQuery && (
          <div className="px-6 py-3 overflow-x-auto no-scrollbar flex items-center gap-2 border-b border-slate-800">
            {(["Indian", "Global", "Commodities", "Forex", "Crypto"] as ManageTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-[11px] font-bold font-mono transition-colors whitespace-nowrap ${
                  activeTab === tab 
                    ? "bg-indigo-600 text-white" 
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Market List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-3">
          {sortedDisplayItems.length === 0 ? (
             <p className="text-xs text-slate-500 text-center py-6">No matching markets found.</p>
          ) : (
            sortedDisplayItems.map(item => {
              const isEnabled = enabledSymbols.includes(item.symbol);
              const orderIndex = marketOrder.indexOf(item.symbol);
              const marketData = liveData.find(d => d.symbol === item.symbol || d.name === item.symbol);
              const price = marketData?.price ?? 0;
              const change = marketData?.changePercent ?? 0;
              const isUp = change >= 0;

              return (
                <div 
                  key={item.symbol} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isEnabled 
                      ? "bg-slate-800/60 border-slate-700" 
                      : "bg-slate-900/40 border-slate-800 hover:bg-slate-800/40"
                  }`}
                >
                  {/* Left: Drag Handle (if enabled) + Name */}
                  <div className="flex items-center gap-3">
                    <div className="w-6 flex items-center justify-center">
                      {isEnabled ? (
                        <div className="flex flex-col gap-1">
                          <button onClick={() => moveUp(orderIndex)} disabled={orderIndex === 0} className="text-slate-500 hover:text-white disabled:opacity-30">
                            <span className="block text-[8px] leading-none">▲</span>
                          </button>
                          <GripVertical className="h-4 w-4 text-slate-600" />
                          <button onClick={() => moveDown(orderIndex)} disabled={orderIndex === marketOrder.length - 1} className="text-slate-500 hover:text-white disabled:opacity-30">
                            <span className="block text-[8px] leading-none">▼</span>
                          </button>
                        </div>
                      ) : (
                        <div className="w-4 h-4 bg-slate-800 rounded-full flex items-center justify-center">
                          <span className="text-[9px] text-slate-500">{item.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${isEnabled ? "text-white" : "text-slate-400"}`}>
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono tracking-wider">{item.symbol}</span>
                    </div>
                  </div>

                  {/* Right: Price & Toggle */}
                  <div className="flex items-center gap-4">
                    {/* Price Data */}
                    <div className="flex flex-col items-end min-w-[70px]">
                      {price > 0 ? (
                        <>
                          <span className="text-xs font-mono font-bold text-slate-200">
                            {item.currencySymbol}{price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[10px] font-mono font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                            {isUp ? "+" : ""}{change.toFixed(2)}%
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">--</span>
                      )}
                    </div>

                    {/* iOS style Toggle */}
                    <button 
                      onClick={() => toggleMarket(item.symbol)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Preview Chips */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Live Preview Order</p>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {marketOrder.length > 0 ? renderChips() : (
              <span className="text-[11px] text-slate-600 font-mono italic">No markets selected...</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
