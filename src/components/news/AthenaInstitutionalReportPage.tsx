import React, { useState } from 'react';
import { 
  X, ExternalLink, Zap, ShieldCheck, CheckCircle2, AlertTriangle, 
  TrendingUp, TrendingDown, Minus, Activity, Clock, FileText, 
  Check, Info, Sparkles, Building2, ArrowUpRight, ArrowDownRight,
  ChevronRight, Award, Flame, Target, Layers, BarChart3, Database,
  History, Eye, Compass, GitMerge, ListOrdered, ShieldAlert, Rocket,
  PieChart, Calendar, Link2, Download, Printer, Share2, Search, Filter,
  BookOpen
} from 'lucide-react';
import { NewsArticle } from '../../news/models/NewsArticle';
import { parseAthenaV101Report } from '../../news/utils/AthenaV101ReportParser';
import { parseAthenaV106Summary } from '../../news/utils/AthenaV10SummaryParser';

interface AthenaInstitutionalReportPageProps {
  article: NewsArticle;
  activeArticleContent?: any;
  activeSummary?: any;
  onClose: () => void;
  onOpenOriginal?: () => void;
}

export function AthenaInstitutionalReportPage({
  article,
  activeArticleContent,
  activeSummary,
  onClose,
  onOpenOriginal
}: AthenaInstitutionalReportPageProps) {
  const [activeTab, setActiveTab] = useState<string>('sec-1');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const report = parseAthenaV101Report(article, activeArticleContent, activeSummary);
  const summaryData = parseAthenaV106Summary(article, activeArticleContent);
  const si = summaryData?.storyIntelligence;

  const getProcessingModeLabel = (mode?: string, conf?: number) => {
    const finalMode = mode || (si?.qualityPassed ? 'AI_FULL' : 'AI_PARTIAL');
    const displayConf = conf !== undefined ? ` (${conf}%)` : '';
    
    switch (finalMode) {
      case 'AI_FULL':
        return (
          <span className="px-2.5 py-1 rounded-md font-black border bg-emerald-950/80 text-emerald-400 border-emerald-800/80 flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>AI COMPILING: FULL SOURCE INTEGRITY{displayConf}</span>
          </span>
        );
      case 'AI_PARTIAL':
        return (
          <span className="px-2.5 py-1 rounded-md font-black border bg-amber-950/80 text-amber-400 border-amber-800/80 flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>AI COMPILING: PARTIAL REPAIR RECOVERY{displayConf}</span>
          </span>
        );
      case 'DETERMINISTIC_FALLBACK':
        return (
          <span className="px-2.5 py-1 rounded-md font-black border bg-indigo-950/90 text-indigo-300 border-indigo-800/80 flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            <span>COMPILING: DETERMINISTIC FALLBACK VETTED{displayConf}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-md font-black border bg-slate-900 text-slate-400 border-slate-800 flex items-center gap-1.5 shadow-md">
            <span>COMPILING: STANDARDIZED VETTED</span>
          </span>
        );
    }
  };

  const toggleSection = (secId: string) => {
    setCollapsedSections(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

  const scrollToSection = (secId: string) => {
    setActiveTab(secId);
    const elem = document.getElementById(secId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const sectionsList = [
    { id: 'sec-1', label: '1. Exec Summary', icon: Sparkles },
    { id: 'sec-2', label: '2. Financial Analysis', icon: BarChart3 },
    { id: 'sec-3', label: '3. Historical Comparison', icon: History },
    { id: 'sec-4', label: '4. Company Memory', icon: Database },
    { id: 'sec-5', label: '5. Business Analysis', icon: Activity },
    { id: 'sec-6', label: '6. Industry Analysis', icon: Compass },
    { id: 'sec-7', label: '7. Competitors', icon: Target },
    { id: 'sec-8', label: '8. Consensus Matrix', icon: Layers },
    { id: 'sec-9', label: '9. Cross-Article Intel', icon: GitMerge },
    { id: 'sec-10', label: '10. Historical Timeline', icon: ListOrdered },
    { id: 'sec-11', label: '11. Risk Analysis', icon: ShieldAlert },
    { id: 'sec-12', label: '12. Opportunities', icon: Rocket },
    { id: 'sec-13', label: '13. Scenario Analysis', icon: PieChart },
    { id: 'sec-14', label: '14. What To Watch', icon: Calendar },
    { id: 'sec-15', label: '15. Related Intel', icon: Link2 },
    { id: 'sec-16', label: '16. References', icon: ShieldCheck }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-start p-1 sm:p-3 md:p-5 overflow-hidden animate-in fade-in duration-200" id="athena-v101-report-modal">
      
      {/* Outer Bloomberg Terminal Styled Window */}
      <div className="bg-[#050811] border border-slate-800/90 rounded-2xl w-full max-w-6xl h-full max-h-[96vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Top Institutional Header Bar */}
        <div className="px-4 sm:px-6 py-3 bg-[#080d1a] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xxs sm:text-xs font-black tracking-widest uppercase shrink-0">
              <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>ATHENA V10.1</span>
            </div>
            <div className="h-4 w-px bg-slate-800 shrink-0 hidden sm:block" />
            <div className="truncate">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-100 truncate flex items-center gap-2">
                <span>{report.companyName}</span>
                {report.tickerSymbol && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-xxs">
                    {report.tickerSymbol}
                  </span>
                )}
                <span className="text-slate-500 font-mono text-xxs font-normal hidden md:inline">
                  • Bloomberg / Refinitiv Research Format
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors hidden sm:flex items-center gap-1 text-xxs font-bold px-2.5"
              title="Print / Save PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>PDF Report</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors"
              title="Close Research Report"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section Jump-Bar Navigation */}
        <div className="px-4 py-2 bg-[#090e1f] border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 shrink-0">
          {sectionsList.map(sec => {
            const IconComponent = sec.icon;
            const isActive = activeTab === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xxs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/30'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800/50'
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Report Body Area (Scrollable Terminal) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Main Title Header */}
          <div className="border-b border-slate-800/80 pb-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-xxs sm:text-xs">
                <span className="px-2.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-extrabold">
                  INSTITUTIONAL RESEARCH
                </span>
                <span className="text-slate-500 font-mono">
                  {report.publisher} • {new Date(report.publishedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-xxs font-mono">
                {getProcessingModeLabel(si?.processingMode, si?.confidence)}
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-100 leading-tight">
              {report.title}
            </h1>
          </div>

          {/* ==========================================
              SECTION 1: Professional Executive Summary
             ========================================== */}
          <section id="sec-1" className="scroll-mt-6 bg-gradient-to-br from-indigo-950/20 via-slate-900/60 to-slate-950 border border-indigo-500/20 rounded-xl p-4 sm:p-6 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
              <div className="flex items-center space-x-2 text-indigo-400 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Section 1 • Professional Executive Summary</span>
              </div>
              <span className="text-xxs font-mono text-slate-400">{report.execSummary.wordCount} words (Max 200)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xxs font-black text-indigo-400 uppercase tracking-wider block mb-1">What Happened</span>
                <p className="text-slate-200 leading-relaxed">{report.execSummary.whatHappened}</p>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xxs font-black text-amber-400 uppercase tracking-wider block mb-1">Why It Happened</span>
                <p className="text-slate-200 leading-relaxed">{report.execSummary.whyItHappened}</p>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xxs font-black text-sky-400 uppercase tracking-wider block mb-1">Why It Matters</span>
                <p className="text-slate-200 leading-relaxed">{report.execSummary.whyItMatters}</p>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xxs font-black text-emerald-400 uppercase tracking-wider block mb-1">Key Conclusion</span>
                <p className="text-slate-200 leading-relaxed font-semibold">{report.execSummary.keyConclusion}</p>
              </div>
            </div>
          </section>

          {/* ==========================================
              SECTION 2: Detailed Financial Analysis
             ========================================== */}
          <section id="sec-2" className="scroll-mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Section 2 • Detailed Financial Analysis</span>
              </div>
              <span className="text-xxs text-slate-500 font-mono">Reported metrics only • Never fabricated</span>
            </div>

            {report.financialMetrics.length === 0 ? (
              <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl text-xs text-slate-500 italic">
                No quantitative metrics extracted in disclosure.
              </div>
            ) : (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-xxs border-b border-slate-800">
                    <tr>
                      <th className="p-3">Metric</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Current Value</th>
                      <th className="p-3">QoQ Change</th>
                      <th className="p-3">YoY Change</th>
                      <th className="p-3">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-medium text-slate-200">
                    {report.financialMetrics.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3 font-bold text-slate-100">{row.label}</td>
                        <td className="p-3 font-mono text-xxs text-slate-400">{row.category}</td>
                        <td className="p-3 font-mono font-bold text-indigo-300">{row.current}</td>
                        <td className="p-3 font-mono text-xxs text-emerald-400">{row.changeQoQ || '—'}</td>
                        <td className="p-3 font-mono text-xxs text-emerald-400">{row.changeYoY || '—'}</td>
                        <td className="p-3">
                          {row.trend === 'UP' && (
                            <span className="inline-flex items-center text-emerald-400 font-bold text-xxs gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" /> UP
                            </span>
                          )}
                          {row.trend === 'DOWN' && (
                            <span className="inline-flex items-center text-rose-400 font-bold text-xxs gap-1">
                              <ArrowDownRight className="w-3.5 h-3.5" /> DOWN
                            </span>
                          )}
                          {row.trend === 'NEUTRAL' && (
                            <span className="inline-flex items-center text-slate-400 font-bold text-xxs gap-1">
                              <Minus className="w-3.5 h-3.5" /> STABLE
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ==========================================
              SECTION 3: Historical Comparison
             ========================================== */}
          <section id="sec-3" className="scroll-mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
                <History className="w-4 h-4 text-sky-400" />
                <span>Section 3 • Historical Comparison ({report.historicalComparison.periodCurrent} vs {report.historicalComparison.periodPreviousQoQ} / {report.historicalComparison.periodPreviousYoY})</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-xxs border-b border-slate-800">
                  <tr>
                    <th className="p-3">Metric</th>
                    <th className="p-3">Current ({report.historicalComparison.periodCurrent})</th>
                    <th className="p-3">Previous QoQ ({report.historicalComparison.periodPreviousQoQ})</th>
                    <th className="p-3">Previous YoY ({report.historicalComparison.periodPreviousYoY})</th>
                    <th className="p-3">Historical Direction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 font-medium text-slate-200">
                  {report.historicalComparison.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/50">
                      <td className="p-3 font-bold text-slate-100">{row.label}</td>
                      <td className="p-3 font-mono font-bold text-indigo-300">{row.current}</td>
                      <td className="p-3 font-mono text-slate-400">{row.previousQoQ || '—'}</td>
                      <td className="p-3 font-mono text-slate-400">{row.previousYoY || '—'}</td>
                      <td className="p-3 font-mono text-xxs text-emerald-400 font-bold">
                        {row.trend === 'UP' ? 'Expansion' : row.trend === 'DOWN' ? 'Contraction' : 'Steady'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ==========================================
              SECTION 4: Company Memory & Milestone Track
             ========================================== */}
          <section id="sec-4" className="scroll-mt-6 space-y-3">
            <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Section 4 • Company Memory & Historical Actions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {report.companyMemory.map((mem, idx) => (
                <div key={idx} className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xxs">
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-900 font-bold">
                      {mem.category}
                    </span>
                    <span className="text-slate-500 font-mono">{mem.date}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">{mem.event}</h4>
                  <p className="text-xxs text-slate-400 leading-relaxed">{mem.impact}</p>
                  <div className="p-2 bg-slate-950 rounded border border-slate-850 text-xxs text-emerald-400 font-mono">
                    Outcome: {mem.outcome}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ==========================================
              SECTION 5: Business Analysis
             ========================================== */}
          <section id="sec-5" className="scroll-mt-6 bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider border-b border-slate-800 pb-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Section 5 • Detailed Business Analysis</span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <strong className="text-indigo-400 block mb-1 uppercase text-xxs tracking-wider">Why Results Changed</strong>
                <p className="bg-slate-950 p-3 rounded-lg border border-slate-850 leading-relaxed">{report.businessAnalysis.whyResultsChanged}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1.5">
                  <strong className="text-emerald-400 block text-xxs uppercase tracking-wider">Revenue Drivers</strong>
                  <ul className="space-y-1 text-xxs list-disc list-inside text-slate-300">
                    {report.businessAnalysis.revenueDrivers.map((rd, i) => (
                      <li key={i}>{rd}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1.5">
                  <strong className="text-sky-400 block text-xxs uppercase tracking-wider">Margin Drivers</strong>
                  <ul className="space-y-1 text-xxs list-disc list-inside text-slate-300">
                    {report.businessAnalysis.marginDrivers.map((md, i) => (
                      <li key={i}>{md}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <strong className="text-amber-400 block mb-1 uppercase text-xxs tracking-wider">Management Commentary Summary</strong>
                <p className="bg-slate-950 p-3 rounded-lg border border-slate-850 leading-relaxed font-mono text-xxs text-slate-200">
                  {report.businessAnalysis.managementCommentary}
                </p>
              </div>
            </div>
          </section>

          {/* ==========================================
              SECTION 6: Industry Analysis
             ========================================== */}
          <section id="sec-6" className="scroll-mt-6 bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider border-b border-slate-800 pb-2">
              <Compass className="w-4 h-4 text-purple-400" />
              <span>Section 6 • Industry & Sector Analysis ({report.industryAnalysis.sectorTrends ? report.category : 'General'})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                <strong className="text-purple-400 text-xxs uppercase block">Sector Trends</strong>
                <p className="text-slate-300 text-xxs leading-relaxed">{report.industryAnalysis.sectorTrends}</p>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                <strong className="text-indigo-400 text-xxs uppercase block">Competitive Positioning</strong>
                <p className="text-slate-300 text-xxs leading-relaxed">{report.industryAnalysis.industryPositioning}</p>
              </div>
            </div>
          </section>

          {/* ==========================================
              SECTION 7: Competitor Comparison
             ========================================== */}
          <section id="sec-7" className="scroll-mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
                <Target className="w-4 h-4 text-rose-400" />
                <span>Section 7 • Peer & Competitor Matrix ({report.competitorComparison.sectorName})</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-xxs border-b border-slate-800">
                  <tr>
                    <th className="p-3">Company</th>
                    <th className="p-3">Revenue</th>
                    <th className="p-3">EBITDA Margin</th>
                    <th className="p-3">PAT Growth</th>
                    <th className="p-3">P/E Valuation</th>
                    <th className="p-3">Market Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 font-medium text-slate-200">
                  {report.competitorComparison.peers.map((peer, idx) => (
                    <tr key={idx} className={`hover:bg-slate-850/50 ${peer.isSubjectCompany ? 'bg-indigo-950/40 font-bold border-l-4 border-l-indigo-500' : ''}`}>
                      <td className="p-3 text-slate-100 flex items-center gap-2">
                        <span>{peer.peerName}</span>
                        {peer.isSubjectCompany && (
                          <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-black rounded">TARGET</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-300">{peer.revenue}</td>
                      <td className="p-3 font-mono text-slate-300">{peer.ebitdaMargin}</td>
                      <td className="p-3 font-mono text-emerald-400">{peer.patGrowth}</td>
                      <td className="p-3 font-mono text-slate-400">{peer.peRatio}</td>
                      <td className="p-3 text-xxs font-mono text-slate-300">{peer.marketPosition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ==========================================
              SECTION 8: Institutional Consensus
             ========================================== */}
          <section id="sec-8" className="scroll-mt-6 bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Section 8 • Institutional Media Consensus</span>
              </div>
              <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-xxs font-mono font-bold">
                Confidence: {report.institutionalConsensus.confidenceScorePct}%
              </span>
            </div>

            <p className="text-xs text-slate-200 bg-slate-950 p-3 rounded-lg border border-slate-850 leading-relaxed font-medium">
              <strong className="text-indigo-400">Consensus View:</strong> {report.institutionalConsensus.consensusView}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xxs">
              {report.institutionalConsensus.outlets.map((out, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{out.outlet}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950 text-emerald-400 rounded border border-emerald-900 font-mono">
                      {out.verificationStatus}
                    </span>
                  </div>
                  <p className="text-slate-400 leading-snug">{out.reportedAngle}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ==========================================
              SECTION 9: Cross-Article Intelligence
             ========================================== */}
          <section id="sec-9" className="scroll-mt-6 bg-gradient-to-r from-indigo-950/30 to-slate-900 border border-indigo-500/20 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider border-b border-indigo-500/20 pb-2">
              <GitMerge className="w-4 h-4 text-indigo-400" />
              <span>Section 9 • Cross-Article Intelligence & Evolving Story</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {report.crossArticleIntelligence.evolvingStorySummary}
            </p>

            <div className="space-y-2 pt-2">
              {report.crossArticleIntelligence.connectedEvents.map((conn, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-start space-x-3 text-xs">
                  <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded font-mono text-xxs border border-indigo-900 shrink-0">
                    {conn.category}
                  </span>
                  <div className="flex-1">
                    <span className="font-bold text-slate-200 block">{conn.title}</span>
                    <span className="text-xxs text-slate-400 leading-relaxed block mt-0.5">{conn.connectionReason}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ==========================================
              SECTION 10: Historical Timeline
             ========================================== */}
          <section id="sec-10" className="scroll-mt-6 space-y-3">
            <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
              <ListOrdered className="w-4 h-4 text-amber-400" />
              <span>Section 10 • Historical Chronological Timeline</span>
            </div>

            <div className="relative border-l-2 border-slate-800 ml-4 pl-4 space-y-4">
              {report.historicalTimeline.map((item, idx) => (
                <div key={idx} className="relative space-y-1">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-slate-950" />
                  <div className="flex items-center space-x-2 text-xxs font-mono text-slate-500">
                    <span>{item.date}</span>
                    <span>•</span>
                    <span className="text-amber-400 font-bold">{item.category}</span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-200">{item.event}</h5>
                  <p className="text-xxs text-slate-400 leading-relaxed">{item.impact}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ==========================================
              SECTION 11: Categorized Risk Analysis
             ========================================== */}
          <section id="sec-11" className="scroll-mt-6 bg-rose-950/10 border border-rose-900/40 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center space-x-2 text-rose-400 text-xs font-black uppercase tracking-wider border-b border-rose-900/40 pb-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Section 11 • Categorized Institutional Risk Matrix</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {report.riskAnalysis.map((rk, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1.5">
                  <strong className="text-rose-400 text-xxs uppercase tracking-wider block">{rk.category}</strong>
                  <ul className="space-y-1 text-xxs text-slate-300 list-disc list-inside">
                    {rk.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ==========================================
              SECTION 12: Opportunity Analysis
             ========================================== */}
          <section id="sec-12" className="scroll-mt-6 bg-emerald-950/10 border border-emerald-900/40 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-black uppercase tracking-wider border-b border-emerald-900/40 pb-2">
              <Rocket className="w-4 h-4 text-emerald-400" />
              <span>Section 12 • Structural Opportunity & Growth Catalysts</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                <strong className="text-emerald-400 text-xxs uppercase block">Growth Drivers</strong>
                <ul className="space-y-1 text-xxs text-slate-300 list-disc list-inside">
                  {report.opportunityAnalysis.growthDrivers.map((gd, i) => (
                    <li key={i}>{gd}</li>
                  ))}
                </ul>
              </div>

              {report.opportunityAnalysis.governmentIncentives && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                  <strong className="text-sky-400 text-xxs uppercase block">Government & Policy Incentives</strong>
                  <p className="text-slate-300 text-xxs leading-relaxed">{report.opportunityAnalysis.governmentIncentives}</p>
                </div>
              )}
            </div>
          </section>

          {/* ==========================================
              SECTION 13: Scenario Analysis
             ========================================== */}
          <section id="sec-13" className="scroll-mt-6 space-y-3">
            <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
              <PieChart className="w-4 h-4 text-indigo-400" />
              <span>Section 13 • Institutional Scenario Analysis</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {report.scenarioAnalysis.map((scen, idx) => (
                <div key={idx} className={`p-4 rounded-xl border space-y-3.5 ${
                  scen.type === 'Bull Case' ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300' :
                  scen.type === 'Bear Case' ? 'bg-rose-950/20 border-rose-800/60 text-rose-300' :
                  'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs uppercase tracking-wider">{scen.type}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 font-mono text-xxs font-bold">
                      {scen.probabilityPct}% Prob
                    </span>
                  </div>

                  <div>
                    <span className="text-xxs text-slate-400 uppercase tracking-wider block">Expected Impact</span>
                    <span className="text-lg font-black font-mono block mt-0.5">{scen.expectedImpactRange}</span>
                  </div>

                  <p className="text-xxs text-slate-300 leading-relaxed">
                    <strong>Catalyst:</strong> {scen.catalyst}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ==========================================
              SECTION 14: What To Watch Next
             ========================================== */}
          <section id="sec-14" className="scroll-mt-6 space-y-3">
            <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>Section 14 • What To Watch Next (Upcoming Catalysts)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {report.whatToWatchNext.map((wt, idx) => (
                <div key={idx} className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200 block">{wt.event}</span>
                    <span className="text-xxs text-slate-500 font-mono mt-0.5 block">Expected: {wt.expectedDate}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    wt.importance === 'Critical' ? 'bg-rose-950 text-rose-400 border border-rose-900' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {wt.importance}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ==========================================
              SECTION 15: Related Intelligence
             ========================================== */}
          <section id="sec-15" className="scroll-mt-6 space-y-3">
            <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
              <Link2 className="w-4 h-4 text-indigo-400" />
              <span>Section 15 • Related Intelligence & Connected Filings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {report.relatedIntelligence.map((rel, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200 block">{rel.title}</span>
                    <span className="text-xxs text-slate-500 font-mono mt-0.5 block">{rel.type} • {rel.source}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (onOpenOriginal) onOpenOriginal();
                      else if (rel.url) window.open(rel.url, '_blank', 'noopener,noreferrer');
                    }}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ==========================================
              SECTION 16: References
             ========================================== */}
          <section id="sec-16" className="scroll-mt-6 space-y-3 pb-8">
            <div className="flex items-center space-x-2 text-slate-200 text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Section 16 • References & Verification Log</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {report.references.map((ref, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200 block">{ref.sourceName}</span>
                    <span className="text-xxs text-slate-500 font-mono mt-0.5 block">{ref.type}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-900 text-[10px] font-bold rounded">
                    VERIFIED
                  </span>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Bottom Footer Bar */}
        <div className="p-3.5 bg-[#080d1a] border-t border-slate-800 flex items-center justify-between shrink-0 text-xxs font-mono text-slate-500">
          <span>ATHENA V10.1 • Institutional Bloomberg/Refinitiv Research Format</span>
          <button
            onClick={() => {
              if (onOpenOriginal) onOpenOriginal();
              else window.open(report.originalUrl, '_blank', 'noopener,noreferrer');
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3 text-slate-400" />
            <span>View Primary Source Filing</span>
          </button>
        </div>

      </div>
    </div>
  );
}
