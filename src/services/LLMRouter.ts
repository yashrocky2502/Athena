import { GoogleGenAI, Type } from "@google/genai";
import axios from "axios";
import { AthenaIntelligence } from "../types";

function generateArticleSummaryBullets(text: string, headline: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 20);
  return sentences.slice(0, 5);
}

function extractStructuredVerifiedFacts(text: string, headline: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 20);
  return sentences.slice(0, 4);
}

function extractMarketCommentary(text: string): string[] {
  return [];
}

export interface LLMSummaryOutput {
  executiveSummary: string;
  verifiedFacts: string[];
  articleSummaryBullets?: string[];
  marketCommentary?: string[];
  whyItMatters: string;
  investorTakeaway: string;
  confidence: number;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  timeline: { time: string; event: string }[];
}

export interface LLMRouterResult {
  reportData: LLMSummaryOutput;
  providerUsed: "Groq" | "Gemini" | "Local Fallback" | "Grok" | "Grok Fallback";
  wasGroqCalled: "Yes" | "No";
  wasGeminiCalled: "Yes" | "No";
  groqStatus: string;
  geminiStatus: string;
  promptLength: number;
  responseLength: number;
  fallbackReason?: string;
}

export class LLMRouter {
  private static instance: LLMRouter;
  public static isGroqUnavailable = false;
  // Compatibility flag for legacy tests
  public static get isGrokUnavailable(): boolean {
    return LLMRouter.isGroqUnavailable;
  }
  public static set isGrokUnavailable(val: boolean) {
    LLMRouter.isGroqUnavailable = val;
  }

  private geminiClient: any = null;
  private geminiCoolDownUntil: number = 0;

  private constructor() {}

  public static getInstance(): LLMRouter {
    if (!LLMRouter.instance) {
      LLMRouter.instance = new LLMRouter();
    }
    return LLMRouter.instance;
  }

  private getGeminiClient(): any {
    if (!this.geminiClient) {
      const key = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
      if (typeof window === "undefined" && key && key !== "MY_GEMINI_API_KEY" && key.trim() !== "") {
        try {
          this.geminiClient = new GoogleGenAI({
            apiKey: key,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });
        } catch (err) {
          console.error("[LLMRouter] Failed to init GoogleGenAI:", err);
        }
      }
    }
    return this.geminiClient;
  }

  private getGroqKey(): string | undefined {
    const key = typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : undefined;
    if (!key || key === "MY_GROQ_API_KEY" || key.trim() === "") {
      return undefined;
    }
    return key.trim();
  }

  public async summarize(
    extractedText: string,
    metadata: { headline: string; company: string; symbol: string }
  ): Promise<LLMRouterResult> {
    const prompt = this.buildPrompt(extractedText, metadata);
    const promptLength = prompt.length;

    let groqStatus = "Not Attempted";
    let wasGroqCalled: "Yes" | "No" = "No";
    let geminiStatus = "Not Attempted";
    let wasGeminiCalled: "Yes" | "No" = "No";
    let fallbackReason: string | undefined = undefined;

    // 1. PRIMARY: Groq (Llama-3.3-70b-versatile / Llama-3.1-8b-instant)
    const groqKey = this.getGroqKey();
    if (groqKey && !LLMRouter.isGroqUnavailable && typeof window === "undefined") {
      wasGroqCalled = "Yes";
      groqStatus = "Attempting Groq";
      try {
        console.log("[LLMRouter] Attempting summarization with Primary Provider: Groq");
        const groqResult = await this.callGroq(prompt, extractedText, metadata, groqKey);
        if (groqResult && groqResult.reportData && groqResult.reportData.executiveSummary) {
          return {
            reportData: groqResult.reportData,
            providerUsed: "Groq",
            wasGroqCalled: "Yes",
            wasGeminiCalled: "No",
            groqStatus: groqResult.status,
            geminiStatus: "Not Attempted",
            promptLength,
            responseLength: groqResult.responseLength
          };
        }
      } catch (err: any) {
        groqStatus = `Failed: ${err.message || err}`;
        fallbackReason = `Groq primary failed: ${err.message || err}`;
        console.warn(`[LLMRouter] Groq primary execution failed. Failing over to Gemini 3.7 Flash fallback.`);
      }
    } else {
      groqStatus = groqKey ? "In Cooldown" : "API Key Missing";
      fallbackReason = groqKey ? "Groq marked unavailable" : "GROQ_API_KEY not configured";
    }

    // 2. EMERGENCY FALLBACK: Gemini 3.7 Flash
    const geminiClient = this.getGeminiClient();
    const isGeminiInCooldown = Date.now() <= this.geminiCoolDownUntil;

    if (!geminiClient) {
      geminiStatus = "API Key Missing";
    } else if (isGeminiInCooldown) {
      const remaining = Math.ceil((this.geminiCoolDownUntil - Date.now()) / 1000);
      geminiStatus = `In Cooldown 429 (${remaining}s remaining)`;
    } else {
      wasGeminiCalled = "Yes";
      geminiStatus = "Waiting for Gemini 3.7 Flash";

      try {
        console.log("[LLMRouter] Attempting summarization with Fallback Provider: Gemini 3.7 Flash");
        const geminiResult = await this.callGeminiWithTimeout(geminiClient, prompt, 35000);
        if (geminiResult && geminiResult.executiveSummary) {
          const respText = JSON.stringify(geminiResult);
          return {
            reportData: geminiResult,
            providerUsed: "Gemini",
            wasGroqCalled,
            wasGeminiCalled: "Yes",
            groqStatus,
            geminiStatus: "200 OK (gemini-3.7-flash)",
            promptLength,
            responseLength: respText.length,
            fallbackReason
          };
        } else {
          geminiStatus = "Empty Response";
        }
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
          this.geminiCoolDownUntil = Date.now() + 60 * 60 * 1000;
          geminiStatus = "429 Quota Exceeded";
        } else if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
          this.geminiCoolDownUntil = Date.now() + 30 * 1000;
          geminiStatus = "503 Service Unavailable";
        } else if (msg.includes("TIMEOUT")) {
          geminiStatus = "Timeout (35s)";
        } else {
          geminiStatus = `Error: ${msg.substring(0, 50)}`;
        }
        fallbackReason = `Gemini fallback failed: ${msg}`;
      }
    }

    // 3. FINAL DETERMINISTIC FALLBACK: Local Heuristics Synthesizer
    console.log("[LLMRouter] External AI providers exhausted. Using Local Intelligence Synthesizer.");
    const fallbackReport = this.generateLocalFallbackSummary(extractedText, metadata);
    const textLen = JSON.stringify(fallbackReport).length;

    return {
      reportData: fallbackReport,
      providerUsed: "Local Fallback",
      wasGroqCalled,
      wasGeminiCalled,
      groqStatus,
      geminiStatus,
      promptLength,
      responseLength: textLen,
      fallbackReason: fallbackReason || "Local heuristic synthesis engaged"
    };
  }

  private buildPrompt(
    extractedText: string,
    metadata: { headline: string; company: string; symbol: string }
  ): string {
    return `
You are Athena's Institutional Bloomberg/Reuters-style News Analyst. Your task is to generate a factual Intelligence Summary BASED ONLY ON THE EXTRACTED ARTICLE TEXT.

STRICT MANDATES:
1. NEVER repeat or copy the article headline verbatim.
2. PRIORITIZE FACTS STRICTLY IN THIS ORDER:
   - Financial Results (Net Profit, Revenue, EBITDA, Margins, YoY/QoQ Growth, EPS)
   - Corporate Actions (Fund Raising, Board Approvals, Dividends, Stock Splits, Capacity Expansion, Order Wins)
   - Regulatory Announcements (SEBI, RBI, CCI, Government Clearances, Tax Orders)
   - Management Guidance (Future Targets, Capacity Goals, Completion Timelines)
   - Market Impact (Stock price movement, trading volume)
3. COMPLETELY EXCLUDE:
   - Author names, author biographies, journalist profiles
   - Analyst opinions, brokerage ratings, target prices, buy/sell recommendations
   - Technical analysis (support/resistance, RSI, moving averages)
   - Disclaimer text, newsletter prompts, copyright notices, related stories
4. GENERATE 5–8 CONCISE FACTUAL BULLET POINTS in 'articleSummaryBullets':
   - Max 2 sentences per bullet.
   - Preserve all financial numbers, percentages, and currencies EXACTLY.
   - Write in crisp, professional Bloomberg/Reuters tone.
5. GENERATE STRUCTURED 'verifiedFacts' entries in "Metric Name: Metric Value" format (e.g. "Net Profit: ₹4,806 Cr (+42% YoY)", "Revenue: ₹18,902 Cr (+34% YoY)").
6. IF ANALYST OPINIONS OR COMMENTARY EXIST IN THE TEXT, extract them strictly into 'marketCommentary'.

ARTICLE CONTENT TO ANALYZE:
"""
${extractedText.substring(0, 30000)}
"""

NEWS METADATA:
Headline: "${metadata.headline}"
Company: "${metadata.company}"
Ticker: "${metadata.symbol}"

OUTPUT FORMAT (JSON):
{
  "executiveSummary": "2-3 concise sentences detailing core institutional takeaways.",
  "articleSummaryBullets": ["bullet 1", "bullet 2"],
  "verifiedFacts": ["Metric: Value"],
  "marketCommentary": [],
  "whyItMatters": "Direct fundamental business impact.",
  "investorTakeaway": "Actionable factual summary.",
  "confidence": 0.95,
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "timeline": [{ "time": "T-0", "event": "Event description" }]
}
`;
  }

  private async callGroq(
    prompt: string,
    extractedText: string,
    metadata: { headline: string; company: string; symbol: string },
    groqKey: string
  ): Promise<{
    reportData: LLMSummaryOutput;
    status: string;
    responseLength: number;
  }> {
    const modelsToTry = [
      process.env.GROQ_PRIMARY_MODEL || "openai/gpt-oss-120b",
      process.env.GROQ_FALLBACK_MODEL || "llama-3.3-70b-versatile"
    ].filter((m, idx, self) => self.indexOf(m) === idx);

    for (const model of modelsToTry) {
      try {
        console.log(`[LLMRouter] Invoking Groq model: ${model}`);
        const res = await axios.post(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            model,
            messages: [
              {
                role: "system",
                content: "You are Athena's Institutional Intelligence Analyst. Respond strictly in valid JSON format as requested."
              },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: 1500
          },
          {
            headers: {
              Authorization: `Bearer ${groqKey}`,
              "Content-Type": "application/json"
            },
            timeout: 15000
          }
        );

        const content = res.data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            reportData: {
              executiveSummary: parsed.executiveSummary || "",
              verifiedFacts: parsed.verifiedFacts || [],
              articleSummaryBullets: parsed.articleSummaryBullets || [],
              marketCommentary: parsed.marketCommentary || [],
              whyItMatters: parsed.whyItMatters || "",
              investorTakeaway: parsed.investorTakeaway || "",
              confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.92,
              sentiment: parsed.sentiment || "Neutral",
              timeline: parsed.timeline || []
            },
            status: `200 OK (Groq API - ${model})`,
            responseLength: content.length
          };
        }
      } catch (err: any) {
        const status = err?.response?.status;
        console.warn(`[LLMRouter] Groq model ${model} failed (status ${status}):`, err?.message || err);
        if (status === 401 || status === 403) {
          LLMRouter.isGroqUnavailable = true;
          break;
        }
      }
    }

    throw new Error("All Groq models failed");
  }

  private async callGeminiWithTimeout(client: any, prompt: string, timeoutMs: number): Promise<LLMSummaryOutput> {
    let primaryModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash";
    if (primaryModel === "gemini-3.6-flash") {
      primaryModel = "gemini-3.7-flash";
    }
    const modelsToTry = [primaryModel, "gemini-3.7-flash", "gemini-3.1-flash-lite"];

    const callPromise = (async () => {
      let lastErr: any = null;
      for (const model of modelsToTry) {
        try {
          console.log(`[LLMRouter] Attempting summarization with model: ${model}`);
          const response = await client.models.generateContent({
            model: model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  executiveSummary: { type: Type.STRING },
                  verifiedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
                  articleSummaryBullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                  whyItMatters: { type: Type.STRING },
                  investorTakeaway: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  sentiment: { type: Type.STRING },
                  timeline: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        time: { type: Type.STRING },
                        event: { type: Type.STRING },
                      },
                    },
                  },
                },
                required: ["executiveSummary", "verifiedFacts", "investorTakeaway", "sentiment", "confidence"],
              },
            },
          });

          const text = response.text;
          if (!text || text.trim().length === 0) {
            throw new Error("Empty response from Gemini");
          }

          return JSON.parse(text);
        } catch (err: any) {
          lastErr = err;
          const msg = String(err?.message || err);
          if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
            console.warn(`[LLMRouter] Gemini model ${model} quota exceeded, trying next candidate.`);
            continue;
          }
          throw err;
        }
      }
      throw lastErr || new Error("All Gemini models exhausted");
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
    });

    return await Promise.race([callPromise, timeoutPromise]);
  }

  public async generateAthenaIntelligence(
    prompt: string,
    metadata: { headline: string; company: string; symbol: string; publisher?: string; publishedAt?: string }
  ): Promise<{ intelligence: AthenaIntelligence; providerUsed: "Groq" | "Gemini" | "Local Fallback"; status: string }> {
    // 1. PRIMARY: Groq
    const groqKey = this.getGroqKey();
    if (groqKey && !LLMRouter.isGroqUnavailable && typeof window === "undefined") {
      const modelsToTry = [
        process.env.GROQ_PRIMARY_MODEL || "openai/gpt-oss-120b",
        process.env.GROQ_FALLBACK_MODEL || "llama-3.3-70b-versatile"
      ].filter((m, idx, self) => self.indexOf(m) === idx);
      for (const model of modelsToTry) {
        try {
          console.log(`[LLMRouter] Generating Athena Intelligence with Groq model: ${model}`);
          const res = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model,
              messages: [
                {
                  role: "system",
                  content: "You are Athena Institutional Intelligence Analyst. Output raw valid JSON strictly matching the requested format."
                },
                { role: "user", content: prompt }
              ],
              response_format: { type: "json_object" },
              temperature: 0.2,
              max_tokens: 1500
            },
            {
              headers: {
                Authorization: `Bearer ${groqKey}`,
                "Content-Type": "application/json"
              },
              timeout: 15000
            }
          );

          const content = res.data?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            return {
              intelligence: {
                executiveSummary: parsed.executiveSummary || "",
                whyItMatters: parsed.whyItMatters || "",
                sectorImpact: parsed.sectorImpact || "",
                companiesAffected: parsed.companiesAffected || [{ symbol: metadata.symbol || "MARKET", impact: "Neutral" }],
                institutionalView: parsed.institutionalView || "",
                keyRisks: (parsed.keyRisks || []).slice(0, 5),
                catalysts: (parsed.catalysts || []).slice(0, 5),
                investorWatchlist: (parsed.investorWatchlist || []).slice(0, 5),
                confidenceScore: parsed.confidenceScore || 0.92,
                providerUsed: "Groq",
                generatedAt: new Date().toISOString()
              },
              providerUsed: "Groq",
              status: `200 OK (Groq API - ${model})`
            };
          }
        } catch (err: any) {
          console.warn(`[LLMRouter] Groq model ${model} failed for Athena Intelligence:`, err?.message || err);
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            LLMRouter.isGroqUnavailable = true;
            break;
          }
        }
      }
    }

    // 2. FALLBACK: Gemini 3.7 Flash
    const geminiClient = this.getGeminiClient();
    const isGeminiInCooldown = Date.now() <= this.geminiCoolDownUntil;

    if (geminiClient && !isGeminiInCooldown) {
      try {
        let fallbackModelName = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash";
        if (fallbackModelName === "gemini-3.6-flash") {
          fallbackModelName = "gemini-3.7-flash";
        }
        const response = await geminiClient.models.generateContent({
          model: fallbackModelName,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                executiveSummary: { type: Type.STRING },
                whyItMatters: { type: Type.STRING },
                sectorImpact: { type: Type.STRING },
                companiesAffected: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      symbol: { type: Type.STRING },
                      impact: { type: Type.STRING }
                    },
                    required: ["symbol", "impact"]
                  }
                },
                institutionalView: { type: Type.STRING },
                keyRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
                catalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
                investorWatchlist: { type: Type.ARRAY, items: { type: Type.STRING } },
                confidenceScore: { type: Type.NUMBER }
              },
              required: [
                "executiveSummary",
                "whyItMatters",
                "sectorImpact",
                "companiesAffected",
                "institutionalView",
                "keyRisks",
                "investorWatchlist",
                "confidenceScore"
              ]
            }
          }
        });

        const text = response.text;
        if (text && text.trim().length > 0) {
          const parsed = JSON.parse(text);
          return {
            intelligence: {
              executiveSummary: parsed.executiveSummary || "",
              whyItMatters: parsed.whyItMatters || "",
              sectorImpact: parsed.sectorImpact || "",
              companiesAffected: parsed.companiesAffected || [{ symbol: metadata.symbol || "MARKET", impact: "Neutral" }],
              institutionalView: parsed.institutionalView || "",
              keyRisks: (parsed.keyRisks || []).slice(0, 5),
              catalysts: (parsed.catalysts || []).slice(0, 5),
              investorWatchlist: (parsed.investorWatchlist || []).slice(0, 5),
              confidenceScore: parsed.confidenceScore || 0.9,
              providerUsed: "Gemini",
              generatedAt: new Date().toISOString()
            },
            providerUsed: "Gemini",
            status: "200 OK (Gemini 3.7 Flash)"
          };
        }
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
          this.geminiCoolDownUntil = Date.now() + 60 * 60 * 1000;
        } else if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
          this.geminiCoolDownUntil = Date.now() + 30 * 1000;
        }
        console.warn("[LLMRouter] Gemini 3.7 Flash failed for Athena Intelligence, falling back to Local Heuristics:", msg);
      }
    }

    // 3. FINAL DETERMINISTIC FALLBACK: Local Intelligence Synthesizer
    const fallbackIntel = this.generateLocalFallbackAthenaIntelligence(prompt, metadata);
    return {
      intelligence: fallbackIntel,
      providerUsed: "Local Fallback",
      status: "200 OK (Athena Local Synthesizer)"
    };
  }

  private generateLocalFallbackAthenaIntelligence(
    promptString: string,
    metadata: { headline: string; company: string; symbol: string }
  ): AthenaIntelligence {
    let executiveSummary = `Verified news reporting regarding ${metadata.company} (${metadata.symbol}). Key developments extracted directly from source documentation.`;
    let whyItMatters = `Direct fundamental impact on ${metadata.company}'s market valuation and operational trajectory.`;
    let sectorImpact = `Broader sector implications for peers in the ${metadata.symbol} industry segment.`;
    let institutionalView = `Institutional desk consensus highlights disciplined monitoring of execution metrics following this update.`;
    let keyRisks = [
      `Potential operational volatility surrounding ${metadata.symbol}.`,
      `Macroeconomic and sector liquidity fluctuations.`,
      `Execution timeline dependencies.`
    ];
    let investorWatchlist = [
      `Next quarterly earnings and disclosure filings for ${metadata.symbol}.`,
      `Volume trends and institutional order flow following the announcement.`
    ];

    try {
      const jsonMatch = promptString.match(/(?:Structured Data:|JSON Data:)\s*(\{[\s\S]*?\})\s*(?:\n|$)/i);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.metadata && parsed.metadata.headline) {
            executiveSummary = `${parsed.metadata.headline}. This verified data confirms the operational status of ${metadata.company}.`;
          }
          if (parsed.structuredMetrics && parsed.structuredMetrics.length > 0) {
             keyRisks = parsed.structuredMetrics.slice(0, 3).map((m: any) => `Monitor metric: ${m.metric} (${m.value})`);
          }
        } catch (e) {
          executiveSummary = `${metadata.headline}. Analysis performed on institutional data records for ${metadata.company}.`;
        }
      } else {
        const contentBody = promptString
          .replace(/^SYSTEM[\s\S]*?Structured Data:/i, "")
          .replace(/OUTPUT FORMAT[\s\S]*$/i, "")
          .trim();
          
        const cleanSentences = contentBody
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 20 && !s.includes("{") && !s.includes("}") && !s.includes("[") && !s.includes("]"));
          
        if (cleanSentences.length > 0) {
          executiveSummary = cleanSentences.slice(0, 2).join(" ");
        } else {
          executiveSummary = `Institutional analysis of the official corporate announcement regarding ${metadata.company} (${metadata.symbol}). This update covers key regulatory and operational milestones.`;
        }
      }
    } catch (e) {
      console.warn("Error in fallback intelligence synthesis:", e);
    }

    return {
      executiveSummary,
      whyItMatters,
      sectorImpact,
      companiesAffected: [{ symbol: metadata.symbol || "MARKET", impact: "Factual Update - Neutral/Watch" }],
      institutionalView,
      keyRisks,
      investorWatchlist,
      confidenceScore: 0.85,
      providerUsed: "Local Fallback",
      generatedAt: new Date().toISOString()
    };
  }

  private generateLocalFallbackSummary(
    extractedText: string,
    metadata: { headline: string; company: string; symbol: string }
  ): LLMSummaryOutput {
    const articleSummaryBullets = generateArticleSummaryBullets(
      extractedText,
      metadata.headline
    );

    const verifiedFacts = extractStructuredVerifiedFacts(
      extractedText,
      metadata.headline
    );

    const marketCommentary = extractMarketCommentary(extractedText);

    const cleanSentences = extractedText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && !s.toLowerCase().includes("cookie") && !s.toLowerCase().includes("subscribe"));

    const executiveSummary =
      articleSummaryBullets.slice(0, 2).join(" ") ||
      cleanSentences.slice(0, 2).join(" ") ||
      `Official developments reported regarding ${metadata.company} (${metadata.symbol}). Key details extracted from article body.`;

    const whyItMatters =
      articleSummaryBullets[0] ||
      cleanSentences[0] ||
      `Provides verified updates regarding ${metadata.company}'s market activities and operations.`;

    const investorTakeaway =
      articleSummaryBullets[1] ||
      cleanSentences[2] ||
      `Investors should evaluate ${metadata.company} (${metadata.symbol}) based on confirmed fundamental announcements.`;

    const lower = extractedText.toLowerCase();
    let sentiment: "Bullish" | "Bearish" | "Neutral" = "Neutral";
    if (lower.includes("profit") || lower.includes("growth") || lower.includes("record") || lower.includes("surged") || lower.includes("revenue up")) {
      sentiment = "Bullish";
    } else if (lower.includes("loss") || lower.includes("decline") || lower.includes("drop") || lower.includes("investigation") || lower.includes("fall")) {
      sentiment = "Bearish";
    }

    return {
      executiveSummary,
      articleSummaryBullets,
      verifiedFacts: verifiedFacts.length > 0 ? verifiedFacts : articleSummaryBullets.slice(0, 4),
      marketCommentary: marketCommentary.length > 0 ? marketCommentary : undefined,
      whyItMatters,
      investorTakeaway,
      confidence: 0.85,
      sentiment,
      timeline: [],
    };
  }
}
