import { AIRouter } from "../../news/AI/AIRouter";
import { ConfidenceEngine } from "../../news/AI/ConfidenceEngine";
import { GoogleGenAI } from "@google/genai";
import { TestResult, RegressionReport } from "./NewsCoreV2Regression";

export class AIRouterRegression {
  public static async runSuite(): Promise<RegressionReport> {
    console.log("[AIRouterRegression] Starting AI Router & Fallback Hardening Suite...");
    
    // Save original env variables and provider methods
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    const originalGrokKey = process.env.GROK_API_KEY;
    
    // Set mock api keys so providers are considered "healthy"
    process.env.GEMINI_API_KEY = "mock-gemini-key";
    process.env.GROK_API_KEY = "mock-grok-key";

    const router = AIRouter.getInstance() as any;
    const originalGrokIsHealthy = router.grokProvider.isHealthy;
    const originalGrokGenerate = router.grokProvider.generate;
    const originalGeminiIsHealthy = router.geminiProvider.isHealthy;
    const originalGeminiGenerate = router.geminiProvider.generate;

    const results: TestResult[] = [];
    let geminiCallHistory: string[] = [];
    let geminiMockBehavior: (model: string) => any = () => {
      return { text: "Executive Summary: Test summary.\nHighlights: Test highlights.\nMatters: Direct fundamental business impact.\nInvestor Takeaway: Actionable takeaway." };
    };

    // Instantiate dummy to retrieve the runtime Models class constructor
    const dummyAi = new GoogleGenAI({ apiKey: "dummy-key" });
    const ModelsClass = (dummyAi.models as any).constructor;
    const originalGenerateContentInternal = ModelsClass.prototype.generateContentInternal;

    // Set up prototype mock for GeminiProvider testing
    ModelsClass.prototype.generateContentInternal = async function(this: any, params: any) {
      const model = params?.model;
      if (model) {
        geminiCallHistory.push(model);
      }
      const res = geminiMockBehavior(model || "unknown");
      return res;
    };

    try {
      // Helper to reset mocks
      const resetMocks = () => {
        geminiCallHistory = [];
        router.grokProvider.isHealthy = () => true;
        router.geminiProvider.isHealthy = () => true;
        
        router.grokProvider.generate = async () => {
          return {
            text: "Executive Summary: Success with Grok TATA MOTORS.\nHighlights: Top news.\nMatters: Highly relevant.\nInvestor Takeaway: Trade long.",
            provider: "grok",
            confidence: 95,
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            latencyMs: 120,
            costEstimate: 0.001,
            fallbackUsed: false
          };
        };

        geminiMockBehavior = () => {
          return {
            text: "Executive Summary: Success with Gemini TATA MOTORS.\nHighlights: Standard highlights.\nMatters: Focus points.\nInvestor Takeaway: Long term hold."
          };
        };
      };

      // ------------------------------------------------------------------------
      // TEST 1: Grok success (Grok used; Gemini not called)
      // ------------------------------------------------------------------------
      resetMocks();
      let response = await AIRouter.getInstance().generateSummary({
        headline: "Tata Motors Q1 Net Profit Jumps 30%",
        body: "Tata Motors reported ₹5,400 Cr net profit.",
        forceRefresh: true
      });

      results.push({
        testName: "Grok success - Primary chosen & Gemini skipped",
        passed: response.provider === "grok" && geminiCallHistory.length === 0,
        message: `Used provider: ${response.provider}, Gemini calls: ${geminiCallHistory.length}`
      });

      // ------------------------------------------------------------------------
      // TEST 2: Grok failure -> Gemini Flash success
      // ------------------------------------------------------------------------
      resetMocks();
      router.grokProvider.generate = async () => {
        throw new Error("Grok service is down");
      };

      response = await AIRouter.getInstance().generateSummary({
        headline: "Tata Motors Q1 Net Profit Jumps 30%",
        body: "Tata Motors reported ₹5,400 Cr net profit.",
        facts: { issuerName: "TATA MOTORS" },
        forceRefresh: true
      });

      results.push({
        testName: "Grok failure -> Gemini Flash success",
        passed: response.provider === "gemini" && geminiCallHistory.length === 1 && geminiCallHistory[0] === "gemini-3.7-flash",
        message: `Used provider: ${response.provider}, Gemini sequence: ${JSON.stringify(geminiCallHistory)}`
      });

      // ------------------------------------------------------------------------
      // TEST 3: Grok failure -> Gemini Flash failure -> Gemini Flash-Lite success
      // ------------------------------------------------------------------------
      resetMocks();
      router.grokProvider.generate = async () => {
        throw new Error("Grok offline");
      };

      geminiMockBehavior = (model: string) => {
        if (model === "gemini-3.7-flash") {
          throw new Error("Quota exceeded or 429 rate limit");
        }
        return {
          text: "Executive Summary: Success with Gemini Flash-Lite.\nHighlights: High fidelity facts.\nMatters: Positive outlook.\nInvestor Takeaway: Support buy."
        };
      };

      response = await AIRouter.getInstance().generateSummary({
        headline: "Tata Motors Q1 Net Profit Jumps 30%",
        body: "Tata Motors reported ₹5,400 Cr net profit.",
        forceRefresh: true
      });

      results.push({
        testName: "Grok failure -> Gemini Flash failure -> Gemini Flash-Lite success",
        passed: response.provider === "gemini" && geminiCallHistory.length === 2 && geminiCallHistory[0] === "gemini-3.7-flash" && geminiCallHistory[1] === "gemini-3.1-flash-lite",
        message: `Used provider: ${response.provider}, Gemini sequence: ${JSON.stringify(geminiCallHistory)}`
      });

      // ------------------------------------------------------------------------
      // TEST 4 & 5 & 6: Grok failure -> both Gemini fail -> LocalProvider, Verify no cycling & no infinite retry
      // ------------------------------------------------------------------------
      resetMocks();
      router.grokProvider.generate = async () => {
        throw new Error("Grok down");
      };

      geminiMockBehavior = (model: string) => {
        throw new Error(`Model ${model} failed persistently`);
      };

      response = await AIRouter.getInstance().generateSummary({
        headline: "Tata Motors Q1 Net Profit Jumps 30%",
        body: "Tata Motors reported ₹5,400 Cr net profit.",
        forceRefresh: true
      });

      results.push({
        testName: "Grok failure -> both Gemini fail -> LocalProvider",
        passed: response.provider === "local",
        message: `Used provider: ${response.provider}`
      });

      results.push({
        testName: "Verify Gemini does NOT cycle and is bounded",
        passed: geminiCallHistory.length === 2 && geminiCallHistory[0] === "gemini-3.7-flash" && geminiCallHistory[1] === "gemini-3.1-flash-lite",
        message: `Gemini sequence: ${JSON.stringify(geminiCallHistory)}`
      });

      results.push({
        testName: "Verify no infinite retry loop",
        passed: geminiCallHistory.length === 2,
        message: `Total attempts across Gemini: ${geminiCallHistory.length}`
      });

      // ------------------------------------------------------------------------
      // TEST 7: ConfidenceEngine evidence validation applies to Grok response
      // ------------------------------------------------------------------------
      resetMocks();
      // Set Grok to return a garbage/low-confidence summary (missing section headers)
      router.grokProvider.generate = async () => {
        return {
          text: "This is some random text that does not have required sections.",
          provider: "grok",
          confidence: 90,
          promptTokens: 10,
          completionTokens: 10,
          totalTokens: 20,
          latencyMs: 50,
          costEstimate: 0.0001,
          fallbackUsed: false
        };
      };

      response = await AIRouter.getInstance().generateSummary({
        headline: "Tata Motors Q1 Net Profit Jumps 30%",
        body: "Tata Motors reported ₹5,400 Cr net profit.",
        facts: { issuerName: "TATA MOTORS" },
        forceRefresh: true
      });

      results.push({
        testName: "ConfidenceEngine evidence validation triggers fallback on low score",
        passed: response.provider === "gemini",
        message: `Grok failed confidence check, routed to: ${response.provider}`
      });

    } finally {
      // Restore everything back to pristine state
      process.env.GEMINI_API_KEY = originalGeminiKey;
      process.env.GROK_API_KEY = originalGrokKey;
      router.grokProvider.isHealthy = originalGrokIsHealthy;
      router.grokProvider.generate = originalGrokGenerate;
      router.geminiProvider.isHealthy = originalGeminiIsHealthy;
      router.geminiProvider.generate = originalGeminiGenerate;

      // Clean prototype override
      if (ModelsClass && ModelsClass.prototype) {
        ModelsClass.prototype.generateContentInternal = originalGenerateContentInternal;
      }
    }

    const passCount = results.filter((r) => r.passed).length;
    const failCount = results.length - passCount;

    const report: RegressionReport = {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passCount,
      failCount,
      status: failCount === 0 ? "PASS" : "FAIL",
      results,
      metrics: {
        persistentStories: 0,
        apiStories: 0,
        duplicateIds: 0,
        duplicateUrls: 0,
        fnoIncluded: 0,
        fnoExcluded: 0
      }
    };

    return report;
  }
}
