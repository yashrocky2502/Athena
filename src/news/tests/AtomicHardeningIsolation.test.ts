import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SignalOutcomeEngine, SignalOutcomeRecord } from '../market-intelligence/SignalOutcomeEngine';
import { SignalLifecycleEngine } from '../intelligence/SignalLifecycleEngine';
import { TelegramOutbox } from '../../newsCoreV2/storage/TelegramOutbox';

describe('PHASE 6 — ATOMIC HARDENING & TEST ISOLATION ENFORCEMENT REGRESSION SUITE', () => {
  let tempDir: string;
  let testOutcomePath: string;
  let testBackupPath: string;
  let testLifecyclePath: string;
  let testLedgerPath: string;
  let testOutboxPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-phase6-test-'));
    testOutcomePath = path.join(tempDir, 'market_intelligence_outcomes.json');
    testBackupPath = path.join(tempDir, 'market_intelligence_outcomes.json.bak');
    testLifecyclePath = path.join(tempDir, 'news_signal_lifecycle.json');
    testLedgerPath = path.join(tempDir, 'news_signal_historical_ledger.json');
    testOutboxPath = path.join(tempDir, 'telegram_outbox.json');
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  const createMockOutcomeRecord = (id: string): SignalOutcomeRecord => ({
    signalId: id,
    eventId: `evt_${id}`,
    signalType: 'EARNINGS_BEAT',
    symbol: 'RELIANCE',
    revision: 1,
    generatedAt: new Date().toISOString(),
    eventCategory: 'EARNINGS',
    sector: 'ENERGY',
    sourceTier: 'Tier 1',
    direction: 'BULLISH',
    initialPrice: 2500,
    initialMarketState: 'ACTIVE',
    initialCompositeScore: 90,
    initialPriority: 'P1_CRITICAL',
    initialAlignment: 'ALIGNED',
    targetPrice: 2600,
    targetPercent: 4.0,
    stopPrice: 2450,
    stopPercent: -2.0,
    mfePercent: 0,
    maePercent: 0,
    outcome: 'NEUTRAL_REACTION',
    directionalAccuracy: 'INCONCLUSIVE',
    signalLifecycleState: 'ACTIVE',
    isResolved: false,
    priorityAccuracy: 'PENDING_EVALUATION',
    lifecyclePredictionAccuracy: 'PENDING_DATA',
    timeline: [],
    updatedAt: new Date().toISOString()
  });

  // =========================================================================
  // OBJECTIVE 1: SIGNAL OUTCOME ENGINE TEST ISOLATION & HARDENING
  // =========================================================================
  describe('Objective 1: SignalOutcomeEngine Isolation', () => {
    it('A. Explicit temporary storage reset works', () => {
      SignalOutcomeEngine.resetInstance(testOutcomePath, testBackupPath);
      const engine = SignalOutcomeEngine.getInstance();
      engine.recordOutcome(createMockOutcomeRecord('sig_iso_1'));

      expect(fs.existsSync(testOutcomePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(testOutcomePath, 'utf-8'));
      expect(content.length).toBe(1);
      expect(content[0].signalId).toBe('sig_iso_1');
    });

    it('B. Production getInstance works when initialized', () => {
      SignalOutcomeEngine.resetInstanceForProduction();
      const instance = SignalOutcomeEngine.getInstance();
      expect(instance).toBeDefined();
    });

    it('C. Accidental parameterless test reset cannot rebind to production storage and throws error', () => {
      expect(() => {
        SignalOutcomeEngine.resetInstance();
      }).toThrow('[SignalOutcomeEngine] resetInstance() requires explicit customStoragePath');
    });

    it('D. Subsequent record/save operation after attempted parameterless reset cannot modify production data', () => {
      // First bind to isolated test path
      SignalOutcomeEngine.resetInstance(testOutcomePath, testBackupPath);
      const engine = SignalOutcomeEngine.getInstance();

      // Attempt parameterless reset (fails loudly)
      expect(() => {
        SignalOutcomeEngine.resetInstance();
      }).toThrow();

      // Engine instance remains bound to test storage path, NOT production
      engine.recordOutcome(createMockOutcomeRecord('sig_iso_subsequent'));
      const testContent = JSON.parse(fs.readFileSync(testOutcomePath, 'utf-8'));
      expect(testContent.some((r: any) => r.signalId === 'sig_iso_subsequent')).toBe(true);
    });

    it('E. Singleton lifecycle remains deterministic via resetInstanceForProduction', () => {
      SignalOutcomeEngine.resetInstanceForProduction();
      const inst1 = SignalOutcomeEngine.getInstance();
      const inst2 = SignalOutcomeEngine.getInstance();
      expect(inst1).toBe(inst2);
    });

    it('F. Backup path remains paired correctly with custom storage', () => {
      SignalOutcomeEngine.resetInstance(testOutcomePath, testBackupPath);
      const engine = SignalOutcomeEngine.getInstance();

      // Record first signal
      engine.recordOutcome(createMockOutcomeRecord('sig_pair_1'));
      // Record second signal to trigger backup creation
      engine.recordOutcome(createMockOutcomeRecord('sig_pair_2'));

      expect(fs.existsSync(testBackupPath)).toBe(true);
      const backupContent = JSON.parse(fs.readFileSync(testBackupPath, 'utf-8'));
      expect(Array.isArray(backupContent)).toBe(true);
      expect(backupContent[0].signalId).toBe('sig_pair_1');
    });
  });

  // =========================================================================
  // OBJECTIVE 2: ATOMIC SIGNAL LIFECYCLE PERSISTENCE
  // =========================================================================
  describe('Objective 2: SignalLifecycleEngine Atomic Persistence', () => {
    it('A. Normal save produces valid active lifecycles object and ledger array', () => {
      SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
      const engine = SignalLifecycleEngine.getInstance();

      engine.persist();

      expect(fs.existsSync(testLifecyclePath)).toBe(true);
      expect(fs.existsSync(testLedgerPath)).toBe(true);

      const lifecycleContent = JSON.parse(fs.readFileSync(testLifecyclePath, 'utf-8'));
      const ledgerContent = JSON.parse(fs.readFileSync(testLedgerPath, 'utf-8'));

      expect(typeof lifecycleContent).toBe('object');
      expect(Array.isArray(lifecycleContent)).toBe(false);
      expect(Array.isArray(ledgerContent)).toBe(true);
    });

    it('B. Atomic promotion cleans up temp files after success', () => {
      SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
      const engine = SignalLifecycleEngine.getInstance();
      engine.persist();

      const files = fs.readdirSync(tempDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tempFiles.length).toBe(0);
    });

    it('C. Failed validation preserves existing valid primary and cleans up temp files', () => {
      // Create valid initial files
      fs.writeFileSync(testLifecyclePath, JSON.stringify({ sig1: { signalId: 'sig1' } }, null, 2), 'utf-8');
      fs.writeFileSync(testLedgerPath, JSON.stringify([{ outcomeId: 'out1' }], null, 2), 'utf-8');

      SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
      const engine = SignalLifecycleEngine.getInstance();

      // Simulate invalid invalid data by calling atomicSave directly with invalid type expectation
      expect(() => {
        (engine as any).atomicSave(testLifecyclePath, [1, 2, 3], 'object');
      }).toThrow();

      // Verify original file is unchanged
      const content = JSON.parse(fs.readFileSync(testLifecyclePath, 'utf-8'));
      expect(content.sig1.signalId).toBe('sig1');

      // Verify temp files are cleaned up
      const files = fs.readdirSync(tempDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tempFiles.length).toBe(0);
    });
  });

  // =========================================================================
  // OBJECTIVE 3: ATOMIC TELEGRAM OUTBOX PERSISTENCE
  // =========================================================================
  describe('Objective 3: TelegramOutbox Atomic Persistence', () => {
    it('A. Normal save produces valid array primary file', () => {
      const outbox = new TelegramOutbox(testOutboxPath);
      outbox.addEntry('art_1', { title: 'Test Article' });

      expect(fs.existsSync(testOutboxPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(testOutboxPath, 'utf-8'));
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBe(1);
      expect(content[0].articleId).toBe('art_1');
    });

    it('B. Atomic promotion cleans up temp file', () => {
      const outbox = new TelegramOutbox(testOutboxPath);
      outbox.addEntry('art_2', { title: 'Second Article' });

      const files = fs.readdirSync(tempDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tempFiles.length).toBe(0);
    });

    it('C. Failed save preserves existing valid primary and cleans temp files', () => {
      const outbox = new TelegramOutbox(testOutboxPath);
      outbox.addEntry('art_valid', { title: 'Valid Article' });

      const originalContent = fs.readFileSync(testOutboxPath, 'utf-8');

      // Inject non-array entries manually to test save validation failure
      (outbox as any).entries = { invalid: true } as any;

      (outbox as any).save(); // Triggers save() directly

      // Primary file content remains original valid content
      const afterContent = fs.readFileSync(testOutboxPath, 'utf-8');
      expect(afterContent).toBe(originalContent);

      // Temp file cleaned up
      const files = fs.readdirSync(tempDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tempFiles.length).toBe(0);
    });

    it('D. Empty outbox remains valid array', () => {
      const outbox = new TelegramOutbox(testOutboxPath);
      outbox.addEntry('art_1', {});
      outbox.removeEntry('art_1');

      const content = JSON.parse(fs.readFileSync(testOutboxPath, 'utf-8'));
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBe(0);
    });
  });
});
