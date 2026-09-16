import { GoogleGenAI } from "@google/genai";
import { sanitizeErrorMessage } from "../news/AI/AISanitizer";
import { QueryPlan } from "./QueryPlanner";
import { ContradictionEngine } from "./ContradictionEngine";
import { ReasoningEngine } from "./ReasoningEngine";
import { ConflictRecord, ReasoningGraph } from "../types";
import { executeGeminiWithFailover } from "../news/AI/GeminiExecutor";

export interface EvidencePackage {
  text: string;
  sources: { title: string; uri: string; trustRating?: string; publicationTime?: string; }[];
  plan: QueryPlan;
  executionTime: number;
  confidenceScore: number;
  geminiTokens: number;
  cacheHit: boolean;
  detectedContradictions?: ConflictRecord[];
  reasoningGraph?: ReasoningGraph;
}

export class SearchOrchestrator {
  private cache = new Map<string, EvidencePackage>();
  private contradictionEngine = new ContradictionEngine();
  private reasoningEngine = new ReasoningEngine();

  constructor(private ai: GoogleGenAI | null) {}

  public setAIClient(client: GoogleGenAI | null) {
    this.ai = client;
  }

  async execute(query: string, plan: QueryPlan, history: any[] = []): Promise<EvidencePackage> {
    const startTime = Date.now();
    
    // 1. Check Response Cache
    const cacheKey = JSON.stringify({ query, history });
    if (this.cache.has(cacheKey)) {
      const cachedResponse = this.cache.get(cacheKey)!;
      return {
        ...cachedResponse,
        cacheHit: true,
        executionTime: Date.now() - startTime
      };
    }

    if (!this.ai) {
      return this.offlineFallback(plan, startTime);
    }

    // 2. Fetch required evidence
    // In a full implementation, we'd query KnowledgeGraphEngine, CompanyKnowledgeService, etc. here.
    // For this Athena simulation, we assume Gemini with Google Search handles external evidence.
    let searchResultText = "";
    let sources: any[] = [];
    let promptTokenCount = 0;
    let responseTokenCount = 0;

    const tools = plan.requiresGoogleSearch ? [{ googleSearch: {} }] : [];

    const prompt = `You are Athena AI. Generate a response based on the following query: "${query}"

Context History:
${JSON.stringify(history)}

Internal Plan Intent: ${plan.intent}

CRITICAL INSTRUCTION:
Athena must never guess. If evidence is insufficient, do not fabricate conclusions. 
If you lack data to answer the query confidently:
1. State "Insufficient Verified Evidence" in the What Happened section.
2. Set Confidence to "Low".
3. Lower the Estimated Reading Time.
4. Do not make up facts.

You MUST output your response in EXACTLY this Markdown format:

⚡ Smart Summary

### What Happened
[1-2 sentences. If insufficient evidence, explicitly state "Insufficient Verified Evidence" here.]

### Why It Matters
[1-2 sentences]

### Who Is Affected
[1-2 sentences]

### Risks
[1-2 sentences]

### Confidence
[High/Medium/Low]

### Estimated Reading Time
[X seconds/minutes]

***

## Detailed Analysis
[Provide your detailed expert financial analysis here. Use headings, bullet points, and strong financial terminology. Be precise and structured. If insufficient evidence, explain what data is missing.]
`;

    try {
      const execution = await executeGeminiWithFailover(this.ai, {
        contents: prompt,
        config: {
          tools: tools as any,
        },
        callerName: "SearchOrchestrator"
      });

      const response = execution.response;
      searchResultText = execution.text;
      promptTokenCount = response?.usageMetadata?.promptTokenCount || 0;
      responseTokenCount = response?.usageMetadata?.candidatesTokenCount || 0;

      // Extract Grounding Metadata for Original Sources
      const rawChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (rawChunks && Array.isArray(rawChunks)) {
        rawChunks.forEach((chunk: any) => {
          if (chunk?.web && chunk.web.uri) {
            sources.push({
              title: chunk.web.title || "Web Reference",
              uri: chunk.web.uri,
              trustRating: "High (Google Search)",
              publicationTime: "Recent"
            });
          }
        });
      }

      // CRITICAL: DO NOT manufacture NSE/BSE URLs or fake evidence when grounding metadata is absent.
      // If sources.length === 0, sources remains empty.

      const executionTime = Date.now() - startTime;

      // Construct Evidence Items purely from grounded sources
      const evidenceItems: any[] = sources.map((s, i) => ({
        id: `ev-${i}`,
        title: s.title,
        url: s.uri,
        sourceName: "Google Search Grounding",
        sourceType: "Web",
        publishedTime: s.publicationTime || "Recent",
        retrievedTime: new Date().toISOString(),
        trustScore: 85,
        evidenceType: "News",
        relatedCompanies: [],
        relatedSectors: [],
        relatedEvents: [],
        summary: s.title,
        status: "Verified",
        conflicts: []
      }));

      const detectedContradictions = this.contradictionEngine.detectConflicts(evidenceItems);
      const resolvedConflicts = this.contradictionEngine.resolveConflicts(detectedContradictions, evidenceItems);

      // Truthful confidence scoring:
      // If grounding was requested but zero sources returned, reflect ungrounded status honestly
      let finalConfidence = 70;
      if (sources.length > 0) {
        finalConfidence = plan.requiresGoogleSearch ? 90 : 80;
        if (detectedContradictions.length > 0) {
          finalConfidence -= detectedContradictions.length * 5;
        }
      } else {
        finalConfidence = plan.requiresGoogleSearch ? 35 : 60;
      }

      const reasoningGraph = this.reasoningEngine.generateReasoning(
        query,
        evidenceItems,
        sources,
        finalConfidence
      );

      const result: EvidencePackage = {
        text: searchResultText,
        sources,
        plan,
        executionTime,
        confidenceScore: finalConfidence,
        geminiTokens: promptTokenCount + responseTokenCount,
        cacheHit: false,
        detectedContradictions: resolvedConflicts,
        reasoningGraph
      };

      this.cache.set(cacheKey, result);

      return result;

    } catch (error: any) {
      const msg = String(error?.message || error);
      const isRateLimited = msg.includes("429") || msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("resource_exhausted") || error?.status === 429;
      if (isRateLimited) {
        console.warn("Search Orchestrator Rate Limited / Quota Exceeded");
      } else {
        console.warn("Search Orchestrator Error: " + sanitizeErrorMessage(error));
      }
      return this.offlineFallback(plan, startTime, isRateLimited);
    }
  }

  private offlineFallback(plan: QueryPlan, startTime: number, isRateLimited = false): EvidencePackage {
    const message = isRateLimited 
        ? "The live AI engine is currently rate-limited due to high usage."
        : "The live AI engine is offline.";
    const analysis = isRateLimited
        ? "Please wait a moment before trying again."
        : "Please configure your GEMINI_API_KEY in the platform settings to enable live financial research and the Query Planner.";
    
    return {
      text: `⚡ Smart Summary\n\n### What Happened\n${message}\n\n### Why It Matters\nLive web-grounded analysis cannot be completed without an active API connection.\n\n### Who Is Affected\nSystem Users\n\n### Risks\nData Unavailability\n\n### Confidence\nN/A\n\n### Estimated Reading Time\n10 seconds\n\n***\n\n## Detailed Analysis\n${analysis}`,
      sources: [],
      plan,
      executionTime: Date.now() - startTime,
      confidenceScore: 0,
      geminiTokens: 0,
      cacheHit: false
    };
  }
}
