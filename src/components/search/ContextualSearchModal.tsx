/**
 * ATHENA — Phase 21: Contextual Intelligence Search Experience
 * ContextualSearchModal.tsx
 * 
 * Replaces pure company entity lookups with canonical query intent routing and contextual diagnosis.
 * Handles market cause, stock cause, sector cause, digest queries, calendar lookups, and news queries.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, X, ArrowRight, ShieldCheck, Sparkles, 
  TrendingDown, TrendingUp, AlertTriangle, BookOpen, 
  Calendar, FileText, ChevronRight, HelpCircle, Layers 
} from 'lucide-react';
import { athenaQueryIntentRouter } from '../../news/search/AthenaQueryIntentRouter.ts';
import { AthenaQueryResult, QueryIntent } from '../../news/search/QueryIntentTypes.ts';
import EvidenceModal from '../digest/EvidenceModal.tsx';

interface ContextualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: string, param?: string) => void;
  initialQuery?: string;
}

export default function ContextualSearchModal({
  isOpen,
  onClose,
  onNavigateToTab,
  initialQuery = ''
}: ContextualSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [activeResult, setActiveResult] = useState<AthenaQueryResult | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const SUGGESTED_QUERIES = [
    'Why is market down today?',
    'Why is Reliance falling today?',
    'What changed since morning?',
    'What happened yesterday?',
    'Why are banks falling today?',
    'What are today\'s important news?',
    'What earnings are tomorrow?',
    'Analyse Tata Motors'
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (initialQuery && initialQuery.trim()) {
        executeSearch(initialQuery.trim());
      }
    }
  }, [isOpen, initialQuery]);

  const executeSearch = (searchStr: string) => {
    if (!searchStr || !searchStr.trim()) {
      setActiveResult(null);
      return;
    }
    const result = athenaQueryIntentRouter.routeQuery(searchStr);
    setActiveResult(result);
  };

  const handleSelectSuggestion = (suggested: string) => {
    setQuery(suggested);
    executeSearch(suggested);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeSearch(query);
    }
  };

  const handleActionClick = () => {
    if (!activeResult || !onNavigateToTab) return;

    if (activeResult.destination === 'DIGEST_WORKSPACE') {
      onNavigateToTab('digest');
      onClose();
    } else if (activeResult.destination === 'NEWS_INTELLIGENCE') {
      onNavigateToTab('news');
      onClose();
    } else if (activeResult.destination === 'CALENDAR_INTELLIGENCE') {
      onNavigateToTab('calendar');
      onClose();
    } else if (activeResult.destination === 'COMPANY_PROFILE' && activeResult.entities.symbol) {
      onNavigateToTab('search', activeResult.entities.symbol);
      onClose();
    } else {
      onNavigateToTab('digest');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full my-8 shadow-2xl flex flex-col overflow-hidden">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length > 2) {
                executeSearch(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask ATHENA anything... (e.g., Why is market down today?, What changed since morning?)"
            className="flex-1 bg-transparent border-none text-slate-100 text-sm sm:text-base focus:outline-none placeholder:text-slate-500 font-sans"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setActiveResult(null);
              }}
              className="p-1 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            ESC
          </button>
        </div>

        {/* Suggestion Chips */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-mono text-slate-500 uppercase shrink-0">Try:</span>
          {SUGGESTED_QUERIES.map((sq) => (
            <button
              key={sq}
              onClick={() => handleSelectSuggestion(sq)}
              className="px-2.5 py-1 rounded-full text-xs bg-slate-800/70 hover:bg-indigo-950/50 hover:text-indigo-300 text-slate-300 border border-slate-700/60 whitespace-nowrap transition"
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Active Result Diagnosis Area */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          {!activeResult ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-indigo-400/60" />
              <p className="text-sm font-medium text-slate-400">
                Ask natural language questions about Indian markets, macro, sectors, or individual stocks.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                ATHENA automatically classifies your intent into causal diagnosis, intraday delta, daily digest, or entity research.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Intent Classifier Tag */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {activeResult.intent.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Scope: {activeResult.marketScope.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    • Time: {activeResult.temporal.period}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{activeResult.confidence}% Validated</span>
                </div>
              </div>

              {/* Headline & Primary Cause Box */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="text-base font-bold text-white leading-snug">
                  {activeResult.answer.headline}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {activeResult.answer.primaryCause}
                </p>

                {activeResult.answer.attributionType && (
                  <div className="pt-2">
                    <span className="text-[11px] font-mono text-slate-500 uppercase mr-2">Move Attribution:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      activeResult.answer.attributionType === 'IDIOSYNCRATIC' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                      activeResult.answer.attributionType === 'SECTOR_DRIVEN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {activeResult.answer.attributionType}
                    </span>
                  </div>
                )}
              </div>

              {/* Facts & Market Reactions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Verified Facts */}
                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-400 block mb-2">
                    📋 Verified Market Facts
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside leading-relaxed">
                    {activeResult.answer.facts.map((fact, i) => (
                      <li key={i}>{fact}</li>
                    ))}
                  </ul>
                </div>

                {/* Market Reaction & Microstructure */}
                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-400 block mb-2">
                    ⚡ Market Reaction &amp; Liquidity
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside leading-relaxed">
                    {activeResult.answer.marketReactions.map((mr, i) => (
                      <li key={i}>{mr}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Athena Interpretation & Watchlist */}
              <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-2">
                <span className="text-xs font-mono font-bold uppercase text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Athena Causal Synthesis
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {activeResult.answer.athenaInterpretation}
                </p>

                {activeResult.answer.watchlist && activeResult.answer.watchlist.length > 0 && (
                  <div className="pt-2 border-t border-indigo-500/20">
                    <span className="text-[11px] font-mono text-indigo-400 block mb-1">Key Pivot Watchlist:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeResult.answer.watchlist.map((wl, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-slate-300 border border-slate-800">
                          {wl}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Related Stocks & Sectors */}
              {(activeResult.relatedLinks.stocks.length > 0 || activeResult.relatedLinks.sectors.length > 0) && (
                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-slate-500 uppercase">Related:</span>
                    {activeResult.relatedLinks.stocks.map((stk) => (
                      <button
                        key={stk.symbol}
                        onClick={() => {
                          if (onNavigateToTab) {
                            onNavigateToTab('search', stk.symbol);
                            onClose();
                          }
                        }}
                        className="px-2 py-1 rounded-lg text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1 transition"
                      >
                        <span>{stk.symbol}</span>
                        <span className={`text-[10px] font-bold ${stk.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {stk.changePct >= 0 ? '+' : ''}{stk.changePct}%
                        </span>
                      </button>
                    ))}
                  </div>

                  {activeResult.evidence && activeResult.evidence.length > 0 && (
                    <button
                      onClick={() => setIsEvidenceOpen(true)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Inspect {activeResult.evidence.length} Evidence Streams</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Direct Action */}
        {activeResult && (
          <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Suggested Destination: <strong className="text-slate-200">{activeResult.destination.replace(/_/g, ' ')}</strong>
            </span>
            <button
              onClick={handleActionClick}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition"
            >
              <span>Open in Workspace</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Evidence Modal */}
      {activeResult && (
        <EvidenceModal
          isOpen={isEvidenceOpen}
          onClose={() => setIsEvidenceOpen(false)}
          evidence={activeResult.evidence}
          title={`Evidence Matrix — ${activeResult.query}`}
        />
      )}
    </div>
  );
}
