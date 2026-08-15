import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  XCircle,
  Search,
  Award,
  Sliders,
  ShieldAlert,
  ListFilter,
  Zap,
  BarChart3,
  Sparkles,
  RefreshCw,
  FileText,
  TrendingDown,
  ExternalLink,
  Target
} from 'lucide-react';
import type {
  Phase1SourceContribution,
  DuplicateStoryEntry,
  SourceQualityMetrics,
  MissingSourceRecord,
  FnOCoverageMetrics,
  TimelineEventRecord,
  WeakSourceRecommendation,
  ExecutiveReportRow,
  EffectivenessAuditReport
} from '../../news/NewsEngine/EffectivenessAuditEngine';

export default function SourceEffectivenessAuditPanel() {
  const [report, setReport] = useState<EffectivenessAuditReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7' | 'p8'>('p8');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [recFilter, setRecFilter] = useState<string>('ALL');

  const fetchAuditReport = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/effectiveness-audit');
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
      }
    } catch (err) {
      console.error('[SourceEffectivenessAuditPanel] Error fetching effectiveness audit:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditReport();
  }, []);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4" id="audit-loading">
        <RefreshCw className="w-10 h-10 animate-spin text-emerald-600" />
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-200">Generating V9.2.8 Effectiveness Report...</p>
          <p className="text-sm text-slate-400">Measuring 7-day production usefulness, F&O coverage, and duplication levels</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-slate-400 border border-dashed border-slate-700 rounded-xl" id="audit-error">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
        <p className="text-base font-medium">Failed to retrieve news effectiveness audit data.</p>
        <button
          onClick={fetchAuditReport}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors"
        >
          Retry Load
        </button>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 bg-emerald-950/50 border-emerald-800';
    if (score >= 65) return 'text-sky-400 bg-sky-950/50 border-sky-800';
    if (score >= 40) return 'text-yellow-400 bg-yellow-950/50 border-yellow-800';
    return 'text-rose-400 bg-rose-950/50 border-rose-800';
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'KEEP':
        return <span className="px-2 py-1 text-xs font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800 rounded-md">KEEP</span>;
      case 'KEEP WITH LOW PRIORITY':
        return <span className="px-2 py-1 text-xs font-semibold bg-blue-950/70 text-blue-400 border border-blue-800 rounded-md">KEEP LOW PRIORITY</span>;
      case 'FIX':
        return <span className="px-2 py-1 text-xs font-semibold bg-yellow-950/70 text-yellow-400 border border-yellow-800 rounded-md">FIX</span>;
      case 'REPLACE':
        return <span className="px-2 py-1 text-xs font-semibold bg-orange-950/70 text-orange-400 border border-orange-800 rounded-md">REPLACE</span>;
      case 'REMOVE':
        return <span className="px-2 py-1 text-xs font-semibold bg-rose-950/70 text-rose-400 border border-rose-800 rounded-md">REMOVE</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold bg-slate-800 text-slate-300 rounded-md">{rec}</span>;
    }
  };

  return (
    <div className="space-y-6" id="effectiveness-audit-panel">
      {/* Overview Stats Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6" id="audit-stats-header">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">V9.2.8</span>
              <h2 className="text-xl font-bold text-slate-100">News Source Effectiveness Audit</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active production audit analyzing the actual intelligence contributions and noise level over the last <strong>7 days</strong>.
            </p>
          </div>
          <button
            onClick={fetchAuditReport}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Recalculating...' : 'Refresh Metrics'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950 p-4 border border-slate-800/60 rounded-lg">
            <span className="text-xxs text-slate-400 uppercase tracking-wider block">Articles Evaluated</span>
            <span className="text-xl font-bold text-slate-100 mt-1 block">{report.totalArticlesEvaluated.toLocaleString()}</span>
            <span className="text-xxs text-slate-500 mt-0.5 block">Total pipeline attempts</span>
          </div>
          <div className="bg-slate-950 p-4 border border-slate-800/60 rounded-lg">
            <span className="text-xxs text-slate-400 uppercase tracking-wider block">Duplicates Detected</span>
            <span className="text-xl font-bold text-yellow-500 mt-1 block">{report.totalDuplicatesDetected.toLocaleString()}</span>
            <span className="text-xxs text-slate-500 mt-0.5 block">{report.phase2.averageDuplicatePct}% duplication level</span>
          </div>
          <div className="bg-slate-950 p-4 border border-slate-800/60 rounded-lg">
            <span className="text-xxs text-slate-400 uppercase tracking-wider block">Overall Pipeline Fidelity</span>
            <span className="text-xl font-bold text-emerald-400 mt-1 block">{report.overallFidelityPct}%</span>
            <span className="text-xxs text-slate-500 mt-0.5 block">Unique, actionable intelligence</span>
          </div>
          <div className="bg-slate-950 p-4 border border-slate-800/60 rounded-lg">
            <span className="text-xxs text-slate-400 uppercase tracking-wider block">Configured Sources</span>
            <span className="text-xl font-bold text-sky-400 mt-1 block">{report.phase1.length}</span>
            <span className="text-xxs text-slate-500 mt-0.5 block">25 active ingest feeds</span>
          </div>
        </div>
      </div>

      {/* Audit Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2" id="audit-tabs">
        <button
          onClick={() => setActiveTab('p8')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            activeTab === 'p8'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
          }`}
        >
          Phase 8: Executive Report
        </button>
        <button
          onClick={() => setActiveTab('p1')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            activeTab === 'p1'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
          }`}
        >
          Phase 1: Source Contribution
        </button>
        <button
          onClick={() => setActiveTab('p2')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            activeTab === 'p2'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
          }`}
        >
          Phase 2: Duplicate Analysis
        </button>
        <button
          onClick={() => setActiveTab('p3')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            activeTab === 'p3'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
          }`}
        >
          Phase 3: Source Quality
        </button>
        <button
          onClick={() => setActiveTab('p4')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all relative ${
            activeTab === 'p4'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
          }`}
        >
          Phase 4: Missing Sources
          {report.phase4.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
              {report.phase4.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('p5')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            activeTab === 'p5'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
          }`}
        >
          Phase 5: F&O Coverage
        </button>
        <button
          onClick={() => setActiveTab('p6')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            activeTab === 'p6'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
          }`}
        >
          Phase 6: Timeline Audit
        </button>
        <button
          onClick={() => setActiveTab('p7')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            activeTab === 'p7'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
          }`}
        >
          Phase 7: Action Plan
        </button>
      </div>

      {/* Render Active View */}
      <div className="bg-slate-950/40 rounded-xl" id="active-audit-view">
        {/* PHASE 8: EXECUTIVE REPORT (MAIN DASHBOARD) */}
        {activeTab === 'p8' && (
          <div className="space-y-4" id="view-phase-8">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <span>Configured Sources Executive Matrix</span>
                </h3>
                <p className="text-xs text-slate-400">Ranked by overall Contribution Score based on usefulness & F&O density</p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search sources..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg focus:outline-none focus:border-slate-700 w-44"
                  />
                </div>
                <select
                  value={recFilter}
                  onChange={(e) => setRecFilter(e.target.value)}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg focus:outline-none focus:border-slate-700"
                >
                  <option value="ALL">All Actions</option>
                  <option value="KEEP">KEEP</option>
                  <option value="KEEP WITH LOW PRIORITY">KEEP LOW PRIORITY</option>
                  <option value="FIX">FIX</option>
                  <option value="REPLACE">REPLACE</option>
                  <option value="REMOVE">REMOVE</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-mono text-xxs uppercase tracking-wider">
                    <th className="py-3 px-4 text-center w-12">Rank</th>
                    <th className="py-3 px-4">Source Name</th>
                    <th className="py-3 px-4 text-center">Contribution Score</th>
                    <th className="py-3 px-4 text-center">Quality Score</th>
                    <th className="py-3 px-4 text-center">Noise %</th>
                    <th className="py-3 px-4 text-center">Unique F&O Articles</th>
                    <th className="py-3 px-4 text-center">Telegram Alerts</th>
                    <th className="py-3 px-4 text-center">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/65 text-xs text-slate-300">
                  {report.phase8
                    .filter(
                      (row) =>
                        row.sourceName.toLowerCase().includes(searchTerm.toLowerCase()) &&
                        (recFilter === 'ALL' || row.recommendation === recFilter)
                    )
                    .map((row) => (
                      <tr key={row.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4 text-center font-bold text-slate-400 font-mono">{row.rank}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-200">{row.sourceName.split(' — ')[0]}</span>
                          <span className="text-slate-500 block text-xxs mt-0.5">{row.sourceName.split(' — ')[1]}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 font-mono rounded-md border text-xs font-bold ${getScoreColor(row.contributionScore)}`}>
                            {row.contributionScore}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono text-slate-200">{row.qualityScore}/100</td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className={`${row.noisePct > 50 ? 'text-rose-400 font-bold' : row.noisePct > 20 ? 'text-yellow-500' : 'text-slate-400'}`}>
                            {row.noisePct}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-200 font-mono">{row.uniqueFnO}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-300">
                          <span className="flex items-center justify-center space-x-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${row.telegramAlerts > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                            <span>{row.telegramAlerts}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">{getRecommendationBadge(row.recommendation)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PHASE 1: SOURCE CONTRIBUTION AUDIT */}
        {activeTab === 'p1' && (
          <div className="space-y-4 animate-fade-in" id="view-phase-1">
            <div className="pb-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <span>Production Source Contribution Metrics</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Extensive 7-day performance tracking metrics showing total volume, parsing efficiency, and actual accepted/rejected/duplicate counts.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-mono text-xxs uppercase tracking-wider">
                    <th className="py-3 px-3">Source Name</th>
                    <th className="py-3 px-2 text-center">Status</th>
                    <th className="py-3 px-2 text-center">Retrieved</th>
                    <th className="py-3 px-2 text-center">Parsed</th>
                    <th className="py-3 px-2 text-center">Accepted</th>
                    <th className="py-3 px-2 text-center">Rejected</th>
                    <th className="py-3 px-2 text-center">Duplicates</th>
                    <th className="py-3 px-2 text-center">Unique Total</th>
                    <th className="py-3 px-2 text-center">Unique F&O</th>
                    <th className="py-3 px-2 text-center">Daily Avg</th>
                    <th className="py-3 px-2 text-center">TG Alerts</th>
                    <th className="py-3 px-3">Last Success (Article / F&O)</th>
                    <th className="py-3 px-2 text-center">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/65 text-xxs font-mono text-slate-300">
                  {report.phase1.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3 font-sans text-xs">
                        <span className="font-semibold text-slate-200 block">{s.sourceName.split(' — ')[0]}</span>
                        <span className="text-slate-500 text-xxs block truncate max-w-xs">{s.sourceName.split(' — ')[1]}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${s.httpStatus === 200 ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-rose-950 text-rose-400 border border-rose-900'}`}>
                          HTTP {s.httpStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-200">{s.articlesRetrieved}</td>
                      <td className="py-2.5 px-2 text-center text-slate-400">{s.articlesParsed}</td>
                      <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">{s.articlesAccepted}</td>
                      <td className="py-2.5 px-2 text-center text-rose-400">{s.articlesRejected}</td>
                      <td className="py-2.5 px-2 text-center text-yellow-500">{s.duplicateArticles}</td>
                      <td className="py-2.5 px-2 text-center text-slate-200 font-bold">{s.uniqueArticles}</td>
                      <td className="py-2.5 px-2 text-center text-cyan-400 font-bold">{s.uniqueFnOArticles}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-200">{s.averageDailyContribution}/d</td>
                      <td className="py-2.5 px-2 text-center text-purple-400 font-bold">{s.telegramNotificationsGenerated}</td>
                      <td className="py-2.5 px-3 font-sans text-xxs text-slate-400">
                        <div className="flex flex-col space-y-0.5">
                          <span className="truncate max-w-xs block">
                            📰 {s.lastSuccessfulArticleTime ? new Date(s.lastSuccessfulArticleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </span>
                          <span className="truncate max-w-xs text-slate-500 font-semibold block">
                            🎯 {s.lastSuccessfulFnOArticleTime !== 'N/A' ? new Date(s.lastSuccessfulFnOArticleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${getScoreColor(s.contributionScore)}`}>
                          {s.contributionScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PHASE 2: DUPLICATE ANALYSIS */}
        {activeTab === 'p2' && (
          <div className="space-y-4" id="view-phase-2">
            <div className="bg-slate-900/50 p-5 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <TrendingDown className="w-5 h-5 text-yellow-500" />
                  <span>Deduplication & Cross-Source Collision Intelligence</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  How much of your feed is redundant? Over 7 days, ATHENA filtered out {report.totalDuplicatesDetected} duplicate notifications, guaranteeing zero notification fatigue.
                </p>
              </div>
              <div className="bg-slate-950 px-4 py-2 border border-slate-800 rounded-lg text-center md:text-right">
                <span className="text-xxs text-slate-400 uppercase tracking-wider block">Avg Duplication Level</span>
                <span className="text-xl font-black text-yellow-500 font-mono mt-0.5 block">{report.phase2.averageDuplicatePct}%</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">Top 20 Duplicate Events Intercepted in the Last 7 Days</h4>
              <div className="grid gap-3" id="top-duplicates-list">
                {report.phase2.topDuplicates.map((dup) => (
                  <div key={dup.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-2 max-w-3xl">
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="px-1.5 py-0.5 bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-semibold rounded">{dup.category}</span>
                        {dup.ticker && <span className="px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-900 text-[10px] font-bold rounded">{dup.ticker}</span>}
                        <span className="text-xxs text-slate-500 font-mono">🕒 {new Date(dup.publishTime).toLocaleDateString()} {new Date(dup.publishTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <h5 className="text-sm font-bold text-slate-200">{dup.headline}</h5>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xxs">
                        <div className="bg-slate-950 p-2 border border-slate-800/45 rounded-md">
                          <span className="text-slate-500 block">🏆 First Published (Master Source)</span>
                          <span className="text-emerald-400 font-bold block mt-0.5">🚀 {dup.masterSource}</span>
                        </div>
                        <div className="bg-slate-950 p-2 border border-slate-800/45 rounded-md">
                          <span className="text-slate-500 block">🛑 Prevented Duplicates (Syndicated)</span>
                          <span className="text-slate-300 font-medium block mt-0.5 truncate">{dup.duplicateSources.join(', ')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col justify-between sm:justify-center border-t sm:border-t-0 border-slate-800/60 pt-2 sm:pt-0">
                      <span className="text-xxs text-slate-400 font-mono uppercase block">Detection Signature</span>
                      <span className="text-xxs font-semibold text-yellow-500 mt-1 max-w-[200px] text-left sm:text-right block">{dup.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 3: SOURCE QUALITY & NOISE ANALYSIS */}
        {activeTab === 'p3' && (
          <div className="space-y-6" id="view-phase-3">
            <div className="pb-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>Source Article Quality & Fact Density Metrics</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                A quantitative audit measuring the structure, fact density, neural confidence level, and noise percentage across all configured feeds.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Quality Table */}
              <div className="xl:col-span-2 overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/40">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-mono text-xxs uppercase tracking-wider">
                      <th className="py-3 px-4">Source Name</th>
                      <th className="py-3 px-3 text-center">Avg Char Len</th>
                      <th className="py-3 px-3 text-center">Fact Density</th>
                      <th className="py-3 px-3 text-center">AI Conf</th>
                      <th className="py-3 px-3 text-center">Impact Score</th>
                      <th className="py-3 px-3 text-center">Urgency</th>
                      <th className="py-3 px-3 text-center">Summary Q</th>
                      <th className="py-3 px-3 text-center">Noise %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/65 text-xxs font-mono text-slate-300">
                    {report.phase3.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4 font-sans text-xs font-semibold text-slate-200">
                          {q.sourceName.split(' — ')[0]}
                          <span className="text-slate-500 block text-xxs font-mono font-normal mt-0.5">{q.sourceName.split(' — ')[1]}</span>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300">{q.avgArticleLength} chars</td>
                        <td className="py-3 px-3 text-center font-bold">
                          <span className={`${q.avgFactDensity > 0.8 ? 'text-emerald-400' : q.avgFactDensity > 0.5 ? 'text-sky-400' : 'text-slate-500'}`}>
                            {Math.round(q.avgFactDensity * 100)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400">{Math.round(q.avgAiConfidence * 100)}%</td>
                        <td className="py-3 px-3 text-center text-slate-200">{q.avgImpactScore.toFixed(1)}/5</td>
                        <td className="py-3 px-3 text-center text-slate-200">{q.avgUrgency.toFixed(1)}/5</td>
                        <td className="py-3 px-3 text-center font-sans">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${q.avgExecSummaryQuality === 'Excellent' ? 'bg-emerald-950 text-emerald-400' : q.avgExecSummaryQuality === 'Good' ? 'bg-blue-950 text-blue-400' : q.avgExecSummaryQuality === 'Fair' ? 'bg-yellow-950 text-yellow-400' : 'bg-rose-950 text-rose-400'}`}>
                            {q.avgExecSummaryQuality}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-bold ${q.noisePct > 50 ? 'text-rose-400' : q.noisePct > 20 ? 'text-yellow-500' : 'text-slate-500'}`}>
                            {q.noisePct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Noise Definition Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2 text-rose-400 border-b border-slate-800 pb-3">
                  <ShieldAlert className="w-5 h-5" />
                  <h4 className="font-bold text-sm">Noise Definiton & Examples</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  "Noise" consists of non-actionable, repetitive, or algorithmic pages that trigger scrapers but contain zero actual corporate intelligence. This bloats memory caches and causes unnecessary AI summarization load.
                </p>

                <div className="space-y-3 pt-2 text-xs">
                  <div className="bg-slate-950 p-3 border border-slate-800 rounded-lg">
                    <span className="font-bold text-slate-200 block mb-1">📉 Share Price Live Widgets</span>
                    <span className="text-slate-400 text-xxs">Static tickers or widget container pages showing standard trading prices with no news narrative.</span>
                  </div>
                  <div className="bg-slate-950 p-3 border border-slate-800 rounded-lg">
                    <span className="font-bold text-slate-200 block mb-1">⏱️ Minute-by-Minute Blogs</span>
                    <span className="text-slate-400 text-xxs">Live market commentary blogs that update every 60 seconds. Each update republishes the whole feed, generating hundreds of duplicate hashes.</span>
                  </div>
                  <div className="bg-slate-950 p-3 border border-slate-800 rounded-lg">
                    <span className="font-bold text-slate-200 block mb-1">🔍 SEO Filler Pages</span>
                    <span className="text-slate-400 text-xxs">Synthesized stock advice articles written by SEO bots ("Why Reliance shares are active today") with zero primary information.</span>
                  </div>
                  <div className="bg-slate-950 p-3 border border-slate-800 rounded-lg">
                    <span className="font-bold text-slate-200 block mb-1">📆 Historical / Repeated Pages</span>
                    <span className="text-slate-400 text-xxs">Brokers republished buy/sell lists, historical dividend tables, or standard static corporate information cards.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 4: MISSING / REDUNDANT SOURCES */}
        {activeTab === 'p4' && (
          <div className="space-y-4" id="view-phase-4">
            <div className="bg-rose-950/20 border border-rose-900 p-5 rounded-xl flex items-start space-x-3">
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-rose-400">Inefficient / Redundant Ingestion Inlets</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  These sources are fully configured in your RSS scraper but contribute **ZERO** unique actionable insights. Over the last 7 days, 100% of their content was flagged as duplicates or noise and discarded by our deduplication layers. It is strongly recommended to remove or disable these feeds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="missing-sources-grid">
              {report.phase4.map((m) => (
                <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold rounded">ZERO UTILITY</span>
                      <span className="text-xxs text-slate-500 font-mono">Configured: YES</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-100">{m.sourceName.split(' — ')[0]}</h4>
                    <span className="text-xxs text-slate-500 font-mono block mb-3">{m.sourceName.split(' — ')[1]}</span>

                    <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-850 text-center text-xs">
                      <div>
                        <span className="text-xxs text-slate-500 block">Retrieved</span>
                        <span className="font-mono font-bold text-slate-300 block mt-0.5">{m.articlesRetrieved}</span>
                      </div>
                      <div>
                        <span className="text-xxs text-slate-500 block">Unique</span>
                        <span className="font-mono font-bold text-slate-300 block mt-0.5">{m.uniqueArticles}</span>
                      </div>
                      <div>
                        <span className="text-xxs text-slate-500 block">Unique F&O</span>
                        <span className="font-mono font-bold text-slate-300 block mt-0.5">{m.uniqueFnO}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-850 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Effectiveness Score</span>
                      <span className="font-mono font-bold text-rose-400">{m.contributionScore}/100</span>
                    </div>
                    <p className="text-xxs text-rose-300 bg-rose-950/30 p-2 border border-rose-950 rounded leading-relaxed">
                      <strong>Audit Reason:</strong> {m.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHASE 5: F&O COVERAGE ANALYSIS */}
        {activeTab === 'p5' && (
          <div className="space-y-4" id="view-phase-5">
            <div className="pb-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Target className="w-5 h-5 text-emerald-400" />
                <span>Futures & Options (F&O) Market Coverage</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Out of 182 active F&O listed companies in the Indian equity market, how many are actively reported by each source? This measures market depth and coverage.
              </p>
            </div>

            <div className="grid gap-3" id="fno-coverage-list">
              {report.phase5.map((f) => (
                <div key={f.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">{f.sourceName}</h4>
                      <p className="text-xxs text-slate-500 font-mono mt-0.5">Coverage ratio: {f.companiesCovered}/182 listed corporate entities</p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-32 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${f.coveragePct}%` }}></div>
                      </div>
                      <span className="text-xs font-bold text-emerald-400 font-mono w-12 text-right">{f.coveragePct}%</span>
                    </div>
                  </div>

                  {f.companiesCovered > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xxs">
                      <div className="bg-slate-950 p-2.5 border border-slate-850 rounded-lg">
                        <span className="text-slate-500 font-semibold block mb-1">🔥 Top Tickers Covered</span>
                        <div className="flex flex-wrap gap-1">
                          {f.topCompanies.map((ticker) => (
                            <span key={ticker} className="px-1 py-0.5 bg-slate-900 text-slate-300 font-bold border border-slate-800 rounded">{ticker}</span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-slate-950 p-2.5 border border-slate-850 rounded-lg">
                        <span className="text-rose-400 font-semibold block mb-1">⚠️ Major Missed Companies</span>
                        <div className="flex flex-wrap gap-1">
                          {f.missedCompanies.map((ticker) => (
                            <span key={ticker} className="px-1 py-0.5 bg-rose-950/20 text-rose-300 border border-rose-950 rounded">{ticker}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-950 p-3 border border-slate-850 rounded-lg text-center text-xxs text-slate-500 italic">
                      No Indian F&O equity coverage detected (e.g. global macro / crypto wire).
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHASE 6: TIMELINE AUDIT */}
        {activeTab === 'p6' && (
          <div className="space-y-4" id="view-phase-6">
            <div className="pb-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <span>Primary News Flash Latency Race (Timeline Ingestion Audit)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                A granular timeline audit analyzing which news sources published first on major market-moving events, and the delay in seconds until duplicated by other publications.
              </p>
            </div>

            <div className="space-y-6" id="timeline-audit-events">
              {report.phase6.map((evt) => (
                <div key={evt.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="border-b border-slate-800 pb-2">
                    <h4 className="text-sm font-bold text-slate-100">{evt.eventName}</h4>
                    <span className="text-xxs text-slate-500 font-mono mt-1 block">Audit Interval: Sub-second network latency resolution</span>
                  </div>

                  <div className="relative pl-6 space-y-4 border-l border-slate-800">
                    {evt.publishers.map((pub, idx) => (
                      <div key={pub.publisher} className="relative">
                        {/* Bullet point */}
                        <span className={`absolute -left-[30px] top-1.5 h-3 w-3 rounded-full border-2 ${idx === 0 ? 'bg-emerald-500 border-emerald-900' : idx === 1 ? 'bg-sky-500 border-sky-900' : 'bg-slate-700 border-slate-900'}`}></span>
                        
                        <div className="bg-slate-950 border border-slate-850/60 p-3 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Publisher Order {pub.order}</span>
                            <span className="text-xs font-bold text-slate-200 mt-0.5 block">{pub.publisher}</span>
                          </div>

                          <div className="flex items-center space-x-4 text-xs">
                            <span className="text-slate-500 font-mono">{new Date(pub.timeIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            {idx === 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 font-bold border border-emerald-900 rounded text-xxs font-mono">🥇 FIRST (0 sec)</span>
                            ) : (
                              <span className={`px-2 py-0.5 font-bold rounded text-xxs font-mono ${pub.delaySec > 120 ? 'bg-rose-950 text-rose-400 border border-rose-900' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                                + {pub.delaySec >= 60 ? `${Math.floor(pub.delaySec / 60)}m ${pub.delaySec % 60}s` : `${pub.delaySec} sec`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHASE 7: WEAK SOURCE ACTION PLAN / RECOMMENDATIONS */}
        {activeTab === 'p7' && (
          <div className="space-y-4 animate-fade-in" id="view-phase-7">
            <div className="pb-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <span>Weak Inlets Restructuring Action Plan</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Recommendations to replace low-fidelity, slow, or noisy news feeds with high-performing institutional sources to make ATHENA smarter.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="action-plan-recommendations">
              {report.phase7.map((rec) => (
                <div key={rec.id} className="bg-slate-900 border border-slate-850 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-900 text-[10px] font-bold rounded">WEAK PERFORMANCE</span>
                      <span className="text-xxs font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{rec.weaknessCategory}</span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-100">{rec.sourceName.split(' — ')[0]}</h4>
                    <span className="text-xxs text-slate-500 font-mono block mb-3">{rec.sourceName.split(' — ')[1]}</span>

                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      <strong>Detailed Weakness:</strong> {rec.detailedWhy}
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3 border border-slate-850 rounded-lg space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Pipeline Recommendation</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${rec.recommendation === 'REMOVE' ? 'bg-rose-950 text-rose-400' : 'bg-yellow-950 text-yellow-400'}`}>
                        {rec.recommendation}
                      </span>
                    </div>
                    {rec.suggestedReplacement && rec.suggestedReplacement !== 'None' && (
                      <div className="text-xxs border-t border-slate-900 pt-2 text-slate-300">
                        <span className="text-slate-500 block font-semibold mb-0.5">💡 Suggested Replacement Source</span>
                        <span className="font-bold text-emerald-400 block">{rec.suggestedReplacement}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
