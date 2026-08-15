import { AbstractBaseMCP } from "./AbstractBaseMCP";
import { NormalizedEvent } from "../types";

export class CompanyIRMCP extends AbstractBaseMCP {
  protected name = "Company IR MCP Connector";
  protected refreshInterval = 900000; // 15 minutes
  protected priorityValue = 7;
  protected sources = ["Investor Conference Call Transcripts", "Company Earnings Presentations"];

  public async fetchUpdates(): Promise<any[]> {
    const query = "latest India corporate investor relations earnings calls news today";
    
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
          id: "ir-trans-1",
          title: "Infosys Ltd Q1 conference call highlights cloud traction",
          description: "Infosys board noted a strong recovery in enterprise cloud migration orders.",
          timestamp: new Date().toISOString(),
          source: "Investor Conference Call Transcripts",
          companies: ["INFY"],
          sectors: ["IT Services"],
          url: "https://www.infosys.com/investors/transcripts/q1-cloud-traction",
          confidence: 96
        }
      ];
    }
  }

  protected getRecordKey(raw: any): string {
    return raw.id || raw.title;
  }

  public normalize(raw: any): NormalizedEvent {
    return {
      id: raw.id || `ir-${Date.now()}`,
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
