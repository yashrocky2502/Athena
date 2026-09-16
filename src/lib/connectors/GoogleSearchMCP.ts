import { BaseMCP } from "./BaseMCP";
import { NormalizedEvent } from "../../types";
import { GoogleGenAI } from "@google/genai";
import { sanitizeErrorMessage } from "../../news/AI/AISanitizer";
import { executeGeminiWithFailover } from "../../news/AI/GeminiExecutor";

export class GoogleSearchMCP extends BaseMCP {
  private ai: GoogleGenAI | null;

  constructor(ai: GoogleGenAI | null) {
    super("Google Search Grounding", true);
    this.ai = ai;
  }

  public setAIClient(client: GoogleGenAI | null) {
    this.ai = client;
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

    try {
      const execution = await executeGeminiWithFailover<NormalizedEvent[]>(this.ai, {
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }] as any,
          responseMimeType: "application/json"
        },
        callerName: "GoogleSearchMCP",
        validateOutput: (text: string, rawResponse: any) => {
          try {
            const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
            const parsed = JSON.parse(cleaned);

            if (!Array.isArray(parsed)) {
              return { isValid: false, reason: "GoogleSearchMCP output is not a JSON array" };
            }

            // Extract grounding chunks if available
            const rawChunks = rawResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const availableUrls: string[] = [];
            if (Array.isArray(rawChunks)) {
              rawChunks.forEach((chunk: any) => {
                if (chunk?.web?.uri && typeof chunk.web.uri === "string") {
                  availableUrls.push(chunk.web.uri);
                }
              });
            }

            const events: NormalizedEvent[] = [];
            for (let i = 0; i < parsed.length; i++) {
              const item = parsed[i];
              if (!item || typeof item !== "object") {
                return { isValid: false, reason: `Item at index ${i} is not a valid object` };
              }
              if (typeof item.title !== "string" || !item.title.trim()) {
                return { isValid: false, reason: `Item at index ${i} is missing a required title` };
              }

              // Grounding URL rule:
              // If grounding chunk exists, use chunk URL.
              // If grounding URL does not exist, do not fabricate specific evidence URLs;
              // leave originalUrl empty or generic search reference without false institutional attribution.
              let originalUrl = "";
              if (i < availableUrls.length) {
                originalUrl = availableUrls[i];
              }

              events.push({
                title: item.title.trim(),
                summary: typeof item.summary === "string" ? item.summary.trim() : "",
                source: typeof item.source === "string" && item.source.trim() ? item.source.trim() : "Google Search",
                publishedTime: typeof item.publishedTime === "string" && item.publishedTime.trim()
                  ? item.publishedTime.trim()
                  : new Date().toISOString(),
                retrievedTime: new Date().toISOString(),
                companies: Array.isArray(item.companies) ? item.companies.filter((c: any) => typeof c === "string") : [],
                sectors: Array.isArray(item.sectors) ? item.sectors.filter((s: any) => typeof s === "string") : [],
                themes: Array.isArray(item.themes) ? item.themes.filter((t: any) => typeof t === "string") : [],
                confidence: typeof item.confidence === "number" ? item.confidence : 85,
                originalUrl
              });
            }

            return { isValid: true, data: events };
          } catch (err: any) {
            return { isValid: false, reason: `Failed to parse GoogleSearchMCP JSON array: ${sanitizeErrorMessage(err)}` };
          }
        }
      });

      return execution.data || [];
    } catch (err: any) {
      console.warn(`[GoogleSearchMCP] Live fetch failed: ${sanitizeErrorMessage(err)}`);
      throw err;
    }
  }

  protected async executeSimulatedFetch(query: string): Promise<NormalizedEvent[]> {
    // Simulated fetch not used for this connector since it's meant to be live
    return [];
  }
}
