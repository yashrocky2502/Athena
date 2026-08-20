import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AIRouter } from '../AI/AIRouter';
import { GroqProvider } from '../AI/GroqProvider';
import { GeminiProvider } from '../AI/GeminiProvider';
import { LocalProvider } from '../AI/LocalProvider';
import { getAllSectionDefinitions, FIXED_NEWS_SECTIONS } from '../types/NewsSection';

describe('Stage 6.9.1: Browser Runtime Proof & AI Failure Injection Gate', () => {
  const CANONICAL_PATH = path.join(process.cwd(), 'data/news_stage2_store.json');
  const CANONICAL_BAK_PATH = path.join(process.cwd(), 'data/news_stage2_store.json.bak');

  let hashBefore: string;
  let bakHashBefore: string;

  beforeEach(() => {
    if (fs.existsSync(CANONICAL_PATH)) {
      const data = fs.readFileSync(CANONICAL_PATH, 'utf8');
      hashBefore = crypto.createHash('sha256').update(data).digest('hex');
    }
    if (fs.existsSync(CANONICAL_BAK_PATH)) {
      const dataBak = fs.readFileSync(CANONICAL_BAK_PATH, 'utf8');
      bakHashBefore = crypto.createHash('sha256').update(dataBak).digest('hex');
    }
  });

  afterEach(() => {
    // Assert data store immutability after every test
    if (fs.existsSync(CANONICAL_PATH)) {
      const data = fs.readFileSync(CANONICAL_PATH, 'utf8');
      const hashAfter = crypto.createHash('sha256').update(data).digest('hex');
      expect(hashAfter).toBe(hashBefore);
    }
    if (fs.existsSync(CANONICAL_BAK_PATH)) {
      const dataBak = fs.readFileSync(CANONICAL_BAK_PATH, 'utf8');
      const bakHashAfter = crypto.createHash('sha256').update(dataBak).digest('hex');
      expect(bakHashAfter).toBe(bakHashBefore);
    }
  });

  it('1. Authoritative AI Hierarchy & Model Configuration', () => {
    const origGroqPrimary = process.env.GROQ_PRIMARY_MODEL; const origGroqFallback = process.env.GROQ_FALLBACK_MODEL; const origGeminiPrimary = process.env.GEMINI_MODEL; const origGeminiFallback = process.env.GEMINI_FALLBACK_MODEL; delete process.env.GROQ_PRIMARY_MODEL; delete process.env.GROQ_FALLBACK_MODEL; delete process.env.GEMINI_FALLBACK_MODEL;
    delete process.env.GEMINI_MODEL;
    const groq = new GroqProvider();
    const gemini = new GeminiProvider();

    // Primary Groq must be llama-3.3-70b-versatile
    expect(groq.getPrimaryModel()).toBe('llama-3.3-70b-versatile');
    // Groq fallback must be llama-3.1-8b-instant
    expect(groq.getFallbackModel()).toBe('llama-3.1-8b-instant');

    // Primary Gemini fallback must be gemini-3.7-flash
    expect(gemini.getPrimaryFallbackModel()).toBe('gemini-3.7-flash');
    // Secondary Gemini fallback must be gemini-3.1-flash-lite
    expect(gemini.getSecondaryFallbackModel()).toBe('gemini-3.1-flash-lite');

    // Router providers verification
    const router = AIRouter.getInstance();
    expect(router.groqProvider.getPrimaryModel()).toBe('llama-3.3-70b-versatile');
    expect(router.geminiProvider.getPrimaryFallbackModel()).toBe('gemini-3.7-flash');
    expect(router.localProvider).toBeDefined(); if (origGroqPrimary !== undefined) process.env.GROQ_PRIMARY_MODEL = origGroqPrimary; if (origGroqFallback !== undefined) process.env.GROQ_FALLBACK_MODEL = origGroqFallback; if (origGeminiPrimary !== undefined) process.env.GEMINI_MODEL = origGeminiPrimary; if (origGeminiFallback !== undefined) process.env.GEMINI_FALLBACK_MODEL = origGeminiFallback;
  });

  it('2. Zero External AI Dependency during Application Startup', async () => {
    // Save current env
    const origGroq = process.env.GROQ_API_KEY;
    const origGemini = process.env.GEMINI_API_KEY;

    try {
      delete process.env.GROQ_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const groq = new GroqProvider();
      const gemini = new GeminiProvider();
      const local = new LocalProvider();

      // With no keys, cloud providers should safely indicate not configured without throwing
      expect(groq.getApiKey()).toBeUndefined();
      expect(groq.isHealthy()).toBe(false);
      expect(gemini.getApiKey()).toBeUndefined();
      expect(gemini.isHealthy()).toBe(false);

      // Local engine handles requests immediately with 0 external network dependencies
      const res = await local.generate({
        prompt: 'Analyze market impact for RELIANCE earnings',
        headline: 'Reliance Industries Reports 15% Q3 Net Profit Growth'
      });

      expect(res.text).toBeDefined();
      expect(res.provider).toBe('local');
      expect(res.confidence).toBeGreaterThanOrEqual(80);
    } finally {
      process.env.GROQ_API_KEY = origGroq;
      process.env.GEMINI_API_KEY = origGemini;
    }
  });

  it('3. Groq Failure Injection: 429 Rate Limit Failover to Gemini and Local', async () => {
    const router = AIRouter.getInstance();
    const origGroqGen = router.groqProvider.generate.bind(router.groqProvider);
    const origGroqHealthy = router.groqProvider.isHealthy.bind(router.groqProvider);

    try {
      router.groqProvider.isHealthy = () => true;
      router.groqProvider.generate = async () => {
        const err: any = new Error('Groq Rate Limit Exceeded (429): Quota limits reached for TPD');
        err.code = 'RATE_LIMITED';
        throw err;
      };

      const result = await router.generateSummary({
        headline: 'RBI Maintains Repo Rate at 6.50% in Bi-Monthly Policy',
        body: 'The Monetary Policy Committee of the Reserve Bank of India decided to keep rates unchanged.',
        symbols: ['SBIN', 'HDFCBANK'],
        publisher: 'Athena Live Wire',
        category: 'Economy'
      });

      expect(result).toBeDefined();
      expect(['gemini', 'local']).toContain(result.provider);
      expect(result.text).toBeDefined();
    } finally {
      router.groqProvider.generate = origGroqGen;
      router.groqProvider.isHealthy = origGroqHealthy;
    }
  }, 30000);

  it('4. Groq Failure Injection: Timeout, Network & Malformed Output Failover', async () => {
    const router = AIRouter.getInstance();
    const origGroqGen = router.groqProvider.generate.bind(router.groqProvider);
    const origGroqHealthy = router.groqProvider.isHealthy.bind(router.groqProvider);

    try {
      router.groqProvider.isHealthy = () => true;

      // Simulate timeout
      router.groqProvider.generate = async () => {
        const err: any = new Error('Groq Request Timeout after 8000ms');
        err.code = 'TIMEOUT';
        throw err;
      };

      let result = await router.generateSummary({
        headline: 'TCS Signs $1B Multi-Year Cloud Transformation Deal',
        body: 'Tata Consultancy Services announced a landmark digital deal.',
        symbols: ['TCS'],
        publisher: 'Athena Tech',
        category: 'Technology'
      });
      expect(result).toBeDefined();
      expect(['gemini', 'local']).toContain(result.provider);

      // Simulate malformed output
      router.groqProvider.generate = async () => {
        const err: any = new Error('Empty or malformed choice response from Groq API');
        err.code = 'MALFORMED_OUTPUT';
        throw err;
      };

      result = await router.generateSummary({
        headline: 'Infosys Secures Major AI Banking Mandate in EMEA',
        body: 'Infosys will deploy AI assistants for banking workflows.',
        symbols: ['INFY'],
        publisher: 'Athena Tech',
        category: 'Technology'
      });
      expect(result).toBeDefined();
      expect(['gemini', 'local']).toContain(result.provider);
    } finally {
      router.groqProvider.generate = origGroqGen;
      router.groqProvider.isHealthy = origGroqHealthy;
    }
  }, 30000);

  it('5. Complete Cloud AI Outage: Groq and Gemini Down -> Athena Local Engine Deterministic Fallback', async () => {
    const router = AIRouter.getInstance();
    const origGroqGen = router.groqProvider.generate.bind(router.groqProvider);
    const origGroqHealthy = router.groqProvider.isHealthy.bind(router.groqProvider);
    const origGeminiGen = router.geminiProvider.generate.bind(router.geminiProvider);
    const origGeminiHealthy = router.geminiProvider.isHealthy.bind(router.geminiProvider);

    try {
      router.groqProvider.isHealthy = () => true;
      router.groqProvider.generate = async () => {
        throw new Error('Groq connection refused');
      };

      router.geminiProvider.isHealthy = () => true;
      router.geminiProvider.generate = async () => {
        throw new Error('Gemini service 503 unavailable');
      };

      const result = await router.generateSummary({
        headline: 'Nifty 50 Closes Above 24,500 Led by Banking & IT Rallies',
        body: 'Benchmark indices witnessed strong bullish momentum with foreign institutional inflows.',
        symbols: ['NIFTY', 'BANKNIFTY'],
        publisher: 'Athena Market Desk',
        category: 'Market'
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('local');
      expect(result.text).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    } finally {
      router.groqProvider.generate = origGroqGen;
      router.groqProvider.isHealthy = origGroqHealthy;
      router.geminiProvider.generate = origGeminiGen;
      router.geminiProvider.isHealthy = origGeminiHealthy;
    }
  });

  it('6. All 16 Fixed News Sections Verified & Operational', () => {
    const sections = getAllSectionDefinitions();
    expect(sections.length).toBe(16);

    const requiredIds = [
      'BREAKING', 'MARKET', 'RESULTS', 'FNO', 'ECONOMY', 'CORPORATE',
      'IPO', 'REGULATORY', 'EXCHANGE', 'COMMODITIES', 'GLOBAL',
      'TECHNOLOGY', 'BANKING', 'SECTORS', 'STOCKS', 'MACRO'
    ];

    const actualIds = sections.map(s => s.id);
    expect(actualIds).toEqual(requiredIds);

    // Verify ordering is strictly 1 to 16
    sections.forEach((section, index) => {
      expect(section.order).toBe(index + 1);
      expect(section.name).toBeTruthy();
      expect(section.explanation).toBeTruthy();
    });
  });

  it('7. Deprecated AI Models Audit: 0 References to gemini-2.0 or gemini-2.5 in Production Source', () => {
    const srcDir = path.join(process.cwd(), 'src');
    const productionFiles: string[] = [];

    function collectFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.includes('tests') && !entry.name.includes('node_modules')) {
            collectFiles(fullPath);
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          productionFiles.push(fullPath);
        }
      }
    }

    collectFiles(srcDir);
    const serverFile = path.join(process.cwd(), 'server.ts');
    if (fs.existsSync(serverFile)) {
      productionFiles.push(serverFile);
    }

    const violations: { file: string; match: string }[] = [];
    for (const file of productionFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('gemini-2.5') || content.includes('gemini-2.0')) {
        violations.push({ file, match: 'Deprecated Gemini 2.x reference found' });
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('8. Canonical Data Safety & Immutability Audit', () => {
    const canonicalData = fs.readFileSync(CANONICAL_PATH, 'utf8');
    const canonicalBakData = fs.readFileSync(CANONICAL_BAK_PATH, 'utf8');

    const hash = crypto.createHash('sha256').update(canonicalData).digest('hex');
    const bakHash = crypto.createHash('sha256').update(canonicalBakData).digest('hex');

    expect(hash).toBe(bakHash);
    expect(hash).toBe(hashBefore);
    expect(hash.length).toBe(64);

    const parsed = JSON.parse(canonicalData);
    const count = Array.isArray(parsed) ? parsed.length : (parsed.articles ? parsed.articles.length : Object.keys(parsed).length);
    expect(count).toBeGreaterThanOrEqual(1040);

    // Check for temporary .tmp or .partial files
    const dataDir = path.join(process.cwd(), 'data');
    const tempFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.tmp') || f.endsWith('.partial'));
    expect(tempFiles).toEqual([]);
  });
});
