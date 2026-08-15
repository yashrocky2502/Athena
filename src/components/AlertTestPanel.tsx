import React, { useState, useEffect } from "react";
import { 
  Terminal, 
  Play, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { 
  Evidence, 
  EvidenceStatus, 
  NotificationRecord, 
  NotificationStatus,
  EventType,
  StoryImpact
} from "../types";
import { AlertDecisionEngine } from "../services/AlertDecisionEngine";
import { NotificationDeliveryEngine } from "../services/NotificationDeliveryEngine";

const TEST_SCENARIOS = [
  {
    id: "critical-reg",
    name: "Critical Regulatory Event",
    title: "[TEST] RBI unexpected policy change",
    company: "RELIANCE",
  },
  {
    id: "portfolio-impact",
    name: "Portfolio Impact Alert",
    title: "[TEST] Reliance major business update",
    company: "RELIANCE",
  },
  {
    id: "duplicate-event",
    name: "Duplicate Event",
    title: "[TEST] Duplicate regulatory news",
    company: "RELIANCE",
  },
  {
    id: "low-confidence",
    name: "Low Confidence Event",
    title: "[TEST] Minor market commentary",
    company: "ZOMATO",
  }
];

export default function AlertTestPanel() {
  const [eventsTested, setEventsTested] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  
  const engine = AlertDecisionEngine.getInstance();
  const deliveryEngine = NotificationDeliveryEngine.getInstance();
  const logs = engine.getDecisionLogs();

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory(deliveryEngine.getNotificationHistory());
    }, 2000);
    return () => clearInterval(interval);
  }, [deliveryEngine]);

  const runTest = async (scenario: typeof TEST_SCENARIOS[0]) => {
    setIsRunning(true);
    setEventsTested(prev => prev + 1);

    const testEvidence: Evidence = {
      id: `test-${Date.now()}`,
      title: scenario.title,
      summary: `Test summary for ${scenario.title}`,
      sourceName: "Athena Simulation",
      sourceType: "RSS",
      url: "https://athena.test",
      publishedTime: new Date().toISOString(),
      retrievedTime: new Date().toISOString(),
      trustScore: scenario.id === "low-confidence" ? 30 : 90,
      sourceCredibility: scenario.id === "low-confidence" ? 30 : 90,
      category: scenario.id === "high-severity" ? EventType.RBIPolicy : EventType.RegulatoryFiling,
      impact: scenario.id === "negative" ? StoryImpact.Negative : StoryImpact.Positive,
      sentiment: 0.5,
      confidence: 90,
      evidenceType: "news",
      relatedCompanies: [scenario.company],
      relatedSectors: ["Finance"],
      relatedEvents: [],
      status: "Verified" as EvidenceStatus
    };

    await engine.evaluateEvidence(testEvidence);
    setIsRunning(false);
  };

  const metrics = {
    alertsGenerated: logs.filter(l => l.decision === "Notify").length,
    alertsSuppressed: logs.filter(l => l.decision === "Suppress").length,
    duplicatesMerged: logs.filter(l => l.decision === "Merge").length,
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-white flex items-center gap-2">
          <Terminal className="h-5 w-5 text-emerald-400" />
          Alert System Test Panel
        </h3>
        <button onClick={() => window.location.reload()} className="p-2 text-slate-500 hover:text-white transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Events Tested", value: eventsTested },
          { label: "Alerts Generated", value: metrics.alertsGenerated },
          { label: "Alerts Suppressed", value: metrics.alertsSuppressed },
          { label: "Duplicates Merged", value: metrics.duplicatesMerged },
        ].map(m => (
          <div key={m.label} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block mb-1">{m.label}</span>
            <span className="text-xl font-bold text-white">{m.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {TEST_SCENARIOS.map(s => (
          <button
            key={s.id}
            onClick={() => runTest(s)}
            disabled={isRunning}
            className="bg-slate-800 hover:bg-slate-700 p-4 rounded-xl text-left transition-all border border-slate-700 flex flex-col gap-2"
          >
            <span className="text-xs font-bold text-indigo-400">{s.name}</span>
            <p className="text-[10px] text-slate-400">{s.title}</p>
          </button>
        ))}
      </div>

      <div className="border-t border-slate-800 pt-6">
        <h4 className="text-sm font-bold text-white mb-4">Delivery Debug View</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-400">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="pb-2">Alert ID</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Retry</th>
                <th className="pb-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {history.map(n => (
                <tr key={n.id} className="border-b border-slate-800/50">
                  <td className="py-2 font-mono">{n.alertId?.substring(0, 8) || "N/A"}...</td>
                  <td className="py-2 flex items-center gap-2">
                    {n.status === NotificationStatus.Delivered && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                    {n.status === NotificationStatus.Failed && <XCircle className="w-3 h-3 text-red-500" />}
                    {n.status === NotificationStatus.Queued && <Clock className="w-3 h-3 text-amber-500" />}
                    {n.status}
                  </td>
                  <td className="py-2">{n.retryCount}</td>
                  <td className="py-2 text-red-400">{n.errorMessage || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
