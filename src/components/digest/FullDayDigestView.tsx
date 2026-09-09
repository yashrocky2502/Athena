/**
 * ATHENA — Phase 21: Full Day Digest View
 * FullDayDigestView.tsx
 */

import React, { useState } from 'react';
import { 
  BookOpen, CheckCircle2, Flame, Award, Globe, 
  ShieldCheck, Copy, Check, Sparkles, AlertTriangle 
} from 'lucide-react';
import { FullDayDigestData } from '../../news/digest/DigestTypes.ts';
import { DigestTelegramFormatter } from '../../news/digest/DigestTelegramFormatter.ts';
import TomorrowWatchlistCard from './TomorrowWatchlistCard.tsx';

interface FullDayDigestViewProps {
  data: FullDayDigestData;
  onOpenEvidence?: () => void;
}

export default function FullDayDigestView({ data, onOpenEvidence }: FullDayDigestViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyTelegram = () => {
    const formatted = DigestTelegramFormatter.formatFullDay(data);
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                📚 DAILY RECONSTRUCTION CHRONICLE
              </span>
              <span className="text-xs text-slate-400 font-mono">{data.date} (Full Session)</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{data.title}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTelegram}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
              <span>{copied ? 'Copied HTML' : 'Copy for Telegram'}</span>
            </button>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <p className="text-sm text-slate-200 leading-relaxed font-sans">
            {data.executiveSummary}
          </p>
        </div>
      </div>

      {/* Top 5 Market-Moving Catalysts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          Top Market-Moving Catalysts of the Day
        </h3>
        <div className="space-y-3">
          {data.top5MarketMovingCatalysts.map((cat) => (
            <div key={cat.rank} className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-3.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono font-bold flex items-center justify-center text-sm shrink-0">
                #{cat.rank}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-xs font-bold text-slate-100">{cat.headline}</h4>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold shrink-0">
                    {cat.confidence}% Conf.
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-2">{cat.impactDescription}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-mono">Affected:</span>
                  {cat.affectedSectors.map((sec) => (
                    <span key={sec} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Intraday Evolution Story & Signal Scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Intraday Chronicle */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-sky-400" />
            Intraday Evolution Narrative
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            {data.intradayEvolutionStory}
          </p>

          <div className="p-3.5 rounded-lg bg-indigo-950/20 border border-indigo-500/30">
            <span className="text-[10px] font-mono font-bold uppercase text-indigo-400 block mb-1">
              ⭐ Pivot Event of the Day
            </span>
            <p className="text-xs font-semibold text-indigo-200">
              {data.mostImportantEventOfTheDay}
            </p>
          </div>
        </div>

        {/* Athena Signal Scorecard */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ATHENA Signal Scorecard
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-2xl font-bold font-mono text-emerald-400 block">
                {data.athenaSignalsScorecard.winRatePct}%
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Daily Signal Accuracy</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Generated</span>
                <span className="font-bold text-slate-200">{data.athenaSignalsScorecard.signalsGenerated}</span>
              </div>
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 block text-[10px]">Confirmed</span>
                <span className="font-bold text-emerald-300">{data.athenaSignalsScorecard.signalsConfirmed}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Takeaways */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Institutional Strategic Takeaways
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-xs font-bold text-indigo-400 font-mono block mb-1">01. Key Level Defense</span>
            <p className="text-xs text-slate-300 leading-relaxed">{data.athenaDailyConclusion.keyTakeaway1}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-xs font-bold text-indigo-400 font-mono block mb-1">02. Tactical Allocation</span>
            <p className="text-xs text-slate-300 leading-relaxed">{data.athenaDailyConclusion.keyTakeaway2}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-xs font-bold text-indigo-400 font-mono block mb-1">03. Flow Catalyst Pivot</span>
            <p className="text-xs text-slate-300 leading-relaxed">{data.athenaDailyConclusion.keyTakeaway3}</p>
          </div>
        </div>
      </div>

      {/* Tomorrow Watchlist Card */}
      <TomorrowWatchlistCard items={data.tomorrowWatchlist} />
    </div>
  );
}
