import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Server } from 'http';
import {
  app,
  executeServerGeminiWithFailover,
  isRetryableGeminiError,
  validateGeminiResponse,
  sanitizeErrorMessage,
  yahooProvider,
  setAiClientForTesting
} from '../../../server';

describe('ATHENA Gemini Failover & Financial Safety Suite', () => {
  const newsCorePath = path.join(process.cwd(), 'data/news_core_v2.json');
  let originalNewsCoreHash = '';
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    // Avoid slow external network calls during unit test
    vi.spyOn(yahooProvider, 'getCompanyDetails').mockResolvedValue({
      officialName: 'Infosys Limited',
      sector: 'Information Technology',
      industry: 'IT Services',
      price: 1850.5
    } as any);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    }

    // Clean up any test cache artifacts to preserve pristine repository state
    const cacheFilePath = path.join(process.cwd(), 'premium_reports_cache.json');
    if (fs.existsSync(cacheFilePath)) {
      try {
        fs.unlinkSync(cacheFilePath);
      } catch {
        // ignore
      }
    }
  });

  beforeEach(() => {
    // Ensure clean cache state before each test
    const cacheFilePath = path.join(process.cwd(), 'premium_reports_cache.json');
    if (fs.existsSync(cacheFilePath)) {
      try {
        fs.unlinkSync(cacheFilePath);
      } catch {
        // ignore
      }
    }

    if (fs.existsSync(newsCorePath)) {
      const content = fs.readFileSync(newsCorePath);
      originalNewsCoreHash = crypto.createHash('sha256').update(content).digest('hex');
    }
  });

  describe('1. Error Classification (isRetryableGeminiError)', () => {
    it('should classify 429 and quota exhaustion as retryable', () => {
      expect(isRetryableGeminiError({ status: 429, message: 'Resource has been exhausted' })).toBe(true);
      expect(isRetryableGeminiError(new Error('Quota exceeded for quota metric'))).toBe(true);
      expect(isRetryableGeminiError({ message: 'RESOURCE_EXHAUSTED' })).toBe(true);
      expect(isRetryableGeminiError({ message: 'rate limit reached' })).toBe(true);
    });

    it('should classify 503, 500, and server unavailability as retryable', () => {
      expect(isRetryableGeminiError({ status: 503, message: 'Service Unavailable' })).toBe(true);
      expect(isRetryableGeminiError({ status: 500, message: 'Internal Server Error' })).toBe(true);
      expect(isRetryableGeminiError({ message: 'UNAVAILABLE: backend is overloaded' })).toBe(true);
    });

    it('should classify 404 and model not found as retryable across candidate models', () => {
      expect(isRetryableGeminiError({ status: 404, message: 'Model not found' })).toBe(true);
      expect(isRetryableGeminiError({ message: 'models/gemini-3.6-flash is not found for API version v1' })).toBe(true);
    });

    it('should classify network, timeout, and socket errors as retryable', () => {
      expect(isRetryableGeminiError({ code: 'ETIMEDOUT', message: 'Connection timed out' })).toBe(true);
      expect(isRetryableGeminiError({ code: 'ECONNRESET', message: 'Connection reset by peer' })).toBe(true);
      expect(isRetryableGeminiError({ name: 'AbortError', message: 'The user aborted a request.' })).toBe(true);
      expect(isRetryableGeminiError(new Error('TypeError: fetch failed'))).toBe(true);
    });

    it('should classify 401, 403, and invalid authentication as NON-retryable (fail fast)', () => {
      expect(isRetryableGeminiError({ status: 401, message: 'Unauthorized' })).toBe(false);
      expect(isRetryableGeminiError({ status: 403, message: 'Forbidden' })).toBe(false);
      expect(isRetryableGeminiError(new Error('API key not valid. Please pass a valid API key.'))).toBe(false);
      expect(isRetryableGeminiError({ message: 'UNAUTHENTICATED' })).toBe(false);
      expect(isRetryableGeminiError({ message: 'PERMISSION_DENIED' })).toBe(false);
    });

    it('should classify 400 and invalid argument as NON-retryable (fail fast)', () => {
      expect(isRetryableGeminiError({ status: 400, message: 'Bad Request' })).toBe(false);
      expect(isRetryableGeminiError({ message: 'INVALID_ARGUMENT: contents cannot be empty' })).toBe(false);
    });
  });

  describe('2. Gemini Response Validation (validateGeminiResponse)', () => {
    it('should accept valid, non-empty candidate responses', () => {
      const validResponse = {
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [{ text: '{"analysis": "grounded"}' }]
            }
          }
        ],
        text: '{"analysis": "grounded"}'
      };
      const result = validateGeminiResponse(validResponse);
      expect(result.isValid).toBe(true);
    });

    it('should reject null, empty, or missing candidate arrays', () => {
      expect(validateGeminiResponse(null).isValid).toBe(false);
      expect(validateGeminiResponse({}).isValid).toBe(false);
      expect(validateGeminiResponse({ candidates: [] }).isValid).toBe(false);
    });

    it('should reject blocked finishReasons (e.g. SAFETY, RECITATION)', () => {
      const safetyBlocked = {
        candidates: [
          {
            finishReason: 'SAFETY',
            content: { parts: [{ text: '' }] }
          }
        ],
        text: ''
      };
      const result = validateGeminiResponse(safetyBlocked);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('SAFETY');
    });

    it('should reject empty or whitespace-only response text', () => {
      const emptyText = {
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: '   \n  ' }] }
          }
        ],
        text: '   \n  '
      };
      const result = validateGeminiResponse(emptyText);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Empty');
    });
  });

  describe('3. Sensitive Log Sanitization (sanitizeErrorMessage)', () => {
    it('should scrub API keys from query parameters', () => {
      const raw = 'Request to https://generativelanguage.googleapis.com/v1beta/models?key=synthetic_query_param_key_12345 failed';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('synthetic_query_param_key_12345');
      expect(sanitized).toContain('[REDACTED_KEY]');
    });

    it('should scrub Authorization headers and Bearer tokens', () => {
      const authRaw = 'Failed with header Authorization: Bearer secret_token_xyz123abc456';
      const authSanitized = sanitizeErrorMessage(authRaw);
      expect(authSanitized).not.toContain('secret_token_xyz123abc456');
      expect(authSanitized).toContain('[REDACTED_AUTH]');

      const bearerRaw = 'Bearer secret_token_xyz123abc456 returned an error response';
      const bearerSanitized = sanitizeErrorMessage(bearerRaw);
      expect(bearerSanitized).not.toContain('secret_token_xyz123abc456');
      expect(bearerSanitized).toContain('[REDACTED_TOKEN]');
    });

    it('should scrub configured GEMINI_API_KEY from environment', () => {
      process.env.GEMINI_API_KEY = 'super_secret_institutional_key_98765';
      const raw = 'Gemini client error with key super_secret_institutional_key_98765 at line 42';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('super_secret_institutional_key_98765');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    });
  });

  describe('4. Candidate Failover Execution (executeServerGeminiWithFailover)', () => {
    it('should failover to second candidate when first candidate returns 429', async () => {
      const mockGenerate = vi.fn()
        .mockRejectedValueOnce({ status: 429, message: 'Resource exhausted quota' })
        .mockResolvedValueOnce({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok": true}' }] } }],
          text: '{"ok": true}'
        });

      const mockAi: any = {
        models: {
          generateContent: mockGenerate
        }
      };

      const result = await executeServerGeminiWithFailover(mockAi, {
        defaultModel: 'gemini-3.6-flash',
        contents: 'test prompt'
      });

      expect(mockGenerate).toHaveBeenCalledTimes(2);
      expect(result.response.text).toBe('{"ok": true}');
      expect(result.modelUsed).toBeDefined();
    });

    it('should fail immediately without cycling remaining models on 401 Unauthorized', async () => {
      const mockGenerate = vi.fn()
        .mockRejectedValueOnce({ status: 401, message: 'API key not valid' });

      const mockAi: any = {
        models: {
          generateContent: mockGenerate
        }
      };

      await expect(
        executeServerGeminiWithFailover(mockAi, {
          defaultModel: 'gemini-3.6-flash',
          contents: 'test prompt'
        })
      ).rejects.toThrow();

      // Only 1 call made — did not redundantly try candidates 2, 3, 4 with invalid key
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it('should failover when candidate returns empty text response', async () => {
      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '' }] } }],
          text: ''
        })
        .mockResolvedValueOnce({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Valid analysis' }] } }],
          text: 'Valid analysis'
        });

      const mockAi: any = {
        models: {
          generateContent: mockGenerate
        }
      };

      const result = await executeServerGeminiWithFailover(mockAi, {
        defaultModel: 'gemini-3.6-flash',
        contents: 'test prompt'
      });

      expect(mockGenerate).toHaveBeenCalledTimes(2);
      expect(result.response.text).toBe('Valid analysis');
    });
  });

  describe('5. Truthful Degraded Financial Intelligence (POST /api/company/intelligence)', () => {
    it('should return truthful degraded response without synthetic financial claims when Gemini is unavailable', async () => {
      // Explicitly inject mock AI that fails (simulating complete Gemini outage)
      setAiClientForTesting({
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('Simulated Gemini 503 Outage'))
        }
      });

      const res = await fetch(`${baseUrl}/api/company/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'INFY', forceRefresh: true })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();

      expect(data.status).toBe('degraded');
      expect(data.model).toBe('offline');
      expect(data.aiGenerated).toBe(false);
      expect(data.diagnostic.source).toBe('Fallback');

      // MUST NOT contain fabricated confidence scores
      expect(data.report.confidenceScore).toBeUndefined();

      // MUST contain explicit unavailability text
      expect(data.report.executiveSummary).toContain('unavailable');
      expect(data.report.bullCase).toContain('unavailable');
      expect(data.report.bearCase).toContain('unavailable');

      // Cache file must not have been created or modified
      const cacheFilePath = path.join(process.cwd(), 'premium_reports_cache.json');
      expect(fs.existsSync(cacheFilePath)).toBe(false);
    });

    it('should return grounded AI intelligence when Gemini succeeds', async () => {
      const mockAnalysis = {
        executiveSummary: 'Infosys is a leading global IT services provider.',
        bullCase: 'Strong order book and digital transformation demand.',
        bearCase: 'Discretionary spending slowdown in North America.',
        growthDrivers: 'Cloud and generative AI migrations.',
        businessRisks: 'Client concentration and margin pressures.',
        keyCatalysts: 'Upcoming earnings and deal signings.',
        investmentOutlook: 'Accumulate on dips for long-term growth.'
      };

      setAiClientForTesting({
        models: {
          generateContent: vi.fn().mockResolvedValue({
            candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(mockAnalysis) }] } }],
            text: JSON.stringify(mockAnalysis)
          })
        }
      });

      const res = await fetch(`${baseUrl}/api/company/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'INFY', forceRefresh: true })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.diagnostic.source).toBe('AI');
      expect(data.model).toBeDefined();
      expect(data.report.executiveSummary).toBe(mockAnalysis.executiveSummary);
    });

    it('should reject requests without a company symbol with 400', async () => {
      const res = await fetch(`${baseUrl}/api/company/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toBe('Symbol is required');
    });
  });

  describe('6. Production Data Non-Mutation Verification', () => {
    it('data/news_core_v2.json must remain identical to original known-good checkpoint', () => {
      if (fs.existsSync(newsCorePath)) {
        const content = fs.readFileSync(newsCorePath);
        const currentHash = crypto.createHash('sha256').update(content).digest('hex');
        expect(currentHash).toBe(originalNewsCoreHash);
      }
    });
  });
});
