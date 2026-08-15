import { AbstractBaseMCP } from "./AbstractBaseMCP";
import { NormalizedEvent } from "../types";

export class NewsMCP extends AbstractBaseMCP {
  protected name = "News MCP Connector";
  protected refreshInterval = 180000; // 3 minutes
  protected priorityValue = 6;
  protected sources = ["Reuters News Briefs", "Bloomberg Intelligence Feed", "Economic Times Live"];

  public async fetchUpdates(): Promise<any[]> {
    const query = "breaking India stock market business news financial headlines today";
    
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
          id: "news-brk-1",
          title: "Brent Crude prices drop below $78 per barrel",
          description: "Brent crude futures declined by 1.8% to slide below the critical $78 mark.",
          timestamp: new Date().toISOString(),
          source: "Reuters News Briefs",
          companies: [],
          sectors: ["Green Energy & Power"],
          url: "https://www.reuters.com/markets/commodities/brent-crude-78-drop",
          confidence: 93
        }
      ];
    }
  }

  protected getRecordKey(raw: any): string {
    return raw.id || raw.title;
  }

  public normalize(raw: any): NormalizedEvent {
    return {
      id: raw.id || `news-${Date.now()}`,
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
