/**
 * ATHENA — Phase 21: Global Header Alerts Popover
 * GlobalHeaderAlertsPopover.tsx
 * 
 * Replaces bottom navigation Alerts by anchoring Alerts directly in the global top header beside Ask ATHENA and Mode.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Check, X, ShieldAlert, AlertTriangle, 
  Info, ExternalLink, ChevronRight, Filter, 
  Radio, CheckCheck, Clock, Settings 
} from 'lucide-react';
import { AlertDecisionEngine } from '../../services/AlertDecisionEngine.ts';
import { AthenaAlert, Priority, EventType } from '../../types.ts';

interface GlobalHeaderAlertsPopoverProps {
  onOpenAlertsManager?: () => void;
}

export default function GlobalHeaderAlertsPopover({ onOpenAlertsManager }: GlobalHeaderAlertsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AthenaAlert[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const popoverRef = useRef<HTMLDivElement>(null);

  const alertEngine = AlertDecisionEngine.getInstance();

  useEffect(() => {
    // Load initial alerts from engine
    const history = alertEngine.getAlertHistory();
    if (history && history.length > 0) {
      setAlerts(history);
    } else {
      // Seed high-value market surveillance alerts if empty
      const initialAlerts: AthenaAlert[] = [
        {
          id: 'alt-surv-1',
          type: EventType.MarketWideRisk,
          source: 'MarketSurveillance',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          companySymbol: 'NIFTY 50',
          title: 'Macro Volatility Expansion Alert',
          description: 'Brent Crude spiked +3.2% to $91.10/bbl. India VIX expanded +7.8% with heavy Put option hedging at 24,100 strike.',
          priority: Priority.High,
          confidence: 92,
          companies: ['NIFTY 50'],
          sectors: ['Energy', 'Macro']
        },
        {
          id: 'alt-surv-2',
          type: EventType.TechnicalBreakout,
          source: 'MarketSurveillance',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          companySymbol: 'HDFCBANK',
          title: 'F&O Anomaly: Aggressive Short Buildup',
          description: 'Relative Volume 2.1x with 12.4% expansion in Open Interest. FII cash sales detected.',
          priority: Priority.High,
          confidence: 88,
          companies: ['HDFCBANK'],
          sectors: ['Banking', 'Financials']
        },
        {
          id: 'alt-surv-3',
          type: EventType.OrderWin,
          source: 'NewsEngineV3',
          timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          companySymbol: 'TCS',
          title: 'Material Contract Win: $450M Cloud Modernization',
          description: 'Confirmed regulatory filing: 6-year transformation deal with leading European insurance provider.',
          priority: Priority.Medium,
          confidence: 96,
          companies: ['TCS'],
          sectors: ['IT Services']
        }
      ];
      setAlerts(initialAlerts);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredAlerts = alerts.filter(a => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'CRITICAL') return a.priority === Priority.Critical;
    if (selectedFilter === 'HIGH') return a.priority === Priority.High;
    if (selectedFilter === 'MEDIUM') return a.priority === Priority.Medium;
    return true;
  });

  const unreadCount = alerts.length;
  const hasCritical = alerts.some(a => a.priority === Priority.Critical || a.priority === Priority.High);

  const handleClearAll = () => {
    setAlerts([]);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Header Alerts Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition flex items-center justify-center"
        title="Market Alerts & Surveillance"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            {hasCritical && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-4 w-4 text-[9px] font-bold font-mono text-white items-center justify-center ${
              hasCritical ? 'bg-rose-500' : 'bg-indigo-500'
            }`}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">Alerts &amp; Surveillance</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300">
                {unreadCount}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[11px] text-slate-400 hover:text-slate-200 transition"
                  title="Mark all as read"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Priority Filters */}
          <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold transition ${
                  selectedFilter === filter
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Alerts List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
            {filteredAlerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 font-mono">
                No active alerts in this category
              </div>
            ) : (
              filteredAlerts.map((alt) => (
                <div
                  key={alt.id}
                  className="p-2.5 rounded-lg bg-slate-950/50 hover:bg-slate-950 border border-slate-800/60 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        alt.priority === Priority.Critical ? 'bg-rose-500' :
                        alt.priority === Priority.High ? 'bg-amber-500' :
                        'bg-indigo-500'
                      }`} />
                      <span className="text-xs font-bold text-slate-200 font-mono">
                        {alt.companySymbol || 'MARKET'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(alt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-slate-300 mb-1 leading-snug">
                    {alt.title}
                  </h4>

                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                    {alt.description}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {onOpenAlertsManager && (
            <div className="px-3 py-2 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 font-mono">Surveillance Engine V18.4</span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenAlertsManager();
                }}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Full Alert Manager</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
