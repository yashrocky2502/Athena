import React, { useState } from "react";
import { ChevronDown, ChevronUp, Bell, Share2, Save, FileText, UserPlus, MessageSquare, Zap, ExternalLink } from "lucide-react";
import { AthenaAlert } from "../types";
import { AthenaSummaryPage } from "./news/AthenaSummaryPage";

interface IntelligenceCardProps {
  key?: React.Key;
  alert: AthenaAlert;
  explanation: string;
}

const INVALID_PHRASES = [
  "strategic business evolution",
  "monitor price action",
  "significant operational shift",
  "none",
  "n/a",
  "not applicable",
  "no data"
];

function isMeaningful(text?: string | string[]): boolean {
  if (!text) return false;
  if (Array.isArray(text)) return text.length > 0 && text.some(t => isMeaningful(t));
  const normalized = text.toLowerCase().trim();
  return normalized !== "" && !INVALID_PHRASES.includes(normalized);
}

function cleanText(text?: string): string | null {
  if (!text || !isMeaningful(text)) return null;
  return text;
}

export default function IntelligenceCard({ alert, explanation }: IntelligenceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const hasBullCase = isMeaningful(alert.bullCase);
  const hasBearCase = isMeaningful(alert.bearCase);
  const hasBeneficiaries = isMeaningful(alert.topBeneficiaries);
  const hasCompaniesToWatch = isMeaningful(alert.relatedCompanies);
  const hasMarketImpact = isMeaningful(alert.marketImpactDesc || alert.immediateMarketImpact);

  const displayHorizon = cleanText(alert.timeHorizon);
  const displayFocus = cleanText(alert.investorFocus);

  // Filter out developer-only confidence scores if they are effectively zero
  const showReliability = (alert.sourceReliabilityScore ?? 0) > 0;
  const showDetection = (alert.detectionConfidence ?? 0) > 0;
  const showImpactConf = (alert.impactConfidence ?? 0) > 0;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col transition-all duration-500 ${expanded ? "ring-2 ring-indigo-500/30 shadow-2xl shadow-indigo-500/10" : "hover:border-slate-700"}`}>
      {/* Institutional Header */}
      <div className="bg-slate-950/50 px-6 py-4 border-b border-slate-800 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${alert.impact === 'Positive' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : alert.impact === 'Negative' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-slate-500'}`} />
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{alert.type}</span>
          </div>
          <span className="text-[10px] font-medium text-slate-500">
            {new Date(alert.timestamp).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata"
            })} IST
          </span>
        </div>
        <h3 className="font-bold text-white text-xl leading-tight tracking-tight">{alert.title}</h3>
        
        {/* Entity Tags */}
        {alert.companies && alert.companies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {alert.companies.map(c => (
              <span key={c} className="bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-900/40 text-indigo-300 font-bold text-[10px]">
                {c}
              </span>
            ))}
            {displayHorizon && (
              <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400 font-bold text-[10px]">
                {displayHorizon}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col gap-6">
        {/* Quick Summary */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <FileText size={12} className="text-indigo-500" />
            Quick Summary
          </h4>
          <p className="text-[15px] text-slate-200 leading-relaxed font-medium">
            {alert.headline || alert.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* What Happened */}
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">What Happened</h4>
            <p className="text-sm text-slate-400 leading-relaxed italic border-l-2 border-slate-800 pl-4">
              {alert.whatHappened || alert.description}
            </p>
          </div>

          {/* Why It Matters */}
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Why It Matters</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              {alert.whyItMatters}
            </p>
          </div>
        </div>

        {/* Actionable Insight */}
        <div className="bg-indigo-950/20 rounded-xl border border-indigo-900/30 p-4">
          <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Investor Takeaway</h4>
          <p className="text-sm text-indigo-100/90 leading-relaxed font-semibold">
            {alert.investorTakeaway}
          </p>
        </div>

        {/* Detailed Sections (Expandable) */}
        {expanded && (
          <div className="flex flex-col gap-8 animate-in slide-in-from-top-2 duration-300">
            {/* Bull / Bear Analysis */}
            {(hasBullCase || hasBearCase) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {hasBullCase && (
                  <div className="bg-emerald-950/10 p-4 rounded-xl border border-emerald-900/20">
                    <h4 className="text-[11px] font-bold text-emerald-400 uppercase mb-3 flex items-center gap-2">
                      <ChevronUp size={14} />
                      Bull Case
                    </h4>
                    <ul className="text-[13px] text-emerald-100/80 space-y-2">
                      {alert.bullCase?.filter(isMeaningful).map((c, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-emerald-500 mt-1">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {hasBearCase && (
                  <div className="bg-rose-950/10 p-4 rounded-xl border border-rose-900/20">
                    <h4 className="text-[11px] font-bold text-rose-400 uppercase mb-3 flex items-center gap-2">
                      <ChevronDown size={14} />
                      Bear Case
                    </h4>
                    <ul className="text-[13px] text-rose-100/80 space-y-2">
                      {alert.bearCase?.filter(isMeaningful).map((c, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-rose-500 mt-1">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Impact Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {hasMarketImpact && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Market Impact</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {alert.marketImpactDesc || alert.immediateMarketImpact}
                  </p>
                </div>
              )}
              {hasCompaniesToWatch && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Companies to Watch</h4>
                  <div className="flex flex-wrap gap-2">
                    {alert.relatedCompanies.filter(isMeaningful).map(c => (
                      <span key={c} className="text-xs bg-slate-950 text-slate-300 px-3 py-1 rounded-full border border-slate-800">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Beneficiaries */}
            {hasBeneficiaries && (
              <div className="flex flex-col gap-3">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Primary Beneficiaries</h4>
                <div className="flex flex-wrap gap-2">
                  {alert.topBeneficiaries?.filter(isMeaningful).map(c => (
                    <div key={c} className="bg-indigo-950/10 px-4 py-2 rounded-lg border border-indigo-900/20 flex flex-col">
                      <span className="text-sm font-bold text-indigo-300">{c}</span>
                      <span className="text-[9px] text-indigo-500/70 font-bold uppercase mt-0.5 tracking-tighter">Strategic Exposure</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source & Verification (Internal Metadata Cleanup) */}
            <div className="flex flex-col md:flex-row justify-between gap-4 pt-4 border-t border-slate-800/50 mt-4">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Source Integrity</span>
                {alert.originalSources && alert.originalSources.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-indigo-400 font-semibold underline decoration-indigo-500/30 underline-offset-4">
                      {typeof alert.originalSources[0] === 'string' ? alert.originalSources[0] : (alert.originalSources[0] as any).title}
                    </span>
                    <span className="text-[10px] text-slate-600 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      Primary Verification
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-600 italic">Institutional consensus feed</span>
                )}
              </div>
              
              {(showReliability || showDetection || showImpactConf) && (
                <div className="flex gap-4">
                  {showReliability && (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Reliability</span>
                      <span className="text-xs font-bold text-slate-300">{alert.sourceReliabilityScore}%</span>
                    </div>
                  )}
                  {showDetection && (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Confidence</span>
                      <span className="text-xs font-bold text-slate-300">{alert.detectionConfidence}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="bg-slate-950/30 px-6 py-4 border-t border-slate-800 flex flex-wrap justify-between items-center gap-3">
        <div className="flex gap-3 items-center">
          <button className="text-slate-500 hover:text-indigo-400 transition-colors p-1" title="Save to Portfolio">
            <Save size={18} />
          </button>
          <button className="text-slate-500 hover:text-indigo-400 transition-colors p-1" title="Share Briefing">
            <Share2 size={18} />
          </button>
          <button className="text-slate-500 hover:text-indigo-400 transition-colors p-1" title="Add to Watchlist">
            <UserPlus size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSummaryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Zap size={14} className="text-yellow-300 animate-pulse" />
            <span>ATHENA V10 Summary</span>
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-all group"
          >
            {expanded ? "Collapse Details" : "View Details"}
            <div className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>
              <ChevronDown size={16} />
            </div>
          </button>
        </div>
      </div>

      {showSummaryModal && (
        <AthenaSummaryPage
          article={{
            id: alert.id,
            title: alert.title || alert.headline || "Market Alert",
            publisher: "ATHENA Intelligence Network",
            publishedAt: alert.timestamp || new Date().toISOString(),
            url: "#",
            summary: alert.description || alert.whatHappened,
            sentiment: alert.impact === 'Positive' ? 'Bullish' : alert.impact === 'Negative' ? 'Bearish' : 'Neutral',
            companies: alert.companies || alert.relatedCompanies,
            bearCase: alert.bearCase,
            bullCase: alert.bullCase,
            whyItMatters: alert.whyItMatters
          } as any}
          onClose={() => setShowSummaryModal(false)}
        />
      )}
    </div>
  );
}

