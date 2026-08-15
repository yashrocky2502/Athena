import { BaseMCP } from "./BaseMCP";
import { NormalizedEvent } from "../../types";
import { GoogleGenAI } from "@google/genai";

export class GoogleSearchMCP extends BaseMCP {
  private ai: GoogleGenAI | null;

  constructor(ai: GoogleGenAI | null) {
    super("Google Search Grounding", true);
    this.ai = ai;
  }

  protected async executeLiveFetch(query: string): Promise<NormalizedEvent[]> {
    if (!this.ai) {
      throw new Error("Gemini AI instance is not available for GoogleSearchMCP");
    }

    const prompt = `You are Athena AI's search extraction engine.
Find the most recent and verified financial facts about: "${query}".
Output a JSON array of events with the following structure:
[
  {
    "title": "Headline",
    "summary": "Detailed summary",
    "source": "Source Name",
    "publishedTime": "YYYY-MM-DD",
    "companies": ["Company1"],
    "sectors": ["Sector1"],
    "themes": ["Theme1"],
    "confidence": 95
  }
]
Only use real data. Return purely JSON.`;

    const response = await this.ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }] as any,
        responseMimeType: "application/json"
      }
    });

    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sourceMap = new Map<string, any>();
    
    // Attempt to map chunks to URLs
    rawChunks.forEach((chunk) => {
      if (chunk.web && chunk.web.uri) {
        // We'll use the domain or title as a key to match with generated sources
        sourceMap.set(chunk.web.title || chunk.web.uri, chunk.web);
      }
    });

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(response.text || "[]");
    } catch (e) {
      console.log("Failed to parse GoogleSearchMCP JSON:", e);
      throw e;
    }

    const events: NormalizedEvent[] = [];
    
    // Get all available URLs from grounding
    const availableUrls = Array.from(sourceMap.values());

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      // Assign an original URL from grounding chunks if possible
      let originalUrl = "https://www.google.com/search?q=" + encodeURIComponent(query);
      if (i < availableUrls.length) {
        originalUrl = availableUrls[i].uri;
      }

      events.push({
        title: item.title || "Unknown Event",
        summary: item.summary || "",
        source: item.source || "Google Search",
        publishedTime: item.publishedTime || new Date().toISOString(),
        retrievedTime: new Date().toISOString(),
        companies: item.companies || [],
        sectors: item.sectors || [],
        themes: item.themes || [],
        confidence: item.confidence || 85,
        originalUrl
      });
    }

    return events;
  }

  protected async executeSimulatedFetch(query: string): Promise<NormalizedEvent[]> {
    // Simulated fetch not used for this connector since it's meant to be live
    return [];
  }
}
