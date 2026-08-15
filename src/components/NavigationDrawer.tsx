import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  BookOpen, 
  Bell, 
  FileText, 
  Sparkles, 
  Settings as SettingsIcon, 
  Shield, 
  Info, 
  X,
  Terminal,
  TrendingUp
} from "lucide-react";

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAlerts: () => void;
  onOpenProfile: () => void;
  onOpenWatchlist: () => void;
  onOpenSavedResearch: () => void;
  onOpenSettings: () => void;
  onOpenAuditPanel: () => void;
  onOpenNiftyMonitor: () => void;
  onToggleDeveloperMode: () => void;
  developerMode: boolean;
  onOpenHelp?: () => void;
  onOpenAbout?: () => void;
  onOpenAiProviderSettings?: () => void;
  onOpenNewsOperations?: () => void;
}

export default function NavigationDrawer({ 
  isOpen, 
  onClose, 
  onOpenAlerts,
  onOpenProfile,
  onOpenWatchlist,
  onOpenSavedResearch,
  onOpenSettings,
  onOpenAuditPanel,
  onOpenNiftyMonitor,
  onToggleDeveloperMode,
  developerMode,
  onOpenHelp,
  onOpenAbout,
  onOpenAiProviderSettings,
  onOpenNewsOperations
}: NavigationDrawerProps) {
  const menuItems = [
    { name: "Profile", icon: User, action: () => { onClose(); onOpenProfile(); } },
    { name: "Watchlist", icon: BookOpen, action: () => { onClose(); onOpenWatchlist(); } },
    { name: "Alert Center", icon: Bell, action: () => { onClose(); onOpenAlerts(); } },
    { name: "Saved Research", icon: FileText, action: () => { onClose(); onOpenSavedResearch(); } },
    { name: "AI Provider Settings", icon: Sparkles, action: () => { onClose(); onOpenAiProviderSettings ? onOpenAiProviderSettings() : onOpenSettings(); } },
    { name: "Settings", icon: SettingsIcon, action: () => { onClose(); onOpenSettings(); } },
    { 
      name: `Developer Mode: ${developerMode ? "ON" : "OFF"}`, 
      icon: Shield, 
      action: () => { onToggleDeveloperMode(); } 
    },
    ...(developerMode ? [
      { name: "Pipeline Audit", icon: Terminal, action: () => { onClose(); onOpenAuditPanel(); } },
      { name: "Nifty 200 Monitor", icon: TrendingUp, action: () => { onClose(); onOpenNiftyMonitor(); } },
      { name: "News Operations", icon: Terminal, action: () => { onClose(); onOpenNewsOperations?.(); } }
    ] : []),
    { name: "Help & Feedback", icon: Info, action: () => { onClose(); onOpenHelp ? onOpenHelp() : onOpenSettings(); } },
    { name: "About Athena", icon: Info, action: () => { onClose(); onOpenAbout ? onOpenAbout() : onOpenSettings(); } }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-md"
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 z-50 w-[75%] max-w-xs bg-slate-950/80 backdrop-blur-2xl border-r border-slate-800/50 rounded-r-2xl overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800/50">
              <h2 className="font-display font-bold text-lg text-white">Menu</h2>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {menuItems.map((item) => (
                <button
                  key={item.name}
                  onClick={item.action || onClose}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-900/50 text-slate-300 transition-colors"
                >
                  <item.icon size={18} />
                  {item.name}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
