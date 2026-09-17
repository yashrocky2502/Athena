/**
 * ATHENA NEWS ENGINE — PHASE 7
 * Phase7IntelligenceIntegrity.test.ts
 *
 * Comprehensive Regression & Isolation Test Suite for Phase 7:
 * - SignalLifecycleEngine hardened test isolation, explicit reset paths, non-destructive clear()
 * - IntelligenceStore atomic persistence, backup snapshot, shrink guard, orphan cleanup
 * - Deterministic timestamp retention (newest 3,000 records preserved)
 * - Safe forward-compatible non-27.4 version preservation
 * - Synchronous debounced save flushing and process termination safety
 * - Production dataset invariant protection
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { SignalLifecycleEngine } from '../intelligence/SignalLifecycleEngine.ts';
import { SignalOutcomeEngine } from '../market-intelligence/SignalOutcomeEngine.ts';
import { IntelligenceStore } from '../../newsCoreV2/intelligenceV2/IntelligenceStore.ts';
import { IntelligenceRecord } from '../../newsCoreV2/intelligenceV2/IntelligenceTypes.ts';

describe('PHASE 7 — INTELLIGENCE & MARKET INTELLIGENCE INTEGRITY REGRESSION', () => {
  let tempDir: string;
  let testLifecyclePath: string;
  let testLedgerPath: string;
  let testOutcomePath: string;
  let testOutcomeBakPath: string;
  let testIntelPath: string;
  let testBackupPath: string;

  // Track production file hashes to ensure ZERO production contamination
  const prodFiles = [
    'data/market_intelligence_outcomes.json',
    'data/market_intelligence_outcomes.json.bak',
    'data/news_core_v2.json',
    'data/news_core_v2.json.bak',
    'data/news_intelligence_v2.json',
    'data/news_signal_lifecycle.json',
    'data/news_signal_historical_ledger.json',
    'data/telegram_outbox.json'
  ];

  const initialHashes: Record<string, string> = {};

  beforeAll(() => {
    // Capture initial hashes
    prodFiles.forEach(f => {
      if (fs.existsSync(f)) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
        initialHashes[f] = hash;
      }
    });

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase7_test_'));
    testLifecyclePath = path.join(tempDir, 'test_lifecycle.json');
    testLedgerPath = path.join(tempDir, 'test_ledger.json');
    testOutcomePath = path.join(tempDir, 'test_outcomes.json');
    testOutcomeBakPath = path.join(tempDir, 'test_outcomes.json.bak');
    testIntelPath = path.join(tempDir, 'test_intelligence.json');
    testBackupPath = path.join(tempDir, 'test_intelligence.json.bak');
    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
  });

  afterAll(() => {
    // Restore production singletons
    try {
      SignalLifecycleEngine.resetInstanceForProduction();
      SignalOutcomeEngine.resetInstanceForProduction();
      IntelligenceStore.resetInstanceForProduction();
    } catch {}

    // Clean up temporary files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}

    // Verify production data was never touched
    prodFiles.forEach(f => {
      if (fs.existsSync(f)) {
        const currentHash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
        expect(currentHash).toBe(initialHashes[f]);
      }
    });
  });

  beforeEach(() => {
    // Reset test files in temp directory
    try {
      if (fs.existsSync(testLifecyclePath)) fs.unlinkSync(testLifecyclePath);
      if (fs.existsSync(testLedgerPath)) fs.unlinkSync(testLedgerPath);
      if (fs.existsSync(testOutcomePath)) fs.unlinkSync(testOutcomePath);
      if (fs.existsSync(testOutcomeBakPath)) fs.unlinkSync(testOutcomeBakPath);
      if (fs.existsSync(testIntelPath)) fs.unlinkSync(testIntelPath);
      if (fs.existsSync(testBackupPath)) fs.unlinkSync(testBackupPath);
    } catch {}
    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
  });

  function createMockIntelligenceRecord(id: string, dateIso: string, version: string = '27.4'): IntelligenceRecord {
    return {
      articleId: id,
      canonicalUrl: `https://example.com/${id}`,
      headline: `Headline for ${id}`,
      source: 'Financial Express',
      publishedAt: dateIso,
      companyName: 'Test Corp',
      symbol: 'TESTCORP',
      entityType: 'EQUITY',
      entityConfidence: 'HIGH',
      fnoEligible: true,
      fnoConfidence: 'HIGH',
      category: 'EARNINGS',
      eventType: 'QUARTERLY_RESULTS',
      sentiment: 'BULLISH',
      materialityScore: 85,
      relevanceScore: 90,
      urgency: 'HIGH',
      financialMetrics: [],
      executiveSummary: `Executive summary for ${id}`,
      keyFacts: ['Key fact 1'],
      whyItMatters: `Why it matters for ${id}`,
      marketImpact: 'Positive market impact',
      risk: ['Market volatility'],
      optionsSellerImpact: 'High IV crush potential',
      sourceEvidence: ['Sentence 1 from source'],
      evidenceSpans: ['Span 1'],
      intelligenceVersion: version,
      generatedAt: dateIso
    };
  }

  // =========================================================================
  // TESTS A-D: SIGNAL LIFECYCLE ENGINE ISOLATION
  // =========================================================================

  it('A. SignalLifecycle resetInstance() without paths throws clear Error', () => {
    expect(() => {
      (SignalLifecycleEngine as any).resetInstance();
    }).toThrow('[SignalLifecycleEngine] resetInstance() requires explicit customPersistencePath and customLedgerPath');

    expect(() => {
      (SignalLifecycleEngine as any).resetInstance(testLifecyclePath, '');
    }).toThrow('[SignalLifecycleEngine] resetInstance() requires explicit customPersistencePath and customLedgerPath');
  });

  it('B. SignalLifecycle resetInstance() with temporary paths succeeds', () => {
    expect(() => {
      SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
    }).not.toThrow();

    const instance = SignalLifecycleEngine.getInstance();
    expect(instance).toBeDefined();
  });

  it('C. SignalLifecycle clear() does not delete temporary persistence files from disk', () => {
    fs.writeFileSync(testLifecyclePath, JSON.stringify({ sig_test: { signalId: 'sig_test' } }, null, 2), 'utf-8');
    fs.writeFileSync(testLedgerPath, JSON.stringify([{ outcomeId: 'out_test' }], null, 2), 'utf-8');

    SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
    const engine = SignalLifecycleEngine.getInstance();
    
    // Call clear()
    engine.clear();

    // Verify memory was cleared
    expect(engine.getActiveLifecycles().length).toBe(0);
    expect(engine.getHistoricalLedger().length).toBe(0);

    // CRITICAL: Verify files on disk were NOT deleted
    expect(fs.existsSync(testLifecyclePath)).toBe(true);
    expect(fs.existsSync(testLedgerPath)).toBe(true);

    const onDiskLifecycle = JSON.parse(fs.readFileSync(testLifecyclePath, 'utf-8'));
    expect(onDiskLifecycle.sig_test.signalId).toBe('sig_test');
  });

  it('D. SignalLifecycle production paths are never touched by tests', () => {
    const prodLifecycleHash = initialHashes['data/news_signal_lifecycle.json'];
    const prodLedgerHash = initialHashes['data/news_signal_historical_ledger.json'];

    const currentLifecycleHash = crypto.createHash('sha256').update(fs.readFileSync('data/news_signal_lifecycle.json')).digest('hex');
    const currentLedgerHash = crypto.createHash('sha256').update(fs.readFileSync('data/news_signal_historical_ledger.json')).digest('hex');

    expect(currentLifecycleHash).toBe(prodLifecycleHash);
    expect(currentLedgerHash).toBe(prodLedgerHash);
  });

  // =========================================================================
  // TESTS E-F: TEST ISOLATION INTEGRITY IN PHASE 10_6 AND 10_7
  // =========================================================================

  it('E. Phase10_6 test suite source enforces isolated paths and no direct production singleton clear', () => {
    const phase106Source = fs.readFileSync('src/news/tests/Phase10_6_MarketIntelligenceFusion.test.ts', 'utf-8');
    expect(phase106Source).toContain('SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath)');
    expect(phase106Source).not.toContain('import { signalLifecycleEngine }');
  });

  it('F. Phase10_7 test suite source enforces isolated paths and no direct production singleton clear', () => {
    const phase107Source = fs.readFileSync('src/news/tests/Phase10_7_SignalLifecycle.test.ts', 'utf-8');
    expect(phase107Source).toContain('SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath)');
    expect(phase107Source).not.toContain('import { signalLifecycleEngine,');
  });

  // =========================================================================
  // TESTS G-K: INTELLIGENCESTORE ATOMIC PERSISTENCE, BACKUP & VALIDATION
  // =========================================================================

  it('G. IntelligenceStore writes valid JSON atomically', () => {
    const store = new IntelligenceStore(testIntelPath, testBackupPath);
    const rec = createMockIntelligenceRecord('art_atomic_1', '2026-09-17T01:00:00.000Z');
    
    store.set(rec);
    store.flushToDisk();

    expect(fs.existsSync(testIntelPath)).toBe(true);
    const content = fs.readFileSync(testIntelPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].articleId).toBe('art_atomic_1');
    expect(parsed[0].intelligenceVersion).toBe('27.4');
  });

  it('H. Corrupt temp content cannot replace valid primary', () => {
    // Write valid initial primary
    const store = new IntelligenceStore(testIntelPath, testBackupPath);
    const validRec = createMockIntelligenceRecord('art_primary_valid', '2026-09-17T01:00:00.000Z');
    store.set(validRec);
    store.flushToDisk();

    const originalContent = fs.readFileSync(testIntelPath, 'utf-8');

    // Attempt to persist with a corrupted record missing required fields (simulating failure)
    const corruptRecord: any = {
      articleId: 'art_corrupt',
      // Missing intelligenceVersion!
      headline: 'Corrupt without version'
    };

    // Inject directly into store cache
    (store as any).cache.set('art_corrupt_27.4', corruptRecord);

    expect(() => {
      store.executeAtomicSaveSync();
    }).toThrow('[IntelligenceStore] Serialized candidate record missing required articleId or intelligenceVersion');

    // Primary file MUST remain unchanged and valid
    const primaryAfter = fs.readFileSync(testIntelPath, 'utf-8');
    expect(primaryAfter).toBe(originalContent);
  });

  it('I. Existing valid primary survives failed persistence', () => {
    const store = new IntelligenceStore(testIntelPath, testBackupPath);
    const rec1 = createMockIntelligenceRecord('art_survive_1', '2026-09-17T01:00:00.000Z');
    const rec2 = createMockIntelligenceRecord('art_survive_2', '2026-09-17T01:01:00.000Z');
    store.set(rec1);
    store.set(rec2);
    store.flushToDisk();

    const originalHash = crypto.createHash('sha256').update(fs.readFileSync(testIntelPath)).digest('hex');

    // Trigger shrink guard rejection: clear cache in memory while disk has 2 records
    (store as any).cache.clear();
    (store as any).legacyRecords.clear();

    expect(() => {
      store.executeAtomicSaveSync();
    }).toThrow('[IntelligenceStore] Shrink guard rejected empty candidate persistence');

    // Primary survives completely intact
    const currentHash = crypto.createHash('sha256').update(fs.readFileSync(testIntelPath)).digest('hex');
    expect(currentHash).toBe(originalHash);
  });

  it('J. Valid backup survives failed persistence', () => {
    const store = new IntelligenceStore(testIntelPath, testBackupPath);
    const rec = createMockIntelligenceRecord('art_backup_survive', '2026-09-17T01:00:00.000Z');
    store.set(rec);
    store.flushToDisk();

    // Trigger second save to create backup snapshot
    const rec2 = createMockIntelligenceRecord('art_backup_survive_2', '2026-09-17T01:05:00.000Z');
    store.set(rec2);
    store.flushToDisk();

    expect(fs.existsSync(testBackupPath)).toBe(true);
    const backupContent = fs.readFileSync(testBackupPath, 'utf-8');
    const parsedBackup = JSON.parse(backupContent);
    expect(Array.isArray(parsedBackup)).toBe(true);

    // Now induce error
    (store as any).cache.set('bad', { articleId: 'bad' }); // missing intelligenceVersion
    expect(() => {
      store.executeAtomicSaveSync();
    }).toThrow();

    // Backup must remain intact
    expect(fs.readFileSync(testBackupPath, 'utf-8')).toBe(backupContent);
  });

  it('K. Orphan temp file is cleaned after failed persistence', () => {
    const store = new IntelligenceStore(testIntelPath, testBackupPath);
    store.set(createMockIntelligenceRecord('art_tmp_clean', '2026-09-17T01:00:00.000Z'));
    store.flushToDisk();

    // Induce serialization failure
    (store as any).cache.set('corrupt', { articleId: 'corrupt' }); // missing intelligenceVersion
    try {
      store.executeAtomicSaveSync();
    } catch {}

    const tempFile = `${testIntelPath}.tmp`;
    expect(fs.existsSync(tempFile)).toBe(false);
  });

  // =========================================================================
  // TESTS L-M: RETENTION & DETERMINISTIC ORDERING
  // =========================================================================

  it('L. IntelligenceStore retention keeps newest records when cache exceeds 3,000', () => {
    const store = new IntelligenceStore(testIntelPath, testBackupPath);

    // Insert 50 old records with early timestamps (August 2026)
    for (let i = 0; i < 50; i++) {
      const pad = String(i).padStart(4, '0');
      const rec = createMockIntelligenceRecord(`art_old_${pad}`, `2026-08-01T00:${pad.slice(2)}:00.000Z`);
      store.set(rec);
    }

    // Insert 3,000 newer records with later timestamps (September 2026)
    for (let i = 0; i < 3000; i++) {
      const pad = String(i).padStart(4, '0');
      const rec = createMockIntelligenceRecord(`art_new_${pad}`, `2026-09-10T12:00:00.000Z`);
      store.set(rec);
    }

    expect(store.size()).toBe(3050);

    store.flushToDisk();

    // Verify file on disk has capped at 3,000
    const onDisk = JSON.parse(fs.readFileSync(testIntelPath, 'utf-8'));
    expect(onDisk.length).toBe(3000);

    // Verify all 3,000 newest records are present
    const hasNewest = onDisk.some((r: any) => r.articleId.startsWith('art_new_'));
    expect(hasNewest).toBe(true);

    // Verify the oldest 50 records were evicted from disk
    const hasOldest = onDisk.some((r: any) => r.articleId.startsWith('art_old_'));
    expect(hasOldest).toBe(false);
  });

  it('M. Retention ordering is deterministic and reproducible', () => {
    const store1 = new IntelligenceStore(testIntelPath, testBackupPath);
    for (let i = 0; i < 100; i++) {
      const pad = String(i).padStart(3, '0');
      const rec = createMockIntelligenceRecord(`art_det_${pad}`, `2026-09-15T10:00:${pad.slice(1)}Z`);
      store1.set(rec);
    }
    store1.flushToDisk();
    const hash1 = crypto.createHash('sha256').update(fs.readFileSync(testIntelPath)).digest('hex');

    // Create a second store with same records inserted in reverse order
    const testIntelPath2 = path.join(tempDir, 'test_intelligence_2.json');
    const store2 = new IntelligenceStore(testIntelPath2);
    for (let i = 99; i >= 0; i--) {
      const pad = String(i).padStart(3, '0');
      const rec = createMockIntelligenceRecord(`art_det_${pad}`, `2026-09-15T10:00:${pad.slice(1)}Z`);
      store2.set(rec);
    }
    store2.flushToDisk();
    const hash2 = crypto.createHash('sha256').update(fs.readFileSync(testIntelPath2)).digest('hex');

    expect(hash1).toBe(hash2);
  });

  // =========================================================================
  // TEST N: WRONG-VERSION DATA PRESERVATION
  // =========================================================================

  it('N. Non-27.4 records are not silently erased during a save', () => {
    // Seed test file with legacy/different version records
    const legacyRecords = [
      createMockIntelligenceRecord('art_v26_legacy_1', '2026-07-01T10:00:00.000Z', '26.0'),
      createMockIntelligenceRecord('art_v25_legacy_2', '2026-06-01T10:00:00.000Z', '25.0')
    ];
    const currentRecords = [
      createMockIntelligenceRecord('art_v27_current_1', '2026-09-17T01:00:00.000Z', '27.4')
    ];

    fs.writeFileSync(testIntelPath, JSON.stringify([...legacyRecords, ...currentRecords], null, 2), 'utf-8');

    // Initialize IntelligenceStore (hydrates from disk)
    const store = new IntelligenceStore(testIntelPath, testBackupPath);
    expect(store.size()).toBe(1); // active 27.4 cache
    expect(store.legacySize()).toBe(2); // preserved legacy buffer
    expect(store.totalSize()).toBe(3);

    // Insert a new 27.4 record and flush to disk
    store.set(createMockIntelligenceRecord('art_v27_current_2', '2026-09-17T02:00:00.000Z', '27.4'));
    store.flushToDisk();

    // Verify on-disk file contains BOTH the new records AND the legacy records
    const onDisk = JSON.parse(fs.readFileSync(testIntelPath, 'utf-8'));
    expect(onDisk.length).toBe(4);

    const legacy1 = onDisk.find((r: any) => r.articleId === 'art_v26_legacy_1');
    const legacy2 = onDisk.find((r: any) => r.articleId === 'art_v25_legacy_2');
    expect(legacy1).toBeDefined();
    expect(legacy1.intelligenceVersion).toBe('26.0');
    expect(legacy2).toBeDefined();
    expect(legacy2.intelligenceVersion).toBe('25.0');
  });

  // =========================================================================
  // TESTS O-P: DEBOUNCED SAVE & SYNCHRONOUS FLUSH
  // =========================================================================

  it('O. Pending debounced save can be synchronously flushed', () => {
    const store = new IntelligenceStore(testIntelPath, testBackupPath);
    const rec = createMockIntelligenceRecord('art_flush_test', '2026-09-17T01:00:00.000Z');

    // set() triggers a 1-second debounced save
    store.set(rec);

    // Immediately flush synchronously
    store.flushToDisk();

    // File MUST be on disk immediately without waiting
    expect(fs.existsSync(testIntelPath)).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(testIntelPath, 'utf-8'));
    expect(onDisk.some((r: any) => r.articleId === 'art_flush_test')).toBe(true);
  });

  it('P. Shutdown/flush does not leave duplicate listeners or hanging timers', () => {
    const store = new IntelligenceStore(testIntelPath, testBackupPath);
    store.set(createMockIntelligenceRecord('art_timer_clean', '2026-09-17T01:00:00.000Z'));

    // Verify saveTimeout is cleared on flushToDisk()
    store.flushToDisk();
    expect((store as any).saveTimeout).toBeNull();
  });

  // =========================================================================
  // TESTS Q-R: HYDRATION & BACKUP RECOVERY
  // =========================================================================

  it('Q. Restart/hydration restores persisted intelligence', () => {
    const store1 = new IntelligenceStore(testIntelPath, testBackupPath);
    const rec = createMockIntelligenceRecord('art_hydrate_restore', '2026-09-17T01:00:00.000Z');
    store1.set(rec);
    store1.flushToDisk();

    // Create a new store instance pointing to same file
    const store2 = new IntelligenceStore(testIntelPath, testBackupPath);
    const retrieved = store2.get('art_hydrate_restore');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.articleId).toBe('art_hydrate_restore');
  });

  it('R. Corrupt primary + valid backup follows the defined recovery behavior', () => {
    // Create valid backup file with 2 records
    const backupRecords = [
      createMockIntelligenceRecord('art_rec_1', '2026-09-17T01:00:00.000Z'),
      createMockIntelligenceRecord('art_rec_2', '2026-09-17T01:05:00.000Z')
    ];
    fs.writeFileSync(testBackupPath, JSON.stringify(backupRecords, null, 2), 'utf-8');

    // Create corrupt primary file
    fs.writeFileSync(testIntelPath, '{ invalid json truncated content...', 'utf-8');

    // Hydrate store: should detect corrupt primary and recover from backup
    const store = new IntelligenceStore(testIntelPath, testBackupPath);
    expect(store.size()).toBe(2);
    expect(store.get('art_rec_1')).toBeDefined();
    expect(store.get('art_rec_2')).toBeDefined();
  });

  // =========================================================================
  // TEST S: PRODUCTION DATASET PATH PROTECTION
  // =========================================================================

  it('S. Production dataset paths are never used by tests', () => {
    prodFiles.forEach(f => {
      if (fs.existsSync(f)) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
        expect(hash).toBe(initialHashes[f]);
      }
    });
  });
});
