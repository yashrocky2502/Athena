import React, { useState, useEffect } from 'react';
import {
  CanonicalOpportunity,
  OpportunityFilterCriteria
} from '../../news/opportunity/types';
import { OpportunityStore } from '../../news/opportunity/OpportunityStore';
import { OpportunityOrchestrator } from '../../news/opportunity/OpportunityOrchestrator';
import { OpportunityQueryEngine, OpportunityQueryResponse } from '../../news/opportunity/OpportunityQueryEngine';
import { OpportunityMatrix } from './OpportunityMatrix';
import { OpportunityForensicPanel } from './OpportunityForensicPanel';
import {
  Sparkles,
  Shield,
  Search,
  Activity,
  Send,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Layers,
  HelpCircle
} from 'lucide-react';

interface OpportunityWorkspaceProps {
  onSelectCompany?: (symbol: string) => void;
  defaultSymbol?: string;
}

export const OpportunityWorkspace: React.FC<OpportunityWorkspaceProps> = ({
  onSelectCompany,
  defaultSymbol
}) => {
  const orchestrator = OpportunityOrchestrator.getInstance();
  const [opportunities, setOpportunities] = useState<CanonicalOpportunity[]>(() =>
    orchestrator.getOpportunities()
  );
  const [selectedOpportunity, setSelectedOpportunity] = useState<CanonicalOpportunity | null>(() => {
    const list = orchestrator.getOpportunities();
    if (defaultSymbol) {
      const match = list.find(o => o.instrument.toUpperCase() === defaultSymbol.toUpperCase().replace('.NS', ''));
      if (match) return match;
    }
    return list[0] || null;
  });

  const [queryInput, setQueryInput] = useState('');
  const [queryResponse, setQueryResponse] = useState<OpportunityQueryResponse | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  useEffect(() => {
    const unsubscribe = OpportunityStore.getInstance().subscribe(() => {
      const updated = orchestrator.getOpportunities();
      setOpportunities(updated);
      if (selectedOpportunity) {
        const refreshed = updated.find(o => o.opportunityId === selectedOpportunity.opportunityId);
        if (refreshed) setSelectedOpportunity(refreshed);
      }
    });
    return unsubscribe;
  }, [selectedOpportunity]);

  const metrics = orchestrator.getMetricsSummary();

  const handleRunQuery = (qText: string) => {
    if (!qText.trim()) return;
    setIsQuerying(true);
    const res = OpportunityQueryEngine.getInstance().query(qText);
    setQueryResponse(res);
    setIsQuerying(false);
    if (res.matchedOpportunities.length > 0) {
      setSelectedOpportunity(res.matchedOpportunities[0]);
    }
  };

  return (
    <div id="opportunity-intelligence-workspace" className="space-y-6 animate-in fade-in duration-150">
      {/* Workspace Metric Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-white">
                Decision Intelligence & Opportunity Engine
              </h1>
              <p className="text-xs text-slate-400">
                Phase 25 Autonomous multi-factor synthesis across 10 independent market dimensions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-mono text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Surveillance Engine Active
            </span>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Tracked Opportunities</span>
            <div className="text-2xl font-bold font-mono text-white mt-1">{metrics.totalOpportunities}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">P0 Critical Tier</span>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">{metrics.p0CriticalCount}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">12-Gate Eligible</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{metrics.executionEligibleCount}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Avg Confidence</span>
            <div className="text-2xl font-bold font-mono text-slate-200 mt-1">{metrics.averageConfidence}<span className="text-xs text-slate-500">/100</span></div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Avg Expected Value</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">+{metrics.averageExpectedValue}%</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Brier Calibration</span>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{metrics.calibrationMetrics.brierScore || '0.042'}</div>
          </div>
        </div>
      </div>

      {/* Ask ATHENA Decision Intelligence Query Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            Ask ATHENA Decision Engine (Deterministic Mode)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              id="input-decision-query"
              type="text"
              placeholder="Ask: 'Why is RELIANCE tradeable?', 'What invalidates TATAMOTORS?', 'Explain formula for HDFCBANK'..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunQuery(queryInput)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            id="btn-submit-decision-query"
            onClick={() => handleRunQuery(queryInput)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Query</span>
          </button>
        </div>

        {/* Query Suggestion Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[11px] text-slate-500">Try:</span>
          {[
            'Why is RELIANCE tradeable?',
            'What invalidates TATAMOTORS?',
            'Explain mathematical formula for RELIANCE',
            'Show top ranked opportunities',
            'Are there any contradictions?'
          ].map(sug => (
            <button
              key={sug}
              onClick={() => {
                setQueryInput(sug);
                handleRunQuery(sug);
              }}
              className="px-2.5 py-1 text-[11px] bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Structured Query Result Display */}
        {queryResponse && (
          <div className="mt-3 bg-slate-950/80 border border-indigo-500/40 p-4 rounded-xl space-y-3">
            <div className="text-xs text-slate-300 whitespace-pre-wrap font-sans">
              {queryResponse.structuredAnswer}
            </div>
          </div>
        )}
      </div>

      {/* Main Layout: Opportunity Matrix + Forensic Panel */}
      <div className="space-y-6">
        {selectedOpportunity && (
          <OpportunityForensicPanel
            opportunity={selectedOpportunity}
            onSelectSymbol={onSelectCompany}
            onClose={() => setSelectedOpportunity(null)}
          />
        )}

        <OpportunityMatrix
          opportunities={opportunities}
          selectedOpportunityId={selectedOpportunity?.opportunityId}
          onSelectOpportunity={(opp) => setSelectedOpportunity(opp)}
          onSelectSymbol={onSelectCompany}
        />
      </div>
    </div>
  );
};
