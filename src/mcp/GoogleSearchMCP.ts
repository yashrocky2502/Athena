import { AbstractBaseMCP } from "./AbstractBaseMCP";
import { NormalizedEvent } from "../types";

export class GoogleSearchMCP extends AbstractBaseMCP {
  protected name = "Google Search Grounding";
  protected refreshInterval = 120000; // 2 minutes
  protected priorityValue = 1; // Highest priority
  protected sources = ["Google Search Live Grounding"];

  constructor() {
    super();
  }

  public async fetchUpdates(): Promise<any[]> {
    const query = "India stock market breaking news corporate announcements today";
    
    try {
      const data = await this.coordinator.requestData({
        query,
        priority: this.priorityValue,
        source: this.name
      });
      return data || [];
    } catch (error: any) {
      if (error.message === "QUOTA_EXCEEDED") {
        return []; // Trigger fallback handled in base class
      }
      throw error;
    }
  }

  protected getRecordKey(raw: any): string {
    return raw.id || raw.title;
  }

  public normalize(raw: any): NormalizedEvent {
    return {
      id: raw.id || `gs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: raw.title || "Unknown Event",
      summary: raw.summary || "",
      source: raw.source || "Google Search Grounding",
      publishedTime: raw.publishedTime || new Date().toISOString(),
      retrievedTime: new Date().toISOString(),
      companies: raw.companies || [],
      sectors: raw.sectors || [],
      themes: raw.themes || [],
      confidence: raw.confidence || 85,
      originalUrl: raw.url
    };
  }
}
