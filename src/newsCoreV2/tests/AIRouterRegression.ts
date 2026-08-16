import { AIRouter } from "../../news/AI/AIRouter";
import { ConfidenceEngine } from "../../news/AI/ConfidenceEngine";
import { GoogleGenAI } from "@google/genai";
import { TestResult, RegressionReport } from "./NewsCoreV2Regression";

export class AIRouterRegression {
  public static async runSuite(): Promise<RegressionReport> {
    console.log("[AIRouterRegression] Starting Stage 4.3 AI Router (Groq -> Gemini 3.6 Flash -> Local) Hardening Suite...");
    
    // Save original env variables and provider methods
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    const originalGroqKey = process.env.GROQ_API_KEY;
    
    // Set mock api keys so providers are considered "healthy"
    process.env.GEMINI_API_KEY = "mock-gemini-key";
    process.env.GROQ_API_KEY = "mock-groq-key";

    const router = AIRouter.getInstance() as any;
    const originalGroqIsHealthy = router.groqProvider.isHealthy;
    const originalGroqGenerate = router.groqProvider.generate;
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
        router.groqProvider.isHealthy = () => true;
        router.geminiProvider.isHealthy = () => true;
        
        router.groqProvider.generate = async () => {
          return {
            text: "Executive Summary: Success with Groq TATA MOTORS.\nHighlights: Top news.\nMatters: Highly relevant.\nInvestor Takeaway: Trade long.",
            provider: "groq",
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
            text: "Executive Summary: Success with Gemini 3.6 Flash TATA MOTORS.\nHighlights: Standard highlights.\nMatters: Focus points.\nInvestor Takeaway: Long term hold."
          };
        };
      };

      // ------------------------------------------------------------------------
      // TEST 1: Groq success (Groq used; Gemini not called)
      // ------------------------------------------------------------------------
      resetMocks();
      let response = await AIRouter.getInstance().generateSummary({
        headline: "Tata Motors Q1 Net Profit Jumps 30%",
        body: "Tata Motors reported ₹5,400 Cr net profit.",
        forceRefresh: true
      });

      results.push({
        testName: "Groq success - Primary chosen & Gemini skipped",
        passed: response.provider === "groq" && geminiCallHistory.length === 0,
        message: `Used provider: ${response.provider}, Gemini calls: ${geminiCallHistory.length}`
      });

      // ------------------------------------------------------------------------
      // TEST 2: Groq failure -> Gemini 3.6 Flash fallback success
      // ------------------------------------------------------------------------
      resetMocks();
      router.groqProvider.generate = async () => {
        throw new Error("Groq service is down");
      };

      response = await AIRouter.getInstance().generateSummary({
        headline: "Tata Motors Q1 Net Profit Jumps 30%",
        body: "Tata Motors reported ₹5,400 Cr net profit.",
        facts: { issuerName: "TATA MOTORS" },
        forceRefresh: true
      });

      results.push({
        testName: "Groq failure -> Gemini 3.6 Flash fallback success",
        passed: response.provider === "gemini" && geminiCallHistory.length === 1 && geminiCallHistory[0] === "gemini-3.6-flash",
        message: `Used provider: ${response.provider}, Gemini sequence: ${JSON.stringify(geminiCallHistory)}`
      });

      // ------------------------------------------------------------------------
      // TEST 3: Groq failure -> Gemini 3.6 Flash failure -> Athena Local Engine
      // ------------------------------------------------------------------------
      resetMocks();
      router.groqProvider.generate = async () => {
        throw new Error("Groq offline");
      };

      geminiMockBehavior = (model: string) => {
        throw new Error(`Model ${model} rate-limited 429`);
      };

      response = await AIRouter.getInstance().generateSummary({
        headline: "Tata Motors Q1 Net Profit Jumps 30%",
        body: "Tata Motors reported ₹5,400 Cr net profit.",
        forceRefresh: true
      });

      results.push({
        testName: "Groq failure -> Gemini failure -> Athena Local Engine",
        passed: response.provider === "local",
        message: `Used provider: ${response.provider}`
      });

      // ------------------------------------------------------------------------
      // TEST 4: Bounded retry and zero infinite loops
      // ------------------------------------------------------------------------
      results.push({
        testName: "Verify Gemini does NOT cycle indefinitely and fallback is bounded",
        passed: geminiCallHistory.length === 2, // 1 initial + 1 retry
        message: `Total attempts across Gemini: ${geminiCallHistory.length}`
      });

      // ------------------------------------------------------------------------
      // TEST 5: ConfidenceEngine evidence validation applies to Groq response
      // ------------------------------------------------------------------------
      resetMocks();
      router.groqProvider.generate = async () => {
        return {
          text: "This is some random text that does not have required sections.",
          provider: "groq",
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
        message: `Groq failed confidence check, routed to: ${response.provider}`
      });

    } finally {
      // Restore everything back to pristine state
      process.env.GEMINI_API_KEY = originalGeminiKey;
      process.env.GROQ_API_KEY = originalGroqKey;
      router.groqProvider.isHealthy = originalGroqIsHealthy;
      router.groqProvider.generate = originalGroqGenerate;
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
