import { IntelligenceCoordinator } from "../mcp/IntelligenceCoordinator";
import { MarketIndex, TrendingStock } from "../types";
import { safeLocalStorage } from "./storage/safeStorage";

export interface LiveMarketSubscription {
  id: string;
  type: "index" | "watchlist" | "company" | "portfolio" | "background";
  symbols: string[];
  callback: (data: { stocks: TrendingStock[]; indices: MarketIndex[] }) => void;
}

export interface LiveMarketTelemetry {
  activeSymbols: string[];
  requestsPerSec: number;
  cacheHitRate: number;
  nextRefresh: string;
  providerLatency: number;
  activeSubscribers: number;
  lastSuccessfulUpdate: string;
  failedUpdates: number;
}

export class LiveMarketEngine {
  private static instance: LiveMarketEngine;

  private subscribers: Map<string, LiveMarketSubscription> = new Map();
  private cache: Map<string, any> = new Map(); // Stores the last fetched price details for stocks and indices
  
  // Telemetry properties
  private requestsCount = 0;
  private requestsSecStart = Date.now();
  private lastRequestsPerSec = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private providerLatency = 0;
  private failedUpdates = 0;
  private lastSuccessfulUpdate = "Never";
  
  // Batching properties
  private pendingSymbols: Set<string> = new Set();
  private pendingIndices: Set<string> = new Set();
  private batchTimeout: NodeJS.Timeout | null = null;
  private currentFetchPromise: Promise<any> | null = null;

  // Active interval timers
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = true;

  private constructor() {
    this.startEngine();
    this.setupSystemListeners();
  }

  public static getInstance(): LiveMarketEngine {
    if (!LiveMarketEngine.instance) {
      LiveMarketEngine.instance = new LiveMarketEngine();
    }
    return LiveMarketEngine.instance;
  }

  /**
   * Start the core intervals of the live engine
   */
  public startEngine() {
    this.isRunning = true;
    this.clearAllIntervals();

    // Start requests/sec telemetry counter reset loop
    const reqSecTimer = setInterval(() => {
      const elapsed = (Date.now() - this.requestsSecStart) / 1000;
      this.lastRequestsPerSec = parseFloat((this.requestsCount / (elapsed || 1)).toFixed(1));
      this.requestsCount = 0;
      this.requestsSecStart = Date.now();
    }, 2000);
    this.intervals.set("telemetry", reqSecTimer);

    // Dynamic poll loops for each subscription tier
    this.setupPollLoop("index", 5000);
    this.setupPollLoop("watchlist", 10000);
    this.setupPollLoop("company", 10000);
    this.setupPollLoop("portfolio", 15000);
    this.setupPollLoop("background", 30000);
  }

  public stopEngine() {
    this.isRunning = false;
    this.clearAllIntervals();
  }

  private clearAllIntervals() {
    this.intervals.forEach(timer => clearInterval(timer));
    this.intervals.clear();
  }

  private setupSystemListeners() {
    if (typeof window !== "undefined") {
      // Pause/resume based on visibility or online state
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          console.log("[LiveMarketEngine] Tab hidden. Pausing live polling.");
          this.stopEngine();
        } else {
          console.log("[LiveMarketEngine] Tab visible. Resuming live polling.");
          this.startEngine();
        }
      });

      window.addEventListener("online", () => {
        console.log("[LiveMarketEngine] Device online. Resuming live polling.");
        this.startEngine();
      });

      window.addEventListener("offline", () => {
        console.log("[LiveMarketEngine] Device offline. Pausing live polling.");
        this.stopEngine();
      });
    }
  }

  /**
   * Check if the engine should pause polling.
   */
  public isPollingPaused(): boolean {
    if (!this.isRunning) return true;
    if (typeof navigator !== "undefined" && !navigator.onLine) return true;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return true;
    
    // Check market hours
    const forceOpen = safeLocalStorage.getItem("athena_force_market_open") === "true";
    if (forceOpen) return false;

    // Check if we have any "always open" symbols like Crypto or Global Indices
    const activeSymbols = new Set<string>();
    this.subscribers.forEach(sub => sub.symbols.forEach(s => activeSymbols.add(s.toUpperCase())));
    
    const hasGlobalOrCrypto = Array.from(activeSymbols).some(s => 
      s.includes("-USD") || // Crypto
      s.includes("=X") ||   // Currencies
      s.includes("=F") ||   // Commodities
      (s.startsWith("^") && !["^NSEI", "^BSESN", "^NSEBANK"].includes(s)) || // Global Indices
      (!s.endsWith(".NS") && !s.endsWith(".BO") && s.includes(".")) // Global Stocks
    );

    if (hasGlobalOrCrypto) return false; // Never pause if global/crypto are active

    // Convert to Indian Standard Time (IST) - UTC+5:30
    const d = new Date();
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    
    const day = ist.getDay(); // 0 Sunday, 6 Saturday
    if (day === 0 || day === 6) return true; // Closed on weekends
    
    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    const openTime = 9 * 60 + 15; // 9:15 AM
    const closeTime = 15 * 60 + 30; // 3:30 PM
    
    return timeInMinutes < openTime || timeInMinutes > closeTime;
  }

  /**
   * Subscribe a component/widget to live prices or indices
   */
  public subscribe(subscription: Omit<LiveMarketSubscription, "id">): string {
    const id = Math.random().toString(36).substring(7);
    this.subscribers.set(id, { ...subscription, id });
    
    console.log(`[LiveMarketEngine] New subscriber ${id} for type "${subscription.type}" with symbols:`, subscription.symbols);

    // Immediately fetch initial prices for new subscriber's symbols
    this.triggerFetch(subscription.symbols, subscription.type === "index");

    return id;
  }

  /**
   * Unsubscribe a component
   */
  public unsubscribe(id: string) {
    if (this.subscribers.has(id)) {
      const sub = this.subscribers.get(id);
      this.subscribers.delete(id);
      console.log(`[LiveMarketEngine] Subscriber ${id} unsubscribed. Active subscribers remaining: ${this.subscribers.size}`);
    }
  }

  /**
   * Set up a specific polling tier loop
   */
  private setupPollLoop(type: "index" | "watchlist" | "company" | "portfolio" | "background", intervalMs: number) {
    const timer = setInterval(() => {
      if (this.isPollingPaused()) return;

      // Collect all active symbols for this subscription tier
      const symbolsToPoll = new Set<string>();
      let isIndex = false;

      this.subscribers.forEach(sub => {
        if (sub.type === type) {
          sub.symbols.forEach(s => symbolsToPoll.add(s));
          if (type === "index") isIndex = true;
        }
      });

      if (symbolsToPoll.size > 0) {
        this.triggerFetch(Array.from(symbolsToPoll), isIndex);
      }
    }, intervalMs);

    this.intervals.set(`loop-${type}`, timer);
  }

  /**
   * Enqueue symbols to be batched and fetched
   */
  public triggerFetch(symbols: string[], isIndex: boolean) {
    if (isIndex) {
      symbols.forEach(s => this.pendingIndices.add(s));
    } else {
      symbols.forEach(s => this.pendingSymbols.add(s));
    }

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, 50); // Small 50ms aggregation window to combine multiple subscription requests
  }

  /**
   * Flush the pending batch of symbols and query the backend via IntelligenceCoordinator
   */
  private async flushBatch() {
    if (this.pendingSymbols.size === 0 && this.pendingIndices.size === 0) return;

    const symbolsArray = Array.from(this.pendingSymbols);
    const indicesArray = Array.from(this.pendingIndices);

    // Clear pendings
    this.pendingSymbols.clear();
    this.pendingIndices.clear();

    const start = Date.now();
    this.requestsCount++;

    try {
      // Prevent duplicate requests using the centralized IntelligenceCoordinator
      const result = await IntelligenceCoordinator.getInstance().requestData({
        query: JSON.stringify({ symbols: symbolsArray, indices: indicesArray }),
        source: "Live Market Engine",
        priority: 1, // High priority live pricing updates
        customFetcher: async () => {
          const maxRetries = 3;
          let lastError: any = null;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
            
            try {
              const res = await fetch("/api/live-prices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbols: symbolsArray, indices: indicesArray }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              if (!res.ok) throw new Error(`Server returned ${res.status}`);
              
              const responseText = await res.text();
              const contentType = res.headers.get("Content-Type") || "";
              if (!contentType.includes("application/json") || responseText.trim().startsWith("<")) {
                console.warn("[LiveMarketEngine] Received non-JSON response:", responseText.slice(0, 200) + "...");
                throw new Error("Invalid response content type from server");
              }
              try {
                return JSON.parse(responseText);
              } catch (e) {
                console.warn("[LiveMarketEngine] Failed to parse JSON:", e);
                throw new Error("Invalid JSON response from server");
              }
            } catch (e: any) {
              clearTimeout(timeoutId);
              if (e.name === 'AbortError' || e.message?.includes('aborted')) {
                return null; // Silent return if aborted
              }
              
              lastError = e;
              console.warn(`[LiveMarketEngine] live-prices fetch failed (attempt ${attempt}/${maxRetries}):`, e.message || e);
              if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            }
          }
          throw lastError;
        }
      });

      if (!result) return; // Silent return if aborted

      this.providerLatency = Date.now() - start;
      this.lastSuccessfulUpdate = new Date().toLocaleTimeString();

      // Update cache and determine hits/misses for telemetry
      const receivedStocks: TrendingStock[] = result.stocks || [];
      const receivedIndices: MarketIndex[] = result.indices || [];

      receivedStocks.forEach(stock => {
        if (this.cache.has(stock.symbol)) {
          this.cacheHits++;
        } else {
          this.cacheMisses++;
        }
        this.cache.set(stock.symbol, { type: "stock", data: stock, timestamp: Date.now() });
      });

      receivedIndices.forEach(ind => {
        const key = ind.symbol || ind.name;
        if (this.cache.has(key)) {
          this.cacheHits++;
        } else {
          this.cacheMisses++;
        }
        this.cache.set(key, { type: "index", data: ind, timestamp: Date.now() });
      });

      // Broadcast changes to active subscribers who care about these symbols
      this.subscribers.forEach(sub => {
        const matchesStocks = receivedStocks.filter(s => sub.symbols.includes(s.symbol));
        const matchesIndices = receivedIndices.filter(i => sub.symbols.includes(i.symbol) || sub.symbols.includes(i.name));

        if (matchesStocks.length > 0 || matchesIndices.length > 0) {
          sub.callback({
            stocks: matchesStocks,
            indices: matchesIndices
          });
        }
      });

    } catch (err: any) {
      console.warn("[LiveMarketEngine] Live prices update failed (using fallback/stale data):", err.message || err);
      this.failedUpdates++;
    }
  }

  /**
   * Get telemetry details for the Developer Mode display panel
   */
  public getTelemetry(): LiveMarketTelemetry {
    // Collect all unique active symbols currently subscribed
    const activeSymbolsSet = new Set<string>();
    this.subscribers.forEach(sub => sub.symbols.forEach(s => activeSymbolsSet.add(s)));

    // Calculate cache hit rate percentage
    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? Math.round((this.cacheHits / totalRequests) * 100) : 100;

    // Get time countdown of next refresh (estimate as shortest remaining time of active subscription loops)
    let nextRefreshStr = "Calculating...";
    if (this.isPollingPaused()) {
      nextRefreshStr = "Paused (Market Closed / App Offline)";
    } else {
      nextRefreshStr = "1s";
    }

    return {
      activeSymbols: Array.from(activeSymbolsSet),
      requestsPerSec: this.lastRequestsPerSec,
      cacheHitRate,
      nextRefresh: nextRefreshStr,
      providerLatency: this.providerLatency,
      activeSubscribers: this.subscribers.size,
      lastSuccessfulUpdate: this.lastSuccessfulUpdate,
      failedUpdates: this.failedUpdates
    };
  }

  /**
   * Read the last cached value of a stock symbol or index
   */
  public getCachedValue(key: string): any {
    const entry = this.cache.get(key);
    return entry ? entry.data : null;
  }
}
