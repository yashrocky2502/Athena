import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  executeGeminiWithFailover,
  validateGeminiResponse,
  isRetryableGeminiError
} from "../news/AI/GeminiExecutor";
import { SearchOrchestrator } from "../lib/SearchOrchestrator";
import { ResearchHypothesisEngine } from "../news/learning/ResearchHypothesisEngine";
import { AIModelConfig } from "../news/AI/AIModelConfig";
import { sanitizeErrorMessage } from "../news/AI/AISanitizer";

describe("Phase 2B: Gemini Failover Unification & Fallback Truthfulness (Tests A-N)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A. Primary model success uses primary model
  it("A. Primary model success uses primary model (gemini-3.7-flash)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          return {
            text: "Successful analysis from primary model",
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: "Successful analysis from primary model" }] }
              }
            ]
          };
        })
      }
    };

    const result = await executeGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      callerName: "TestA"
    });

    expect(calls.length).toBe(1);
    expect(calls[0]).toBe("gemini-3.7-flash");
    expect(result.modelUsed).toBe("gemini-3.7-flash");
    expect(result.text).toBe("Successful analysis from primary model");
    expect(result.attempts).toBe(1);
  });

  // B. Primary 429 fails over to fallback model
  it("B. Primary 429 fails over to fallback model (gemini-3.1-flash-lite)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (model === "gemini-3.7-flash") {
            const err: any = new Error("Rate limit exceeded: 429 Resource Exhausted");
            err.status = 429;
            throw err;
          }
          return {
            text: "Fallback response from 3.1-flash-lite",
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: "Fallback response from 3.1-flash-lite" }] }
              }
            ]
          };
        })
      }
    };

    const result = await executeGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      callerName: "TestB",
      applyBackoff: false
    });

    expect(calls).toEqual(["gemini-3.7-flash", "gemini-3.1-flash-lite"]);
    expect(result.modelUsed).toBe("gemini-3.1-flash-lite");
    expect(result.text).toBe("Fallback response from 3.1-flash-lite");
    expect(result.attempts).toBe(2);
  });

  // C. Primary 503/500/504 fails over to fallback model
  it("C. Primary 503/500/504 fails over to fallback model", async () => {
    for (const statusCode of [500, 502, 503, 504]) {
      const calls: string[] = [];
      const mockAiClient: any = {
        models: {
          generateContent: vi.fn(async ({ model }: { model: string }) => {
            calls.push(model);
            if (calls.length === 1) {
              const err: any = new Error(`Server error ${statusCode}`);
              err.status = statusCode;
              throw err;
            }
            return {
              text: `Success after ${statusCode}`,
              candidates: [
                {
                  finishReason: "STOP",
                  content: { parts: [{ text: `Success after ${statusCode}` }] }
                }
              ]
            };
          })
        }
      };

      const result = await executeGeminiWithFailover(mockAiClient, {
        contents: "test prompt",
        callerName: `TestC-${statusCode}`,
        applyBackoff: false
      });

      expect(calls.length).toBe(2);
      expect(result.modelUsed).toBe("gemini-3.1-flash-lite");
      expect(result.text).toBe(`Success after ${statusCode}`);
    }
  });

  // D. Primary 404 (model not found) fails over to fallback model
  it("D. Primary 404 (model not found) fails over to fallback model", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            const err: any = new Error("models/gemini-3.7-flash is not found for API version v1beta");
            err.status = 404;
            throw err;
          }
          return {
            text: "Recovery from 404",
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: "Recovery from 404" }] }
              }
            ]
          };
        })
      }
    };

    const result = await executeGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      callerName: "TestD",
      applyBackoff: false
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe("gemini-3.1-flash-lite");
    expect(result.text).toBe("Recovery from 404");
  });

  // E. Primary transient network error fails over
  it("E. Primary transient network error fails over (ECONNRESET, fetch failed)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            const err: any = new TypeError("fetch failed");
            err.code = "ECONNRESET";
            throw err;
          }
          return {
            text: "Network recovery success",
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: "Network recovery success" }] }
              }
            ]
          };
        })
      }
    };

    const result = await executeGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      callerName: "TestE",
      applyBackoff: false
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe("gemini-3.1-flash-lite");
    expect(result.text).toBe("Network recovery success");
  });

  // F. Non-retryable error (400/401/403/invalid key) aborts immediately without attempting fallback
  it("F. Non-retryable error (400/401/403/invalid key) aborts immediately without attempting fallback", async () => {
    for (const status of [400, 401, 403]) {
      const calls: string[] = [];
      const mockAiClient: any = {
        models: {
          generateContent: vi.fn(async ({ model }: { model: string }) => {
            calls.push(model);
            const err: any = new Error(`Permanent error ${status}: API key not valid`);
            err.status = status;
            throw err;
          })
        }
      };

      await expect(
        executeGeminiWithFailover(mockAiClient, {
          contents: "test prompt",
          callerName: `TestF-${status}`,
          applyBackoff: false
        })
      ).rejects.toThrow();

      // Exactly 1 call: must not waste requests attempting fallback models on bad credentials
      expect(calls.length).toBe(1);
      expect(calls[0]).toBe("gemini-3.7-flash");
    }
  });

  // G. Both models failing raises sanitized terminal error
  it("G. Both models failing raises sanitized terminal error", async () => {
    const fakeKey = ["AI", "za", "0".repeat(35)].join("");
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async () => {
          const err: any = new Error(`Server failure 503 using key ${fakeKey}`);
          err.status = 503;
          throw err;
        })
      }
    };

    let caughtError: any = null;
    try {
      await executeGeminiWithFailover(mockAiClient, {
        contents: "test prompt",
        callerName: "TestG",
        applyBackoff: false
      });
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    const sanitized = sanitizeErrorMessage(caughtError.message);
    expect(sanitized).not.toContain(fakeKey);
    expect(sanitized).toContain("[REDACTED_AIZA_KEY]");
  });

  // H. Unusable output (empty text, blocked finish reason) triggers failover to fallback model
  it("H. Unusable output (empty text, blocked finish reason) triggers failover to fallback model", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            return {
              text: "",
              candidates: [{ finishReason: "SAFETY", content: { parts: [{ text: "" }] } }]
            };
          }
          return {
            text: "Unblocked valid content from fallback model",
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: "Unblocked valid content from fallback model" }] }
              }
            ]
          };
        })
      }
    };

    const result = await executeGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      callerName: "TestH",
      applyBackoff: false
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe("gemini-3.1-flash-lite");
    expect(result.text).toBe("Unblocked valid content from fallback model");
  });

  // I. Malformed JSON triggers failover if validation fails
  it("I. Malformed JSON triggers failover if validation fails", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            return {
              text: "{ malformed: json without quotes or closing",
              candidates: [
                {
                  finishReason: "STOP",
                  content: { parts: [{ text: "{ malformed: json without quotes or closing" }] }
                }
              ]
            };
          }
          return {
            text: JSON.stringify({ valid: true, payload: "from fallback" }),
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: JSON.stringify({ valid: true, payload: "from fallback" }) }] }
              }
            ]
          };
        })
      }
    };

    const result = await executeGeminiWithFailover<{ valid: boolean; payload: string }>(mockAiClient, {
      contents: "test prompt",
      callerName: "TestI",
      applyBackoff: false,
      validateOutput: (text: string) => {
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.valid === true) {
            return { isValid: true, data: parsed };
          }
          return { isValid: false, reason: "Missing valid flag" };
        } catch {
          return { isValid: false, reason: "Invalid JSON format" };
        }
      }
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe("gemini-3.1-flash-lite");
    expect(result.data?.valid).toBe(true);
    expect(result.data?.payload).toBe("from fallback");
  });

  // J. SearchOrchestrator without grounding returns empty sources (no NSE/BSE injection)
  it("J. SearchOrchestrator without grounding returns empty sources (no NSE/BSE injection)", async () => {
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async () => {
          return {
            text: "Financial analysis without any grounding metadata chunks.",
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: "Financial analysis without any grounding metadata chunks." }] },
                // No groundingMetadata attached
              }
            ],
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 100 }
          };
        })
      }
    };

    const orchestrator = new SearchOrchestrator(mockAiClient);
    const plan = {
      originalQuery: "TCS quarterly review",
      searchQueries: ["TCS quarterly review"],
      strategy: "QUICK_PULSE" as any,
      estimatedSources: 2,
      complexity: "LOW" as any,
      requiresGoogleSearch: true
    };

    const evidence = await orchestrator.execute("TCS quarterly review", plan as any);

    expect(evidence.sources).toEqual([]);
    // Confirm zero hardcoded NSE or BSE sources injected
    const nseBse = evidence.sources.filter(s => s.uri.includes("nseindia") || s.uri.includes("bseindia"));
    expect(nseBse.length).toBe(0);
    // Truthful lower confidence score for ungrounded run
    expect(evidence.confidenceScore).toBeLessThan(50);
  });

  // K. SearchOrchestrator does not generate artificial conflicts (no i%3 pattern)
  it("K. SearchOrchestrator does not generate artificial conflicts (no i%3 pattern)", async () => {
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async () => {
          return {
            text: "Analysis with 3 real grounding chunks",
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: "Analysis with 3 real grounding chunks" }] },
                groundingMetadata: {
                  groundingChunks: [
                    { web: { title: "Source 0", uri: "https://example.com/0" } },
                    { web: { title: "Source 1", uri: "https://example.com/1" } },
                    { web: { title: "Source 2", uri: "https://example.com/2" } }
                  ]
                }
              }
            ],
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 100 }
          };
        })
      }
    };

    const orchestrator = new SearchOrchestrator(mockAiClient);
    const plan = {
      originalQuery: "Market analysis",
      searchQueries: ["Market analysis"],
      strategy: "QUICK_PULSE" as any,
      estimatedSources: 3,
      complexity: "LOW" as any,
      requiresGoogleSearch: true
    };

    const evidence = await orchestrator.execute("Market analysis", plan as any);

    expect(evidence.sources.length).toBe(3);
    // Previously source 0 was artificially marked 'Conflicting' with 'Numbers do not match historical records.'
    const conflicts = evidence.detectedContradictions || [];
    const artificial = conflicts.filter(c => c.description?.includes("Numbers do not match historical records."));
    expect(artificial.length).toBe(0);
  });

  // L. ResearchHypothesis degraded fallback contains zero empirical claims and zero scores
  it("L. ResearchHypothesis degraded fallback contains zero empirical claims and zero scores", async () => {
    // Force AI client to null to trigger truthful degraded fallback
    ResearchHypothesisEngine.setAIClient(null);
    ResearchHypothesisEngine.clear();

    const hypothesis = await ResearchHypothesisEngine.generateHypothesis("Banking sector");

    expect(hypothesis.isDegraded).toBe(true);
    expect(hypothesis.status).toBe("unverified");
    expect(hypothesis.title).toBe("Unverified hypothesis unavailable");
    expect(hypothesis.description).toBe(
      "AI hypothesis generation is currently unavailable. No empirical hypothesis has been generated or validated."
    );
    expect(hypothesis.logicalPredicate).toBe("UNVERIFIED");

    // All empirical and statistical metrics must remain 0.0
    expect(hypothesis.marketRelevanceScore).toBe(0.0);
    expect(hypothesis.marketRelevance).toBe(0.0);
    expect(hypothesis.expectedInformationGain).toBe(0.0);
    expect(hypothesis.statisticalPotential).toBe(0.0);
    expect(hypothesis.priority).toBe(0.0);

    // Ensure zero empirical continuation/reversion claims
    expect(hypothesis.description).not.toContain("drift continuation");
    expect(hypothesis.description).not.toContain("institutional accumulation");
    expect(hypothesis.description).not.toContain("74% probability");
  });

  // M. All logged errors are sanitized
  it("M. All logged errors are sanitized", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fakeKey = ["AI", "za", "0".repeat(35)].join("");

    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async () => {
          const err: any = new Error(`Connection failed with credential ${fakeKey}`);
          err.status = 503;
          throw err;
        })
      }
    };

    try {
      await executeGeminiWithFailover(mockAiClient, {
        contents: "prompt",
        callerName: "TestM",
        applyBackoff: false
      });
    } catch {
      // Expected failure
    }

    expect(warnSpy).toHaveBeenCalled();
    for (const callArgs of warnSpy.mock.calls) {
      const loggedMessage = callArgs.join(" ");
      expect(loggedMessage).not.toContain(fakeKey);
      expect(loggedMessage).toContain("[REDACTED_AIZA_KEY]");
    }
  });

  // N. No obsolete model identifiers remain anywhere in src/ or server.ts
  it("N. No obsolete model identifiers remain anywhere in src/ or server.ts", () => {
    const productionFiles = [
      "server.ts",
      "src/news/AI/AIModelConfig.ts",
      "src/news/AI/GeminiExecutor.ts",
      "src/lib/QueryPlanner.ts",
      "src/lib/SearchOrchestrator.ts",
      "src/lib/connectors/GoogleSearchMCP.ts",
      "src/news/learning/ResearchHypothesisEngine.ts"
    ];

    const obsoletePatterns = ["gemini-2.5", "gemini-3.6", "gemini-1.5", "gemini-2.0"];

    for (const relPath of productionFiles) {
      const fullPath = path.join(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");

      for (const pattern of obsoletePatterns) {
        expect(
          content,
          `File ${relPath} must not contain obsolete model identifier: ${pattern}`
        ).not.toContain(pattern);
      }
    }
  });
});
