import React, { useState, useEffect } from 'react';
import {
  X, ExternalLink, TrendingUp, TrendingDown,
  Activity, Clock, Sparkles, ShieldAlert,
  CheckCircle2, Layers, Zap, AlertTriangle,
  Gauge, Flame, ChevronDown, ChevronUp,
  UserCheck, HelpCircle, BarChart2, FileText
} from 'lucide-react';
import { TraderImpactEngine } from '../../news/intelligence/TraderImpactEngine.ts';
import {
  TraderIntelligence,
  ImpactDirection,
  ImpactMagnitude,
  RiskLevel,
  EvidenceClass,
  ObservedMarketReaction
} from '../../news/types/TraderIntelligence.ts';

interface TraderArticleDossierProps {
  article: any;
  onClose: () => void;
  onOpenOriginal?: () => void;
}

export function TraderArticleDossier({
  article,
  onClose,
  onOpenOriginal
}: TraderArticleDossierProps) {
  // Check F&O status
  const fullText = `${article?.title || article?.headline || ''} ${article?.summary || article?.content || ''}`.toLowerCase();
  const isFno = article?.isFno ||
    article?.category === 'FNO' ||
    article?.primaryCategory === 'FNO' ||
    /options|futures|strike|open interest|\boi\b|pcr|implied volatility|\biv\b|call option|put option|futures basis|rollover/i.test(fullText);

  // F&O news gets automatic intelligence; ordinary news requires explicit user click
  const [intelRequested, setIntelRequested] = useState<boolean>(isFno);
  const [intelligence, setIntelligence] = useState<TraderIntelligence | null>(null);
  const [canonicalSummary, setCanonicalSummary] = useState<any>(null);
  const [loadingIntel, setLoadingIntel] = useState<boolean>(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [showEvidenceDetails, setShowEvidenceDetails] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchCanonicalSummary() {
      if (!article?.id) return;
      try {
        const res = await fetch(`/api/v5/news/summary/article/${article.id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.summary) {
            setCanonicalSummary(data.summary);
          }
        }
      } catch (e) {}
    }
    fetchCanonicalSummary();
    return () => { isMounted = false; };
  }, [article?.id]);

  useEffect(() => {
    if (!intelRequested || intelligence) return;

    let isMounted = true;
    async function fetchIntelligence() {
      try {
        setLoadingIntel(true);
        setIntelError(null);
        if (article?.id) {
          const res = await fetch(`/api/v5/news/intelligence/article/${article.id}`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data.intelligence) {
              setIntelligence(data.intelligence);
              setLoadingIntel(false);
              return;
            }
          }
        }
      } catch (e: any) {
        // Fallback gracefully to deterministic client calculation if network fails
      }

      if (isMounted) {
        try {
          const transformed = TraderImpactEngine.transform(article);
          setIntelligence(transformed);
        } catch (err: any) {
          setIntelError(err?.message || 'Intelligence generation failed. Summary remains active.');
        }
        setLoadingIntel(false);
      }
    }

    fetchIntelligence();
    return () => {
      isMounted = false;
    };
  }, [intelRequested, article?.id]);

  const handleRequestIntelligence = () => {
    setIntelRequested(true);
  };

  const headline = article?.headline || article?.title || 'Market News Update';
  const summaryText = article?.summary || article?.description || article?.content || 'No summary available for this article.';
  const publisher = article?.source?.name || article?.source?.publisher || article?.publisher || 'Verified Market Wire';
  const publishedAt = article?.publishedAt ? new Date(article.publishedAt).toLocaleString() : 'Just now';

  const getImpactBadge = (dir: ImpactDirection) => {
    switch (dir) {
      case ImpactDirection.BULLISH:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 font-bold text-xs">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>BULLISH</span>
          </span>
        );
      case ImpactDirection.BEARISH:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-rose-950/90 border border-rose-500/40 text-rose-400 font-bold text-xs">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>BEARISH</span>
          </span>
        );
      case ImpactDirection.MIXED:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-amber-950/90 border border-amber-500/40 text-amber-400 font-bold text-xs">
            <Activity className="w-3.5 h-3.5" />
            <span>MIXED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs">
            <span>NEUTRAL</span>
          </span>
        );
    }
  };

  const getEvidenceQualityBadge = (rating?: string) => {
    const q = rating || 'MODERATE';
    if (q === 'HIGH') {
      return (
        <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> EVIDENCE QUALITY: HIGH
        </span>
      );
    }
    if (q === 'LOW' || q === 'INSUFFICIENT') {
      return (
        <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-950/90 border border-amber-500/40 text-amber-300 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-400" /> EVIDENCE QUALITY: {q}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-sky-950/90 border border-sky-500/40 text-sky-300 flex items-center gap-1">
        <Activity className="w-3 h-3 text-sky-400" /> EVIDENCE QUALITY: MODERATE
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-400">
                  ATHENA News Engine V7.3
                </span>
                {isFno && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/80 border border-purple-500/40 text-purple-300 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-purple-400" /> F&O PRIORITY
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {publisher} • {publishedAt}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenOriginal && (
              <button
                onClick={onOpenOriginal}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Open Source Article"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* Article Summary (Summary-First Layer) */}
          <div className="space-y-4 pb-4 border-b border-slate-800/80">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug">
              {headline}
            </h2>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 text-sm leading-relaxed space-y-3">
              <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" /> Canonical AI Summary
                </span>
                {canonicalSummary?.extractionQuality && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Quality: {canonicalSummary.extractionQuality} ({canonicalSummary.extractionMethod || 'Trafilatura'})
                  </span>
                )}
              </h4>
              <p className="text-slate-200 font-medium">{canonicalSummary?.summary || summaryText}</p>

              {canonicalSummary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-800/60">
                  {canonicalSummary.whatHappened && (
                    <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
                      <span className="font-bold text-indigo-300 block mb-0.5 text-[10px] uppercase">What Happened</span>
                      <p className="text-slate-300">{canonicalSummary.whatHappened}</p>
                    </div>
                  )}
                  {canonicalSummary.whyItMatters && (
                    <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
                      <span className="font-bold text-indigo-300 block mb-0.5 text-[10px] uppercase">Why It Matters</span>
                      <p className="text-slate-300">{canonicalSummary.whyItMatters}</p>
                    </div>
                  )}
                </div>
              )}

              {canonicalSummary?.importantNumbers && canonicalSummary.importantNumbers.length > 0 && (
                <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-2 text-xs">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 self-center">Key Numbers:</span>
                  {canonicalSummary.importantNumbers.map((num: any, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-mono text-[11px]">
                      {num.value} <span className="text-slate-400 text-[10px]">({num.context})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* On-Demand Intelligence Section */}
          {!intelRequested ? (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/30 via-slate-900/80 to-slate-950 border border-indigo-500/30 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">On-Demand Trader Intelligence</h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  Enrich this news article with evidence-grounded market impact evaluation, price reaction checks, and F&O derivatives positioning.
                </p>
              </div>
              <button
                onClick={handleRequestIntelligence}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 mx-auto"
              >
                <Zap className="w-4 h-4" />
                <span>Generate Trader Intelligence</span>
              </button>
            </div>
          ) : loadingIntel ? (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono text-slate-400">Evaluating Evidence & Generating Intelligence Dossier...</p>
            </div>
          ) : intelError ? (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{intelError}</span>
            </div>
          ) : intelligence ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Market Impact & Quality Overview */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getImpactBadge(intelligence.impactDirection)}
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono font-bold">
                      EVENT: {intelligence.eventType}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono">
                      REACTION: {intelligence.observedMarketReaction || ObservedMarketReaction.UNKNOWN}
                    </span>
                  </div>
                  {getEvidenceQualityBadge(intelligence.confidenceBreakdown?.rating)}
                </div>

                {/* Trader Context */}
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Trader Context
                  </h4>
                  {intelligence.takeawayStructure ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                        <span className="font-bold text-indigo-300 block mb-1 uppercase text-[10px]">1. Context</span>
                        <p className="text-slate-300 leading-relaxed">{intelligence.takeawayStructure.traderContext}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                        <span className="font-bold text-indigo-300 block mb-1 uppercase text-[10px]">2. Direction</span>
                        <p className="text-slate-300 leading-relaxed">{intelligence.takeawayStructure.marketDirection}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                        <span className="font-bold text-indigo-300 block mb-1 uppercase text-[10px]">3. Monitor</span>
                        <p className="text-slate-300 leading-relaxed">{intelligence.takeawayStructure.whatToMonitor}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-200 leading-relaxed">{intelligence.traderTakeaway}</p>
                  )}
                </div>

                {/* F&O Status */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">F&O Derivatives Status:</span>
                  <span className="font-bold text-purple-300">
                    {intelligence.fnoDetails?.fnoEvidencePresent
                      ? `Explicit Evidence (${intelligence.fnoDetails.detectedFnoMetrics.join(', ')}) • Bias: ${intelligence.cePeBias}`
                      : 'No derivatives evidence in source'}
                  </span>
                </div>
              </div>

              {/* Evidence Details Disclosure Toggle */}
              <div className="border-t border-slate-800 pt-4">
                <button
                  onClick={() => setShowEvidenceDetails(!showEvidenceDetails)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold font-mono text-slate-300 flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-indigo-400" />
                    <span>Evidence Details & Technical Factor Breakdown</span>
                  </span>
                  {showEvidenceDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showEvidenceDetails && (
                  <div className="mt-4 space-y-4 animate-in fade-in duration-200 text-xs">
                    {/* Entity Attribution */}
                    {intelligence.entityAttribution && (
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <h5 className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> Entity Attribution Matrix
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <span className="text-slate-500 block text-[10px]">Primary Entity</span>
                            <span className="font-bold text-slate-200">{intelligence.entityAttribution.primaryAffectedEntity.name}</span>
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <span className="text-slate-500 block text-[10px]">Brokerages</span>
                            <span className="font-semibold text-amber-300">
                              {intelligence.entityAttribution.analystsAndBrokerages.length ? intelligence.entityAttribution.analystsAndBrokerages.join(', ') : 'None'}
                            </span>
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <span className="text-slate-500 block text-[10px]">Regulators / Exchanges</span>
                            <span className="font-semibold text-sky-300">
                              {[...intelligence.entityAttribution.regulators, ...intelligence.entityAttribution.exchanges].join(', ') || 'None'}
                            </span>
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <span className="text-slate-500 block text-[10px]">Promoters</span>
                            <span className="font-semibold text-slate-300">
                              {intelligence.entityAttribution.promoters.join(', ') || 'None'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Evidence Model Items */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <h5 className="font-bold uppercase tracking-wider text-slate-400">Classified Evidence Items</h5>
                      <ul className="space-y-1.5">
                        {(intelligence.evidenceModel || []).map((ev, i) => (
                          <li key={i} className="text-slate-300 flex items-start gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 font-bold ${ev.classification === EvidenceClass.FACT ? 'bg-emerald-950 text-emerald-300' : 'bg-sky-950 text-sky-300'}`}>
                              {ev.classification}
                            </span>
                            <span>{ev.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Confidence Factor Breakdown */}
                    {intelligence.confidenceBreakdown && (
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 font-mono">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                          <span className="font-bold text-slate-300">Confidence Factor Math</span>
                          <span className="text-emerald-400 font-bold">{intelligence.confidenceBreakdown.totalScore}/100</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-slate-400">
                          <div>Source Authority: {intelligence.confidenceBreakdown.sourceAuthorityScore}/25</div>
                          <div>Entity Match: {intelligence.confidenceBreakdown.directEntityMatchScore}/25</div>
                          <div>Event Taxonomical: {intelligence.confidenceBreakdown.eventCertaintyScore}/20</div>
                          <div>Evidence Density: {intelligence.confidenceBreakdown.quantitativeEvidenceScore}/15</div>
                          <div>Market Reaction: {intelligence.confidenceBreakdown.marketReactionScore}/15</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 text-xs text-slate-400 font-mono shrink-0">
          <span>Engine: ATHENA News Stage 7.3</span>
          <span>Summary First • On-Demand Trader Intelligence</span>
        </div>
      </div>
    </div>
  );
}
