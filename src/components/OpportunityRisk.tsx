import React from "react";
import { OpportunityExplorer, RiskRadar } from "../types";
import { Compass, ShieldAlert, Sparkles, AlertTriangle, ArrowRight, ShieldCheck, TrendingUp, HelpCircle } from "lucide-react";

interface OpportunityRiskProps {
  explorer: OpportunityExplorer;
  radar: RiskRadar;
  onSelectQuery: (query: string) => void;
}

export default function OpportunityRisk({ explorer, radar, onSelectQuery }: OpportunityRiskProps) {
  const isDataUnavailable = !explorer || !radar;

  if (isDataUnavailable) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="athena-opportunity-risk">
        {/* LEFT: Opportunity Explorer */}
        <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 p-8 text-center text-slate-400 font-sans text-sm flex flex-col items-center justify-center min-h-[300px]">
          <Compass className="h-10 w-10 text-slate-600 mb-3" />
          <h3 className="font-display font-bold text-white text-base">Opportunity Explorer</h3>
          <p className="text-slate-500 text-xs mt-1">Coming Soon</p>
        </div>

        {/* RIGHT: Risk Radar */}
        <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 p-8 text-center text-slate-400 font-sans text-sm flex flex-col items-center justify-center min-h-[300px]">
          <ShieldAlert className="h-10 w-10 text-slate-600 mb-3" />
          <h3 className="font-display font-bold text-white text-base">Risk Radar</h3>
          <p className="text-slate-500 text-xs mt-1">Coming Soon</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="athena-opportunity-risk">
      
      {/* LEFT: Opportunity Explorer */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 p-5 flex flex-col gap-4 text-left">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-slate-100">
              Opportunity Explorer
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">VALUATION & GROWTH RADAR</p>
          </div>
        </div>

        {/* Undervalued Growth Section */}
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold block mb-2.5">
            Undervalued Growth Picks
          </span>
          <div className="flex flex-col gap-2.5">
            {explorer.undervaluedGrowth.map((stock) => (
              <div
                key={stock.symbol}
                className="bg-slate-950/40 border border-slate-900/80 p-3.5 rounded-lg flex flex-col sm:flex-row justify-between gap-3 text-left hover:border-slate-800 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">{stock.symbol}</span>
                    <span className="text-[10px] text-slate-400">{stock.name}</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed mt-1.5 font-sans">
                    <strong className="text-emerald-400 font-medium">Thesis: </strong>{stock.thesis}
                  </p>
                  
                  {/* Micro stats row */}
                  <div className="flex flex-wrap gap-4 mt-2.5 text-[10px] font-mono text-slate-400">
                    <div>
                      <span>P/E Ratio: </span>
                      <strong className="text-slate-200">{stock.pe}x</strong>
                      <span className="text-slate-600"> (Sector: {stock.peerPe}x)</span>
                    </div>
                    <div>
                      <span>Div Yield: </span>
                      <strong className="text-slate-200">{stock.dividendYield}</strong>
                    </div>
                    <div>
                      <span>Momentum: </span>
                      <strong className="text-slate-200 uppercase">{stock.momentum}</strong>
                    </div>
                  </div>
                </div>

                <div className="sm:text-right flex sm:flex-col justify-end gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onSelectQuery(`Deep dive into Athena's investment thesis for ${stock.name} (${stock.symbol}). Analyze the specific valuation multiples and long-term catalysts.`)}
                    className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded px-2.5 py-1.5 font-sans transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    Analyze Thesis
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Breakout Sectors list */}
        <div className="mt-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold block mb-2.5">
            Breakout Sectors & Vectors
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {explorer.breakoutSectors.map((sec, idx) => (
              <div
                key={idx}
                className="bg-slate-950/20 border border-slate-900 p-3 rounded-lg text-left hover:border-slate-800 transition-all"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-xs text-slate-100">{sec.sector}</h4>
                  <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">
                    {sec.growthRate}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  <strong className="text-slate-300 font-medium">Catalysts: </strong>{sec.keyDrivers}
                </p>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Key Stocks:</span>
                  <div className="flex flex-wrap gap-1">
                    {sec.stocks.map((st, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => onSelectQuery(`What is the valuation, technical setup and outlook for ${st} in the breakout ${sec.sector} space?`)}
                        className="text-[9px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors hover:text-white"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* RIGHT: Risk Radar */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 p-5 flex flex-col gap-4 text-left">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <div className="h-7 w-7 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-slate-100">
              Risk Radar
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">MACRO & REGULATORY WARNINGS</p>
          </div>
        </div>

        {/* Macro Risks */}
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold block mb-2.5">
            Macroeconomic Risk Vectors
          </span>
          <div className="flex flex-col gap-2.5">
            {radar.macroRisks.map((risk, idx) => {
              const isHigh = risk.level === "High" || risk.level === "Medium-High";
              return (
                <div
                  key={idx}
                  className="bg-slate-950/40 border border-slate-900 p-3 rounded-lg text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-slate-800 transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display font-bold text-xs text-slate-200">{risk.title}</h4>
                      <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                        isHigh ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {risk.level} Severity
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      <strong className="text-slate-300 font-medium">Impact: </strong>{risk.impact}
                    </p>
                    <p className="text-[11px] text-emerald-400 mt-1 font-sans">
                      <strong className="text-slate-300 font-medium font-mono uppercase text-[9px]">Mitigation: </strong>{risk.mitigation}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => onSelectQuery(`Analyze the macro risk of "${risk.title}". What specific hedging actions should Indian equity investors take?`)}
                    className="text-[9px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white px-2 py-1.5 rounded transition-all flex-shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    Review Hedge
                    <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Regulatory & Limits warnings */}
        <div className="mt-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold block mb-2.5">
            SEBI Regulatory & Capital Flags
          </span>
          <div className="flex flex-col gap-2.5">
            {radar.regulatoryWarnings.map((warn, idx) => (
              <div
                key={idx}
                className="bg-slate-950/20 border border-slate-900/60 p-3.5 rounded-lg text-left hover:border-slate-800 transition-all flex gap-3 items-start"
              >
                <AlertTriangle className={`h-4.5 w-4.5 flex-shrink-0 mt-0.5 ${warn.severity === "High" ? "text-red-400" : "text-amber-400"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white uppercase">{warn.symbol}</span>
                    <span className="text-[9px] text-red-400 font-mono bg-red-500/5 border border-red-500/10 px-1.5 py-0.2 rounded">
                      SEBI LIMITS
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed mt-1 font-sans">
                    <strong className="text-red-400/90 font-medium">Warning: </strong>{warn.warning}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    <strong className="text-slate-300 font-medium font-mono text-[9px] uppercase">Portfolio Impact: </strong>{warn.impact}
                  </p>
                </div>
                <button
                  onClick={() => onSelectQuery(`What is the SEBI policy update on ${warn.symbol}? Detail the rule changes, dates, and direct margin impacts.`)}
                  className="p-1 text-slate-500 hover:text-emerald-400 rounded transition-colors flex-shrink-0 mt-0.5 cursor-pointer"
                  title="Query Rule Details"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
