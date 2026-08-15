import React, { useEffect, useState } from "react";
import { Nifty200Service, Nifty200Company } from "../services/Nifty200Service";
import { Shield, Zap, TrendingUp, AlertTriangle } from "lucide-react";

export default function Nifty200MonitorDashboard() {
  const [companies, setCompanies] = useState<Nifty200Company[]>([]);
  const [status, setStatus] = useState<boolean>(false);

  useEffect(() => {
    const service = Nifty200Service.getInstance();
    setCompanies(service.getConstituents());
    setStatus(service.getMonitoringStatus());
  }, []);

  return (
    <div className="p-6 bg-slate-950 text-slate-100 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold font-display text-white">Nifty 200 Monitor</h2>
        <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${status ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
          {status ? "MONITORING ACTIVE" : "MONITORING STOPPED"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Cards */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <Zap className="text-indigo-400" size={32} />
          <div>
            <div className="text-2xl font-bold text-white">{companies.length}</div>
            <div className="text-sm text-slate-400">Companies Monitored</div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <TrendingUp className="text-emerald-400" size={32} />
          <div>
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-sm text-slate-400">Events Detected Today</div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800 text-slate-400 uppercase text-xs font-bold">
            <tr>
              <th className="p-4">Symbol</th>
              <th className="p-4">Name</th>
              <th className="p-4">Industry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {companies.map((c) => (
              <tr key={c.symbol} className="hover:bg-slate-800/50">
                <td className="p-4 font-mono text-indigo-300">{c.symbol}</td>
                <td className="p-4">{c.name}</td>
                <td className="p-4 text-slate-400">{c.industry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
