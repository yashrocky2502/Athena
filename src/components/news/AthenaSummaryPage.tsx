import React, { useState, useEffect } from 'react';
import { 
  X, ExternalLink, TrendingUp, TrendingDown, 
  Minus, Activity, Clock, Sparkles, Hash,
  FileText, ShieldAlert, CheckCircle2, Link as LinkIcon,
  HelpCircle, BarChart3, AlertCircle
} from 'lucide-react';
import { NewsArticle } from '../../news/models/NewsArticle';
import { IntelligenceRecord, FinancialMetricRecord } from '../../newsCoreV2/intelligenceV2/IntelligenceTypes';
import { UnifiedIntelligenceEngine } from '../../newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine';

interface AthenaSummaryPageProps {
  article: NewsArticle;
  activeArticleContent?: any;
  activeSummary?: any;
  onClose: () => void;
  onOpenOriginal?: () => void;
}

export function AthenaSummaryPage({
  article,
  onClose,
  onOpenOriginal
}: AthenaSummaryPageProps) {
  const [record, setRecord] = useState<IntelligenceRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadIntelligence() {
      try {
        setLoading(true);
        // Try fetching from canonical intelligence endpoint
        const res = await fetch(`/api/v4/news/${article.id}/intelligence`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.intelligence) {
            setRecord(data.intelligence);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        // Fallback to client-side deterministic construction if offline / mock
      }

      if (isMounted) {
        try {
          const fallback = UnifiedIntelligenceEngine.build(article as any);
          setRecord(fallback);
        } catch (err: any) {
          setFetchError(err?.message || "Failed to load intelligence record");
        }
        setLoading(false);
      }
    }

    loadIntelligence();

    return () => {
      isMounted = false;
    };
  }, [article.id]);

  if (loading && !record) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-mono text-slate-300">Retrieving Canonical Intelligence Record...</p>
        </div>
      </div>
    );
  }

  const intel: IntelligenceRecord = record || UnifiedIntelligenceEngine.build(article as any);

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 font-bold text-xs shadow-sm">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>BULLISH</span>
          </span>
        );
      case 'BEARISH':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-rose-950/90 border border-rose-500/40 text-rose-400 font-bold text-xs shadow-sm">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>BEARISH</span>
          </span>
        );
      case 'VOLATILE':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-amber-950/90 border border-amber-500/40 text-amber-400 font-bold text-xs shadow-sm">
            <Activity className="w-3.5 h-3.5" />
            <span>VOLATILE</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs">
            <Minus className="w-3.5 h-3.5" />
            <span>NEUTRAL</span>
          </span>
        );
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    if (urgency === 'CRITICAL') {
      return <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-400 text-xxs font-mono font-bold">URGENCY: CRITICAL</span>;
    }
    if (urgency === 'HIGH') {
      return <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-400 text-xxs font-mono font-bold">URGENCY: HIGH</span>;
    }
    return <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-xxs font-mono font-bold">URGENCY: {urgency}</span>;
  };

  const formattedTime = intel.publishedAt
    ? new Date(intel.publishedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'Recent';

  const displayCompany = intel.symbol && intel.companyName && intel.symbol !== intel.companyName
    ? `${intel.companyName} (${intel.symbol})`
    : intel.companyName || 'Broad Market';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200" id="athena-canonical-summary-modal">
      {/* Container */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-4xl h-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Top Minimal Terminal Navigation Bar */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-xxs font-black tracking-wider uppercase border border-indigo-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              CANONICAL INTELLIGENCE V{intel.intelligenceVersion || "27.1"}
            </span>
            <span className="text-xxs font-mono text-slate-400 hidden sm:inline-block">• Single Truth Parity Architecture</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors"
            title="Close Brief"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Header Metadata & Entity */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xxs font-mono text-slate-400">
              <span className="px-2.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold uppercase border border-indigo-700">
                {displayCompany}
              </span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase border border-slate-700">
                {intel.category}
              </span>
              <span>•</span>
              <span className="font-bold text-slate-200">{intel.source}</span>
              <span>•</span>
              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{formattedTime} IST</span>
              </div>
              {intel.fnoEligible && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                  F&O Eligible
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-100 leading-snug tracking-tight">
              {intel.headline}
            </h1>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {getSentimentBadge(intel.sentiment)}
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono font-bold">
                MATERIALITY: {intel.materialityScore}/100
              </span>
              {getUrgencyBadge(intel.urgency)}
              {intel.canonicalUrl && (
                <a
                  href={intel.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-indigo-300 text-xs font-mono transition-colors ml-auto"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Original Article</span>
                </a>
              )}
            </div>
          </div>

          {/* 1. EXECUTIVE SUMMARY BLOCK */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-2.5 shadow-lg">
            <h2 className="text-xs font-black text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>1. Executive Intelligence Summary</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-medium">
              {intel.executiveSummary}
            </p>
          </div>

          {/* 2. FINANCIAL METRICS TABLE (If Extracted) */}
          {intel.financialMetrics && intel.financialMetrics.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h2 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Hash className="w-4 h-4 text-amber-400" />
                  <span>2. Canonical Financial Metrics</span>
                </h2>
                <span className="text-xxs font-mono text-slate-400 uppercase">Grounded Source Data</span>
              </div>

              {/* Responsive Metric Cards (Mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:hidden font-mono">
                {intel.financialMetrics.map((m, idx) => (
                  <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col justify-between space-y-1">
                    <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider">{m.name}</span>
                    <span className="text-sm font-black text-white">{m.displayText}</span>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-xxs">
                      <span className={`font-bold ${
                        m.direction === 'UP' ? 'text-emerald-400' : m.direction === 'DOWN' ? 'text-rose-400' : 'text-slate-400'
                      }`}>
                        {m.changePercent !== null ? `${m.direction === 'UP' ? '▲ +' : '▼ -'}${Math.abs(m.changePercent)}%` : m.direction}
                      </span>
                      {m.previousValue !== null && (
                        <span className="text-slate-500">Prev: {m.previousValue}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sleek Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xxs uppercase tracking-wider">
                      <th className="pb-2 font-bold">Metric</th>
                      <th className="pb-2 font-bold text-right">Value</th>
                      <th className="pb-2 font-bold text-right">Previous</th>
                      <th className="pb-2 font-bold text-right">YoY / Change</th>
                      <th className="pb-2 font-bold text-right">Direction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {intel.financialMetrics.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 font-bold text-slate-200">{m.name}</td>
                        <td className="py-2.5 text-right font-black text-white">{m.displayText}</td>
                        <td className="py-2.5 text-right text-slate-400">{m.previousValue !== null ? `${m.previousValue} ${m.unit}` : '—'}</td>
                        <td className={`py-2.5 text-right font-bold ${
                          m.direction === 'UP' ? 'text-emerald-400' : m.direction === 'DOWN' ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {m.changePercent !== null ? `${m.direction === 'UP' ? '▲ +' : '▼ -'}${Math.abs(m.changePercent)}%` : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`px-2 py-0.5 rounded text-xxs font-bold ${
                            m.direction === 'UP' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            m.direction === 'DOWN' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {m.direction}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. KEY FACTS & DEVELOPMENTS */}
          {intel.keyFacts && intel.keyFacts.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
              <h2 className="text-xs font-black text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>3. Key Facts & Verified Claims</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200">
                {intel.keyFacts.map((fact, idx) => (
                  <div key={idx} className="flex items-start space-x-2 bg-slate-950/70 p-3 rounded-lg border border-slate-800/60">
                    <span className="text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
                    <span className="leading-snug text-slate-200">{fact}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. WHY IT MATTERS & OPTIONS SELLER IMPACT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Why It Matters */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <h2 className="text-xs font-black text-sky-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <span>4. Why It Matters</span>
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {intel.whyItMatters}
                </p>
              </div>
            </div>

            {/* Options Seller Impact */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <h2 className="text-xs font-black text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span>5. Options Seller Impact</span>
                  </h2>
                  <span className="text-xxs font-mono text-amber-300 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                    Conservative Assessment
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {intel.optionsSellerImpact}
                </p>
              </div>
            </div>
          </div>

          {/* 5. RISK WATCHPOINTS */}
          {intel.risk && intel.risk.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <h2 className="text-xs font-black text-rose-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>6. Risk Factors & Watchpoints</span>
              </h2>
              <div className="space-y-1.5">
                {intel.risk.map((r, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-rose-400 font-bold shrink-0">⚠️</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. TRACEABILITY SPANS */}
          {intel.sourceEvidence && intel.sourceEvidence.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 space-y-2 text-xxs font-mono text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider">
                <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Source Traceability Spans (Version {intel.intelligenceVersion})</span>
              </div>
              <div className="space-y-1 bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                {intel.sourceEvidence.map((span, idx) => (
                  <div key={idx} className="text-slate-400 italic">
                    • "{span}"
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
