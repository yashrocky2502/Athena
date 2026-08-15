import React, { useState, useEffect } from "react";
import { Sparkles, Menu, Sun, Moon, Search } from "lucide-react";
import { AlertDecisionEngine } from "../services/AlertDecisionEngine";

interface HeaderProps {
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  theme: "dark" | "light" | "system";
  setTheme: (theme: "dark" | "light" | "system") => void;
}

export default function Header({ onOpenMenu, onOpenSearch, theme, setTheme }: HeaderProps) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 py-3" id="athena-header">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Hamburger menu */}
        <button onClick={onOpenMenu} className="p-1 text-slate-400 hover:text-white">
          <Menu size={24} />
        </button>

        {/* Center: Brand */}
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-xl tracking-tight text-white">ATHENA</span>
            </div>
          </div>
        </div>

        {/* Right: Search + Theme Toggle */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onOpenSearch}
            className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/30 text-slate-300 hover:bg-slate-800/60 hover:text-white transition-all"
          >
            <Search size={18} />
          </button>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/30 text-slate-300 hover:bg-slate-800/60 hover:text-white transition-all"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
