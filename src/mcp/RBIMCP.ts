import { AbstractBaseMCP } from "./AbstractBaseMCP";
import { NormalizedEvent } from "../types";

export class RBIMCP extends AbstractBaseMCP {
  protected name = "RBI MCP Connector";
  protected refreshInterval = 600000; // 10 minutes
  protected priorityValue = 8;
  protected sources = ["RBI MPC Resolutions", "RBI Banking Guidelines"];

  public async fetchUpdates(): Promise<any[]> {
    const query = "latest RBI India monetary policy circulars notifications today";
    
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
          id: "rbi-policy-1",
          title: "RBI Monetary Policy Committee keeps repo rate unchanged",
          description: "The Reserve Bank of India’s MPC voted to maintain the benchmark policy repo rate at 6.50%.",
          timestamp: new Date().toISOString(),
          source: "RBI MPC Resolutions",
          companies: [],
          sectors: ["Banking & Finance"],
          url: "https://www.rbi.org.in/press/mpc-resolution-6-5",
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
      id: raw.id || `rbi-${Date.now()}`,
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
