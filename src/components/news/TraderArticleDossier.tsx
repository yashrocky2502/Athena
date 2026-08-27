import React, { useState, useEffect } from 'react';
import {
  X, ExternalLink, TrendingUp, TrendingDown,
  Activity, Clock, Sparkles, ShieldAlert,
  CheckCircle2, Layers, Zap, AlertTriangle,
  Gauge, Flame, ChevronDown, ChevronUp,
  UserCheck, HelpCircle, BarChart2, FileText,
  Compass, Shield, Target
} from 'lucide-react';
import { TraderImpactEngine } from '../../news/intelligence/TraderImpactEngine.ts';
import { TraderDecisionEngine, TraderDecisionDossier } from '../../news/intelligence/TraderDecisionEngine.ts';
import {
  TraderIntelligence,
  ImpactDirection,
  ImpactMagnitude,
  RiskLevel,
  EvidenceClass,
  ObservedMarketReaction
} from '../../news/types/TraderIntelligence.ts';
import { CanonicalNewsSummaryEngine } from '../../newsCoreV2/summary/CanonicalNewsSummaryEngine.ts';

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
  const [decisionDossier, setDecisionDossier] = useState<TraderDecisionDossier | null>(null);
  const [canonicalSummary, setCanonicalSummary] = useState<any>(() => {
    if (!article) return null;
    try {
      return CanonicalNewsSummaryEngine.getInstance().generateDeterministicSummary(article);
    } catch (e) {
      return null;
    }
  });
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
          const [intelRes, decRes] = await Promise.all([
            fetch(`/api/v5/news/intelligence/article/${article.id}`).catch(() => null),
            fetch(`/api/v5/news/intelligence/decision/${article.id}`).catch(() => null)
          ]);

          if (decRes && decRes.ok) {
            const decData = await decRes.json();
            if (isMounted && decData.decision) {
              setDecisionDossier(decData.decision);
            }
          }

          if (intelRes && intelRes.ok) {
            const data = await intelRes.json();
            if (isMounted && data.intelligence) {
              setIntelligence(data.intelligence);
              if (!decisionDossier) {
                try {
                  const fallbackDec = TraderDecisionEngine.evaluateTraderDecision(article);
                  setDecisionDossier(fallbackDec);
                } catch (e) {}
              }
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
          const fallbackDec = TraderDecisionEngine.evaluateTraderDecision(article);
          setDecisionDossier(fallbackDec);
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
              {canonicalSummary && (
                canonicalSummary.summaryStatus === 'SOURCE_UNAVAILABLE' ||
                canonicalSummary.summaryStatus === 'EXTRACTION_FAILED' ||
                canonicalSummary.summaryStatus === 'QUALITY_REJECTED' ||
                canonicalSummary.summary === null
              ) ? (
                <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20 text-rose-400 font-medium flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-slate-300">Summary unavailable — Open original source</span>
                  {article?.url && (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 text-xs font-bold transition-all border border-slate-700"
                    >
                      <span>Open Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-slate-200 font-medium">{canonicalSummary?.summary || summaryText}</p>
              )}

              {canonicalSummary && 
               canonicalSummary.summaryStatus !== 'SOURCE_UNAVAILABLE' && 
               canonicalSummary.summaryStatus !== 'EXTRACTION_FAILED' && 
               canonicalSummary.summaryStatus !== 'QUALITY_REJECTED' && (
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

              {canonicalSummary && 
               canonicalSummary.summaryStatus !== 'SOURCE_UNAVAILABLE' && 
               canonicalSummary.summaryStatus !== 'EXTRACTION_FAILED' && 
               canonicalSummary.summaryStatus !== 'QUALITY_REJECTED' && 
               canonicalSummary?.importantNumbers && 
               canonicalSummary.importantNumbers.length > 0 && (
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
          ) : decisionDossier ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Primary Decision Banner */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {decisionDossier.tradeability === 'TRADEABLE' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold text-xs shadow-md shadow-emerald-950/50">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>🟢 TRADEABLE</span>
                      </span>
                    ) : decisionDossier.tradeability === 'WATCH' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950 border border-amber-500 text-amber-300 font-bold text-xs shadow-md shadow-amber-950/50">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>🟡 WATCH</span>
                      </span>
                    ) : decisionDossier.tradeability === 'INSUFFICIENT_EVIDENCE' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-950 border border-rose-500 text-rose-300 font-bold text-xs shadow-md shadow-rose-950/50">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span>🔴 INSUFFICIENT EVIDENCE</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>⚪ NO TRADE</span>
                      </span>
                    )}

                    <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 text-xs font-mono font-bold">
                      CONFIRMED: {decisionDossier.confirmedDirection}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono">
                      HORIZON: {decisionDossier.horizon}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <div className="px-2.5 py-1 rounded bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                      Decision Conf: <span className="font-bold text-indigo-200">{decisionDossier.decisionConfidence}%</span>
                    </div>
                    <div className="px-2.5 py-1 rounded bg-slate-800 text-slate-400">
                      Source Conf: <span className="font-bold text-slate-200">{decisionDossier.sourceConfidence}%</span>
                    </div>
                  </div>
                </div>

                {/* Decision Summary Text */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" /> ATHENA Algorithmic Inference
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                      MODEL INFERENCE
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                    {decisionDossier.decision}
                  </p>
                </div>

                {/* Profiles & Priced In Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                  <span className="text-slate-400 text-[11px]">Relevant Profiles:</span>
                  {decisionDossier.traderProfiles.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-mono">
                      {p}
                    </span>
                  ))}
                  <span className="ml-auto text-[11px] font-mono text-slate-400">
                    Priced-in: <strong className="text-slate-200">{decisionDossier.pricedInStatus}</strong>
                  </span>
                </div>
              </div>

              {/* Actionable Options Seller Playbook Card */}
              <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      Options Seller Playbook
                    </h4>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-purple-900/60 border border-purple-400/40 text-purple-200 font-bold font-mono text-xs">
                    STRATEGY: {decisionDossier.optionsSellerPlaybook.strategy}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-purple-500/20 space-y-1">
                    <span className="font-bold text-emerald-400 block text-[10px] uppercase">Entry Condition & Trigger</span>
                    <p className="text-slate-300 leading-relaxed">{decisionDossier.optionsSellerPlaybook.entryCondition}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-purple-500/20 space-y-1">
                    <span className="font-bold text-rose-400 block text-[10px] uppercase">Avoid Condition</span>
                    <p className="text-slate-300 leading-relaxed">{decisionDossier.optionsSellerPlaybook.avoidCondition}</p>
                  </div>
                </div>

                {/* Strikes & Metrics (Strict Non-Fabrication) */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-center">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Strike Level</span>
                    <span className="font-bold text-slate-200">{decisionDossier.optionsSellerPlaybook.strike}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Implied Volatility</span>
                    <span className="font-bold text-slate-200">{decisionDossier.optionsSellerPlaybook.iv}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Put-Call Ratio</span>
                    <span className="font-bold text-slate-200">{decisionDossier.optionsSellerPlaybook.pcr}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Support / Res</span>
                    <span className="font-bold text-slate-200">{decisionDossier.optionsSellerPlaybook.supportLevel} / {decisionDossier.optionsSellerPlaybook.resistanceLevel}</span>
                  </div>
                </div>
              </div>

              {/* Market, Volume & F&O Confirmation Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">1. Price Reaction</span>
                  <div className="font-mono text-sm font-bold text-slate-100">
                    {decisionDossier.marketConfirmation.priceChange !== undefined
                      ? `${decisionDossier.marketConfirmation.priceChange >= 0 ? '+' : ''}${decisionDossier.marketConfirmation.priceChange}% (${decisionDossier.marketConfirmation.reactionDirection})`
                      : 'N/A'}
                  </div>
                  <p className="text-slate-400 text-[11px]">{decisionDossier.marketConfirmation.interpretation}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">2. Volume Confirmation</span>
                  <div className="font-mono text-sm font-bold text-slate-100">
                    {decisionDossier.volumeConfirmation.status === 'AVAILABLE'
                      ? `${decisionDossier.volumeConfirmation.confirmationStatus} (${decisionDossier.volumeConfirmation.volumeRatio}x)`
                      : 'NOT_AVAILABLE'}
                  </div>
                  <p className="text-slate-400 text-[11px]">{decisionDossier.volumeConfirmation.interpretation}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">3. F&O Positioning</span>
                  <div className="font-mono text-sm font-bold text-slate-100">
                    {decisionDossier.fnoConfirmation.classification}
                  </div>
                  <p className="text-slate-400 text-[11px]">{decisionDossier.fnoConfirmation.interpretation}</p>
                </div>
              </div>

              {/* Risk Engine Assessment */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> Risk Engine Evaluation
                  </span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${decisionDossier.risk.level === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-500' : decisionDossier.risk.level === 'HIGH' ? 'bg-amber-950 text-amber-300 border border-amber-500' : 'bg-slate-800 text-slate-300'}`}>
                    LEVEL: {decisionDossier.risk.level}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{decisionDossier.risk.primaryRisk}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {decisionDossier.risk.categories.map((c, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
                      {c}
                    </span>
                  ))}
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
                    <span>Structured Evidence & Invalidation Criteria ({decisionDossier.evidence.length} items)</span>
                  </span>
                  {showEvidenceDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showEvidenceDetails && (
                  <div className="mt-4 space-y-4 animate-in fade-in duration-200 text-xs">
                    {/* Triggers & Invalidation */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <h5 className="font-bold uppercase tracking-wider text-slate-300">Trigger Conditions & Thesis Invalidation</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div>
                          <span className="text-emerald-400 font-bold block mb-1 text-[11px]">Triggers</span>
                          <ul className="space-y-1 text-slate-300">
                            {decisionDossier.triggerConditions.map((t, i) => (
                              <li key={i}>• {t}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-rose-400 font-bold block mb-1 text-[11px]">Invalidation</span>
                          <ul className="space-y-1 text-slate-300">
                            {decisionDossier.invalidationConditions.map((inv, i) => (
                              <li key={i}>• {inv}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Structured Evidence Items */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <h5 className="font-bold uppercase tracking-wider text-slate-400">Classified Evidence Items</h5>
                      <ul className="space-y-1.5">
                        {decisionDossier.evidence.map((ev, i) => (
                          <li key={i} className="text-slate-300 flex items-start gap-2 p-2 rounded bg-slate-900/60 border border-slate-800/80">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                              {ev.type}
                            </span>
                            <span className="flex-1">{ev.statement}</span>
                            <span className="font-mono text-slate-400 text-[10px] shrink-0">{ev.confidence}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
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
