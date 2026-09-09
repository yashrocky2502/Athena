/**
 * ATHENA — Phase 26.1: Edit Holding Modal
 * EditHoldingModal.tsx
 * 
 * Allows modifying existing holding details (quantity, prices, sector, notes)
 * and triggering immediate deterministic recalculation of portfolio state.
 */

import React, { useState } from "react";
import { X, CheckCircle2, Info, Building2, Layers } from "lucide-react";
import { CanonicalHolding } from "../../../news/portfolio/broker/types.ts";

interface EditHoldingModalProps {
  portfolioId: string;
  holding: CanonicalHolding;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function EditHoldingModal({
  portfolioId,
  holding,
  onClose,
  onSuccess
}: EditHoldingModalProps) {
  const [displayName, setDisplayName] = useState(holding.displayName || "");
  const [quantity, setQuantity] = useState(holding.quantity.toString());
  const [averagePrice, setAveragePrice] = useState(holding.averagePrice.toString());
  const [currentPrice, setCurrentPrice] = useState(holding.currentPrice.toString());
  const [sector, setSector] = useState(holding.sector || "");
  const [notes, setNotes] = useState(holding.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numQty = parseFloat(quantity) || 0;
  const numAvg = parseFloat(averagePrice) || 0;
  const numCur = parseFloat(currentPrice) || numAvg;

  const costBasis = numQty * numAvg;
  const marketVal = numQty * numCur;
  const unrealizedPnL = marketVal - costBasis;
  const returnPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numQty <= 0) {
      setErrorMsg("Quantity must be greater than 0.");
      return;
    }
    if (numAvg <= 0) {
      setErrorMsg("Average price must be greater than 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v4/portfolio/holdings/${holding.id}?portfolioId=${portfolioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: numQty,
          averagePrice: numAvg,
          currentPrice: numCur,
          sector: sector.trim() || undefined,
          displayName: displayName.trim() || undefined,
          notes: notes.trim() || undefined
        })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      onSuccess(`Updated holding ${holding.symbol}. Recalculations applied.`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update holding.");
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
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {holding.exchange}
              </span>
              <h3 className="text-base font-bold text-white">Edit Holding: {holding.symbol}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Update quantity, cost basis, or current market price
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
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Company / Asset Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={holding.symbol}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Quantity *</label>
              <input
                type="number"
                required
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Avg Buy Price (₹) *</label>
              <input
                type="number"
                required
                step="0.05"
                value={averagePrice}
                onChange={(e) => setAveragePrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Current Price (₹)</label>
              <input
                type="number"
                step="0.05"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Sector</label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="e.g. FMCG, Information Technology"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Added via manual entry"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Real-time Math preview */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between font-mono text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Cost Basis:</span>
              <span className="text-slate-200 font-bold">₹{costBasis.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Market Value:</span>
              <span className="text-white font-bold">₹{marketVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[11px]">Recalculated P&L:</span>
              <span className={`font-bold ${unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {unrealizedPnL >= 0 ? "+" : ""}₹{unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({returnPct.toFixed(2)}%)
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
              <span>{submitting ? "Updating..." : "Update Holding"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
