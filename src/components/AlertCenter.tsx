import React from "react";
import AlertsManager from "./AlertsManager";

export default function AlertCenter({ developerMode = false }: { developerMode?: boolean }) {
  return (
    <div className="animate-in fade-in duration-150 p-4">
      <h2 className="font-display font-bold text-2xl text-white mb-6">Alert Center</h2>
      <AlertsManager developerMode={developerMode} />
    </div>
  );
}
