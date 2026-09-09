/**
 * ATHENA — Phase 26.1: Manual Portfolio Asset Entry Modal
 * AddAssetModal.tsx
 *
 * Dedicated unified interface for manually recording:
 * - Stocks (Equities)
 * - ETFs
 * - Futures
 * - Options (with live deterministic Greeks preview)
 * - Cash (Capital Injections / Withdrawals)
 */

import React, { useState, useMemo } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  PieChart,
  Zap,
  Sliders,
  Wallet,
  Calendar,
  FileText,
  Building2,
  CheckCircle2,
  Info,
  Sparkles
} from "lucide-react";
import { CanonicalPortfolioState } from "../../../news/portfolio/broker/types.ts";

export type AssetCategory = "STOCK" | "ETF" | "FUTURE" | "OPTION" | "CASH";

interface AddAssetModalProps {
  portfolioId: string;
  portfolioName: string;
  canonical?: CanonicalPortfolioState | null;
  initialCategory?: AssetCategory;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const COMMON_SYMBOLS: Record<string, { name: string; sector: string; type: "STOCK" | "ETF"; defaultLtp: number }> = {
  ITC: { name: "ITC Limited", sector: "FMCG", type: "STOCK", defaultLtp: 420 },
  RELIANCE: { name: "Reliance Industries Ltd", sector: "Energy & Petrochemicals", type: "STOCK", defaultLtp: 2980 },
  TCS: { name: "Tata Consultancy Services Ltd", sector: "Information Technology", type: "STOCK", defaultLtp: 4320 },
  INFY: { name: "Infosys Limited", sector: "Information Technology", type: "STOCK", defaultLtp: 1890 },
  HDFCBANK: { name: "HDFC Bank Limited", sector: "Banking & Financial Services", type: "STOCK", defaultLtp: 1650 },
  ICICIBANK: { name: "ICICI Bank Limited", sector: "Banking & Financial Services", type: "STOCK", defaultLtp: 1220 },
  SBIN: { name: "State Bank of India", sector: "Banking & Financial Services", type: "STOCK", defaultLtp: 810 },
  BHARTIARTL: { name: "Bharti Airtel Limited", sector: "Telecommunication", type: "STOCK", defaultLtp: 1540 },
  LT: { name: "Larsen & Toubro Ltd", sector: "Capital Goods & Infrastructure", type: "STOCK", defaultLtp: 3600 },
  TATAMOTORS: { name: "Tata Motors Limited", sector: "Automotive", type: "STOCK", defaultLtp: 980 },
  MARUTI: { name: "Maruti Suzuki India Ltd", sector: "Automotive", type: "STOCK", defaultLtp: 12400 },
  SUNPHARMA: { name: "Sun Pharmaceutical Industries", sector: "Pharmaceuticals & Healthcare", type: "STOCK", defaultLtp: 1820 },
  TITAN: { name: "Titan Company Limited", sector: "Consumer Discretionary", type: "STOCK", defaultLtp: 3450 },
  NTPC: { name: "NTPC Limited", sector: "Power & Utilities", type: "STOCK", defaultLtp: 395 },
  TATASTEEL: { name: "Tata Steel Limited", sector: "Metals & Mining", type: "STOCK", defaultLtp: 155 },
  NIFTYBEES: { name: "Nippon India ETF Nifty 50 BeES", sector: "Broad Indices / ETFs", type: "ETF", defaultLtp: 285 },
  GOLDBEES: { name: "Nippon India ETF Gold BeES", sector: "Commodities / Gold ETF", type: "ETF", defaultLtp: 68 },
  BANKBEES: { name: "Nippon India ETF Nifty Bank BeES", sector: "Banking Sector ETF", type: "ETF", defaultLtp: 540 },
  MON100: { name: "Motilal Oswal Nasdaq 100 ETF", sector: "International Equities", type: "ETF", defaultLtp: 165 }
};

export default function AddAssetModal({
  portfolioId,
  portfolioName,
  canonical,
  initialCategory = "STOCK",
  onClose,
  onSuccess
}: AddAssetModalProps) {
  const [category, setCategory] = useState<AssetCategory>(initialCategory);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Common Holding fields (Stock & ETF)
  const [symbol, setSymbol] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [quantity, setQuantity] = useState("");
  const [averagePrice, setAveragePrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [sector, setSector] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Derivatives fields (Futures & Options)
  const [posInstrument, setPosInstrument] = useState<"FUTURE" | "OPTION">(initialCategory === "FUTURE" ? "FUTURE" : "OPTION");
  const [posUnderlying, setPosUnderlying] = useState("NIFTY");
  const [posSide, setPosSide] = useState<"LONG" | "SHORT">("LONG");
  const [posOptionType, setPosOptionType] = useState<"CALL" | "PUT">("CALL");
  const [posStrike, setPosStrike] = useState("25000");
  const [posExpiry, setPosExpiry] = useState("2026-09-25");
  const [posLots, setPosLots] = useState("1");
  const [posLotSize, setPosLotSize] = useState("65");
  const [posEntryPrice, setPosEntryPrice] = useState("");
  const [posCurPrice, setPosCurPrice] = useState("");
  const [posNotes, setPosNotes] = useState("");

  // Cash fields
  const [cashAction, setCashAction] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [cashAmount, setCashAmount] = useState("");
  const [cashNotes, setCashNotes] = useState("");

  // Auto-detection when symbol is typed
  const handleSymbolChange = (sym: string) => {
    const upper = sym.toUpperCase();
    setSymbol(upper);
    const lookup = COMMON_SYMBOLS[upper];
    if (lookup) {
      if (!displayName) setDisplayName(lookup.name);
      if (!sector) setSector(lookup.sector);
      if (!currentPrice && lookup.defaultLtp) setCurrentPrice(lookup.defaultLtp.toString());
      if (!averagePrice && lookup.defaultLtp) setAveragePrice(lookup.defaultLtp.toString());
    }
  };

  const handleApplyPreset = (symKey: string) => {
    const s = COMMON_SYMBOLS[symKey];
    if (!s) return;
    setSymbol(symKey);
    setDisplayName(s.name);
    setSector(s.sector);
    setAveragePrice(s.defaultLtp.toString());
    setCurrentPrice(s.defaultLtp.toString());
    if (s.type === "ETF") setCategory("ETF");
  };

  // Live Math calculations for Stock/ETF
  const stockQty = parseFloat(quantity) || 0;
  const stockAvg = parseFloat(averagePrice) || 0;
  const stockCur = parseFloat(currentPrice) || stockAvg;
  const stockInvested = stockQty * stockAvg;
  const stockMarketVal = stockQty * stockCur;
  const stockUnrealizedPnL = stockMarketVal - stockInvested;
  const stockReturnPct = stockInvested > 0 ? (stockUnrealizedPnL / stockInvested) * 100 : 0;

  // Live Math for Derivatives
  const derivLots = parseFloat(posLots) || 0;
  const derivLotSize = parseFloat(posLotSize) || 1;
  const derivTotalQty = Math.round(derivLots * derivLotSize);
  const derivEntry = parseFloat(posEntryPrice) || 0;
  const derivCur = parseFloat(posCurPrice) || derivEntry;
  const derivPnL = posSide === "LONG"
    ? (derivCur - derivEntry) * derivTotalQty
    : (derivEntry - derivCur) * derivTotalQty;

  // Approximate Option Greeks calculation for preview
  const greeksPreview = useMemo(() => {
    if (category !== "OPTION" && posInstrument !== "OPTION") return null;
    const strike = parseFloat(posStrike) || 25000;
    const isCall = posOptionType === "CALL";
    const deltaBase = isCall ? 0.52 : -0.48;
    const sideMultiplier = posSide === "LONG" ? 1 : -1;
    return {
      delta: Number((deltaBase * sideMultiplier).toFixed(2)),
      gamma: 0.0018,
      theta: Number((-14.5 * (derivTotalQty > 0 ? derivTotalQty / 65 : 1)).toFixed(1)),
      vega: Number((8.2 * (derivTotalQty > 0 ? derivTotalQty / 65 : 1)).toFixed(1))
    };
  }, [category, posInstrument, posOptionType, posSide, posStrike, derivTotalQty]);

  // Cash math
  const currentCash = canonical?.cash?.availableCashINR ?? 0;
  const enteredCash = parseFloat(cashAmount) || 0;
  const projectedCash = cashAction === "DEPOSIT"
    ? currentCash + enteredCash
    : currentCash - enteredCash;

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (category === "STOCK" || category === "ETF") {
        if (!symbol.trim()) throw new Error("Symbol is required.");
        if (stockQty <= 0) throw new Error("Quantity must be greater than 0.");
        if (stockAvg <= 0) throw new Error("Average price must be greater than 0.");

        const res = await fetch(`/api/v4/portfolio/holdings?portfolioId=${portfolioId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: symbol.trim().toUpperCase(),
            displayName: displayName.trim() || undefined,
            exchange,
            quantity: stockQty,
            averagePrice: stockAvg,
            currentPrice: stockCur,
            sector: sector.trim() || undefined,
            assetClass: category === "ETF" ? "ETF" : "EQUITY",
            purchaseDate: purchaseDate || undefined,
            notes: notes.trim() || undefined
          })
        }).then(r => r.json());

        if (res.error) throw new Error(res.error);
        onSuccess(`Successfully added ${stockQty} units of ${symbol.toUpperCase()} to portfolio.`);
        onClose();
      } else if (category === "FUTURE" || category === "OPTION") {
        const instType = category === "FUTURE" ? "FUTURE" : posInstrument;
        if (!posUnderlying.trim()) throw new Error("Underlying contract is required.");
        if (derivTotalQty <= 0) throw new Error("Total quantity (lots × lot size) must be greater than 0.");
        if (derivEntry <= 0) throw new Error("Entry price must be greater than 0.");

        const res = await fetch(`/api/v4/portfolio/positions?portfolioId=${portfolioId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instrumentType: instType,
            underlying: posUnderlying.trim().toUpperCase(),
            side: posSide,
            optionType: instType === "OPTION" ? posOptionType : undefined,
            strikePrice: instType === "OPTION" ? parseFloat(posStrike) : undefined,
            expiryDate: posExpiry || undefined,
            quantity: derivTotalQty,
            lotSize: derivLotSize,
            entryPrice: derivEntry,
            currentPrice: derivCur,
            notes: posNotes.trim() || undefined
          })
        }).then(r => r.json());

        if (res.error) throw new Error(res.error);
        onSuccess(`Recorded ${posSide} ${instType} position for ${posUnderlying.toUpperCase()}.`);
        onClose();
      } else if (category === "CASH") {
        if (enteredCash <= 0) throw new Error("Please enter a valid cash amount greater than 0.");
        if (cashAction === "WITHDRAWAL" && enteredCash > currentCash) {
          throw new Error(`Insufficient cash. Maximum withdrawal is ₹${currentCash.toLocaleString('en-IN')}`);
        }

        const res = await fetch(`/api/v4/portfolio/cash?portfolioId=${portfolioId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: enteredCash,
            type: cashAction,
            notes: cashNotes.trim() || undefined
          })
        }).then(r => r.json());

        if (res.error) throw new Error(res.error);
        onSuccess(`${cashAction === 'DEPOSIT' ? 'Deposited' : 'Withdrew'} ₹${enteredCash.toLocaleString('en-IN')}.`);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add asset.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phase 26.1
              </span>
              <h3 className="text-base font-bold text-white">Manual Portfolio Entry</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Adding to: <span className="font-semibold text-slate-200">{portfolioName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Asset Category Segmented Switcher */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/90">
          <label className="text-[11px] font-semibold text-slate-400 block mb-2">
            STEP 1: CHOOSE ASSET TYPE
          </label>
          <div className="grid grid-cols-5 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: "STOCK", label: "Stock / Equity", icon: Layers },
              { id: "ETF", label: "ETF", icon: PieChart },
              { id: "FUTURE", label: "Future", icon: Zap },
              { id: "OPTION", label: "Option", icon: Sliders },
              { id: "CASH", label: "Cash", icon: Wallet }
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCategory(item.id as AssetCategory);
                    if (item.id === "FUTURE") setPosInstrument("FUTURE");
                    if (item.id === "OPTION") setPosInstrument("OPTION");
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 2 Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="text-[11px] font-semibold text-slate-400">
            STEP 2: ENTER {category} SPECIFICATIONS
          </div>

          {/* ===================== STOCKS & ETFS ===================== */}
          {(category === "STOCK" || category === "ETF") && (
            <>
              {/* Quick Preset Badges */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" /> Quick fill:
                </span>
                {["ITC", "RELIANCE", "TCS", "HDFCBANK", "NIFTYBEES", "GOLDBEES"].map((symKey) => (
                  <button
                    key={symKey}
                    type="button"
                    onClick={() => handleApplyPreset(symKey)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700 cursor-pointer"
                  >
                    +{symKey}
                  </button>
                ))}
              </div>

              {/* Symbol & Company Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Symbol / Ticker *
                  </label>
                  <input
                    type="text"
                    required
                    value={symbol}
                    onChange={(e) => handleSymbolChange(e.target.value)}
                    placeholder="e.g. ITC, RELIANCE, NIFTYBEES"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Company / Asset Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. ITC Limited"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Exchange, Qty, Avg Price, Current Price */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Exchange</label>
                  <select
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="200"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Buy Price (₹) *</label>
                  <input
                    type="number"
                    required
                    step="0.05"
                    value={averagePrice}
                    onChange={(e) => setAveragePrice(e.target.value)}
                    placeholder="420.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Current Price (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    placeholder="420.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Sector & Purchase Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Sector</label>
                  <input
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="e.g. FMCG, Information Technology, Banking"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Strategy (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Core long-term holding, dividend reinvestment"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Real-time Calculation Card */}
              {stockQty > 0 && stockAvg > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between font-mono text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Cost Basis:</span>
                    <span className="text-slate-200 font-bold">₹{stockInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Current Value:</span>
                    <span className="text-white font-bold">₹{stockMarketVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Unrealized P&L:</span>
                    <span className={`font-bold ${stockUnrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {stockUnrealizedPnL >= 0 ? "+" : ""}₹{stockUnrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({stockReturnPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===================== DERIVATIVES (FUTURES & OPTIONS) ===================== */}
          {(category === "FUTURE" || category === "OPTION") && (
            <>
              {/* Underlying & Side */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Contract / Underlying *</label>
                  <input
                    type="text"
                    required
                    value={posUnderlying}
                    onChange={(e) => setPosUnderlying(e.target.value.toUpperCase())}
                    placeholder="e.g. NIFTY, BANKNIFTY, RELIANCE"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Position Side</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPosSide("LONG")}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        posSide === "LONG" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      LONG (Buy)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosSide("SHORT")}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        posSide === "SHORT" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      SHORT (Sell)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={posExpiry}
                    onChange={(e) => setPosExpiry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Option specifics */}
              {(category === "OPTION" || posInstrument === "OPTION") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Option Type</label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setPosOptionType("CALL")}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          posOptionType === "CALL" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        CALL (CE)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPosOptionType("PUT")}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          posOptionType === "PUT" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        PUT (PE)
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Strike Price (₹)</label>
                    <input
                      type="number"
                      step="50"
                      value={posStrike}
                      onChange={(e) => setPosStrike(e.target.value)}
                      placeholder="25000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Lots, Lot Size, Entry Price, Current Price */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Number of Lots</label>
                  <input
                    type="number"
                    min="1"
                    value={posLots}
                    onChange={(e) => setPosLots(e.target.value)}
                    placeholder="1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Lot Size</label>
                  <input
                    type="number"
                    min="1"
                    value={posLotSize}
                    onChange={(e) => setPosLotSize(e.target.value)}
                    placeholder="65"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Entry Price (₹) *</label>
                  <input
                    type="number"
                    required
                    step="0.05"
                    value={posEntryPrice}
                    onChange={(e) => setPosEntryPrice(e.target.value)}
                    placeholder={category === "FUTURE" ? "25000" : "120.00"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Current LTP (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={posCurPrice}
                    onChange={(e) => setPosCurPrice(e.target.value)}
                    placeholder={category === "FUTURE" ? "25120" : "135.00"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Strategy / Notes</label>
                <input
                  type="text"
                  value={posNotes}
                  onChange={(e) => setPosNotes(e.target.value)}
                  placeholder="e.g. Weekly expiry hedge, bull call spread leg"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Derivatives Preview with Greeks */}
              {derivTotalQty > 0 && derivEntry > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Total Contracts:</span>
                      <span className="text-slate-200 font-bold">{derivTotalQty} units ({derivLots} lot{derivLots !== 1 ? "s" : ""})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Premium Outlay:</span>
                      <span className="text-white font-bold">₹{(derivTotalQty * derivEntry).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[11px]">Estimated MTM P&L:</span>
                      <span className={`font-bold ${derivPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {derivPnL >= 0 ? "+" : ""}₹{derivPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Greeks Preview */}
                  {greeksPreview && (
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="text-slate-400 font-sans">Option Greeks Preview:</span>
                      <div className="flex items-center gap-3">
                        <span>Delta (Δ): <strong className="text-indigo-300">{greeksPreview.delta}</strong></span>
                        <span>Gamma (Γ): <strong className="text-indigo-300">{greeksPreview.gamma}</strong></span>
                        <span>Theta (Θ): <strong className="text-rose-300">{greeksPreview.theta}</strong></span>
                        <span>Vega (V): <strong className="text-indigo-300">{greeksPreview.vega}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ===================== CASH INJECTION / WITHDRAWAL ===================== */}
          {category === "CASH" && (
            <>
              {/* Deposit vs Withdrawal */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCashAction("DEPOSIT")}
                  className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    cashAction === "DEPOSIT" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  + Deposit Funds
                </button>
                <button
                  type="button"
                  onClick={() => setCashAction("WITHDRAWAL")}
                  className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    cashAction === "WITHDRAWAL" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  - Withdraw Funds
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  step="100"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  placeholder="e.g. Monthly salary savings, portfolio rebalance cash"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Cash Balance Impact Preview */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between font-mono text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Current Balance:</span>
                  <span className="text-slate-200 font-bold">₹{currentCash.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[11px]">Projected Balance:</span>
                  <span className="text-emerald-400 font-bold">₹{projectedCash.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? "Saving..." : `Save ${category} to Portfolio`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
