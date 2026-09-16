import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import http from "http";
import fs from "fs";
import path from "path";
import {
  executeServerGeminiWithFailover,
  validateGeminiResponse,
  isRetryableGeminiError,
  sanitizeErrorMessage,
  app,
  setAiClientForTesting,
  getAiClientForTesting
} from "../../server";

describe("Phase 1: Server Gemini Failover & Safety Audit", () => {
  let originalAi: any;

  beforeEach(() => {
    originalAi = getAiClientForTesting();
  });

  afterEach(() => {
    setAiClientForTesting(originalAi);
    vi.restoreAllMocks();
  });

  // TEST 1: Candidate 1 -> 429, Candidate 2 -> success
  it("TEST 1: Candidate 1 -> 429, Candidate 2 -> success (exactly 2 calls, candidate 2 succeeds, modelUsed = candidate 2)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            const err: any = new Error("Rate limit exceeded: Quota limit 429");
            err.status = 429;
            throw err;
          }
          return {
            text: JSON.stringify({ executiveSummary: "Valid intelligence summary" }),
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: JSON.stringify({ executiveSummary: "Valid intelligence summary" }) }] }
              }
            ]
          };
        })
      }
    };

    const result = await executeServerGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      defaultModel: "gemini-3.6-flash"
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe(calls[1]);
    expect(result.response.text).toContain("Valid intelligence summary");
  });

  // TEST 2: Candidate 1 -> RESOURCE_EXHAUSTED, Candidate 2 -> success
  it("TEST 2: Candidate 1 -> RESOURCE_EXHAUSTED, Candidate 2 -> success (fallback succeeds)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            throw new Error("Resource exhausted: RESOURCE_EXHAUSTED details: Quota limit per minute exceeded");
          }
          return {
            text: "Valid content from model 2",
            candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Valid content from model 2" }] } }]
          };
        })
      }
    };

    const result = await executeServerGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      defaultModel: "gemini-3.6-flash"
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe(calls[1]);
    expect(result.response.text).toBe("Valid content from model 2");
  });

  // TEST 3: Candidate 1 -> fetch failed / transient network error, Candidate 2 -> success
  it("TEST 3: Candidate 1 -> fetch failed / transient network error, Candidate 2 -> success (fallback succeeds)", async () => {
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
            text: "Valid output after network recovery",
            candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Valid output after network recovery" }] } }]
          };
        })
      }
    };

    const result = await executeServerGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      defaultModel: "gemini-3.6-flash"
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe(calls[1]);
  });

  // TEST 4: Candidate 1 -> 503, Candidate 2 -> success
  it("TEST 4: Candidate 1 -> 503, Candidate 2 -> success (fallback succeeds)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            const err: any = new Error("503 Service Unavailable: High load");
            err.status = 503;
            throw err;
          }
          return {
            text: "Valid output after 503 failover",
            candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Valid output after 503 failover" }] } }]
          };
        })
      }
    };

    const result = await executeServerGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      defaultModel: "gemini-3.6-flash"
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe(calls[1]);
  });

  // TEST 5: Candidate 1 -> 500, Candidate 2 -> success
  it("TEST 5: Candidate 1 -> 500, Candidate 2 -> success (fallback succeeds)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            const err: any = new Error("500 Internal Server Error: An unexpected backend error occurred");
            err.status = 500;
            throw err;
          }
          return {
            text: "Valid output after 500 failover",
            candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Valid output after 500 failover" }] } }]
          };
        })
      }
    };

    const result = await executeServerGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      defaultModel: "gemini-3.6-flash"
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe(calls[1]);
  });

  // TEST 6: Candidate 1 -> 401
  it("TEST 6: Candidate 1 -> 401 (no fallback call, error terminates immediately)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          const err: any = new Error("401 Unauthorized: API key invalid");
          err.status = 401;
          throw err;
        })
      }
    };

    await expect(
      executeServerGeminiWithFailover(mockAiClient, {
        contents: "test prompt",
        defaultModel: "gemini-3.6-flash"
      })
    ).rejects.toThrow(/401/);

    expect(calls.length).toBe(1);
  });

  // TEST 7: Candidate 1 -> 400 / INVALID_ARGUMENT
  it("TEST 7: Candidate 1 -> 400 / INVALID_ARGUMENT (no fallback call, error terminates immediately)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          const err: any = new Error("INVALID_ARGUMENT: contents parameter cannot be empty");
          err.status = 400;
          throw err;
        })
      }
    };

    await expect(
      executeServerGeminiWithFailover(mockAiClient, {
        contents: "test prompt",
        defaultModel: "gemini-3.6-flash"
      })
    ).rejects.toThrow(/INVALID_ARGUMENT/);

    expect(calls.length).toBe(1);
  });

  // TEST 8: Candidate 1 -> HTTP 200 but empty text, Candidate 2 -> valid text
  it("TEST 8: Candidate 1 -> HTTP 200 but empty text, Candidate 2 -> valid text (fallback to candidate 2)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            return {
              text: "",
              candidates: [{ finishReason: "STOP", content: { parts: [{ text: "   " }] } }]
            };
          }
          return {
            text: "Valid content from candidate 2",
            candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Valid content from candidate 2" }] } }]
          };
        })
      }
    };

    const result = await executeServerGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      defaultModel: "gemini-3.6-flash"
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe(calls[1]);
    expect(result.response.text).toBe("Valid content from candidate 2");
  });

  // TEST 9: Candidate 1 -> HTTP 200 with SAFETY finish reason / unusable output, Candidate 2 -> valid text
  it("TEST 9: Candidate 1 -> HTTP 200 with SAFETY finish reason / unusable output, Candidate 2 -> valid text (fallback)", async () => {
    const calls: string[] = [];
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async ({ model }: { model: string }) => {
          calls.push(model);
          if (calls.length === 1) {
            return {
              candidates: [{ finishReason: "SAFETY", content: { parts: [] } }]
            };
          }
          return {
            text: "Valid sanitized content from model 2",
            candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Valid sanitized content from model 2" }] } }]
          };
        })
      }
    };

    const result = await executeServerGeminiWithFailover(mockAiClient, {
      contents: "test prompt",
      defaultModel: "gemini-3.6-flash"
    });

    expect(calls.length).toBe(2);
    expect(result.modelUsed).toBe(calls[1]);
    expect(result.response.text).toBe("Valid sanitized content from model 2");
  });

  // TEST 10: All candidates fail with retryable errors
  it("TEST 10: All candidates fail with retryable errors (bounded number of attempts, final error thrown, no infinite loop)", async () => {
    let attempts = 0;
    const mockAiClient: any = {
      models: {
        generateContent: vi.fn(async () => {
          attempts++;
          const err: any = new Error("429 Too Many Requests");
          err.status = 429;
          throw err;
        })
      }
    };

    await expect(
      executeServerGeminiWithFailover(mockAiClient, {
        contents: "test prompt",
        defaultModel: "gemini-3.6-flash"
      })
    ).rejects.toThrow(/429/);

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(attempts).toBeLessThanOrEqual(6); // Bounded by unique candidate models length
  });

  // TEST 11: Error logging sanitization
  it("TEST 11: Error logging sanitization (fake API keys and credentials are fully redacted)", () => {
    const fakeKey = "AIza" + "_SYNTHETIC_TEST_NONCE_0000000000000";
    const rawError = `Failed request to https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${fakeKey} with Authorization: Bearer secret_token_xyz_12345678`;

    const sanitized = sanitizeErrorMessage(rawError);

    expect(sanitized).not.toContain(fakeKey);
    expect(sanitized).not.toContain("secret_token_xyz_12345678");
    expect(sanitized).toMatch(/\[REDACTED_KEY\]|\[REDACTED_AIZA_KEY\]/);
  });

  // Helper validation tests
  it("validateGeminiResponse correctly identifies invalid responses", () => {
    expect(validateGeminiResponse(null).isValid).toBe(false);
    expect(validateGeminiResponse({}).isValid).toBe(false);
    expect(validateGeminiResponse({ candidates: [] }).isValid).toBe(false);
    expect(validateGeminiResponse({ candidates: [{ finishReason: "SAFETY" }] }).isValid).toBe(false);
    expect(validateGeminiResponse({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "" }] } }] }).isValid).toBe(false);
    expect(validateGeminiResponse({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Valid text" }] } }] }).isValid).toBe(true);
  });

  it("isRetryableGeminiError correctly separates permanent from transient failures", () => {
    expect(isRetryableGeminiError(new Error("401 Unauthorized"))).toBe(false);
    expect(isRetryableGeminiError(new Error("PERMISSION_DENIED: User lacks access"))).toBe(false);
    expect(isRetryableGeminiError(new Error("INVALID_ARGUMENT: Prompt exceeds context"))).toBe(false);
    expect(isRetryableGeminiError({ status: 400, message: "Bad Request" })).toBe(false);

    expect(isRetryableGeminiError({ status: 429, message: "Rate limit" })).toBe(true);
    expect(isRetryableGeminiError({ status: 503, message: "Service unavailable" })).toBe(true);
    expect(isRetryableGeminiError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableGeminiError({ code: "ECONNRESET", message: "Connection reset" })).toBe(true);
    expect(isRetryableGeminiError({ isUnusableResponse: true, message: "UNUSABLE_RESPONSE: empty text" })).toBe(true);
  });

  // COMPANY INTELLIGENCE TEST: Simulate all Gemini candidates failing
  it("COMPANY INTELLIGENCE TEST: when all Gemini candidates fail, no fabricated equity report is returned, no fake confidenceScore, no write to cache", async () => {
    // 1. Mock aiClient with failing generateContent
    const failingAiClient: any = {
      models: {
        generateContent: vi.fn(async () => {
          const err: any = new Error("429 Quota Exceeded");
          err.status = 429;
          throw err;
        })
      }
    };
    setAiClientForTesting(failingAiClient);

    // 2. Start temporary HTTP server on random port
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const cacheFile = path.join(process.cwd(), "premium_reports_cache.json");
    const cacheExistedBefore = fs.existsSync(cacheFile);
    const mtimeBefore = cacheExistedBefore ? fs.statSync(cacheFile).mtimeMs : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/company/intelligence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "TCS", force: true })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      // MANDATE 1: No fabricated equity report is returned
      expect(data.report.executiveSummary).toContain("currently unavailable");
      expect(data.report.executiveSummary).not.toContain("Athena's quantitative appraisal");
      expect(data.report.bullCase).toContain("unavailable");
      expect(data.report.bearCase).toContain("unavailable");

      // MANDATE 2: No fake confidenceScore is generated
      expect(data.report.confidenceScore).toBeUndefined();

      // MANDATE 3: Response is explicitly marked unavailable / degraded
      expect(data.status).toBe("degraded");
      expect(data.aiGenerated).toBe(false);
      expect(data.diagnostic.source).toBe("Fallback");
      expect(data.diagnostic.degraded).toBe(true);

      // MANDATE 4: No fake Gemini model attribution
      expect(data.model).toBe("offline");
      expect(data.model).not.toContain("gemini");

      // MANDATE 5: No write occurs to premium_reports_cache.json
      if (cacheExistedBefore) {
        const mtimeAfter = fs.statSync(cacheFile).mtimeMs;
        expect(mtimeAfter).toBe(mtimeBefore);
      } else {
        expect(fs.existsSync(cacheFile)).toBe(false);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
