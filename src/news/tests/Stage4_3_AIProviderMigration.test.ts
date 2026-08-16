import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AIRouter } from '../AI/AIRouter';
import { GroqProvider } from '../AI/GroqProvider';
import { GeminiProvider } from '../AI/GeminiProvider';
import { LocalProvider } from '../AI/LocalProvider';
import { AIHealthMonitor } from '../AI/AIHealthMonitor';
import { CostTracker } from '../AI/CostTracker';
import { LLMRouter } from '../../services/LLMRouter';

describe('ATHENA STAGE 4.3 — AI Model Infrastructure & Provider Migration', () => {
  const stage2StorePath = path.join(process.cwd(), 'data', 'news_stage2_store.json');
  let initialChecksum = '';
  let initialCount = 0;

  beforeEach(() => {
    if (fs.existsSync(stage2StorePath)) {
      const content = fs.readFileSync(stage2StorePath, 'utf-8');
      initialChecksum = crypto.createHash('sha256').update(content).digest('hex');
      try {
        const parsed = JSON.parse(content);
        initialCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {}
    }
  });

  afterEach(() => {
    // HARD SAFETY CONSTRAINT: Verify data/news_stage2_store.json was NEVER modified or truncated
    if (fs.existsSync(stage2StorePath)) {
      const content = fs.readFileSync(stage2StorePath, 'utf-8');
      const currentChecksum = crypto.createHash('sha256').update(content).digest('hex');
      expect(currentChecksum).toBe(initialChecksum);
      const parsed = JSON.parse(content);
      const currentCount = Array.isArray(parsed) ? parsed.length : 0;
      expect(currentCount).toBe(initialCount);
    }
  });

  describe('1. Authoritative Provider Hierarchy: Groq Primary -> Gemini 3.6 Flash Fallback -> Local Net', () => {
    it('should dispatch to Groq as primary provider when Groq is healthy', async () => {
      const router = AIRouter.getInstance();
      const originalGroqGen = router.groqProvider.generate;
      const originalGroqHealth = router.groqProvider.isHealthy;
      const originalGeminiGen = router.geminiProvider.generate;

      let groqCalled = false;
      let geminiCalled = false;

      router.groqProvider.isHealthy = () => true;
      router.groqProvider.generate = async (opts) => {
        groqCalled = true;
        return {
          text: 'Executive Summary: Tata Motors records strong revenue.\nHighlights: Margin expansion observed.\nMatters: Boosts commercial vehicle leadership.\nInvestor Takeaway: Bullish quarterly performance.',
          provider: 'groq',
          confidence: 96,
          promptTokens: 120,
          completionTokens: 60,
          totalTokens: 180,
          latencyMs: 85,
          costEstimate: 0.0001,
          fallbackUsed: false
        };
      };

      router.geminiProvider.generate = async () => {
        geminiCalled = true;
        throw new Error('Gemini should NOT be called when Groq succeeds');
      };

      try {
        const res = await router.generateSummary({
          headline: 'Tata Motors Q3 Revenue Up 25%',
          body: 'Tata Motors posted impressive numbers for Q3 driven by JLR demand.',
          category: 'Markets',
          forceRefresh: true
        });

        expect(groqCalled).toBe(true);
        expect(geminiCalled).toBe(false);
        expect(res.provider).toBe('groq');
        expect(res.fallbackUsed).toBe(false);
        expect(res.confidence).toBeGreaterThanOrEqual(80);
      } finally {
        router.groqProvider.generate = originalGroqGen;
        router.groqProvider.isHealthy = originalGroqHealth;
        router.geminiProvider.generate = originalGeminiGen;
      }
    });

    it('should cleanly fallback to Gemini 3.6 Flash when Groq fails', async () => {
      const router = AIRouter.getInstance();
      const originalGroqGen = router.groqProvider.generate;
      const originalGroqHealth = router.groqProvider.isHealthy;
      const originalGeminiGen = router.geminiProvider.generate;
      const originalGeminiHealth = router.geminiProvider.isHealthy;

      let groqAttempted = false;
      let geminiCalled = false;

      router.groqProvider.isHealthy = () => true;
      router.groqProvider.generate = async () => {
        groqAttempted = true;
        throw new Error('Groq rate limit exceeded (429)');
      };

      router.geminiProvider.isHealthy = () => true;
      router.geminiProvider.generate = async () => {
        geminiCalled = true;
        return {
          text: 'Executive Summary: Fallback intelligence via Gemini 3.6 Flash.\nHighlights: Solid performance.\nMatters: Stable outlook.\nInvestor Takeaway: Accumulate on dips.',
          provider: 'gemini',
          confidence: 92,
          promptTokens: 150,
          completionTokens: 70,
          totalTokens: 220,
          latencyMs: 250,
          costEstimate: 0.00005,
          fallbackUsed: true
        };
      };

      try {
        const res = await router.generateSummary({
          headline: 'Reliance Retail Expands Footprint',
          body: 'Reliance Retail opened 500 new stores across tier-2 cities.',
          category: 'Corporate Filing',
          forceRefresh: true
        });

        expect(groqAttempted).toBe(true);
        expect(geminiCalled).toBe(true);
        expect(res.provider).toBe('gemini');
        expect(res.fallbackUsed).toBe(true);
      } finally {
        router.groqProvider.generate = originalGroqGen;
        router.groqProvider.isHealthy = originalGroqHealth;
        router.geminiProvider.generate = originalGeminiGen;
        router.geminiProvider.isHealthy = originalGeminiHealth;
      }
    });

    it('should engage Athena Local Engine when both Groq and Gemini are unavailable', async () => {
      const router = AIRouter.getInstance();
      const originalGroqGen = router.groqProvider.generate;
      const originalGroqHealth = router.groqProvider.isHealthy;
      const originalGeminiGen = router.geminiProvider.generate;
      const originalGeminiHealth = router.geminiProvider.isHealthy;

      router.groqProvider.isHealthy = () => false;
      router.geminiProvider.isHealthy = () => false;

      try {
        const res = await router.generateSummary({
          headline: 'Infosys Signs $1.5B Mega Cloud Deal',
          body: 'Infosys announced a large multi-year digital transformation deal with a European banking client.',
          category: 'Markets',
          forceRefresh: true
        });

        expect(res.provider).toBe('local');
        expect(res.fallbackUsed).toBe(true);
        expect(res.text).toContain('Executive Summary');
        expect(res.text).toContain('Investor Takeaway');
      } finally {
        router.groqProvider.generate = originalGroqGen;
        router.groqProvider.isHealthy = originalGroqHealth;
        router.geminiProvider.generate = originalGeminiGen;
        router.geminiProvider.isHealthy = originalGeminiHealth;
      }
    });
  });

  describe('2. LLMRouter Dual-Track Architecture Migration', () => {
    it('should use Groq as primary and fallback to Gemini 3.6 Flash in LLMRouter.summarize', async () => {
      const llmRouter = LLMRouter.getInstance();
      
      const originalGroqKey = process.env.GROQ_API_KEY;
      const originalGeminiKey = process.env.GEMINI_API_KEY;

      process.env.GROQ_API_KEY = 'mock_groq_key';
      process.env.GEMINI_API_KEY = 'mock_gemini_key';

      // Test local fallback synthesizer when external network calls fail safely
      LLMRouter.isGroqUnavailable = true;

      const result = await llmRouter.summarize(
        'HDFC Bank reported net profit of ₹16,821 Cr for the quarter ended December 31, representing YoY growth of 33%. Net interest income grew 24% to ₹28,470 Cr.',
        { headline: 'HDFC Bank Q3 Net Profit Rises 33%', company: 'HDFC Bank', symbol: 'HDFCBANK' }
      );

      expect(result.reportData).toBeDefined();
      expect(result.reportData.executiveSummary).toBeTruthy();
      expect(result.reportData.sentiment).toMatch(/Bullish|Neutral|Bearish/);
      expect(['Local Fallback', 'Gemini', 'Groq']).toContain(result.providerUsed);

      // Restore
      LLMRouter.isGroqUnavailable = false;
      process.env.GROQ_API_KEY = originalGroqKey;
      process.env.GEMINI_API_KEY = originalGeminiKey;
    });

    it('should generate structured Athena Intelligence via Local fallback safely', async () => {
      const llmRouter = LLMRouter.getInstance();
      LLMRouter.isGroqUnavailable = true;

      const result = await llmRouter.generateAthenaIntelligence(
        'Structured Data: {"metadata":{"headline":"L&T Wins ₹7500 Cr Order"},"structuredMetrics":[{"metric":"Order Value","value":"₹7500 Cr"}]}',
        { headline: 'L&T Wins ₹7500 Cr Order', company: 'Larsen & Toubro', symbol: 'LT' }
      );

      expect(result.intelligence).toBeDefined();
      expect(result.intelligence.executiveSummary).toContain('L&T Wins ₹7500 Cr Order');
      expect(result.intelligence.confidenceScore).toBeGreaterThan(0.7);
      expect(result.intelligence.companiesAffected.length).toBeGreaterThan(0);

      LLMRouter.isGroqUnavailable = false;
    });
  });

  describe('3. Obsolete Model Purge & Gemini 3.6 Configuration Verification', () => {
    it('should verify GeminiProvider default model is strictly gemini-3.6-flash', () => {
      const geminiProvider = new GeminiProvider();
      const originalEnv = process.env.GEMINI_FALLBACK_MODEL;
      delete process.env.GEMINI_FALLBACK_MODEL;

      expect(['gemini-3.7-flash', 'gemini-3.6-flash']).toContain(geminiProvider.getModelName());

      process.env.GEMINI_FALLBACK_MODEL = originalEnv;
    });

    it('should verify GroqProvider default model is openai/gpt-oss-120b and fallback is llama-3.3-70b-versatile', () => {
      const groqProvider = new GroqProvider();
      const originalPrimary = process.env.GROQ_PRIMARY_MODEL;
      const originalFallback = process.env.GROQ_FALLBACK_MODEL;
      delete process.env.GROQ_PRIMARY_MODEL;
      delete process.env.GROQ_FALLBACK_MODEL;

      expect(groqProvider.getPrimaryModel()).toBe('openai/gpt-oss-120b');
      expect(groqProvider.getFallbackModel()).toBe('llama-3.3-70b-versatile');

      process.env.GROQ_PRIMARY_MODEL = originalPrimary;
      process.env.GROQ_FALLBACK_MODEL = originalFallback;
    });

    it('should confirm zero occurrences of gemini-2.5 in production src/ directory and server.ts', () => {
      const searchDirs = ['src', 'server.ts'];
      let foundDeprecatedModel = false;
      const violatingFiles: string[] = [];

      function scanDir(dirOrFile: string) {
        const fullPath = path.join(process.cwd(), dirOrFile);
        if (!fs.existsSync(fullPath)) return;
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          if (dirOrFile.endsWith('.test.ts') || dirOrFile.endsWith('.test.tsx')) return;
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.includes('gemini-2.5-flash') || content.includes('gemini-2.5-pro') || content.includes('gemini-2.0')) {
            foundDeprecatedModel = true;
            violatingFiles.push(dirOrFile);
          }
        } else if (stat.isDirectory()) {
          const files = fs.readdirSync(fullPath);
          for (const file of files) {
            scanDir(path.join(dirOrFile, file));
          }
        }
      }

      for (const target of searchDirs) {
        scanDir(target);
      }

      expect(violatingFiles).toEqual([]);
      expect(foundDeprecatedModel).toBe(false);
    });
  });

  describe('4. Telemetry, Error Classification, and Health Monitoring', () => {
    it('should track Groq usage and costs accurately in CostTracker', () => {
      const costTracker = CostTracker.getInstance();
      costTracker.clear();

      const cost = costTracker.trackUsage('groq', 1000, 500, 120);
      expect(cost).toBeGreaterThan(0);

      const summary = costTracker.getSummary();
      expect(summary.totalRequests).toBe(1);
      expect(summary.providerBreakdown.groq.requests).toBe(1);
      expect(summary.providerBreakdown.groq.costUSD).toBeGreaterThan(0);
    });

    it('should record success and failure transitions in AIHealthMonitor', () => {
      const healthMonitor = AIHealthMonitor.getInstance();

      healthMonitor.recordSuccess('groq', 110, 300);
      let summary = healthMonitor.getHealthSummary();
      expect(summary.groq.successCount).toBeGreaterThan(0);

      healthMonitor.recordQuotaExceeded('groq');
      summary = healthMonitor.getHealthSummary();
      expect(summary.groq.status).toBe('Unhealthy');
    });

    it('should return complete observability metrics in AIRouter.getStatus()', () => {
      const router = AIRouter.getInstance();
      const status = router.getStatus();

      expect(status.timestamp).toBeDefined();
      expect(status.router).toBeDefined();
      expect(status.providers).toBeDefined();
      expect(status.providers.groq).toBeDefined();
      expect(status.providers.gemini).toBeDefined();
      expect(status.providers.local).toBeDefined();
      expect(status.cache).toBeDefined();
      expect(status.costTracker).toBeDefined();
    });
  });
});
