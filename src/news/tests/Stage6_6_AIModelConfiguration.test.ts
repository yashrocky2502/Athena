import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GroqProvider } from '../AI/GroqProvider';
import { GeminiProvider } from '../AI/GeminiProvider';
import { NewsAIService } from "../AI/NewsAIService";

describe('Stage 6.6: AI Model Reference Purge & Configuration Gate', () => {
  let originalGroqPrimary: string | undefined;
  let originalGroqFallback: string | undefined;
  let originalGeminiFallback: string | undefined;

  beforeEach(() => {
    originalGroqPrimary = process.env.GROQ_PRIMARY_MODEL;
    originalGroqFallback = process.env.GROQ_FALLBACK_MODEL;
    originalGeminiFallback = process.env.GEMINI_FALLBACK_MODEL;
  });

  afterEach(() => {
    if (originalGroqPrimary !== undefined) {
      process.env.GROQ_PRIMARY_MODEL = originalGroqPrimary;
    } else {
      delete process.env.GROQ_PRIMARY_MODEL;
    }

    if (originalGroqFallback !== undefined) {
      process.env.GROQ_FALLBACK_MODEL = originalGroqFallback;
    } else {
      delete process.env.GROQ_FALLBACK_MODEL;
    }

    if (originalGeminiFallback !== undefined) {
      process.env.GEMINI_FALLBACK_MODEL = originalGeminiFallback;
    } else {
      delete process.env.GEMINI_FALLBACK_MODEL;
    }
  });

  it('Test A: Primary model defaults to llama-3.3-70b-versatile when env is clear', () => {
    delete process.env.GROQ_PRIMARY_MODEL;
    const groq = new GroqProvider();
    expect(groq.getPrimaryModel()).toBe('llama-3.3-70b-versatile');
  });

  it('Test B: Groq fallback model defaults to llama-3.1-8b-instant when env is clear', () => {
    delete process.env.GROQ_FALLBACK_MODEL;
    const groq = new GroqProvider();
    expect(groq.getFallbackModel()).toBe('llama-3.1-8b-instant');
  });

  it('Test C: Gemini fallback model defaults to gemini-3.7-flash when env is clear', () => {
    delete process.env.GEMINI_FALLBACK_MODEL;
    const gemini = new GeminiProvider();
    expect(gemini.getModelName()).toBe('gemini-3.7-flash');
  });

  it('Test D: Deleting env vars forces default models', () => {
    delete process.env.GROQ_PRIMARY_MODEL;
    delete process.env.GROQ_FALLBACK_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;

    const groq = new GroqProvider();
    const gemini = new GeminiProvider();

    expect(groq.getPrimaryModel()).toBe('llama-3.3-70b-versatile');
    expect(groq.getFallbackModel()).toBe('llama-3.1-8b-instant');
    expect(gemini.getModelName()).toBe('gemini-3.7-flash');
  });

  it('Test E: Non-default configurations are correctly respected if explicitly set and valid', () => {
    process.env.GROQ_PRIMARY_MODEL = 'llama-3.1-8b-instant';
    process.env.GROQ_FALLBACK_MODEL = 'llama-3.3-70b-versatile';
    process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

    const groq = new GroqProvider();
    const gemini = new GeminiProvider();

    expect(groq.getPrimaryModel()).toBe('llama-3.1-8b-instant');
    expect(groq.getFallbackModel()).toBe('llama-3.3-70b-versatile');
    expect(gemini.getModelName()).toBe('gemini-3.1-flash-lite');
  });

  it('Test F: Invalid env models are ignored and fallback to defaults', () => {
    process.env.GROQ_PRIMARY_MODEL = 'custom-groq-primary';
    process.env.GROQ_FALLBACK_MODEL = 'custom-groq-fallback';
    process.env.GEMINI_FALLBACK_MODEL = 'custom-gemini-fallback';

    const groq = new GroqProvider();
    const gemini = new GeminiProvider();

    expect(groq.getPrimaryModel()).toBe('llama-3.3-70b-versatile');
    expect(groq.getFallbackModel()).toBe('llama-3.1-8b-instant');
    expect(gemini.getModelName()).toBe('gemini-3.7-flash');
  });

  it('Test F: All active configurations parse correctly and validate expected output properties', () => {
    const groq = new GroqProvider();
    const gemini = new GeminiProvider();

    expect(typeof groq.getPrimaryModel()).toBe('string');
    expect(typeof groq.getFallbackModel()).toBe('string');
    expect(typeof gemini.getModelName()).toBe('string');
  });

  it('Test G: No active production configuration contains mixtral-8x7b-32768', () => {
    // Scan all ts/tsx files in src/ for 'mixtral-8x7b-32768'
    const scanDir = (dirPath: string) => {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
            scanDir(fullPath);
          }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          // Skip test files
          if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
            continue;
          }
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.includes('mixtral-8x7b-32768')) {
            throw new Error(`Forbidden model mixtral-8x7b-32768 found in production file: ${fullPath}`);
          }
        }
      }
    };

    scanDir(path.join(process.cwd(), 'src'));
  });

  it('Test H: Failover behavior from Groq to Gemini works seamlessly under mock exceptions', async () => {
    const router = NewsAIService.getInstance() as any;

    // Mock GroqProvider.generate to fail (throw 429)
    const originalGroqGenerate = router.router.groqProvider.generate;
    router.router.groqProvider.generate = vi.fn().mockRejectedValue(new Error('Groq 429 Rate Limit Exceeded'));

    // Mock GeminiProvider.generate to succeed
    const originalGeminiGenerate = router.geminiProvider.generate;
    const mockGeminiResponse = {
      text: JSON.stringify({
        executiveSummary: 'This is a test summary from Gemini.',
        verifiedFacts: ['Test: Value'],
        articleSummaryBullets: ['Bullet 1'],
        whyItMatters: 'Important test details.',
        investorTakeaway: 'Buy/Hold/Sell is not recommended but this is a test.',
        confidence: 0.95,
        sentiment: 'Bullish',
        timeline: []
      }),
      provider: 'gemini',
      confidence: 90,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 120,
      costEstimate: 0.001,
      fallbackUsed: true
    };
    router.geminiProvider.generate = vi.fn().mockResolvedValue(mockGeminiResponse);

    const result = await NewsAIService.getInstance().generateSummary({
      headline: 'Mock Headline',
      body: 'Mock Body content for testing failover logic from Groq to Gemini fallback.',
      forceRefresh: true
    });

    // Verify Groq was called and failed, then Gemini succeeded
    expect(router.router.groqProvider.generate).toHaveBeenCalled();
    expect(router.geminiProvider.generate).toHaveBeenCalled();
    expect(result.provider).toBe('gemini');
    const parsedText = JSON.parse(result.text);
    expect(parsedText.executiveSummary).toBe('This is a test summary from Gemini.');

    // Restore original methods
    router.router.groqProvider.generate = originalGroqGenerate;
    router.geminiProvider.generate = originalGeminiGenerate;
  });
});
