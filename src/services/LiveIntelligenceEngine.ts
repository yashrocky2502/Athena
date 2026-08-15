import { MCPOrchestrator } from "../mcp/MCPOrchestrator";
import { EvidenceEngine } from "./EvidenceEngine";
import { PipelineMonitorService } from "./PipelineMonitorService";
import { PipelineStage } from "../types";
import { safeLocalStorage } from "./storage/safeStorage";

export class LiveIntelligenceEngine {
  private static instance: LiveIntelligenceEngine;
  
  private isRunning = false;
  private lastPollTime: string = "Never";
  private nextPollTime: string = "Pending";
  private providersActive: string[] = [];
  private eventsDetectedToday = 0;
  private evidenceCreatedCount = 0;
  private alertsGeneratedCount = 0;
  private notificationsSentCount = 0;
  private pollingLatency = 0;
  private queueLength = 0;

  // Price tracking for Change Detection
  private lastPrices: Map<string, number> = new Map();
  private timers: Map<string, any> = new Map();

  // Thresholds for Change Detection
  private priceThreshold = 0.5; // 0.5%
  private cryptoThreshold = 0.5; // 0.5%
  private forexThreshold = 0.2; // 0.2%

  private constructor() {
    this.isRunning = safeLocalStorage.getItem("athena_live_engine_running") !== "false";
    this.loadStats();
    if (this.isRunning) {
      this.start();
    }
  }

  public static getInstance(): LiveIntelligenceEngine {
    if (!LiveIntelligenceEngine.instance) {
      LiveIntelligenceEngine.instance = new LiveIntelligenceEngine();
    }
    return LiveIntelligenceEngine.instance;
  }

  private loadStats() {
    // Read from localStorage to populate developer mode metrics
    try {
      const todayStr = new Date().toDateString();
      
      const alerts = JSON.parse(safeLocalStorage.getItem("athena_alert_history") || "[]");
      const alertsToday = alerts.filter((a: any) => new Date(a.timestamp || a.createdAt).toDateString() === todayStr);
      this.alertsGeneratedCount = alertsToday.length;

      const notifs = JSON.parse(safeLocalStorage.getItem("athena_notification_history") || "[]");
      const notifsToday = notifs.filter((n: any) => new Date(n.createdAt).toDateString() === todayStr);
      this.notificationsSentCount = notifsToday.filter((n: any) => n.status === "Delivered").length;

      const traces = PipelineMonitorService.getInstance().getTraces();
      const tracesToday = traces.filter((t: any) => new Date(t.startTime).toDateString() === todayStr);
      this.eventsDetectedToday = tracesToday.length;
      
      // Calculate evidence created today
      let evidenceCount = 0;
      tracesToday.forEach((t: any) => {
        const ev = t.events.find((e: any) => e.stage === PipelineStage.Evidence && e.status === "Success");
        if (ev) evidenceCount++;
      });
      this.evidenceCreatedCount = evidenceCount;

      this.queueLength = notifs.filter((n: any) => n.status === "Queued" || n.status === "Retrying").length;
    } catch (e) {
      console.error("Failed to load Live Intelligence Engine stats", e);
    }
  }

  public isMarketOpen(): boolean {
    const forceOpen = safeLocalStorage.getItem("athena_force_market_open") === "true";
    if (forceOpen) return true;

    // Convert to Indian Standard Time (IST) - UTC+5:30
    const d = new Date();
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    
    const day = ist.getDay(); // 0 Sunday, 6 Saturday
    if (day === 0 || day === 6) return false;
    
    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    const openTime = 9 * 60 + 15; // 9:15 AM
    const closeTime = 15 * 60 + 30; // 3:30 PM
    
    return timeInMinutes >= openTime && timeInMinutes <= closeTime;
  }

  public setForceMarketOpen(val: boolean) {
    safeLocalStorage.setItem("athena_force_market_open", val ? "true" : "false");
    // Restart scheduling to apply change immediately
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  public start() {
    this.isRunning = true;
    safeLocalStorage.setItem("athena_live_engine_running", "true");
    this.schedulePolling();
  }

  public stop() {
    this.isRunning = false;
    safeLocalStorage.setItem("athena_live_engine_running", "false");
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.providersActive = [];
  }

  private schedulePolling() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.providersActive = [];

    const now = Date.now();

    // 1. Market Prices: 10s (Paused if closed)
    const marketOpen = this.isMarketOpen();
    if (marketOpen) {
      this.providersActive.push("Market Prices");
      this.pollMarketPrices();
    }

    // 2. Crypto: 30s
    this.providersActive.push("Crypto Price Monitor");
    this.pollCrypto();

    // 3. Forex: 1m (Paused if closed)
    if (marketOpen) {
      this.providersActive.push("Forex Rates Monitor");
      this.pollForex();
    } else {
      console.log("[LiveIntelligenceEngine] High-frequency Market Prices and Forex paused (Market Closed)");
    }

    // 4. News RSS: 2m
    this.providersActive.push("News RSS");
    this.pollNews();

    // 5. Corporate Actions: 10m
    this.providersActive.push("Corporate Actions");
    this.pollCorporateActions();

    // 6. NSE Circulars: 10m
    this.providersActive.push("NSE Circulars");
    this.pollNSECirculars();

    // 7. SEBI Orders: 15m
    this.providersActive.push("SEBI Orders");
    this.pollSEBIOrders();

    // 8. RBI Updates: 30m
    this.providersActive.push("RBI Updates");
    this.pollRBIUpdates();

    // 9. Macro Data: 30m
    this.providersActive.push("Macro Data");
    this.pollMacroData();

    this.lastPollTime = new Date().toLocaleTimeString();
    this.nextPollTime = new Date(now + 10000).toLocaleTimeString(); // Next price tick in 10s
  }

  private async measureLatency(task: () => Promise<void>) {
    const start = Date.now();
    try {
      await task();
    } finally {
      this.pollingLatency = Date.now() - start;
    }
  }

  // Poll Market Prices (every 10s)
  private pollMarketPrices() {
    if (!this.isRunning) return;
    
    const task = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const res = await fetch("/api/market-data", { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          console.warn(`[LiveIntelligenceEngine] Market data fetch failed with status: ${res.status}`);
          return;
        }
        
        const responseText = await res.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e: any) {
          console.warn("[LiveIntelligenceEngine] Received invalid response format from market-data (possibly HTML):", e.message || e);
          return;
        }
        
        // Analyze trending stocks
        const stocks = data.trendingStocks || [];
        const indices = data.indices || [];
        const nifty = indices.find((i: any) => i.name === "Nifty 50" || i.symbol === "^NSEI");
        const niftyChange = nifty ? nifty.changePercent : 0;
        
        const traceId = `live-price-${Math.random().toString(36).substring(7)}`;
        
        stocks.forEach((stock: any) => {
          const prev = this.lastPrices.get(stock.symbol);
          this.lastPrices.set(stock.symbol, stock.price);
          
          const isHighDailyMovement = Math.abs(stock.changePercent) >= 4.0;
          const hasSignificantTickChange = prev !== undefined && Math.abs((stock.price - prev) / prev) * 100 >= this.priceThreshold;

          if (isHighDailyMovement || hasSignificantTickChange) {
            this.eventsDetectedToday++;
            this.evidenceCreatedCount++;
            
            const diffPct = prev !== undefined ? Math.abs((stock.price - prev) / prev) * 100 : 0;
            
            // Trigger Signal
            const signal = {
              id: `price-alert-${stock.symbol}-${Date.now()}`,
              title: isHighDailyMovement 
                ? `🚨 CRITICAL MOVEMENT: ${stock.name} (${stock.symbol}) is ${stock.changePercent > 0 ? 'UP' : 'DOWN'} ${Math.abs(stock.changePercent).toFixed(2)}% today`
                : `📈 SIGNIFICANT MOVE: ${stock.name} (${stock.symbol}) moved to ₹${stock.price} (${stock.changePercent > 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%)`,
              sourceName: "Market Price Update",
              sourceType: "Official",
              summary: isHighDailyMovement
                ? `${stock.name} is experiencing extreme volatility with a ${Math.abs(stock.changePercent).toFixed(2)}% ${stock.changePercent > 0 ? 'rally' : 'decline'} from previous close. Current price: ₹${stock.price}.`
                : `${stock.name} has experienced a price shift of ${diffPct.toFixed(2)}% since the last check. Previous price: ₹${prev}, Current price: ₹${stock.price}.`,
              relatedCompanies: [stock.symbol],
              relatedSectors: [stock.sector],
              evidenceType: "Price Alert",
              category: isHighDailyMovement ? "Critical Movement" : "Market Volatility",
              timestamp: new Date().toISOString(),
              metadata: {
                priceMovement: stock.changePercent,
                marketMovement: niftyChange,
                capString: stock.cap,
                volumeChange: stock.volume && stock.averageVolume ? stock.volume / stock.averageVolume : 1
              }
            };
            
            EvidenceEngine.getInstance().processIncomingSignals([signal], traceId);
          }
        });

        this.lastPollTime = new Date().toLocaleTimeString();
        this.nextPollTime = new Date(Date.now() + 10000).toLocaleTimeString();
      } catch (e: any) {
        if (e.name === 'AbortError' || e.message?.includes('aborted') || e.message === "Failed to fetch") return;
        console.warn("Failed to poll market prices (retrying):", e.message || e);
      }
    };

    this.measureLatency(task);
    const timer = setTimeout(() => this.pollMarketPrices(), 10000);
    this.timers.set("market_prices", timer);
  }

  // Poll Crypto (every 30s)
  private pollCrypto() {
    if (!this.isRunning) return;
    
    const task = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const res = await fetch("/api/live-rates", { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
          console.warn(`[LiveIntelligenceEngine] Crypto rates fetch failed with status: ${res.status}`);
          return;
        }
        
        const responseText = await res.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e: any) {
          console.warn("[LiveIntelligenceEngine] Received invalid response format from live-rates for crypto (possibly HTML):", e.message || e);
          return;
        }
        
        const cryptos = data.filter((c: any) => c.symbol.endsWith("-USD"));
        const traceId = `live-crypto-${Math.random().toString(36).substring(7)}`;

        cryptos.forEach((crypto: any) => {
          const prev = this.lastPrices.get(crypto.symbol);
          this.lastPrices.set(crypto.symbol, crypto.price);

          if (prev !== undefined) {
            const diffPct = Math.abs((crypto.price - prev) / prev) * 100;
            if (diffPct >= this.cryptoThreshold) {
              this.eventsDetectedToday++;
              this.evidenceCreatedCount++;

              const signal = {
                id: `crypto-alert-${crypto.symbol}-${Date.now()}`,
                title: `🪙 CRYPTO SHIFT: ${crypto.name} (${crypto.symbol}) is at $${crypto.price} (${crypto.changePercent > 0 ? '+' : ''}${crypto.changePercent.toFixed(2)}%)`,
                sourceName: "Crypto Price Update",
                sourceType: "Official",
                summary: `${crypto.name} price changed by ${diffPct.toFixed(2)}% in the last 30 seconds. Previous: $${prev}, Current: $${crypto.price}.`,
                relatedCompanies: [],
                relatedSectors: ["Cryptocurrency"],
                evidenceType: "Crypto Alert",
                timestamp: new Date().toISOString()
              };

              EvidenceEngine.getInstance().processIncomingSignals([signal], traceId);
            }
          } else {
            // Seed initial
            this.lastPrices.set(crypto.symbol, crypto.price);
          }
        });
      } catch (e: any) {
        if (e.name === 'AbortError' || e.message?.includes('aborted') || e.message === "Failed to fetch") return;
        console.warn("Failed to poll crypto rates (retrying):", e.message || e);
      }
    };

    this.measureLatency(task);
    const timer = setTimeout(() => this.pollCrypto(), 30000);
    this.timers.set("crypto", timer);
  }

  // Poll Forex (every 1m)
  private pollForex() {
    if (!this.isRunning) return;
    if (!this.isMarketOpen()) return;

    const task = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const res = await fetch("/api/live-rates", { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
          console.warn(`[LiveIntelligenceEngine] Forex rates fetch failed with status: ${res.status}`);
          return;
        }
        
        const responseText = await res.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e: any) {
          console.warn("[LiveIntelligenceEngine] Received invalid response format from live-rates for forex (possibly HTML):", e.message || e);
          return;
        }
        
        const forexList = data.filter((c: any) => c.symbol.endsWith("=X"));
        const traceId = `live-forex-${Math.random().toString(36).substring(7)}`;

        forexList.forEach((forex: any) => {
          const prev = this.lastPrices.get(forex.symbol);
          this.lastPrices.set(forex.symbol, forex.price);

          if (prev !== undefined) {
            const diffPct = Math.abs((forex.price - prev) / prev) * 100;
            if (diffPct >= this.forexThreshold) {
              this.eventsDetectedToday++;
              this.evidenceCreatedCount++;

              const signal = {
                id: `forex-alert-${forex.symbol}-${Date.now()}`,
                title: `💱 FOREX MOVE: ${forex.name} (${forex.symbol}) is at ${forex.price} (${forex.changePercent > 0 ? '+' : ''}${forex.changePercent.toFixed(2)}%)`,
                sourceName: "Forex Rates Update",
                sourceType: "Official",
                summary: `${forex.name} conversion rate changed by ${diffPct.toFixed(2)}%. Previous: ${prev}, Current: ${forex.price}.`,
                relatedCompanies: [],
                relatedSectors: ["Forex"],
                evidenceType: "Forex Alert",
                timestamp: new Date().toISOString()
              };

              EvidenceEngine.getInstance().processIncomingSignals([signal], traceId);
            }
          } else {
            this.lastPrices.set(forex.symbol, forex.price);
          }
        });
      } catch (e: any) {
        if (e.name === 'AbortError' || e.message?.includes('aborted') || e.message === "Failed to fetch") return;
        console.warn("Failed to poll forex rates (retrying):", e.message || e);
      }
    };

    this.measureLatency(task);
    const timer = setTimeout(() => this.pollForex(), 60000);
    this.timers.set("forex", timer);
  }

  // Poll News (every 2m)
  private pollNews() {
    if (!this.isRunning) return;

    const task = async () => {
      const newsConnector = MCPOrchestrator.getInstance().getConnector("News MCP Connector");
      if (newsConnector) {
        await MCPOrchestrator.getInstance().executeSyncForConnector(newsConnector);
        this.loadStats();
      }
    };

    this.measureLatency(task);
    const timer = setTimeout(() => this.pollNews(), 120000);
    this.timers.set("news", timer);
  }

  // Poll Corporate Actions (every 10m)
  private pollCorporateActions() {
    if (!this.isRunning) return;

    const task = async () => {
      const companyIRConnector = MCPOrchestrator.getInstance().getConnector("Company IR MCP Connector");
      const bseConnector = MCPOrchestrator.getInstance().getConnector("BSE MCP Connector");
      
      if (companyIRConnector) {
        await MCPOrchestrator.getInstance().executeSyncForConnector(companyIRConnector);
      }
      if (bseConnector) {
        await MCPOrchestrator.getInstance().executeSyncForConnector(bseConnector);
      }
      this.loadStats();
    };

    this.measureLatency(task);
    const timer = setTimeout(() => this.pollCorporateActions(), 600000);
    this.timers.set("corporate_actions", timer);
  }

  // Poll NSE Circulars (every 10m)
  private pollNSECirculars() {
    if (!this.isRunning) return;

    const task = async () => {
      const nseConnector = MCPOrchestrator.getInstance().getConnector("NSE MCP Connector");
      if (nseConnector) {
        await MCPOrchestrator.getInstance().executeSyncForConnector(nseConnector);
        this.loadStats();
      }
    };

    this.measureLatency(task);
    const timer = setTimeout(() => this.pollNSECirculars(), 600000);
    this.timers.set("nse_circulars", timer);
  }

  // Poll SEBI Orders (every 15m)
  private pollSEBIOrders() {
    if (!this.isRunning) return;

    const task = async () => {
      const sebiConnector = MCPOrchestrator.getInstance().getConnector("SEBI MCP Connector");
      if (sebiConnector) {
        await MCPOrchestrator.getInstance().executeSyncForConnector(sebiConnector);
        this.loadStats();
      }
    };

    this.measureLatency(task);
    const timer = setTimeout(() => this.pollSEBIOrders(), 900000);
    this.timers.set("sebi_orders", timer);
  }

  // Poll RBI Updates (every 30m)
  private pollRBIUpdates() {
    if (!this.isRunning) return;

    const task = async () => {
      const rbiConnector = MCPOrchestrator.getInstance().getConnector("RBI MCP Connector");
      if (rbiConnector) {
        await MCPOrchestrator.getInstance().executeSyncForConnector(rbiConnector);
        this.loadStats();
      }
    };

    this.measureLatency(task);
    const timer = setTimeout(() => this.pollRBIUpdates(), 1800000);
    this.timers.set("rbi_updates", timer);
  }

  // Poll Macro Data (every 30m)
  private pollMacroData() {
    if (!this.isRunning) return;

    const task = async () => {
      const macroConnector = MCPOrchestrator.getInstance().getConnector("Macro MCP Connector");
      if (macroConnector) {
        await MCPOrchestrator.getInstance().executeSyncForConnector(macroConnector);
        this.loadStats();
      }
    };

    this.measureLatency(task);
    const timer = setTimeout(() => this.pollMacroData(), 1800000);
    this.timers.set("macro_data", timer);
  }

  public getStatus() {
    this.loadStats();
    return {
      isRunning: this.isRunning,
      lastPollTime: this.lastPollTime,
      nextPollTime: this.nextPollTime,
      providersActive: this.providersActive,
      eventsDetectedToday: this.eventsDetectedToday,
      evidenceCreated: this.evidenceCreatedCount,
      alertsGenerated: this.alertsGeneratedCount,
      notificationsSent: this.notificationsSentCount,
      pollingLatency: this.pollingLatency,
      queueLength: this.queueLength,
      forceMarketOpen: safeLocalStorage.getItem("athena_force_market_open") === "true"
    };
  }
}
