import { GoogleGenAI } from "@google/genai";
import { sanitizeErrorMessage } from "../news/AI/AISanitizer";
import { executeGeminiWithFailover } from "../news/AI/GeminiExecutor";

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

const VALID_INTENTS: Intent[] = [
  "Company Research",
  "Market Research",
  "Sector Research",
  "News Search",
  "Government Policy",
  "RBI",
  "SEBI",
  "Earnings",
  "Financial Results",
  "Comparison",
  "Opportunity Discovery",
  "Risk Analysis",
  "Timeline",
  "General Finance",
  "Unknown"
];

export class QueryPlanner {
  constructor(private ai: GoogleGenAI | null) {}

  public setAIClient(client: GoogleGenAI | null) {
    this.ai = client;
  }

  async planQuery(query: string, history: any[] = []): Promise<QueryPlan> {
    if (!this.ai) {
      return this.safeFallbackPlan("Offline mode fallback plan.");
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

      const execution = await executeGeminiWithFailover<QueryPlan>(this.ai, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
        callerName: "QueryPlanner",
        validateOutput: (text: string) => {
          try {
            const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
            const parsed = JSON.parse(cleaned);

            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              return { isValid: false, reason: "QueryPlan output is not a JSON object" };
            }

            if (typeof parsed.intent !== "string" || !parsed.intent.trim()) {
              return { isValid: false, reason: "Missing or empty intent" };
            }

            const rawIntent = parsed.intent.trim();
            const matchedIntent = VALID_INTENTS.find((i) => i.toLowerCase() === rawIntent.toLowerCase()) || "Unknown";

            if (
              typeof parsed.requiresGoogleSearch !== "boolean" ||
              typeof parsed.requiresKnowledgeGraph !== "boolean" ||
              typeof parsed.requiresCompanyKnowledge !== "boolean" ||
              typeof parsed.requiresEventMemory !== "boolean" ||
              typeof parsed.requiresMCPConnectors !== "boolean"
            ) {
              return { isValid: false, reason: "Missing or non-boolean data source requirements in QueryPlan" };
            }

            const rationale = typeof parsed.rationale === "string" && parsed.rationale.trim()
              ? parsed.rationale.trim()
              : "AI-derived query plan.";

            return {
              isValid: true,
              data: {
                intent: matchedIntent,
                requiresGoogleSearch: parsed.requiresGoogleSearch,
                requiresKnowledgeGraph: parsed.requiresKnowledgeGraph,
                requiresCompanyKnowledge: parsed.requiresCompanyKnowledge,
                requiresEventMemory: parsed.requiresEventMemory,
                requiresMCPConnectors: parsed.requiresMCPConnectors,
                rationale
              }
            };
          } catch (err: any) {
            return { isValid: false, reason: `Failed to parse QueryPlan JSON: ${sanitizeErrorMessage(err)}` };
          }
        }
      });

      return execution.data || this.safeFallbackPlan("Fallback after execution returned no plan data.");
    } catch (error) {
      console.warn("QueryPlanner Error: " + sanitizeErrorMessage(error));
      return this.safeFallbackPlan("Failed to execute AI plan, falling back to safe deterministic sources.");
    }
  }

  private safeFallbackPlan(rationale: string): QueryPlan {
    return {
      intent: "Unknown",
      requiresGoogleSearch: false,
      requiresKnowledgeGraph: true,
      requiresCompanyKnowledge: true,
      requiresEventMemory: true,
      requiresMCPConnectors: false,
      rationale
    };
  }
}
