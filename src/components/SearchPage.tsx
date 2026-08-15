import React from "react";
import AiSearch from "./AiSearch";
import { Search as SearchIcon } from "lucide-react";

export default function SearchPage({ 
  onSelectCompany, 
  onSelectMarketAsset,
  developerMode 
}: { 
  onSelectCompany: (symbol: string) => void, 
  onSelectMarketAsset?: (symbol: string, tab: any) => void,
  developerMode: boolean 
}) {
  return (
    <div className="animate-in fade-in duration-150 p-4 pb-20">
      <h2 className="font-display font-bold text-2xl text-white mb-6">Athena Search</h2>
      <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <SearchIcon className="h-5 w-5 text-indigo-400" />
          <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            Market Intelligence Engine
          </span>
        </div>
        <p className="text-sm text-slate-400 leading-normal mb-6">
          Query Indian market data, company analysis, sector insights, and real-time regulatory disclosures.
        </p>
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
           <AiSearch 
             onSelectCompany={onSelectCompany} 
             onSelectMarketAsset={onSelectMarketAsset}
             developerMode={developerMode} 
           />
        </div>
      </div>
    </div>
  );
}
