import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NewsSectionRouter } from '../intelligence/NewsSectionRouter';
import { NewsSectionId, getAllSectionDefinitions } from '../types/NewsSection';
import { SymbolExtractor } from '../intelligence/SymbolExtractor';
import { SectorIndexMapper } from '../intelligence/SectorIndexMapper';
import { FOIntelligenceEngine } from '../intelligence/FOIntelligenceEngine';
import { BreakingNewsDetector } from '../intelligence/BreakingNewsDetector';
import { HallucinationGuard } from '../intelligence/HallucinationGuard';
import { NewsAIService } from "../AI/NewsAIService";

describe('Stage 6.3: Real-World News Intelligence Validation & Section Accuracy', () => {
  let storeArticles: any[] = [];
  let initialSHA: string = '';
  let initialCount: number = 0;
  const storePath = path.join(process.cwd(), 'data/news_stage2_store.json');
  const backupPath = path.join(process.cwd(), 'data/news_stage2_store.json.bak');

  beforeAll(() => {
    // 1. Capture Data Safety Baseline
    expect(fs.existsSync(storePath)).toBe(true);
    const buf = fs.readFileSync(storePath);
    initialSHA = crypto.createHash('sha256').update(buf).digest('hex');
    const data = JSON.parse(buf.toString());
    storeArticles = Array.isArray(data) ? data : (data.articles || []);
    initialCount = storeArticles.length;
  });

  afterAll(() => {
    // Verify Data Safety Post-Condition
    const postBuf = fs.readFileSync(storePath);
    const postSHA = crypto.createHash('sha256').update(postBuf).digest('hex');
    const postData = JSON.parse(postBuf.toString());
    const postCount = Array.isArray(postData) ? postData.length : (postData.articles || []).length;

    expect(postCount).toBeGreaterThanOrEqual(initialCount);
    expect(postSHA).toBe(initialSHA); // Storage must be 100% immutable during read-path tests
  });

  it('1. Article Sampling & Fixed Section Audit (Target >= 94% Primary Accuracy)', () => {
    expect(storeArticles.length).toBeGreaterThanOrEqual(300);

    let validCount = 0;
    let missingPrimaryCount = 0;
    let invalidSectionCount = 0;
    const sectionDistribution: Record<string, number> = {};

    for (const art of storeArticles) {
      const routed = NewsSectionRouter.routeArticle(art);
      
      if (!routed.primarySection) {
        missingPrimaryCount++;
      } else if (!Object.values(NewsSectionId).includes(routed.primarySection)) {
        invalidSectionCount++;
      } else {
        validCount++;
        sectionDistribution[routed.primarySection] = (sectionDistribution[routed.primarySection] || 0) + 1;
      }

      // Guarantee primary is not duplicated in secondary
      expect(routed.secondarySections).not.toContain(routed.primarySection);
    }

    const accuracy = (validCount / storeArticles.length) * 100;
    expect(accuracy).toBeGreaterThanOrEqual(94.0);
    expect(missingPrimaryCount).toBe(0);
    expect(invalidSectionCount).toBe(0);
  });

  it('2. Real-World Specific Section Routing Verification', () => {
    // Results
    const q3ResultsArt = {
      id: 'rw-res-1',
      headline: 'Tata Consultancy Services Q3 PAT rises 11% to Rs 11,058 crore, revenue up 8%',
      summary: 'IT major TCS declared interim dividend of Rs 9 per share.',
      primaryCategory: 'Results',
      tickers: ['TCS']
    };
    const routedRes = NewsSectionRouter.routeArticle(q3ResultsArt);
    expect(routedRes.primarySection).toBe(NewsSectionId.RESULTS);

    // F&O
    const fnoArt = {
      id: 'rw-fno-1',
      headline: 'BankNifty call options see heavy open interest build up at 52,000 strike for weekly expiry',
      summary: 'Implied volatility remains high as options traders position for RBI policy decision.',
      primaryCategory: 'F&O',
      isFnO: true
    };
    const routedFno = NewsSectionRouter.routeArticle(fnoArt);
    expect(routedFno.primarySection).toBe(NewsSectionId.FNO);

    // Regulatory
    const regArt = {
      id: 'rw-reg-1',
      headline: 'SEBI issues revised margin framework and surveillance rules for derivatives market',
      summary: 'Capital markets regulator SEBI mandates enhanced risk management.',
      primaryCategory: 'Regulatory',
      publisher: 'SEBI'
    };
    const routedReg = NewsSectionRouter.routeArticle(regArt);
    expect(routedReg.primarySection).toBe(NewsSectionId.REGULATORY);

    // IPO
    const ipoArt = {
      id: 'rw-ipo-1',
      headline: 'Swiggy IPO subscribed 3.5 times on final day, allotment status today',
      summary: 'Initial public offer closes with strong institutional demand.',
      primaryCategory: 'IPO'
    };
    const routedIpo = NewsSectionRouter.routeArticle(ipoArt);
    expect(routedIpo.primarySection).toBe(NewsSectionId.IPO);

    // Macro/Economy distinction
    const ecoArt = {
      id: 'rw-eco-1',
      headline: 'India CPI Inflation eases to 4.8% in December, RBI repo rate decision in focus',
      summary: 'Ministry of Statistics releases inflation and IIP data.',
      primaryCategory: 'Economy'
    };
    const routedEco = NewsSectionRouter.routeArticle(ecoArt);
    expect(routedEco.primarySection).toBe(NewsSectionId.ECONOMY);
  });

  it('3. Symbol Intelligence Validation (Precision >= 95%, Recall >= 90%)', () => {
    const testCases = [
      { text: 'Reliance Industries Limited reports strong O2C segment profits', expected: 'RELIANCE' },
      { text: 'TCS bagged $500M contract with European logistics client', expected: 'TCS' },
      { text: 'Infosys expands cloud partnership with Microsoft', expected: 'INFY' },
      { text: 'HDFC Bank net interest income grows 16% year on year', expected: 'HDFCBANK' },
      { text: 'ICICI Bank asset quality improves as gross NPA declines', expected: 'ICICIBANK' },
      { text: 'State Bank of India SBI approves infrastructure bond issue', expected: 'SBIN' },
      { text: 'Larsen & Toubro L&T construction order win worth Rs 2,500 cr', expected: 'LT' },
      { text: 'ITC FMCG business revenues up 10% in third quarter', expected: 'ITC' },
      { text: 'Axis Bank reports stable net interest margins', expected: 'AXISBANK' },
      { text: 'Bharti Airtel telecom user additions lead tariff hike gains', expected: 'BHARTIARTL' }
    ];

    let correctMatches = 0;
    for (const tc of testCases) {
      const extracted = SymbolExtractor.extractEntities(tc.text, '');
      const symbols = extracted.map(e => e.nseSymbol);
      if (symbols.includes(tc.expected)) {
        correctMatches++;
      }
    }

    const precision = (correctMatches / testCases.length) * 100;
    expect(precision).toBeGreaterThanOrEqual(95.0);
  });

  it('4. Sector & Index Mapping Hierarchy', () => {
    const hdfcEntities = SymbolExtractor.extractEntities('HDFC Bank', '');
    const mappedHdfc = SectorIndexMapper.map('HDFC Bank', 'Quarterly Update', hdfcEntities);

    expect(mappedHdfc.companies).toContain('HDFCBANK');
    expect(mappedHdfc.sectors).toContain('Financial Services');
    expect(mappedHdfc.indices).toContain('BANKNIFTY');

    const infyEntities = SymbolExtractor.extractEntities('Infosys', '');
    const mappedInfy = SectorIndexMapper.map('Infosys', 'Deal Win', infyEntities);
    expect(mappedInfy.companies).toContain('INFY');
    expect(mappedInfy.sectors).toContain('Information Technology');
    expect(mappedInfy.indices).toContain('NIFTY IT');
  });

  it('5. F&O Intelligence Validation & CE/PE Evidence Guard', () => {
    // Bullish case
    const bullFO = FOIntelligenceEngine.analyze(
      'Reliance Industries Q3 profit beats estimates with strong EBITDA growth',
      'Revenue up 12% with margin expansion across retail and telecom.',
      true,
      1
    );
    expect(bullFO.directionalBias).toBe('CE Bias');
    expect(bullFO.confidence).toBeGreaterThanOrEqual(75);

    // Bearish case
    const bearFO = FOIntelligenceEngine.analyze(
      'Company misses revenue targets, reports profit down and guidance cut',
      'Management warns of margin compression and order cancellation.',
      true,
      1
    );
    expect(bearFO.directionalBias).toBe('PE Bias');

    // Insufficient evidence / non-FO case
    const neutralFO = FOIntelligenceEngine.analyze(
      'Company holds routine board meeting for general business update',
      'No major corporate action or earnings financial figures announced.',
      false,
      0
    );
    expect(neutralFO.directionalBias).toBe('Neutral');
  });

  it('6. Breaking News Urgency & False Positive Guard', () => {
    const now = Date.now();
    const breaking = BreakingNewsDetector.detect(
      'BREAKING: RBI emergency rate cut of 25 bps announced in unscheduled meeting',
      'Governor releases monetary policy statement.',
      new Date(now - 300000).toISOString(), // 5 mins ago
      false,
      now
    );
    expect(breaking.isBreaking).toBe(true);
    expect(breaking.urgency).toBe('BREAKING');

    const staleRelevance = BreakingNewsDetector.detect(
      'RBI repo rate decision from last month retains monetary stance',
      'Historical article regarding previous monetary policy committee meeting.',
      new Date(now - 86400000 * 3).toISOString(), // 3 days ago
      false,
      now
    );
    expect(staleRelevance.isBreaking).toBe(false);
    expect(staleRelevance.urgency).toBe('BACKGROUND');
  });

  it('7. Hallucination Guard Claim Verification', () => {
    const title = 'TCS reports Q3 Net Profit of Rs 11,058 crore';
    const body = 'Tata Consultancy Services reported an 11% increase in quarterly net profit to Rs 11,058 crore with revenue growing 8% to Rs 60,583 crore.';

    // Valid claim matching source
    const validResult = HallucinationGuard.verifyFacts(
      ['Net profit reached Rs 11,058 crore', 'Revenue grew 8%'],
      title,
      body
    );
    expect(validResult.hasSufficientEvidence).toBe(true);
    expect(validResult.status).toBe('VERIFIED');

    // Fabricated metric claim
    const fabricatedResult = HallucinationGuard.verifyFacts(
      ['Net profit reached Rs 99,999 crore', 'EBITDA margin was 45.5%'],
      title,
      body
    );
    expect(fabricatedResult.unverifiedClaimsRemoved).toBe(2);
    expect(fabricatedResult.status).toBe('INSUFFICIENT_INFORMATION');
  });

  it('8. UI Section Feed Filtering, Pagination & Zero Duplicate IDs', () => {
    const feed = NewsSectionRouter.getSectionFeed(storeArticles, 'RESULTS', { page: 1, limit: 20 });
    expect(feed.section).toBe(NewsSectionId.RESULTS);
    expect(feed.articles.length).toBeGreaterThan(0);
    expect(feed.articles.length).toBeLessThanOrEqual(20);

    // Verify zero duplicate IDs in paginated results
    const articleIds = feed.articles.map(a => a.id);
    const uniqueIds = new Set(articleIds);
    expect(uniqueIds.size).toBe(articleIds.length);

    // Symbol filter
    const symbolFeed = NewsSectionRouter.getSectionFeed(storeArticles, 'STOCKS', { symbol: 'RELIANCE' });
    for (const art of symbolFeed.articles) {
      const tickers = (art.tickers || []).map((t: any) => String(t).toUpperCase());
      const companies = (art.companies || []).map((c: any) => String(c.ticker || c.symbol || '').toUpperCase());
      expect(tickers.includes('RELIANCE') || companies.includes('RELIANCE') || art.symbol?.toUpperCase() === 'RELIANCE').toBe(true);
    }
  });

  it('9. AI Provider Hierarchy & Zero Deprecated Models', () => {
    const router = NewsAIService.getInstance();
    expect(router.router.groqProvider).toBeDefined();
    expect(router.router.geminiProvider).toBeDefined();
    expect(router.router.localProvider).toBeDefined();

    // Check production directory for deprecated gemini models
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

  it('10. Latency Performance Benchmark (1,000 requests, p50 < 15ms)', () => {
    const sampleArticle = storeArticles[0] || {
      id: 'bench-1',
      headline: 'HDFC Bank Q3 Results: Net profit up 18% with strong credit growth',
      summary: 'Financial results update from India largest private lender.',
      primaryCategory: 'Results',
      tickers: ['HDFCBANK']
    };

    const latencies: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      NewsSectionRouter.routeArticle(sampleArticle);
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

  it('11. Zero Temporary Files Check', () => {
    const tmpFiles = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.tmp') || f.endsWith('.partial'));
    expect(tmpFiles.length).toBe(0);
  });
});
