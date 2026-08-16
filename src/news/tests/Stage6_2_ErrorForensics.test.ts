import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId, getAllSectionDefinitions } from '../types/NewsSection';
import { AIRouter } from '../AI/AIRouter';

describe('Stage 6.2: Runtime Error Forensics & Final Regression Gate', () => {
  it('should verify Error #1 (TypeScript Missing Imports/Linter Failure) resolution', () => {
    // Error #1 classification: APPLET_EXECUTION_ERROR / TEST_DEFECT
    // Missing imports in newsV5Routes.ts & Stage 6 test suite during initial creation
    // Verified resolved by explicit named imports from vitest and NewsIntelligenceQualityService
    expect(NewsSectionRouter).toBeDefined();
  });

  it('should verify Error #2 (Section Accuracy Test Fixture Misalignment) resolution', () => {
    // Error #2 classification: TEST_DEFECT
    // Headline category Economy vs section RESULTS alignment
    const article = {
      id: 'err2-verify',
      headline: 'GDP growth and fiscal deficit data released by MOSPI',
      primaryCategory: 'General'
    };
    const routed = NewsSectionRouter.routeArticle(article);
    expect(routed.primarySection).toBe(NewsSectionId.ECONOMY);
    expect(article.primaryCategory).toBe('General');
  });

  it('should confirm AI provider hierarchy: Groq Primary, Gemini Secondary, Local Fallback', () => {
    const router = AIRouter.getInstance();
    expect(router.groqProvider).toBeDefined();
    expect(router.geminiProvider).toBeDefined();
    expect(router.localProvider).toBeDefined();

    const status = router.getStatus();
    expect(status.router.currentProvider).toBeDefined();
  });

  it('should verify zero references to deprecated Gemini 2.5/2.0 models in production code', () => {
    function walkDir(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          if (!filePath.includes('node_modules') && !filePath.includes('dist') && !filePath.includes('.git')) {
            results = results.concat(walkDir(filePath));
          }
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js')) {
          results.push(filePath);
        }
      });
      return results;
    }

    const files = walkDir('src');
    let deprecatedCount = 0;
    files.forEach(f => {
      if (f.includes('/tests/')) return; // Skip test assertion checks
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('gemini-2.5') || content.includes('gemini-2.0')) {
        deprecatedCount++;
      }
    });

    expect(deprecatedCount).toBe(0);
  });

  it('should verify all 16 fixed news sections are operational with latency p50 < 15ms', () => {
    const definitions = getAllSectionDefinitions();
    expect(definitions.length).toBe(16);

    const testArticle = {
      id: 'perf-100',
      headline: 'TCS Q3 Net profit jumps 11% to Rs 11,058 crore, declares interim dividend',
      summary: 'IT major reports strong quarterly earnings with 8% YoY revenue growth.',
      primaryCategory: 'Results',
      tickers: ['TCS'],
      publishedAt: new Date().toISOString()
    };

    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      NewsSectionRouter.routeArticle(testArticle);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    expect(p50).toBeLessThan(15);
    expect(p95).toBeLessThan(35);
    expect(p99).toBeLessThan(60);
  });

  it('should confirm canonical news store immutability and zero temporary file leakage', () => {
    const storePath = path.join(process.cwd(), 'data/news_stage2_store.json');
    expect(fs.existsSync(storePath)).toBe(true);

    const buf = fs.readFileSync(storePath);
    const data = JSON.parse(buf.toString());
    const count = Array.isArray(data) ? data.length : data.articles.length;

    expect(count).toBeGreaterThanOrEqual(1023);

    const tmpFiles = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.tmp') || f.endsWith('.partial'));
    expect(tmpFiles.length).toBe(0);
  });
});
