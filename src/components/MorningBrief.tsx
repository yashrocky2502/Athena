import React, { useState, useEffect } from "react";
import { MorningBrief as BriefType, MarketStory } from "../types";
import { 
  Coffee, 
  Globe, 
  AlertCircle, 
  BookOpen, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight, 
  Sparkles,
  ShieldCheck,
  Cpu,
  Layers,
  BarChart2,
  TrendingUp,
  Activity,
  Compass,
  Zap,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

interface BriefSectionItem {
  id: string;
  title: string;
  verifiedFact: string;
  athenaInference: string;
  status: 'VERIFIED' | 'INSUFFICIENT_EVIDENCE';
  source?: string;
  tags?: string[];
}

interface InstitutionalBriefData {
  timestamp: string;
  edition: string;
  date: string;
  time: string;
  marketRegime: string;
  marketBias: string;
  headlineSynthesis: string;
  overnightGlobalSetup: BriefSectionItem[];
  usEuropeanMarketSignals: BriefSectionItem[];
  asianMarketSetup: BriefSectionItem[];
  indianMarketSetup: BriefSectionItem[];
  niftyBankniftyContext: BriefSectionItem[];
  majorCorporateEvents: BriefSectionItem[];
  macroEconomicCalendar: BriefSectionItem[];
  commodityCurrencySignals: BriefSectionItem[];
  fnoPositioning: BriefSectionItem[];
  keyRisks: BriefSectionItem[];
  keyCatalysts: BriefSectionItem[];
  whatToWatchToday: BriefSectionItem[];
  overallConfidence: number;
}

interface MorningBriefProps {
  brief?: BriefType;
  stories: MarketStory[];
  onSelectStoryQuery: (query: string) => void;
}

export default function MorningBrief({ brief, stories, onSelectStoryQuery }: MorningBriefProps) {
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'INSTITUTIONAL_12' | 'MARKET_STORIES'>('INSTITUTIONAL_12');
  const [institutionalBrief, setInstitutionalBrief] = useState<InstitutionalBriefData | null>(null);
  const [loadingBrief, setLoadingBrief] = useState<boolean>(false);
  const [expandedSectionKey, setExpandedSectionKey] = useState<string | null>('niftyBankniftyContext');

  useEffect(() => {
    let isMounted = true;
    async function fetchInstitutionalBrief() {
      try {
        setLoadingBrief(true);
        const res = await fetch('/api/v5/news/brief/morning');
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && json.brief && isMounted) {
            setInstitutionalBrief(json.brief);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch institutional brief, fallback to prop brief', err);
      } finally {
        if (isMounted) setLoadingBrief(false);
      }
    }
    fetchInstitutionalBrief();
    return () => { isMounted = false; };
  }, []);

  const toggleStory = (id: string) => {
    setExpandedStoryId((prev) => (prev === id ? null : id));
  };

  const toggleSection = (key: string) => {
    setExpandedSectionKey((prev) => (prev === key ? null : key));
  };

  const sectionsConfig: Array<{
    key: keyof InstitutionalBriefData;
    label: string;
    icon: React.ReactNode;
    category: 'GLOBAL' | 'INDIAN' | 'CORPORATE_DERIVATIVES' | 'PLAYBOOK';
  }> = [
    { key: 'overnightGlobalSetup', label: '1. Overnight Global Setup', icon: <Globe className="h-4 w-4 text-sky-400" />, category: 'GLOBAL' },
    { key: 'usEuropeanMarketSignals', label: '2. US / European Market Signals', icon: <BarChart2 className="h-4 w-4 text-blue-400" />, category: 'GLOBAL' },
    { key: 'asianMarketSetup', label: '3. Asian Market Setup', icon: <TrendingUp className="h-4 w-4 text-emerald-400" />, category: 'GLOBAL' },
    { key: 'indianMarketSetup', label: '4. Indian Market Setup', icon: <Activity className="h-4 w-4 text-amber-400" />, category: 'INDIAN' },
    { key: 'niftyBankniftyContext', label: '5. NIFTY / BANKNIFTY Context', icon: <Compass className="h-4 w-4 text-indigo-400" />, category: 'INDIAN' },
    { key: 'majorCorporateEvents', label: '6. Major Corporate Events', icon: <Zap className="h-4 w-4 text-yellow-400" />, category: 'CORPORATE_DERIVATIVES' },
    { key: 'macroEconomicCalendar', label: '7. Macro / Economic Calendar', icon: <Layers className="h-4 w-4 text-purple-400" />, category: 'GLOBAL' },
    { key: 'commodityCurrencySignals', label: '8. Commodity & Currency Signals', icon: <Activity className="h-4 w-4 text-teal-400" />, category: 'GLOBAL' },
    { key: 'fnoPositioning', label: '9. F&O Positioning & Flow', icon: <BarChart2 className="h-4 w-4 text-cyan-400" />, category: 'CORPORATE_DERIVATIVES' },
    { key: 'keyRisks', label: '10. Key Systemic Risks', icon: <AlertTriangle className="h-4 w-4 text-rose-400" />, category: 'PLAYBOOK' },
    { key: 'keyCatalysts', label: '11. Key Market Catalysts', icon: <Sparkles className="h-4 w-4 text-emerald-400" />, category: 'PLAYBOOK' },
    { key: 'whatToWatchToday', label: '12. What To Watch Today', icon: <Clock className="h-4 w-4 text-amber-400" />, category: 'PLAYBOOK' }
  ];

  return (
    <div className="flex flex-col gap-5 w-full" id="athena-morning-brief">
      {/* Header with Switcher and Regime Badge */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Coffee className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-slate-100">
                ATHENA Institutional Morning Brief
              </h2>
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono px-2 py-0.5 rounded-full font-bold">
                PHASE 10
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {institutionalBrief?.date || brief?.date || new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} • {institutionalBrief?.time || brief?.time || '08:45 AM IST'}
            </p>
          </div>
        </div>

        {/* Tab Selector & Regime Badge */}
        <div className="flex items-center gap-3 flex-wrap">
          {institutionalBrief && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
              <span className="text-slate-400 font-mono text-[11px]">MARKET BIAS:</span>
              <span className={`font-mono font-bold ${institutionalBrief.marketBias === 'BULLISH' ? 'text-emerald-400' : institutionalBrief.marketBias === 'BEARISH' ? 'text-rose-400' : 'text-amber-400'}`}>
                {institutionalBrief.marketBias}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400 font-mono text-[11px]">CONFIDENCE:</span>
              <span className="font-mono text-cyan-400 font-bold">{institutionalBrief.overallConfidence}%</span>
            </div>
          )}

          <div className="flex bg-slate-950/70 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('INSTITUTIONAL_12')}
              className={`px-3 py-1 text-xs font-mono rounded transition-all cursor-pointer ${activeTab === 'INSTITUTIONAL_12' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              12-Section Institutional Brief
            </button>
            <button
              onClick={() => setActiveTab('MARKET_STORIES')}
              className={`px-3 py-1 text-xs font-mono rounded transition-all cursor-pointer ${activeTab === 'MARKET_STORIES' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Market Stories ({stories.length})
            </button>
          </div>
        </div>
      </div>

      {/* Synthesis Rationale Bar */}
      {institutionalBrief && (
        <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-4 flex items-start gap-3 text-left">
          <ShieldCheck className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                Institutional Regime Synthesis
              </span>
              <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.2 rounded">
                DETERMINISTIC MULTI-FACTOR
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-1 leading-relaxed">
              {institutionalBrief.headlineSynthesis}
            </p>
          </div>
          <button
            onClick={() => onSelectStoryQuery(`Explain the morning market regime setup: "${institutionalBrief.headlineSynthesis}". What are the optimal risk-reward intraday setups for NIFTY and key sectors?`)}
            className="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-all flex-shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ask Athena</span>
          </button>
        </div>
      )}

      {/* MAIN VIEW */}
      {activeTab === 'INSTITUTIONAL_12' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 12 Sections Accordion */}
          <div className="lg:col-span-8 flex flex-col gap-3 text-left">
            {sectionsConfig.map((sec) => {
              const items = (institutionalBrief && (institutionalBrief[sec.key] as BriefSectionItem[])) || [];
              const isExpanded = expandedSectionKey === sec.key;

              return (
                <div
                  key={sec.key}
                  className={`rounded-xl border transition-all ${isExpanded ? 'bg-slate-900/70 border-indigo-500/50 shadow-lg shadow-indigo-950/20' : 'bg-slate-900/30 hover:bg-slate-900/50 border-slate-800/80'}`}
                >
                  <button
                    onClick={() => toggleSection(sec.key)}
                    className="w-full p-3.5 px-4 flex items-center justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-950/60 rounded-lg border border-slate-800">
                        {sec.icon}
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-sm text-slate-100">
                          {sec.label}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-400">
                          {items.length} {items.length === 1 ? 'Evidence Observation' : 'Evidence Observations'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded">
                        VERIFIED
                      </span>
                      <div className="p-1 text-slate-500">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Section Content */}
                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-slate-800/60 flex flex-col gap-3 mt-1">
                      {items.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-2">No observations reported for this section.</p>
                      ) : (
                        items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-slate-950/70 rounded-lg border border-slate-800 p-3.5 flex flex-col gap-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-semibold text-xs text-slate-200">
                                {item.title}
                              </h4>
                              {item.source && (
                                <span className="text-[9px] text-slate-400 font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                                  {item.source}
                                </span>
                              )}
                            </div>

                            {/* Dual Fact vs Inference Box */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              {/* VERIFIED FACT */}
                              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                                    VERIFIED FACT
                                  </span>
                                </div>
                                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                                  {item.verifiedFact}
                                </p>
                              </div>

                              {/* ATHENA INFERENCE */}
                              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                                    ATHENA INFERENCE
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                                  {item.athenaInference}
                                </p>
                              </div>
                            </div>

                            {/* Tags & Ask Button */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {(item.tags || []).map((t, idx) => (
                                  <span key={idx} className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.2 rounded">
                                    {t}
                                  </span>
                                ))}
                              </div>
                              <button
                                onClick={() => onSelectStoryQuery(`Analyze section observation: "${item.title}". Fact: "${item.verifiedFact}". Inference: "${item.athenaInference}". How should a trader position?`)}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 cursor-pointer"
                              >
                                <span>Deep Dive</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Key Strategy Playbook & Cues */}
          <div className="lg:col-span-4 flex flex-col gap-4 text-left">
            {/* Strategy Playbook Card */}
            <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 p-4.5 flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <AlertCircle className="h-4 w-4 text-emerald-400" />
                <h3 className="font-display font-bold text-sm text-slate-100">
                  Athena Strategic Playbook
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                "{brief?.strategyNote || 'Preserve capital on gap openings; focus on relative strength in banking and auto leaders with confirmed cash delivery volumes.'}"
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  TRADING DISCIPLINE CHECKS
                </span>
                <div className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Confirm price reaction with cash market volumes</span>
                </div>
                <div className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Cross-check F&O open interest shifts vs PCR bias</span>
                </div>
                <div className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Never average losing speculative positions</span>
                </div>
              </div>
            </div>

            {/* Quick Query Launchpad */}
            <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 p-4.5 flex flex-col gap-2.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                QUICK TRADER QUERIES
              </span>
              {[
                'What are today\'s high-conviction sector breakout candidates?',
                'Summarize F&O open interest shifts across NIFTY strikes.',
                'Which companies have upcoming quarterly board earnings today?'
              ].map((query, qIdx) => (
                <button
                  key={qIdx}
                  onClick={() => onSelectStoryQuery(query)}
                  className="w-full text-left p-2.5 bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white transition-all flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="truncate">{query}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Market Stories View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
          {stories.map((story) => {
            const isExpanded = expandedStoryId === story.id;
            return (
              <div
                key={story.id}
                className={`border rounded-xl transition-all ${
                  isExpanded
                    ? "bg-slate-900 border-indigo-500/40 shadow-lg"
                    : "bg-slate-900/30 hover:bg-slate-900/60 border-slate-800/80"
                }`}
              >
                <button
                  onClick={() => toggleStory(story.id)}
                  className="w-full p-4 flex items-start justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 items-center mb-1.5">
                      {(story.tags || []).slice(0, 2).map((t, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[9px] font-mono bg-slate-950 border border-slate-800 text-slate-400 px-1.5 py-0.2 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <h4 className="font-display font-semibold text-sm text-slate-100 leading-snug">
                      {story.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-slate-600" />
                      {story.readTime} • {story.author}
                    </p>
                  </div>
                  <div className="p-1 text-slate-600 bg-slate-950/50 rounded-md border border-slate-800/40 flex-shrink-0">
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-800/60 pt-3 text-xs leading-relaxed">
                    <p className="text-slate-300 mb-3 font-sans">
                      {story.summary}
                    </p>

                    <div className="flex flex-col gap-2 bg-slate-950/70 border border-slate-800 p-3 rounded-lg mb-3">
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

                    <button
                      onClick={() => onSelectStoryQuery(`Analyze the thematic investment case for: "${story.title}". What are the key beneficiary stocks and macro risks in the Indian market?`)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg px-3 py-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
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
      )}
    </div>
  );
}
