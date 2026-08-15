import { QuotaStats } from "../types";
import { safeLocalStorage } from "../services/storage/safeStorage";

export class QuotaManager {
  private static instance: QuotaManager;
  
  private stats: QuotaStats = {
    dailyRequests: 0,
    hourlyRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitErrors: 0,
    averageTokens: 0,
    averageResponseTime: 0,
    remainingCapacity: 100 // Percentage
  };

  private dailyLimit = 1500; // Estimated for free tier
  private hourlyLimit = 100;
  private currentHour = new Date().getHours();
  private lastResetDate = new Date().toDateString();

  private constructor() {
    // Load from localStorage if available
    const saved = safeLocalStorage.getItem("athena_quota_stats");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.stats = { ...this.stats, ...parsed };
      } catch (e) {
        console.error("Failed to load quota stats", e);
      }
    }
    
    this.checkResets();
  }

  public static getInstance(): QuotaManager {
    if (!QuotaManager.instance) {
      QuotaManager.instance = new QuotaManager();
    }
    return QuotaManager.instance;
  }

  private checkResets() {
    const now = new Date();
    const today = now.toDateString();
    const hour = now.getHours();

    if (today !== this.lastResetDate) {
      this.stats.dailyRequests = 0;
      this.stats.rateLimitErrors = 0;
      this.lastResetDate = today;
    }

    if (hour !== this.currentHour) {
      this.stats.hourlyRequests = 0;
      this.currentHour = hour;
    }
    
    this.save();
  }

  public recordRequest(tokens: number = 0, latency: number = 0, isError: boolean = false, isRateLimit: boolean = false) {
    this.checkResets();
    
    this.stats.dailyRequests++;
    this.stats.hourlyRequests++;
    
    if (isError) {
      this.stats.failedRequests++;
      if (isRateLimit) this.stats.rateLimitErrors++;
    } else {
      this.stats.successfulRequests++;
      
      // Moving average for tokens and latency
      if (tokens > 0) {
        this.stats.averageTokens = Math.round((this.stats.averageTokens * 9 + tokens) / 10);
      }
      if (latency > 0) {
        this.stats.averageResponseTime = Math.round((this.stats.averageResponseTime * 9 + latency) / 10);
      }
    }

    // Estimate remaining capacity
    const dailyCap = Math.max(0, 100 - (this.stats.dailyRequests / this.dailyLimit) * 100);
    const hourlyCap = Math.max(0, 100 - (this.stats.hourlyRequests / this.hourlyLimit) * 100);
    this.stats.remainingCapacity = Math.round(Math.min(dailyCap, hourlyCap));

    this.save();
  }

  private save() {
    safeLocalStorage.setItem("athena_quota_stats", JSON.stringify(this.stats));
  }

  public getStats(): QuotaStats {
    this.checkResets();
    return { ...this.stats };
  }

  public shouldThrottle(): boolean {
    this.checkResets();
    return this.stats.remainingCapacity < 10 || this.stats.hourlyRequests > this.hourlyLimit * 0.9;
  }

  public isQuotaExhausted(): boolean {
    this.checkResets();
    return this.stats.dailyRequests >= this.dailyLimit || this.stats.hourlyRequests >= this.hourlyLimit;
  }
}
