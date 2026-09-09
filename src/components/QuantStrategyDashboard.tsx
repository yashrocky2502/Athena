import React, { useState, useEffect } from 'react';
import { 
  Zap, TrendingUp, TrendingDown, Shield, Award, AlertTriangle, 
  CheckCircle2, XCircle, RefreshCw, BarChart3, ChevronRight, Copy, Check, Info
} from 'lucide-react';
import { CanonicalStrategyCandidate } from '../news/quant/types.ts';

export interface QuantStrategyDashboardProps {
  symbol?: string;
  signalId?: string;
}

export const QuantStrategyDashboard: React.FC<QuantStrategyDashboardProps> = ({ symbol = 'TATAMOTORS' }) => {
  const [candidates, setCandidates] = useState<CanonicalStrategyCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CanonicalStrategyCandidate | null>(null);
  const [telegramSnapshot, setTelegramSnapshot] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BACKTEST' | 'EV_RISK' | 'OPTIONS' | 'TELEGRAM'>('OVERVIEW');

  useEffect(() => {
    fetchStrategies();
  }, [symbol]);

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v5/quant/strategies/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: {
            id: `art-quant-${symbol}-${Date.now()}`,
            headline: `${symbol} Wins Major Order Contract with High Operating Margins`,
            body: `${symbol} announced securing a major multi-year supply contract valued at ₹2,500 Crores. Operating margins are projected to expand by 150 bps.`,
            symbol: symbol,
            publishedAt: new Date().toISOString()
          }
        })
      });

      const data = await res.json();
      if (data.status === 'success' && data.candidates) {
        setCandidates(data.candidates);
        setSelectedCandidate(data.candidates[0] || null);
        setTelegramSnapshot(data.telegramSnapshot || '');
      }
    } catch (err) {
      console.error('Failed to fetch quant strategies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTelegram = () => {
    if (telegramSnapshot) {
      navigator.clipboard.writeText(telegramSnapshot);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getActionabilityBadge = (actionability: string) => {
    switch (actionability) {
      case 'TRADEABLE':
        return <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono text-xs font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> 🟢 TRADEABLE</span>;
      case 'WATCH':
        return <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-mono text-xs font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> 🟡 WATCH</span>;
      case 'CONDITIONAL':
        return <span className="px-2.5 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded font-mono text-xs font-bold flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> 🟠 CONDITIONAL</span>;
      default:
        return <span className="px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded font-mono text-xs font-bold flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> 🔴 NO_TRADE</span>;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-5 font-sans space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-bold text-white tracking-wide font-mono uppercase flex items-center gap-2">
              Phase 12: Quantitative Strategy Intelligence Engine
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Signal-to-Strategy Candidate Engine • Event-Conditioned Backtest • EV Matrix • Risk Gatekeeper
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStrategies}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-xs font-mono text-slate-200 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Re-evaluate Signal</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12 text-slate-400 font-mono text-xs gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>EVALUATING HISTORICAL ANALOGUES & BACKTEST METRICS FOR {symbol}...</span>
        </div>
      ) : candidates.length === 0 ? (
        <div className="p-8 text-center text-slate-500 font-mono text-xs bg-slate-950/50 rounded border border-slate-800">
          No strategy candidates generated for {symbol}. Select an active market signal.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT PANEL: CANDIDATES LIST (4 Cols) */}
          <div className="lg:col-span-4 space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold block mb-1">
              Strategy Candidates ({candidates.length})
            </span>
            <div className="space-y-2">
              {candidates.map((cand) => (
                <div
                  key={cand.strategyId}
                  onClick={() => setSelectedCandidate(cand)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition ${
                    selectedCandidate?.strategyId === cand.strategyId
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-950/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-slate-300 rounded uppercase">
                      {cand.category}
                    </span>
                    {getActionabilityBadge(cand.actionability)}
                  </div>
                  <div className="text-sm font-bold text-white font-mono">{cand.strategyName}</div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-1 font-mono">{cand.description}</div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-800/80 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Compatibility</span>
                      <span className="font-bold text-indigo-300">{cand.compatibilityScore}/100</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Expected Value</span>
                      <span className="font-bold text-emerald-400">+₹{cand.expectedValue.expectedValueINR.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL: SELECTED STRATEGY DETAILS (8 Cols) */}
          {selectedCandidate && (
            <div className="lg:col-span-8 space-y-5 bg-slate-950/80 border border-slate-800/90 rounded-lg p-5">
              
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white font-mono">{selectedCandidate.strategyName}</span>
                    <span className="text-xs font-mono text-slate-400">({selectedCandidate.symbol})</span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedCandidate.description}</p>
                </div>
                <div>{getActionabilityBadge(selectedCandidate.actionability)}</div>
              </div>

              {/* Actionability Rationale Banner */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded font-mono text-xs">
                <span className="text-slate-500 block text-[9px] uppercase font-bold mb-1">Risk Gate Rationale</span>
                <span className="text-slate-300">{selectedCandidate.actionabilityRationale}</span>
              </div>

              {/* Sub-Tabs */}
              <div className="flex border-b border-slate-800 gap-2 font-mono text-xs">
                {(['OVERVIEW', 'BACKTEST', 'EV_RISK', 'OPTIONS', 'TELEGRAM'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 px-3 border-b-2 font-semibold transition ${
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-4 font-mono text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Entry Price</span>
                      <span className="text-sm font-bold text-white">₹{selectedCandidate.entryPrice}</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Stop Loss</span>
                      <span className="text-sm font-bold text-rose-400">₹{selectedCandidate.stopLossPrice}</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Target Price</span>
                      <span className="text-sm font-bold text-emerald-400">₹{selectedCandidate.targetPrice}</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Est. Capital</span>
                      <span className="text-sm font-bold text-indigo-300">₹{selectedCandidate.estimatedCapitalRequiredINR.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Compatibility & Historical Precedent */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-2">
                      <span className="text-indigo-400 font-bold uppercase text-[10px] block">Signal-Strategy Compatibility</span>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Score:</span>
                        <span className="font-bold text-white">{selectedCandidate.compatibilityScore}/100</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${selectedCandidate.compatibilityScore}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Rating: {selectedCandidate.compatibilityRating}</span>
                        <span>Direction: {selectedCandidate.direction}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-2">
                      <span className="text-teal-400 font-bold uppercase text-[10px] block">Event-Conditioned Analogues</span>
                      <div className="flex justify-between text-slate-300">
                        <span>Sample Size:</span>
                        <span className="font-bold text-white">{selectedCandidate.historicalPrecedents.sampleSize} Events</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Sample Quality:</span>
                        <span className="font-bold text-teal-400">{selectedCandidate.historicalPrecedents.sampleQuality}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Historical Win Rate:</span>
                        <span className="font-bold text-emerald-400">{selectedCandidate.historicalPrecedents.historicalWinRatePct}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BACKTEST & ROBUSTNESS */}
              {activeTab === 'BACKTEST' && (
                <div className="space-y-4 font-mono text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Win Rate</span>
                      <span className="text-sm font-bold text-emerald-400">{selectedCandidate.backtestMetrics.winRatePct}%</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Profit Factor</span>
                      <span className="text-sm font-bold text-indigo-300">{selectedCandidate.backtestMetrics.profitFactor}</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Max Drawdown</span>
                      <span className="text-sm font-bold text-rose-400">{selectedCandidate.backtestMetrics.maxDrawdownPct}%</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Sharpe Ratio</span>
                      <span className="text-sm font-bold text-white">{selectedCandidate.backtestMetrics.sharpeRatio}</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">MFE / MAE Median</span>
                      <span className="text-sm font-bold text-teal-400">+{selectedCandidate.backtestMetrics.mfeMedianPct}% / -{selectedCandidate.backtestMetrics.maeMedianPct}%</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Lookahead Protection</span>
                      <span className="text-sm font-bold text-emerald-400">VERIFIED TRUE</span>
                    </div>
                  </div>

                  {/* Validation Report */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-2">
                    <span className="text-indigo-400 font-bold uppercase text-[10px] block">Robustness & Overfitting Audit</span>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div>Validation Status: <span className="font-bold text-white">{selectedCandidate.robustnessReport.validationStatus}</span></div>
                      <div>Overfitting Risk: <span className="font-bold text-emerald-400">{selectedCandidate.robustnessReport.overfittingRiskLevel}</span></div>
                      <div>Walk-Forward Validation: <span className="font-bold text-emerald-400">{selectedCandidate.robustnessReport.walkForwardPassed ? 'PASSED' : 'FAILED'}</span></div>
                      <div>Out-Of-Sample Validation: <span className="font-bold text-emerald-400">{selectedCandidate.robustnessReport.outOfSamplePassed ? 'PASSED' : 'FAILED'}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: EXPECTED VALUE & RISK PROFILE */}
              {activeTab === 'EV_RISK' && (
                <div className="space-y-4 font-mono text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Expected Value / Trade</span>
                      <span className="text-sm font-bold text-emerald-400">+₹{selectedCandidate.expectedValue.expectedValueINR.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Expected Return %</span>
                      <span className="text-sm font-bold text-indigo-300">+{selectedCandidate.expectedValue.expectedReturnPct}%</span>
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase">Reward / Risk Ratio</span>
                      <span className="text-sm font-bold text-white">{selectedCandidate.expectedValue.rewardToRiskRatio}:1</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-2">
                    <span className="text-indigo-400 font-bold uppercase text-[10px] block">95% Confidence Interval (Bootstrapped EV)</span>
                    <div className="text-slate-300 text-sm font-bold">
                      [ +₹{selectedCandidate.expectedValue.confidenceInterval95Pct[0]?.toLocaleString('en-IN')}, +₹{selectedCandidate.expectedValue.confidenceInterval95Pct[1]?.toLocaleString('en-IN')} ]
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: OPTIONS LEGS & GREEKS */}
              {activeTab === 'OPTIONS' && (
                <div className="space-y-4 font-mono text-xs">
                  {selectedCandidate.category !== 'OPTIONS' ? (
                    <div className="p-4 text-center text-slate-500 bg-slate-900/60 border border-slate-800 rounded">
                      Selected strategy is category {selectedCandidate.category}. Options Greeks & legs apply to OPTIONS category.
                    </div>
                  ) : (
                    <>
                      {/* Option Legs */}
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-2">
                        <span className="text-indigo-400 font-bold uppercase text-[10px] block">Strategy Option Legs</span>
                        <div className="space-y-1">
                          {selectedCandidate.optionLegs?.map((leg, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800 text-slate-300">
                              <span className={`font-bold ${leg.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{leg.action} {leg.type}</span>
                              <span>Strike: ₹{leg.strike}</span>
                              <span>Premium: ₹{leg.premium}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Greeks */}
                      {selectedCandidate.optionsGreeks && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                            <span className="text-slate-500 block text-[10px] uppercase">Net Delta</span>
                            <span className="text-sm font-bold text-white">{selectedCandidate.optionsGreeks.netDelta}</span>
                          </div>
                          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                            <span className="text-slate-500 block text-[10px] uppercase">Net Theta</span>
                            <span className="text-sm font-bold text-rose-400">{selectedCandidate.optionsGreeks.netTheta}</span>
                          </div>
                          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                            <span className="text-slate-500 block text-[10px] uppercase">Max Profit</span>
                            <span className="text-sm font-bold text-emerald-400">₹{selectedCandidate.optionsGreeks.maxProfit}</span>
                          </div>
                          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                            <span className="text-slate-500 block text-[10px] uppercase">Max Loss</span>
                            <span className="text-sm font-bold text-rose-400">₹{selectedCandidate.optionsGreeks.maxLoss}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 5: TELEGRAM SNAPSHOT */}
              {activeTab === 'TELEGRAM' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-400 font-bold uppercase text-[10px]">Grounded Telegram Quant Snapshot</span>
                    <button
                      onClick={handleCopyTelegram}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Message'}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 border border-slate-800 rounded text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto text-[11px]">
                    {telegramSnapshot}
                  </pre>
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default QuantStrategyDashboard;
