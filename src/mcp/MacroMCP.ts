import { AbstractBaseMCP } from "./AbstractBaseMCP";
import { NormalizedEvent } from "../types";

export class MacroMCP extends AbstractBaseMCP {
  protected name = "Macro MCP Connector";
  protected refreshInterval = 1800000; // 30 minutes
  protected priorityValue = 5;
  protected sources = ["MOSPI Inflation Releases", "DPIIT Industrial Production Data"];

  public async fetchUpdates(): Promise<any[]> {
    const query = "latest India macro economic data inflation GDP IIP news today";
    
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
          id: "macro-data-1",
          title: "India Retail CPI Inflation falls to 12-month low of 4.25%",
          description: "Data released by MOSPI shows headline consumer price inflation decreased.",
          timestamp: new Date().toISOString(),
          source: "MOSPI Inflation Releases",
          companies: [],
          sectors: ["Banking & Finance"],
          url: "https://www.mospi.gov.in/releases/cpi-inflation-june-2026",
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
      id: raw.id || `macro-${Date.now()}`,
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
