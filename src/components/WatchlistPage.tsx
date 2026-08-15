import React from "react";
import WatchlistDashboard from "./WatchlistDashboard";

interface WatchlistPageProps {
  onSelectCompany: (symbol: string) => void;
  onSelectNewsQuery?: (query: string) => void;
}

export default function WatchlistPage({ onSelectCompany, onSelectNewsQuery }: WatchlistPageProps) {
  return (
    <div className="animate-in fade-in duration-150">
      <WatchlistDashboard onSelectCompany={onSelectCompany} onSelectNewsQuery={onSelectNewsQuery} />
    </div>
  );
}
