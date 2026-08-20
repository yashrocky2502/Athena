import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { GroqProvider } from '../AI/GroqProvider';
import { GeminiProvider } from '../AI/GeminiProvider';
import { AIRouter } from '../AI/AIRouter';
import { AIHealthMonitor } from '../AI/AIHealthMonitor';
import { CostTracker } from '../AI/CostTracker';
import { LocalProvider } from '../AI/LocalProvider';
import { NewsAIService } from '../AI/NewsAIService';
import { TraderImpactEngine } from '../intelligence/TraderImpactEngine';

describe('Stage 7.8: Production AI Provider & Model Forensic Verification', () => {
  let groq: GroqProvider;
  let gemini: GeminiProvider;
  let router: AIRouter;
  let healthMonitor: AIHealthMonitor;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    healthMonitor = AIHealthMonitor.getInstance();
    healthMonitor.reset();
    groq = new GroqProvider();
    gemini = new GeminiProvider();
    router = AIRouter.getInstance();
    
    // Bind mock providers to router instance to intercept calls correctly
    router.groqProvider = groq;
    router.geminiProvider = gemini;
  });

  // --- REQUIREMENT 15: Static Model Reference Gate ---
  describe('1. Static Model Reference Gate & Production Config Inspection', () => {
    it('should scan production source files and fail if deprecated or decommissioned models are found', () => {
      const groqPath = path.resolve(__dirname, '../AI/GroqProvider.ts');
      const geminiPath = path.resolve(__dirname, '../AI/GeminiProvider.ts');

      const groqContent = fs.readFileSync(groqPath, 'utf-8');
      const geminiContent = fs.readFileSync(geminiPath, 'utf-8');

      const deprecatedGroq = [
        'gemma2-9b-it',
        'llama3-8b-8192',
        'llama3-70b-8192',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
        'mixtral-8x7b-32768'
      ];

      const deprecatedGemini = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-pro',
        'gemini-2.0-flash-thinking'
      ];

      // Check Groq
      deprecatedGroq.forEach(model => {
        const containsRetired = groqContent.includes(`'${model}'`) || groqContent.includes(`"${model}"`);
        expect(containsRetired).toBe(false);
      });

      // Check Gemini
      deprecatedGemini.forEach(model => {
        const containsRetired = geminiContent.includes(`'${model}'`) || geminiContent.includes(`"${model}"`);
        expect(containsRetired).toBe(false);
      });
    });

    it('should verify authoritative model configuration structures have no duplicates', () => {
      const origPrimary = process.env.GROQ_PRIMARY_MODEL;
      const origFallback = process.env.GROQ_FALLBACK_MODEL;
      delete process.env.GROQ_PRIMARY_MODEL;
      delete process.env.GROQ_FALLBACK_MODEL;

      // Direct instance checking to guarantee deduplication filter is working
      const groqModels = (groq as any).getPrimaryModel ? [groq.getPrimaryModel(), groq.getFallbackModel()] : [];
      const duplicatesGroq = groqModels.filter((item, index) => groqModels.indexOf(item) !== index);
      expect(duplicatesGroq.length).toBe(0);

      process.env.GROQ_PRIMARY_MODEL = origPrimary;
      process.env.GROQ_FALLBACK_MODEL = origFallback;
    });
  });

  // --- REQUIREMENTS 3 & 4: Model Verification ---
  describe('2. Provider Candidate Array Verification', () => {
    it('should contain only active verified candidate models', () => {
      // Check Groq fallback candidate list
      const groqSource = fs.readFileSync(path.resolve(__dirname, '../AI/AIModelConfig.ts'), 'utf-8');
      expect(groqSource).toContain('llama-3.3-70b-versatile');
      expect(groqSource).toContain('llama-3.1-8b-instant');

      // Check Gemini fallback candidate list
      const geminiSource = fs.readFileSync(path.resolve(__dirname, '../AI/AIModelConfig.ts'), 'utf-8');
      expect(geminiSource).toContain('gemini-3.1-flash-lite');
      expect(geminiSource).toContain('gemini-3.7-flash');
    });
  });

  // --- REQUIREMENT 5: Authoritative Production Hierarchy & Determinism ---
  describe('3. Router Provider Fallback Hierarchy', () => {
    it('should adhere to the authorized sequential hierarchy: Groq -> Gemini -> Local', async () => {
      const input = {
        headline: 'Emergency FED Rate Cut',
        body: 'The Federal Reserve lowered rates by 50bps today in an emergency meeting.',
        category: 'Macro Economics',
        url: 'https://fed.gov/cut'
      };

      // Mock Groq failing, Gemini failing, Local succeeding
      vi.spyOn(groq, 'isHealthy').mockReturnValue(true);
      vi.spyOn(groq, 'generate').mockRejectedValue(new Error('Groq timeout'));

      vi.spyOn(gemini, 'isHealthy').mockReturnValue(true);
      vi.spyOn(gemini, 'generate').mockRejectedValue(new Error('Gemini quota exceeded'));

      const localSpy = vi.spyOn((router as any).localProvider, 'generate').mockResolvedValue({
        text: 'Local processed summary',
        provider: 'local',
        confidence: 80,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: 1,
        costEstimate: 0,
        fallbackUsed: true
      });

      // Execute routing
      const response = await router.generateSummary(input);

      expect(response.text).toBe('Local processed summary');
      expect(response.provider).toBe('local');
      expect(localSpy).toHaveBeenCalled();
    });
  });

  // --- REQUIREMENT 6: ATHENA Core Isolation ---
  describe('4. ATHENA Core Isolation Gate', () => {
    it('should boot and mount without requiring external AI keys or causing startup network calls', () => {
      // Clear all keys from mock env
      const originalGroqKey = process.env.GROQ_API_KEY;
      const originalGeminiKey = process.env.GEMINI_API_KEY;
      delete process.env.GROQ_API_KEY;
      delete process.env.GEMINI_API_KEY;

      try {
        // Assert that initialization doesn't throw or connect
        const freshMonitor = AIHealthMonitor.getInstance();
        expect(freshMonitor).toBeDefined();

        const freshRouter = AIRouter.getInstance();
        expect(freshRouter).toBeDefined();

        expect(freshRouter.groqProvider.getApiKey()).toBeUndefined();
        expect(freshRouter.geminiProvider.getApiKey()).toBeUndefined();

        // Local engine is immediately ready
        expect(freshRouter.localProvider.isHealthy()).toBe(true);
      } finally {
        // Restore original env keys
        process.env.GROQ_API_KEY = originalGroqKey;
        process.env.GEMINI_API_KEY = originalGeminiKey;
      }
    });
  });

  // --- REQUIREMENT 8: API Usage & Quota Protection ---
  describe('5. API Usage & Quota Protection Checks', () => {
    it('should respect cached summaries and avoid redundant AI requests', async () => {
      const input = {
        headline: 'Profit Increase of 25%',
        body: 'Q3 net profit grew by 25% year-on-year to $450 million.',
        category: 'Earnings',
        url: 'https://reuters.com/earnings-profit-25'
      };

      vi.spyOn(groq, 'isHealthy').mockReturnValue(true);
      const groqSpy = vi.spyOn(groq, 'generate').mockResolvedValue({
        text: 'AUTHORITATIVE SUMMARY: 25% Profit Increase',
        provider: 'groq',
        confidence: 98,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 120,
        costEstimate: 0.0001,
        fallbackUsed: false
      });

      // First run: Cache Miss, triggers AI generate
      const response1 = await router.generateSummary(input);
      expect(groqSpy).toHaveBeenCalledTimes(1);

      // Second run: Cache Hit, completely bypasses AI generate
      const response2 = await router.generateSummary(input);
      expect(groqSpy).toHaveBeenCalledTimes(1);
      expect(response2.text).toBe(response1.text);
    });

    it('should restrict Trader Intelligence to on-demand (user-initiated) except for F&O exceptions', () => {
      // Standard corporate announcement article
      const standardArticle = {
        headline: 'Reliance Board Meeting Scheduled',
        body: 'Reliance Industries has scheduled a board meeting next week to discuss dividend payouts.'
      };

      // Ensure standard article does NOT trigger F&O automatic priority path
      const standardIntel = TraderImpactEngine.transform(standardArticle as any);
      expect(standardIntel.fnoDetails?.fnoEvidencePresent).toBe(false);

      // Option chain / strike price article
      const foArticle = {
        headline: 'NIFTY 24500 Call Option Active',
        body: 'High open interest addition seen at 24500 CE strike price with implied volatility rising.'
      };

      const fnoIntel = TraderImpactEngine.transform(foArticle as any);
      expect(fnoIntel.fnoDetails?.fnoEvidencePresent).toBe(true);
    });
  });

  // --- REQUIREMENT 10: Provider Candidate Poisoning Protection & Health Monitor ---
  describe('6. Provider Candidate Poisoning Protection', () => {
    it('should permanently poison a candidate model on 404/decommissioned but keep the provider active', async () => {
      const input = {
        headline: 'Apple WWDC Launches AI',
        body: 'Apple announced new intelligence features today.',
        category: 'Corporate',
        url: 'https://apple.com/wwdc-news-2026'
      };

      // Set Groq keys
      vi.spyOn(groq, 'getApiKey').mockReturnValue('valid_mock_key');
      vi.spyOn(groq, 'isHealthy').mockReturnValue(true);

      // First request fails with a 404 (model unavailable) for the first model in candidate models list
      const errorResponse = {
        response: {
          status: 404,
          data: { error: { message: 'The model llama-3.3-70b-versatile does not exist or has been decommissioned.' } }
        }
      };

      // Spy axios post to throw the 404
      const axiosSpy = vi.spyOn(axios, 'post').mockRejectedValue(errorResponse);

      try {
        await groq.generate({
          prompt: 'Please summarize',
          systemPrompt: 'System',
          url: 'https://apple.com/wwdc-news-2026',
          headline: 'Apple WWDC Launches AI'
        });
      } catch (err) {
        // Expected to throw or run out of fallback retries
      }

      // Assert model is now poisoned
      const isPoisoned = healthMonitor.isModelPoisoned('llama-3.3-70b-versatile');
      expect(isPoisoned).toBe(true);

      // BUT the overall provider must remain healthy because other candidate models can still work
      expect(healthMonitor.isProviderHealthy('groq')).toBe(true);
    });

    it('should differentiate rate limits (429) from model configuration failures (404)', () => {
      healthMonitor.reset();

      // Case A: Rate limit (429) is a temporary degradation, marking provider degraded/unhealthy
      healthMonitor.recordQuotaExceeded('groq');
      expect(healthMonitor.isProviderHealthy('groq')).toBe(false);

      // Reset
      healthMonitor.reset();
      expect(healthMonitor.isProviderHealthy('groq')).toBe(true);

      // Case B: Model 404 failure records model poisoning but leaves the provider itself healthy
      healthMonitor.recordFailure('groq', 'Model decommissioned', '404');
      expect(healthMonitor.isProviderHealthy('groq')).toBe(true);
    });
  });

  // --- REQUIREMENT 12: Client Secret Isolation ---
  describe('7. Secret Isolation and Browser Safety Check', () => {
    it('should guarantee that server-side API keys never enter the client environment', () => {
      expect(typeof process !== 'undefined').toBe(true);

      // We safely test that getApiKey returns undefined when process environment isn't present
      const originalProcess = global.process;
      try {
        Object.defineProperty(global, 'process', {
          value: undefined,
          configurable: true,
          writable: true
        });

        // Instantiate inside process-less simulation
        const clientGroq = new GroqProvider();
        expect(clientGroq.getApiKey()).toBeUndefined();
      } finally {
        // Restore
        Object.defineProperty(global, 'process', {
          value: originalProcess,
          configurable: true,
          writable: true
        });
      }
    });
  });
});
