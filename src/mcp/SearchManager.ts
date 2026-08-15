import { QuotaManager } from "./QuotaManager";

interface CachedResult {
  data: any;
  timestamp: number;
  expiry: number;
}

export class SearchManager {
  private static instance: SearchManager;
  private cache = new Map<string, CachedResult>();
  private pendingRequests = new Map<string, Promise<any>>();
  
  // Tracking for health center
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    mergedRequests: 0,
    callsSaved: 0,
    estimatedTokenSavings: 0
  };

  private constructor() {
    // Load cache from session storage if we want persistence across reloads
  }

  public static getInstance(): SearchManager {
    if (!SearchManager.instance) {
      SearchManager.instance = new SearchManager();
    }
    return SearchManager.instance;
  }

  /**
   * Main entry point for searching. Handles caching and request merging.
   */
  public async search(query: string, source: string, ttlMs: number = 300000): Promise<any> {
    const normalizedQuery = this.normalizeQuery(query);
    
    // 1. Check cache
    const cached = this.cache.get(normalizedQuery);
    if (cached && Date.now() < cached.expiry) {
      this.metrics.cacheHits++;
      this.metrics.callsSaved++;
      return cached.data;
    }
    this.metrics.cacheMisses++;

    // 2. Check for pending identical requests (Request Merging)
    const pending = this.pendingRequests.get(normalizedQuery);
    if (pending) {
      this.metrics.mergedRequests++;
      this.metrics.callsSaved++;
      return pending;
    }

    // 3. Execute new search
    const searchPromise = this.executeSearch(normalizedQuery, ttlMs);
    this.pendingRequests.set(normalizedQuery, searchPromise);

    try {
      const result = await searchPromise;
      return result;
    } finally {
      this.pendingRequests.delete(normalizedQuery);
    }
  }

  private normalizeQuery(query: string): string {
    let q = query.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Step 3: Query Deduplication for similar company searches
    // If query contains a company name/symbol and news/filing/announcement keywords, 
    // we can normalize it to "Company latest updates" to merge them.
    const companies = ["reliance", "tata motors", "hdfc", "infosys", "zomato", "itc", "tata steel", "cdsl", "bel"];
    const keywords = ["latest news", "corporate filing", "announcement", "disclosure", "filings", "news today"];
    
    for (const company of companies) {
      if (q.includes(company)) {
        for (const kw of keywords) {
          if (q.includes(kw)) {
            return `${company} latest corporate announcements and news`;
          }
        }
      }
    }

    return q;
  }

  private async executeSearch(query: string, ttlMs: number): Promise<any> {
    const quota = QuotaManager.getInstance();
    
    if (quota.isQuotaExhausted()) {
      throw new Error("QUOTA_EXCEEDED");
    }

    let response: Response | null = null;
    let lastError: any = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      try {
        response = await fetch("/api/mcp/google-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query })
        });

        const latency = Date.now() - startTime;

        if (response.status === 429) {
          quota.recordRequest(0, latency, true, true);
          throw new Error("QUOTA_EXCEEDED");
        }

        if (!response.ok) {
          quota.recordRequest(0, latency, true, false);
          throw new Error(`Search failed: ${response.status}`);
        }

        const responseText = await response.text();
        const contentType = response.headers.get("Content-Type") || "";
        let data;
        if (!contentType.includes("application/json") || responseText.trim().startsWith("<")) {
          console.warn("[SearchManager] Received non-JSON response:", responseText.slice(0, 200) + "...");
          throw new Error("Invalid response content type from server");
        }
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.warn("[SearchManager] Failed to parse JSON:", e);
          throw new Error("Invalid JSON response from server");
        }
        
        // Record success
        quota.recordRequest(0, latency, false, false);

        // Cache result
        this.cache.set(query, {
          data,
          timestamp: Date.now(),
          expiry: Date.now() + ttlMs
        });

        return data;
      } catch (error: any) {
        lastError = error;
        if (error.message === "QUOTA_EXCEEDED") {
          throw error;
        }

        console.warn(`[SearchManager] fetch failed (attempt ${attempt}/${maxRetries}) for "${query}":`, error.message || error);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    // Stale-on-error: If we have ANY cached data for this query, use it even if expired
    const stale = this.cache.get(query);
    if (stale) {
      console.warn(`[SearchManager] Live search failed for "${query}", serving stale cache.`);
      return stale.data;
    }

    if (lastError && lastError.message !== "QUOTA_EXCEEDED") {
      console.warn(`[SearchManager] Query "${query}" failed after ${maxRetries} retries:`, lastError.message || lastError);
    }
    throw lastError;
  }

  public getMetrics() {
    return { ...this.metrics };
  }

  public clearCache() {
    this.cache.clear();
  }
}
