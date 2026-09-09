import React, { useState, useMemo } from 'react';
import {
  CanonicalOpportunity,
  OpportunityFilterCriteria,
  OpportunityType,
  OpportunityDirection,
  PriorityTier,
  ActionRecommendation
} from '../../news/opportunity/types';
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Shield,
  Activity,
  Layers,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface OpportunityMatrixProps {
  opportunities: CanonicalOpportunity[];
  selectedOpportunityId?: string;
  onSelectOpportunity: (opp: CanonicalOpportunity) => void;
  onSelectSymbol?: (symbol: string) => void;
}

export const OpportunityMatrix: React.FC<OpportunityMatrixProps> = ({
  opportunities,
  selectedOpportunityId,
  onSelectOpportunity,
  onSelectSymbol
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<OpportunityDirection | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<OpportunityType | 'ALL'>('ALL');
  const [tierFilter, setTierFilter] = useState<PriorityTier | 'ALL'>('ALL');
  const [actionFilter, setActionFilter] = useState<ActionRecommendation | 'ALL'>('ALL');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'SCORE' | 'EV' | 'CONFIRMATION' | 'TIME'>('SCORE');

  const filtered = useMemo(() => {
    let list = [...opportunities];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        o.instrument.toLowerCase().includes(q) ||
        o.thesis.toLowerCase().includes(q) ||
        o.catalyst.toLowerCase().includes(q) ||
        o.opportunityType.toLowerCase().includes(q)
      );
    }

    if (directionFilter !== 'ALL') {
      list = list.filter(o => o.direction === directionFilter);
    }

    if (typeFilter !== 'ALL') {
      list = list.filter(o => o.opportunityType === typeFilter);
    }

    if (tierFilter !== 'ALL') {
      list = list.filter(o => o.priorityTier === tierFilter);
    }

    if (actionFilter !== 'ALL') {
      list = list.filter(o => o.actionRecommendation === actionFilter);
    }

    if (eligibleOnly) {
      list = list.filter(o => o.executionEligibility.isEligible);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'SCORE') return b.confidenceScore - a.confidenceScore;
      if (sortBy === 'EV') return b.expectedValue - a.expectedValue;
      if (sortBy === 'CONFIRMATION') return b.confirmationScore - a.confirmationScore;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [opportunities, searchQuery, directionFilter, typeFilter, tierFilter, actionFilter, eligibleOnly, sortBy]);

  return (
    <div id="opportunity-matrix" className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              id="input-opportunity-search"
              type="text"
              placeholder="Search by Symbol (e.g. RELIANCE), thesis, or catalyst..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Direction Filter */}
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">Direction: All</option>
              <option value="LONG">Long Only</option>
              <option value="SHORT">Short Only</option>
            </select>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">Action: All</option>
              <option value="TRADE">TRADE</option>
              <option value="WATCH">WATCH</option>
              <option value="WAIT">WAIT</option>
              <option value="AVOID">AVOID</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="SCORE">Sort: Confidence Score</option>
              <option value="EV">Sort: Expected Value</option>
              <option value="CONFIRMATION">Sort: 10D Confirmation</option>
              <option value="TIME">Sort: Most Recent</option>
            </select>

            {/* Execution Gate Toggle */}
            <button
              id="btn-toggle-execution-eligible"
              onClick={() => setEligibleOnly(!eligibleOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                eligibleOnly
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>12-Gate Eligible</span>
            </button>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center text-slate-400 space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-slate-500" />
            <p className="text-sm">No opportunities match the current criteria.</p>
          </div>
        ) : (
          filtered.map(opp => {
            const isSelected = selectedOpportunityId === opp.opportunityId;
            const isLong = opp.direction === 'LONG';
            const isShort = opp.direction === 'SHORT';

            return (
              <div
                key={opp.opportunityId}
                id={`card-opp-${opp.instrument}`}
                onClick={() => onSelectOpportunity(opp)}
                className={`bg-slate-900 border rounded-2xl p-4 transition-all cursor-pointer hover:border-slate-700 space-y-3 ${
                  isSelected ? 'border-indigo-500/80 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'border-slate-800/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border flex items-center justify-center ${
                      isLong ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                      isShort ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                      'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>
                      {isLong ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-base text-white">{opp.instrument}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border uppercase ${
                          isLong ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                          isShort ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                          'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {opp.direction} • {opp.opportunityType}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-indigo-400 border border-slate-700">
                          {opp.priorityTier}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border ${
                          opp.actionRecommendation === 'TRADE' ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50' :
                          opp.actionRecommendation === 'WATCH' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}>
                          {opp.actionRecommendation}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-1">{opp.thesis}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:self-center">
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Score</span>
                      <div className="text-base font-bold font-mono text-indigo-400">{opp.confidenceScore}<span className="text-[10px] text-slate-500">/100</span></div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Expected Value</span>
                      <div className="text-base font-bold font-mono text-emerald-400">+{opp.expectedValue}%</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">R : R</span>
                      <div className="text-base font-bold font-mono text-cyan-400">1:{opp.riskReward}</div>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-slate-500 transition-transform ${isSelected ? 'rotate-90 text-indigo-400' : ''}`} />
                  </div>
                </div>

                {/* Footer metadata */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>10D Confirm: <b className="text-slate-200">{opp.confirmationScore}/100</b></span>
                    <span>12-Gates: <b className={opp.executionEligibility.isEligible ? 'text-emerald-400' : 'text-amber-400'}>{opp.executionEligibility.status} ({opp.executionEligibility.passedGatesCount}/12)</b></span>
                  </div>
                  <span className="font-mono text-slate-500">{new Date(opp.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
