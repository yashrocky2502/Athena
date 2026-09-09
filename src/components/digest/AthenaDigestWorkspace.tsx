/**
 * ATHENA — Phase 21: Contextual Market Intelligence Digest Workspace
 * AthenaDigestWorkspace.tsx
 * 
 * Replaces the bottom Command navigation with the canonical 4-stage Market Intelligence Digest:
 * 1. Morning Brief
 * 2. Afternoon Shift
 * 3. Evening Closing Report
 * 4. Full Day Chronicle
 * 
 * Includes Previous Day intelligence & historical date navigation.
 */

import React, { useState, useMemo } from 'react';
import { 
  BookOpen, Sun, Sunset, Sunrise, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, RotateCcw, ShieldCheck, 
  Sparkles, History, Filter 
} from 'lucide-react';
import { DigestPeriod } from '../../news/digest/DigestTypes.ts';
import { MarketDigestEngine } from '../../news/digest/MarketDigestEngine.ts';
import MorningDigestView from './MorningDigestView.tsx';
import AfternoonDigestView from './AfternoonDigestView.tsx';
import EveningDigestView from './EveningDigestView.tsx';
import FullDayDigestView from './FullDayDigestView.tsx';
import EvidenceModal from './EvidenceModal.tsx';
import { MarketCauseAnalysisEngine } from '../../news/search/MarketCauseAnalysisEngine.ts';

export default function AthenaDigestWorkspace() {
  const [selectedPeriod, setSelectedPeriod] = useState<DigestPeriod>('MORNING');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);

  const digestEngine = useMemo(() => MarketDigestEngine.getInstance(), []);

  // Compute active digest data based on period and date
  const morningData = useMemo(() => digestEngine.getMorningDigest(selectedDate), [digestEngine, selectedDate]);
  const afternoonData = useMemo(() => digestEngine.getAfternoonDigest(selectedDate), [digestEngine, selectedDate]);
  const eveningData = useMemo(() => digestEngine.getEveningDigest(selectedDate), [digestEngine, selectedDate]);
  const fullDayData = useMemo(() => digestEngine.getFullDayDigest(selectedDate), [digestEngine, selectedDate]);

  // Evidence chain for modal inspection
  const evidenceChain = useMemo(() => {
    const marketDiagnosis = MarketCauseAnalysisEngine.getInstance().diagnoseMarketMovement('Why is market down today?', 'NIFTY 50');
    return marketDiagnosis.evidence;
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isToday = selectedDate === todayStr;

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const nextStr = d.toISOString().split('T')[0];
    if (nextStr <= todayStr) {
      setSelectedDate(nextStr);
    }
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 p-4 md:p-6 pb-24 max-w-7xl mx-auto space-y-6">
      {/* Top Workspace Header & Date Navigator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">ATHENA Market Digest</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Phase 21 Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Four-stage institutional market intelligence, historical day navigation &amp; causal diagnosis.
          </p>
        </div>

        {/* Date Navigator Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2 font-mono text-xs font-semibold text-slate-200">
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-slate-200 focus:outline-none cursor-pointer text-xs"
            />
          </div>

          <button
            onClick={handleNextDay}
            disabled={isToday}
            className={`p-1.5 rounded-lg transition ${
              isToday ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isToday && (
            <button
              onClick={handleToday}
              className="ml-1 px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[11px] font-semibold transition"
            >
              Back to Today
            </button>
          )}
        </div>
      </div>

      {/* 4-Stage Period Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedPeriod('MORNING')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
            selectedPeriod === 'MORNING'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-sm'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <Sunrise className="w-4 h-4 text-amber-400" />
          <span>🌅 Morning Brief</span>
          <span className="text-[10px] opacity-60 font-mono">08:15</span>
        </button>

        <button
          onClick={() => setSelectedPeriod('AFTERNOON')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
            selectedPeriod === 'AFTERNOON'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-sm'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <Sun className="w-4 h-4 text-amber-400" />
          <span>☀️ Afternoon Shift</span>
          <span className="text-[10px] opacity-60 font-mono">13:30</span>
        </button>

        <button
          onClick={() => setSelectedPeriod('EVENING')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
            selectedPeriod === 'EVENING'
              ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 shadow-sm'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <Sunset className="w-4 h-4 text-indigo-400" />
          <span>🌆 Evening Closing</span>
          <span className="text-[10px] opacity-60 font-mono">16:30</span>
        </button>

        <button
          onClick={() => setSelectedPeriod('FULL_DAY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
            selectedPeriod === 'FULL_DAY'
              ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 shadow-sm'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span>📚 Full Day Chronicle</span>
          <span className="text-[10px] opacity-60 font-mono">End of Day</span>
        </button>

        <div className="ml-auto pl-2 hidden sm:block">
          <button
            onClick={() => setIsEvidenceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Audit Evidence</span>
          </button>
        </div>
      </div>

      {/* Dynamic View Rendering */}
      {selectedPeriod === 'MORNING' && (
        <MorningDigestView data={morningData} onOpenEvidence={() => setIsEvidenceModalOpen(true)} />
      )}

      {selectedPeriod === 'AFTERNOON' && (
        <AfternoonDigestView data={afternoonData} onOpenEvidence={() => setIsEvidenceModalOpen(true)} />
      )}

      {selectedPeriod === 'EVENING' && (
        <EveningDigestView data={eveningData} onOpenEvidence={() => setIsEvidenceModalOpen(true)} />
      )}

      {selectedPeriod === 'FULL_DAY' && (
        <FullDayDigestView data={fullDayData} onOpenEvidence={() => setIsEvidenceModalOpen(true)} />
      )}

      {/* Evidence Inspection Modal */}
      <EvidenceModal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        evidence={evidenceChain}
        title={`ATHENA Evidence Audit Matrix — ${selectedDate}`}
      />
    </div>
  );
}
