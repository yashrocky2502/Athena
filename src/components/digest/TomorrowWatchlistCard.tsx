/**
 * ATHENA — Phase 21: Tomorrow Watchlist Card
 * TomorrowWatchlistCard.tsx
 */

import React from 'react';
import { Calendar, AlertCircle, Clock, TrendingUp, HelpCircle } from 'lucide-react';
import { TomorrowWatchlistItem } from '../../news/digest/DigestTypes.ts';

interface TomorrowWatchlistCardProps {
  items: TomorrowWatchlistItem[];
}

export default function TomorrowWatchlistCard({ items }: TomorrowWatchlistCardProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Tomorrow Forward Watchlist</h3>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          {items.length} Catalysts Scheduled
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                item.significance === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                item.significance === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {item.category.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{item.triggerTimeOrCondition}</span>
              </div>
            </div>

            <h4 className="text-xs font-semibold text-slate-200 mb-1.5 leading-snug">
              {item.title}
            </h4>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              <span className="text-slate-500 font-medium">Impact: </span>
              {item.potentialMarketImpact}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
