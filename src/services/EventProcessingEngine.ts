import { 
  AthenaEvent, 
  EventType, 
  StoryImpact, 
  Severity, 
  CompanyKnowledge, 
  SectorStory, 
  MarketStory,
  TimelineEvent 
} from "../types";
import { CompanyKnowledgeService } from "./CompanyKnowledgeService";
import { SectorStoryEngine } from "./SectorStoryEngine";
import { MarketStoryEngine } from "./MarketStoryEngine";
import { EventClassifier } from "./EventClassifier";
import { ImpactAnalyzer } from "./ImpactAnalyzer";
import { KnowledgeGraphEngine } from "./KnowledgeGraphEngine";

export class EventProcessingEngine {
  private static instance: EventProcessingEngine;
  private events: AthenaEvent[] = [];

  private constructor() {
    this.seedEvents();
  }

  public static getInstance(): EventProcessingEngine {
    if (!EventProcessingEngine.instance) {
      EventProcessingEngine.instance = new EventProcessingEngine();
    }
    return EventProcessingEngine.instance;
  }

  /**
   * Seed the engine with some initial processed events.
   */
  private seedEvents(): void {
    const seedRaw = [
      {
        id: "ev-101",
        timestamp: "2026-07-15T08:00:00Z",
        source: "Tata Motors Investor Relations",
        eventType: EventType.CorporateAction,
        title: "EV Gigafactory expansion in Gujarat",
        description: "Tata Motors is establishing a ₹12,000 Cr localized battery cell gigafactory network in Gujarat, accelerating capital expenditure and securing high-volume supply.",
        companies: ["TATAMOTORS"],
        sectors: ["Automotive & EVs"],
        confidence: 96,
        status: "Published",
        evidence: "Official disclosure during local state cabinet clearance brief.",
        impact: StoryImpact.Positive,
        severity: Severity.High
      },
      {
        id: "ev-102",
        timestamp: "2026-07-15T08:05:00Z",
        source: "Reliance Industries Press Release",
        eventType: EventType.Earnings,
        title: "Retail and Jio Tariff Hike monetization integration",
        description: "Jio has successfully completed a 15-20% tariff hike across pre-paid and post-paid plans, driving high-margin cash flows directly to Jio Platforms.",
        companies: ["RELIANCE"],
        sectors: ["Green Energy & Power"],
        confidence: 94,
        status: "Published",
        evidence: "Tariff sheet published on jio.com and exchange disclosures.",
        impact: StoryImpact.Positive,
        severity: Severity.High
      },
      {
        id: "ev-103",
        timestamp: "2026-07-15T08:07:00Z",
        source: "Infosys Q1 Earnings Transcript",
        eventType: EventType.Earnings,
        title: "Discretionary cloud spend recovery in BFSI sector",
        description: "Infosys CEO highlights renewed software budgets and discretionary IT upgrading projects across major North American bank verticals.",
        companies: ["INFY"],
        sectors: ["IT Services"],
        confidence: 91,
        status: "Published",
        evidence: "Quarterly investor call and management Q&A transcript.",
        impact: StoryImpact.Positive,
        severity: Severity.Medium
      }
    ];

    this.events = seedRaw;
    seedRaw.forEach(ev => {
      KnowledgeGraphEngine.getInstance().updateGraphWithEvent(ev);
    });
  }

  /**
   * Retrieves all processed events.
   */
  public getEvents(): AthenaEvent[] {
    return this.events;
  }

  /**
   * The Central Event Processing Pipeline for Athena.
   * Every incoming event follows these 11 steps:
   * Receive Event -> Validate -> Classify -> Identify affected companies -> Identify affected sectors ->
   * Calculate story impact -> Update CompanyKnowledge -> Update SectorStory -> Update MarketStory ->
   * Recalculate confidence -> Store event.
   */
  public processEvent(rawEvent: Partial<AthenaEvent>): AthenaEvent {
    console.log("Athena Event Processing Pipeline starting for event:", rawEvent.title);

    // 1. Receive Event
    const id = rawEvent.id || `ev-${Math.floor(100 + Math.random() * 900)}`;
    const timestamp = rawEvent.timestamp || new Date().toISOString();

    // 2. Validate
    const title = rawEvent.title?.trim() || "";
    const description = rawEvent.description?.trim() || "";
    if (!title || !description) {
      throw new Error("Event validation failed: Title and Description are required.");
    }
    const source = rawEvent.source?.trim() || "Athena AI Engine";
    const confidence = typeof rawEvent.confidence === "number" ? rawEvent.confidence : 85;
    const status = rawEvent.status || "Published";
    const evidence = rawEvent.evidence || "Derived from systemic intelligence analysis.";

    // 3. Classify
    const eventType = rawEvent.eventType || EventClassifier.classify(title, description);

    // 4. Identify Affected Companies
    let companies = Array.isArray(rawEvent.companies) ? [...rawEvent.companies] : [];
    if (companies.length === 0) {
      // Auto-identify companies based on symbols or names in the text
      const knownSymbols = CompanyKnowledgeService.getInstance().getAllSymbols();
      knownSymbols.forEach(symbol => {
        const symbolLower = symbol.toLowerCase();
        const baseCompany = CompanyKnowledgeService.getInstance().getCompanyKnowledge(symbol, []);
        const nameLower = baseCompany?.name.toLowerCase() || "";
        
        const textToSearch = `${title} ${description}`.toLowerCase();
        if (textToSearch.includes(symbolLower) || (nameLower && textToSearch.includes(nameLower))) {
          if (!companies.includes(symbol)) {
            companies.push(symbol);
          }
        }
      });
    }

    // 5. Identify Affected Sectors
    let sectors = Array.isArray(rawEvent.sectors) ? [...rawEvent.sectors] : [];
    if (sectors.length === 0) {
      // First, get sectors of any identified companies
      companies.forEach(symbol => {
        const company = CompanyKnowledgeService.getInstance().getCompanyKnowledge(symbol, []);
        if (company && company.profile && company.profile.sector) {
          const sectorName = company.profile.sector;
          // Match the precise sector name in the SectorStoryEngine
          const matchedSector = SectorStoryEngine.getInstance().getAllSectors().find(
            s => s.sector.toLowerCase().includes(sectorName.toLowerCase()) || 
                 sectorName.toLowerCase().includes(s.sector.toLowerCase())
          );
          if (matchedSector && !sectors.includes(matchedSector.sector)) {
            sectors.push(matchedSector.sector);
          }
        }
      });

      // Secondly, search text keywords for sectors
      const allSectors = SectorStoryEngine.getInstance().getAllSectors();
      allSectors.forEach(sec => {
        const sectorLower = sec.sector.toLowerCase();
        const textToSearch = `${title} ${description}`.toLowerCase();
        if (textToSearch.includes(sectorLower) || sectorLower.split("&").some(part => textToSearch.includes(part.trim()))) {
          if (!sectors.includes(sec.sector)) {
            sectors.push(sec.sector);
          }
        }
      });
    }

    // 6. Calculate Story Impact & Severity
    const impactResult = ImpactAnalyzer.analyze({
      title,
      description,
      category: (rawEvent.eventType as EventType) || EventType.RegulatoryFiling,
      evidenceCount: 1,
      sourceCredibility: 70
    });
    const impact = rawEvent.impact || impactResult.impact;
    
    // Map score to Severity enum
    let severity = Severity.Low;
    if (impactResult.severityScore >= 85) severity = Severity.Critical;
    else if (impactResult.severityScore >= 65) severity = Severity.High;
    else if (impactResult.severityScore >= 40) severity = Severity.Medium;

    // 7. Update CompanyKnowledge
    const companyService = CompanyKnowledgeService.getInstance();
    companies.forEach(symbol => {
      const company = companyService.getCompanyKnowledge(symbol, []);
      if (company) {
        // Map event impact to storyStatus
        let newStatus: "Strengthening" | "Stable" | "Weakening" | "Uncertain" = "Stable";
        if (impact === StoryImpact.Positive) newStatus = "Strengthening";
        else if (impact === StoryImpact.Negative) newStatus = "Weakening";
        else if (impact === StoryImpact.Neutral) newStatus = "Stable";
        else newStatus = "Uncertain";

        // Recalculate confidence
        const oldConfidence = company.story?.storyConfidence ?? company.confidence ?? 85;
        const newConfidence = Math.round((oldConfidence * 0.7) + (confidence * 0.3));

        // Let's modify the database record in CompanyKnowledgeService
        // We will create a helper method or use the direct database update
        // Let's update story state
        const dbRecord = (companyService as any).database[symbol.toUpperCase().replace(/[^A-Z0-9]/g, "")];
        if (dbRecord) {
          dbRecord.story.storyStatus = newStatus;
          dbRecord.story.storyConfidence = newConfidence;
          dbRecord.confidence = newConfidence;
          dbRecord.lastUpdated = new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "IST"
          });
          
          // Append the event to facts if it represents a major verified fact
          if (!dbRecord.aiSummary.facts.includes(title)) {
            dbRecord.aiSummary.facts.unshift(title);
          }
        }
      }
    });

    // 8. Update SectorStory
    const sectorService = SectorStoryEngine.getInstance();
    sectors.forEach(sectorName => {
      const sector = sectorService.getSectorStory(sectorName);
      if (sector) {
        // Build an updated dynamic story status text
        const statusText = `Latest intelligence update: ${title}. ${description}`;
        const oldConfidence = sector.confidence;
        const newConfidence = Math.round((oldConfidence * 0.7) + (confidence * 0.3));
        
        sectorService.updateSectorStory(sectorName, statusText, newConfidence);
        sectorService.recordRecentEvent(sectorName, title);

        // Update the sector trend dynamically based on the impact
        if (impact === StoryImpact.Positive) {
          sector.trend = sector.trend === "up" ? "strong_up" : "up";
        } else if (impact === StoryImpact.Negative) {
          sector.trend = "down";
        } else if (impact === StoryImpact.Neutral) {
          sector.trend = "flat";
        }
      }
    });

    // 9. Update MarketStory
    const marketEngine = MarketStoryEngine.getInstance();
    // Convert event to chronological market timeline event format
    const timeString = new Date(timestamp).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "IST"
    }) + " IST";

    marketEngine.acceptMarketEvent({
      time: timeString,
      type: eventType,
      title: title,
      description: description
    });

    // Update global news headlines with the processed breaking/macro event
    marketEngine.acceptNews({
      text: title,
      tag: eventType.toUpperCase(),
      timestamp: timeString
    });

    // 10. Recalculate confidence (for the event itself or general system)
    const processedConfidence = Math.round((confidence + 95) / 2); // Algorithmic consolidation

    // 11. Store Event
    const processedEvent: AthenaEvent = {
      id,
      timestamp,
      source,
      eventType,
      title,
      description,
      companies,
      sectors,
      confidence: processedConfidence,
      status,
      evidence,
      impact,
      severity: severity as Severity
    };

    this.events.unshift(processedEvent);
    KnowledgeGraphEngine.getInstance().updateGraphWithEvent(processedEvent);
    console.log("Athena Event Processing Pipeline completed successfully. ProcessedEvent ID:", id);

    return processedEvent;
  }
}
