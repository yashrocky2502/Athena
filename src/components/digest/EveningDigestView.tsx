/**
 * ATHENA — Phase 21: Evening Digest View
 * EveningDigestView.tsx
 */

import React, { useState } from 'react';
import { 
  CheckCircle2, TrendingDown, TrendingUp, Copy, Check, 
  BarChart3, Award, Calendar, Layers, ShieldCheck 
} from 'lucide-react';
import { EveningDigestData } from '../../news/digest/DigestTypes.ts';
import { DigestTelegramFormatter } from '../../news/digest/DigestTelegramFormatter.ts';
import TomorrowWatchlistCard from './TomorrowWatchlistCard.tsx';

interface EveningDigestViewProps {
  data: EveningDigestData;
  onOpenEvidence?: () => void;
}

export default function EveningDigestView({ data, onOpenEvidence }: EveningDigestViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyTelegram = () => {
    const formatted = DigestTelegramFormatter.formatEvening(data);
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
                🌆 EVENING CLOSING REPORT
              </span>
              <span className="text-xs text-slate-400 font-mono">{data.date} (16:30 IST)</span>
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

        {/* Closing Verification Box */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Morning vs Actual Accuracy</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold font-mono text-emerald-300">
                {data.morningVsActualComparison.accuracyRating.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
              {data.morningVsActualComparison.actualOutcome}
            </p>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">FII Net Cash Activity</span>
            <div className="text-sm font-bold font-mono text-rose-400">
              ₹{data.institutionalCashSummary.fiiNetCr.toLocaleString()} Cr
            </div>
            <span className="text-[10px] text-slate-400">DII: +₹{data.institutionalCashSummary.diiNetCr.toLocaleString()} Cr</span>
          </div>

          <div className="md:col-span-2 p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Athena Closing Takeaway</span>
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
              {data.athenaAssessment.institutionalConclusion}
            </p>
          </div>
        </div>
      </div>

      {/* Closing Indices & Breadth */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">{data.closingSnapshot.nifty.name}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">{data.closingSnapshot.nifty.price.toLocaleString()}</span>
            <span className={`text-xs font-bold font-mono ${data.closingSnapshot.nifty.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.closingSnapshot.nifty.changePct >= 0 ? '+' : ''}{data.closingSnapshot.nifty.changePct}%
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 font-mono flex justify-between">
            <span>High: {data.closingSnapshot.nifty.high}</span>
            <span>Low: {data.closingSnapshot.nifty.low}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">{data.closingSnapshot.bankNifty.name}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">{data.closingSnapshot.bankNifty.price.toLocaleString()}</span>
            <span className={`text-xs font-bold font-mono ${data.closingSnapshot.bankNifty.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.closingSnapshot.bankNifty.changePct >= 0 ? '+' : ''}{data.closingSnapshot.bankNifty.changePct}%
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 font-mono flex justify-between">
            <span>High: {data.closingSnapshot.bankNifty.high}</span>
            <span>Low: {data.closingSnapshot.bankNifty.low}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Market Breadth &amp; VIX</span>
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-xs font-mono">
              <span className="text-emerald-400 font-bold">{data.closingSnapshot.advances} Adv</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-rose-400 font-bold">{data.closingSnapshot.declines} Dec</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-300">VIX: {data.closingSnapshot.indiaVix.value}</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
            <div 
              className="bg-emerald-500 h-full" 
              style={{ width: `${(data.closingSnapshot.advances / (data.closingSnapshot.advances + data.closingSnapshot.declines)) * 100}%` }} 
            />
            <div 
              className="bg-rose-500 h-full" 
              style={{ width: `${(data.closingSnapshot.declines / (data.closingSnapshot.advances + data.closingSnapshot.declines)) * 100}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Sector Leaderboard & Top Gainers/Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sector Performance Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-indigo-400" />
            Official Sector Leaderboard
          </h3>
          <div className="space-y-2">
            {data.sectorPerformanceTable.map((s) => (
              <div key={s.sector} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold">#{s.rank}</span>
                  <span className="text-slate-200 font-semibold">{s.sector}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 hidden sm:inline">Leader: {s.leader}</span>
                  <span className={`font-bold ${s.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {s.changePct >= 0 ? '+' : ''}{s.changePct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Gainers & Losers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Top Movers & Attribution
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Gainers */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 block mb-1">Top Gainers</span>
              {data.topGainersAndLosers.gainers.slice(0, 3).map((g) => (
                <div key={g.symbol} className="p-2 rounded bg-slate-950/70 border border-slate-800">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="font-bold text-slate-200">{g.symbol}</span>
                    <span className="text-emerald-400 font-bold">+{g.changePct}%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{g.driver}</p>
                </div>
              ))}
            </div>

            {/* Losers */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-rose-400 block mb-1">Top Laggards</span>
              {data.topGainersAndLosers.losers.slice(0, 3).map((l) => (
                <div key={l.symbol} className="p-2 rounded bg-slate-950/70 border border-slate-800">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="font-bold text-slate-200">{l.symbol}</span>
                    <span className="text-rose-400 font-bold">{l.changePct}%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{l.driver}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tomorrow Watchlist Card */}
      <TomorrowWatchlistCard items={data.tomorrowWatchlist} />
    </div>
  );
}
