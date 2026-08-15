import React, { useState } from "react";
import { Search, Sparkles, ArrowRight, Loader2, Link2, Copy, Check, RotateCcw, HelpCircle, Activity, Code, Database, Clock, Bookmark, Building2 } from "lucide-react";
import { OpenIntelligence } from "../services/OpenIntelligenceEngine";
import { SearchResponse } from "../types";
import Confidence from "./Confidence";
import { CompanyResolverService } from "../services/CompanyResolverService";
import { IntelligenceCoordinator } from "../mcp/IntelligenceCoordinator";
import { ResearchService } from "../services/ResearchService";

import { CompanyIdentityResolver } from "../lib/CompanyIdentityResolver";

const SUGGESTED_QUERIES = [
  { text: "What is the 12-month outlook for Reliance Industries?", label: "Reliance Analysis" },
  { text: "Impact of the Union Budget on LTCG and STCG tax?", label: "Union Budget Tax" },
  { text: "Is Tata Motors a Strong Buy right now with EV dominance?", label: "Tata Motors EV" },
  { text: "Which Indian defense & renewable sectors have the best growth?", label: "Breakout Sectors" }
];

interface AiSearchProps {
  triggerQuery?: string;
  onClearTrigger?: () => void;
  onSelectCompany?: (symbol: string) => void;
  onSelectMarketAsset?: (symbol: string, tab: "India" | "Global" | "Crypto" | "Commodities" | "Currencies") => void;
  developerMode?: boolean;
}

export default function AiSearch({ triggerQuery, onClearTrigger, onSelectCompany, onSelectMarketAsset, developerMode }: AiSearchProps) {
  const coordinator = IntelligenceCoordinator.getInstance();
  const researchService = ResearchService.getInstance();
  
  const [query, setQuery] = useState("");
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const detectAsset = (queryText: string): { symbol: string; name: string; type: 'stock' | 'index' | 'crypto' | 'commodity' | 'currency' } | null => {
    const q = queryText.toUpperCase().trim();
    
    // Crypto keywords
    if (q.includes("BITCOIN") || q === "BTC") return { symbol: "BTC-USD", name: "Bitcoin", type: 'crypto' };
    if (q.includes("ETHEREUM") || q === "ETH") return { symbol: "ETH-USD", name: "Ethereum", type: 'crypto' };
    if (q.includes("SOLANA") || q === "SOL") return { symbol: "SOL-USD", name: "Solana", type: 'crypto' };
    
    // Index keywords
    if (q.includes("NIFTY 50") || q === "NIFTY") return { symbol: "^NSEI", name: "Nifty 50", type: 'index' };
    if (q.includes("SENSEX")) return { symbol: "^BSESN", name: "BSE Sensex", type: 'index' };
    if (q.includes("BANK NIFTY") || q.includes("NIFTY BANK")) return { symbol: "^NSEBANK", name: "Nifty Bank", type: 'index' };
    if (q.includes("S&P 500") || q === "SPX") return { symbol: "^GSPC", name: "S&P 500", type: 'index' };
    if (q.includes("NASDAQ") || q === "IXIC") return { symbol: "^IXIC", name: "Nasdaq Composite", type: 'index' };
    
    // Currency keywords
    if (q.includes("USDINR") || q.includes("DOLLAR RUPEE")) return { symbol: "USDINR=X", name: "USD/INR", type: 'currency' };
    if (q.includes("EURUSD")) return { symbol: "EURUSD=X", name: "EUR/USD", type: 'currency' };
    
    // Commodity keywords
    if (q.includes("GOLD PRICE") || q === "GOLD") return { symbol: "GC=F", name: "Gold Futures", type: 'commodity' };
    if (q.includes("CRUDE OIL") || q === "CRUDE") return { symbol: "CL=F", name: "Crude Oil Futures", type: 'commodity' };
    if (q.includes("SILVER PRICE") || q === "SILVER") return { symbol: "SI=F", name: "Silver Futures", type: 'commodity' };

    // Stock keywords - use canonical resolver
    const canonical = CompanyIdentityResolver.getInstance().resolve(q);
    if (canonical && canonical.officialName && canonical.canonicalSymbol !== q.replace(".NS", "")) {
      return { symbol: canonical.canonicalSymbol, name: canonical.officialName, type: 'stock' };
    }

    if (q.includes("RELIANCE") || q === "RIL") return { symbol: "RELIANCE", name: "Reliance Industries Ltd", type: 'stock' };
    if (q.includes("TATA MOTOR") || q.includes("TATAMOTORS")) return { symbol: "TATAMOTORS", name: "Tata Motors Passenger Vehicles Ltd", type: 'stock' };
    if (q.includes("HDFC") || q === "HDFCBANK") return { symbol: "HDFCBANK", name: "HDFC Bank Ltd", type: 'stock' };
    if (q.includes("INFOSYS") || q === "INFY") return { symbol: "INFY", name: "Infosys Ltd", type: 'stock' };
    if (q.includes("ZOMATO") || q.includes("ETERNAL")) return { symbol: "ETERNAL", name: "Eternal Ltd", type: 'stock' };
    if (q.includes("ITC")) return { symbol: "ITC", name: "ITC Ltd", type: 'stock' };
    
    return null;
  };

  const matchedAsset = detectAsset(query);
  const resolver = CompanyResolverService.getInstance();


  React.useEffect(() => {
    if (triggerQuery) {
      handleSearch(triggerQuery, false);
      if (onClearTrigger) {
        onClearTrigger();
      }
    }
  }, [triggerQuery]);

  const loadingSteps = [
    "Analyzing query intent via Query Planner...",
    "Consulting Indian market filings (NSE/BSE)...",
    "Running custom macroeconomic analysis models...",
    "Querying Gemini AI for synthesized intelligence...",
    "Drafting Bloomberg-standard expert brief..."
  ];

  const handleSearch = async (searchQuery: string, isFollowUp: boolean = false) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setLoadingStep(0);

    let currentHistory = chatHistory;
    
    if (!isFollowUp) {
      setQuery(searchQuery);
      setResult(null);
      setChatHistory([]);
      currentHistory = [];
    } else {
      setFollowUpQuery("");
      // Add previous result to history
      currentHistory = [...chatHistory, { role: "user", parts: [{ text: query }] }, { role: "model", parts: [{ text: result?.text || "" }] }];
      setChatHistory(currentHistory);
      setQuery(searchQuery); // Update main query display
    }

    // Dynamic loading text transition
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
    }, 1200);

    try {
      // Step 1: Try to resolve as a company or asset
      const company = await resolver.resolveCompany(searchQuery);
      if (company && (onSelectCompany || onSelectMarketAsset)) {
        const exchange = company.profile?.exchange?.toUpperCase() || "";
        const symbol = company.symbol.toUpperCase();
        
        // Handle non-stock assets
        if (symbol.startsWith("^") || ["SNP", "NYQ", "NSI", "BSE", "NSE"].includes(exchange) === false || company.profile?.industry === "Cryptocurrency") {
          if (onSelectMarketAsset) {
            let tab: "India" | "Global" | "Crypto" | "Commodities" | "Currencies" = "Global";
            if (exchange === "NSE" || exchange === "BSE" || symbol.endsWith(".NS") || symbol.endsWith(".BO") || ["^NSEI", "^BSESN", "^NSEBANK"].includes(symbol)) tab = "India";
            else if (exchange === "CCC" || symbol.endsWith("-USD")) tab = "Crypto";
            else if (exchange === "CCY" || symbol.includes("=X")) tab = "Currencies";
            else if (exchange === "CMX" || exchange === "NYM" || exchange === "CBT" || symbol.endsWith("=F")) tab = "Commodities";
            
            onSelectMarketAsset(company.symbol, tab);
            setLoading(false);
            clearInterval(stepInterval);
            return;
          }
        }

        if (onSelectCompany) {
          onSelectCompany(company.symbol);
          setLoading(false);
          clearInterval(stepInterval);
          return;
        }
      }
      
      // If we detected it as a company but resolution failed, show error instead of fallback
      if (matchedAsset) {
        console.error("Asset detected but resolution failed:", matchedAsset);
        setLoading(false);
        clearInterval(stepInterval);
        return;
      }

      // Step 2: Fallback to AI Search
      const data = await coordinator.requestData({
        query: searchQuery,
        priority: 1, // User search = Priority 1
        source: "User AI Search",
        customFetcher: async () => {
          const response = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchQuery, history: currentHistory }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch financial intelligence");
          }

          return await response.json();
        }
      });

      setResult(data);
    } catch (error) {
      console.error("AI Search Error:", error);
      setResult({
        text: `⚡ Smart Summary\n\n### What Happened\nSystem offline.\n\n### Why It Matters\nData unavailable.\n\n### Who Is Affected\nSystem Users\n\n### Risks\nN/A\n\n### Confidence\nLow\n\n### Estimated Reading Time\n5 seconds\n\n***\n\n## Detailed Analysis\nThe live AI search and grounding engine is currently offline or unavailable.`,
        sources: []
      });
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBookmark = () => {
    if (result) {
      researchService.saveResearch("Search", query, result);
      setIsBookmarked(true);
      setTimeout(() => setIsBookmarked(false), 2000);
    }
  };

  // Helper to parse simple markdown to JSX safely
  const renderParsedMarkdown = (markdown: string) => {
    return markdown.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith("###")) {
        return (
          <h4 key={idx} className="font-display font-bold text-lg text-slate-100 mt-5 mb-2.5 flex items-center gap-2 border-b border-slate-800 pb-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            {trimmed.replace("###", "").trim()}
          </h4>
        );
      }
      
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        return (
          <p key={idx} className="font-semibold text-slate-200 mt-3 mb-1.5 text-sm uppercase tracking-wider text-emerald-400">
            {trimmed.replace(/\*\*/g, "").trim()}
          </p>
        );
      }

      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        // Bullet list
        const content = trimmed.substring(1).trim();
        // Check for nested bold text
        const boldMatch = content.match(/\*\*(.*?)\*\*(.*)/);
        if (boldMatch) {
          return (
            <li key={idx} className="ml-4 list-disc text-slate-300 text-sm leading-relaxed mb-1.5">
              <strong className="text-slate-100">{boldMatch[1]}</strong>
              {boldMatch[2]}
            </li>
          );
        }
        return (
          <li key={idx} className="ml-4 list-disc text-slate-300 text-sm leading-relaxed mb-1.5">
            {content}
          </li>
        );
      }

      if (/^\d+\./.test(trimmed)) {
        // Numbered list
        const content = trimmed.replace(/^\d+\./, "").trim();
        const boldMatch = content.match(/\*\*(.*?)\*\*(.*)/);
        if (boldMatch) {
          return (
            <div key={idx} className="flex gap-2.5 items-start text-slate-300 text-sm leading-relaxed mb-2 ml-1">
              <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 h-5 w-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                {line.match(/^\d+/)?.[0]}
              </span>
              <div>
                <strong className="text-slate-100">{boldMatch[1]}</strong>
                {boldMatch[2]}
              </div>
            </div>
          );
        }
        return (
          <div key={idx} className="flex gap-2.5 items-start text-slate-300 text-sm leading-relaxed mb-2 ml-1">
            <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 h-5 w-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
              {line.match(/^\d+/)?.[0]}
            </span>
            <span className="text-slate-300">{content}</span>
          </div>
        );
      }

      // Plain paragraph
      if (!trimmed) return <div key={idx} className="h-2.5"></div>;

      // Inline bold parsing
      const parts = trimmed.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={idx} className="text-slate-300 text-sm leading-relaxed mb-2.5">
          {parts.map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} className="text-white font-medium">{part}</strong> : part))}
        </p>
      );
    });
  };

  return (
    <section className="bg-slate-900/40 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl relative overflow-hidden" id="athena-ai-search">
      {/* Background radial accent */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-br from-emerald-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {!result && !loading && (
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Perplexity-Style Financial Engine
          </div>
          <h2 className="font-display font-bold text-2xl md:text-3xl text-white tracking-tight">
            Ask Athena Anything
          </h2>
          <p className="text-slate-400 text-sm max-w-lg mx-auto mt-1.5">
            Get instant, institutional-grade briefs on Indian stocks, regulatory policies, macroeconomic cues, and portfolio risks.
          </p>

          {/* Search form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="mt-6 max-w-2xl mx-auto relative group"
          >
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="e.g. Is Reliance a buy with tariff hikes and new energy factories?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-950 hover:bg-slate-950/85 text-slate-200 placeholder-slate-500 font-sans text-sm md:text-base pl-12 pr-12 py-3.5 rounded-xl border border-slate-800 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="absolute right-2 top-2 h-9 w-9 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg flex items-center justify-center transition-all disabled:bg-slate-800 disabled:text-slate-600 cursor-pointer"
            >
              <ArrowRight className="h-4 w-4" />
            </button>

            {/* Meilisearch Instant Fuzzy Search Dropdown */}
            {query.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-950 border border-indigo-500/30 rounded-xl p-2 shadow-2xl z-50 text-left max-h-60 overflow-y-auto">
                <div className="text-[10px] font-mono text-indigo-400 px-3 py-1 font-bold uppercase tracking-wider flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1">
                  <span>Meilisearch Instant Index</span>
                  <span className="text-[9px] text-slate-500">Fuzzy Search Enabled</span>
                </div>
                {OpenIntelligence.meilisearch.search(query).length > 0 ? (
                  OpenIntelligence.meilisearch.search(query).map((res, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        if (res.type === 'Company' && onSelectCompany) {
                          onSelectCompany(res.symbol);
                        } else {
                          handleSearch(res.title);
                        }
                      }}
                      className="p-2 hover:bg-slate-900/80 rounded-lg cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div>
                        <span className="text-xs font-bold text-white group-hover:text-indigo-300 block">{res.title}</span>
                        <span className="text-[10px] text-slate-400 block">{res.subtitle}</span>
                      </div>
                      <span className="text-[9px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-900 px-2 py-0.5 rounded">
                        {res.type}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-xs text-slate-500 font-mono text-center">
                    No instant symbol match — Press Enter for Gemini Search
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Real-time Asset Intelligence Match Banner */}
          {matchedAsset && (onSelectCompany || onSelectMarketAsset) && (
            <div className="mt-3.5 max-w-2xl mx-auto bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between animate-fadeIn text-left">
              <div className="flex items-center gap-2.5">
                <span className="text-xs bg-emerald-500 text-slate-950 font-mono font-bold px-1.5 py-0.5 rounded">
                  {matchedAsset.symbol}
                </span>
                <p className="text-xs text-emerald-300">
                  Open dedicated <strong>{matchedAsset.name}</strong> {matchedAsset.type === 'stock' ? 'Intelligence Dashboard' : 'Market View'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (matchedAsset.type === 'stock' && onSelectCompany) {
                    onSelectCompany(matchedAsset.symbol);
                  } else if (onSelectMarketAsset) {
                    let tab: "India" | "Global" | "Crypto" | "Commodities" | "Currencies" = "India";
                    if (matchedAsset.type === 'crypto') tab = "Crypto";
                    else if (matchedAsset.type === 'currency') tab = "Currencies";
                    else if (matchedAsset.type === 'commodity') tab = "Commodities";
                    else if (matchedAsset.type === 'index') {
                        tab = ["^NSEI", "^BSESN", "^NSEBANK"].includes(matchedAsset.symbol) ? "India" : "Global";
                    }
                    onSelectMarketAsset(matchedAsset.symbol, tab);
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-sans text-xs px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
              >
                {matchedAsset.type === 'stock' ? 'Open Intel' : 'View Market'}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Suggestions */}
          <div className="mt-5 max-w-2xl mx-auto text-left">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono font-bold block mb-2.5">
              Suggested Intelligence Queries
            </span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUERIES.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(item.text)}
                  className="bg-slate-950/60 hover:bg-slate-950 hover:border-slate-700 text-slate-300 hover:text-white border border-slate-800/80 rounded-lg px-3 py-2 text-xs text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer max-w-[280px] sm:max-w-xs"
                >
                  <span className="truncate">{item.label}</span>
                  <ArrowRight className="h-3 w-3 text-slate-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-2 border-slate-800/80 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-emerald-400 animate-spin" />
            </div>
            <div className="absolute inset-0 bg-emerald-400/10 rounded-full blur-md"></div>
          </div>
          <p className="mt-4 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider">
            ATHENA DYNAMIC QUERY AGENT
          </p>
          <p className="mt-1.5 text-slate-300 font-sans text-sm animate-pulse">
            {loadingSteps[loadingStep]}
          </p>
          <div className="w-48 bg-slate-950 h-1.5 rounded-full mt-4 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full transition-all duration-1000 ease-out"
              style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Results state */}
      {result && !loading && (
        <div className="animate-fadeIn">
          {/* Query Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-slate-100 font-semibold text-base line-clamp-1">
                {query}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBookmark}
                className="flex items-center gap-1.5 bg-slate-950/60 hover:bg-slate-950 hover:border-slate-700 text-slate-300 border border-slate-800 rounded px-2.5 py-1 text-xs transition-all cursor-pointer font-medium"
              >
                {isBookmarked ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Saved</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="h-3.5 w-3.5 text-slate-400" />
                    <span>Save</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 bg-slate-950/60 hover:bg-slate-950 hover:border-slate-700 text-slate-300 border border-slate-800 rounded px-2.5 py-1 text-xs transition-all cursor-pointer font-medium"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setResult(null);
                  setQuery("");
                }}
                className="flex items-center gap-1.5 bg-slate-950/60 hover:bg-slate-950 hover:border-slate-700 text-slate-300 border border-slate-800 rounded px-2.5 py-1 text-xs transition-all cursor-pointer font-medium"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                <span>New Query</span>
              </button>
            </div>
          </div>

          {/* Real-time Asset Intelligence Match Banner for Results View */}
          {matchedAsset && (onSelectCompany || onSelectMarketAsset) && (
            <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between animate-fadeIn text-left">
              <div className="flex items-center gap-2.5">
                <span className="text-xs bg-emerald-500 text-slate-950 font-mono font-bold px-2 py-0.5 rounded">
                  {matchedAsset.symbol}
                </span>
                <p className="text-xs text-emerald-300">
                  We found a dedicated <strong>{matchedAsset.name}</strong> {matchedAsset.type === 'stock' ? 'Intelligence Dashboard' : 'Market View'} for your search.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (matchedAsset.type === 'stock' && onSelectCompany) {
                    onSelectCompany(matchedAsset.symbol);
                  } else if (onSelectMarketAsset) {
                    let tab: "India" | "Global" | "Crypto" | "Commodities" | "Currencies" = "India";
                    if (matchedAsset.type === 'crypto') tab = "Crypto";
                    else if (matchedAsset.type === 'currency') tab = "Currencies";
                    else if (matchedAsset.type === 'commodity') tab = "Commodities";
                    else if (matchedAsset.type === 'index') {
                        tab = ["^NSEI", "^BSESN", "^NSEBANK"].includes(matchedAsset.symbol) ? "India" : "Global";
                    }
                    onSelectMarketAsset(matchedAsset.symbol, tab);
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-sans text-xs px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              >
                {matchedAsset.type === 'stock' ? 'Open Intel Dashboard' : 'View Market Hub'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Integrated Confidence, Facts, Analysis, and Grounding Component */}
          <Confidence 
            text={result.text} 
            sources={result.sources || []} 
            reasoningGraph={result.reasoningGraph}
          />

          {/* Developer Mode Metrics */}
          {developerMode && result.plan && (
            <div className="mt-5 bg-slate-950/60 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-slate-400">
              <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
                <Code className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold uppercase tracking-wider">Developer Metrics</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 uppercase">Intent</span>
                  <span className="text-slate-300 font-bold">{result.plan.intent}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 uppercase">Exec Time</span>
                  <span className="text-slate-300 font-bold">{result.executionTime}ms</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 uppercase">Tokens</span>
                  <span className="text-slate-300 font-bold">{result.geminiTokens}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 uppercase">Cache</span>
                  <span className={result.cacheHit ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {result.cacheHit ? "HIT" : "MISS"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="text-slate-500 uppercase">Plan Rationale</span>
                  <span className="text-slate-300">{result.plan.rationale}</span>
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="text-slate-500 uppercase">Required Sources</span>
                  <span className="text-slate-300">
                    {[
                      result.plan.requiresGoogleSearch && "Google Search",
                      result.plan.requiresKnowledgeGraph && "Knowledge Graph",
                      result.plan.requiresCompanyKnowledge && "Company Knowledge",
                      result.plan.requiresEventMemory && "Event Memory"
                    ].filter(Boolean).join(", ") || "None"}
                  </span>
                </div>
                
                {result.detectedContradictions && result.detectedContradictions.length > 0 && (
                  <div className="flex flex-col gap-2 col-span-2 sm:col-span-4 border-t border-slate-800 pt-3 mt-1">
                    <span className="text-amber-400 uppercase font-bold">Detected Contradictions ({result.detectedContradictions.length})</span>
                    {result.detectedContradictions.map((conflict, i) => (
                      <div key={i} className="bg-slate-900/50 p-2 rounded border border-slate-800">
                        <span className="text-white font-bold">{conflict.type}:</span> <span className="text-slate-300">{conflict.description}</span>
                        {conflict.resolution && (
                          <div className="mt-2 pl-2 border-l-2 border-emerald-500/50 flex flex-col gap-1">
                            <span className="text-emerald-400 font-bold">Resolved Version:</span>
                            <span className="text-slate-300 text-[9px]">{conflict.resolution.resolvedVersion}</span>
                            <span className="text-indigo-400 font-bold mt-1">Reason:</span>
                            <span className="text-slate-300 text-[9px]">{conflict.resolution.reason}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Developer Mode: Evidence Ranking */}
                {result.reasoningGraph && (
                  <div className="flex flex-col gap-2 col-span-2 sm:col-span-4 border-t border-slate-800 pt-3 mt-1">
                    <span className="text-indigo-400 uppercase font-bold">Evidence Ranking</span>
                    <div className="bg-slate-900/50 p-2 rounded border border-slate-800 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-800 pb-1">
                        <span>Supporting: {result.reasoningGraph.supportingSources.length}</span>
                        <span>Conflicting: {result.reasoningGraph.conflictingSources.length}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {result.reasoningGraph.supportingSources.map((s, i) => (
                          <div key={i} className="flex justify-between items-center bg-slate-950 p-1.5 rounded">
                            <span className="text-slate-300 truncate max-w-[200px]">{s.title}</span>
                            <span className="text-emerald-400 font-bold">High Trust</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Follow-up Question Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(followUpQuery, true);
            }}
            className="mt-5 relative group"
          >
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors">
              <RotateCcw className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Ask a follow-up question..."
              value={followUpQuery}
              onChange={(e) => setFollowUpQuery(e.target.value)}
              className="w-full bg-slate-950/60 hover:bg-slate-950/85 text-slate-200 placeholder-slate-500 font-sans text-sm pl-11 pr-11 py-3 rounded-xl border border-slate-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/10 outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={!followUpQuery.trim()}
              className="absolute right-2 top-1.5 h-8 w-8 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* Feedback/RIA disclaimer */}
          <div className="mt-5 text-slate-500 text-[10px] font-sans flex items-start gap-1.5 border-t border-slate-800/40 pt-4">
            <HelpCircle className="h-3.5 w-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
            <p>
              Athena AI is an analytical simulation platform. Financial suggestions are powered by generative intelligence models trained with real-time public parameters. This is not registered SEBI Investment Advice. Invest at your own risk.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
