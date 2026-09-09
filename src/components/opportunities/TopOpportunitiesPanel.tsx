import React from 'react';
import { CanonicalOpportunity } from '../../news/opportunity/types';
import { TrendingUp, TrendingDown, Shield, Sparkles, ChevronRight } from 'lucide-react';

interface TopOpportunitiesPanelProps {
  opportunities: CanonicalOpportunity[];
  onSelectOpportunity: (opp: CanonicalOpportunity) => void;
  onViewAll?: () => void;
}

export const TopOpportunitiesPanel: React.FC<TopOpportunitiesPanelProps> = ({
  opportunities,
  onSelectOpportunity,
  onViewAll
}) => {
  const top = opportunities.slice(0, 3);

  if (top.length === 0) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            High-Conviction Opportunities (Phase 25)
          </h3>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
          >
            <span>View All ({opportunities.length})</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {top.map(opp => {
          const isLong = opp.direction === 'LONG';
          return (
            <div
              key={opp.opportunityId}
              onClick={() => onSelectOpportunity(opp)}
              className="bg-slate-950/60 hover:bg-slate-950/90 border border-slate-800 hover:border-indigo-500/40 p-3.5 rounded-xl transition-all cursor-pointer space-y-2.5 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                    {opp.instrument}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold font-mono rounded border uppercase ${
                    isLong ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    {opp.direction}
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-indigo-400">
                  {opp.confidenceScore}<span className="text-[10px] text-slate-500">/100</span>
                </span>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2">{opp.thesis}</p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-emerald-400 font-mono font-bold">EV: +{opp.expectedValue}%</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  opp.actionRecommendation === 'TRADE' ? 'text-indigo-300 bg-indigo-950/60' : 'text-amber-300 bg-amber-950/60'
                }`}>
                  {opp.actionRecommendation}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
