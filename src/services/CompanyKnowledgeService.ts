import { CompanyKnowledge, SearchSource, StoryEngineRecord } from "../types";

export class CompanyKnowledgeService {
  private static instance: CompanyKnowledgeService;
  private database: Record<string, CompanyKnowledge> = {};

  private constructor() {
    this.seedDatabase();
  }

  public static getInstance(): CompanyKnowledgeService {
    if (!CompanyKnowledgeService.instance) {
      CompanyKnowledgeService.instance = new CompanyKnowledgeService();
    }
    return CompanyKnowledgeService.instance;
  }

  /**
   * Seeds the in-memory database with structured CompanyKnowledge.
   * Transitioned to empty seed - all data now resolved dynamically via live providers.
   */
  private seedDatabase(): void {
    // Purged hardcoded data for production stabilization.
    this.database = {};
  }

  public addCompanyKnowledge(knowledge: CompanyKnowledge): void {
    if (!knowledge || !knowledge.symbol) {
      console.warn("[CompanyKnowledgeService] Attempted to add invalid knowledge:", knowledge);
      return;
    }
    const key = knowledge.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    this.database[key] = knowledge;
  }

  /**
   * Retrieves unified CompanyKnowledge for a specific company symbol.
   * Leverages real-time/historical Story Engine timeline records to dynamically append timeline items.
   */
  public getCompanyKnowledge(symbol: string, stories: StoryEngineRecord[] = []): CompanyKnowledge | null {
    const key = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const baseKnowledge = this.database[key];
    if (!baseKnowledge) return null;

    // Filter relevant Story Engine timeline stories dynamically to attach to this company's unified object
    const companyTimeline = stories
      .filter(story => {
        if (!story || !story.company) return false;
        const sComp = story.company.toLowerCase();
        const kLower = key.toLowerCase();
        const bName = (baseKnowledge.name || "").toLowerCase();
        const matchesKey = sComp.includes(kLower) || 
                           kLower.includes(sComp) ||
                           sComp.includes(bName);
        return matchesKey;
      })
      .map(story => ({
        id: story.id,
        company: story.company,
        event: story.event,
        status: story.status,
        confidence: story.confidence,
        timestamp: story.timestamp
      }));

    return {
      ...baseKnowledge,
      timeline: companyTimeline
    };
  }

  /**
   * Updates core price points and change parameters for a specific company.
   */
  public updateMarketData(symbol: string, price: number, change: number, changePercent: number): void {
    const key = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const company = this.database[key];
    if (company) {
      company.marketData = { price, change, changePercent };
      company.lastUpdated = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short"
      });
    }
  }

  /**
   * Updates structural risk records for a specific company.
   */
  public updateRisks(symbol: string, risks: { title: string; desc: string }[]): void {
    const key = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const company = this.database[key];
    if (company) {
      company.risks = risks;
    }
  }

  /**
   * Updates strategic opportunities lists.
   */
  public updateOpportunities(symbol: string, opportunities: string[]): void {
    const key = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const company = this.database[key];
    if (company) {
      company.opportunities = opportunities;
    }
  }

  /**
   * Retrieves all registered company keys.
   */
  public getAllSymbols(): string[] {
    return Object.keys(this.database);
  }
}
