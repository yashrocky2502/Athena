import React, { useState, useEffect } from "react";
import { 
  User, 
  Settings as SettingsIcon, 
  Bookmark, 
  Briefcase, 
  Moon, 
  Bell, 
  Send, 
  Terminal, 
  Info, 
  Shield, 
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Search,
  Lock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Sliders
} from "lucide-react";
import { 
  Priority,
  EventType,
  AlertSettings
} from "../types";
import { AlertDecisionEngine } from "../services/AlertDecisionEngine";
import MyIntelligence from "./MyIntelligence";
import ProfileSettings from "./ProfileSettings";
import SystemVerificationSuite from "./SystemVerificationSuite";
import AIProviderSettings from "./AIProviderSettings";
import ManageMarkets from "./ManageMarkets";

interface SettingsProps {
  email?: string;
  developerMode: boolean;
  setDeveloperMode: (val: boolean) => void;
  theme: "dark" | "light" | "system";
  setTheme: (val: "dark" | "light" | "system") => void;
  onSelectCompany?: (symbol: string) => void;
  onTriggerSearch?: (query: string) => void;
  defaultView?: SettingsView;
}

type SettingsView = "menu" | "myintel" | "research" | "watchlist" | "markets" | "theme" | "notifications" | "telegram" | "developer" | "about" | "privacy" | "account" | "aiprovider";

export default function Settings({ 
  email = "yashrocky2502@gmail.com", 
  developerMode, 
  setDeveloperMode, 
  theme, 
  setTheme,
  onSelectCompany = () => {},
  onTriggerSearch = () => {},
  defaultView
}: SettingsProps) {
  const [currentView, setCurrentView] = useState<SettingsView>(defaultView || "menu");

  useEffect(() => {
    if (defaultView) {
      setCurrentView(defaultView);
    }
  }, [defaultView]);
  const [showStoryEngineAdmin, setShowStoryEngineAdmin] = useState(false);

  // Reactive state for the persistent alert settings
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(() => AlertDecisionEngine.getInstance().getSettings());

  // Input states for Telegram configuration
  const [inputToken, setInputToken] = useState("");
  const [inputChatId, setInputChatId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Fetch stored credentials from server on mount
  useEffect(() => {
    fetch("/api/telegram/get-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.credentials) {
          if (data.credentials.botToken) setInputToken(data.credentials.botToken);
          if (data.credentials.chatId) setInputChatId(data.credentials.chatId);
        }
      })
      .catch((err) => console.error("Failed to load Telegram credentials from server:", err));
  }, []);

  // Validation UI states
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    error?: string;
    bot?: { id: number; first_name: string; username?: string };
    chat?: { id: number; type: string; title?: string; username?: string; first_name?: string; last_name?: string };
    diagnostics?: any;
  } | null>(null);

  // Send Test Message states (Phase 8 Audit)
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testMessageResult, setTestMessageResult] = useState<{
    sending: boolean;
    httpStatus?: number;
    ok?: boolean;
    messageId?: number;
    responseBody?: any;
    delivered?: boolean;
    error?: string;
  } | null>(null);

  const updateAlertSettings = (newSettings: Partial<AlertSettings>) => {
    AlertDecisionEngine.getInstance().saveSettings(newSettings);
    const updated = AlertDecisionEngine.getInstance().getSettings();
    setAlertSettings(updated);
    if (newSettings.telegramBotToken !== undefined) {
      setInputToken(newSettings.telegramBotToken);
    }
    if (newSettings.telegramChatId !== undefined) {
      setInputChatId(newSettings.telegramChatId);
    }
  };

  const menuItems = [
    { id: "myintel", label: "My Intelligence", icon: Sparkles, color: "text-indigo-400", desc: "Your daily briefing and personalized market overview" },
    { id: "markets", label: "Manage Markets", icon: Sliders, color: "text-indigo-400", desc: "Customize dashboard market bar, toggle indices, commodities, forex & crypto" },
    { id: "aiprovider", label: "AI Router Dashboard", icon: Sparkles, color: "text-indigo-400", desc: "View real-time multi-model routing telemetry and fallbacks" },
    { id: "research", label: "Saved Research", icon: Bookmark, color: "text-amber-400", desc: "Access your bookmarked queries and reports" },
    { id: "watchlist", label: "Watchlists", icon: Briefcase, color: "text-emerald-400", desc: "Manage your followed stocks and sectors" },
    { id: "theme", label: "Theme", icon: Moon, color: "text-slate-400", desc: "Switch between dark, light, and system appearance" },
    { id: "notifications", label: "Notifications", icon: Bell, color: "text-rose-400", desc: "Configure push and in-app market alerts" },
    { id: "telegram", label: "Telegram Integration", icon: Send, color: "text-sky-400", desc: "Connect Athena to your Telegram account" },
    { id: "developer", label: "Developer Mode", icon: Terminal, color: "text-emerald-500", desc: "System telemetry and MCP orchestration tools" },
    { id: "about", label: "About Athena", icon: Info, color: "text-indigo-500", desc: "Platform version, data grounding info, and disclosures" },
    { id: "privacy", label: "Privacy", icon: Shield, color: "text-emerald-600", desc: "Data sharing preferences and security settings" },
    { id: "account", label: "Account Settings", icon: User, color: "text-slate-300", desc: "Manage profile, subscription, and credentials", disabled: true },
  ];

  if (currentView !== "menu") {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-200">
        <button 
          onClick={() => setCurrentView("menu")}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors w-fit group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Settings</span>
        </button>

        {currentView === "myintel" && (
          <MyIntelligence 
            onSelectCompany={onSelectCompany}
            onViewResearch={(item) => {
              if (item.type === "Search" && item.data?.query) {
                onTriggerSearch(item.data.query);
              }
            }}
            developerMode={developerMode}
          />
        )}

        {currentView === "aiprovider" && developerMode && (
          <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6">
            <AIProviderSettings />
          </div>
        )}

        {currentView === "research" && (
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6">
            <MyIntelligence 
              onSelectCompany={onSelectCompany}
              onViewResearch={(item) => {
                if (item.type === "Search" && item.data?.query) {
                  onTriggerSearch(item.data.query);
                }
              }}
              developerMode={developerMode}
              initialTab="research"
            />
          </div>
        )}

        {currentView === "markets" && (
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6">
            <ManageMarkets />
          </div>
        )}

        {currentView === "watchlist" && (
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6">
            <MyIntelligence 
              onSelectCompany={onSelectCompany}
              onViewResearch={(item) => {
                if (item.type === "Search" && item.data?.query) {
                  onTriggerSearch(item.data.query);
                }
              }}
              developerMode={developerMode}
              initialTab="watchlist"
            />
          </div>
        )}

        {currentView === "developer" && developerMode && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6">
              <SystemVerificationSuite />
            </div>
            
            <ProfileSettings 
              email={email}
              developerMode={developerMode}
              setDeveloperMode={setDeveloperMode}
              theme={theme}
              setTheme={setTheme}
              onNavigateToStoryEngine={() => setShowStoryEngineAdmin(true)}
              showStoryEngineAdmin={showStoryEngineAdmin}
              setShowStoryEngineAdmin={setShowStoryEngineAdmin}
            />
          </div>
        )}

        {(currentView === "theme" || currentView === "about" || currentView === "privacy") && (
          <ProfileSettings 
            email={email}
            developerMode={developerMode}
            setDeveloperMode={setDeveloperMode}
            theme={theme}
            setTheme={setTheme}
            onNavigateToStoryEngine={() => setShowStoryEngineAdmin(true)}
            showStoryEngineAdmin={showStoryEngineAdmin}
            setShowStoryEngineAdmin={setShowStoryEngineAdmin}
          />
        )}

        {currentView === "notifications" && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-4 bg-rose-500/10 border border-rose-500/20 p-6 rounded-3xl">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-500">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Alert Decision Engine</h3>
                <p className="text-xs text-slate-400">Configure how Athena filters market noise and notifies you.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Minimum Priority */}
              <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Minimum Alert Priority</label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(Priority).map(p => (
                    <button
                      key={p}
                      onClick={() => updateAlertSettings({ minPriority: p })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        alertSettings.minPriority === p
                        ? "bg-rose-500 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-750"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-3 italic">Athena will suppress any signals with a score below this priority level.</p>
              </div>

              {/* Preferences Toggle */}
              <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Delivery Controls</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">Market Hours Only</span>
                      <input 
                        type="checkbox" 
                        checked={alertSettings.marketHoursOnly}
                        onChange={(e) => updateAlertSettings({ marketHoursOnly: e.target.checked })}
                        className="accent-rose-500"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">Silent Mode</span>
                      <input 
                        type="checkbox" 
                        checked={alertSettings.silentMode}
                        onChange={(e) => updateAlertSettings({ silentMode: e.target.checked })}
                        className="accent-rose-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alert Types */}
            <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Subscribed Alert Types</label>
              <div className="flex flex-wrap gap-2">
                {Object.values(EventType).map(type => {
                  const isEnabled = alertSettings.preferredAlertTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        const current = alertSettings.preferredAlertTypes;
                        const next = isEnabled ? current.filter(t => t !== type) : [...current, type];
                        updateAlertSettings({ preferredAlertTypes: next });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                        isEnabled
                        ? "bg-slate-100 text-slate-900"
                        : "bg-slate-800 text-slate-500 opacity-60"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coming Soon Integrations */}
            <div className="bg-slate-900/20 border border-slate-900/50 p-6 rounded-3xl border-dashed">
              <h4 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                <Send className="h-4 w-4" />
                External Delivery Channels
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-60 grayscale">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Telegram Bot</span>
                  <span className="text-[8px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">COMING SOON</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Push Notifications</span>
                  <span className="text-[8px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">COMING SOON</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === "telegram" && (
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <div className="h-12 w-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                <Send className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Telegram Bot Integration</h3>
                <p className="text-xs text-slate-400">Manage your Telegram alerts and command connection.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-sm font-bold text-white block">Telegram Alerts Enabled</span>
                  <span className="text-xs text-slate-500">Receive alerts on your Telegram account</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={alertSettings.telegramEnabled}
                  onChange={(e) => updateAlertSettings({ telegramEnabled: e.target.checked })}
                  className="accent-sky-500 h-5 w-5 cursor-pointer"
                />
              </div>

              {/* Bot Token with Eye Toggle */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bot Token</label>
                  <span className="text-[9px] text-slate-400">Get this from @BotFather</span>
                </div>
                <div className="relative">
                  <input 
                    type={showToken ? "text" : "password"}
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    placeholder="Paste your bot token here..."
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 pr-10 text-sm focus:border-sky-500 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    title={showToken ? "Hide Bot Token" : "Show Bot Token"}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Chat ID Input */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chat ID</label>
                  <span className="text-[9px] text-slate-400">Get this from @userinfobot or @GetMyChatID_Bot</span>
                </div>
                <input 
                  type="text"
                  value={inputChatId}
                  onChange={(e) => setInputChatId(e.target.value)}
                  placeholder="Enter your private chat or group ID..."
                  className="bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-sky-500 outline-none font-mono"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <button
                  disabled={isSaving}
                  onClick={async () => {
                    if (!inputToken.trim() || !inputChatId.trim()) {
                      alert("Please provide both Bot Token and Chat ID.");
                      return;
                    }
                    setIsSaving(true);
                    setSaveStatus(null);
                    try {
                      const res = await fetch("/api/telegram/save", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          token: inputToken.trim(),
                          chatId: inputChatId.trim(),
                        }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setSaveStatus("Credentials saved to .telegram_config.json");
                      } else {
                        setSaveStatus(`Error: ${data.error}`);
                      }
                    } catch (e: any) {
                      setSaveStatus(`Save failed: ${e?.message || e}`);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl px-4 py-3 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Credentials"}
                </button>

                <button 
                  disabled={isValidating}
                  onClick={async () => {
                    if (!inputToken.trim() || !inputChatId.trim()) {
                      alert("Please provide both Bot Token and Chat ID before validating.");
                      return;
                    }

                    setIsValidating(true);
                    setValidationResult(null);

                    try {
                      const res = await fetch("/api/telegram/validate", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          token: inputToken.trim(),
                          chatId: inputChatId.trim()
                        })
                      });

                      const data = await res.json();
                      setValidationResult(data);

                      if (data.success) {
                        // Automatically save on success
                        await fetch("/api/telegram/save", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            token: inputToken.trim(),
                            chatId: inputChatId.trim(),
                          }),
                        });
                      }
                    } catch (error: any) {
                      console.error("Failed to perform Telegram validation:", error);
                      setValidationResult({
                        success: false,
                        error: `Network error: ${error?.message || error}`
                      });
                    } finally {
                      setIsValidating(false);
                    }
                  }}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800/40 text-white font-bold text-xs rounded-xl py-3 transition-all flex items-center justify-center gap-2"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    "Validate Credentials"
                  )}
                </button>

                <button 
                  disabled={isSendingTest}
                  onClick={async () => {
                    setIsSendingTest(true);
                    setTestMessageResult({ sending: true });

                    try {
                      const res = await fetch("/api/telegram/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          token: inputToken.trim(),
                          chatId: inputChatId.trim()
                        })
                      });

                      const data = await res.json();
                      const isOk = res.ok && data.success === true;

                      setTestMessageResult({
                        sending: false,
                        httpStatus: res.status,
                        ok: isOk,
                        messageId: data.messageId,
                        responseBody: data,
                        delivered: isOk,
                        error: isOk ? undefined : (data.error || `HTTP ${res.status}`)
                      });
                    } catch (error: any) {
                      setTestMessageResult({
                        sending: false,
                        httpStatus: 500,
                        ok: false,
                        delivered: false,
                        error: error?.message || String(error)
                      });
                    } finally {
                      setIsSendingTest(false);
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 font-bold text-xs rounded-xl px-4 py-3 transition-all flex items-center justify-center gap-2"
                >
                  {isSendingTest ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    "Send Test Message"
                  )}
                </button>
              </div>

              {saveStatus && (
                <div className="text-xs font-mono text-emerald-400 p-2 bg-emerald-950/30 rounded-lg border border-emerald-500/20">
                  {saveStatus}
                </div>
              )}
            </div>

            {/* Test Message Trace & Pipeline Feedback (Phase 8 Audit) */}
            {testMessageResult && (
              <div className={`p-4 rounded-xl border flex flex-col gap-3 animate-in fade-in duration-200 ${
                testMessageResult.delivered 
                  ? "bg-sky-950/40 border-sky-500/30 text-sky-300" 
                  : "bg-rose-950/40 border-rose-500/30 text-rose-300"
              }`}>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-200">
                    <Send className="h-4 w-4 text-sky-400" />
                    <span>Phase 8 Manual Test Trace</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    testMessageResult.sending ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                    testMessageResult.delivered ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}>
                    {testMessageResult.sending ? "Sending..." : testMessageResult.delivered ? "DELIVERED" : "FAILED"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-900">
                    <span className="text-[10px] text-slate-500 block">PIPELINE STATUS</span>
                    <span className="text-white font-semibold">{testMessageResult.sending ? "Sending..." : "Completed"}</span>
                  </div>
                  <div className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-900">
                    <span className="text-[10px] text-slate-500 block">HTTP STATUS</span>
                    <span className={testMessageResult.httpStatus === 200 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {testMessageResult.httpStatus || "200 OK"}
                    </span>
                  </div>
                  <div className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-900">
                    <span className="text-[10px] text-slate-500 block">TELEGRAM MESSAGE ID</span>
                    <span className="text-sky-300 font-bold font-mono">
                      {testMessageResult.messageId ? `#${testMessageResult.messageId}` : "N/A"}
                    </span>
                  </div>
                </div>

                {testMessageResult.responseBody && (
                  <div className="bg-slate-950/90 p-3 rounded-lg border border-slate-900 font-mono text-[11px] text-slate-400 overflow-x-auto">
                    <span className="text-[10px] text-slate-500 block mb-1 uppercase font-bold">Telegram API Response</span>
                    <pre className="text-slate-300 text-[10px] leading-relaxed">
                      {JSON.stringify(testMessageResult.responseBody, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Validation Feedback & Diagnostics */}
            {validationResult && (
              <div className={`p-4 rounded-xl border flex flex-col gap-3 animate-in fade-in duration-200 ${
                validationResult.success 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                  : "bg-rose-500/10 border-rose-500/20 text-rose-300"
              }`}>
                <div className="flex items-start gap-3">
                  {validationResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold text-sm text-white">
                      {validationResult.success ? "Validation Succeeded!" : "Validation Failed"}
                    </span>
                    <p className="text-xs mt-1 text-slate-300">
                      {validationResult.success 
                        ? "Both the Bot Token and Chat ID are fully valid. Stored securely." 
                        : validationResult.error || "An error occurred during verification."}
                    </p>
                  </div>
                </div>

                {/* Structured details */}
                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-900 text-xs font-mono text-slate-400 flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1 text-[10px] text-slate-500 tracking-wider uppercase font-bold">
                    <span>Validation Stage Details</span>
                    <span>JSON DIAGNOSTICS</span>
                  </div>
                  {validationResult.bot && (
                    <div className="flex flex-col gap-1">
                      <div className="text-slate-500 text-[10px]">BOT IDENTITY:</div>
                      <div className="flex justify-between pl-2 border-l border-slate-800">
                        <span>Name:</span>
                        <span className="text-white font-medium">{validationResult.bot.first_name}</span>
                      </div>
                      <div className="flex justify-between pl-2 border-l border-slate-800">
                        <span>Username:</span>
                        <span className="text-sky-400">@{validationResult.bot.username || "N/A"}</span>
                      </div>
                    </div>
                  )}

                  {validationResult.chat && (
                    <div className="flex flex-col gap-1 mt-1.5">
                      <div className="text-slate-500 text-[10px]">TARGET CHAT ID ({inputChatId}):</div>
                      <div className="flex justify-between pl-2 border-l border-slate-800">
                        <span>Type:</span>
                        <span className="text-white capitalize">{validationResult.chat.type}</span>
                      </div>
                      {validationResult.chat.title && (
                        <div className="flex justify-between pl-2 border-l border-slate-800">
                          <span>Title:</span>
                          <span className="text-white">{validationResult.chat.title}</span>
                        </div>
                      )}
                      {(validationResult.chat.first_name || validationResult.chat.last_name) && (
                        <div className="flex justify-between pl-2 border-l border-slate-800">
                          <span>User:</span>
                          <span className="text-white text-right">
                            {[validationResult.chat.first_name, validationResult.chat.last_name].filter(Boolean).join(" ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {validationResult.diagnostics && (
                    <div className="flex flex-col gap-1 mt-2 border-t border-slate-900 pt-2 text-[10px]">
                      <div className="text-slate-500 font-bold uppercase tracking-wide">Detailed Pipeline Diagnostics:</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-2 border-l border-slate-800">
                        <div className="flex justify-between col-span-2">
                          <span className="text-slate-500">getMe API:</span>
                          <span className={validationResult.diagnostics.getMeOk ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                            {validationResult.diagnostics.getMeOk ? `OK (${validationResult.diagnostics.getMeStatus})` : "Failed"}
                          </span>
                        </div>
                        {validationResult.diagnostics.getMeLatencyMs && (
                          <div className="flex justify-between col-span-2">
                            <span className="text-slate-500">getMe Latency:</span>
                            <span className="text-slate-300">{validationResult.diagnostics.getMeLatencyMs}ms</span>
                          </div>
                        )}
                        <div className="flex justify-between col-span-2">
                          <span className="text-slate-500">getChat API:</span>
                          <span className={validationResult.diagnostics.getChatOk ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                            {validationResult.diagnostics.getChatOk ? `OK (${validationResult.diagnostics.getChatStatus})` : "Failed"}
                          </span>
                        </div>
                        {validationResult.diagnostics.getChatLatencyMs && (
                          <div className="flex justify-between col-span-2">
                            <span className="text-slate-500">getChat Latency:</span>
                            <span className="text-slate-300">{validationResult.diagnostics.getChatLatencyMs}ms</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 text-[10px] text-slate-500 leading-normal font-mono mt-2">
              <p>Connection Last Verified: {alertSettings.telegramLastTestAt ? new Date(alertSettings.telegramLastTestAt).toLocaleString() : "Never verified"}</p>
            </div>
          </div>
        )}

        {currentView === "account" && (
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-8 text-center flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-400">
              <Lock className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Future Account Settings</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
                Subscription management, multi-device sync, and professional API tier access will be available in the next release.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200 text-left max-w-3xl mx-auto pb-20">
      <div className="flex flex-col gap-1 mb-2">
        <h2 className="font-display font-bold text-2xl text-white">Settings</h2>
        <p className="text-sm text-slate-400">Configure your terminal, manage data, and access your personal intelligence assets.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {menuItems
          .filter(item => {
            if (item.id === "developer") return developerMode;
            if (item.id === "aiprovider") return developerMode;
            return true;
          })
          .map((item) => (
          <button
            key={item.id}
            disabled={item.disabled}
            onClick={() => setCurrentView(item.id as SettingsView)}
            className={`flex items-center justify-between p-4 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/60 transition-all group text-left ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-center ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {item.label}
                  {item.disabled && <span className="ml-2 text-[8px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase font-mono">Coming Soon</span>}
                </span>
                <span className="text-xs text-slate-500 line-clamp-1">{item.desc}</span>
              </div>
            </div>
            {!item.disabled && (
              <ChevronRight className="h-5 w-5 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-br from-indigo-500/5 to-emerald-500/5 border border-slate-900 rounded-3xl text-center">
        <div className="h-10 w-10 bg-white/5 rounded-full mx-auto flex items-center justify-center mb-4">
          <Sparkles className="h-5 w-5 text-indigo-400" />
        </div>
        <h4 className="text-sm font-bold text-white">Athena Terminal v2.4.0-pro</h4>
        <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase tracking-widest">Enterprise Intelligence Build</p>
        <p className="text-xs text-slate-400 mt-4 max-w-md mx-auto italic">
          "The best way to predict the future is to create it."
        </p>
      </div>
    </div>
  );
}
