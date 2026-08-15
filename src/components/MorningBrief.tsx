import React, { useState } from "react";
import { MorningBrief as BriefType, MarketStory } from "../types";
import { Coffee, Globe, AlertCircle, PlayCircle, BookOpen, Clock, ChevronDown, ChevronUp, ArrowUpRight, Sparkles } from "lucide-react";

interface MorningBriefProps {
  brief: BriefType;
  stories: MarketStory[];
  onSelectStoryQuery: (query: string) => void;
}

export default function MorningBrief({ brief, stories, onSelectStoryQuery }: MorningBriefProps) {
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);

  const isDataUnavailable = !brief;

  if (isDataUnavailable) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="athena-morning-brief">
        {/* LEFT & CENTER: Bloomberg-Style Morning Brief */}
        <div className="lg:col-span-2 bg-slate-900/40 rounded-xl border border-slate-800/80 p-8 text-center text-slate-400 font-sans text-sm flex flex-col items-center justify-center min-h-[300px]">
          <Coffee className="h-10 w-10 text-slate-600 mb-3" />
          <h3 className="font-display font-bold text-white text-base">The Morning Brief</h3>
          <p className="text-slate-500 text-xs mt-1">Data unavailable (Coming Soon)</p>
        </div>

        {/* RIGHT SIDE: Market Story Narratives */}
        <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 p-8 text-center text-slate-400 font-sans text-sm flex flex-col items-center justify-center min-h-[300px]">
          <BookOpen className="h-10 w-10 text-slate-600 mb-3" />
          <h3 className="font-display font-bold text-white text-base">Market Stories</h3>
          <p className="text-slate-500 text-xs mt-1">Data unavailable (Coming Soon)</p>
        </div>
      </div>
    );
  }

  const toggleStory = (id: string) => {
    setExpandedStoryId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="athena-morning-brief">
      
      {/* LEFT & CENTER: Bloomberg-Style Morning Brief */}
      <div className="lg:col-span-2 bg-slate-900/40 rounded-xl border border-slate-800/80 p-5 flex flex-col gap-4 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Coffee className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-100">
                The Morning Brief
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">PUBLISHED {brief.time}</p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1">
            {brief.date}
          </span>
        </div>

        {/* Global Cues bar */}
        <div className="bg-slate-950/50 rounded-lg p-3.5 border border-slate-900 flex gap-3 items-start">
          <Globe className="h-4.5 w-4.5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="text-left">
            <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">
              Global Market Cues
            </span>
            <p className="text-slate-200 text-xs leading-relaxed mt-0.5 font-sans">
              {brief.globalCues}
            </p>
          </div>
        </div>

        {/* Curated Headlines list */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold block text-left">
            Institutional Headlines
          </span>
          <div className="flex flex-col gap-2.5">
            {brief.headlines.map((hl, idx) => (
              <div
                key={idx}
                className="bg-slate-950/20 hover:bg-slate-950/60 p-3 rounded-lg border border-slate-900/60 hover:border-slate-800 flex items-start justify-between gap-3 transition-all text-left"
              >
                <div className="flex-1">
                  <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono font-semibold px-2 py-0.5 rounded">
                    {hl.tag}
                  </span>
                  <p className="text-slate-300 text-xs leading-relaxed mt-2 font-sans">
                    {hl.text}
                  </p>
                </div>
                <button
                  onClick={() => onSelectStoryQuery(`Analyze the impact of: "${hl.text}" on the related Indian sectors and companies.`)}
                  className="p-1 text-slate-500 hover:text-emerald-400 rounded transition-colors flex-shrink-0 cursor-pointer mt-1"
                  title="Query Athena AI"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy Note */}
        <div className="border-t border-slate-800/40 pt-4 mt-1 bg-gradient-to-r from-emerald-500/5 to-transparent rounded-lg p-3 border border-emerald-500/10 flex gap-3 text-left">
          <AlertCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold">
              Athena Strategic Playbook
            </span>
            <p className="text-slate-300 text-xs leading-relaxed mt-0.5 italic">
              "{brief.strategyNote}"
            </p>
          </div>
        </div>

      </div>

      {/* RIGHT SIDE: Market Story Narratives */}
      <div className="flex flex-col gap-4 bg-slate-900/30 rounded-xl border border-slate-800/60 p-4 text-left">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <BookOpen className="h-4.5 w-4.5 text-indigo-400" />
          <h3 className="font-display font-bold text-base text-slate-100">
            Market Stories
          </h3>
        </div>

        <div className="flex flex-col gap-3">
          {stories.map((story) => {
            const isExpanded = expandedStoryId === story.id;
            return (
              <div
                key={story.id}
                className={`border rounded-xl transition-all ${
                  isExpanded
                    ? "bg-slate-950 border-indigo-500/40"
                    : "bg-slate-950/40 hover:bg-slate-950 border-slate-900"
                }`}
              >
                {/* Header toggle */}
                <button
                  onClick={() => toggleStory(story.id)}
                  className="w-full p-4 flex items-start justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 items-center mb-1.5">
                      {(story.tags || []).slice(0, 2).map((t, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[9px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.2 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <h4 className="font-display font-semibold text-xs md:text-sm text-slate-200 leading-snug group-hover:text-white">
                      {story.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-slate-600" />
                      {story.readTime} • {story.author}
                    </p>
                  </div>
                  <div className="p-1 text-slate-600 bg-slate-900/50 rounded-md border border-slate-800/40 flex-shrink-0">
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-900 pt-3 text-xs leading-relaxed animate-fadeIn">
                    <p className="text-slate-300 mb-3 font-sans">
                      {story.summary}
                    </p>

                    <div className="flex flex-col gap-2 bg-slate-900/40 border border-slate-900 p-3 rounded-lg mb-3">
                      <span className="text-[9px] text-indigo-400 uppercase font-mono font-bold block mb-1">
                        Core Dimensions & Catalysts
                      </span>
                      <ul className="flex flex-col gap-1.5">
                        {story.bullets.map((b, bIdx) => (
                          <li key={bIdx} className="list-disc ml-3 text-slate-300">
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Quick Query CTA */}
                    <button
                      onClick={() => onSelectStoryQuery(`Analyze the thematic investment case for: "${story.title}". What are the key beneficiary stocks and macro risks in the Indian market?`)}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-[11px] rounded px-3 py-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                      Run Deep AI Theme Analysis
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
