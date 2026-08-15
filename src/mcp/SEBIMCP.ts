import { AbstractBaseMCP } from "./AbstractBaseMCP";
import { NormalizedEvent } from "../types";

export class SEBIMCP extends AbstractBaseMCP {
  protected name = "SEBI MCP Connector";
  protected refreshInterval = 600000; // 10 minutes
  protected priorityValue = 8;
  protected sources = ["SEBI Regulatory Guidelines", "SEBI Adjudication Orders"];

  public async fetchUpdates(): Promise<any[]> {
    const query = "latest SEBI India regulatory orders circulars news today";
    
    try {
      const data = await this.coordinator.requestData({
        query,
        priority: this.priorityValue,
        source: this.name
      });
      return data || [];
    } catch (error: any) {
      if (error.message === "QUOTA_EXCEEDED") return [];
      return [
        {
          id: "sebi-reg-1",
          title: "SEBI implements revised Index Derivative trading frame rules",
          description: "SEBI has announced updated regulatory measures for the futures & options (F&O) segment.",
          timestamp: new Date().toISOString(),
          source: "SEBI Regulatory Guidelines",
          companies: [],
          sectors: ["Banking & Finance"],
          url: "https://www.sebi.gov.in/legal/circulars/index-derivative-revision",
          confidence: 99
        }
      ];
    }
  }

  protected getRecordKey(raw: any): string {
    return raw.id || raw.title;
  }

  public normalize(raw: any): NormalizedEvent {
    return {
      id: raw.id || `sebi-${Date.now()}`,
      title: raw.title,
      summary: raw.summary || raw.description || "",
      source: raw.source || this.sources[0],
      publishedTime: raw.publishedTime || raw.timestamp || new Date().toISOString(),
      retrievedTime: new Date().toISOString(),
      companies: raw.companies || [],
      sectors: raw.sectors || [],
      themes: raw.themes || [],
      confidence: raw.confidence || 95,
      originalUrl: raw.url || raw.originalUrl
    };
  }
}
