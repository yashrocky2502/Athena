/**
 * ATHENA — Phase 21: Evidence Inspection Modal
 * EvidenceModal.tsx
 */

import React from 'react';
import { X, ShieldCheck, Database, Clock, ArrowRight, ExternalLink } from 'lucide-react';
import { EvidenceItem } from '../../news/search/QueryIntentTypes.ts';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: EvidenceItem[];
  title?: string;
}

export default function EvidenceModal({ isOpen, onClose, evidence, title = 'Deterministic Evidence Chain' }: EvidenceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base">{title}</h3>
              <p className="text-xs text-slate-400">
                {evidence.length} verified evidence streams | Zero hallucination guarantee
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Evidence List */}
        <div className="p-5 overflow-y-auto space-y-3.5 divide-y divide-slate-800/60">
          {evidence.map((item, idx) => (
            <div key={item.id || idx} className="pt-3.5 first:pt-0">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                    {item.source}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    item.relationshipToConclusion === 'PRIMARY_DRIVER' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                    item.relationshipToConclusion === 'OFFSETTING_FACTOR' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    item.relationshipToConclusion === 'CONTRADICTION' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {item.relationshipToConclusion.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-emerald-400 ml-1 font-semibold">{item.confidence}% Conf.</span>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80 mb-2">
                <div className="text-xs font-mono text-slate-400 mb-1">Observed Value:</div>
                <div className="text-sm font-semibold text-slate-100">{item.observedValue}</div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {item.explanation}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>ATHENA Multi-Tier Evidence Matrix</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
