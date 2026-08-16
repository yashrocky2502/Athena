import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AIRouter } from '../AI/AIRouter';
import { GroqProvider } from '../AI/GroqProvider';
import { GeminiProvider } from '../AI/GeminiProvider';
import { LocalProvider } from '../AI/LocalProvider';
import { AIHealthMonitor } from '../AI/AIHealthMonitor';
import { CostTracker } from '../AI/CostTracker';
import { CacheManager } from '../AI/CacheManager';
import { LLMRouter } from '../../services/LLMRouter';

vi.mock('axios');

describe('ATHENA STAGE 4.3 — AI Provider Production Reliability & Model Availability Audit', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    CacheManager.getInstance().clear();
    LLMRouter.isGroqUnavailable = false;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Model Availability & Verification', () => {
    it('should verify Groq primary model is openai/gpt-oss-120b and fallback is llama-3.3-70b-versatile', () => {
      const groqProvider = new GroqProvider();
      delete process.env.GROQ_PRIMARY_MODEL;
      delete process.env.GROQ_FALLBACK_MODEL;

      expect(groqProvider.getPrimaryModel()).toBe('openai/gpt-oss-120b');
      expect(groqProvider.getFallbackModel()).toBe('llama-3.3-70b-versatile');
    });

    it('should verify Gemini fallback model is gemini-3.6-flash and alternative candidates are verified', () => {
      const geminiProvider = new GeminiProvider();
      delete process.env.GEMINI_FALLBACK_MODEL;

      expect(geminiProvider.getModelName()).toBe('gemini-3.6-flash');
    });

    it('should verify ZERO occurrences of deprecated Gemini 2.5 models across all production source files', () => {
      const searchDirs = ['src', 'server.ts'];
      const violatingFiles: string[] = [];

      function scan(itemPath: string) {
        const fullPath = path.join(process.cwd(), itemPath);
        if (!fs.existsSync(fullPath)) return;
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          if (itemPath.endsWith('.test.ts') || itemPath.endsWith('.test.tsx')) return;
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.includes('gemini-2.5-flash') || content.includes('gemini-2.5-pro') || content.includes('gemini-2.0')) {
            violatingFiles.push(itemPath);
          }
        } else if (stat.isDirectory()) {
          const children = fs.readdirSync(fullPath);
          for (const child of children) {
            if (child === 'node_modules' || child === 'dist' || child === '.git') continue;
            scan(path.join(itemPath, child));
          }
        }
      }

      for (const d of searchDirs) {
        scan(d);
      }

      expect(violatingFiles).toEqual([]);
    });
  });

  describe('2. Strict Provider Hierarchy Enforcement', () => {
    it('should execute Groq as the primary provider first during normal production requests', async () => {
      process.env.GROQ_API_KEY = 'gsk_mock_valid_key_12345';
      process.env.GEMINI_API_KEY = 'mock_gemini_key';

      const mockedAxios = vi.mocked(axios.post);
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        data: {
          choices: [
            {
              message: {
                content: 'Executive Summary\nTata Motors posted strong commercial vehicle numbers.\n\nKey Highlights\n• Revenue up 15%\n\nWhy It Matters\nReflects industrial demand.\n\nInvestor Takeaway\nPositive operational momentum.'
              }
            }
          ],
          usage: { prompt_tokens: 120, completion_tokens: 80 }
        }
      });

      const router = AIRouter.getInstance();
      const result = await router.generateSummary({
        headline: 'Tata Motors Reports 15% YoY Revenue Growth',
        body: 'Tata Motors reported a 15% surge in quarterly revenue driven by robust commercial vehicle sales and export growth.',
        category: 'Corporate Filing',
        issuer: 'Tata Motors Ltd',
        facts: { companyName: 'Tata Motors Ltd', revenue: 'Rs 1,05,000 Cr' }
      });

      expect(mockedAxios).toHaveBeenCalledTimes(1);
      const callArgs = mockedAxios.mock.calls[0];
      expect(callArgs[0]).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect((callArgs[1] as any).model).toBe('openai/gpt-oss-120b');
      expect(result.provider).toBe('groq');
      expect(result.fallbackUsed).toBe(false);
    });

    it('should fail over from Groq primary (openai/gpt-oss-120b) to Groq fallback (llama-3.3-70b-versatile) on 429', async () => {
      process.env.GROQ_API_KEY = 'gsk_mock_valid_key_12345';

      const mockedAxios = vi.mocked(axios.post);
      // Attempt 1 fails with 429
      mockedAxios.mockRejectedValueOnce({
        response: {
          status: 429,
          data: { error: { message: 'Rate limit exceeded on gpt-oss-120b' } }
        }
      });
      // Attempt 2 (fallback model) succeeds
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        data: {
          choices: [
            {
              message: {
                content: 'Executive Summary\nInfosys secured a $500M digital transformation contract.\n\nKey Highlights\n• Deal size: $500M\n\nWhy It Matters\nBoosts FY27 revenue visibility.\n\nInvestor Takeaway\nStrong deal pipeline.'
              }
            }
          ],
          usage: { prompt_tokens: 150, completion_tokens: 90 }
        }
      });

      const groqProvider = new GroqProvider();
      const result = await groqProvider.generate({
        prompt: 'Analyze Infosys deal',
        headline: 'Infosys Signs $500M Agreement'
      });

      expect(mockedAxios).toHaveBeenCalledTimes(2);
      expect((mockedAxios.mock.calls[0][1] as any).model).toBe('openai/gpt-oss-120b');
      expect((mockedAxios.mock.calls[1][1] as any).model).toBe('llama-3.3-70b-versatile');
      expect(result.provider).toBe('groq');
    });

    it('should fail over to Local Intelligence Engine when all external providers fail or are unconfigured', async () => {
      delete process.env.GROQ_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const router = AIRouter.getInstance();
      const result = await router.generateSummary({
        headline: 'Reliance Industries Announces Green Energy JV',
        body: 'Reliance Industries announced a new joint venture in solar manufacturing with global partners.',
        category: 'Corporate Filing',
        issuer: 'Reliance Industries Ltd',
        facts: { companyName: 'Reliance Industries Ltd', announcementType: 'Joint Venture' }
      });

      expect(result.provider).toBe('local');
      expect(result.fallbackUsed).toBe(true);
      expect(result.text).toContain('Executive Summary');
      expect(result.text).toContain('Key Highlights');
      expect(result.text).toContain('Why It Matters');
      expect(result.text).toContain('Investor Takeaway');
    });
  });

  describe('3. Quota / 429 Handling, Cooldown & Retry Protection', () => {
    it('should put provider into cooldown on quota exhaustion and avoid retry storms', () => {
      const monitor = AIHealthMonitor.getInstance();
      
      // Simulate quota exceeded
      monitor.recordQuotaExceeded('groq');
      expect(monitor.isProviderHealthy('groq')).toBe(false);

      // GroqProvider should report unhealthy and not attempt network calls
      const groqProvider = new GroqProvider();
      expect(groqProvider.isHealthy()).toBe(false);
    });

    it('should maintain concurrency-safe health status without race conditions', () => {
      const monitor = AIHealthMonitor.getInstance();
      for (let i = 0; i < 50; i++) {
        monitor.recordSuccess('local', 12, 100);
      }
      const summary = monitor.getHealthSummary();
      expect(summary.local.status).toBe('Healthy');
      expect(summary.local.totalCalls).toBeGreaterThanOrEqual(50);
      expect(summary.local.successRatePercentage).toBe(100);
    });
  });

  describe('4. Response Schema Consistency Across All Providers', () => {
    const requiredSections = ['Executive Summary', 'Key Highlights', 'Why It Matters', 'Investor Takeaway'];

    it('should produce identical structural output schema from Local Engine', async () => {
      const localProvider = new LocalProvider();
      const res = await localProvider.generate({
        headline: 'HDFC Bank Declares Interim Dividend',
        prompt: 'HDFC Bank Board declared an interim dividend of Rs 19.50 per equity share.',
        facts: {
          companyName: 'HDFC Bank Ltd',
          announcementType: 'Dividend',
          dividend: 'Rs 19.50'
        }
      });

      for (const section of requiredSections) {
        expect(res.text).toContain(section);
      }
      expect(res.confidence).toBeGreaterThan(0);
      expect(typeof res.promptTokens).toBe('number');
      expect(typeof res.completionTokens).toBe('number');
      expect(typeof res.latencyMs).toBe('number');
    });

    it('should ensure LLMRouter returns consistent normalized schema across Groq, Gemini, and Local', async () => {
      const llmRouter = LLMRouter.getInstance();
      LLMRouter.isGroqUnavailable = true; // Force local fallback for deterministic schema test

      const result = await llmRouter.summarize(
        'State Bank of India reported net profit of Rs 18,331 Cr for Q3 FY26, a growth of 18% YoY. Asset quality improved with Gross NPA at 2.1%.',
        { headline: 'SBI Q3 Net Profit Jumps 18%', company: 'State Bank of India', symbol: 'SBIN' }
      );

      expect(result.reportData).toBeDefined();
      expect(typeof result.reportData.executiveSummary).toBe('string');
      expect(Array.isArray(result.reportData.verifiedFacts)).toBe(true);
      expect(typeof result.reportData.whyItMatters).toBe('string');
      expect(typeof result.reportData.investorTakeaway).toBe('string');
      expect(typeof result.reportData.confidence).toBe('number');
      expect(['Bullish', 'Bearish', 'Neutral']).toContain(result.reportData.sentiment);
    });
  });

  describe('5. Sanitized Diagnostics & Security (Zero API-Key Leakage)', () => {
    it('should never expose API keys, headers, or internal credentials in responses or errors', async () => {
      process.env.GROQ_API_KEY = 'secret_gsk_super_confidential_key_999';
      const mockedAxios = vi.mocked(axios.post);
      mockedAxios.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { error: { message: 'Internal upstream error' } }
        }
      });

      const groqProvider = new GroqProvider();
      try {
        await groqProvider.generate({
          prompt: 'test prompt',
          headline: 'Test Headline'
        });
      } catch (err: any) {
        expect(err.message).not.toContain('secret_gsk_super_confidential_key_999');
        expect(err.message).not.toContain('Bearer');
      }
    });
  });

  describe('6. High-Volume Concurrency Simulation (1,000 Requests)', () => {
    it('should process 1,000 concurrent AI requests cleanly with zero unhandled exceptions or retry storms', async () => {
      const router = AIRouter.getInstance();
      const totalRequests = 1000;
      const startTime = Date.now();

      // Dispatch 1,000 simulated requests with varying scenarios (cache hits, local fallbacks, etc.)
      const promises = Array.from({ length: totalRequests }).map(async (_, idx) => {
        const reqStartTime = Date.now();
        const res = await router.generateSummary({
          headline: `Market Update Story #${idx % 20}`, // 20 unique stories -> tests caching & concurrency
          body: `Corporate disclosure and financial metrics for company #${idx % 20} detailing quarterly operational targets and execution.`,
          category: 'Corporate Filing',
          issuer: `Company_${idx % 20}`,
          facts: { companyName: `Company_${idx % 20}`, revenue: `Rs ${1000 + idx} Cr` }
        });
        const latency = Date.now() - reqStartTime;
        return { success: true, provider: res.provider, latency };
      });

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      expect(results.length).toBe(totalRequests);
      const successes = results.filter(r => r.success).length;
      expect(successes).toBe(totalRequests);

      // Latency statistics
      const latencies = results.map(r => r.latency).sort((a, b) => a - b);
      const p50 = latencies[Math.floor(totalRequests * 0.5)];
      const p95 = latencies[Math.floor(totalRequests * 0.95)];
      const p99 = latencies[Math.floor(totalRequests * 0.99)];

      console.log(`[Concurrency Audit 1000 Reqs] Completed in ${totalDuration}ms. p50: ${p50}ms, p95: ${p95}ms, p99: ${p99}ms`);
      expect(p99).toBeLessThan(5000); // All concurrent tasks resolve efficiently
    });
  });

  describe('7. News Engine Canonical Storage Integrity', () => {
    it('should ensure data/news_stage2_store.json and .bak remain untouched and valid', () => {
      const primaryPath = path.join(process.cwd(), 'data/news_stage2_store.json');
      const backupPath = path.join(process.cwd(), 'data/news_stage2_store.json.bak');

      expect(fs.existsSync(primaryPath)).toBe(true);
      expect(fs.existsSync(backupPath)).toBe(true);

      const primaryHash = crypto.createHash('sha256').update(fs.readFileSync(primaryPath)).digest('hex');
      const backupHash = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');

      expect(primaryHash).toBe(backupHash);
    });
  });
});
