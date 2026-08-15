import React, { useState } from "react";
import { UserPreferenceService } from "../services/UserPreferenceService";
import { UserCompanyPreference } from "../types";
import { Bell } from "lucide-react";

interface NotificationSettingsProps {
  preference: UserCompanyPreference;
  onUpdate: () => void;
}

export default function NotificationSettings({ preference, onUpdate }: NotificationSettingsProps) {
  const [prefs, setPrefs] = useState(preference.alertPreferences);
  const [updating, setUpdating] = useState(false);

  const toggleAlert = async (key: keyof typeof prefs) => {
    setUpdating(true);
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    
    await UserPreferenceService.getInstance().saveAlertPreferences(preference.companyId, newPrefs);
    onUpdate();
    setUpdating(false);
  };

  return (
    <div className="flex flex-col gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 mt-2">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Alert Settings</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        {(Object.keys(prefs) as Array<keyof typeof prefs>).map((key) => (
          <button
            key={key}
            onClick={() => toggleAlert(key)}
            className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
              prefs[key]
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="capitalize">{(key as string).replace(/([A-Z])/g, ' $1').trim()}</span>
            <span className={`h-2 w-2 rounded-full ${prefs[key] ? "bg-indigo-400" : "bg-slate-700"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
