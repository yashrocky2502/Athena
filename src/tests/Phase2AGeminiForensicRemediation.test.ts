import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sanitizeErrorMessage } from "../news/AI/AISanitizer";
import { AIModelConfig } from "../news/AI/AIModelConfig";
import { ResearchHypothesisEngine } from "../news/learning/ResearchHypothesisEngine";
import fs from "fs";
import path from "path";

describe("ATHENA Phase 2A — Gemini Forensic Remediation Suite", () => {
  describe("1. Credential Sanitization (AISanitizer)", () => {
    const originalApiKey = process.env.GEMINI_API_KEY;

    beforeEach(() => {
      process.env.GEMINI_API_KEY = "AIzaSyTestSecretKey1234567890abcdefghijk";
    });

    afterEach(() => {
      process.env.GEMINI_API_KEY = originalApiKey;
    });

    it("should redact configured GEMINI_API_KEY from raw messages", () => {
      const errorMsg = `API request failed with key ${process.env.GEMINI_API_KEY} at endpoint`;
      const sanitized = sanitizeErrorMessage(errorMsg);
      expect(sanitized).not.toContain(process.env.GEMINI_API_KEY);
      expect(sanitized).toContain("[REDACTED_API_KEY]");
    });

    it("should redact key query parameters (key=, apiKey=, api_key=, token=)", () => {
      const urlError = "Failed GET https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSySecretParamKey12345";
      const sanitized = sanitizeErrorMessage(urlError);
      expect(sanitized).not.toContain("AIzaSySecretParamKey12345");
      expect(sanitized).toContain("key=[REDACTED_KEY]");

      const paramError2 = "Failed at endpoint?apiKey=super_secret_token_123&other=val";
      const sanitized2 = sanitizeErrorMessage(paramError2);
      expect(sanitized2).not.toContain("super_secret_token_123");
      expect(sanitized2).toContain("apiKey=[REDACTED_KEY]");
    });

    it("should redact Bearer tokens and Authorization headers", () => {
      const authError = "Request failed: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const sanitized = sanitizeErrorMessage(authError);
      expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(sanitized).toContain("[REDACTED_AUTH]");

      const bearerOnly = "Failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const sanitizedBearer = sanitizeErrorMessage(bearerOnly);
      expect(sanitizedBearer).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(sanitizedBearer).toContain("Bearer [REDACTED_TOKEN]");
    });

    it("should redact standalone Google AIza API key strings", () => {
      const standalone = "Error: Invalid response using key AIzaSyD3x4mpL3K3y0000000000000000000000 in client call";
      const sanitized = sanitizeErrorMessage(standalone);
      expect(sanitized).not.toContain("AIzaSyD3x4mpL3K3y0000000000000000000000");
      expect(sanitized).toContain("[REDACTED_AIZA_KEY]");
    });

    it("should safely handle objects, Error instances, null, and undefined", () => {
      expect(sanitizeErrorMessage(null)).toBe("");
      expect(sanitizeErrorMessage(undefined)).toBe("");
      expect(sanitizeErrorMessage(new Error("Network connection reset"))).toContain("Network connection reset");
      expect(sanitizeErrorMessage({ message: "Custom object error" })).toContain("Custom object error");
    });
  });

  describe("2. ResearchHypothesisEngine — Truthful Degraded State & Deterministic Metrics", () => {
    beforeEach(() => {
      ResearchHypothesisEngine.clear();
    });

    it("should return truthful degraded status and 0.0 metrics when Gemini fails or is unconfigured", async () => {
      // Temporarily clear or invalidate key
      const oldKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = "";

      const hypothesis = await ResearchHypothesisEngine.generateHypothesis("Semiconductor Supply Chain");

      expect(hypothesis.isDegraded).toBe(true);
      expect(hypothesis.status).toBe("unverified");
      expect(hypothesis.statisticalPotential).toBe(0.0);
      expect(hypothesis.marketRelevanceScore).toBe(0.0);
      expect(hypothesis.marketRelevance).toBe(0.0);
      expect(hypothesis.expectedInformationGain).toBe(0.0);
      expect(hypothesis.priority).toBe(0.0);

      // Verify no NaN or undefined
      expect(Number.isFinite(hypothesis.statisticalPotential)).toBe(true);
      expect(Number.isFinite(hypothesis.priority)).toBe(true);

      process.env.GEMINI_API_KEY = oldKey;
    });

    it("should produce deterministic repeatable fallback outputs without Math.random", async () => {
      const oldKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = "";

      const hyp1 = await ResearchHypothesisEngine.generateHypothesis("TopicA");
      const hyp2 = await ResearchHypothesisEngine.generateHypothesis("TopicA");

      expect(hyp1.title).toBe(hyp2.title);
      expect(hyp1.description).toBe(hyp2.description);
      expect(hyp1.logicalPredicate).toBe(hyp2.logicalPredicate);
      expect(hyp1.statisticalPotential).toBe(hyp2.statisticalPotential);
      expect(hyp1.priority).toBe(hyp2.priority);

      process.env.GEMINI_API_KEY = oldKey;
    });
  });

  describe("3. Model Cascade Validation & Obsolete Model Removal", () => {
    it("should enforce AIModelConfig contains ONLY approved Gemini models", () => {
      const approved = ["gemini-3.7-flash", "gemini-3.1-flash-lite"];
      expect(AIModelConfig.gemini.candidates).toEqual(approved);
      expect(AIModelConfig.gemini.primary).toBe("gemini-3.7-flash");
      expect(AIModelConfig.gemini.fallback).toBe("gemini-3.1-flash-lite");

      expect(AIModelConfig.gemini.candidates).not.toContain("gemini-3.6-flash");
      expect(AIModelConfig.gemini.candidates).not.toContain("gemini-2.5-flash");
      expect(AIModelConfig.gemini.candidates).not.toContain("gemini-1.5-flash");
    });

    it("should verify zero occurrences of obsolete Gemini models in production source files", () => {
      const productionFiles = [
        "server.ts",
        "src/news/AI/AIModelConfig.ts",
        "src/lib/QueryPlanner.ts",
        "src/lib/SearchOrchestrator.ts",
        "src/lib/connectors/GoogleSearchMCP.ts",
        "src/news/learning/ResearchHypothesisEngine.ts"
      ];

      const obsoletePatterns = ["gemini-2.5", "gemini-3.6", "gemini-1.5"];

      for (const relPath of productionFiles) {
        const fullPath = path.join(process.cwd(), relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, "utf-8");

        for (const pattern of obsoletePatterns) {
          expect(content, `File ${relPath} must not contain obsolete model reference: ${pattern}`).not.toContain(pattern);
        }
      }
    });
  });
});
