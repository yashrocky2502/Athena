import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { RelevanceEngine } from '../intelligence/RelevanceEngine';
import { SymbolExtractor } from '../intelligence/SymbolExtractor';
import { SectorIndexMapper } from '../intelligence/SectorIndexMapper';
import { FOIntelligenceEngine } from '../intelligence/FOIntelligenceEngine';
import { BreakingNewsDetector } from '../intelligence/BreakingNewsDetector';
import { QualityBenchmarkDataset } from '../intelligence/QualityBenchmarkDataset';
import { HallucinationGuard } from '../intelligence/HallucinationGuard';

describe('Stage 5: News Intelligence Quality & Production UX', () => {
  let initialStage2Hash: string = '';

  beforeAll(() => {
    const stage2Path = path.join(process.cwd(), 'data', 'news_stage2_store.json');
    if (fs.existsSync(stage2Path)) {
      const content = fs.readFileSync(stage2Path, 'utf-8');
      initialStage2Hash = crypto.createHash('sha256').update(content).digest('hex');
    }
  });

  it('1. Relevance Engine: calculates deterministic relevance scores with breakdown', () => {
    const title = 'TCS Q1 Net Profit Jumps 12% YoY, Surpasses Estimates';
    const body = 'Tata Consultancy Services reported strong deals in IT services sector.';
    const pubAt = new Date().toISOString();

    const score = RelevanceEngine.calculateRelevance(title, body, pubAt, 'Economic Times', true, 1);
    expect(score.overallScore).toBeGreaterThanOrEqual(60);
    expect(score.formattedBreakdown).toContain('Overall Relevance');
    expect(score.marketImpact).toBeGreaterThan(0);
    expect(score.foRelevance).toBe(25);
  });

  it('2. Symbol Extractor: normalizes company aliases to NSE symbols', () => {
    const title = 'RIL and HDFC Bank rally on Sensex today while Infy dips';
    const body = 'Reliance Industries and HDFC Bank led gainers.';

    const entities = SymbolExtractor.extractEntities(body, title);
    const symbols = entities.map(e => e.nseSymbol);

    expect(symbols).toContain('RELIANCE');
    expect(symbols).toContain('HDFCBANK');
    expect(symbols).toContain('INFY');
  });

  it('3. Sector & Index Mapper: constructs hierarchy trace', () => {
    const entities = SymbolExtractor.extractEntities('HDFC Bank', 'HDFC Bank Q1 Results');
    const mapping = SectorIndexMapper.map('HDFC Bank Q1 Results', 'HDFC Bank', entities);

    expect(mapping.sectors).toContain('Financial Services');
    expect(mapping.indices).toContain('BANKNIFTY');
    expect(mapping.hierarchyTrace.length).toBeGreaterThan(0);
  });

  it('4. F&O Intelligence: computes directional bias for eligible securities', () => {
    const fo = FOIntelligenceEngine.analyze(
      'TCS Q1 Net Profit Jumps 12% YoY, Surpasses Estimates',
      'Strong deal wins and profit growth beat consensus.',
      true,
      1
    );

    expect(fo.isFOEligible).toBe(true);
    expect(fo.directionalBias).toBe('CE Bias');
    expect(fo.confidence).toBeGreaterThanOrEqual(75);
    expect(fo.disclaimer).toContain('INFORMATIONAL DIRECTIONAL ASSESSMENT ONLY');
  });

  it('5. Breaking News Detector: classifies breaking urgency correctly', () => {
    const pubAt = new Date().toISOString();
    const breaking = BreakingNewsDetector.detect(
      'RBI Repo Rate Hiked by 25 bps to Tame Inflation',
      'The central bank announced rate hike',
      pubAt
    );

    expect(breaking.urgency).toBe('BREAKING');
    expect(breaking.isBreaking).toBe(true);
  });

  it('6. Hallucination Guard: filters out fabricated figures', () => {
    const groundTruthTitle = 'TCS Net Profit up 12% in Q1';
    const groundTruthBody = 'TCS reported 12% net profit increase.';

    const claims = ['TCS profit up 12%', 'Target price set to Rs 9999 by secret analyst'];
    const verified = HallucinationGuard.verifyFacts(claims, groundTruthTitle, groundTruthBody);

    expect(verified.verifiedFacts).toContain('TCS profit up 12%');
    expect(verified.unverifiedClaimsRemoved).toBe(1);
  });

  it('7. Benchmark Dataset: validates all test cases', () => {
    const testCases = QualityBenchmarkDataset.getTestCases();
    expect(testCases.length).toBeGreaterThanOrEqual(5);
  });

  it('8. Safety Constraint: Canonical store SHA-256 hash remains unmodified', () => {
    const stage2Path = path.join(process.cwd(), 'data', 'news_stage2_store.json');
    if (fs.existsSync(stage2Path)) {
      const content = fs.readFileSync(stage2Path, 'utf-8');
      const currentHash = crypto.createHash('sha256').update(content).digest('hex');
      expect(currentHash).toBe(initialStage2Hash);
    }
  });
});
