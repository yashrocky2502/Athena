import { GoogleGenAI } from "@google/genai";

export type Intent = 
  | "Company Research"
  | "Market Research"
  | "Sector Research"
  | "News Search"
  | "Government Policy"
  | "RBI"
  | "SEBI"
  | "Earnings"
  | "Financial Results"
  | "Comparison"
  | "Opportunity Discovery"
  | "Risk Analysis"
  | "Timeline"
  | "General Finance"
  | "Unknown";

export interface QueryPlan {
  intent: Intent;
  requiresGoogleSearch: boolean;
  requiresKnowledgeGraph: boolean;
  requiresCompanyKnowledge: boolean;
  requiresEventMemory: boolean;
  requiresMCPConnectors: boolean;
  rationale: string;
}

export class QueryPlanner {
  constructor(private ai: GoogleGenAI | null) {}

  async planQuery(query: string, history: any[] = []): Promise<QueryPlan> {
    if (!this.ai) {
      // Fallback plan if offline
      return {
        intent: "Unknown",
        requiresGoogleSearch: false,
        requiresKnowledgeGraph: true,
        requiresCompanyKnowledge: true,
        requiresEventMemory: true,
        requiresMCPConnectors: false,
        rationale: "Offline mode fallback plan."
      };
    }

    try {
      const prompt = `You are the Athena Query Planner.
Analyze this user query: "${query}"

Conversation context:
${JSON.stringify(history)}

Detect the intent from the following list: Company Research, Market Research, Sector Research, News Search, Government Policy, RBI, SEBI, Earnings, Financial Results, Comparison, Opportunity Discovery, Risk Analysis, Timeline, General Finance, Unknown.

Also determine which data sources are required (boolean):
- googleSearch: Requires latest news, real-time prices, or external web data not available internally.
- knowledgeGraph: Requires analyzing relationships between entities, sectors, and themes.
- companyKnowledge: Requires deep analysis of a specific company's fundamentals.
- eventMemory: Requires checking recent market events or historical timelines.
- mcpConnectors: Requires connecting to specific external APIs or databases.

Return ONLY a valid JSON object with the following schema:
{
  "intent": "String",
  "requiresGoogleSearch": true/false,
  "requiresKnowledgeGraph": true/false,
  "requiresCompanyKnowledge": true/false,
  "requiresEventMemory": true/false,
  "requiresMCPConnectors": true/false,
  "rationale": "Short explanation of why these sources were chosen."
}`;

      const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-2.5-flash"];
      let response: any = null;
      let lastErr: any = null;

      for (const modelCandidate of candidateModels) {
        try {
          response = await this.ai.models.generateContent({
            model: modelCandidate,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            }
          });
          if (response) break;
        } catch (mErr: any) {
          lastErr = mErr;
          const msg = String(mErr?.message || mErr);
          if (msg.includes("429") || msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED")) {
            console.warn(`[QueryPlanner] Model ${modelCandidate} quota exceeded, trying candidate failover...`);
            continue;
          }
          throw mErr;
        }
      }

      if (!response) {
        throw lastErr || new Error("All candidate models failed in QueryPlanner");
      }

      if (!response.text) throw new Error("Empty response from AI");
      const cleaned = response.text.replace(/```json\n|\n```|```/g, "").trim();
      const plan = JSON.parse(cleaned) as QueryPlan;
      return plan;
    } catch (error) {
      console.log("QueryPlanner Error:", error);
      return {
        intent: "Unknown",
        requiresGoogleSearch: true,
        requiresKnowledgeGraph: true,
        requiresCompanyKnowledge: true,
        requiresEventMemory: true,
        requiresMCPConnectors: false,
        rationale: "Failed to parse AI plan, falling back to all sources."
      };
    }
  }
}
