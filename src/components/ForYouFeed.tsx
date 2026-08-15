import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  ChevronRight, 
  Activity, 
  TrendingUp, 
  ShieldAlert, 
  Clock, 
  MoreVertical,
  Star,
  Info,
  Code
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MarketStory } from "../types";
import { PersonalIntelligenceService } from "../services/PersonalIntelligenceService";
import Confidence from "./Confidence";

interface ForYouFeedProps {
  onSelectStory?: (query: string) => void;
  developerMode?: boolean;
}

export default function ForYouFeed({ onSelectStory, developerMode }: ForYouFeedProps) {
  const personalService = PersonalIntelligenceService.getInstance();
  const [feedItems, setFeedItems] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchFeed = () => {
      personalService.generatePersonalFeed().then(items => {
        if (mounted && Array.isArray(items)) {
          setFeedItems(items);
        }
      }).catch(() => {});
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <AnimatePresence mode="popLayout">
          {feedItems.map((item, idx) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.05 }}
              className="group relative"
            >
              <div className="absolute -inset-px bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl -z-10" />
              
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition-all flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.reasons.map((reason: string, rIdx: number) => (
                        <span key={rIdx} className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {reason}
                        </span>
                      ))}
                      <span className="text-[10px] text-slate-500 font-mono">{new Date(item.updatedAt).toLocaleTimeString()}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white leading-tight">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-800" strokeWidth="2.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-emerald-400" strokeWidth="2.5" strokeDasharray={`${item.confidence}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold font-mono text-white">{item.confidence}%</span>
                    </div>
                    <button className="p-2 text-slate-500 hover:text-white transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">
                  {item.summary}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center -space-x-2">
                    {(item.companies || []).slice(0, 3).map((company: string) => (
                      <div key={company} className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-slate-300 ring-2 ring-slate-900">
                        {company.substring(0, 2)}
                      </div>
                    ))}
                    {(item.companies || []).length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-slate-500 ring-2 ring-slate-900">
                        +{(item.companies || []).length - 3}
                      </div>
                    )}
                  </div>
                  <div className="h-4 w-px bg-slate-800 mx-1" />
                  {(item.themes || []).slice(0, 2).map((theme: string) => (
                    <span key={theme} className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      {theme}
                    </span>
                  ))}
                  
                  <div className="ml-auto flex items-center gap-4">
                    {developerMode && (
                      <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-[10px] font-bold">
                        <Code className="w-3 h-3" />
                        SCORE: {item.relevance}
                      </div>
                    )}
                    <button 
                      onClick={() => onSelectStory?.(item.title)}
                      className="flex items-center gap-2 text-xs font-bold text-white bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl hover:bg-slate-900 hover:border-slate-700 transition-all cursor-pointer"
                    >
                      INVESTIGATE STORY
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
