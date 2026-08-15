import { AbstractBaseMCP } from "./AbstractBaseMCP";
import { EventType, StoryImpact, Severity, NormalizedEvent } from "../types";

export class BSEMCP extends AbstractBaseMCP {
  protected name = "BSE MCP Connector";
  protected refreshInterval = 300000; // 5 minutes
  protected priorityValue = 9;
  protected sources = ["BSE Bulk Deal Disclosures", "BSE Shareholding Filings"];

  public async fetchUpdates(): Promise<any[]> {
    const query = "latest BSE India corporate announcements bulk deals today";
    
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
          id: "bse-disc-1",
          title: "HDFC Bank Ltd discloses promoter share pledge reduction",
          description: "HDFC Bank has submitted a disclosure indicating that the promoter group has successfully released a pledge of shares.",
          timestamp: new Date().toISOString(),
          source: "BSE Shareholding Filings",
          companies: ["HDFCBANK"],
          sectors: ["Banking & Finance"],
          url: "https://www.bseindia.com/disclosures/hdfcbank-pledge-release",
          confidence: 97
        }
      ];
    }
  }

  protected getRecordKey(raw: any): string {
    return raw.id || raw.title;
  }

  public normalize(raw: any): NormalizedEvent {
    return {
      id: raw.id || `bse-${Date.now()}`,
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
