/**
 * ATHENA NEWS & MARKET INTELLIGENCE SUBSYSTEM — PHASE 10A
 * Phase10A_SignalIdentityIntegrity.test.ts
 * 
 * Canonical Signal Identity & Lifecycle -> Outcome Synchronization Test Suite.
 * Verifies:
 * - TEST A: Canonical ID propagation across Fusion -> Lifecycle -> Outcome
 * - TEST B: Outcome registration preserves exact canonical ID (no symbol appended)
 * - TEST C: Lifecycle state updates correctly propagate to outcome records
 * - TEST D: No silent key mismatch (returns null, increments unlinked counter, emits warning)
 * - TEST E: Duplicate registration idempotency
 * - TEST F: Different revisions produce distinct canonical IDs and outcome records
 * - TEST G: Different signal types produce distinct canonical IDs and outcome records
 * - TEST H: Different event IDs produce distinct canonical IDs and outcome records
 * - TEST I: Historical dataset compatibility (readable via exact key & aliases)
 * - TEST J: Test storage isolation strictly active
 * - TEST K: Production dataset SHA-256 hashes and record counts byte-for-byte protected
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { MarketIntelligenceFusionEngine } from '../intelligence/MarketIntelligenceFusionEngine.ts';
import { SignalLifecycleEngine } from '../intelligence/SignalLifecycleEngine.ts';
import { SignalOutcomeEngine, SignalOutcomeRecord } from '../market-intelligence/SignalOutcomeEngine.ts';
import { NewsEvent } from '../types/NewsEvent.ts';
import { NewsArticle } from '../types/Article.ts';
import { MarketConfirmationDossier } from '../intelligence/MarketConfirmationEngine.ts';

describe('PHASE 10A — CANONICAL SIGNAL IDENTITY & LIFECYCLE -> OUTCOME SYNCHRONIZATION', () => {
  let tempDir: string;
  let testLifecyclePath: string;
  let testLedgerPath: string;
  let testOutcomePath: string;
  let testOutcomeBakPath: string;

  // Protected production files
  const protectedDatasets = [
    {
      filePath: 'data/market_intelligence_outcomes.json',
      expectedHash: '47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd',
      expectedCount: 446
    },
    {
      filePath: 'data/market_intelligence_outcomes.json.bak',
      expectedHash: '33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764',
      expectedCount: 445
    },
    {
      filePath: 'data/news_signal_lifecycle.json',
      expectedHash: 'aefc42b49c7b1bc590fdce6f608ded9aaab520bd9374d008825b2160fba0aac1',
      expectedCount: 498
    },
    {
      filePath: 'data/news_signal_historical_ledger.json',
      expectedHash: '805b745545a2302685958a80fbb9c2c2628dd587ff9ebf36cd5b31214af5402c',
      expectedCount: 1
    }
  ];

  const preTestHashes: Record<string, string> = {};

  const computeSha256 = (p: string): string => {
    const raw = fs.readFileSync(path.resolve(process.cwd(), p));
    return crypto.createHash('sha256').update(raw).digest('hex');
  };

  const getRecordCount = (filePath: string): number => {
    const raw = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
  };

  beforeAll(() => {
    // Record baseline hashes and counts for all 4 protected files
    for (const dataset of protectedDatasets) {
      const hash = computeSha256(dataset.filePath);
      preTestHashes[dataset.filePath] = hash;
      expect(hash).toBe(dataset.expectedHash);
      expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
    }

    // Create isolated test temporary storage
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase10a_signal_identity_'));
    testLifecyclePath = path.join(tempDir, 'test_lifecycle.json');
    testLedgerPath = path.join(tempDir, 'test_ledger.json');
    testOutcomePath = path.join(tempDir, 'test_outcomes.json');
    testOutcomeBakPath = path.join(tempDir, 'test_outcomes.json.bak');

    SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
  });

  afterAll(() => {
    // Restore production instances
    SignalLifecycleEngine.resetInstanceForProduction();
    SignalOutcomeEngine.resetInstanceForProduction();

    // Clean up temporary test storage
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}

    // Verify all 4 protected datasets remain byte-for-byte identical
    for (const dataset of protectedDatasets) {
      const postHash = computeSha256(dataset.filePath);
      expect(postHash).toBe(dataset.expectedHash);
      expect(postHash).toBe(preTestHashes[dataset.filePath]);
      expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
    }
  });

  beforeEach(() => {
    SignalLifecycleEngine.resetInstance(testLifecyclePath, testLedgerPath);
    SignalOutcomeEngine.resetInstance(testOutcomePath, testOutcomeBakPath);
    MarketIntelligenceFusionEngine.getInstance().clear();
    SignalLifecycleEngine.getInstance().clear();
    SignalOutcomeEngine.getInstance().clear();
    vi.restoreAllMocks();
  });

  // ============================================================
  // TEST A — CANONICAL ID PROPAGATION ACROSS ENGINES
  // ============================================================
  it('TEST A — should propagate canonical signal identity identically across Fusion -> Lifecycle -> Outcome', () => {
    const fusion = MarketIntelligenceFusionEngine.getInstance();
    const lifecycleEngine = SignalLifecycleEngine.getInstance();
    const outcomeEngine = SignalOutcomeEngine.getInstance();

    const eventId = 'evt_test_canonical_001';
    const symbol = 'TCS';
    const eventType = 'CONTRACT_WIN';

    const mockEvent: NewsEvent = {
      eventId,
      title: 'TCS Secures Major Cloud Modernization Deal',
      summary: 'TCS announces large enterprise digital transformation win.',
      category: 'ORDER_WIN',
      symbol,
      publishedAt: '2026-08-25T10:00:00Z',
      source: 'NSE Corporate Announcement',
      sourceTier: 1,
      eventPriority: 'P1',
      eventFreshness: 'BREAKING',
      sourceCount: 1,
      latestArticleId: 'art_tcs_001',
      primarySource: {
        publisher: 'NSE Corporate',
        tier: 1,
        publishedAt: '2026-08-25T10:00:00Z',
        extractionStatus: 'SUCCESS'
      },
      conflictStatus: 'NONE'
    } as any;

    const mockArticle: NewsArticle = {
      id: 'art_tcs_001',
      title: 'TCS Secures Major Cloud Modernization Deal',
      source: 'NSE Corporate',
      sourceTier: 1,
      publishedAt: '2026-08-25T10:00:00Z'
    } as any;

    const mockConfirmation: MarketConfirmationDossier = {
      symbol,
      fundamentalDirection: 'BULLISH',
      overallConfirmation: 'CONFIRMED',
      priceReaction: {
        symbol,
        reactionDirection: 'POSITIVE',
        percentagePriceChange: 2.4,
        availability: 'AVAILABLE',
        dataTimestamp: '2026-08-25T10:05:00Z',
        dataFreshness: 'REAL_TIME'
      } as any,
      volumeConfirmation: {
        symbol,
        confirmationStatus: 'STRONG_VOLUME_CONFIRMED' as any,
        volumeMultiple: 2.8,
        volumeAvailability: 'AVAILABLE'
      } as any,
      marketInterpretation: 'Confirmed bullish reaction.'
    } as any;

    const signal = fusion.fuse(mockEvent, mockArticle, mockConfirmation);
    const expectedCanonicalId = `${eventId}::${signal.signalType}::1`;

    // 1. Fusion output verification
    expect(signal.signalId).toBe(expectedCanonicalId);

    // 2. Lifecycle engine verification
    const lifecycle = lifecycleEngine.getLifecycle(expectedCanonicalId);
    expect(lifecycle).toBeDefined();
    expect(lifecycle?.signalId).toBe(expectedCanonicalId);
    expect(signal.signalId).toBe(lifecycle?.signalId);

    // 3. Outcome engine verification
    const outcome = outcomeEngine.getOutcomeRecord(expectedCanonicalId);
    expect(outcome).toBeDefined();
    expect(outcome?.signalId).toBe(expectedCanonicalId);
    expect(lifecycle?.signalId).toBe(outcome?.signalId);

    // Triple identity equality check
    expect(signal.signalId).toBe(lifecycle!.signalId);
    expect(lifecycle!.signalId).toBe(outcome!.signalId);
  });

  // ============================================================
  // TEST B — OUTCOME REGISTRATION PRESERVES CANONICAL ID
  // ============================================================
  it('TEST B — should preserve canonical 3-part ID on registerActionableSignal without appending symbol or rewriting', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    const explicitCanonicalId = 'evt_macro_shock_99::MACRO_SHOCK::1';

    const registered = outcomeEngine.registerActionableSignal({
      signalId: explicitCanonicalId,
      eventId: 'evt_macro_shock_99',
      signalType: 'MACRO_SHOCK',
      symbol: 'NIFTY',
      revision: 1,
      initialPrice: 24500,
      direction: 'BEARISH',
      priority: 'P0_CRITICAL'
    });

    expect(registered.signalId).toBe(explicitCanonicalId);
    expect(registered.signalId).not.toContain('NIFTY');
    expect(registered.signalId).not.toContain('rev1');

    // Retrieval by canonical ID
    const retrieved = outcomeEngine.getOutcomeRecord(explicitCanonicalId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.signalId).toBe(explicitCanonicalId);
  });

  // ============================================================
  // TEST C — LIFECYCLE UPDATE REACHES OUTCOME RECORD
  // ============================================================
  it('TEST C — should propagate lifecycle state transitions directly to the corresponding outcome record', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    const canonicalId = 'evt_earnings_reliance_01::EARNINGS::1';

    // 1. Register signal initially as ACTIVE
    outcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_earnings_reliance_01',
      signalType: 'EARNINGS',
      symbol: 'RELIANCE',
      revision: 1,
      initialPrice: 2800,
      initialMarketState: 'ACTIVE',
      direction: 'BULLISH'
    });

    const initialOutcome = outcomeEngine.getOutcomeRecord(canonicalId);
    expect(initialOutcome?.signalLifecycleState).toBe('ACTIVE');

    // 2. Lifecycle transitions to CONFIRMED
    const updatedOutcome = outcomeEngine.updateSignalLifecycleState(
      canonicalId,
      'CONFIRMED',
      'Price confirmed with 2.8% upward reaction'
    );

    expect(updatedOutcome).not.toBeNull();
    expect(updatedOutcome?.signalLifecycleState).toBe('CONFIRMED');

    // 3. Verify fetched outcome reflects the transition and timeline entry
    const finalOutcome = outcomeEngine.getOutcomeRecord(canonicalId);
    expect(finalOutcome?.signalLifecycleState).toBe('CONFIRMED');
    const hasTransitionTimeline = finalOutcome?.timeline.some(
      t => t.eventType === 'LIFECYCLE_TRANSITION' && t.details?.state === 'CONFIRMED'
    );
    expect(hasTransitionTimeline).toBe(true);
  });

  // ============================================================
  // TEST D — NO SILENT KEY MISMATCH ON MISSING SIGNAL
  // ============================================================
  it('TEST D — should fail explicitly (return null, log warning, increment unlinked counter) on key mismatch', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const invalidId = 'nonexistent_event::UNKNOWN_SIGNAL::1';
    const initialUnlinked = outcomeEngine.getUnlinkedLifecycleUpdateCount();

    const result = outcomeEngine.updateSignalLifecycleState(
      invalidId,
      'EXPIRED',
      'Signal exceeded maximum horizon'
    );

    expect(result).toBeNull();
    expect(outcomeEngine.getUnlinkedLifecycleUpdateCount()).toBe(initialUnlinked + 1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Outcome record not found for signalId: "${invalidId}"`)
    );

    consoleSpy.mockRestore();
  });

  // ============================================================
  // TEST E — DUPLICATE REGISTRATION IDEMPOTENCY
  // ============================================================
  it('TEST E — should handle duplicate signal registration idempotently without duplicates or state destruction', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    const canonicalId = 'evt_idempotent_test::MERGER::1';

    const first = outcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_idempotent_test',
      signalType: 'MERGER',
      symbol: 'HDFCBANK',
      revision: 1,
      initialPrice: 1650,
      direction: 'BULLISH',
      priority: 'P1_HIGH'
    });

    // Mutate state to CONFIRMED
    outcomeEngine.updateSignalLifecycleState(canonicalId, 'CONFIRMED', 'First confirmation');

    // Second registration attempt for same canonical signal
    const second = outcomeEngine.registerActionableSignal({
      signalId: canonicalId,
      eventId: 'evt_idempotent_test',
      signalType: 'MERGER',
      symbol: 'HDFCBANK',
      revision: 1,
      initialPrice: 1650,
      direction: 'BULLISH',
      priority: 'P1_HIGH'
    });

    expect(second.signalId).toBe(first.signalId);
    // Preserved prior state
    expect(second.signalLifecycleState).toBe('CONFIRMED');

    // Only one record in outcomes map
    const all = outcomeEngine.getAllOutcomeRecords();
    const matching = all.filter(r => r.signalId === canonicalId);
    expect(matching.length).toBe(1);
  });

  // ============================================================
  // TEST F — DIFFERENT REVISIONS FORM DISTINCT CANONICAL IDS
  // ============================================================
  it('TEST F — should generate distinct canonical IDs and outcome records for different signal revisions', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    const eventId = 'evt_policy_rate_change';
    const rev1Id = `${eventId}::POLICY_CHANGE::1`;
    const rev2Id = `${eventId}::POLICY_CHANGE::2`;

    const outcome1 = outcomeEngine.registerActionableSignal({
      signalId: rev1Id,
      eventId,
      signalType: 'POLICY_CHANGE',
      symbol: 'BANKNIFTY',
      revision: 1,
      initialPrice: 51000,
      direction: 'BULLISH'
    });

    const outcome2 = outcomeEngine.registerActionableSignal({
      signalId: rev2Id,
      eventId,
      signalType: 'POLICY_CHANGE',
      symbol: 'BANKNIFTY',
      revision: 2,
      initialPrice: 51400,
      direction: 'BEARISH'
    });

    expect(rev1Id).not.toBe(rev2Id);
    expect(outcome1.signalId).toBe(rev1Id);
    expect(outcome2.signalId).toBe(rev2Id);

    const r1 = outcomeEngine.getOutcomeRecord(rev1Id);
    const r2 = outcomeEngine.getOutcomeRecord(rev2Id);
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r1?.initialPrice).toBe(51000);
    expect(r2?.initialPrice).toBe(51400);
  });

  // ============================================================
  // TEST G — DIFFERENT SIGNAL TYPES FOR SAME EVENT ARE DISTINCT
  // ============================================================
  it('TEST G — should maintain distinct outcome records for different signal types under the same event', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    const eventId = 'evt_multi_signal_event_123';
    const idEarnings = `${eventId}::EARNINGS::1`;
    const idGuidance = `${eventId}::GUIDANCE_REVISION::1`;

    const rec1 = outcomeEngine.registerActionableSignal({
      signalId: idEarnings,
      eventId,
      signalType: 'EARNINGS',
      symbol: 'INFY',
      revision: 1,
      initialPrice: 1850,
      direction: 'BULLISH'
    });

    const rec2 = outcomeEngine.registerActionableSignal({
      signalId: idGuidance,
      eventId,
      signalType: 'GUIDANCE_REVISION',
      symbol: 'INFY',
      revision: 1,
      initialPrice: 1850,
      direction: 'BEARISH'
    });

    expect(rec1.signalId).not.toBe(rec2.signalId);
    expect(outcomeEngine.getOutcomeRecord(idEarnings)?.signalType).toBe('EARNINGS');
    expect(outcomeEngine.getOutcomeRecord(idGuidance)?.signalType).toBe('GUIDANCE_REVISION');
  });

  // ============================================================
  // TEST H — DIFFERENT EVENT IDS FORM DISTINCT CANONICAL IDS
  // ============================================================
  it('TEST H — should maintain distinct outcome records for different event IDs', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();
    const idAlpha = 'evt_company_alpha::DIVIDEND::1';
    const idBeta = 'evt_company_beta::DIVIDEND::1';

    const alpha = outcomeEngine.registerActionableSignal({
      signalId: idAlpha,
      eventId: 'evt_company_alpha',
      signalType: 'DIVIDEND',
      symbol: 'COALINDIA',
      revision: 1,
      initialPrice: 480
    });

    const beta = outcomeEngine.registerActionableSignal({
      signalId: idBeta,
      eventId: 'evt_company_beta',
      signalType: 'DIVIDEND',
      symbol: 'VEDL',
      revision: 1,
      initialPrice: 420
    });

    expect(alpha.signalId).toBe(idAlpha);
    expect(beta.signalId).toBe(idBeta);
    expect(outcomeEngine.getOutcomeRecord(idAlpha)?.symbol).toBe('COALINDIA');
    expect(outcomeEngine.getOutcomeRecord(idBeta)?.symbol).toBe('VEDL');
  });

  // ============================================================
  // TEST I — HISTORICAL DATA READ COMPATIBILITY
  // ============================================================
  it('TEST I — should resolve historical records via both exact persisted ID and compatibility alias', () => {
    const outcomeEngine = SignalOutcomeEngine.getInstance();

    // Read production outcomes JSON without writing to it
    const prodPath = path.resolve(process.cwd(), 'data/market_intelligence_outcomes.json');
    const rawData = fs.readFileSync(prodPath, 'utf-8');
    const prodRecords: SignalOutcomeRecord[] = JSON.parse(rawData);

    expect(prodRecords.length).toBe(446);

    // Pick 3 representative records
    const sampleRecords = [prodRecords[0], prodRecords[100], prodRecords[prodRecords.length - 1]];

    for (const sample of sampleRecords) {
      // Seed into isolated test engine
      outcomeEngine.recordOutcome(sample);

      // 1. Must be retrievable by exact stored signalId
      const byExactId = outcomeEngine.getOutcomeRecord(sample.signalId);
      expect(byExactId).not.toBeNull();
      expect(byExactId?.signalId).toBe(sample.signalId);

      // 2. Must be retrievable by canonical 3-part key
      const rev = sample.revision || 1;
      const canonicalKey = `${sample.eventId}::${sample.signalType}::${rev}`;
      const byCanonicalKey = outcomeEngine.getOutcomeRecord(canonicalKey);
      expect(byCanonicalKey).not.toBeNull();
      expect(byCanonicalKey?.signalId).toBe(sample.signalId);

      // 3. Must be retrievable by legacy 4-part key
      const legacyKey = `${sample.eventId}::${sample.signalType}::${sample.symbol}::rev${rev}`;
      const byLegacyKey = outcomeEngine.getOutcomeRecord(legacyKey);
      expect(byLegacyKey).not.toBeNull();
      expect(byLegacyKey?.signalId).toBe(sample.signalId);
    }
  });

  // ============================================================
  // TEST J — TEST STORAGE ISOLATION ENFORCEMENT
  // ============================================================
  it('TEST J — should enforce strict storage path isolation and disallow mutating canonical production files', () => {
    expect(SignalOutcomeEngine.isProductionStoragePath(testOutcomePath)).toBe(false);
    expect(SignalOutcomeEngine.isProductionStoragePath(testOutcomeBakPath)).toBe(false);
    expect(SignalOutcomeEngine.isProductionStoragePath('data/market_intelligence_outcomes.json')).toBe(true);
    expect(SignalOutcomeEngine.isProductionStoragePath('data/market_intelligence_outcomes.json.bak')).toBe(true);

    // Check that files created during this test exist only inside tempDir
    expect(testOutcomePath.startsWith(tempDir)).toBe(true);
    expect(testLifecyclePath.startsWith(tempDir)).toBe(true);
    expect(testLedgerPath.startsWith(tempDir)).toBe(true);
  });

  // ============================================================
  // TEST K — PRODUCTION DATASET SHA-256 HASH VERIFICATION
  // ============================================================
  it('TEST K — should confirm byte-for-byte immutability of all 4 protected production datasets', () => {
    for (const dataset of protectedDatasets) {
      const currentHash = computeSha256(dataset.filePath);
      expect(currentHash).toBe(dataset.expectedHash);
      expect(currentHash).toBe(preTestHashes[dataset.filePath]);
      expect(getRecordCount(dataset.filePath)).toBe(dataset.expectedCount);
    }
  });
});
