import React from "react";
import { Sparkles, Menu, Sun, Moon, Search } from "lucide-react";
import GlobalHeaderAlertsPopover from "./alerts/GlobalHeaderAlertsPopover.tsx";

interface HeaderProps {
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  onOpenAlertsManager?: () => void;
  theme: "dark" | "light" | "system";
  setTheme: (theme: "dark" | "light" | "system") => void;
}

export default function Header({ onOpenMenu, onOpenSearch, onOpenAlertsManager, theme, setTheme }: HeaderProps) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-4 py-2.5" id="athena-header">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Hamburger menu & Brand */}
        <div className="flex items-center gap-3">
          <button onClick={onOpenMenu} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/10 shrink-0">
              <Sparkles className="h-4.5 w-4.5 text-white animate-pulse" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white hidden sm:inline">ATHENA</span>
          </div>
        </div>

        {/* Center: Ask ATHENA... trigger input */}
        <div className="flex-1 max-w-lg mx-2">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition shadow-inner group"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
              <span className="text-xs sm:text-sm font-sans truncate">Ask ATHENA... (e.g. Why is market down today?)</span>
            </div>
            <span className="hidden md:inline-block text-[10px] font-mono text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
              ⌘K
            </span>
          </button>
        </div>

        {/* Right: Alerts Popover + Theme Toggle / Mode */}
        <div className="flex items-center gap-2">
          <GlobalHeaderAlertsPopover onOpenAlertsManager={onOpenAlertsManager} />

          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition"
            title="Toggle theme mode"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}

