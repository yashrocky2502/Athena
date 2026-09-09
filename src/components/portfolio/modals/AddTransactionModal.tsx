/**
 * ATHENA — Phase 26.1: Manual Transaction Recording Modal
 * AddTransactionModal.tsx
 * 
 * Allows recording corporate actions, dividends, interest, manual buy/sells, 
 * with automatic cash credit for dividend & interest payouts.
 */

import React, { useState } from "react";
import { X, CheckCircle2, Info, FileText, DollarSign } from "lucide-react";
import { TransactionType } from "../../../news/portfolio/broker/types.ts";

interface AddTransactionModalProps {
  portfolioId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddTransactionModal({
  portfolioId,
  onClose,
  onSuccess
}: AddTransactionModalProps) {
  const [type, setType] = useState<TransactionType>("DIVIDEND");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numPrice = parseFloat(price) || 0;
  const numQty = parseFloat(quantity) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numPrice <= 0) {
      setErrorMsg("Price / Value must be greater than 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v4/portfolio/transactions?portfolioId=${portfolioId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          symbol: symbol.trim().toUpperCase() || undefined,
          quantity: numQty > 0 ? numQty : undefined,
          price: numPrice,
          notes: notes.trim() || undefined
        })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      onSuccess(`Recorded ${type} transaction of ₹${numPrice.toLocaleString('en-IN')}.`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-6">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Record Manual Transaction
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Dividends and interest automatically credit cash balance
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
            <label className="text-xs font-semibold text-slate-300 block mb-1">Transaction Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="DIVIDEND">DIVIDEND (Auto-Credits Cash)</option>
              <option value="INTEREST">INTEREST (Auto-Credits Cash)</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="WITHDRAWAL">WITHDRAWAL</option>
              <option value="BONUS">BONUS</option>
              <option value="SPLIT">SPLIT</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Symbol (Optional)</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. ITC"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Quantity (Optional)</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 200"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Total Amount / Value (₹) *</label>
            <input
              type="number"
              required
              step="0.05"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 1500.00"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Narration</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Final dividend FY25 @ ₹7.50/share"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
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
              <span>{submitting ? "Recording..." : "Record Transaction"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
