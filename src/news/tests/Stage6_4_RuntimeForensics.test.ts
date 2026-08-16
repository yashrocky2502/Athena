import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId } from '../types/NewsSection';
import { NewsAIService } from "../AI/NewsAIService";
import { GroqProvider } from '../AI/GroqProvider';
import { GeminiProvider } from '../AI/GeminiProvider';

describe('Stage 6.4: Runtime Error Forensics & Production Safety Audit', () => {
  it('1. Error #1 Forensics: NewsSectionRouter publisher object safety', () => {
    // Article with publisher as an object { name: "Reuters", url: "..." }
    const articleObjPub = {
      id: 'pub-obj-1',
      headline: 'RBI keeps repo rate unchanged at 6.50% in monetary policy decision',
      publisher: { name: 'Reuters', url: 'https://reuters.com' },
      source: { name: 'Reuters India' },
      primaryCategory: 'Economy'
    };

    // Article with publisher as null/undefined and source as object
    const articleNullPub = {
      id: 'pub-null-1',
      headline: 'SEBI mandates enhanced disclosure norms for REITs and InvITs',
      publisher: null,
      source: { name: 'SEBI' },
      primaryCategory: 'Regulatory'
    };

    expect(() => NewsSectionRouter.routeArticle(articleObjPub)).not.toThrow();
    expect(() => NewsSectionRouter.routeArticle(articleNullPub)).not.toThrow();

    const routedObj = NewsSectionRouter.routeArticle(articleObjPub);
    const routedNull = NewsSectionRouter.routeArticle(articleNullPub);

    expect(routedObj.primarySection).toBe(NewsSectionId.ECONOMY);
    expect(routedNull.primarySection).toBe(NewsSectionId.REGULATORY);
  });

  it('2. Error #2 Forensics: AI Provider Model Configuration & Zero Deprecated Models', () => {
    const groq = new GroqProvider();
    const gemini = new GeminiProvider();

    expect(groq.getPrimaryModel()).toBe('openai/gpt-oss-120b');
    expect(groq.getFallbackModel()).toBe('llama-3.3-70b-versatile');
    expect(gemini.getModelName()).toBe('gemini-3.7-flash');

    // Scan production source files for deprecated gemini-2.5 or gemini-2.0
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
      if (f.includes('/tests/')) return;
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('gemini-2.5') || content.includes('gemini-2.0')) {
        deprecatedCount++;
      }
    });

    expect(deprecatedCount).toBe(0);
  });

  it('3. AI Router Production Hierarchy: Groq Primary -> Gemini Secondary -> Local Fallback', () => {
    const router = NewsAIService.getInstance();
    expect(router.router.groqProvider).toBeDefined();
    expect(router.router.geminiProvider).toBeDefined();
    expect(router.router.localProvider).toBeDefined();

    const status = router.getStatus();
    expect(status.router.currentProvider).toBeDefined();
    expect(status.providers.groq).toBeDefined();
    expect(status.providers.gemini).toBeDefined();
    expect(status.providers.local).toBeDefined();
  });

  it('4. Count Truth Layer Verification & Population Separation', () => {
    const storePath = path.join(process.cwd(), 'data/news_stage2_store.json');
    expect(fs.existsSync(storePath)).toBe(true);

    const buf = fs.readFileSync(storePath);
    const data = JSON.parse(buf.toString());
    const articles = Array.isArray(data) ? data : (data.articles || []);

    // Population A: Canonical Articles
    expect(articles.length).toBeGreaterThanOrEqual(1025);

    // Verify Population Separation Invariants
    const uniqueIds = new Set(articles.map((a: any) => a.id));
    expect(uniqueIds.size).toBe(articles.length); // Zero duplicate canonical IDs
  });

  it('5. Zero Temporary Files Audit', () => {
    const tmpFiles = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.tmp') || f.endsWith('.partial') || f.endsWith('.lock') && f !== 'bun.lock');
    expect(tmpFiles.length).toBe(0);
  });
});
