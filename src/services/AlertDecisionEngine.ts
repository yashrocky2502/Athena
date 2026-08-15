import { 
  Evidence, 
  AthenaAlert, 
  AlertDecision, 
  AlertSettings, 
  Priority, 
  EventType, 
  SearchSource,
  AlertCategory,
  PipelineStage,
  StoryImpact
} from "../types";
import { PersonalIntelligenceService } from "./PersonalIntelligenceService";
import { WatchlistService } from "./WatchlistService";
import { PortfolioService } from "./PortfolioService";
import { PipelineMonitorService } from "./PipelineMonitorService";
import { NotificationDeliveryEngine } from "./NotificationDeliveryEngine";
import { ProfilerService } from "./ProfilerService";
import { ImpactAnalyzer } from "./ImpactAnalyzer";
import { LearningEngine } from "./LearningEngine";
import { safeLocalStorage } from "./storage/safeStorage";

export class AlertDecisionEngine {
  private static instance: AlertDecisionEngine;
  private alertHistory: AthenaAlert[] = [];
  private decisionLogs: AlertDecision[] = [];
  private readonly HIGH_VALUE_CATEGORIES = [
    "Quarterly Results",
    "Earnings",
    "Dividend",
    "Bonus",
    "Stock Split",
    "Promoter buying",
    "Promoter selling",
    "M&A",
    "Acquisition",
    "Merger",
    "Major order win",
    "RBI action",
    "SEBI action",
    "Credit rating change",
    "Management change",
    "CEO change",
    "Critical Movement",
    "Market Volatility"
  ];
  private settings: AlertSettings = {
    minPriority: Priority.Medium,
    preferredSectors: [],
    preferredCompanies: [],
    preferredAlertTypes: Object.values(EventType),
    marketHoursOnly: false,
    silentMode: false,
    telegramEnabled: false
  };

  private constructor() {
    this.loadHistory();
    this.loadSettings();
  }

  public static getInstance(): AlertDecisionEngine {
    if (!AlertDecisionEngine.instance) {
      AlertDecisionEngine.instance = new AlertDecisionEngine();
    }
    return AlertDecisionEngine.instance;
  }

  private loadHistory() {
    const saved = safeLocalStorage.getItem("athena_alert_history");
    if (saved) {
      try {
        this.alertHistory = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load alert history", e);
      }
    }
  }

  private saveHistory() {
    safeLocalStorage.setItem("athena_alert_history", JSON.stringify(this.alertHistory));
  }

  private loadSettings() {
    const saved = safeLocalStorage.getItem("athena_alert_settings");
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      } catch (e) {
        console.error("Failed to load alert settings", e);
      }
    }
  }

  public saveSettings(settings: Partial<AlertSettings>) {
    this.settings = { ...this.settings, ...settings };
    safeLocalStorage.setItem("athena_alert_settings", JSON.stringify(this.settings));
  }

  public getSettings(): AlertSettings {
    return { ...this.settings };
  }

  public getAlertHistory(): AthenaAlert[] {
    return [...this.alertHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getDecisionLogs(): AlertDecision[] {
    return [...this.decisionLogs];
  }

  /**
   * Evaluates incoming evidence and decides whether to trigger an alert.
   */
  public async evaluateEvidence(evidence: Evidence, traceId?: string): Promise<AthenaAlert | null> {
    const monitorTraceId = traceId || `trace-${Math.random().toString(36).substring(7)}`;
    const monitor = PipelineMonitorService.getInstance();
    const startTime = Date.now();
    const learning = LearningEngine.getInstance();
    
    try {
      // 1. Phase 2: Dynamic Severity Engine
      const analysis = ImpactAnalyzer.analyze({
        title: evidence.title,
        description: evidence.summary,
        category: evidence.category,
        evidenceCount: (evidence as any).relatedEvidenceIds?.length ? (evidence as any).relatedEvidenceIds.length + 1 : 1,
        sourceCredibility: (evidence as any).sourceCredibility || 70,
        metadata: (evidence as any).metadata
      });

      // 2. Phase 6: Smart Prioritization Adjustments
      let finalScore = analysis.severityScore;
      const text = `${evidence.title} ${evidence.summary}`.toLowerCase();
      
      // High-value triggers (Boost)
      const highValueTriggers = [
        { term: "earnings surprise", boost: 15 },
        { term: "major order win", boost: 10 },
        { term: "rbi action", boost: 20 },
        { term: "government policy", boost: 15 },
        { term: "sebi order", boost: 25 },
        { term: "rating upgrade", boost: 10 },
        { term: "promoter buying", boost: 15 },
        { term: "fii reversal", boost: 10 },
        { term: "major breakout", boost: 10 }
      ];
      highValueTriggers.forEach(t => { if (text.includes(t.term)) finalScore = Math.min(100, finalScore + t.boost); });

      // Low-value signals (Penalty)
      const lowValueTriggers = [
        { term: "rumours", penalty: 15 },
        { term: "unconfirmed", penalty: 10 },
        { term: "low credibility", penalty: 20 },
        { term: "cached", penalty: 10 }
      ];
      lowValueTriggers.forEach(t => { if (text.includes(t.term)) finalScore = Math.max(0, finalScore - t.penalty); });

      // Re-derive priority
      let finalPriority = Priority.Low;
      if (finalScore >= 85) finalPriority = Priority.Critical;
      else if (finalScore >= 65) finalPriority = Priority.High;
      else if (finalScore >= 40) finalPriority = Priority.Medium;
      else if (finalScore >= 15) finalPriority = Priority.Low;
      else finalPriority = Priority.Ignore;

      // 3. Phase 4: Alert Quality Gate
      const gate = this.validateQualityGate(evidence, analysis, finalPriority);
      if (!gate.passed) {
        this.logDecision(
          evidence.id, 
          finalScore, 
          "Suppress", 
          gate.reason || "Quality Gate Failed", 
          [(evidence as any).sourceName || "Internal"], 
          Date.now() - startTime,
          evidence,
          analysis,
          finalPriority,
          monitorTraceId
        );

        learning.track({ alertId: evidence.id, timestamp: new Date().toISOString(), action: "suppressed", reason: gate.reason });
        monitor.recordEvent({
          traceId: monitorTraceId,
          stage: PipelineStage.AlertDecision,
          status: "Suppressed",
          details: `Quality Gate: ${gate.reason}`,
          latencyMs: Date.now() - startTime
        });
        return null;
      }

      // 4. Duplicate Check (Phase 3)
      const existingAlert = this.findDuplicate(evidence);
      if (existingAlert) {
        existingAlert.evidenceCount += 1;
        existingAlert.originalSources.push(evidence.url || evidence.sourceName);
        existingAlert.severityScore = Math.max(existingAlert.severityScore || 0, finalScore);
        
        learning.track({ alertId: existingAlert.id, timestamp: new Date().toISOString(), action: "delivered", isDuplicate: true });
        return existingAlert;
      }

      // 5. Create Initial Alert
      const isPriceAlert = evidence.evidenceType === "Price Alert";
      let alert: AthenaAlert = {
        id: `alert-${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
        type: evidence.category,
        title: evidence.title,
        description: evidence.summary,
        whatHappened: isPriceAlert ? 
          `${evidence.relatedCompanies[0] || "Stock"} moved ${Math.abs((evidence as any).metadata?.priceMovement || 0).toFixed(2)}% during market hours.` : 
          evidence.title,
        whyNow: isPriceAlert ? 
          "Market volatility threshold triggered." : 
          "Detected official announcement.",
        whyItMatters: isPriceAlert ? 
          `Movement is ${finalPriority === Priority.High || finalPriority === Priority.Critical ? "significantly above" : "notable within"} normal volatility range.` : 
          "Fundamental business development.",
        immediateMarketImpact: "Expected volatility.",
        longTermImpact: isPriceAlert ? "Technical trend adjustment." : "Fundamental shifts.",
        affectedSector: evidence.relatedSectors[0] || "General Market",
        relatedCompanies: evidence.relatedCompanies,
        historicalComparison: isPriceAlert ? "Analyzing relative to 52-week range." : "Comparable to prior cycle peaks.",
        investorTakeaway: "Evaluate impact on company fundamentals.",
        expectedNextCatalyst: "Quarterly results.",
        keyPoints: [],
        marketImpactDesc: "Neutral",
        peers: [],
        topBeneficiaries: [],
        potentialLosers: [],
        confidence: analysis.detectionConfidence,
        detectionConfidence: analysis.detectionConfidence,
        impactConfidence: analysis.impactConfidence,
        evidenceCount: 1,
        originalSources: [evidence.url || evidence.sourceName],
        impact: StoryImpact.Neutral,
        severityScore: finalScore,
        priority: finalPriority,
        status: "Delivered",
        companies: evidence.relatedCompanies,
        sectors: evidence.relatedSectors,
        score: finalScore,
        category: AlertCategory.UserIntelligence,
        traceId: monitorTraceId
      };

      // 6. Phases 5, 8, 9: Story Enrichment (Deprecated)

      this.alertHistory.unshift(alert);
      if (this.alertHistory.length > 100) this.alertHistory.pop();
      this.saveHistory();

      // 7. Dispatch
      NotificationDeliveryEngine.getInstance().queueNotification(alert);
      this.logDecision(
        alert.id, 
        finalScore, 
        "Notify", 
        "Passed Quality Gate & Enrichment", 
        alert.originalSources, 
        Date.now() - startTime,
        evidence,
        analysis,
        finalPriority,
        monitorTraceId
      );
      learning.track({ alertId: alert.id, timestamp: new Date().toISOString(), action: "delivered" });

      monitor.recordEvent({
        traceId: monitorTraceId,
        stage: PipelineStage.AlertDecision,
        status: "Success",
        details: `Alert enriched and generated: ${alert.title} (Score: ${finalScore})`,
        latencyMs: Date.now() - startTime
      });

      ProfilerService.getInstance().record("Alert Decision", Date.now() - startTime);
      return alert;

    } catch (err: any) {
      console.error("[AlertDecisionEngine] Evaluation failed:", err);
      return null;
    }
  }

  private validateQualityGate(evidence: Evidence, analysis: any, priority: Priority): { passed: boolean; reason?: string } {
    const titleLower = (evidence.title || "").toLowerCase();
    const categoryLower = (evidence.category || "").toLowerCase();
    const summaryLower = (evidence.summary || "").toLowerCase();

    // High-reliability check for critical company-specific news (like quarterly results, earnings beat, promoter action)
    const isCriticalCompanyNews = 
      titleLower.includes("quarterly results") || 
      titleLower.includes("earnings") || 
      titleLower.includes("consensus") || 
      titleLower.includes("promoter") ||
      titleLower.includes("dividend") ||
      summaryLower.includes("quarterly results") ||
      summaryLower.includes("earnings") ||
      summaryLower.includes("consensus");

    const isHighValue = isCriticalCompanyNews || this.HIGH_VALUE_CATEGORIES.some(cat => {
      const catLower = cat.toLowerCase();
      return (
        categoryLower.includes(catLower) || 
        titleLower.includes(catLower) ||
        summaryLower.includes(catLower) ||
        (catLower === "promoter buying/selling" && (titleLower.includes("promoter buying") || titleLower.includes("promoter selling") || categoryLower.includes("promoter") || summaryLower.includes("promoter"))) ||
        (catLower === "rbi/sebi actions" && (titleLower.includes("rbi") || titleLower.includes("sebi") || categoryLower.includes("rbi") || categoryLower.includes("sebi") || summaryLower.includes("rbi") || summaryLower.includes("sebi"))) ||
        (catLower === "major order wins" && (titleLower.includes("order win") || titleLower.includes("secured contract") || categoryLower.includes("orderwin") || summaryLower.includes("order win"))) ||
        (catLower === "management changes" && (titleLower.includes("management change") || titleLower.includes("ceo") || titleLower.includes("cfo") || categoryLower.includes("management") || summaryLower.includes("management change")))
      );
    });

    if (isHighValue) {
      console.log(`[AlertDecisionEngine] High-reliability delivery rule triggered for: ${evidence.title}`);
      
      // Auto-populate related companies with extracted name or "GENERAL" if empty to prevent delivery failure
      if (!evidence.relatedCompanies || evidence.relatedCompanies.length === 0) {
        const words = evidence.title.split(" ");
        let companyName = "GENERAL";
        if (titleLower.includes("bank")) {
          const bankIndex = words.findIndex(w => w.toLowerCase().includes("bank"));
          if (bankIndex > 0) {
            companyName = words[bankIndex - 1] + " Bank";
          }
        } else if (words.length > 1) {
          companyName = words[0] + " " + words[1];
        }
        evidence.relatedCompanies = [companyName.toUpperCase()];
      }
      return { passed: true };
    }

    if (priority === Priority.Ignore) return { passed: false, reason: "Below severity threshold" };
    if (!evidence.title) return { passed: false, reason: "Missing title" };
    if (!evidence.summary) return { passed: false, reason: "Missing summary" };
    if (!evidence.relatedCompanies || evidence.relatedCompanies.length === 0) return { passed: false, reason: "Company not resolved" };

    // Standard checks for other events
    if (evidence.status !== "Verified") {
      return { passed: false, reason: `Unverified/Conflicting evidence status (${evidence.status})` };
    }

    if (analysis.detectionConfidence < 65) return { passed: false, reason: `Low confidence (${analysis.detectionConfidence}%)` };
    
    // Freshness check
    const age = Date.now() - new Date(evidence.publishedTime).getTime();
    if (age > 24 * 60 * 60 * 1000) return { passed: false, reason: "Stale event (>24h)" };

    return { passed: true };
  }

  private classifyAlert(evidence: Evidence): AlertCategory {
    const systemKeywords = [
      "rate limit", "quota", "connector", "provider unavailable", 
      "retry", "fallback", "api failure", "connector offline",
      "cached evidence", "synchronization log", "missing provider",
      "validation warning", "auth failure", "database error"
    ];
    
    const titleLower = evidence.title.toLowerCase();
    const summaryLower = evidence.summary.toLowerCase();

    const isSystem = systemKeywords.some(k => titleLower.includes(k) || summaryLower.includes(k)) || 
                     evidence.evidenceType === "SystemLog" || 
                     evidence.evidenceType === "HealthCheck";

    return isSystem ? AlertCategory.SystemHealth : AlertCategory.UserIntelligence;
  }

  private calculateAlertScore(evidence: Evidence): number {
    // Weights:
    // Confidence: 30%
    // Trust Score: 20%
    // Market Importance (Proxy via source/type): 20%
    // Freshness: 10%
    // Impact Potential (Mocked for now): 20%

    const confidenceWeight = 0.3;
    const trustWeight = 0.2;
    const importanceWeight = 0.2;
    const freshnessWeight = 0.1;
    const impactWeight = 0.2;

    const confidenceScore = evidence.trustScore; // Use trustScore as base confidence
    const trustScore = evidence.trustScore;
    
    // Importance based on evidence type/source
    let importance = 50;
    if (evidence.sourceType === "Exchange" || evidence.sourceType === "Official") importance = 100;
    else if (evidence.sourceType === "Government") importance = 90;
    else if (evidence.sourceType === "Media") importance = 70;

    // Freshness (Score 100 if retrieved < 5 mins ago)
    const ageMs = Date.now() - new Date(evidence.retrievedTime).getTime();
    const freshness = Math.max(0, 100 - (ageMs / (1000 * 60 * 10))); // Decay over 10 mins

    // Impact Potential (Mocked based on company size/sector)
    const impact = 70; 

    const rawScore = (
      (confidenceScore * confidenceWeight) +
      (trustScore * trustWeight) +
      (importance * importanceWeight) +
      (freshness * freshnessWeight) +
      (impact * impactWeight)
    );

    return Math.round(rawScore);
  }

  private calculateRelevanceBoost(evidence: Evidence): number {
    const portfolioService = PortfolioService.getInstance();
    const watchlistService = WatchlistService.getInstance();
    
    let boost = 0;
    
    // Check Portfolio (Max boost +40)
    const relatedCompanies = evidence.relatedCompanies || [];
    const inPortfolio = relatedCompanies.some(c => 
      (portfolioService.getPortfolios() || []).some(p => 
        (p.holdings || []).some(h => h.symbol === c)
      )
    );
    if (inPortfolio) boost += 40;

    // Check Watchlist (Max boost +20)
    const inWatchlist = relatedCompanies.some(c => 
      (watchlistService.getWatchlists() || []).some(w => 
        (w.items || []).some(i => i.symbol === c)
      )
    );
    if (inWatchlist && !inPortfolio) boost += 20;

    // Check Sector interest (Max boost +10)
    const personalService = PersonalIntelligenceService.getInstance();
    const preferences = personalService.getPreferences();
    const interests = (preferences && preferences.interests) || [];
    const relatedSectors = evidence.relatedSectors || [];
    const sectorMatch = relatedSectors.some(s => 
      interests.some(i => s.toLowerCase().includes(i.toLowerCase()))
    );
    if (sectorMatch) boost += 10;

    return boost;
  }

  private assignPriority(score: number, evidence: Evidence, category: AlertCategory): Priority {
    if (category === AlertCategory.SystemHealth) return Priority.Low;
    if (score >= 90 || evidence.sourceType === "Exchange") return Priority.Critical;
    if (score >= 75) return Priority.High;
    if (score >= 50) return Priority.Medium;
    return Priority.Low;
  }

  private getThresholdForPriority(priority: Priority): number {
    switch (priority) {
      case Priority.Critical: return 90;
      case Priority.High: return 75;
      case Priority.Medium: return 50;
      case Priority.Low: return 30;
      default: return 50;
    }
  }

  private findDuplicate(evidence: Evidence): AthenaAlert | null {
    // Check last 1 hour of alerts for similar content
    const oneHourAgo = Date.now() - 3600000;
    const relatedCompanies = evidence.relatedCompanies || [];
    return this.alertHistory.find(a => {
      const isRecent = new Date(a.timestamp).getTime() > oneHourAgo;
      const sameCompanies = (a.companies || []).some(c => relatedCompanies.includes(c));
      const similarTitle = this.calculateTitleSimilarity(a.title || "", evidence.title || "") > 0.7;
      return isRecent && sameCompanies && similarTitle;
    }) || null;
  }

  private calculateTitleSimilarity(t1: string, t2: string): number {
    const w1 = new Set(t1.toLowerCase().split(/\s+/));
    const w2 = new Set(t2.toLowerCase().split(/\s+/));
    const intersection = new Set([...w1].filter(x => w2.has(x)));
    const union = new Set([...w1, ...w2]);
    return intersection.size / union.size;
  }

  private logDecision(
    alertId: string, 
    score: number, 
    decision: "Notify" | "Suppress" | "Merge", 
    reason: string, 
    evidenceUsed: string[], 
    latencyMs: number,
    evidence: Evidence,
    analysis: any,
    priority: Priority,
    traceId?: string
  ) {
    const log: AlertDecision = {
      alertId,
      timestamp: new Date().toISOString(),
      title: evidence.title,
      company: evidence.relatedCompanies[0] || "Unknown",
      category: evidence.category,
      priority,
      impactScore: analysis.severityScore,
      detectionConfidence: analysis.detectionConfidence,
      score,
      decision,
      reason,
      evidenceUsed,
      latencyMs,
      thresholdUsed: 65, // Base confidence threshold
      traceId
    };
    this.decisionLogs.unshift(log);
    if (this.decisionLogs.length > 100) this.decisionLogs.pop();
  }

  private createAlertFromEvidence(evidence: Evidence, score: number, priority: Priority, category: AlertCategory): AthenaAlert {
    // Parse What Happened, Why It Matters, Who Is Affected from summary
    const parts = evidence.summary.split("\n\n");
    const whatHappened = parts[0] || evidence.title;
    
    // Strict factual intelligence derived from evidence
    let whyItMatters = "";
    if (category === AlertCategory.SystemHealth) {
      whyItMatters = "Technical diagnostic event affecting system ingestion pipelines.";
    } else {
      const companiesStr = evidence.relatedCompanies.join(", ");
      const eventsStr = evidence.relatedEvents.join(", ");
      const isPriceAlert = evidence.evidenceType === "Price Alert";
      
      if (isPriceAlert) {
        whyItMatters = `Movement is notable within the context of current market volatility for ${companiesStr}.`;
      } else if (eventsStr) {
        whyItMatters = `Critical ${eventsStr} development detected for ${companiesStr || "related entities"}.`;
      } else {
        whyItMatters = `Significant development identified for ${companiesStr || "monitored symbols"}.`;
      }
    }
    
    return {
      id: `alert-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      type: evidence.category,
      title: evidence.title,
      description: evidence.summary,
      whatHappened,
      whyNow: "Detected official announcement.",
      whyItMatters,
      immediateMarketImpact: "Expected volatility.",
      longTermImpact: "Strategic shift.",
      affectedSector: evidence.relatedSectors[0] || "General Market",
      relatedCompanies: evidence.relatedCompanies,
      historicalComparison: "N/A",
      investorTakeaway: "Monitor closely.",
      expectedNextCatalyst: "Next earnings.",
      peers: [],
      topBeneficiaries: [],
      potentialLosers: [],
      confidence: evidence.trustScore,
      evidenceCount: 1,
      originalSources: [evidence.url || evidence.sourceName],
      impact: StoryImpact.Neutral,
      severityScore: score,
      priority,
      status: "Delivered",
      companies: evidence.relatedCompanies,
      sectors: evidence.relatedSectors,
      score,
      category
    };
  }

  public markAsRead(id: string) {
    const alert = this.alertHistory.find(a => a.id === id);
    if (alert) {
      alert.status = "Read";
      this.saveHistory();
    }
  }

  public dismissAlert(id: string) {
    const alert = this.alertHistory.find(a => a.id === id);
    if (alert) {
      alert.status = "Dismissed";
      this.saveHistory();
    }
  }
}
