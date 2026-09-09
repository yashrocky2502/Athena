/**
 * ATHENA — Phase 26.1: Delete Confirmation Modal
 * DeleteConfirmModal.tsx
 * 
 * Safe in-app replacement for browser confirm(), compliant with iFrame constraints.
 */

import React, { useState } from "react";
import { AlertTriangle, Trash2, X, ShieldCheck } from "lucide-react";

interface DeleteConfirmModalProps {
  item: {
    type: "HOLDING" | "POSITION";
    id: string;
    symbol: string;
  };
  portfolioId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function DeleteConfirmModal({
  item,
  portfolioId,
  onClose,
  onSuccess
}: DeleteConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmDelete = async () => {
    setSubmitting(true);
    try {
      const endpoint = item.type === "HOLDING"
        ? `/api/v4/portfolio/holdings/${item.id}?portfolioId=${portfolioId}`
        : `/api/v4/portfolio/positions/${item.id}?portfolioId=${portfolioId}`;

      const res = await fetch(endpoint, { method: "DELETE" }).then(r => r.json());
      if (res.error) throw new Error(res.error);

      onSuccess(`Removed ${item.symbol} from active ${item.type.toLowerCase()}s.`);
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to delete item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-6">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-base font-bold text-white">
              Remove {item.type === "HOLDING" ? "Holding" : "Position"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to remove <span className="font-bold text-white font-mono">{item.symbol}</span> from your active portfolio?
          </p>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300 block mb-0.5">Audit Integrity Protected:</span>
              Your past cash transactions and historical snapshot states will remain securely recorded in the immutable ledger.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmDelete}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{submitting ? "Removing..." : `Remove ${item.symbol}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
