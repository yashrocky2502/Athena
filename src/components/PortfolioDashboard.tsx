import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  TrendingUp, 
  Activity, 
  ShieldAlert, 
  Zap, 
  PieChart, 
  Clock, 
  ChevronRight, 
  Search,
  Plus,
  Trash2,
  ExternalLink,
  History,
  FileText,
  AlertCircle,
  Code,
  LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Portfolio, 
  PortfolioHolding, 
  PortfolioAnalysis, 
  PortfolioReview, 
  PortfolioTimelineEvent 
} from "../types";
import { PortfolioService } from "../services/PortfolioService";
import { PortfolioIntelligenceService } from "../services/PortfolioIntelligenceService";
import { useLiveMarket } from "../hooks/useLiveMarket";

export default function PortfolioDashboard({ developerMode, onSelectCompany }: { developerMode: boolean; onSelectCompany: (s: string) => void }) {
  const portfolioService = PortfolioService.getInstance();
  const intelService = PortfolioIntelligenceService.getInstance();

  const [portfolios, setPortfolios] = useState<Portfolio[]>(portfolioService.getPortfolios());
  const [activePortfolioId, setActivePortfolioId] = useState(portfolios[0]?.id || "");
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [review, setReview] = useState<PortfolioReview | null>(null);
  const [timeline, setTimeline] = useState<PortfolioTimelineEvent[]>([]);
  
  const [activeTab, setActiveTab] = useState<"overview" | "holdings" | "analysis" | "timeline">("overview");

  useEffect(() => {
    if (activePortfolioId) {
      setAnalysis(intelService.analyzePortfolio(activePortfolioId));
      setReview(intelService.getPortfolioReview(activePortfolioId));
      setTimeline(intelService.getPortfolioTimeline(activePortfolioId));
    }
  }, [activePortfolioId]);

  const activePortfolio = portfolios.find(p => p.id === activePortfolioId);
  const holdingsSymbols = activePortfolio?.holdings.map(h => h.symbol) || [];
  const { stocks: liveHoldingsStocks } = useLiveMarket(holdingsSymbols, "portfolio");

  return (
    <div className="flex flex-col gap-6 p-6 pb-20">
      {/* Portfolio Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              Portfolio Intelligence
              <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono font-medium">
                {analysis?.overallMood || "Analyzing..."}
              </span>
            </h1>
            <p className="text-slate-400 text-sm">Real-time story tracking for your holdings.</p>
          </div>
          <div className="flex items-center gap-3">
            {developerMode && (
               <div className="flex flex-col items-end mr-4">
                  <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase">Dev: Portfolio Score</span>
                  <span className="text-xs font-mono text-white">78.5%</span>
               </div>
             )}
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all">
              <Plus className="w-4 h-4" />
              NEW PORTFOLIO
            </button>
          </div>
        </div>

        {/* Portfolio Selection */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {portfolios.map(p => (
            <button
              key={p.id}
              onClick={() => setActivePortfolioId(p.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                activePortfolioId === p.id 
                  ? "bg-slate-900 text-white border-slate-700 shadow-lg" 
                  : "bg-slate-950 text-slate-500 border-slate-900 hover:border-slate-800"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-900 w-fit">
        {[
          { id: "overview", label: "Intelligence Review", icon: LayoutDashboard },
          { id: "holdings", label: "Holdings", icon: Briefcase },
          { id: "analysis", label: "Analysis", icon: PieChart },
          { id: "timeline", label: "Timeline", icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? "bg-slate-900 text-white shadow-lg border border-slate-800" 
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {activeTab === "overview" && review && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* AI Summary Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Activity className="w-32 h-32 text-indigo-400" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">AI Portfolio Review</h3>
                </div>
                <p className="text-slate-300 leading-relaxed mb-6">
                  {review.summary}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Strengths</span>
                    <ul className="flex flex-col gap-2">
                      {review.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest">Weaknesses</span>
                    <ul className="flex flex-col gap-2">
                      {review.weaknesses.map((w, i) => (
                        <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Opportunities & Risks Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-3xl flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4" />
                    Growth Opportunities
                  </h4>
                  <ul className="flex flex-col gap-3">
                    {review.opportunities.map((o, i) => (
                      <li key={i} className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-emerald-500/10">
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/10 p-6 rounded-3xl flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4" />
                    Emerging Risks
                  </h4>
                  <ul className="flex flex-col gap-3">
                    {analysis?.emergingRisks.map((r, i) => (
                      <li key={i} className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-rose-500/10">
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Sidebar Stats & Monitoring */}
            <div className="flex flex-col gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Risk Concentration</span>
                  <p className="text-sm text-slate-300 font-medium">{review.riskConcentration}</p>
                </div>
                <div className="flex flex-col gap-4">
                  <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest">To Monitor</span>
                  <div className="flex flex-col gap-3">
                    {review.monitoringItems.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] text-slate-400 font-medium">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Evidence Used</span>
                  <div className="flex flex-wrap gap-2">
                    {review.evidence.map((e, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[9px] text-slate-500 font-mono">
                        {e.split(":")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {developerMode && (
                <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-3xl p-6 flex flex-col gap-4">
                  <h4 className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Personalization Metrics
                  </h4>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">Score</span>
                      <span className="text-[10px] text-white font-mono">78.5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">Risk Engine</span>
                      <span className="text-[10px] text-white font-mono">V3.1-Beta</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">Story Weight</span>
                      <span className="text-[10px] text-white font-mono">0.65</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "holdings" && activePortfolio && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePortfolio.holdings.map(holding => {
                const stockInfo = liveHoldingsStocks.find(s => s.symbol === holding.symbol);
                const currentVal = stockInfo ? stockInfo.price * holding.quantity : holding.averagePrice * holding.quantity;
                const totalCost = holding.averagePrice * holding.quantity;
                const totalGain = currentVal - totalCost;
                const gainPct = (totalGain / totalCost) * 100;
                const isGainUp = totalGain >= 0;
                return (
                <div key={holding.symbol} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-indigo-500/50 transition-all group">
                   <div className="flex items-start justify-between mb-6">
                     <div className="flex flex-col gap-1">
                       <h4 className="text-xl font-mono font-bold text-white tracking-tighter">{holding.symbol}</h4>
                       <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{holding.sector}</span>
                     </div>
                     <button onClick={() => onSelectCompany(holding.symbol)} className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-500 hover:text-white transition-all">
                       <ExternalLink className="w-4 h-4" />
                     </button>
                   </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">Qty</span>
                        <span className="text-sm font-bold text-slate-200">{holding.quantity}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">Avg Price</span>
                        <span className="text-sm font-bold text-slate-200 font-mono">₹{holding.averagePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">Live Price</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          {stockInfo ? "₹" + stockInfo.price.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "Loading..."}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">Total Return</span>
                        <span className={"text-sm font-bold font-mono " + (isGainUp ? "text-emerald-400" : "text-rose-400")}>
                          {isGainUp ? "+" : ""}{totalGain.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({gainPct.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                   <div className="flex flex-col gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                     <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Athena Confidence</span>
                        <span className="text-emerald-400 font-mono font-bold">88.4%</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: "88.4%" }} />
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">Holding Intelligence</span>
                        <p className="text-[11px] text-slate-400 leading-relaxed italic line-clamp-2">"Core story remains bullish despite macro volatility in the sector."</p>
                     </div>
                     <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                        <div className="flex flex-wrap gap-1.5">
                           <span className="text-[9px] font-bold text-amber-400 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" /> CATALYST: ENERGY AGNOSTIC
                           </span>
                           <span className="text-[9px] font-bold text-indigo-400 flex items-center gap-1">
                              <Search className="w-2.5 h-2.5" /> RELATED: HDFC BANK, L&T
                           </span>
                        </div>
                     </div>
                   </div>
                </div>
              )})}
              <button className="border-2 border-dashed border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-indigo-400 hover:border-indigo-400/50 hover:bg-indigo-400/5 transition-all min-h-[200px]">
                <Plus className="w-8 h-8" />
                <span className="text-xs font-bold uppercase tracking-wider">Add Holding</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === "analysis" && analysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-400" />
                  Sector Allocation
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">REBALANCED JUST NOW</span>
              </div>
              <div className="flex flex-col gap-6">
                {Object.entries(analysis.sectorAllocation).map(([sector, percent]) => (
                  <div key={sector} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{sector}</span>
                      <span className="text-white font-mono font-bold">{(percent as number).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${percent as number}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Story Changes in Holdings
                </h3>
                <div className="flex flex-col gap-3">
                  {analysis.storyChanges.map((change, i) => (
                    <div key={i} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">{change}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Diversification Score</span>
                  <span className="text-lg font-mono font-bold text-emerald-400">{analysis.diversificationScore}/100</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${analysis.diversificationScore}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed italic">"Optimal diversification for a medium risk profile. Consider adding commodity exposure."</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="max-w-3xl mx-auto flex flex-col gap-8 py-4">
            {timeline.map((event, idx) => (
              <div key={event.id} className="relative pl-8 pb-8 group last:pb-0">
                {/* Timeline Line */}
                {idx !== timeline.length - 1 && (
                  <div className="absolute left-[7px] top-[24px] bottom-0 w-px bg-slate-800 group-hover:bg-indigo-500/30 transition-colors" />
                )}
                
                {/* Timeline Dot */}
                <div className={`absolute left-0 top-[6px] w-4 h-4 rounded-full border-2 border-slate-900 z-10 transition-all ${
                  event.impact === "Positive" ? "bg-emerald-500" : event.impact === "Negative" ? "bg-rose-500" : "bg-slate-500"
                } group-hover:scale-125`} />

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest">{event.type}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-800" />
                    <span className="text-[10px] text-slate-600 font-mono">{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl group-hover:border-slate-700 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className="text-base font-bold text-white">{event.title}</h4>
                      {event.symbol && (
                        <span className="text-[10px] font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-white shrink-0">{event.symbol}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{event.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
