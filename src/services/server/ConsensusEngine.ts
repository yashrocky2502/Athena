import fs from "fs";
import { 
  ConsensusRecord, 
  NormalizedFinancialMetrics, 
  ProviderResponse, 
  ConsensusMetricValue,
  ShareholdingData,
  BalanceSheetData,
  CorporateAction,
  QuarterlyResult,
  AnnualResult,
  FinancialProvider
} from "../providers/financials/types";
import { YahooFinanceAdapter } from "../providers/financials/YahooFinanceAdapter";
import { NseAdapter } from "../providers/financials/NseAdapter";
import { BseAdapter } from "../providers/financials/BseAdapter";
import { ScreenerAdapter } from "../providers/financials/ScreenerAdapter";
import { TickertapeAdapter } from "../providers/financials/TickertapeAdapter";

const CACHE_FILE = (typeof process !== "undefined" && typeof process.cwd === "function") ? `${process.cwd()}/athena_consensus_cache.json` : "athena_consensus_cache.json";

export class ConsensusEngine {
  private static instance: ConsensusEngine;
  private providers: FinancialProvider[] = [];
  private cache: Record<string, ConsensusRecord> = {};
  private activeSyncs: Set<string> = new Set();

  private constructor() {
    this.providers = [
      new YahooFinanceAdapter(),
      new NseAdapter(),
      new BseAdapter(),
      new ScreenerAdapter(),
      new TickertapeAdapter()
    ];
    this.loadCache();
    this.startBackgroundPoller();
  }

  public static getInstance(): ConsensusEngine {
    if (!ConsensusEngine.instance) {
      ConsensusEngine.instance = new ConsensusEngine();
    }
    return ConsensusEngine.instance;
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, "utf-8");
        this.cache = JSON.parse(data) || {};
        console.log(`[ConsensusEngine] Loaded ${Object.keys(this.cache).length} cached golden records.`);
      }
    } catch (err: any) {
      console.warn("[ConsensusEngine] Failed to read consensus cache file:", err.message);
      this.cache = {};
    }
  }

  private saveCache(): void {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2), "utf-8");
    } catch (err: any) {
      console.warn("[ConsensusEngine] Failed to save consensus cache file:", err.message);
    }
  }

  /**
   * Periodically synchronizes all cached symbols in the background every 5 minutes.
   */
  private startBackgroundPoller(): void {
    setInterval(() => {
      const symbols = Object.keys(this.cache);
      if (symbols.length === 0) return;
      console.log(`[ConsensusEngine] Background syncing ${symbols.length} cached listings...`);
      for (const sym of symbols) {
        this.syncSymbol(sym).catch((err) => {
          console.warn(`[ConsensusEngine] Background sync failed for ${sym}:`, err.message);
        });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Retrieves the cached golden consensus record if valid, and triggers a background sync if stale.
   */
  public getGoldenRecord(symbol: string): ConsensusRecord | null {
    const cleanSymbol = symbol.trim().toUpperCase();
    const cached = this.cache[cleanSymbol];

    // Trigger background sync if not currently syncing
    if (!this.activeSyncs.has(cleanSymbol)) {
      const isStale = !cached || (Date.now() - cached.lastVerification > 30 * 60 * 1000); // 30 minutes stale TTL
      if (isStale) {
        console.log(`[ConsensusEngine] Golden record stale or missing for ${cleanSymbol}. Commencing asynchronous refresh.`);
        this.syncSymbol(cleanSymbol).catch((err) => {
          console.warn(`[ConsensusEngine] Async sync failed for ${cleanSymbol}:`, err.message);
        });
      }
    }

    return cached || null;
  }

  /**
   * Force synchronizes and recalculates the golden record for a symbol.
   */
  public async forceRefresh(symbol: string): Promise<ConsensusRecord> {
    const cleanSymbol = symbol.trim().toUpperCase();
    return this.syncSymbol(cleanSymbol);
  }

  /**
   * Collects data from all available providers, runs comparison, detects conflicts and builds consensus.
   */
  private async syncSymbol(symbol: string): Promise<ConsensusRecord> {
    if (this.activeSyncs.has(symbol)) {
      // Return cached during active sync to prevent concurrent query overlap
      return this.cache[symbol] || this.buildEmptyRecord(symbol);
    }

    this.activeSyncs.add(symbol);
    console.log(`[ConsensusEngine] Commencing multi-source validation for: ${symbol}`);

    const latencies: Record<string, number> = {};
    const responses: ProviderResponse[] = [];

    // Query all providers in parallel
    await Promise.all(
      this.providers.map(async (provider) => {
        const start = Date.now();
        try {
          const metrics = await provider.fetchMetrics(symbol);
          const latency = Date.now() - start;
          latencies[provider.name] = latency;
          
          responses.push({
            providerName: provider.name,
            metrics,
            latencyMs: latency,
            timestamp: Date.now()
          });
        } catch (err: any) {
          const latency = Date.now() - start;
          latencies[provider.name] = latency;
          responses.push({
            providerName: provider.name,
            metrics: null,
            latencyMs: latency,
            timestamp: Date.now(),
            error: err.message || "Failed"
          });
        }
      })
    );

    // Build Consensus
    const record = this.calculateConsensus(symbol, responses, latencies);

    // Save back to cache
    this.cache[symbol] = record;
    this.saveCache();

    this.activeSyncs.delete(symbol);
    console.log(`[ConsensusEngine] Completed multi-source validation for ${symbol}. Consensus confidence: ${record.agreementPercentage}%`);

    return record;
  }

  private buildEmptyRecord(symbol: string): ConsensusRecord {
    return {
      symbol,
      metrics: {
        price: this.emptyMetric(),
        marketCap: this.emptyMetric(),
        revenue: this.emptyMetric(),
        ebitda: this.emptyMetric(),
        netProfit: this.emptyMetric(),
        cashFlow: this.emptyMetric(),
        operatingMargin: this.emptyMetric(),
        roe: this.emptyMetric(),
        roce: this.emptyMetric(),
        debtEquity: this.emptyMetric(),
        bookValue: this.emptyMetric(),
        eps: this.emptyMetric(),
        shareholding: this.emptyMetric(),
        corporateActions: this.emptyMetric(),
        quarterlyResults: this.emptyMetric(),
        annualResults: this.emptyMetric(),
        balanceSheet: this.emptyMetric(),
        isin: this.emptyMetric(),
        currency: this.emptyMetric()
      },
      lastVerification: Date.now(),
      agreementPercentage: 0,
      conflictingFields: [],
      missingFields: [],
      providersQueried: this.providers.map(p => p.name),
      providerLatencies: {}
    };
  }

  private emptyMetric<T>(): ConsensusMetricValue<T> {
    return {
      value: null,
      source: "None",
      supportingProviders: [],
      lastUpdated: null,
      confidenceScore: 0
    };
  }

  /**
   * Consensus algorithm
   */
  private calculateConsensus(
    symbol: string, 
    responses: ProviderResponse[], 
    latencies: Record<string, number>
  ): ConsensusRecord {
    const totalFields = 19;
    let matchingFieldsCount = 0;
    const conflictingFields: string[] = [];
    const missingFields: string[] = [];

    // Define authoritative priorities as requested in Phase 4
    const PRICE_PRIORITY = ["NSE", "BSE", "Yahoo Finance", "Tickertape"];
    const FINANCIAL_PRIORITY = ["Screener", "NSE", "BSE", "Yahoo Finance", "Tickertape"];
    const SHAREHOLDING_PRIORITY = ["NSE", "BSE", "Screener", "Tickertape"];
    const CORPORATE_ACTIONS_PRIORITY = ["NSE", "BSE"];

    const resolveMetric = <T>(
      fieldName: string,
      priority: string[],
      extractor: (m: NormalizedFinancialMetrics) => T | null,
      comparator: (a: T, b: T) => boolean = (a, b) => a === b
    ): ConsensusMetricValue<T> => {
      // 1. Gather all active reported values
      const candidates: { provider: string; value: T; timestamp: number }[] = [];
      for (const res of responses) {
        if (res.metrics) {
          const val = extractor(res.metrics);
          if (val !== undefined && val !== null) {
            candidates.push({
              provider: res.providerName,
              value: val,
              timestamp: res.timestamp
            });
          }
        }
      }

      if (candidates.length === 0) {
        missingFields.push(fieldName);
        return this.emptyMetric<T>();
      }

      // 2. Find consensus clusters
      const clusters: { value: T; providers: string[]; lastUpdated: number }[] = [];
      for (const cand of candidates) {
        let found = false;
        for (const cluster of clusters) {
          if (comparator(cand.value, cluster.value)) {
            cluster.providers.push(cand.provider);
            cluster.lastUpdated = Math.max(cluster.lastUpdated, cand.timestamp);
            found = true;
            break;
          }
        }
        if (!found) {
          clusters.push({
            value: cand.value,
            providers: [cand.provider],
            lastUpdated: cand.timestamp
          });
        }
      }

      // Sort clusters by size descending (largest agreement wins)
      clusters.sort((a, b) => b.providers.length - a.providers.length);

      const largestCluster = clusters[0];
      const hasConsensus = largestCluster.providers.length > 1;

      // Detect conflicts
      if (clusters.length > 1) {
        conflictingFields.push(fieldName);
      } else if (hasConsensus || candidates.length === 1) {
        matchingFieldsCount++;
      }

      // Select winning value using Metric Priority Rules (Phase 4)
      let selectedValue = largestCluster.value;
      let selectedProvider = "";
      let winningTimestamp = largestCluster.lastUpdated;

      // Apply authoritative source overrides if different clusters exist
      const bestCandidate = this.getBestCandidateByPriority(candidates, priority);
      if (bestCandidate) {
        selectedValue = bestCandidate.value;
        selectedProvider = bestCandidate.provider;
        winningTimestamp = bestCandidate.timestamp;
      } else {
        selectedProvider = largestCluster.providers[0];
      }

      // Supporting providers are those who agreed with the selected value
      const supporting = candidates
        .filter(c => comparator(c.value, selectedValue))
        .map(c => c.provider);

      // Record conflicts
      const conflicts = clusters.length > 1 ? candidates.map(c => ({ provider: c.provider, value: c.value })) : undefined;

      // Calculate confidence score (Phase 5)
      let confidenceScore = 60; // Conflict / single non-authoritative fallback
      const isAuthoritativeSelected = priority.slice(0, 2).includes(selectedProvider);

      if (clusters.length === 1) {
        if (supporting.length >= 3) confidenceScore = 99;
        else if (supporting.length === 2) confidenceScore = 90;
        else confidenceScore = isAuthoritativeSelected ? 85 : 75;
      } else {
        // Conflict detected
        confidenceScore = isAuthoritativeSelected ? 70 : 60;
      }

      return {
        value: selectedValue,
        source: selectedProvider,
        supportingProviders: supporting,
        lastUpdated: winningTimestamp,
        confidenceScore,
        conflictDetails: conflicts
      };
    };

    // Helper comparators
    const numCompare = (a: number, b: number) => {
      if (a === 0 && b === 0) return true;
      return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= 0.01; // 1% relative threshold
    };

    const shareholdingCompare = (a: ShareholdingData, b: ShareholdingData) => {
      return numCompare(a.promoters || 0, b.promoters || 0) && numCompare(a.fii || 0, b.fii || 0);
    };

    const balanceSheetCompare = (a: BalanceSheetData, b: BalanceSheetData) => {
      return numCompare(a.totalAssets || 0, b.totalAssets || 0);
    };

    const arrayCompare = (a: any[], b: any[]) => {
      if (a.length !== b.length) return false;
      if (a.length === 0) return true;
      // Compare latest item
      return JSON.stringify(a[0]) === JSON.stringify(b[0]);
    };

    // Resolve all 19 metrics
    const price = resolveMetric("price", PRICE_PRIORITY, m => m.price, numCompare);
    const marketCap = resolveMetric("marketCap", PRICE_PRIORITY, m => m.marketCap, numCompare);
    const revenue = resolveMetric("revenue", FINANCIAL_PRIORITY, m => m.revenue, numCompare);
    const ebitda = resolveMetric("ebitda", FINANCIAL_PRIORITY, m => m.ebitda, numCompare);
    const netProfit = resolveMetric("netProfit", FINANCIAL_PRIORITY, m => m.netProfit, numCompare);
    const cashFlow = resolveMetric("cashFlow", FINANCIAL_PRIORITY, m => m.cashFlow, numCompare);
    const operatingMargin = resolveMetric("operatingMargin", FINANCIAL_PRIORITY, m => m.operatingMargin, numCompare);
    const roe = resolveMetric("roe", FINANCIAL_PRIORITY, m => m.roe, numCompare);
    const roce = resolveMetric("roce", FINANCIAL_PRIORITY, m => m.roce, numCompare);
    const debtEquity = resolveMetric("debtEquity", FINANCIAL_PRIORITY, m => m.debtEquity, numCompare);
    const bookValue = resolveMetric("bookValue", FINANCIAL_PRIORITY, m => m.bookValue, numCompare);
    const eps = resolveMetric("eps", FINANCIAL_PRIORITY, m => m.eps, numCompare);
    
    const shareholding = resolveMetric("shareholding", SHAREHOLDING_PRIORITY, m => m.shareholding, shareholdingCompare);
    const corporateActions = resolveMetric("corporateActions", CORPORATE_ACTIONS_PRIORITY, m => m.corporateActions, arrayCompare);
    const quarterlyResults = resolveMetric("quarterlyResults", FINANCIAL_PRIORITY, m => m.quarterlyResults, arrayCompare);
    const annualResults = resolveMetric("annualResults", FINANCIAL_PRIORITY, m => m.annualResults, arrayCompare);
    const balanceSheet = resolveMetric("balanceSheet", FINANCIAL_PRIORITY, m => m.balanceSheet, balanceSheetCompare);
    
    const isin = resolveMetric("isin", SHAREHOLDING_PRIORITY, m => m.isin);
    const currency = resolveMetric("currency", PRICE_PRIORITY, m => m.currency);

    const agreementPercentage = Math.round((matchingFieldsCount / (totalFields - missingFields.length)) * 100) || 0;

    return {
      symbol,
      metrics: {
        price,
        marketCap,
        revenue,
        ebitda,
        netProfit,
        cashFlow,
        operatingMargin,
        roe,
        roce,
        debtEquity,
        bookValue,
        eps,
        shareholding,
        corporateActions,
        quarterlyResults,
        annualResults,
        balanceSheet,
        isin,
        currency
      },
      lastVerification: Date.now(),
      agreementPercentage,
      conflictingFields,
      missingFields,
      providersQueried: responses.map(r => r.providerName),
      providerLatencies: latencies
    };
  }

  private getBestCandidateByPriority<T>(
    candidates: { provider: string; value: T; timestamp: number }[],
    priority: string[]
  ): { provider: string; value: T; timestamp: number } | null {
    for (const provName of priority) {
      const found = candidates.find(c => c.provider === provName);
      if (found) return found;
    }
    return null;
  }
}
