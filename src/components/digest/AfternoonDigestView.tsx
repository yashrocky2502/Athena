/**
 * ATHENA — Phase 21: Afternoon Digest View
 * AfternoonDigestView.tsx
 */

import React, { useState } from 'react';
import { 
  Zap, ArrowRight, TrendingDown, TrendingUp, AlertTriangle, 
  RotateCw, Copy, Check, Activity, ShieldCheck 
} from 'lucide-react';
import { AfternoonDigestData } from '../../news/digest/DigestTypes.ts';
import { DigestTelegramFormatter } from '../../news/digest/DigestTelegramFormatter.ts';

interface AfternoonDigestViewProps {
  data: AfternoonDigestData;
  onOpenEvidence?: () => void;
}

export default function AfternoonDigestView({ data, onOpenEvidence }: AfternoonDigestViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyTelegram = () => {
    const formatted = DigestTelegramFormatter.formatAfternoon(data);
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                ☀️ INTRADAY SHIFT &amp; DELTA
              </span>
              <span className="text-xs text-slate-400 font-mono">{data.date} (13:30 IST)</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{data.title}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTelegram}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
              <span>{copied ? 'Copied HTML' : 'Copy for Telegram'}</span>
            </button>
          </div>
        </div>

        {/* Live Forecast Verification Box */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Morning Forecast Alignment</span>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                data.morningForecastAccuracy.status === 'ACCURATE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                data.morningForecastAccuracy.status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {data.morningForecastAccuracy.status}
              </span>
            </div>
            {data.morningForecastAccuracy.divergenceExplanation && (
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                {data.morningForecastAccuracy.divergenceExplanation}
              </p>
            )}
          </div>

          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Nifty Intraday Delta</span>
            <div className="text-base font-bold font-mono text-rose-400">
              {data.morningVsCurrentDelta.niftyChangeSinceMorning > 0 ? '+' : ''}{data.morningVsCurrentDelta.niftyChangeSinceMorning}% since morning
            </div>
            <span className="text-[11px] text-slate-400">LTP: {data.liveMarketSnapshot.nifty.price.toLocaleString()}</span>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Bank Nifty Intraday Delta</span>
            <div className="text-base font-bold font-mono text-rose-400">
              {data.morningVsCurrentDelta.bankNiftyChangeSinceMorning > 0 ? '+' : ''}{data.morningVsCurrentDelta.bankNiftyChangeSinceMorning}% since morning
            </div>
            <span className="text-[11px] text-slate-400">LTP: {data.liveMarketSnapshot.bankNifty.price.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Delta Shifts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Material Intraday Shifts (Morning vs Current)
        </h3>
        <div className="space-y-3">
          {data.morningVsCurrentDelta.deltaItems.map((item, idx) => (
            <div key={idx} className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-100">{item.metric}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                    item.significance === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                    item.significance === 'HIGH' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {item.significance}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{item.interpretation}</p>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center font-mono">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Morning</span>
                  <span className="text-xs text-slate-300">{item.morningValue}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Current</span>
                  <span className="text-xs font-bold text-slate-100">{item.currentValue}</span>
                </div>
                <div className="px-2 py-1 rounded bg-slate-800 font-bold text-xs text-amber-300 ml-1">
                  {item.deltaPctOrAbs}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sector Rotations & Unusual Vol/OI Spikes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sector Rotations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            🔄 Sector Rating Shifts Since Morning
          </h3>
          <div className="space-y-2.5">
            {data.morningVsCurrentDelta.sectorRotations.map((sec) => (
              <div key={sec.sector} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-200">{sec.sector}</span>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{sec.morningOutlook}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      sec.currentOutlook === 'POSITIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                      sec.currentOutlook === 'NEGATIVE' ? 'bg-rose-500/20 text-rose-300' :
                      'bg-amber-500/20 text-amber-300'
                    }`}>{sec.currentOutlook}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{sec.shiftReason}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Unusual Vol & OI Spikes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            🚨 Intraday Volume &amp; OI Anomalies
          </h3>
          <div className="space-y-2.5">
            {data.morningVsCurrentDelta.unusualVolumeOiSpikes.map((anom) => (
              <div key={anom.symbol} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white font-mono block">{anom.symbol}</span>
                  <span className="text-[11px] text-amber-400 font-medium">{anom.anomalyType.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs text-slate-200 font-bold block">{anom.rvol}x Relative Vol</span>
                  <span className="text-[11px] text-indigo-400">OI: {anom.oiChangePct > 0 ? '+' : ''}{anom.oiChangePct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
