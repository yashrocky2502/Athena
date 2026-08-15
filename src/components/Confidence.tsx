import React, { useState } from "react";
import { 
  ShieldCheck, 
  CheckCircle2, 
  FileText, 
  Link2, 
  Clock, 
  HelpCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  BrainCircuit
} from "lucide-react";
import { SearchSource, ReasoningGraph } from "../types";

interface ConfidenceProps {
  text: string;
  sources: SearchSource[];
  reasoningGraph?: ReasoningGraph;
  className?: string;
}

export default function Confidence({ text, sources, reasoningGraph, className = "" }: ConfidenceProps) {
  const [explainWhyOpen, setExplainWhyOpen] = useState(false);
  // Parse Smart Summary format
  const parseResponse = () => {
    let whatHappened = "";
    let whyItMatters = "";
    let whoIsAffected = "";
    let risks = "";
    let confidence = "Medium";
    let readingTime = "30 seconds";
    let detailedAnalysis = "";

    const lines = text.split("\n");
    let currentSection = "";
    let analysisLines: string[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith("### What Happened")) {
        currentSection = "what";
      } else if (trimmed.startsWith("### Why It Matters")) {
        currentSection = "why";
      } else if (trimmed.startsWith("### Who Is Affected")) {
        currentSection = "who";
      } else if (trimmed.startsWith("### Risks")) {
        currentSection = "risks";
      } else if (trimmed.startsWith("### Confidence")) {
        currentSection = "confidence";
      } else if (trimmed.startsWith("### Estimated Reading Time")) {
        currentSection = "time";
      } else if (trimmed.startsWith("## Detailed Analysis") || trimmed.startsWith("### Detailed Analysis")) {
        currentSection = "analysis";
      } else if (trimmed.startsWith("⚡ Smart Summary") || trimmed === "***" || trimmed === "---") {
        // Ignore headers/dividers
      } else if (trimmed) {
        if (currentSection === "what") whatHappened += line + " ";
        else if (currentSection === "why") whyItMatters += line + " ";
        else if (currentSection === "who") whoIsAffected += line + " ";
        else if (currentSection === "risks") risks += line + " ";
        else if (currentSection === "confidence") confidence = line.replace(/\[|\]/g, "").trim();
        else if (currentSection === "time") readingTime = line.replace(/\[|\]/g, "").trim();
        else if (currentSection === "analysis") analysisLines.push(line);
      }
    });

    // Fallback if not matching Smart Summary format
    if (!whatHappened && !detailedAnalysis) {
      detailedAnalysis = text;
      whatHappened = "Analysis generated without Smart Summary format.";
    }

    return {
      whatHappened: whatHappened.trim(),
      whyItMatters: whyItMatters.trim(),
      whoIsAffected: whoIsAffected.trim(),
      risks: risks.trim(),
      confidence,
      readingTime,
      detailedAnalysis: analysisLines.join("\n").trim() || detailedAnalysis
    };
  };

  const { whatHappened, whyItMatters, whoIsAffected, risks, confidence, readingTime, detailedAnalysis } = parseResponse();

  let confidenceScore = 85;
  if ((confidence || "").toLowerCase().includes("high")) confidenceScore = 95;
  if ((confidence || "").toLowerCase().includes("low")) confidenceScore = 60;

  const getScoreDetails = (score: number) => {
    if (score >= 90) return { color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5", label: "Institutional Grade", description: "High source density and multi-vector factual corroboration." };
    if (score >= 80) return { color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/5", label: "Verified Analysis", description: "Grounded analysis with standard public disclosures." };
    return { color: "text-amber-400 border-amber-500/30 bg-amber-500/5", label: "Indicative State", description: "Limited live grounding. Standard historical references applied." };
  };

  const details = getScoreDetails(confidenceScore);

  const renderMarkdown = (markdown: string) => {
    return markdown.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-2.5"></div>;

      if (trimmed.startsWith("###")) {
        return (
          <h4 key={idx} className="font-display font-bold text-sm text-slate-100 mt-4 mb-2 flex items-center gap-2 border-b border-slate-800/60 pb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
            {trimmed.replace("###", "").trim()}
          </h4>
        );
      }

      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const content = trimmed.substring(1).trim();
        return <li key={idx} className="ml-4 list-disc text-slate-300 text-xs md:text-sm leading-relaxed mb-1.5">{content.replace(/\*\*/g, "")}</li>;
      }

      const parts = trimmed.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={idx} className="text-slate-300 text-xs md:text-sm leading-relaxed mb-2">
          {parts.map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} className="text-white font-medium">{part}</strong> : part))}
        </p>
      );
    });
  };

  return (
    <div className={`flex flex-col gap-5 ${className}`} id="athena-confidence-engine">
      {/* 1. CONFIDENCE SCORE HEADER */}
      <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border ${details.color} transition-all`}>
        <div className="flex items-center gap-3.5">
          <div className="relative h-14 w-14 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className={confidenceScore >= 90 ? "text-emerald-400" : "text-indigo-400"} strokeWidth="3.2" strokeDasharray={`${confidenceScore}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold font-mono tracking-tight text-white">{confidenceScore}%</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-sm text-white">{details.label}</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-normal">{details.description}</p>
          </div>
        </div>
        <div className="flex gap-4 border-l border-slate-800/80 pl-4 md:pl-6">
          <div className="text-left">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold block">Reading Time</span>
            <span className="font-mono text-sm font-bold text-slate-200">{readingTime}</span>
          </div>
          <div className="text-left">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold block">Sources</span>
            <span className="font-mono text-sm font-bold text-emerald-400">{sources?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* 2. SMART SUMMARY BENTO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-1">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">What Happened & Why</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed"><strong className="text-emerald-400">What:</strong> {whatHappened || "N/A"}</p>
          <p className="text-xs text-slate-300 leading-relaxed"><strong className="text-emerald-400">Why:</strong> {whyItMatters || "N/A"}</p>
        </div>
        
        <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-1">
            <HelpCircle className="h-4 w-4 text-amber-400" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">Impact & Risks</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed"><strong className="text-amber-400">Who:</strong> {whoIsAffected || "N/A"}</p>
          <p className="text-xs text-slate-300 leading-relaxed"><strong className="text-amber-400">Risks:</strong> {risks || "N/A"}</p>
        </div>
      </div>

      {/* 3. DETAILED ANALYSIS */}
      <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-xl flex flex-col gap-3">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <FileText className="h-4 w-4 text-indigo-400" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">Detailed Analysis</span>
        </div>
        <div className="prose prose-invert max-w-none max-h-[400px] overflow-y-auto pr-2">
          {renderMarkdown(detailedAnalysis)}
        </div>
      </div>

      {/* 4. ORIGINAL SOURCES */}
      {sources && sources.length > 0 && (
        <div className="bg-slate-950/20 border border-slate-900 rounded-xl p-4">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono font-bold block mb-3 px-1">
            Original Sources
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sources.map((src, idx) => (
              <a key={idx} href={src.uri} target="_blank" rel="noreferrer" className="flex flex-col gap-1.5 bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/50 rounded-lg p-3 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 flex-shrink-0 transition-colors" />
                    <span className="font-medium text-slate-300 group-hover:text-white text-xs line-clamp-1">{src.title}</span>
                  </div>
                  {src.trustRating && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap font-mono">{src.trustRating}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono ml-5">
                  <span className="truncate max-w-[150px]">{src.uri.replace("https://", "").replace("www.", "").split("/")[0]}</span>
                  {src.publicationTime && (
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {src.publicationTime}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
      {/* 5. EXPLAIN WHY (Reasoning Engine) */}
      {reasoningGraph && (
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl overflow-hidden transition-all duration-300">
          <button 
            onClick={() => setExplainWhyOpen(!explainWhyOpen)}
            className="w-full flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-indigo-400" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-200">Explain Why</span>
            </div>
            {explainWhyOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>
          
          {explainWhyOpen && (
            <div className="p-4 border-t border-slate-800/80 flex flex-col gap-4 bg-slate-950/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500">Reasoning Summary</span>
                  <p className="text-xs text-slate-300 leading-relaxed">{reasoningGraph.reasoningSummary}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500">Confidence Calculation</span>
                  <p className="text-xs text-slate-300 leading-relaxed">{reasoningGraph.confidenceCalculation}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500">Evidence Used</span>
                  <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded w-fit">{reasoningGraph.evidenceUsed.length} verified items</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500">KG Nodes Activated</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {reasoningGraph.knowledgeGraphNodes.map(node => (
                      <span key={node} className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">{node}</span>
                    ))}
                  </div>
                </div>
              </div>

              {reasoningGraph.steps && reasoningGraph.steps.length > 0 && (
                <div className="mt-2">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500 mb-2 block">Resolution Steps</span>
                  <ul className="flex flex-col gap-2">
                    {reasoningGraph.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-2 items-start text-xs text-slate-400">
                        <span className="text-[9px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1 rounded flex-shrink-0 mt-0.5">{step.step}</span>
                        <span>{step.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
