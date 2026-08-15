import { BaseMCP } from "./BaseMCP";
import { NormalizedEvent } from "../../types";

export class SimulatedMCP extends BaseMCP {
  constructor(name: string) {
    super(name, false);
  }

  protected async executeLiveFetch(query: string): Promise<NormalizedEvent[]> {
    // Should not be called if isLive is false, but we can return mock data
    return this.executeSimulatedFetch(query);
  }

  protected async executeSimulatedFetch(query: string): Promise<NormalizedEvent[]> {
    // Return simulated normalized events based on the connector name
    return [
      {
        title: `Simulated ${this.name} Event for ${query}`,
        summary: `This is a simulated verified event from ${this.name}.`,
        source: this.name,
        publishedTime: new Date().toISOString(),
        retrievedTime: new Date().toISOString(),
        companies: [],
        sectors: [],
        themes: [],
        confidence: 80,
        originalUrl: `https://simulated.${this.name.toLowerCase().replace(/\s+/g, '')}.com/event/${Date.now()}`
      }
    ];
  }
}
