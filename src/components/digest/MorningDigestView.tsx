/**
 * ATHENA — Phase 21: Morning Digest View
 * MorningDigestView.tsx
 */

import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, Globe, Flame, ShieldAlert, 
  Layers, ArrowUpRight, ArrowDownRight, CheckCircle2, 
  ExternalLink, Copy, Check, Info, Sparkles 
} from 'lucide-react';
import { MorningDigestData } from '../../news/digest/DigestTypes.ts';
import { DigestTelegramFormatter } from '../../news/digest/DigestTelegramFormatter.ts';

interface MorningDigestViewProps {
  data: MorningDigestData;
  onOpenEvidence?: () => void;
}

export default function MorningDigestView({ data, onOpenEvidence }: MorningDigestViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyTelegram = () => {
    const formatted = DigestTelegramFormatter.formatMorning(data);
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Assessment */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                🌅 PRE-MARKET BRIEF
              </span>
              <span className="text-xs text-slate-400 font-mono">{data.date}</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{data.title}</h2>
          </div>

          <div className="flex items-center gap-2 self-stretch lg:self-auto">
            <button
              onClick={handleCopyTelegram}
              className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
              title="Copy formatted message for Telegram"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
              <span>{copied ? 'Copied HTML' : 'Copy for Telegram'}</span>
            </button>
          </div>
        </div>

        {/* Strategic Assessment Box */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Athena Market Bias</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${
                data.athenaAssessment.bias.includes('BULLISH') ? 'bg-emerald-400' :
                data.athenaAssessment.bias.includes('BEARISH') || data.athenaAssessment.bias.includes('RISK_OFF') ? 'bg-rose-400' :
                'bg-amber-400'
              }`} />
              <span className="text-sm font-bold text-slate-100">
                {data.athenaAssessment.bias.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Confidence Score</span>
            <div className="text-sm font-bold text-emerald-400 font-mono">
              {data.athenaAssessment.confidenceScore}% Validated
            </div>
          </div>

          <div className="md:col-span-2 p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Institutional Consensus</span>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
              {data.athenaAssessment.institutionalConclusion}
            </p>
          </div>
        </div>
      </div>

      {/* Snapshot Cards Grid: Indices + Global + Macro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Indian Indices */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Key Index Futures & Cues
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">{data.marketSnapshot.nifty.name}</span>
                <span className="text-[11px] font-mono text-slate-400">Gift Nifty: {data.marketSnapshot.giftNifty.price} ({data.marketSnapshot.giftNifty.changePct}%)</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-slate-100 font-mono block">{data.marketSnapshot.nifty.price.toLocaleString()}</span>
                <span className={`text-xs font-mono font-semibold ${data.marketSnapshot.nifty.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data.marketSnapshot.nifty.changePct >= 0 ? '+' : ''}{data.marketSnapshot.nifty.changePct}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">{data.marketSnapshot.bankNifty.name}</span>
                <span className="text-[11px] font-mono text-slate-400">High Beta Driver</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-slate-100 font-mono block">{data.marketSnapshot.bankNifty.price.toLocaleString()}</span>
                <span className={`text-xs font-mono font-semibold ${data.marketSnapshot.bankNifty.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data.marketSnapshot.bankNifty.changePct >= 0 ? '+' : ''}{data.marketSnapshot.bankNifty.changePct}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 text-xs">
              <span className="text-slate-400">India VIX</span>
              <span className="font-mono font-bold text-amber-300">{data.marketSnapshot.indiaVix.value} ({data.marketSnapshot.indiaVix.changePct > 0 ? '+' : ''}{data.marketSnapshot.indiaVix.changePct}%)</span>
            </div>
          </div>
        </div>

        {/* Global Markets */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-sky-400" />
            Global Equities Overnight
          </h3>
          <div className="space-y-2">
            {data.globalMarkets.map((gm) => (
              <div key={gm.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">{gm.name}</span>
                  <span className="text-[10px] text-slate-500">{gm.region}</span>
                </div>
                <span className={`text-xs font-mono font-bold ${gm.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {gm.changePct >= 0 ? '+' : ''}{gm.changePct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Macro & Commodities */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" />
            Macro, FX & Commodities
          </h3>
          <div className="space-y-2">
            {data.macroCommodities.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">{item.name}</span>
                  <span className="text-[10px] text-slate-500">{item.commentary}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-100 block">{item.value}</span>
                  <span className={`text-[10px] font-mono font-semibold ${item.impactOnIndia === 'POSITIVE' ? 'text-emerald-400' : item.impactOnIndia === 'NEGATIVE' ? 'text-rose-400' : 'text-slate-400'}`}>
                    {item.changePct >= 0 ? '+' : ''}{item.changePct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stocks in Focus & Sector Outlook */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stocks in Focus */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            🎯 Stocks in Focus (Pre-Market)
          </h3>
          <div className="space-y-2.5">
            {data.stocksInFocus.map((stk) => (
              <div key={stk.symbol} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white font-mono">{stk.symbol}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                      stk.classification === 'POSITIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                      stk.classification === 'NEGATIVE' ? 'bg-rose-500/20 text-rose-300' :
                      'bg-amber-500/20 text-amber-300'
                    }`}>
                      {stk.classification}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{stk.driver}</p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs text-slate-200 block">₹{stk.price}</span>
                  <span className={`text-xs font-bold ${stk.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stk.changePct >= 0 ? '+' : ''}{stk.changePct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sector Outlook Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            📊 Sector Tactical Outlook
          </h3>
          <div className="space-y-2.5">
            {data.sectorOutlook.map((sec) => (
              <div key={sec.sector} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-200">{sec.sector}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    sec.outlook === 'POSITIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                    sec.outlook === 'NEGATIVE' ? 'bg-rose-500/20 text-rose-300' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {sec.outlook}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mb-1">
                  <span className="text-slate-500">Catalysts: </span>
                  {sec.catalysts.join(' • ')}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500">Top Picks: </span>
                  {sec.topPicks.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Technical Support & Resistance Levels */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          📐 Technical Key Levels & Max Pain
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.technicalPivots.map((p) => (
            <div key={p.indexOrStock} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-300 font-mono">{p.indexOrStock}</span>
                <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                  Trend: {p.trendState}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20">
                  <span className="text-[10px] text-rose-400 block">S1</span>
                  <span className="font-bold text-slate-100">{p.support1}</span>
                </div>
                <div className="p-2 rounded bg-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Pivot</span>
                  <span className="font-bold text-slate-100">{p.pivot}</span>
                </div>
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-400 block">R1</span>
                  <span className="font-bold text-slate-100">{p.resistance1}</span>
                </div>
                <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-[10px] text-indigo-400 block">Max Pain</span>
                  <span className="font-bold text-slate-100">{p.maxPainStrike}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
