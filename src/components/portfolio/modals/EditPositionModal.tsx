/**
 * ATHENA — Phase 26.1: Edit Position Modal
 * EditPositionModal.tsx
 * 
 * Allows modifying existing derivative positions (quantity, entry, current LTP, strike, expiry, notes)
 * and triggering immediate deterministic recalculation of Greeks and MTM P&L.
 */

import React, { useState } from "react";
import { X, CheckCircle2, Info, Sliders } from "lucide-react";
import { CanonicalPosition } from "../../../news/portfolio/broker/types.ts";

interface EditPositionModalProps {
  portfolioId: string;
  position: CanonicalPosition;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function EditPositionModal({
  portfolioId,
  position,
  onClose,
  onSuccess
}: EditPositionModalProps) {
  const [quantity, setQuantity] = useState(position.quantity.toString());
  const [entryPrice, setEntryPrice] = useState(position.entryPrice.toString());
  const [currentPrice, setCurrentPrice] = useState(position.currentPrice.toString());
  const [strikePrice, setStrikePrice] = useState(position.strikePrice?.toString() || "");
  const [expiryDate, setExpiryDate] = useState(position.expiryDate || "");
  const [notes, setNotes] = useState(position.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numQty = parseFloat(quantity) || 0;
  const numEntry = parseFloat(entryPrice) || 0;
  const numCur = parseFloat(currentPrice) || numEntry;

  const mtmPnL = position.side === "LONG"
    ? (numCur - numEntry) * numQty
    : (numEntry - numCur) * numQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numQty === 0) {
      setErrorMsg("Quantity cannot be zero.");
      return;
    }
    if (numEntry <= 0) {
      setErrorMsg("Entry price must be greater than 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v4/portfolio/positions/${position.id}?portfolioId=${portfolioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: numQty,
          entryPrice: numEntry,
          currentPrice: numCur,
          strikePrice: strikePrice ? parseFloat(strikePrice) : undefined,
          expiryDate: expiryDate || undefined,
          notes: notes.trim() || undefined
        })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      onSuccess(`Updated position ${position.symbol}.`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update position.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${position.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                {position.side}
              </span>
              <h3 className="text-base font-bold text-white">Edit Position: {position.symbol}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {position.assetClass} • Underlying: {position.underlying}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Quantity *</label>
              <input
                type="number"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Entry Price (₹) *</label>
              <input
                type="number"
                required
                step="0.05"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Current LTP (₹)</label>
              <input
                type="number"
                step="0.05"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {position.assetClass === "OPTIONS" && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Strike Price (₹)</label>
                <input
                  type="number"
                  step="50"
                  value={strikePrice}
                  onChange={(e) => setStrikePrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Strategy / Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Rolling into next month expiry"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* MTM Recalculation Preview */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between font-mono text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Total Contracts:</span>
              <span className="text-slate-200 font-bold">{numQty} units</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[11px]">Recalculated MTM P&L:</span>
              <span className={`font-bold ${mtmPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {mtmPnL >= 0 ? "+" : ""}₹{mtmPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
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
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? "Updating..." : "Update Position"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
