import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import { ChartCore } from './ChartCore';

interface ChartFullscreenProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  title: string;
  price: number;
  changePercent: number;
  data: any[];
  currency?: string;
}

export const ChartFullscreen: React.FC<ChartFullscreenProps> = ({
  isOpen,
  onClose,
  symbol,
  title,
  price,
  changePercent,
  data: initialData,
  currency = '₹'
}) => {
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
  const [chartData, setChartData] = useState(initialData);
  const containerRef = useRef<HTMLDivElement>(null);

  const timeframes = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      handleTimeframeChange(activeTimeframe);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, initialData]);

  const handleTimeframeChange = (tf: string) => {
    setActiveTimeframe(tf);
    if (!initialData || initialData.length === 0) return;

    const tfDays: Record<string, number> = {
      '1D': 1,
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      '5Y': 1825,
      'MAX': 10000
    };

    const days = tfDays[tf] || 30;
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const filtered = initialData.filter(item => {
      const itemDate = new Date(item.time);
      return itemDate >= cutoff;
    });

    setChartData(filtered.length > 0 ? filtered : initialData.slice(-Math.min(initialData.length, days)));
  };

  if (!isOpen) return null;

  const isPositive = changePercent >= 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.02 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col"
        ref={containerRef}
      >
        {/* TOP COMPACT HEADER */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl z-20">
          <div className="flex items-center gap-6">
            {/* Asset Info */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">{title}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20">
                  {symbol}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-lg font-mono font-bold text-white leading-none">
                  {currency}{(price ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <div className={`flex items-center gap-1 text-[11px] font-bold ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="hidden md:block h-8 w-px bg-white/10 mx-2"></div>

            {/* Market Status (Desktop) */}
            <div className="hidden md:flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest leading-none mb-1">Market Status</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight">Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Timeframe Selector (Desktop) */}
            <div className="hidden lg:flex items-center bg-white/5 p-1 rounded-full border border-white/5">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleTimeframeChange(tf)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all duration-200 ${
                    activeTimeframe === tf 
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            
            <button
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-full border border-white/5 hover:border-rose-500/30 transition-all active:scale-90"
              title="Close Fullscreen"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* TIME SELECTOR (MOBILE) */}
        <div className="lg:hidden flex items-center justify-center p-2 border-b border-white/5 bg-slate-950/40 overflow-x-auto no-scrollbar gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                activeTimeframe === tf 
                  ? 'bg-indigo-500 text-white' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* MAIN CHART CANVAS */}
        <div className="flex-1 relative bg-slate-950">
          <div className="absolute inset-0">
            {chartData.length > 0 ? (
              <ChartCore 
                data={chartData} 
                height={undefined} 
                isFullscreen={true} 
                showVolume={true}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-950">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                <p className="text-slate-500 text-xs font-mono tracking-widest uppercase">Calculating Chart Metrics...</p>
              </div>
            )}
          </div>
          
          {/* WATERMARK */}
          <div className="absolute bottom-10 right-10 pointer-events-none opacity-[0.03] select-none">
            <h1 className="text-[12vw] font-black text-white italic tracking-tighter leading-none">ATHENA</h1>
          </div>
        </div>

        {/* FOOTER BAR */}
        <div className="px-6 py-2 border-t border-white/5 bg-slate-950 flex items-center justify-between text-[10px] font-mono text-slate-600">
          <div className="flex items-center gap-4">
             <span className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                SOURCE: MULTI-FEED CONSENSUS
             </span>
             <span className="hidden sm:inline">|</span>
             <span className="hidden sm:inline uppercase">LATENCY: 42MS</span>
          </div>
          <div className="flex items-center gap-4">
             <span className="hidden sm:inline uppercase">TIMEZONE: IST (UTC+5:30)</span>
             <span>REFRESHED: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
