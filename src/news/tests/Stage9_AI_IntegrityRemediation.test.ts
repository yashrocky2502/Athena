import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';
import { AIRouter } from '../AI/AIRouter';
import { GroqProvider } from '../AI/GroqProvider';
import { GeminiProvider } from '../AI/GeminiProvider';
import { LocalProvider } from '../AI/LocalProvider';
import { AIHealthMonitor } from '../AI/AIHealthMonitor';
import { CacheManager } from '../AI/CacheManager';
import { ConfidenceEngine } from '../AI/ConfidenceEngine';
import { AIModelConfig } from '../AI/AIModelConfig';
import { AIOperationsController } from '../operations/AIOperationsController';

describe('Stage 9: AI Intelligence Integrity Remediation Verification Suite', () => {
  let router: AIRouter;
  let groq: GroqProvider;
  let gemini: GeminiProvider;
  let local: LocalProvider;
  let healthMonitor: AIHealthMonitor;
  let cacheManager: CacheManager;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    healthMonitor = AIHealthMonitor.getInstance();
    healthMonitor.reset();

    cacheManager = CacheManager.getInstance();
    cacheManager.clear();

    groq = new GroqProvider();
    gemini = new GeminiProvider();
    local = new LocalProvider();
    router = AIRouter.getInstance();

    router.groqProvider = groq;
    router.geminiProvider = gemini;
    router.localProvider = local;

    // Reset AIOperationsController to enabled state
    const aiController = AIOperationsController.getInstance();
    aiController.enableAI();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. AIRouter Pipeline & Integrity Gate
  // =========================================================================
  describe('1. AIRouter Pipeline & Gate Consistency', () => {
    it('should route generateSummary through the complete validation and ConfidenceEngine pipeline', async () => {
      const input = {
        headline: 'Tata Motors Q3 Net Profit Surges 60%',
        body: 'Executive Summary: Tata Motors reported strong revenue growth in Q3 with net profit rising 60% YoY. Key Highlights: • Entity: Tata Motors • Revenue: Rs 105,000 Cr • PAT: Rs 7,025 Cr. Why It Matters: Strong commercial vehicle demand. Investor Takeaway: Positive outlook.',
        category: 'Earnings',
        url: 'https://example.com/tatamotors-q3'
      };

      vi.spyOn(groq, 'isHealthy').mockReturnValue(true);
      vi.spyOn(groq, 'generate').mockResolvedValue({
        text: 'Executive Summary\nTata Motors posted strong performance.\n\nKey Highlights\n• Entity: Tata Motors\n• Revenue: 105000\n• PAT: 7025\n\nWhy It Matters\nCommercial vehicle demand solid.\n\nInvestor Takeaway\nTrack margins.',
        provider: 'groq',
        confidence: 95,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 120,
        costEstimate: 0.0001,
        fallbackUsed: false
      });

      const response = await router.generateSummary(input);

      expect(response.provider).toBe('groq');
      expect(response.fallbackUsed).toBe(false);
      expect(response.confidence).toBeGreaterThanOrEqual(70);
      expect(response.text).toContain('Executive Summary');
    });

    it('should route generateWithRouter through the same minimum integrity pipeline', async () => {
      const options = {
        prompt: 'Generate financial summary for Infosys Q4 numbers.',
        headline: 'Infosys Q4 Results Analysis',
        url: 'https://example.com/infy-q4',
        facts: { companyName: 'Infosys', revenue: '37,923 Cr', pat: '6,128 Cr' }
      };

      vi.spyOn(groq, 'isHealthy').mockReturnValue(true);
      vi.spyOn(groq, 'generate').mockResolvedValue({
        text: 'Executive Summary\nInfosys reported solid quarterly revenue growth of 4% with margin stability.\n\nKey Highlights\n• Entity: Infosys\n• Revenue: 37,923 Cr\n• PAT: 6,128 Cr\n\nWhy It Matters\nHighlights steady operational delivery.\n\nInvestor Takeaway\nMonitor upcoming deal pipeline.',
        provider: 'groq',
        confidence: 95,
        promptTokens: 120,
        completionTokens: 60,
        totalTokens: 180,
        latencyMs: 140,
        costEstimate: 0.0001,
        fallbackUsed: false
      });

      const response = await router.generateWithRouter(options);

      expect(response.provider).toBe('groq');
      expect(response.fallbackUsed).toBe(false);
      expect(response.confidence).toBeGreaterThanOrEqual(70);
      expect(response.text).toContain('Executive Summary');
    });

    it('should fail over to Local deterministic fallback with truthful attribution when external providers fail', async () => {
      const input = {
        headline: 'L&T Wins Significant Infrastructure Order',
        body: 'Larsen & Toubro secured an infrastructure contract worth Rs 2,500 Cr.',
        category: 'Corporate Filing',
        url: 'https://example.com/lt-order'
      };

      vi.spyOn(groq, 'isHealthy').mockReturnValue(true);
      vi.spyOn(groq, 'generate').mockRejectedValue(new Error('Groq network error'));
      vi.spyOn(gemini, 'isHealthy').mockReturnValue(true);
      vi.spyOn(gemini, 'generate').mockRejectedValue(new Error('Gemini rate limit'));

      const response = await router.generateSummary(input);

      expect(response.provider).toBe('local');
      expect(response.fallbackUsed).toBe(true);
      expect(typeof response.confidence).toBe('number');
      expect(response.text).toContain('Executive Summary');
    });
  });

  // =========================================================================
  // 2. Provider Retry Semantics & Model Candidate Bounds
  // =========================================================================
  describe('2. Provider Candidate Retry Semantics (2 candidates = 2 attempts)', () => {
    it('GroqProvider: should execute exactly 2 attempts when first candidate fails with retryable error', async () => {
      vi.spyOn(groq, 'getApiKey').mockReturnValue('mock-groq-key');

      let callCount = 0;
      vi.spyOn(axios, 'post').mockImplementation(async (_url, body: any) => {
        callCount++;
        if (callCount === 1) {
          expect(body.model).toBe(AIModelConfig.groq.candidates[0]);
          const err: any = new Error('Model overloaded');
          err.response = { status: 503, data: { error: { message: 'Service Unavailable' } } };
          throw err;
        }
        expect(body.model).toBe(AIModelConfig.groq.candidates[1]);
        return {
          data: {
            choices: [{ message: { content: 'Executive Summary\nSuccessful fallback response.\n\nKey Highlights\n• Highlight 1\n• Highlight 2\n• Highlight 3\n\nWhy It Matters\nContext\n\nInvestor Takeaway\nSummary' } }],
            usage: { prompt_tokens: 50, completion_tokens: 50 }
          }
        };
      });

      const resp = await groq.generate({
        prompt: 'Summarize news'
      });

      expect(callCount).toBe(2);
      expect(resp.provider).toBe('groq');
      expect(resp.model).toBe(AIModelConfig.groq.candidates[1]);
    });

    it('GroqProvider: should fail-fast on 401 Auth Error in exactly 1 attempt', async () => {
      vi.spyOn(groq, 'getApiKey').mockReturnValue('invalid-groq-key');

      let callCount = 0;
      vi.spyOn(axios, 'post').mockImplementation(async () => {
        callCount++;
        const err: any = new Error('Invalid API Key');
        err.response = { status: 401, data: { error: { message: 'Invalid API Key provided' } } };
        throw err;
      });

      await expect(groq.generate({ prompt: 'Test' })).rejects.toThrow(/Groq Authentication Failed \(401\)/);
      expect(callCount).toBe(1);
    });

    it('GroqProvider: should fail-fast on 400 Bad Request (non-model error) in exactly 1 attempt', async () => {
      vi.spyOn(groq, 'getApiKey').mockReturnValue('valid-key');

      let callCount = 0;
      vi.spyOn(axios, 'post').mockImplementation(async () => {
        callCount++;
        const err: any = new Error('Bad Request');
        err.response = { status: 400, data: { error: { message: 'Invalid max_tokens value specified' } } };
        throw err;
      });

      await expect(groq.generate({ prompt: 'Test' })).rejects.toThrow(/Groq Bad Request \(400\)/);
      expect(callCount).toBe(1);
    });

    it('GroqProvider: should poison model and retry on 404 Model Decommissioned', async () => {
      vi.spyOn(groq, 'getApiKey').mockReturnValue('valid-key');

      let callCount = 0;
      vi.spyOn(axios, 'post').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const err: any = new Error('Model Not Found');
          err.response = { status: 404, data: { error: { message: 'The model llama-3.3-70b-versatile does not exist' } } };
          throw err;
        }
        return {
          data: {
            choices: [{ message: { content: 'Executive Summary\nRecovered.\n\nKey Highlights\n• One\n• Two\n• Three\n\nWhy It Matters\nContext\n\nInvestor Takeaway\nAction' } }]
          }
        };
      });

      const resp = await groq.generate({ prompt: 'Test' });
      expect(callCount).toBe(2);
      expect(healthMonitor.isModelPoisoned('llama-3.3-70b-versatile')).toBe(true);
      expect(resp.text).toContain('Recovered');
    });
  });

  // =========================================================================
  // 3. AIHealthMonitor State Machine Verification
  // =========================================================================
  describe('3. AIHealthMonitor State Machine Verification', () => {
    it('should transition from Healthy -> Degraded on 1-2 failures, and Unhealthy on 3 consecutive failures', () => {
      expect(healthMonitor.isProviderHealthy('groq')).toBe(true);

      // 1st failure: Degraded
      healthMonitor.recordFailure('groq', 'Network glitch');
      const s1 = healthMonitor.getHealthSummary().groq;
      expect(s1.consecutiveFailures).toBe(1);
      expect(s1.status).toBe('Degraded');
      expect(healthMonitor.isProviderHealthy('groq')).toBe(true);

      // 2nd failure: Degraded
      healthMonitor.recordFailure('groq', 'Connection reset');
      const s2 = healthMonitor.getHealthSummary().groq;
      expect(s2.consecutiveFailures).toBe(2);
      expect(s2.status).toBe('Degraded');
      expect(healthMonitor.isProviderHealthy('groq')).toBe(true);

      // 3rd failure: Unhealthy
      healthMonitor.recordFailure('groq', 'Server timeout');
      const s3 = healthMonitor.getHealthSummary().groq;
      expect(s3.consecutiveFailures).toBe(3);
      expect(s3.status).toBe('Unhealthy');
      expect(healthMonitor.isProviderHealthy('groq')).toBe(false);
    });

    it('should immediately transition to Unhealthy on 401/403 Auth Failure', () => {
      healthMonitor.recordFailure('gemini', 'Auth error 401', 401);
      const s = healthMonitor.getHealthSummary().gemini;
      expect(s.consecutiveFailures).toBe(10);
      expect(s.status).toBe('Unhealthy');
      expect(healthMonitor.isProviderHealthy('gemini')).toBe(false);
    });

    it('should immediately transition to Unhealthy on 429 Quota Exceeded', () => {
      healthMonitor.recordQuotaExceeded('groq');
      const s = healthMonitor.getHealthSummary().groq;
      expect(s.consecutiveFailures).toBe(5);
      expect(s.status).toBe('Unhealthy');
      expect(healthMonitor.isProviderHealthy('groq')).toBe(false);
    });

    it('should allow auto-recovery after 3 minutes cooldown', () => {
      healthMonitor.recordQuotaExceeded('gemini');
      expect(healthMonitor.isProviderHealthy('gemini')).toBe(false);

      // Mock failure time to 3.5 minutes in the past
      const pastTime = new Date(Date.now() - 3.5 * 60 * 1000).toISOString();
      (healthMonitor as any).healthState.gemini.lastFailureTime = pastTime;

      // Upon checking health after cooldown, provider enters Degraded and is allowed
      expect(healthMonitor.isProviderHealthy('gemini')).toBe(true);
      expect(healthMonitor.getHealthSummary().gemini.status).toBe('Degraded');
    });

    it('should reset consecutive failures and restore status on recordSuccess', () => {
      healthMonitor.recordFailure('groq', 'Timeout');
      expect(healthMonitor.getHealthSummary().groq.consecutiveFailures).toBe(1);

      healthMonitor.recordSuccess('groq', 120, 200);
      const s = healthMonitor.getHealthSummary().groq;
      expect(s.consecutiveFailures).toBe(0);
      expect(s.status).toBe('Healthy');
    });
  });

  // =========================================================================
  // 4. LocalProvider Truthfulness & Confidence Evaluation
  // =========================================================================
  describe('4. LocalProvider Truthfulness & Measured Confidence', () => {
    it('should produce truthful fact-based output without synthetic regulatory claims', async () => {
      const resp = await local.generate({
        prompt: 'Factual summary',
        headline: 'HDFC Bank Declares Interim Dividend',
        facts: {
          companyName: 'HDFC Bank',
          announcementType: 'Dividend',
          dividend: 'Rs 19.50 per share',
          meetingDate: '2026-03-20'
        }
      });

      expect(resp.provider).toBe('local');
      expect(resp.fallbackUsed).toBe(true);
      expect(resp.text).toContain('HDFC Bank reported an update regarding Dividend');
      expect(resp.text).toContain('• Entity: HDFC Bank');
      expect(resp.text).toContain('• Dividend: Rs 19.50 per share');

      // Ensure no synthetic claims of regulatory certification
      expect(resp.text).not.toContain('Verified Official Regulatory Release');
      expect(resp.text).not.toContain('Filing Authority: Exchange Regulatory Mechanism');

      // Confidence must be mathematically calculated via ConfidenceEngine
      expect(resp.confidence).toBeGreaterThanOrEqual(70);
    });
  });

  // =========================================================================
  // 5. ConfidenceEngine Rejection & Hallucination Guard
  // =========================================================================
  describe('5. ConfidenceEngine Regression & Hallucination Guard', () => {
    it('should reject empty or brief text (<40 chars)', () => {
      const evalResult = ConfidenceEngine.evaluate('Short text');
      expect(evalResult.passed).toBe(false);
      expect(evalResult.score).toBe(0);
      expect(evalResult.issues).toContain('Response text is empty or too brief');
    });

    it('should penalize text missing required structure', () => {
      const unstructured = 'This is a long financial announcement about quarterly corporate earnings and profits without standard sections or structure.';
      const evalResult = ConfidenceEngine.evaluate(unstructured);
      expect(evalResult.promptCompletionScore).toBeLessThan(50);
      expect(evalResult.issues).toContain('Missing required structural sections');
    });

    it('should detect ungrounded extreme financial claims', () => {
      const text = 'Executive Summary\nStock is set to 100x and give guaranteed return.\n\nKey Highlights\n• Point 1\n• Point 2\n• Point 3\n\nWhy It Matters\nHigh growth\n\nInvestor Takeaway\nBuy now';
      const evalResult = ConfidenceEngine.evaluate(text);
      expect(evalResult.hallucinationScore).toBe(30);
      expect(evalResult.issues.some(i => i.includes('Possible promotional or ungrounded claims'))).toBe(true);
    });
  });

  // =========================================================================
  // 6. Cache Integrity & Snapshot Immutability
  // =========================================================================
  describe('6. Cache Integrity & Immutability', () => {
    it('should refuse to cache invalid, empty, or low-confidence responses', () => {
      const key1 = cacheManager.generateKey({ url: 'https://test.com/1' });
      cacheManager.set(key1, { text: '', provider: 'groq' } as any);
      expect(cacheManager.get(key1)).toBeNull();

      const key2 = cacheManager.generateKey({ url: 'https://test.com/2' });
      cacheManager.set(key2, { text: 'Some text', confidence: 40, provider: 'groq' } as any);
      expect(cacheManager.get(key2)).toBeNull();
    });

    it('should cache valid responses with immutable snapshot and cached flag', () => {
      const key = cacheManager.generateKey({ url: 'https://test.com/valid' });
      const original: any = {
        text: 'Executive Summary\nSolid report.\n\nKey Highlights\n• One\n• Two\n• Three\n\nWhy It Matters\nMatters\n\nInvestor Takeaway\nTakeaway',
        provider: 'groq',
        confidence: 90,
        fallbackUsed: false
      };

      cacheManager.set(key, original);
      // Mutate original object
      original.provider = 'local';
      original.text = 'Mutated';

      const retrieved = cacheManager.get(key);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.cached).toBe(true);
      expect(retrieved?.provider).toBe('groq');
      expect(retrieved?.text).toContain('Executive Summary\nSolid report');
    });
  });
});
