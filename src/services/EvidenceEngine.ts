import { 
  Evidence, 
  EvidenceStatus, 
  EvidenceSummaryData, 
  SearchSource, 
  PipelineStage,
  EventType,
  StoryImpact,
  isExactArticleUrl
} from "../types";
import { AlertDecisionEngine } from "./AlertDecisionEngine";
import { PipelineMonitorService } from "./PipelineMonitorService";
import { ProfilerService } from "./ProfilerService";
import { EventClassifier } from "./EventClassifier";

export class TrustScoringService {
  private static instance: TrustScoringService;
  private scoresMap: Map<string, number> = new Map();

  private constructor() {
    this.resetDefaults();
  }

  public static getInstance(): TrustScoringService {
    if (!TrustScoringService.instance) {
      TrustScoringService.instance = new TrustScoringService();
    }
    return TrustScoringService.instance;
  }

  public resetDefaults(): void {
    this.scoresMap.clear();
    this.scoresMap.set("Official Exchange Filing", 100);
    this.scoresMap.set("Company Investor Relations", 98);
    this.scoresMap.set("SEBI", 98);
    this.scoresMap.set("RBI", 98);
    this.scoresMap.set("Government Website", 95);
    this.scoresMap.set("Reuters", 92);
    this.scoresMap.set("Bloomberg", 92);
    this.scoresMap.set("Moneycontrol", 88);
    this.scoresMap.set("Economic Times", 88);
    this.scoresMap.set("Business Standard", 87);
    this.scoresMap.set("CNBC TV18", 86);
    this.scoresMap.set("Unknown", 50);
  }

  /**
   * Get score configuration
   */
  public getConfigurations(): Record<string, number> {
    const config: Record<string, number> = {};
    this.scoresMap.forEach((val, key) => {
      config[key] = val;
    });
    return config;
  }

  /**
   * Configure/Update trust score for a specific source
   */
  public setTrustScore(source: string, score: number): void {
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    this.scoresMap.set(source, score);
  }

  /**
   * Calculates trust score based on source name or type matching
   */
  public calculateScore(sourceName: string, sourceType?: string): number {
    const normalizedName = sourceName.trim().toLowerCase();

    // Check exact or partial matches in the map
    let highestScore = this.scoresMap.get("Unknown") || 50;
    let foundMatch = false;

    this.scoresMap.forEach((score, key) => {
      const keyLower = key.toLowerCase();
      if (normalizedName === keyLower || normalizedName.includes(keyLower) || keyLower.includes(normalizedName)) {
        if (score > highestScore || !foundMatch) {
          highestScore = score;
          foundMatch = true;
        }
      }
    });

    if (sourceType) {
      const normalizedType = sourceType.trim().toLowerCase();
      this.scoresMap.forEach((score, key) => {
        const keyLower = key.toLowerCase();
        if (normalizedType.includes(keyLower) || keyLower.includes(normalizedType)) {
          if (score > highestScore) {
            highestScore = score;
          }
        }
      });
    }

    return highestScore;
  }
}

export class EvidenceCollector {
  /**
   * Standardizes incoming search results into complete Evidence objects
   */
  public static collect(rawResults: any[]): Evidence[] {
    const currentISO = new Date().toISOString();
    return rawResults.map((raw, idx) => {
      const id = raw.id || `evd-${Math.floor(1000 + Math.random() * 9000)}-${idx}`;
      const title = raw.title || raw.text?.slice(0, 60) || "Untilted Signal";
      const url = raw.url || raw.uri || "";
      const sourceName = raw.sourceName || raw.source || "Unknown";
      const sourceType = raw.sourceType || "Media";
      const publishedTime = raw.publishedTime || raw.timestamp || currentISO;
      const summary = raw.summary || raw.description || raw.text || "";
      
      // Attempt to auto-detect related companies and sectors from content
      const relatedCompanies = Array.isArray(raw.relatedCompanies) ? raw.relatedCompanies : [];
      const relatedSectors = Array.isArray(raw.relatedSectors) ? raw.relatedSectors : [];
      const relatedEvents = Array.isArray(raw.relatedEvents) ? raw.relatedEvents : [];

      // Calculate initial trust score
      const trustScore = TrustScoringService.getInstance().calculateScore(sourceName, sourceType);

      return {
        id,
        title,
        url,
        sourceName,
        sourceType,
        publishedTime,
        retrievedTime: currentISO,
        trustScore,
        sourceCredibility: trustScore, // Phase 7
        category: raw.category || EventClassifier.classify(title, summary), // Dynamic classification
        impact: StoryImpact.Neutral,
        sentiment: 0,
        confidence: trustScore,
        evidenceType: raw.evidenceType || "Report",
        relatedCompanies,
        relatedSectors,
        relatedEvents,
        summary,
        status: "Unverified"
      };
    });
  }
}

export class EvidenceDeduplicator {
  /**
   * Groups articles that talk about the same core event.
   * Merges duplicate entries while preserving source links and adding them as references.
   */
  public static deduplicate(evidences: Evidence[]): Evidence[] {
    const uniqueEvidences: Evidence[] = [];
    const groupedIds = new Set<string>();

    for (let i = 0; i < evidences.length; i++) {
      const current = evidences[i];
      if (groupedIds.has(current.id)) continue;

      const group: Evidence[] = [current];
      groupedIds.add(current.id);

      for (let j = i + 1; j < evidences.length; j++) {
        const other = evidences[j];
        if (groupedIds.has(other.id)) continue;

        // Similarity match logic:
        // Match if the titles are highly similar (e.g. have matching words), or if they reference the exact same URL,
        // or if they target the same company/sector and have substantial word overlap in the title/summary.
        const titleOverlap = this.calculateWordOverlap(current.title, other.title);
        
        const currentUrl = this.normalizeUrl(current.url);
        const otherUrl = this.normalizeUrl(other.url);
        const urlMatch = currentUrl && otherUrl && currentUrl === otherUrl;
        
        const isDuplicate = urlMatch || titleOverlap > 0.8;
        if (isDuplicate) {
          group.push(other);
          groupedIds.add(other.id);
        }
      }

      // Merge the group into a consolidated single evidence record
      if (group.length === 1) {
        uniqueEvidences.push(current);
      } else {
        uniqueEvidences.push(this.mergeGroup(group));
      }
    }

    return uniqueEvidences;
  }

  private static normalizeUrl(url: string): string | null {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.origin + u.pathname.replace(/\/$/, "");
    } catch (e) {
      return url.toLowerCase().split("?")[0].replace(/\/$/, "");
    }
  }

  private static calculateWordOverlap(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length >= 2));
    const words2 = new Set(str2.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length >= 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    let intersectionCount = 0;
    words1.forEach(word => {
      if (words2.has(word)) {
        intersectionCount++;
      }
    });

    const unionSize = new Set([...words1, ...words2]).size;
    return intersectionCount / unionSize;
  }

  private static mergeGroup(group: Evidence[]): Evidence {
    // Select the one with the highest trust score as the primary anchor
    const sorted = [...group].sort((a, b) => b.trustScore - a.trustScore);
    const primary = sorted[0];

    // Merge sources, companies, sectors, and references
    const urls = new Set<string>();
    const sources = new Set<string>();
    const companies = new Set<string>();
    const sectors = new Set<string>();
    const events = new Set<string>();

    group.forEach(ev => {
      if (ev.url) urls.add(ev.url);
      sources.add(`${ev.sourceName} (${ev.trustScore})`);
      ev.relatedCompanies.forEach(c => companies.add(c));
      ev.relatedSectors.forEach(s => sectors.add(s));
      ev.relatedEvents.forEach(e => events.add(e));
    });

    // Synthesized summary containing all aggregated metadata
    const sourceSummary = `Consolidated analysis of ${group.length} report(s). Sources: ${Array.from(sources).join(", ")}.`;

    // Find the first valid exact article URL, fallback to primary.url
    let canonicalUrl = primary.url;
    const allUrls = Array.from(urls);
    const validUrl = allUrls.find(u => isExactArticleUrl(u));
    if (validUrl) {
      canonicalUrl = validUrl;
    } else if (allUrls.length > 0) {
      // Find any non-empty URL
      const anyUrl = allUrls.find(u => u && u !== "#" && !u.includes("system.fallback.local"));
      if (anyUrl) {
        canonicalUrl = anyUrl;
      }
    }

    return {
      ...primary,
      url: canonicalUrl,
      relatedCompanies: Array.from(companies),
      relatedSectors: Array.from(sectors),
      relatedEvents: Array.from(events),
      summary: `${primary.summary}\n\n[Aggregation Intelligence] ${sourceSummary}`,
      // Use the maximum trust score from the group to indicate strong validation
      trustScore: primary.trustScore,
      status: "Verified"
    };
  }
}

export class ConflictDetector {
  /**
   * Compares evidence records to find conflicting statements.
   * If a conflict is discovered, flags the record, records description of conflicts, and penalizes confidence.
   */
  public static detect(evidences: Evidence[]): Evidence[] {
    // Rule-based conflict analysis
    // We check for conflicting numeric figures (like percentages, currency figures) 
    // or key opposite keywords (raise/cut, hike/reduce, bullish/bearish, positive/negative, upgrade/downgrade)
    // targeting the same company or event.
    
    const results = evidences.map(ev => ({ ...ev }));

    for (let i = 0; i < results.length; i++) {
      const current = results[i];
      const currentConflicts: string[] = [];

      for (let j = 0; j < results.length; j++) {
        if (i === j) continue;
        const other = results[j];

        // Only compare if they target the same company or share similar focus
        const shareCompany = (current.relatedCompanies || []).some(c => (other.relatedCompanies || []).includes(c));
        const shareSector = (current.relatedSectors || []).some(s => (other.relatedSectors || []).includes(s));

        if (shareCompany || shareSector) {
          // 1. Look for numeric conflict (e.g. "tariff hike of 15%" vs "tariff hike of 25%")
          const numConflict = this.findNumericConflicts(current.summary, other.summary);
          if (numConflict) {
            currentConflicts.push(`Numeric discrepancy with ${other.sourceName}: ${numConflict}`);
          }

          // 2. Look for semantic posture conflict (e.g., "strengthen" vs "weaken", "upgrade" vs "downgrade")
          const postureConflict = this.findPostureConflicts(current.summary, other.summary);
          if (postureConflict) {
            currentConflicts.push(`Semantic stance conflict with ${other.sourceName}: ${postureConflict}`);
          }
        }
      }

      if (currentConflicts.length > 0) {
        current.status = "Conflicting";
        current.conflicts = currentConflicts;
        // Penalize trust score by 20% due to conflicting evidence
        current.trustScore = Math.max(30, Math.round(current.trustScore * 0.8));
      } else {
        current.status = "Verified";
      }
    }

    return results;
  }

  private static findNumericConflicts(text1: string, text2: string): string | null {
    // Simple regex to find percentages or financial figures
    const numberRegex = /(\d+(?:\.\d+)?\s*(?:%|percent|cr|crore|billion|usd|inr))/gi;
    const matches1 = text1.match(numberRegex) || [];
    const matches2 = text2.match(numberRegex) || [];

    // Find if there are differing figures mentioned
    if (matches1.length > 0 && matches2.length > 0) {
      // If they mention different numbers but both refer to the same context words
      for (const m1 of matches1) {
        for (const m2 of matches2) {
          const val1 = m1.replace(/[^0-9.]/g, "");
          const val2 = m2.replace(/[^0-9.]/g, "");
          if (val1 !== val2) {
            // Check if context word matches (e.g., "tariff" or "expansion" or "capex")
            const commonKeywords = ["tariff", "capex", "interest", "cut", "profit", "revenue", "hike", "percent", "expansion"];
            for (const keyword of commonKeywords) {
              if (text1.toLowerCase().includes(keyword) && text2.toLowerCase().includes(keyword)) {
                return `Differing figures detected ('${m1}' vs '${m2}') regarding context '${keyword}'`;
              }
            }
          }
        }
      }
    }
    return null;
  }

  private static findPostureConflicts(text1: string, text2: string): string | null {
    const pairs = [
      ["hike", "cut"],
      ["raise", "lower"],
      ["upgrade", "downgrade"],
      ["positive", "negative"],
      ["strengthen", "weaken"],
      ["bullish", "bearish"],
      ["increase", "decrease"]
    ];

    const t1 = text1.toLowerCase();
    const t2 = text2.toLowerCase();

    for (const [pos, neg] of pairs) {
      if ((t1.includes(pos) && t2.includes(neg)) || (t1.includes(neg) && t2.includes(pos))) {
        return `Opposing market directions identified ('${pos}' vs '${neg}')`;
      }
    }

    return null;
  }
}

export class EvidenceSummaryService {
  /**
   * Produces a synthesized EvidenceSummaryData from verified & conflicting inputs
   */
  public static synthesize(evidences: Evidence[]): EvidenceSummaryData {
    const keyFacts: string[] = [];
    const supportingEvidence: string[] = [];
    const conflictingEvidence: string[] = [];

    let totalScore = 0;
    let count = 0;

    evidences.forEach(ev => {
      // Key facts extraction (using title and summary highlights)
      if (ev.status === "Verified") {
        keyFacts.push(`${ev.title} (${ev.sourceName})`);
        supportingEvidence.push(`${ev.sourceName} verifies the claim: "${ev.title}" (Trust: ${ev.trustScore})`);
      } else if (ev.status === "Conflicting") {
        conflictingEvidence.push(`${ev.sourceName} reports a conflicting claim. Conflicts: ${ev.conflicts?.join("; ")}`);
      }
      totalScore += ev.trustScore;
      count++;
    });

    const averageTrust = count > 0 ? Math.round(totalScore / count) : 75;
    
    // Penalize general confidence if there are conflicts
    const penalty = conflictingEvidence.length * 15;
    const overallConfidence = Math.max(30, Math.min(100, averageTrust - penalty));

    return {
      keyFacts: keyFacts.slice(0, 5),
      supportingEvidence: supportingEvidence.slice(0, 5),
      conflictingEvidence,
      overallConfidence
    };
  }
}

export class EvidenceEngine {
  private static instance: EvidenceEngine;
  private evidenceStore: Evidence[] = [];
  private activeConflicts: string[] = [];
  private lastSummary: EvidenceSummaryData | null = null;

  private constructor() {
    this.seedDefaultEvidence();
  }

  public static getInstance(): EvidenceEngine {
    if (!EvidenceEngine.instance) {
      EvidenceEngine.instance = new EvidenceEngine();
    }
    return EvidenceEngine.instance;
  }

  private seedDefaultEvidence(): void {
    const seedSearch = [
      {
        id: "se-1",
        title: "Tata Motors plans ₹12,000 Cr EV Expansion in Gujarat",
        sourceName: "Official Exchange Filing",
        sourceType: "Exchange",
        summary: "Tata Motors Ltd has disclosed in an exchange filing that it will allocate ₹12,000 Cr towards setting up an EV battery cell gigafactory and line network in Gujarat.",
        relatedCompanies: ["TATAMOTORS"],
        relatedSectors: ["Automotive & EVs"]
      },
      {
        id: "se-2",
        title: "Tata Motors EV capex confirmed at ₹12,000 Crore in Gujarat",
        sourceName: "Company Investor Relations",
        sourceType: "Company IR",
        summary: "Investor briefing confirms a planned capex outlay of ₹12,000 Cr over 3 years for green field gigafactory production expansion in Gujarat.",
        relatedCompanies: ["TATAMOTORS"],
        relatedSectors: ["Automotive & EVs"]
      },
      {
        id: "se-3",
        title: "Discrepancy: Tata Motors EV expansion capex could be only ₹8,000 Cr",
        sourceName: "Moneycontrol",
        sourceType: "Media",
        summary: "Rumors suggest Tata Motors may stagger its Gujarat gigafactory capex, initially committing only ₹8,000 Cr due to softening global demand projections.",
        relatedCompanies: ["TATAMOTORS"],
        relatedSectors: ["Automotive & EVs"]
      }
    ];

    const collected = EvidenceCollector.collect(seedSearch);
    const unique = EvidenceDeduplicator.deduplicate(collected);
    const evaluated = ConflictDetector.detect(unique);
    this.evidenceStore = evaluated;
    this.lastSummary = EvidenceSummaryService.synthesize(evaluated);
  }

  /**
   * Retrieves all evidence from the in-memory store
   */
  public getEvidence(): Evidence[] {
    return this.evidenceStore;
  }

  /**
   * Retrieves the last synthesized summary
   */
  public getLastSummary(): EvidenceSummaryData | null {
    return this.lastSummary;
  }

  /**
   * Central Pipeline Entrypoint
   * Takes incoming raw search results/signals and passes them through:
   * 1. Collect -> 2. Deduplicate -> 3. Trust Score -> 4. Conflict Detect -> 5. Synthesize Summary -> 6. Feed to Event Engine
   */
  public async processIncomingSignals(rawResults: any[], traceId?: string): Promise<{ summary: EvidenceSummaryData; consolidated: Evidence[] }> {
    const monitorTraceId = traceId || `trace-${Math.random().toString(36).substring(7)}`;
    const monitor = PipelineMonitorService.getInstance();
    const startTime = Date.now();

    console.log("Evidence Engine Pipeline executing for:", rawResults.length, "signals.");

    // 1. Collect
    const collected = EvidenceCollector.collect(rawResults);

    // 2. Deduplicate
    const deduplicated = EvidenceDeduplicator.deduplicate(collected);

    // 3. Conflict Detection (performs conflict validation and penalizes trust scoring inline)
    const evaluated = ConflictDetector.detect(deduplicated);

    monitor.recordEvent({
      traceId: monitorTraceId,
      stage: PipelineStage.Evidence,
      status: "Success",
      details: `Processed ${rawResults.length} signals into ${evaluated.length} consolidated evidence items.`,
      latencyMs: Date.now() - startTime
    });

    ProfilerService.getInstance().record("Evidence Engine", Date.now() - startTime);

    // 4. Alert Decision Engine Integration (Phase 12: Parallelize)
    const alertEngine = AlertDecisionEngine.getInstance();
    const evaluationPromises = evaluated.map(async ev => {
      await alertEngine.evaluateEvidence(ev, monitorTraceId);
    });

    await Promise.all(evaluationPromises);

    // Append to local memory store
    evaluated.forEach(ev => {
      const existsIdx = this.evidenceStore.findIndex(storeEv => storeEv.id === ev.id || (storeEv.title === ev.title && storeEv.sourceName === ev.sourceName));
      if (existsIdx >= 0) {
        const existing = this.evidenceStore[existsIdx];
        // Only replace if the incoming one is fresher
        if (new Date(ev.publishedTime) >= new Date(existing.publishedTime)) {
          this.evidenceStore[existsIdx] = ev;
        }
      } else {
        this.evidenceStore.unshift(ev);
      }
    });

    // 4. Synthesize overall summary
    const summary = EvidenceSummaryService.synthesize(evaluated);
    this.lastSummary = summary;

    console.log("Evidence Engine Pipeline completed successfully. Consolidated count:", evaluated.length);

    return {
      summary,
      consolidated: evaluated
    };
  }
}
