import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SignalOutcomeEngine, SignalOutcomeRecord } from '../../news/market-intelligence/SignalOutcomeEngine.ts';
import { IntelligenceStore } from '../../newsCoreV2/intelligenceV2/IntelligenceStore.ts';
import { UnifiedIntelligenceEngine } from '../../newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine.ts';
import { IntelligenceRecord } from '../../newsCoreV2/intelligenceV2/IntelligenceTypes.ts';

describe('PHASE 4B — TARGETED REMEDIATION REGRESSION TEST SUITE', () => {
  let tempDir: string;
  let testStoragePath: string;
  let testBackupPath: string;
  let testIntelPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-phase4b-test-'));
    testStoragePath = path.join(tempDir, 'market_intelligence_outcomes.json');
    testBackupPath = path.join(tempDir, 'market_intelligence_outcomes.json.bak');
    testIntelPath = path.join(tempDir, 'news_intelligence_v2.json');
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  const createMockOutcome = (signalId: string): SignalOutcomeRecord => ({
    signalId,
    eventId: `evt_${signalId}`,
    symbol: 'TCS',
    revision: 1,
    generatedAt: new Date().toISOString(),
    eventCategory: 'EARNINGS',
    sector: 'IT',
    sourceTier: 'Tier 1',
    direction: 'BULLISH',
    initialPrice: 4000,
    initialMarketState: 'ACTIVE',
    initialCompositeScore: 85,
    initialPriority: 'P1_CRITICAL',
    initialAlignment: 'ALIGNED',
    targetPrice: 4100,
    targetPercent: 2.5,
    stopPrice: 3950,
    stopPercent: -1.25,
    riskRewardRatio: 2.0,
    mfe: 0,
    mae: 0,
    realizedReturn: 0,
    outcomeClassification: 'NEUTRAL',
    directionalAccuracy: 'INCONCLUSIVE',
    signalLifecycleState: 'ACTIVE',
    isResolved: false,
    priorityAccuracy: 'PENDING_EVALUATION',
    lifecyclePredictionAccuracy: 'PENDING_DATA',
    timeline: [],
    updatedAt: new Date().toISOString()
  });

  // ========================================================
  // 1. SIGNAL OUTCOME ENGINE PERSISTENCE HARDENING
  // ========================================================
  describe('SignalOutcomeEngine Persistence Hardening', () => {
    it('A. Normal save: save produces a valid JSON array primary file', () => {
      const engine = new SignalOutcomeEngine(testStoragePath, testBackupPath);
      const record = createMockOutcome('sig_test_1');
      engine.recordOutcome(record);

      expect(fs.existsSync(testStoragePath)).toBe(true);
      const raw = fs.readFileSync(testStoragePath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0].signalId).toBe('sig_test_1');
    });

    it('B. Backup creation on subsequent save with valid primary', () => {
      const engine = new SignalOutcomeEngine(testStoragePath, testBackupPath);
      
      // First save
      engine.recordOutcome(createMockOutcome('sig_test_1'));
      expect(fs.existsSync(testStoragePath)).toBe(true);

      // Second save creates backup from first valid primary
      engine.recordOutcome(createMockOutcome('sig_test_2'));
      expect(fs.existsSync(testBackupPath)).toBe(true);

      const backupRaw = fs.readFileSync(testBackupPath, 'utf-8');
      const backupParsed = JSON.parse(backupRaw);
      expect(Array.isArray(backupParsed)).toBe(true);
      expect(backupParsed.length).toBe(1);
      expect(backupParsed[0].signalId).toBe('sig_test_1');

      const primaryRaw = fs.readFileSync(testStoragePath, 'utf-8');
      const primaryParsed = JSON.parse(primaryRaw);
      expect(primaryParsed.length).toBe(2);
    });

    it('C. Backup protection: corrupt/invalid primary is NOT copied over an existing valid backup', () => {
      // Setup initial valid backup
      const validBackupData = [createMockOutcome('sig_valid_backup')];
      fs.writeFileSync(testBackupPath, JSON.stringify(validBackupData, null, 2), 'utf-8');

      // Setup corrupt primary
      fs.writeFileSync(testStoragePath, '{"corrupt": true, [bad json', 'utf-8');

      // Instantiate engine with paths
      const engine = new SignalOutcomeEngine(testStoragePath, testBackupPath);
      
      // Trigger a save with new record
      engine.recordOutcome(createMockOutcome('sig_new_item'));

      // Verify that backup was NOT overwritten by the corrupt primary
      expect(fs.existsSync(testBackupPath)).toBe(true);
      const backupContent = fs.readFileSync(testBackupPath, 'utf-8');
      const backupParsed = JSON.parse(backupContent);
      expect(Array.isArray(backupParsed)).toBe(true);
      expect(backupParsed[0].signalId).toBe('sig_valid_backup');
    });

    it('D. Hydration fallback to valid backup when primary is corrupt', () => {
      const validBackupData = [createMockOutcome('sig_backup_recovered_1')];
      fs.writeFileSync(testBackupPath, JSON.stringify(validBackupData, null, 2), 'utf-8');
      fs.writeFileSync(testStoragePath, 'CORRUPTED_NON_JSON_DATA', 'utf-8');

      const engine = new SignalOutcomeEngine(testStoragePath, testBackupPath);
      const allOutcomes = engine.getAllOutcomeRecords();
      expect(allOutcomes.length).toBe(1);
      expect(allOutcomes[0].signalId).toBe('sig_backup_recovered_1');
    });

    it('E. Hydration handles dual corruption gracefully without crashing', () => {
      fs.writeFileSync(testStoragePath, 'CORRUPT_PRIMARY', 'utf-8');
      fs.writeFileSync(testBackupPath, 'CORRUPT_BACKUP', 'utf-8');

      expect(() => {
        const engine = new SignalOutcomeEngine(testStoragePath, testBackupPath);
        expect(engine.getAllOutcomeRecords().length).toBe(0);
      }).not.toThrow();
    });

    it('F. Zero leftover temp files after successful save', () => {
      const engine = new SignalOutcomeEngine(testStoragePath, testBackupPath);
      engine.recordOutcome(createMockOutcome('sig_temp_check'));

      const dirFiles = fs.readdirSync(tempDir);
      const tmpFiles = dirFiles.filter(f => f.endsWith('.tmp'));
      expect(tmpFiles.length).toBe(0);
    });
  });

  // ========================================================
  // 2. INTELLIGENCE STORE VERSION 27.4 COMPATIBILITY
  // ========================================================
  describe('IntelligenceStore Version 27.4 Alignment', () => {
    it('UnifiedIntelligenceEngine.VERSION is strictly 27.4', () => {
      expect(UnifiedIntelligenceEngine.VERSION).toBe('27.4');
    });

    it('IntelligenceStore accepts and caches records with intelligenceVersion 27.4', () => {
      const store = new IntelligenceStore(testIntelPath);
      const testRecord: IntelligenceRecord = {
        articleId: 'test_art_v27_4',
        intelligenceVersion: '27.4',
        summary: {
          oneLine: 'Test summary line',
          keyPoints: ['Point 1'],
          whatHappened: 'What happened',
          whyItMatters: 'Why it matters',
          marketContext: 'Market context'
        },
        financialIntelligence: {
          metrics: [],
          financialContext: '',
          guidanceChanges: ''
        },
        tradeImplications: {
          directionalBias: 'NEUTRAL',
          actionablePerspective: 'Watch',
          riskReward: 'Balanced',
          catalystHorizon: '1-3 days',
          invalidationCondition: 'None'
        },
        sourceVerification: {
          directQuotes: [],
          disclosures: [],
          isRumor: false,
          isOfficialConfirmation: true
        },
        technicalContext: {
          sectorImpact: 'Sector neutral',
          peerComparison: 'In line'
        },
        marketExpectations: {
          sentimentBaseline: 'Neutral',
          surpriseFactor: 'None'
        },
        audit: {
          generatedAt: new Date().toISOString(),
          engineVersion: '27.4',
          modelProvider: 'LOCAL_RULE_BASED',
          confidenceScore: 0.95
        }
      };

      store.set(testRecord);
      const retrieved = store.get('test_art_v27_4', '27.4');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.articleId).toBe('test_art_v27_4');
      expect(retrieved?.intelligenceVersion).toBe('27.4');
    });

    it('IntelligenceStore rejects records with outdated version 27.3', () => {
      const store = new IntelligenceStore(testIntelPath);
      const retrieved = store.get('test_art_v27_4', '27.3');
      expect(retrieved).toBeNull();
    });

    it('IntelligenceStore hydrates a persisted 27.4 record into cache and rejects 27.3 record on hydration', () => {
      // Seed isolated disk file with one 27.4 record and one 27.3 record
      const seedData = [
        {
          articleId: 'art_valid_27_4',
          intelligenceVersion: '27.4',
          summary: { oneLine: 'Valid 27.4' }
        },
        {
          articleId: 'art_legacy_27_3',
          intelligenceVersion: '27.3',
          summary: { oneLine: 'Legacy 27.3' }
        }
      ];
      fs.writeFileSync(testIntelPath, JSON.stringify(seedData, null, 2), 'utf-8');

      const store = new IntelligenceStore(testIntelPath);
      expect(store.size()).toBe(1);
      expect(store.get('art_valid_27_4', '27.4')).not.toBeNull();
      expect(store.get('art_legacy_27_3', '27.3')).toBeNull();
    });

    it('Production news_intelligence_v2.json hydratable records are 27.4', () => {
      const prodIntelPath = path.join(process.cwd(), 'data', 'news_intelligence_v2.json');
      if (fs.existsSync(prodIntelPath)) {
        const raw = fs.readFileSync(prodIntelPath, 'utf-8');
        const parsed = JSON.parse(raw);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
        
        // All items in the production file are stamped 27.4
        const all27_4 = parsed.every((r: any) => r.intelligenceVersion === '27.4');
        expect(all27_4).toBe(true);
      }
    });
  });
});
