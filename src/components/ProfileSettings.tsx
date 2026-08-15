import React, { useState } from "react";
import { 
  User, 
  Shield, 
  Settings, 
  Moon, 
  Sun, 
  Monitor, 
  Info, 
  FileText, 
  Terminal, 
  ChevronRight, 
  Sparkles, 
  Lock, 
  CheckCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Zap,
  HeartPulse
} from "lucide-react";
import StoryEngineDashboard from "./StoryEngineDashboard";
import McpMonitorPanel from "./McpMonitorPanel";
import { AlertPipelineMonitor } from "./AlertPipelineMonitor";
import { LiveIntelligenceMonitor } from "./LiveIntelligenceMonitor";
import { Activity } from "lucide-react";

interface ProfileSettingsProps {
  email: string;
  developerMode: boolean;
  setDeveloperMode: (val: boolean) => void;
  theme: "dark" | "light" | "system";
  setTheme: (val: "dark" | "light" | "system") => void;
  onNavigateToStoryEngine: () => void;
  showStoryEngineAdmin: boolean;
  setShowStoryEngineAdmin: (val: boolean) => void;
}

export default function ProfileSettings({
  email,
  developerMode,
  setDeveloperMode,
  theme,
  setTheme,
  onNavigateToStoryEngine,
  showStoryEngineAdmin,
  setShowStoryEngineAdmin
}: ProfileSettingsProps) {
  const [tapCount, setTapCount] = useState(0);
  const [showMcpMonitor, setShowMcpMonitor] = useState(false);
  const [showPipelineMonitor, setShowPipelineMonitor] = useState(false);
  const [showLiveIntelMonitor, setShowLiveIntelMonitor] = useState(false);

  // Hidden activation for Developer Mode via "About Athena" header clicks
  const handleLogoTap = () => {
    setTapCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setDeveloperMode(!developerMode);
        return 0;
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6 text-left max-w-2xl mx-auto pb-12" id="athena-profile-settings-root">
      
      {/* 1. Header Banner / User Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-900 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
        <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg border-2 border-slate-800 shadow-xl shadow-emerald-500/10">
          {email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-lg text-white truncate">{email.split("@")[0]}</span>
            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider font-mono font-bold">
              HNI Tier
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">{email}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">SEBI Practice Member • Active Session</p>
        </div>
      </div>

      {showStoryEngineAdmin ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400">Viewing Admin Pipeline Ingestion Dashboard</span>
            <button 
              onClick={() => setShowStoryEngineAdmin(false)}
              className="text-xs bg-slate-950 border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer"
            >
              Exit Ingestion View
            </button>
          </div>
          <StoryEngineDashboard />
        </div>
      ) : showMcpMonitor ? (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Viewing Model Context Protocol (MCP) Monitor</span>
            <button 
              onClick={() => setShowMcpMonitor(false)}
              className="text-xs bg-slate-950 border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer"
            >
              Exit MCP Monitor
            </button>
          </div>
          <McpMonitorPanel />
        </div>
      ) : showPipelineMonitor ? (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Viewing Alert Pipeline Monitor (End-to-End Reliability)</span>
            <button 
              onClick={() => setShowPipelineMonitor(false)}
              className="text-xs bg-slate-950 border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer"
            >
              Exit Pipeline Monitor
            </button>
          </div>
          <AlertPipelineMonitor />
        </div>
      ) : showLiveIntelMonitor ? (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Viewing Live Intelligence Monitor (Market Surveillance)</span>
            <button 
              onClick={() => setShowLiveIntelMonitor(false)}
              className="text-xs bg-slate-950 border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer"
            >
              Exit Live Monitor
            </button>
          </div>
          <LiveIntelligenceMonitor />
        </div>
      ) : (
        <>
          {/* 2. Primary Settings Menu */}
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 flex flex-col gap-5">
            <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
              <Settings className="h-5 w-5 text-indigo-400" />
              <h3 className="font-display font-bold text-base text-white">System Settings</h3>
            </div>

            {/* A. Theme Switcher */}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Moon className="h-4 w-4 text-slate-400" />
                Application Theme
              </span>
              <p className="text-[11px] text-slate-500 leading-normal mb-1">
                Customize appearance. Dark theme optimizes eye safety in low light, light theme delivers clean high-contrast readability.
              </p>
              
              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-850">
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer relative ${
                    theme === "dark"
                      ? "bg-slate-900 text-white border border-slate-800 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  <span>Dark</span>
                  {theme === "dark" && <CheckCircle className="h-3 w-3 absolute top-1.5 right-1.5 text-emerald-400" />}
                </button>

                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer relative ${
                    theme === "light"
                      ? "bg-slate-900 text-white border border-slate-800 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  <span>Light</span>
                  {theme === "light" && <CheckCircle className="h-3 w-3 absolute top-1.5 right-1.5 text-emerald-400" />}
                </button>

                <button
                  onClick={() => setTheme("system")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer relative ${
                    theme === "system"
                      ? "bg-slate-900 text-white border border-slate-800 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span>System</span>
                  {theme === "system" && <CheckCircle className="h-3 w-3 absolute top-1.5 right-1.5 text-emerald-400" />}
                </button>
              </div>
            </div>

            {/* B. Feedback & Privacy */}
            <div className="border-t border-slate-900 pt-4 flex flex-col gap-3">
              <button className="flex items-center justify-between text-left group cursor-pointer hover:bg-slate-900/50 p-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3 text-slate-300">
                  <FileText className="h-4 w-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  <div>
                    <span className="text-xs font-medium block">Send Feedback</span>
                    <span className="text-[10px] text-slate-500 font-mono">Report issues or suggest new features</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
              </button>

              <button className="flex items-center justify-between text-left group cursor-pointer hover:bg-slate-900/50 p-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3 text-slate-300">
                  <Shield className="h-4 w-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                  <div>
                    <span className="text-xs font-medium block">Privacy & Security</span>
                    <span className="text-[10px] text-slate-500 font-mono">Manage data sharing and local storage</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
              </button>
            </div>

            {/* C. Manual Developer Mode Toggle (Visible only if unlocked) */}
            {developerMode && (
              <div className="border-t border-slate-900 pt-4 flex items-center justify-between gap-4">
                <div className="flex-1 text-left">
                  <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-emerald-400" />
                    Developer Mode
                  </span>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                    Unlock deep in-memory knowledge-graph inspectors, shortest-path tracing tools, and mock data injection sandboxes.
                  </p>
                </div>
                <button
                  onClick={() => setDeveloperMode(false)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    developerMode ? "bg-emerald-500" : "bg-slate-800"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      developerMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {/* 3. Developer Mode Features (Rendered conditionally) */}
          {developerMode && (
            <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2 justify-between">
                <div className="flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                    Developer Pipeline Suite
                  </span>
                </div>
                <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/25 px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                  System Admin Mode
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                You have active access to Athena's analytical ingestion pipelines and system telemetry dashboards.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <button
                  onClick={() => setShowStoryEngineAdmin(true)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Story Ingestion Pipeline</span>
                      <span className="text-[10px] text-slate-500 leading-normal font-mono">Inspect incoming raw evidence, deduplication & conflict nodes.</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </button>

                <button
                  onClick={() => setShowMcpMonitor(true)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Athena MCP Monitor</span>
                      <span className="text-[10px] text-slate-500 leading-normal font-mono">Manage registered connectors, latency, queues, and sync intervals.</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </button>

                <button
                  onClick={() => setShowPipelineMonitor(true)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Alert Pipeline Monitor</span>
                      <span className="text-[10px] text-slate-500 leading-normal font-mono">End-to-end audit, observability & Telegram bot status tracing.</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
                </button>

                <button
                  onClick={() => setShowLiveIntelMonitor(true)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Live Intelligence Monitor</span>
                      <span className="text-[10px] text-slate-500 leading-normal font-mono">Autonomous market price surveillance & provider heartbeats.</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </button>
              </div>
            </div>
          )}

          {/* 4. About Athena Segment */}
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 flex flex-col gap-4">
            <div 
              onClick={handleLogoTap}
              className="flex items-center gap-2 border-b border-slate-900 pb-3 cursor-pointer select-none active:scale-95 transition-transform"
              title="Tip: Tap 5 times to toggle Developer Mode"
            >
              <Info className="h-5 w-5 text-indigo-400" />
              <h3 className="font-display font-bold text-base text-white">About Athena</h3>
              {tapCount > 0 && (
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.2 rounded ml-auto">
                  Taps: {tapCount}/5
                </span>
              )}
            </div>

            <div className="text-xs text-slate-400 leading-relaxed flex flex-col gap-3 font-sans">
              <p>
                <strong>Athena AI Financial Intelligence</strong> is an advanced quantitative research platform designed to process multi-source corporate signals, regulatory stock exchange feeds, and real-time news data.
              </p>
              <p>
                Leveraging dual-layered processing engines, Athena extracts concrete facts, cross-references corporate testimonies, evaluates reliability scoring algorithms, and constructs responsive risk-reward frameworks for individual stock tickers.
              </p>
              
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-[10px] text-slate-500 leading-normal font-mono mt-1">
                <span className="text-indigo-400 font-bold block mb-1">REGULATORY & COMPLIANCE DISCLOSURE:</span>
                This application acts strictly as a Practice Sandbox for education, modeling, and demonstration purposes. No real monetary transactions or SEBI advisory guidelines are authorized. Mock portfolios do not reflect actual brokerage accounts.
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
