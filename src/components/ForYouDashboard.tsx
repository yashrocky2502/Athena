import React, { useState, useEffect } from "react";
import { Sparkles, ChevronRight, Activity, TrendingUp, TrendingDown, ShieldAlert, Clock, Star, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ForYouRankingEngine, RankedIntelligenceItem } from "../services/ForYouRankingEngine";
import { LiveMarketEngine } from "../services/LiveMarketEngine";
import { MarketStoryEngine } from "../services/MarketStoryEngine";
import { UserPreferenceService } from "../services/UserPreferenceService";
import { AlertDecisionEngine } from "../services/AlertDecisionEngine";
import IntelligenceCard from "./IntelligenceCard";
import { AthenaAlert } from "../types";

interface ForYouDashboardProps {
  onSelectStory?: (query: string) => void;
  onSelectCompany?: (symbol: string) => void;
  developerMode?: boolean;
}

export default function ForYouDashboard({ onSelectStory, onSelectCompany, developerMode }: ForYouDashboardProps) {
  const [indices, setIndices] = useState<any[]>([]);
  const [rankedItems, setRankedItems] = useState<RankedIntelligenceItem[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [marketSummary, setMarketSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subId = LiveMarketEngine.getInstance().subscribe({
      type: "index",
      symbols: ["^NSEI", "^NSEBANK", "^BSESN"],
      callback: (data) => setIndices(data.indices)
    });

    const loadData = async () => {
      setIsLoading(true);
      const stories = MarketStoryEngine.getInstance().getStories();
      const alerts = AlertDecisionEngine.getInstance().getAlertHistory();
      const ranked = await ForYouRankingEngine.getInstance().rankIntelligence(stories, alerts);
      setRankedItems(ranked);
      setWatchlist(await UserPreferenceService.getInstance().getWatchlist());
      
      try {
        const res = await fetch("/api/ai/market-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stories: stories.slice(0, 20) })
        });
        const data = await res.json();
        setMarketSummary(data);
      } catch (e) {
        console.error("Failed to fetch market summary", e);
      }
      setIsLoading(false);
    };
    loadData();

    return () => LiveMarketEngine.getInstance().unsubscribe(subId);
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-10">

      <section className="flex flex-col gap-4">
        <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          Your Top Intelligence
        </h2>
        <div className="flex flex-col gap-4">
          {rankedItems.slice(0, 3).map(item => (
            item.type === "Alert" ? (
              <IntelligenceCard key={item.id} alert={item.data as AthenaAlert} explanation={item.explanation} />
            ) : (
              <div key={item.id} className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex flex-col gap-3">
                <h3 className="font-bold text-white text-lg">{(item.data as any).title || (item.data as any).headline}</h3>
                <p className="text-sm text-slate-400">{(item.data as any).summary || (item.data as any).whyItMatters || (item.data as any).body}</p>
                <div className="text-xs bg-slate-950 p-3 rounded-lg text-slate-300 border border-slate-800">
                  <span className="font-bold text-indigo-400">Why am I seeing this?</span> {item.explanation}
                </div>
              </div>
            )
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400" />
          Your Companies
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {watchlist.map(company => (
            <div key={company.companyId} className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
              <span className="font-bold text-white">{company.symbol}</span>
              <span className="text-xs text-slate-500">No major events</span>
            </div>
          ))}
        </div>
      </section>
      
      <section className="flex flex-col gap-4">
        <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          Market Pulse
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {indices.map(idx => (
            <div key={idx.symbol} className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase">{idx.name}</span>
              <span className="text-lg font-bold text-white">{idx.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>

      {marketSummary && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-950/10 border border-emerald-900/20 p-5 rounded-3xl">
             <h3 className="text-emerald-400 font-bold uppercase text-xs mb-2">Opportunities</h3>
             {marketSummary.opportunities?.map((o: any, i: number) => <p key={i} className="text-sm text-slate-300">{o.theme}</p>)}
          </div>
          <div className="bg-rose-950/10 border border-rose-900/20 p-5 rounded-3xl">
             <h3 className="text-rose-400 font-bold uppercase text-xs mb-2">Risks</h3>
             {marketSummary.risks?.map((r: any, i: number) => <p key={i} className="text-sm text-slate-300">{r.risk}</p>)}
          </div>
        </section>
      )}
    </div>
  );
}
