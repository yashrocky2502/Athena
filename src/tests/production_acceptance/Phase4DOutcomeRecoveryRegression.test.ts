import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import crypto from 'crypto';
import { SignalOutcomeEngine, SignalOutcomeRecord } from '../../news/market-intelligence/SignalOutcomeEngine.ts';
import { HistoricalPerformanceAnalyticsEngine } from '../../news/market-intelligence/HistoricalPerformanceAnalyticsEngine.ts';

describe('PHASE 4D — OUTCOME RECOVERY REGRESSION & HYBRID ARTIFACT RESTORATION SUITE', () => {
  let tempDir: string;
  let testStoragePath: string;
  let testBackupPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-phase4d-test-'));
    testStoragePath = path.join(tempDir, 'market_intelligence_outcomes.json');
    testBackupPath = path.join(tempDir, 'market_intelligence_outcomes.json.bak');
    SignalOutcomeEngine.resetInstance(testStoragePath, testBackupPath);
  });

  afterEach(() => {
    SignalOutcomeEngine.resetInstance();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  const createSyntheticRecord = (index: number): SignalOutcomeRecord => ({
    signalId: `evt_synthetic_${index}::EARNINGS::SYMBOL_${index}::rev1`,
    eventId: `evt_synthetic_${index}`,
    signalType: 'EARNINGS',
    symbol: `SYMBOL_${index}`,
    revision: 1,
    generatedAt: new Date(1788093795000 + index * 1000).toISOString(),
    initialPrice: 100 + index,
    initialMarketState: 'ACTIVE',
    initialCompositeScore: 85,
    initialPriority: 'P1_HIGH',
    priority: 'P1_HIGH',
    initialAlignment: 'ALIGNED',
    signalLifecycleState: 'RESOLVED',
    direction: 'BULLISH',
    targetPrice: 105 + index,
    stopPrice: 97 + index,
    targetPercent: 5.0,
    stopPercent: -3.0,
    eventCategory: 'Corporate',
    sector: 'Technology',
    sourceTier: 'Tier 1',
    marketRegime: 'BULLISH',
    marketSession: 'REGULAR_MARKET',
    dataFreshness: 'REAL_TIME',
    mfePercent: 4.2,
    maePercent: -0.8,
    mfeAbsolute: 4.2,
    maeAbsolute: -0.8,
    peakPrice: 104.2 + index,
    troughPrice: 99.2 + index,
    maxFavorablePrice: 104.2 + index,
    maxAdversePrice: 99.2 + index,
    lastObservedPrice: 103.5 + index,
    lastObservedTimestamp: new Date(1788093795000 + index * 1000 + 3600000).toISOString(),
    observationCount: 12,
    timeBuckets: {},
    outcome: 'TARGET_REACHED',
    directionalAccuracy: 'CORRECT',
    isCorrect: true,
    isResolved: true,
    priorityAccuracy: 'ACCURATE_PRIORITY',
    lifecyclePredictionAccuracy: 'PREDICTION_VERIFIED',
    timeline: [],
    updatedAt: new Date(1788093795000 + index * 1000 + 3600000).toISOString()
  });

  // ========================================================
  // 1. DETERMINISTIC HYBRID ARTIFACT SIMULATION & RECOVERY
  // ========================================================
  describe('Synthetic Hybrid Artifact Simulation & Deterministic Recovery', () => {
    it('1. Constructs synthetic hybrid artifact and recovers it deterministically with exact JSON equality', () => {
      // 1. Construct known synthetic dataset
      const dataset: SignalOutcomeRecord[] = [];
      for (let i = 0; i < 25; i++) {
        dataset.push(createSyntheticRecord(i));
      }

      const fullJsonUtf8 = JSON.stringify(dataset, null, 2);
      const splitOffset = Math.floor(fullJsonUtf8.length / 2);

      const prefixUtf8 = fullJsonUtf8.substring(0, splitOffset);
      const suffixUtf8 = fullJsonUtf8.substring(splitOffset);

      const prefixBuf = Buffer.from(prefixUtf8, 'utf-8');
      const suffixCompressedBuf = zlib.deflateSync(Buffer.from(suffixUtf8, 'utf-8'));

      // 2. Simulate the hybrid artifact
      const hybridArtifact = Buffer.concat([prefixBuf, suffixCompressedBuf]);
      const boundaryOffset = prefixBuf.length;

      // Assert hybrid artifact fails normal JSON.parse
      expect(() => JSON.parse(hybridArtifact.toString('utf-8'))).toThrow();

      // 3. Recover deterministically
      const recoveredPrefix = hybridArtifact.subarray(0, boundaryOffset);
      const recoveredCompressed = hybridArtifact.subarray(boundaryOffset);

      // Verify RFC 1950 zlib magic bytes
      expect(recoveredCompressed[0]).toBe(0x78);

      const inflatedSuffix = zlib.inflateSync(recoveredCompressed);
      const reconstructedBuf = Buffer.concat([recoveredPrefix, inflatedSuffix]);
      const reconstructedJson = reconstructedBuf.toString('utf-8');

      // 4. Assert exact JSON equality with the original known payload
      expect(reconstructedJson).toBe(fullJsonUtf8);

      // 5. Assert record count and IDs
      const parsed = JSON.parse(reconstructedJson);
      expect(parsed.length).toBe(25);
      for (let i = 0; i < 25; i++) {
        expect(parsed[i].signalId).toBe(dataset[i].signalId);
      }
    });

    it('2. Asserts that invalid/corrupt compressed data fails safely', () => {
      const prefixBuf = Buffer.from('[\n  {\n    "signalId": "test",', 'utf-8');
      const corruptCompressedBuf = Buffer.from([0x78, 0x9c, 0xff, 0xff, 0x00, 0x01, 0x02]);
      const badHybrid = Buffer.concat([prefixBuf, corruptCompressedBuf]);

      const boundary = prefixBuf.length;
      const compSlice = badHybrid.subarray(boundary);

      expect(() => zlib.inflateSync(compSlice)).toThrow();
    });

    it('3. Atomically restores recovered payload to isolated test storage and verifies hydration', () => {
      const dataset: SignalOutcomeRecord[] = [];
      for (let i = 0; i < 10; i++) {
        dataset.push(createSyntheticRecord(i));
      }
      const fullJsonUtf8 = JSON.stringify(dataset, null, 2);

      // Write via temp file and atomic rename
      const tmpPath = `${testStoragePath}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, fullJsonUtf8, 'utf-8');
      const readBack = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
      expect(readBack.length).toBe(10);
      fs.renameSync(tmpPath, testStoragePath);

      // Hydrate via SignalOutcomeEngine in isolated mode
      SignalOutcomeEngine.resetInstance(testStoragePath, testBackupPath);
      const engine = SignalOutcomeEngine.getInstance();
      const records = engine.getAllOutcomeRecords();
      expect(records.length).toBe(10);
      const returnedIds = new Set(records.map(r => r.signalId));
      for (const d of dataset) {
        expect(returnedIds.has(d.signalId)).toBe(true);
      }
    });

    it('4. HistoricalPerformanceAnalyticsEngine consumes restored test dataset cleanly', () => {
      const dataset: SignalOutcomeRecord[] = [];
      for (let i = 0; i < 15; i++) {
        dataset.push(createSyntheticRecord(i));
      }
      fs.writeFileSync(testStoragePath, JSON.stringify(dataset, null, 2), 'utf-8');

      SignalOutcomeEngine.resetInstance(testStoragePath, testBackupPath);
      const analytics = HistoricalPerformanceAnalyticsEngine.getInstance();
      analytics.clearCache();
      const summary = analytics.getCorePerformanceSummary();

      expect(summary.totalSignals).toBe(15);
      expect(typeof summary.directionalAccuracyPct).toBe('number');
      expect(typeof summary.averageMFE).toBe('number');
    });
  });
});
