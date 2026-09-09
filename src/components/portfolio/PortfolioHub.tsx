/**
 * ATHENA — PHASE 26: PERSONAL PORTFOLIO HUB & PORTFOLIO INTELLIGENCE
 * PortfolioHub.tsx
 * 
 * Institutional-Grade Personal Multi-Asset Portfolio Management.
 * 
 * Core Architectural Directives:
 * - API-Free First: No Kite Connect, zero required paid credentials.
 * - Deterministic Canonical Truth: All metrics, Greeks, and risks calculated mathematically from actual state.
 * - Multi-Portfolio Management: Create, Switch, Rename, Archive, Delete.
 * - Equity & F&O Management: Add, Edit, Close with Realized P&L, Delete.
 * - Cash & Transaction Ledger: Real deposits, withdrawals, and immutable accounting.
 * - Excel / CSV Ingestion: Drag-and-drop, validation preview, commit, and source management.
 * - Dynamic Portfolio Intelligence: Live AI Review, Opportunity Linkage, Emerging Risks, Evidence audit.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Shield,
  ShieldAlert,
  Zap,
  PieChart,
  Clock,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  History,
  FileText,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Layers,
  BarChart3,
  Sliders,
  ChevronRight,
  Info,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Check,
  X,
  Edit,
  Sparkles,
  Database,
  FileSpreadsheet,
  Eye,
  ChevronDown,
  Lock,
  Compass
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  CanonicalPortfolioState,
  CanonicalHolding,
  CanonicalPosition,
  BrokerConnectionState,
  Portfolio,
  PortfolioTransaction,
  PortfolioTimelineEvent,
  PortfolioImport
} from "../../news/portfolio/broker/types.ts";
import AddAssetModal, { AssetCategory } from "./modals/AddAssetModal.tsx";
import EditHoldingModal from "./modals/EditHoldingModal.tsx";
import EditPositionModal from "./modals/EditPositionModal.tsx";
import DeleteConfirmModal from "./modals/DeleteConfirmModal.tsx";
import AddTransactionModal from "./modals/AddTransactionModal.tsx";

export default function PortfolioHub({
  developerMode = false,
  onSelectCompany
}: {
  developerMode?: boolean;
  onSelectCompany?: (symbol: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "holdings" | "positions" | "cash" | "intelligence" | "risk" | "imports" | "history" | "brokers"
  >("overview");

  // Multi-Portfolio State
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolio, setActivePortfolio] = useState<Portfolio | null>(null);
  const [canonical, setCanonical] = useState<CanonicalPortfolioState | null>(null);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [timeline, setTimeline] = useState<PortfolioTimelineEvent[]>([]);
  const [imports, setImports] = useState<PortfolioImport[]>([]);
  const [snapshots, setSnapshots] = useState<CanonicalPortfolioState[]>([]);
  const [connections, setConnections] = useState<BrokerConnectionState[]>([]);
  const [intelligence, setIntelligence] = useState<any | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Phase 26.1 Modals
  const [showAddAssetModal, setShowAddAssetModal] = useState<boolean>(false);
  const [addAssetCategory, setAddAssetCategory] = useState<AssetCategory>("STOCK");
  const [editingHolding, setEditingHolding] = useState<CanonicalHolding | null>(null);
  const [editingPosition, setEditingPosition] = useState<CanonicalPosition | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{
    type: "HOLDING" | "POSITION";
    id: string;
    symbol: string;
  } | null>(null);
  const [showAddTxModal, setShowAddTxModal] = useState<boolean>(false);

  // Legacy / Direct Modals
  const [showCreatePortfolioModal, setShowCreatePortfolioModal] = useState<boolean>(false);
  const [newPortfolioName, setNewPortfolioName] = useState<string>("");
  const [newPortfolioDesc, setNewPortfolioDesc] = useState<string>("");

  const [showAddHoldingModal, setShowAddHoldingModal] = useState<boolean>(false);
  const [holdingSymbol, setHoldingSymbol] = useState<string>("");
  const [holdingDisplayName, setHoldingDisplayName] = useState<string>("");
  const [holdingExchange, setHoldingExchange] = useState<string>("NSE");
  const [holdingQty, setHoldingQty] = useState<string>("");
  const [holdingAvgPrice, setHoldingAvgPrice] = useState<string>("");
  const [holdingCurPrice, setHoldingCurPrice] = useState<string>("");
  const [holdingSector, setHoldingSector] = useState<string>("");
  const [holdingAssetClass, setHoldingAssetClass] = useState<"EQUITY" | "ETF">("EQUITY");
  const [holdingPurchaseDate, setHoldingPurchaseDate] = useState<string>("");
  const [holdingNotes, setHoldingNotes] = useState<string>("");

  const [showAddPositionModal, setShowAddPositionModal] = useState<boolean>(false);
  const [posType, setPosType] = useState<"FUTURE" | "OPTION">("OPTION");
  const [posUnderlying, setPosUnderlying] = useState<string>("NIFTY");
  const [posSide, setPosSide] = useState<"LONG" | "SHORT">("LONG");
  const [posOptionType, setPosOptionType] = useState<"CALL" | "PUT">("CALL");
  const [posStrike, setPosStrike] = useState<string>("24500");
  const [posExpiry, setPosExpiry] = useState<string>("");
  const [posQty, setPosQty] = useState<string>("75");
  const [posEntryPrice, setPosEntryPrice] = useState<string>("");
  const [posCurPrice, setPosCurPrice] = useState<string>("");
  const [posNotes, setPosNotes] = useState<string>("");

  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closingItem, setClosingItem] = useState<{ type: "HOLDING" | "POSITION"; id: string; symbol: string; currentPrice: number; avgPrice: number; qty: number } | null>(null);
  const [closePriceInput, setClosePriceInput] = useState<string>("");

  const [showCashModal, setShowCashModal] = useState<boolean>(false);
  const [cashActionType, setCashActionType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [cashAmountInput, setCashAmountInput] = useState<string>("");
  const [cashNotesInput, setCashNotesInput] = useState<string>("");

  // Import State
  const [importContent, setImportContent] = useState<string>("");
  const [importFilename, setImportFilename] = useState<string>("portfolio_import.csv");
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search & Filter
  const [holdingSearch, setHoldingSearch] = useState<string>("");

  // Fetch all initial data
  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const showNotification = (text: string, type: "success" | "error" | "info" = "success") => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchPortfolioData = async () => {
    setLoading(true);
    try {
      const [portRes, allPortsRes, txRes, timeRes, impRes, histRes, connRes, intelRes] = await Promise.all([
        fetch("/api/v4/portfolio").then(r => r.json()).catch(() => ({})),
        fetch("/api/v4/portfolio/all").then(r => r.json()).catch(() => ({})),
        fetch("/api/v4/portfolio/transactions").then(r => r.json()).catch(() => ({})),
        fetch("/api/v4/portfolio/timeline").then(r => r.json()).catch(() => ({})),
        fetch("/api/v4/portfolio/imports").then(r => r.json()).catch(() => ({})),
        fetch("/api/v4/portfolio/history").then(r => r.json()).catch(() => ({})),
        fetch("/api/v4/portfolio/connections").then(r => r.json()).catch(() => ({})),
        fetch("/api/v4/portfolio/intelligence").then(r => r.json()).catch(() => ({}))
      ]);

      if (portRes.portfolio) setCanonical(portRes.portfolio);
      if (portRes.activePortfolio) setActivePortfolio(portRes.activePortfolio);
      if (allPortsRes.portfolios) setPortfolios(allPortsRes.portfolios);
      if (txRes.transactions) setTransactions(txRes.transactions);
      if (timeRes.timeline) setTimeline(timeRes.timeline);
      if (impRes.imports) setImports(impRes.imports);
      if (histRes.snapshots) setSnapshots(histRes.snapshots);
      if (connRes.connections) setConnections(connRes.connections);
      if (intelRes.intelligence) setIntelligence(intelRes.intelligence);
    } catch (err: any) {
      console.error("Failed to load portfolio hub data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPortfolioData();
    showNotification("Portfolio canonical state re-computed successfully.", "info");
  };

  // Switch portfolio
  const handleSwitchPortfolio = async (id: string) => {
    try {
      const res = await fetch("/api/v4/portfolio/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      showNotification(`Switched to portfolio "${res.portfolio.name}"`, "success");
      await fetchPortfolioData();
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  // Create portfolio
  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    try {
      const res = await fetch("/api/v4/portfolio/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPortfolioName.trim(),
          description: newPortfolioDesc.trim(),
          baseCurrency: "INR"
        })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      showNotification(`Created portfolio "${res.portfolio.name}"`, "success");
      setShowCreatePortfolioModal(false);
      setNewPortfolioName("");
      setNewPortfolioDesc("");
      await fetchPortfolioData();
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  // Add Holding
  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(holdingQty);
    const avg = parseFloat(holdingAvgPrice);
    const cur = holdingCurPrice ? parseFloat(holdingCurPrice) : avg;

    if (!holdingSymbol.trim() || isNaN(qty) || isNaN(avg) || qty <= 0 || avg <= 0) {
      showNotification("Please provide a valid symbol, quantity, and average price.", "error");
      return;
    }

    try {
      const pidParam = activePortfolio ? `?portfolioId=${activePortfolio.id}` : "";
      const res = await fetch(`/api/v4/portfolio/holdings${pidParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: holdingSymbol.trim().toUpperCase(),
          displayName: holdingDisplayName.trim() || undefined,
          exchange: holdingExchange,
          quantity: qty,
          averagePrice: avg,
          currentPrice: cur,
          sector: holdingSector.trim() || undefined,
          assetClass: holdingAssetClass,
          purchaseDate: holdingPurchaseDate || undefined,
          notes: holdingNotes.trim() || undefined
        })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      showNotification(`Added ${qty} shares of ${holdingSymbol.toUpperCase()} to portfolio.`, "success");
      setShowAddHoldingModal(false);
      setHoldingSymbol("");
      setHoldingDisplayName("");
      setHoldingQty("");
      setHoldingAvgPrice("");
      setHoldingCurPrice("");
      setHoldingSector("");
      setHoldingPurchaseDate("");
      setHoldingNotes("");
      await fetchPortfolioData();
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  // Add Position (F&O)
  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(posQty);
    const entry = parseFloat(posEntryPrice);
    const cur = posCurPrice ? parseFloat(posCurPrice) : entry;
    const strike = posType === "OPTION" ? parseFloat(posStrike) : undefined;

    if (!posUnderlying.trim() || isNaN(qty) || isNaN(entry) || qty === 0 || entry <= 0) {
      showNotification("Please provide valid underlying, quantity, and entry price.", "error");
      return;
    }

    try {
      const pidParam = activePortfolio ? `?portfolioId=${activePortfolio.id}` : "";
      const res = await fetch(`/api/v4/portfolio/positions${pidParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentType: posType,
          underlying: posUnderlying.trim().toUpperCase(),
          side: posSide,
          optionType: posType === "OPTION" ? posOptionType : undefined,
          strikePrice: strike,
          expiryDate: posExpiry || undefined,
          quantity: qty,
          entryPrice: entry,
          currentPrice: cur,
          notes: posNotes.trim() || undefined
        })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      showNotification(`Added ${posSide} ${posType} position in ${posUnderlying.toUpperCase()}.`, "success");
      setShowAddPositionModal(false);
      setPosEntryPrice("");
      setPosCurPrice("");
      setPosNotes("");
      await fetchPortfolioData();
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  // Close Holding / Position
  const handleConfirmClose = async () => {
    if (!closingItem) return;
    const closePrice = parseFloat(closePriceInput);
    if (isNaN(closePrice) || closePrice <= 0) {
      showNotification("Please provide a valid exit price.", "error");
      return;
    }

    try {
      const endpoint = closingItem.type === "HOLDING"
        ? `/api/v4/portfolio/holdings/${closingItem.id}/close`
        : `/api/v4/portfolio/positions/${closingItem.id}/close`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closePrice })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      const pnl = res.result?.realizedPnL ?? 0;
      showNotification(`Closed ${closingItem.symbol}. Realized P&L: ₹${pnl.toLocaleString('en-IN')}`, pnl >= 0 ? "success" : "info");
      setShowCloseModal(false);
      setClosingItem(null);
      setClosePriceInput("");
      await fetchPortfolioData();
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  // Delete Holding
  const handleDeleteHolding = async (id: string, symbol: string) => {
    if (!confirm(`Delete ${symbol} from portfolio? All historical transactions will remain logged.`)) return;
    try {
      const res = await fetch(`/api/v4/portfolio/holdings/${id}`, { method: "DELETE" }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      showNotification(`Removed ${symbol} from holdings.`, "info");
      await fetchPortfolioData();
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  // Delete Position
  const handleDeletePosition = async (id: string, symbol: string) => {
    if (!confirm(`Delete position ${symbol}?`)) return;
    try {
      const res = await fetch(`/api/v4/portfolio/positions/${id}`, { method: "DELETE" }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      showNotification(`Removed position ${symbol}.`, "info");
      await fetchPortfolioData();
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  // Cash Deposit / Withdraw
  const handleCashAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cashAmountInput);
    if (isNaN(amount) || amount <= 0) {
      showNotification("Please enter a valid cash amount.", "error");
      return;
    }

    try {
      const res = await fetch("/api/v4/portfolio/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          type: cashActionType,
          notes: cashNotesInput.trim() || undefined
        })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      showNotification(`${cashActionType === 'DEPOSIT' ? 'Deposited' : 'Withdrew'} ₹${amount.toLocaleString('en-IN')}. New cash: ₹${res.currentCash.toLocaleString('en-IN')}`, "success");
      setShowCashModal(false);
      setCashAmountInput("");
      setCashNotesInput("");
      await fetchPortfolioData();
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  // Import File Drag & Select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportContent(content);
      handlePreviewFile(file.name, content);
    };
    reader.readAsText(file);
  };

  const handlePreviewFile = async (name: string, content: string) => {
    try {
      const res = await fetch("/api/v4/portfolio/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: name, content })
      }).then(r => r.json());

      setImportPreview(res);
    } catch (err: any) {
      showNotification("Failed to preview file: " + err.message, "error");
    }
  };

  const handleCommitImport = async () => {
    if (!importPreview || !importPreview.parsedRows || importPreview.parsedRows.length === 0) {
      showNotification("No valid rows to commit.", "error");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/v4/portfolio/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: importFilename,
          rows: importPreview.parsedRows
        })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      showNotification(`Successfully ingested ${res.importedCount} assets into portfolio!`, "success");
      setImportPreview(null);
      setImportContent("");
      await fetchPortfolioData();
      setActiveTab("holdings");
    } catch (err: any) {
      showNotification(err.message, "error");
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteImportSource = async (id: string, filename: string) => {
    if (!confirm(`Delete import record for "${filename}"? Canonical holdings and history snapshots will remain preserved.`)) return;

    try {
      const res = await fetch(`/api/v4/portfolio/imports/${id}`, { method: "DELETE" }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      showNotification(res.message, "info");
      await fetchPortfolioData();
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  // Calculations for display
  const totalEquity = canonical?.cash?.totalEquityINR || 0;
  const cashBalance = canonical?.cash?.availableCashINR || 0;
  const holdings = canonical?.holdings || [];
  const positions = canonical?.positions || [];

  const totalCost = holdings.reduce((s, h) => s + (h.quantity * h.averagePrice), 0);
  const totalHoldingsMarketValue = holdings.reduce((s, h) => s + h.marketValueINR, 0);
  const totalHoldingsPnL = holdings.reduce((s, h) => s + h.unrealizedPnLINR, 0);
  const totalDerivativesPnL = positions.reduce((s, p) => s + p.unrealizedPnLINR, 0);
  const totalUnrealizedPnL = totalHoldingsPnL + totalDerivativesPnL;
  const totalReturnPct = totalCost > 0 ? (totalHoldingsPnL / totalCost) * 100 : 0;
  const marginUtil = canonical?.margin?.marginUtilizationPct || 0;

  // Filtered holdings
  const filteredHoldings = holdings.filter(h =>
    h.symbol.toLowerCase().includes(holdingSearch.toLowerCase()) ||
    h.sector?.toLowerCase().includes(holdingSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 pb-24 max-w-7xl mx-auto w-full text-slate-100 font-sans">
      {/* Top Banner Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium ${
              feedback.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                : feedback.type === "error"
                ? "bg-rose-950/80 border-rose-500/40 text-rose-300"
                : "bg-blue-950/80 border-blue-500/40 text-blue-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {feedback.type === "error" && <XCircle className="w-4 h-4 text-rose-400" />}
              {feedback.type === "info" && <Info className="w-4 h-4 text-blue-400" />}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portfolio Header & Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">
                {activePortfolio?.name || "Personal Portfolio"}
              </h1>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {activePortfolio?.status || "ACTIVE"}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                API-Free Canonical
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {activePortfolio?.description || "Primary personal multi-asset portfolio"} • {holdings.length} Holdings • {positions.length} Positions
            </p>
          </div>
        </div>

        {/* Action Controls & Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Portfolio Switcher Dropdown */}
          <div className="relative inline-block">
            <select
              value={activePortfolio?.id || ""}
              onChange={(e) => {
                if (e.target.value === "CREATE_NEW") {
                  setShowCreatePortfolioModal(true);
                } else {
                  handleSwitchPortfolio(e.target.value);
                }
              }}
              aria-label="Select active portfolio"
              className="appearance-none bg-slate-950 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-mono font-medium rounded-xl px-4 py-2.5 pr-8 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  📁 {p.name} ({p.holdings?.length || 0} stocks)
                </option>
              ))}
              <option value="CREATE_NEW">+ Create New Portfolio...</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowCashModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cash (₹{(cashBalance / 100000).toFixed(2)}L)</span>
          </button>

          <button
            onClick={() => {
              setAddAssetCategory("STOCK");
              setShowAddAssetModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Asset</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer"
            title="Refresh Canonical State"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Top Metric Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Equity */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Total Equity (NAV)</span>
            <Database className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl md:text-2xl font-mono font-bold text-white">
            ₹{totalEquity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span>Invested: ₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Total Unrealized P&L */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Unrealized P&L</span>
            {totalUnrealizedPnL >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className={`text-xl md:text-2xl font-mono font-bold ${totalUnrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {totalUnrealizedPnL >= 0 ? "+" : ""}₹{totalUnrealizedPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className={totalReturnPct >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              {totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(2)}%
            </span>
            <span>overall return</span>
          </div>
        </div>

        {/* Available Cash */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Available Cash</span>
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl md:text-2xl font-mono font-bold text-white">
            ₹{cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalEquity > 0 ? ((cashBalance / totalEquity) * 100).toFixed(1) : "0"}% of total equity
          </div>
        </div>

        {/* Margin Utilization */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>Margin Utilization</span>
            <Shield className={`w-3.5 h-3.5 ${marginUtil > 60 ? "text-amber-400" : "text-blue-400"}`} />
          </div>
          <div className={`text-xl md:text-2xl font-mono font-bold ${marginUtil > 80 ? "text-rose-400" : marginUtil > 50 ? "text-amber-400" : "text-white"}`}>
            {marginUtil.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {marginUtil > 80 ? "⚠️ High margin alert" : "Within safe risk bounds"}
          </div>
        </div>

        {/* Portfolio Health & VaR */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1.5">
            <span>1-Day VaR (95%)</span>
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl md:text-2xl font-mono font-bold text-indigo-300">
            ₹{(canonical?.risk?.var95INR || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Score: <span className="font-semibold text-emerald-400">{canonical?.risk?.overallRiskScore || 100}/100</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800/80 pb-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview", icon: PieChart },
          { id: "holdings", label: `Holdings (${holdings.length})`, icon: Layers },
          { id: "positions", label: `Positions F&O (${positions.length})`, icon: Sliders },
          { id: "cash", label: "Cash & Ledger", icon: Wallet },
          { id: "intelligence", label: "Portfolio Intelligence", icon: Sparkles, badge: holdings.length > 0 ? "Active" : undefined },
          { id: "risk", label: "Risk & Scenarios", icon: ShieldAlert },
          { id: "imports", label: "Import & Files", icon: FileSpreadsheet },
          { id: "history", label: "Audit & History", icon: History },
          { id: "brokers", label: "Future Brokers", icon: Briefcase }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW */}
      {/* ========================================================= */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          {/* Quick Stats & Sector Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sector Allocation */}
            <div className="lg:col-span-2 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-400" />
                  Sector Exposure Allocation
                </h2>
                <span className="text-xs text-slate-400">
                  {Object.keys(canonical?.exposure?.sectorExposure || {}).length} Active Sectors
                </span>
              </div>

              {Object.keys(canonical?.exposure?.sectorExposure || {}).length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  No sector exposure yet. Add equity holdings to view allocation breakdown.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {Object.entries(canonical?.exposure?.sectorExposure || {})
                    .sort((a, b) => Number(b[1]) - Number(a[1]))
                    .map(([sector, val]) => {
                      const numVal = Number(val);
                      const pct = totalEquity > 0 ? ((numVal / totalEquity) * 100).toFixed(1) : "0";
                      return (
                        <div key={sector} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-medium">{sector}</span>
                            <span className="font-mono text-slate-400">
                              ₹{numVal.toLocaleString('en-IN')} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.min(100, parseFloat(pct))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Top Holdings Card */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Top Holdings
                </h2>
                <button
                  onClick={() => setActiveTab("holdings")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  View All →
                </button>
              </div>

              {holdings.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  No holdings recorded yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {[...holdings]
                    .sort((a, b) => b.marketValueINR - a.marketValueINR)
                    .slice(0, 5)
                    .map((h) => {
                      const pct = totalEquity > 0 ? ((h.marketValueINR / totalEquity) * 100).toFixed(1) : "0";
                      return (
                        <div
                          key={h.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs"
                        >
                          <div>
                            <span className="font-bold text-white block">{h.symbol}</span>
                            <span className="text-[10px] text-slate-400">{h.quantity} shares • {pct}% NAV</span>
                          </div>
                          <div className="text-right font-mono">
                            <div className="text-slate-200">₹{h.marketValueINR.toLocaleString('en-IN')}</div>
                            <div className={`text-[10px] ${h.unrealizedPnLINR >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {h.unrealizedPnLINR >= 0 ? "+" : ""}₹{h.unrealizedPnLINR.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Intelligence Snapshot Card */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Portfolio Intelligence Highlights
              </h2>
              <button
                onClick={() => setActiveTab("intelligence")}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                Full Intelligence Audit →
              </button>
            </div>

            {intelligence?.isEmpty ? (
              <div className="p-6 text-center bg-slate-950/40 rounded-xl border border-slate-800/60">
                <p className="text-sm text-slate-300 mb-3">{intelligence.message}</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowAddHoldingModal(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    + Add Holding
                  </button>
                  <button
                    onClick={() => setActiveTab("imports")}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                  >
                    Import Portfolio
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {intelligence?.review?.summary}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs">
                    <span className="font-semibold text-emerald-400 block mb-1">Key Portfolio Strength:</span>
                    <span className="text-slate-300">{intelligence?.review?.strengths?.[0]}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs">
                    <span className="font-semibold text-amber-400 block mb-1">Primary Vulnerability:</span>
                    <span className="text-slate-300">{intelligence?.review?.weaknesses?.[0]}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: HOLDINGS */}
      {/* ========================================================= */}
      {activeTab === "holdings" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={holdingSearch}
                onChange={(e) => setHoldingSearch(e.target.value)}
                placeholder="Search symbol or sector..."
                className="w-full bg-slate-900 border border-slate-800 text-xs text-white rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setActiveTab("imports")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV / Excel</span>
              </button>
              <button
                onClick={() => {
                  setAddAssetCategory("STOCK");
                  setShowAddAssetModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Asset</span>
              </button>
            </div>
          </div>

          {/* Holdings Table */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800/80 font-mono text-[11px]">
                  <tr>
                    <th className="p-3.5 pl-4">Symbol / Sector</th>
                    <th className="p-3.5 text-right">Qty</th>
                    <th className="p-3.5 text-right">Avg Price</th>
                    <th className="p-3.5 text-right">Current Price</th>
                    <th className="p-3.5 text-right">Market Value</th>
                    <th className="p-3.5 text-right">P&L (Unrealized)</th>
                    <th className="p-3.5 text-center">Weight</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-500 font-sans">
                        No holdings found. Click{" "}
                        <span
                          className="text-indigo-400 font-semibold cursor-pointer underline"
                          onClick={() => {
                            setAddAssetCategory("STOCK");
                            setShowAddAssetModal(true);
                          }}
                        >
                          + Add Asset
                        </span>{" "}
                        to manually record your stocks or ETFs.
                      </td>
                    </tr>
                  ) : (
                    filteredHoldings.map((h) => {
                      const isProfit = h.unrealizedPnLINR >= 0;
                      const weightPct = totalEquity > 0 ? ((h.marketValueINR / totalEquity) * 100).toFixed(1) : "0";
                      return (
                        <tr key={h.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 pl-4">
                            <div className="font-sans font-bold text-white text-sm flex items-center gap-1.5">
                              {h.symbol}
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                                {h.exchange}
                              </span>
                            </div>
                            <div className="font-sans text-[11px] text-slate-400 mt-0.5">{h.displayName || h.sector}</div>
                          </td>
                          <td className="p-3.5 text-right text-slate-200 font-bold">{h.quantity}</td>
                          <td className="p-3.5 text-right text-slate-300">₹{h.averagePrice.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-white font-bold">₹{h.currentPrice.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-white font-bold">₹{h.marketValueINR.toLocaleString('en-IN')}</td>
                          <td className="p-3.5 text-right">
                            <div className={`font-bold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                              {isProfit ? "+" : ""}₹{h.unrealizedPnLINR.toLocaleString('en-IN')}
                            </div>
                            <div className={`text-[10px] ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                              {isProfit ? "+" : ""}{h.unrealizedPnLPct.toFixed(2)}%
                            </div>
                          </td>
                          <td className="p-3.5 text-center text-slate-400 text-xs">
                            {weightPct}%
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 font-sans">
                              <button
                                onClick={() => setEditingHolding(h)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                                title="Edit Holding Details"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  setClosingItem({
                                    type: "HOLDING",
                                    id: h.id,
                                    symbol: h.symbol,
                                    currentPrice: h.currentPrice,
                                    avgPrice: h.averagePrice,
                                    qty: h.quantity
                                  });
                                  setClosePriceInput(h.currentPrice.toString());
                                  setShowCloseModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold cursor-pointer"
                                title="Close / Sell Holding"
                              >
                                Close / Sell
                              </button>
                              <button
                                onClick={() => setDeleteConfirmItem({ type: "HOLDING", id: h.id, symbol: h.symbol })}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                title="Delete from Portfolio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: POSITIONS (F&O / DERIVATIVES) */}
      {/* ========================================================= */}
      {activeTab === "positions" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Derivatives & F&O Positions</h2>
              <p className="text-xs text-slate-400">Option Greeks and MTM calculated deterministically.</p>
            </div>
            <button
              onClick={() => {
                setAddAssetCategory("OPTION");
                setShowAddAssetModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add F&O Position</span>
            </button>
          </div>

          <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800/80 font-mono text-[11px]">
                  <tr>
                    <th className="p-3.5 pl-4">Contract</th>
                    <th className="p-3.5 text-center">Side</th>
                    <th className="p-3.5 text-right">Qty</th>
                    <th className="p-3.5 text-right">Entry</th>
                    <th className="p-3.5 text-right">LTP</th>
                    <th className="p-3.5 text-right">MTM P&L</th>
                    <th className="p-3.5 text-center">Greeks (Δ / Γ / Θ / V)</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {positions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-500 font-sans">
                        No active derivatives positions. Click{" "}
                        <span
                          className="text-indigo-400 font-semibold cursor-pointer underline"
                          onClick={() => {
                            setAddAssetCategory("OPTION");
                            setShowAddAssetModal(true);
                          }}
                        >
                          + Add F&O Position
                        </span>{" "}
                        to record futures or options contracts.
                      </td>
                    </tr>
                  ) : (
                    positions.map((pos) => {
                      const isProfit = pos.unrealizedPnLINR >= 0;
                      return (
                        <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 pl-4">
                            <div className="font-sans font-bold text-white text-sm">
                              {pos.symbol}
                            </div>
                            <div className="font-sans text-[11px] text-slate-400">
                              {pos.assetClass} {pos.strikePrice ? `₹${pos.strikePrice} ${pos.optionType}` : ''} • Exp: {pos.expiryDate || 'Monthly'}
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${pos.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                              {pos.side}
                            </span>
                          </td>
                          <td className="p-3.5 text-right text-slate-200 font-bold">{pos.quantity}</td>
                          <td className="p-3.5 text-right text-slate-300">₹{pos.entryPrice.toFixed(2)}</td>
                          <td className="p-3.5 text-right text-white font-bold">₹{pos.currentPrice.toFixed(2)}</td>
                          <td className="p-3.5 text-right">
                            <div className={`font-bold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                              {isProfit ? "+" : ""}₹{pos.unrealizedPnLINR.toLocaleString('en-IN')}
                            </div>
                          </td>
                          <td className="p-3.5 text-center text-[11px] text-slate-300 font-mono">
                            {pos.greeks ? (
                              <span>
                                Δ {pos.greeks.delta.toFixed(2)} | Γ {pos.greeks.gamma.toFixed(4)} | Θ {pos.greeks.theta.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 font-sans">
                              <button
                                onClick={() => setEditingPosition(pos)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                                title="Edit Position Details"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  setClosingItem({
                                    type: "POSITION",
                                    id: pos.id,
                                    symbol: pos.symbol,
                                    currentPrice: pos.currentPrice,
                                    avgPrice: pos.entryPrice,
                                    qty: pos.quantity
                                  });
                                  setClosePriceInput(pos.currentPrice.toString());
                                  setShowCloseModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold cursor-pointer"
                              >
                                Close
                              </button>
                              <button
                                onClick={() => setDeleteConfirmItem({ type: "POSITION", id: pos.id, symbol: pos.symbol })}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                title="Delete from Portfolio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: CASH & TRANSACTION LEDGER */}
      {/* ========================================================= */}
      {activeTab === "cash" && (
        <div className="flex flex-col gap-6">
          {/* Cash Overview & Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400 font-medium">Unencumbered Cash Balance</span>
              <div className="text-2xl font-mono font-bold text-emerald-400 mt-2">
                ₹{cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Available immediately for asset allocation.</p>
            </div>
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Deposit Funds</span>
                <p className="text-xs text-slate-300 mt-1">Log external bank deposit or capital injection.</p>
              </div>
              <button
                onClick={() => {
                  setCashActionType("DEPOSIT");
                  setShowCashModal(true);
                }}
                className="mt-3 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
              >
                + Deposit Cash
              </button>
            </div>
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Withdraw Funds</span>
                <p className="text-xs text-slate-300 mt-1">Log payout or bank withdrawal.</p>
              </div>
              <button
                onClick={() => {
                  setCashActionType("WITHDRAWAL");
                  setShowCashModal(true);
                }}
                className="mt-3 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                - Withdraw Cash
              </button>
            </div>
          </div>

          {/* Transaction Ledger Table */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Immutable Transaction & Cash Ledger
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddTxModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Record Transaction</span>
                </button>
                <span className="text-xs text-slate-400">{transactions.length} Total Records</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800/80 font-mono text-[11px]">
                  <tr>
                    <th className="p-3 pl-4">Timestamp</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Symbol / Asset</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Price / Value</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                        No transactions recorded yet. Adding holdings or cash deposits creates immutable ledger entries.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/20">
                        <td className="p-3 pl-4 text-slate-400 text-[11px]">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            tx.type === 'BUY' || tx.type === 'DEPOSIT'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-white font-sans">{tx.symbol || 'CASH_INR'}</td>
                        <td className="p-3 text-right text-slate-300">{tx.quantity || '-'}</td>
                        <td className="p-3 text-right text-white font-bold">
                          ₹{(tx.price || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-sans text-slate-400 text-[11px]">{tx.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: DYNAMIC PORTFOLIO INTELLIGENCE */}
      {/* ========================================================= */}
      {activeTab === "intelligence" && (
        <div className="flex flex-col gap-6">
          {/* AI Data Firewall Notice */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-indigo-300">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold">AI Data Firewall Enforced:</span>
              <span className="text-slate-400">
                Intelligence is analytical and read-only. AI cannot mutate canonical portfolio state or execute broker orders.
              </span>
            </div>
          </div>

          {intelligence?.isEmpty ? (
            <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800/80">
              <Sparkles className="w-12 h-12 text-indigo-400 mx-auto mb-4 opacity-70" />
              <h2 className="text-lg font-bold text-white mb-2">Portfolio Intelligence</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                No portfolio data yet. Add holdings, positions, or import an Excel/CSV portfolio to activate intelligence.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowAddHoldingModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  + Add Holding
                </button>
                <button
                  onClick={() => setActiveTab("imports")}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  Import Portfolio
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* AI Narrative Review */}
              <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-base font-bold text-white">Dynamic AI Portfolio Review</h2>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Mood: {intelligence?.review?.overallMood}
                  </span>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  {intelligence?.review?.summary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                    <span className="text-xs font-bold text-emerald-400 block mb-2">PORTFOLIO STRENGTHS</span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {intelligence?.review?.strengths?.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <span className="text-xs font-bold text-amber-400 block mb-2">VULNERABILITIES & CONCENTRATION</span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {intelligence?.review?.weaknesses?.map((w: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Opportunities & Emerging Risks */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Growth Opportunities */}
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                    <Compass className="w-4 h-4 text-emerald-400" />
                    Opportunity Radar Linkage
                  </h3>
                  <div className="flex flex-col gap-3">
                    {intelligence?.opportunities?.map((opp: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white font-sans">{opp.symbol}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${opp.existingExposure ? "bg-indigo-500/20 text-indigo-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                            {opp.existingExposure ? "CURRENT HOLDING" : "NEW RADAR IDEA"}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] mt-1">{opp.rationale}</p>
                        {opp.existingExposure && (
                          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-400">Position Value: ₹{opp.currentPositionValueINR.toLocaleString('en-IN')}</span>
                            <span className="text-indigo-300 font-semibold">Recommendation: {opp.recommendation}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Emerging Risks */}
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Emerging Risk Factors
                  </h3>
                  <div className="flex flex-col gap-3">
                    {intelligence?.risks?.map((risk: any) => (
                      <div key={risk.id} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white">{risk.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            risk.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {risk.severity}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] mt-1">{risk.description}</p>
                        <div className="mt-2 text-[11px] text-indigo-300 font-medium">
                          Suggested Action: {risk.suggestedAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Evidence Provenance Audit */}
              <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Evidence Traceability (Verifiable Proof)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {intelligence?.evidence?.map((ev: any) => (
                    <div key={ev.evidenceId} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs">
                      <span className="font-bold text-white block truncate">{ev.source}</span>
                      <span className="text-[10px] font-mono text-slate-400">{ev.evidenceType}</span>
                      <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] flex justify-between font-mono">
                        <span className="text-emerald-400">Confidence: {ev.confidence}%</span>
                        <span className="text-slate-400">Fresh: {ev.freshnessScore}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: RISK & STRESS SCENARIOS */}
      {/* ========================================================= */}
      {activeTab === "risk" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400">1-Day VaR (95%)</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">
                ₹{(canonical?.risk?.var95INR || 0).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Parametric Value-at-Risk</p>
            </div>

            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400">Max Single Stock %</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">
                {(canonical?.risk?.maxSingleAssetExposurePct || 0).toFixed(1)}%
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Limit threshold: 30%</p>
            </div>

            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400">Net Portfolio Delta</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">
                {canonical?.risk?.netDelta || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Aggregated directional exposure</p>
            </div>

            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400">Net Portfolio Theta</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">
                ₹{canonical?.risk?.netTheta || 0}/day
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Daily time-decay drag</p>
            </div>
          </div>

          {/* Stress Scenarios */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Institutional Macro Stress Simulations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {canonical?.risk?.stressScenarios?.map((sc, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-white block mb-1">{sc.name}</span>
                    <p className="text-slate-400 text-[11px]">{sc.description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 font-mono flex items-center justify-between">
                    <span className="text-slate-400">Estimated Impact:</span>
                    <span className={`font-bold ${sc.estimatedPnLINR >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {sc.estimatedPnLINR >= 0 ? "+" : ""}₹{sc.estimatedPnLINR.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 7: IMPORTS & OFFLINE FILES */}
      {/* ========================================================= */}
      {activeTab === "imports" && (
        <div className="flex flex-col gap-6">
          {/* File Ingestion Dropzone */}
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80">
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              Offline Excel & CSV Portfolio Ingestion
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Upload your broker export, Excel sheet, or CSV ledger. ATHENA normalizes column formats automatically with complete zero-data-leakage privacy.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-950/40 hover:bg-slate-900/40 transition-all cursor-pointer"
            >
              <Upload className="w-10 h-10 text-indigo-400 mx-auto mb-3 opacity-80" />
              <p className="text-sm font-semibold text-white">Click to browse or drag & drop CSV / Excel files</p>
              <p className="text-xs text-slate-400 mt-1">Supports: Symbol, Quantity, Average Price, Current Price, Sector, Asset Class</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Quick Sample Template Paste */}
            <div className="mt-4 pt-4 border-t border-slate-800/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Or Paste CSV Text Directly:</span>
                <button
                  onClick={() => {
                    const sample = "Symbol,Quantity,AveragePrice,CurrentPrice,Sector\nRELIANCE,100,2450.00,2980.00,Energy & Petrochemicals\nTCS,50,3400.00,4120.00,Information Technology\nHDFCBANK,150,1520.00,1650.00,Banking & Financials\nINFY,120,1480.00,1780.00,Information Technology";
                    setImportContent(sample);
                    setImportFilename("sample_portfolio.csv");
                    handlePreviewFile("sample_portfolio.csv", sample);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  Load Sample Nifty Core CSV
                </button>
              </div>
              <textarea
                value={importContent}
                onChange={(e) => {
                  setImportContent(e.target.value);
                  handlePreviewFile(importFilename, e.target.value);
                }}
                rows={4}
                placeholder="Symbol,Quantity,AveragePrice,CurrentPrice,Sector&#10;RELIANCE,100,2450.00,2980.00,Energy"
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Validation Preview */}
            {importPreview && (
              <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-indigo-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Validation Preview: {importPreview.validRowsCount} Valid Assets</span>
                  </div>
                  <button
                    onClick={handleCommitImport}
                    disabled={importing}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    {importing ? "Committing..." : "Commit To Portfolio →"}
                  </button>
                </div>

                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-slate-400 text-[10px] bg-slate-900">
                      <tr>
                        <th className="p-2">Symbol</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Avg Price</th>
                        <th className="p-2 text-right">Current Price</th>
                        <th className="p-2">Sector</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {importPreview.parsedRows?.slice(0, 8).map((r: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2 font-bold text-white">{r.symbol}</td>
                          <td className="p-2 text-right text-slate-300">{r.quantity}</td>
                          <td className="p-2 text-right text-slate-300">₹{r.averagePrice}</td>
                          <td className="p-2 text-right text-emerald-400">₹{r.currentPrice || r.averagePrice}</td>
                          <td className="p-2 text-slate-400">{r.sector || 'Diversified'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Past Ingestion Sources Table */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden">
            <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Ingested Source Files</h3>
              <span className="text-xs text-slate-400">Preserves historical snapshots upon source deletion</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800/80 font-mono text-[11px]">
                  <tr>
                    <th className="p-3 pl-4">Filename</th>
                    <th className="p-3">Source Type</th>
                    <th className="p-3">Uploaded At</th>
                    <th className="p-3 text-right">Rows Ingested</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {imports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500 font-sans">
                        No external import files recorded yet.
                      </td>
                    </tr>
                  ) : (
                    imports.map((imp) => (
                      <tr key={imp.id}>
                        <td className="p-3 pl-4 font-bold text-white font-sans">{imp.filename}</td>
                        <td className="p-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {imp.sourceType}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{new Date(imp.uploadedAt).toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-emerald-400">{imp.rowCount}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteImportSource(imp.id, imp.filename)}
                            className="px-2.5 py-1 rounded-lg text-rose-400 hover:bg-rose-500/10 font-sans text-[11px] cursor-pointer"
                            title="Delete source record (Preserves canonical portfolio history)"
                          >
                            Delete Source Record
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 8: AUDIT TRAIL & SNAPSHOT HISTORY */}
      {/* ========================================================= */}
      {activeTab === "history" && (
        <div className="flex flex-col gap-6">
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              Append-Only Portfolio Audit Timeline
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Every manual change, trade close, cash flow, and file import creates an immutable point-in-time record.
            </p>

            <div className="flex flex-col gap-3">
              {timeline.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No timeline events recorded.
                </div>
              ) : (
                timeline.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{evt.title}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full ${
                          evt.severity === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300' :
                          evt.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {evt.type}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{evt.description}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cryptographic Snapshots */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
            <h3 className="text-sm font-semibold text-white mb-2">Cryptographic Snapshots & Provenance</h3>
            <div className="flex flex-col gap-2 font-mono text-xs">
              {snapshots.slice(-5).reverse().map((snap) => (
                <div key={snap.snapshotId} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-white font-bold block">{snap.snapshotId}</span>
                    <span className="text-slate-400 font-sans">
                      {new Date(snap.capturedAt).toLocaleString()} • Equity: ₹{snap.cash.totalEquityINR.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <span className="text-indigo-400 truncate max-w-xs" title={snap.provenance?.provenanceRootHash}>
                    SHA: {snap.provenance?.provenanceRootHash?.substring(0, 16)}...
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 9: FUTURE BROKERS & STUBS */}
      {/* ========================================================= */}
      {activeTab === "brokers" && (
        <div className="flex flex-col gap-6">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-indigo-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">API-Free Architecture Policy</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              ATHENA is engineered to operate 100% offline and API-free. You do <strong className="text-white">NOT</strong> need a paid Zerodha Kite Connect API subscription, API keys, or broker OAuth credentials. All portfolio intelligence, Greek calculations, risk simulations, and history operate deterministically on your canonical data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.map((conn) => (
              <div key={conn.broker} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white font-display text-base">{conn.broker}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      DISABLED / FUTURE STUB
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{conn.accountDescriptor}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Status: Inactive / Not Required</span>
                  <span>No Paid API Needed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CREATE PORTFOLIO */}
      {/* ========================================================= */}
      {showCreatePortfolioModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Create New Portfolio</h3>
              <button onClick={() => setShowCreatePortfolioModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePortfolio} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Portfolio Name *</label>
                <input
                  type="text"
                  required
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  placeholder="e.g. Dividend Yield Portfolio, Tactical F&O"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
                <input
                  type="text"
                  value={newPortfolioDesc}
                  onChange={(e) => setNewPortfolioDesc(e.target.value)}
                  placeholder="e.g. High conviction long-term compounding"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePortfolioModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Create Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD HOLDING (EQUITY / ETF) */}
      {/* ========================================================= */}
      {showAddHoldingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Add Equity / ETF Holding</h3>
              <button onClick={() => setShowAddHoldingModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddHolding} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Symbol *</label>
                  <input
                    type="text"
                    required
                    value={holdingSymbol}
                    onChange={(e) => setHoldingSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. RELIANCE, TCS, INFY"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Company / Display Name</label>
                  <input
                    type="text"
                    value={holdingDisplayName}
                    onChange={(e) => setHoldingDisplayName(e.target.value)}
                    placeholder="e.g. Reliance Industries Ltd"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Asset Class</label>
                  <select
                    value={holdingAssetClass}
                    onChange={(e) => setHoldingAssetClass(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="EQUITY">EQUITY (Stock)</option>
                    <option value="ETF">ETF</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Exchange</label>
                  <select
                    value={holdingExchange}
                    onChange={(e) => setHoldingExchange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={holdingQty}
                    onChange={(e) => setHoldingQty(e.target.value)}
                    placeholder="100"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Avg Price (₹) *</label>
                  <input
                    type="number"
                    required
                    step="0.05"
                    value={holdingAvgPrice}
                    onChange={(e) => setHoldingAvgPrice(e.target.value)}
                    placeholder="2450.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">LTP / Current (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={holdingCurPrice}
                    onChange={(e) => setHoldingCurPrice(e.target.value)}
                    placeholder="2510.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Sector (Optional)</label>
                  <input
                    type="text"
                    value={holdingSector}
                    onChange={(e) => setHoldingSector(e.target.value)}
                    placeholder="e.g. Information Technology"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={holdingPurchaseDate}
                    onChange={(e) => setHoldingPurchaseDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Strategy (Optional)</label>
                <input
                  type="text"
                  value={holdingNotes}
                  onChange={(e) => setHoldingNotes(e.target.value)}
                  placeholder="e.g. Core retirement holding, dividend reinvestment"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddHoldingModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm & Save Holding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADD POSITION (F&O) */}
      {/* ========================================================= */}
      {showAddPositionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Add Derivatives Position (F&O)</h3>
              <button onClick={() => setShowAddPositionModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddPosition} className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Instrument</label>
                  <select
                    value={posType}
                    onChange={(e) => setPosType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="OPTION">OPTION</option>
                    <option value="FUTURE">FUTURE</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Underlying *</label>
                  <input
                    type="text"
                    required
                    value={posUnderlying}
                    onChange={(e) => setPosUnderlying(e.target.value.toUpperCase())}
                    placeholder="NIFTY, BANKNIFTY"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Side</label>
                  <select
                    value={posSide}
                    onChange={(e) => setPosSide(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="LONG">LONG (Buy)</option>
                    <option value="SHORT">SHORT (Sell)</option>
                  </select>
                </div>
              </div>

              {posType === "OPTION" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Option Type</label>
                    <select
                      value={posOptionType}
                      onChange={(e) => setPosOptionType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="CALL">CALL (CE)</option>
                      <option value="PUT">PUT (PE)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Strike Price (₹)</label>
                    <input
                      type="number"
                      step="50"
                      value={posStrike}
                      onChange={(e) => setPosStrike(e.target.value)}
                      placeholder="24500"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Quantity / Lots *</label>
                  <input
                    type="number"
                    required
                    value={posQty}
                    onChange={(e) => setPosQty(e.target.value)}
                    placeholder="75"
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
                    placeholder="125.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">LTP (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={posCurPrice}
                    onChange={(e) => setPosCurPrice(e.target.value)}
                    placeholder="140.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Trade Strategy (Optional)</label>
                <input
                  type="text"
                  value={posNotes}
                  onChange={(e) => setPosNotes(e.target.value)}
                  placeholder="e.g. Monthly expiry hedge, iron condor wing"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPositionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: CLOSE / SELL POSITION OR HOLDING */}
      {/* ========================================================= */}
      {showCloseModal && closingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">
                Close {closingItem.type === "HOLDING" ? "Holding" : "Position"}: {closingItem.symbol}
              </h3>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs mb-4">
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Quantity to Close:</span>
                <span className="font-bold text-white font-mono">{closingItem.qty} units</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Average Cost Basis:</span>
                <span className="font-bold text-white font-mono">₹{closingItem.avgPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Exit Selling Price (₹) *</label>
              <input
                type="number"
                step="0.05"
                value={closePriceInput}
                onChange={(e) => setClosePriceInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Projected Realized P&L preview */}
            {parseFloat(closePriceInput) > 0 && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 mb-4 text-xs font-mono flex items-center justify-between">
                <span className="text-slate-400">Projected Realized P&L:</span>
                <span className={`font-bold ${
                  (parseFloat(closePriceInput) - closingItem.avgPrice) * closingItem.qty >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {((parseFloat(closePriceInput) - closingItem.avgPrice) * closingItem.qty >= 0 ? "+" : "")}
                  ₹{((parseFloat(closePriceInput) - closingItem.avgPrice) * closingItem.qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
              >
                Confirm Sale & Credit Cash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: CASH DEPOSIT / WITHDRAWAL */}
      {/* ========================================================= */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">
                Cash Management ({cashActionType})
              </h3>
              <button onClick={() => setShowCashModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCashAction} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCashActionType("DEPOSIT")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    cashActionType === "DEPOSIT" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Deposit (+)
                </button>
                <button
                  type="button"
                  onClick={() => setCashActionType("WITHDRAWAL")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    cashActionType === "WITHDRAWAL" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Withdrawal (-)
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  step="100"
                  value={cashAmountInput}
                  onChange={(e) => setCashAmountInput(e.target.value)}
                  placeholder="50000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={cashNotesInput}
                  onChange={(e) => setCashNotesInput(e.target.value)}
                  placeholder="e.g. Monthly salary savings, dividend payout"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-white text-xs font-semibold cursor-pointer ${
                    cashActionType === "DEPOSIT" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
                  }`}
                >
                  Record {cashActionType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHASE 26.1 MODALS: UNIFIED MANUAL ENTRY, EDIT, DELETE, TX */}
      {/* ========================================================= */}
      {showAddAssetModal && activePortfolio && (
        <AddAssetModal
          portfolioId={activePortfolio.id}
          portfolioName={activePortfolio.name}
          canonical={canonical}
          initialCategory={addAssetCategory}
          onClose={() => setShowAddAssetModal(false)}
          onSuccess={(msg) => {
            showNotification(msg, "success");
            fetchPortfolioData();
          }}
        />
      )}

      {editingHolding && activePortfolio && (
        <EditHoldingModal
          portfolioId={activePortfolio.id}
          holding={editingHolding}
          onClose={() => setEditingHolding(null)}
          onSuccess={(msg) => {
            showNotification(msg, "success");
            fetchPortfolioData();
          }}
        />
      )}

      {editingPosition && activePortfolio && (
        <EditPositionModal
          portfolioId={activePortfolio.id}
          position={editingPosition}
          onClose={() => setEditingPosition(null)}
          onSuccess={(msg) => {
            showNotification(msg, "success");
            fetchPortfolioData();
          }}
        />
      )}

      {deleteConfirmItem && activePortfolio && (
        <DeleteConfirmModal
          portfolioId={activePortfolio.id}
          item={deleteConfirmItem}
          onClose={() => setDeleteConfirmItem(null)}
          onSuccess={(msg) => {
            showNotification(msg, "success");
            fetchPortfolioData();
          }}
        />
      )}

      {showAddTxModal && activePortfolio && (
        <AddTransactionModal
          portfolioId={activePortfolio.id}
          onClose={() => setShowAddTxModal(false)}
          onSuccess={(msg) => {
            showNotification(msg, "success");
            fetchPortfolioData();
          }}
        />
      )}
    </div>
  );
}
