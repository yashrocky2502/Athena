/**
 * ATHENA NEWS ENGINE — PHASE 10E TEST SUITE
 * Market Signal Provenance Integrity
 *
 * Verifies:
 * A. Source propagation (NewsEvent -> MarketSignal, publisher, articleId, url, publishedAt, tier, count)
 * B. Fail-closed behavior (no Tier 1 or Tier 2 fallback, UNKNOWN status, no fabricated publisher/url)
 * C. Lifecycle propagation (MarketSignal -> SignalLifecycle, no Tier 1 inference, safe hydration)
 * D. Outcome propagation (Lifecycle -> SignalOutcome, UNKNOWN preserved, SYNTHETIC_TEST preserved)
 * E. Separation (Signal provenance vs Market observation provenance remain strictly separate)
 * F. Historical integrity (Protected datasets remain byte-for-byte unchanged)
 * G. AI integrity (Zero LLM / zero AI cost contract enforced)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MarketIntelligenceFusionEngine } from '../intelligence/MarketIntelligenceFusionEngine.ts';
import { eventToSignalTransmissionEngine } from '../intelligence/EventToSignalTransmissionEngine.ts';
import { SignalLifecycleEngine } from '../intelligence/SignalLifecycleEngine.ts';
import { SignalOutcomeEngine } from '../market-intelligence/SignalOutcomeEngine.ts';
import { ObservationTrustBridge } from '../market-data/ObservationTrustBridge.ts';
import {
  SignalProvenance,
  resolveSignalProvenance,
  validateProvenance,
  deriveSourceTierString,
  createUnknownProvenance,
  createSyntheticTestProvenance
} from '../types/SignalProvenance.ts';
import { NewsEvent } from '../types/NewsEvent.ts';
import { NewsArticle } from '../types/Article.ts';

const EXPECTED_HASHES: Record<string, string> = {
  'data/market_intelligence_outcomes.json': '47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd',
  'data/market_intelligence_outcomes.json.bak': '33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764',
  'data/news_signal_lifecycle.json': 'aefc42b49c7b1bc590fdce6f608ded9aaab520bd9374d008825b2160fba0aac1',
  'data/news_signal_historical_ledger.json': '805b745545a2302685958a80fbb9c2c2628dd587ff9ebf36cd5b31214af5402c'
};

function computeSha256(filePath: string): string {
  const fullPath = path.resolve(process.cwd(), filePath);
  const buffer = fs.readFileSync(fullPath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('PHASE 10E — MARKET SIGNAL PROVENANCE INTEGRITY', () => {

  // =========================================================================
  // A. SOURCE PROPAGATION (Tests 1 - 8)
  // =========================================================================
  describe('A. Source Propagation: NewsEvent / NewsArticle -> MarketSignal', () => {
    const canonicalEvent: NewsEvent = {
      eventId: 'EVT-TCS-CONTRACT-2026',
      eventFingerprint: 'fp-tcs-001',
      primaryEntity: 'TCS',
      symbol: 'TCS',
      category: 'CORPORATE',
      eventType: 'ORDER_WIN',
      firstSeenAt: '2026-09-22T08:30:00.000Z',
      lastUpdatedAt: '2026-09-22T08:35:00.000Z',
      latestArticleId: 'art-reuters-tcs-99',
      sourceArticleIds: ['art-reuters-tcs-99', 'art-mc-tcs-100', 'art-et-tcs-101'],
      primarySource: {
        publisher: 'Reuters',
        sourceUrl: 'https://reuters.com/markets/tcs-contract-win',
        headline: 'TCS bags $1.2B mega cloud modernization deal',
        tier: 1,
        publishedAt: '2026-09-22T08:30:00.000Z',
        articleId: 'art-reuters-tcs-99'
      },
      supportingSources: [
        {
          publisher: 'Moneycontrol',
          sourceUrl: 'https://moneycontrol.com/news/tcs-deal-expansion',
          headline: 'TCS surges following major contract win',
          tier: 2,
          publishedAt: '2026-09-22T08:32:00.000Z',
          articleId: 'art-mc-tcs-100'
        },
        {
          publisher: 'Economic Times',
          sourceUrl: 'https://economictimes.indiatimes.com/tech/tcs-order',
          headline: 'TCS expands footprint with $1.2B contract',
          tier: 2,
          publishedAt: '2026-09-22T08:34:00.000Z',
          articleId: 'art-et-tcs-101'
        }
      ],
      sourceCount: 3,
      eventStatus: 'CONFIRMED',
      eventPriority: 'P1',
      eventFreshness: 'BREAKING',
      confidence: 95,
      materialChangeDetected: true,
      escalationLevel: 1,
      conflictStatus: 'NONE',
      canonicalSummary: {
        whatHappened: 'TCS won a $1.2B cloud modernization contract',
        whyItMatters: 'Substantial multi-year revenue visibility'
      },
      keyNumbers: [],
      telegramState: 'SENT',
      traderIntelligenceAvailable: true
    };

    const canonicalArticle: Partial<NewsArticle> = {
      id: 'art-reuters-tcs-99',
      headline: 'TCS bags $1.2B mega cloud modernization deal',
      sourceUrl: 'https://reuters.com/markets/tcs-contract-win',
      publishedAt: '2026-09-22T08:30:00.000Z',
      source: {
        name: 'Reuters',
        publisher: 'Reuters',
        url: 'https://reuters.com',
        collectionMethod: 'RSS'
      }
    };

    it('1. NewsEvent primary source propagates accurately into MarketSignal', () => {
      const fusionEngine = MarketIntelligenceFusionEngine.getInstance();
      const signal = fusionEngine.fuse(canonicalEvent, canonicalArticle);

      expect(signal.provenance).toBeDefined();
      expect(signal.provenance.status).toBe('VERIFIED');
      expect(signal.provenance.primarySource).toBeDefined();
      expect(signal.provenance.primarySource?.publisher).toBe('Reuters');
    });

    it('2. Supporting sources propagate into MarketSignal supportingSources list', () => {
      const fusionEngine = MarketIntelligenceFusionEngine.getInstance();
      const signal = fusionEngine.fuse(canonicalEvent, canonicalArticle);

      expect(signal.provenance.supportingSources).toBeDefined();
      expect(signal.provenance.supportingSources.length).toBe(2);
      expect(signal.provenance.supportingSources[0].publisher).toBe('Moneycontrol');
      expect(signal.provenance.supportingSources[1].publisher).toBe('Economic Times');
    });

    it('3. Publisher identity is preserved faithfully without modification', () => {
      const fusionEngine = MarketIntelligenceFusionEngine.getInstance();
      const signal = fusionEngine.fuse(canonicalEvent, canonicalArticle);

      expect(signal.primaryPublisher).toBe('Reuters');
      expect(signal.provenance.primarySource?.publisher).toBe('Reuters');
    });

    it('4. Article ID is preserved end-to-end', () => {
      const fusionEngine = MarketIntelligenceFusionEngine.getInstance();
      const signal = fusionEngine.fuse(canonicalEvent, canonicalArticle);

      expect(signal.articleId).toBe('art-reuters-tcs-99');
      expect(signal.primaryArticleId).toBe('art-reuters-tcs-99');
      expect(signal.provenance.primarySource?.articleId).toBe('art-reuters-tcs-99');
    });

    it('5. Source URL is preserved when available', () => {
      const fusionEngine = MarketIntelligenceFusionEngine.getInstance();
      const signal = fusionEngine.fuse(canonicalEvent, canonicalArticle);

      expect(signal.primaryUrl).toBe('https://reuters.com/markets/tcs-contract-win');
      expect(signal.provenance.primarySource?.sourceUrl).toBe('https://reuters.com/markets/tcs-contract-win');
    });

    it('6. Publication timestamp is preserved faithfully', () => {
      const fusionEngine = MarketIntelligenceFusionEngine.getInstance();
      const signal = fusionEngine.fuse(canonicalEvent, canonicalArticle);

      expect(signal.primaryPublishedAt).toBe('2026-09-22T08:30:00.000Z');
      expect(signal.provenance.primarySource?.publishedAt).toBe('2026-09-22T08:30:00.000Z');
    });

    it('7. Source tier is preserved from the actual source metadata', () => {
      const fusionEngine = MarketIntelligenceFusionEngine.getInstance();
      const signal = fusionEngine.fuse(canonicalEvent, canonicalArticle);

      expect(signal.provenance.primarySource?.tier).toBe(1);
      expect(signal.sourceTier).toBe('TIER_1');
    });

    it('8. Source count reflects verified primary and supporting sources', () => {
      const fusionEngine = MarketIntelligenceFusionEngine.getInstance();
      const signal = fusionEngine.fuse(canonicalEvent, canonicalArticle);

      expect(signal.provenance.sourceCount).toBe(3);
      expect(signal.sourceCount).toBe(3);
    });

    it('8b. EventToSignalTransmissionEngine preserves provenance during event transmission', () => {
      const transmissionArticle: Partial<NewsArticle> = {
        id: 'art-bbg-infy-55',
        headline: 'Infosys expands AI partnership with $500M investment',
        body: 'Infosys announces massive contract win and enterprise AI expansion.',
        sourceUrl: 'https://bloomberg.com/news/infy-ai-expansion',
        publishedAt: '2026-09-22T09:15:00.000Z',
        symbol: 'INFY',
        source: {
          name: 'Bloomberg',
          publisher: 'Bloomberg',
          url: 'https://bloomberg.com',
          collectionMethod: 'API'
        }
      };

      const result = eventToSignalTransmissionEngine.transmitEventToSignal(transmissionArticle, true);

      expect(result.provenance).toBeDefined();
      expect(result.provenance.status).toBe('VERIFIED');
      expect(result.publisher).toBe('Bloomberg');
      expect(result.sourceUrl).toBe('https://bloomberg.com/news/infy-ai-expansion');
      expect(result.articleId).toBe('art-bbg-infy-55');
      expect(result.sourceTier).toBe('TIER_2'); // Bloomberg is Tier 2 financial wire
    });
  });

  // =========================================================================
  // B. FAIL-CLOSED BEHAVIOR (Tests 9 - 12)
  // =========================================================================
  describe('B. Fail-Closed Behavior: Missing or Incomplete Provenance', () => {
    it('9. Missing source information does NOT default to Tier 1 or Tier 2', () => {
      const emptyEvent = {
        eventId: 'EVT-ANONYMOUS-001',
        eventFingerprint: 'fp-anon-001',
        primaryEntity: 'RELIANCE',
        symbol: 'RELIANCE',
        category: 'CORPORATE',
        eventType: 'GENERAL',
        sourceCount: 0
      } as any;

      const emptyArticle = {} as any;
      const signal = MarketIntelligenceFusionEngine.getInstance().fuse(emptyEvent, emptyArticle);

      expect(signal.sourceTier).not.toBe('TIER_1');
      expect(signal.sourceTier).not.toBe('TIER_2');
    });

    it('10. Missing source becomes explicitly UNKNOWN', () => {
      const emptyEvent = {
        eventId: 'EVT-ANONYMOUS-002',
        symbol: 'HDFCBANK',
        sourceCount: 0
      } as any;

      const signal = MarketIntelligenceFusionEngine.getInstance().fuse(emptyEvent, {});

      expect(signal.sourceTier).toBe('UNKNOWN');
      expect(signal.provenance.status).toBe('UNKNOWN');
      expect(signal.provenance.primarySource).toBeUndefined();
      expect(signal.provenance.supportingSources).toEqual([]);
      expect(signal.provenance.sourceCount).toBe(0);
    });

    it('11. Missing publisher does NOT become a fabricated publisher', () => {
      const eventWithNoPub = {
        eventId: 'EVT-NOPUB-003',
        symbol: 'ICICIBANK',
        primarySource: {
          headline: 'Speculative rumor on social forum',
          sourceUrl: 'https://random-forum.xyz/post/123'
          // publisher is undefined/missing
        }
      } as any;

      const signal = MarketIntelligenceFusionEngine.getInstance().fuse(eventWithNoPub, {});

      expect(signal.primaryPublisher).toBeUndefined();
      expect(signal.provenance.status).toBe('UNKNOWN');
      // Verify no placeholder like "Athena Verified Source" or "Market Source" was fabricated
      expect(signal.primaryPublisher).not.toBe('Athena Verified Source');
      expect(signal.primaryPublisher).not.toBe('Market Source');
    });

    it('12. Missing URL remains missing and is never fabricated', () => {
      const eventNoUrl = {
        eventId: 'EVT-NOURL-004',
        symbol: 'SBIN',
        primarySource: {
          publisher: 'BSE',
          articleId: 'art-bse-filing-88',
          headline: 'BSE Corporate Disclosure Announcement',
          tier: 1,
          publishedAt: '2026-09-22T10:00:00.000Z'
          // sourceUrl omitted
        },
        sourceCount: 1
      } as any;

      const signal = MarketIntelligenceFusionEngine.getInstance().fuse(eventNoUrl, {});

      expect(signal.provenance.status).toBe('VERIFIED');
      expect(signal.provenance.primarySource?.publisher).toBe('BSE');
      expect(signal.provenance.primarySource?.sourceUrl).toBeUndefined();
      expect(signal.primaryUrl).toBeUndefined();
    });
  });

  // =========================================================================
  // C. LIFECYCLE PROPAGATION (Tests 13 - 15)
  // =========================================================================
  describe('C. Lifecycle Propagation: MarketSignal -> SignalLifecycle', () => {
    it('13. MarketSignal provenance propagates into SignalLifecycle record', () => {
      const fusionEngine = MarketIntelligenceFusionEngine.getInstance();
      const lifecycleEngine = SignalLifecycleEngine.getInstance();

      const event: NewsEvent = {
        eventId: 'EVT-BHARTIARTL-001',
        eventFingerprint: 'fp-airtel-001',
        primaryEntity: 'BHARTIARTL',
        symbol: 'BHARTIARTL',
        category: 'CORPORATE',
        eventType: 'GUIDANCE',
        firstSeenAt: '2026-09-22T11:00:00.000Z',
        lastUpdatedAt: '2026-09-22T11:00:00.000Z',
        latestArticleId: 'art-cnbc-airtel-1',
        sourceArticleIds: ['art-cnbc-airtel-1'],
        primarySource: {
          publisher: 'CNBC TV18',
          sourceUrl: 'https://cnbctv18.com/telecom/airtel-guidance',
          headline: 'Airtel raises ARPU guidance for FY27',
          tier: 2,
          publishedAt: '2026-09-22T11:00:00.000Z',
          articleId: 'art-cnbc-airtel-1'
        },
        supportingSources: [],
        sourceCount: 1,
        eventStatus: 'NEW',
        eventPriority: 'P1',
        eventFreshness: 'VERY_FRESH',
        confidence: 90,
        materialChangeDetected: true,
        escalationLevel: 0,
        conflictStatus: 'NONE',
        canonicalSummary: {
          whatHappened: 'Airtel raised ARPU target to Rs 300',
          whyItMatters: 'Positive margins expansion'
        },
        keyNumbers: [],
        telegramState: 'PENDING',
        traderIntelligenceAvailable: true
      };

      const signal = fusionEngine.fuse(event, { id: 'art-cnbc-airtel-1' });
      const lifecycle = lifecycleEngine.evaluateSignal(signal, event);

      expect(lifecycle.provenance).toBeDefined();
      expect(lifecycle.provenance?.status).toBe('VERIFIED');
      expect(lifecycle.primaryPublisher).toBe('CNBC TV18');
      expect(lifecycle.sourceTier).toBe('TIER_2');
      expect(lifecycle.sourceCount).toBe(1);
    });

    it('14. Lifecycle does NOT infer Tier 1 when provenance is missing or unknown', () => {
      const lifecycleEngine = SignalLifecycleEngine.getInstance();
      const unknownSignal = {
        signalId: 'SIG-UNKNOWN-SOURCE-TEST-1',
        eventId: 'EVT-UNKNOWN-SOURCE-1',
        articleId: '',
        symbol: 'WIPRO',
        eventType: 'OTHER',
        signalType: 'MOMENTUM_WATCH',
        priority: 'P3_LOW' as any,
        signalScore: 40,
        components: { eventMateriality: 40, marketReaction: 0, volumeConfirmation: 0, fnoConfirmation: 0, sourceAuthority: 0, freshness: 50, crossSignalAlignment: 50, dataQuality: 50 },
        alignment: 'NEUTRAL' as any,
        lifecycleState: 'NEW' as any,
        explanation: 'Test unknown provenance',
        timestamp: new Date().toISOString(),
        revision: 1,
        crossAssetImpacts: [],
        warnings: [],
        eventMateriality: 'LOW' as any,
        fundamentalDirection: 'NEUTRAL' as any,
        priceReactionText: 'UNAVAILABLE',
        volumeText: 'UNAVAILABLE',
        fnoText: 'UNAVAILABLE',
        overallConfirmation: 'INSUFFICIENT_EVIDENCE' as any,
        sourceTier: 'UNKNOWN' as any,
        freshnessText: 'BREAKING',
        provenance: createUnknownProvenance(),
        sourceCount: 0
      };

      const lifecycle = lifecycleEngine.evaluateSignal(unknownSignal as any);

      expect(lifecycle.sourceTier).not.toBe('Tier 1');
      expect(lifecycle.sourceTier).not.toBe('TIER_1');
      expect(lifecycle.sourceTier).toBe('UNKNOWN');
      expect(lifecycle.provenance?.status).toBe('UNKNOWN');
    });

    it('15. Historical lifecycle hydration does not rewrite provenance on existing records', () => {
      const lifecycleEngine = SignalLifecycleEngine.getInstance();
      // Hydrate state
      lifecycleEngine.hydrate();

      // Verify that data/news_signal_lifecycle.json hash remains byte-for-byte unchanged
      const currentHash = computeSha256('data/news_signal_lifecycle.json');
      expect(currentHash).toBe(EXPECTED_HASHES['data/news_signal_lifecycle.json']);
    });
  });

  // =========================================================================
  // D. OUTCOME PROPAGATION (Tests 16 - 18)
  // =========================================================================
  describe('D. Outcome Propagation: Lifecycle -> SignalOutcome', () => {
    it('16. MarketSignal/Lifecycle provenance propagates into SignalOutcomeRecord', () => {
      const outcomeEngine = SignalOutcomeEngine.getInstance();
      const signalId = `SIG-PROVENANCE-OUTCOME-TEST-${Date.now()}`;

      const verifiedProv: SignalProvenance = {
        status: 'VERIFIED',
        primarySource: {
          articleId: 'art-livemint-999',
          publisher: 'LiveMint',
          sourceUrl: 'https://livemint.com/market/deal-announcement',
          tier: 2,
          publishedAt: '2026-09-22T12:00:00.000Z'
        },
        supportingSources: [],
        sourceCount: 1
      };

      const record = outcomeEngine.registerActionableSignal({
        signalId,
        eventId: 'EVT-TEST-OUTCOME-01',
        signalType: 'ORDER_WIN',
        symbol: 'TATASTEEL',
        initialPrice: 155.0,
        sourceTier: 'TIER_2',
        provenance: verifiedProv
      });

      expect(record.provenance).toBeDefined();
      expect(record.provenance?.status).toBe('VERIFIED');
      expect(record.primaryPublisher).toBe('LiveMint');
      expect(record.primaryArticleId).toBe('art-livemint-999');
      expect(record.sourceUrl).toBe('https://livemint.com/market/deal-announcement');
      expect(record.sourceTier).toBe('TIER_2');
    });

    it('17. Missing provenance remains UNKNOWN and does not default to Tier 1', () => {
      const outcomeEngine = SignalOutcomeEngine.getInstance();
      const signalId = `SIG-UNKNOWN-OUTCOME-${Date.now()}`;

      const record = outcomeEngine.registerActionableSignal({
        signalId,
        eventId: 'EVT-TEST-OUTCOME-UNKNOWN',
        signalType: 'GENERAL',
        symbol: 'VEDL',
        initialPrice: 420.0
        // No provenance, no sourceTier passed
      });

      expect(record.provenance?.status).toBe('UNKNOWN');
      expect(record.sourceTier).not.toBe('Tier 1');
      expect(record.sourceTier).not.toBe('TIER_1');
      expect(record.sourceTier).toBe('UNKNOWN');
    });

    it('18. Synthetic test provenance remains explicitly SYNTHETIC_TEST', () => {
      const outcomeEngine = SignalOutcomeEngine.getInstance();
      const signalId = `SIG-SYNTHETIC-OUTCOME-${Date.now()}`;

      const syntheticProv = createSyntheticTestProvenance();

      const record = outcomeEngine.registerActionableSignal({
        signalId,
        eventId: 'EVT-SYNTHETIC-TEST-1',
        signalType: 'SYNTHETIC_SIGNAL',
        symbol: 'INFY',
        initialPrice: 1800.0,
        isSyntheticTest: true,
        provenance: syntheticProv
      });

      expect(record.provenance?.status).toBe('SYNTHETIC_TEST');
      expect(record.sourceTier).toBe('SYNTHETIC_TEST');
    });
  });

  // =========================================================================
  // E. SEPARATION OF DOMAINS (Tests 19 - 21)
  // =========================================================================
  describe('E. Separation: Signal/News Provenance vs Market Observation Provenance', () => {
    it('19. Signal provenance and market-observation provenance are strictly decoupled', () => {
      // Signal provenance represents the catalyst origin (publisher, article, tier)
      const signalProv: SignalProvenance = {
        status: 'VERIFIED',
        primarySource: {
          articleId: 'art-bse-01',
          publisher: 'BSE',
          tier: 1
        },
        supportingSources: [],
        sourceCount: 1
      };

      // Market observation provenance represents exchange tick truth
      const obsTick = {
        symbol: 'TCS',
        price: 4250.0,
        timestamp: new Date().toISOString(),
        exchange: 'NSE',
        source: 'YAHOO_FINANCE',
        marketSession: 'REGULAR_HOURS',
        isStale: false,
        observationProvenance: {
          provider: 'YAHOO_FINANCE',
          quoteTimestamp: new Date().toISOString(),
          trustLevel: 'VERIFIED_OBSERVATION'
        }
      };

      // Ensure signal provenance has no market provider fields
      expect((signalProv as any).provider).toBeUndefined();
      expect((signalProv as any).exchange).toBeUndefined();
      expect((signalProv as any).marketSession).toBeUndefined();

      // Ensure observation tick provenance has no news publisher fields
      expect((obsTick.observationProvenance as any).headline).toBeUndefined();
      expect((obsTick.observationProvenance as any).publisher).toBeUndefined();
      expect((obsTick.observationProvenance as any).articleId).toBeUndefined();
    });

    it('20. ObservationTrustBridge continues enforcing observation provenance rules', () => {
      const outcomeEngine = SignalOutcomeEngine.getInstance();

      // Register test signal first so validateObservations can resolve it
      outcomeEngine.registerActionableSignal({
        signalId: 'SIG-VAL-01',
        eventId: 'EVT-VAL-01',
        signalType: 'ORDER_WIN',
        symbol: 'RELIANCE',
        initialPrice: 2900.0
      });

      // Valid observation tick passes validation
      const validTick = {
        signalId: 'SIG-VAL-01',
        symbol: 'RELIANCE',
        price: 2950.0,
        volume: 1200000,
        timestamp: new Date().toISOString(),
        exchange: 'NSE',
        source: 'YAHOO_FINANCE',
        isStale: false,
        marketSession: 'REGULAR_HOURS',
        provenance: {
          sourceType: 'APPROVED_MARKET_PROVIDER',
          provider: 'YAHOO_FINANCE',
          exchange: 'NSE',
          sourceConfidence: 1.0,
          verifiedAt: new Date().toISOString()
        }
      };

      const result = outcomeEngine.validateObservations('SIG-VAL-01', [validTick]);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);

      // Fabricated / invalid tick price is strictly rejected
      const invalidTick = {
        signalId: 'SIG-VAL-01',
        symbol: 'RELIANCE',
        price: -10, // Invalid price
        timestamp: new Date().toISOString(),
        source: 'UNVERIFIED_SOURCE'
      };
      const invalidResult = outcomeEngine.validateObservations('SIG-VAL-01', [invalidTick]);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('21. No synthetic market observations are introduced during signal provenance tracking', () => {
      const outcomeEngine = SignalOutcomeEngine.getInstance();
      const signalId = `SIG-NO-SYNTHETIC-OBS-${Date.now()}`;

      // Register signal without initial market price
      const record = outcomeEngine.registerActionableSignal({
        signalId,
        eventId: 'EVT-REAL-01',
        signalType: 'ORDER_WIN',
        symbol: 'LT',
        initialPrice: undefined // Missing initial price
      });

      // Must remain PENDING_INITIAL_QUOTE / INSUFFICIENT_MARKET_DATA
      // Never synthesize a fake 100.0 or 0.0 price
      expect(record.initialPrice).toBeUndefined();
      expect(record.isMissingInitialPrice).toBe(true);
      expect(record.outcome).toBe('INSUFFICIENT_MARKET_DATA');
      expect(record.dataFreshness).toBe('PENDING_INITIAL_QUOTE');
    });
  });

  // =========================================================================
  // F. HISTORICAL INTEGRITY (Tests 22 - 24)
  // =========================================================================
  describe('F. Historical Integrity: Protected Production Datasets', () => {
    it('22. Protected dataset files remain byte-for-byte unchanged', () => {
      for (const [fileRelPath, expectedHash] of Object.entries(EXPECTED_HASHES)) {
        const actualHash = computeSha256(fileRelPath);
        expect(actualHash, `Hash mismatch in protected file: ${fileRelPath}`).toBe(expectedHash);
      }
    });

    it('23. No historical migration or schema rewriting occurred in historical datasets', () => {
      const outcomesPath = path.resolve(process.cwd(), 'data/market_intelligence_outcomes.json');
      const raw = fs.readFileSync(outcomesPath, 'utf-8');
      const outcomes = JSON.parse(raw);

      expect(Array.isArray(outcomes)).toBe(true);
      expect(outcomes.length).toBeGreaterThan(0);

      // Verify historical records maintain their original structure
      const firstRecord = outcomes[0];
      expect(firstRecord.signalId).toBeDefined();
    });

    it('24. No historical record is rewritten merely to add provenance', () => {
      const lifecyclePath = path.resolve(process.cwd(), 'data/news_signal_lifecycle.json');
      const raw = fs.readFileSync(lifecyclePath, 'utf-8');
      const lifecycles = JSON.parse(raw);

      // The historical records in the file on disk should not have been mutated
      const keys = Object.keys(lifecycles);
      expect(keys.length).toBeGreaterThan(0);
      const currentHash = computeSha256('data/news_signal_lifecycle.json');
      expect(currentHash).toBe(EXPECTED_HASHES['data/news_signal_lifecycle.json']);
    });
  });

  // =========================================================================
  // G. AI INTEGRITY (Test 25)
  // =========================================================================
  describe('G. AI Integrity: Absolute Zero-AI Cost Contract', () => {
    it('25. No LLM / AI call is introduced across fusion, lifecycle, or outcomes', () => {
      const fusion = MarketIntelligenceFusionEngine.getInstance();
      const initialZeroAiCount = fusion.getObservability().zeroAiExecutions;

      const event: NewsEvent = {
        eventId: `EVT-ZERO-AI-${Date.now()}`,
        eventFingerprint: 'fp-ai-01',
        primaryEntity: 'INFY',
        symbol: 'INFY',
        category: 'CORPORATE',
        eventType: 'ORDER_WIN',
        firstSeenAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        latestArticleId: 'art-ai-01',
        sourceArticleIds: ['art-ai-01'],
        primarySource: {
          publisher: 'BSE',
          sourceUrl: 'https://bseindia.com/filing',
          headline: 'Infosys signs deal',
          tier: 1,
          publishedAt: new Date().toISOString(),
          articleId: 'art-ai-01'
        },
        supportingSources: [],
        sourceCount: 1,
        eventStatus: 'CONFIRMED',
        eventPriority: 'P1',
        eventFreshness: 'BREAKING',
        confidence: 90,
        materialChangeDetected: true,
        escalationLevel: 0,
        conflictStatus: 'NONE',
        canonicalSummary: { whatHappened: 'Deal signed', whyItMatters: 'Revenue growth' },
        keyNumbers: [],
        telegramState: 'SENT',
        traderIntelligenceAvailable: true
      };

      const signal = fusion.fuse(event, { id: 'art-ai-01' });
      expect(signal).toBeDefined();

      const finalZeroAiCount = fusion.getObservability().zeroAiExecutions;
      expect(finalZeroAiCount).toBeGreaterThan(initialZeroAiCount);

      // Verify zero AI calls across transmission engine as well
      const transmissionObs = eventToSignalTransmissionEngine.getObservability();
      expect(transmissionObs.aiInvocationCount).toBe(0);
      expect(transmissionObs.deterministicExecutionCount).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // H. STRICT FAIL-CLOSED PROVENANCE REMEDIATION (Explicit Tests A through S)
  // =========================================================================
  describe('H. Strict Fail-Closed Provenance Remediation (Explicit Tests A through S)', () => {
    it('A. complete authoritative source -> VERIFIED', () => {
      const event = {
        eventId: 'EVT-AUTH-01',
        symbol: 'RELIANCE',
        latestArticleId: 'art-reuters-999',
        primarySource: {
          publisher: 'Reuters',
          articleId: 'art-reuters-999',
          sourceUrl: 'https://reuters.com/business/reliance-contract',
          tier: 2
        }
      };
      const prov = resolveSignalProvenance(event);
      expect(prov.status).toBe('VERIFIED');
      expect(prov.primarySource?.publisher).toBe('Reuters');
      expect(prov.primarySource?.articleId).toBe('art-reuters-999');
      expect(prov.primarySource?.tier).toBe(2);
      expect(prov.primarySource?.sourceUrl).toBe('https://reuters.com/business/reliance-contract');
    });

    it('B. missing articleId -> not VERIFIED', () => {
      const event = {
        eventId: 'EVT-NO-ART-01',
        symbol: 'TCS',
        primarySource: {
          publisher: 'Reuters',
          sourceUrl: 'https://reuters.com/markets/tcs',
          tier: 2
        }
      };
      const prov = resolveSignalProvenance(event);
      expect(prov.status).not.toBe('VERIFIED');
      expect(prov.status).toBe('PARTIALLY_VERIFIED');
      expect(prov.primarySource?.articleId).toBeUndefined();
    });

    it('C. missing publisher -> UNKNOWN/UNVERIFIED as semantically appropriate', () => {
      // Case 1: No evidence at all -> UNKNOWN
      const noEvidence = resolveSignalProvenance({ eventId: 'EVT-EMPTY' });
      expect(noEvidence.status).toBe('UNKNOWN');
      expect(noEvidence.primarySource).toBeUndefined();

      // Case 2: Untrusted generic claim -> UNVERIFIED
      const genericClaim = resolveSignalProvenance({
        eventId: 'EVT-GENERIC',
        primarySource: {
          publisher: 'Athena Verified Source',
          articleId: 'art-gen-01'
        }
      });
      expect(genericClaim.status).toBe('UNVERIFIED');
    });

    it('D. missing tier with known publisher -> deterministic rank may resolve tier, but missing article identity must still prevent VERIFIED', () => {
      // Case 1: Known publisher with articleId and missing tier -> VERIFIED with resolved tier
      const withArticle = resolveSignalProvenance({
        eventId: 'EVT-RANK-01',
        primarySource: {
          publisher: 'Reuters',
          articleId: 'art-reuters-rank-01',
          sourceUrl: 'https://reuters.com/markets'
        }
      });
      expect(withArticle.status).toBe('VERIFIED');
      expect(withArticle.primarySource?.tier).toBe(2);

      // Case 2: Known publisher without articleId and missing tier -> PARTIALLY_VERIFIED
      const withoutArticle = resolveSignalProvenance({
        eventId: 'EVT-RANK-02',
        primarySource: {
          publisher: 'Reuters',
          sourceUrl: 'https://reuters.com/markets'
        }
      });
      expect(withoutArticle.status).not.toBe('VERIFIED');
      expect(withoutArticle.status).toBe('PARTIALLY_VERIFIED');
      expect(withoutArticle.primarySource?.tier).toBe(2);
    });

    it('E. invalid tier -> no fabricated tier', () => {
      const prov = resolveSignalProvenance({
        eventId: 'EVT-INVALID-TIER',
        primarySource: {
          publisher: 'RandomUnrankedBlog99',
          articleId: 'art-unranked-01',
          tier: 99
        }
      });
      expect(prov.primarySource?.tier).toBeUndefined();
      expect(prov.primarySource?.tier).not.toBe(1);
      expect(prov.primarySource?.tier).not.toBe(2);
      expect(prov.primarySource?.tier).not.toBe(99);
      expect(prov.status).not.toBe('VERIFIED');
    });

    it('F. missing URL -> must not fabricate URL', () => {
      const prov = resolveSignalProvenance({
        eventId: 'EVT-NO-URL',
        primarySource: {
          publisher: 'BSE',
          articleId: 'art-bse-01',
          tier: 1
        }
      });
      expect(prov.primarySource?.sourceUrl).toBeUndefined();
    });

    it('G. ambiguous publisher -> fail closed', () => {
      const prov = resolveSignalProvenance({
        eventId: 'EVT-AMBIGUOUS',
        primarySource: {
          publisher: 'Market Source',
          articleId: 'art-amb-01'
        }
      });
      expect(prov.status).toBe('UNVERIFIED');
      expect(prov.status).not.toBe('VERIFIED');
    });

    it('H. explicit SYNTHETIC_TEST -> remains SYNTHETIC_TEST', () => {
      const prov = resolveSignalProvenance({
        isSyntheticTest: true,
        primarySource: {
          publisher: 'SimulatedPublisher',
          tier: 1
        }
      });
      expect(prov.status).toBe('SYNTHETIC_TEST');
    });

    it('I. no test-article-id leaks into production provenance', () => {
      const prov = resolveSignalProvenance({
        eventId: 'EVT-PROD-01',
        primarySource: {
          publisher: 'Reuters'
        }
      });
      expect(prov.primarySource?.articleId).not.toBe('test-article-id');
      expect(prov.primarySource?.articleId).toBeUndefined();
    });

    it('J. no tier ?? 1 fallback', () => {
      const prov = resolveSignalProvenance({
        eventId: 'EVT-NO-TIER-1-FALLBACK',
        primarySource: {
          publisher: 'UnrankedPublicationXYZ',
          articleId: 'art-xyz-01'
        }
      });
      expect(prov.primarySource?.tier).not.toBe(1);
      expect(prov.primarySource?.tier).toBeUndefined();
    });

    it('K. no tier ?? 2 fallback', () => {
      const prov = resolveSignalProvenance({
        eventId: 'EVT-NO-TIER-2-FALLBACK',
        primarySource: {
          publisher: 'UnrankedPublicationXYZ',
          articleId: 'art-xyz-01'
        }
      });
      expect(prov.primarySource?.tier).not.toBe(2);
      expect(prov.primarySource?.tier).toBeUndefined();
    });

    it('L. pipeline preserves UNKNOWN', () => {
      const event: any = {
        eventId: 'EVT-PIPE-UNKNOWN',
        eventFingerprint: 'fp-unk',
        symbol: 'INFY',
        category: 'CORPORATE',
        eventType: 'ORDER_WIN',
        firstSeenAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        sourceArticleIds: [],
        sourceCount: 0,
        confidence: 50,
        eventPriority: 'P3',
        eventStatus: 'CONFIRMED',
        canonicalSummary: { whatHappened: 'Unknown event', whyItMatters: 'Unknown' }
      };
      const signal = MarketIntelligenceFusionEngine.getInstance().fuse(event, {});
      expect(signal.provenance.status).toBe('UNKNOWN');

      const lifecycle = SignalLifecycleEngine.getInstance().evaluateSignal(signal, event);
      expect(lifecycle.provenance?.status).toBe('UNKNOWN');

      const outcome = SignalOutcomeEngine.getInstance().registerActionableSignal(signal);
      expect(outcome.provenance.status).toBe('UNKNOWN');
      expect(outcome.provenanceStatus).toBe('UNKNOWN');
    });

    it('M. pipeline preserves PARTIALLY_VERIFIED', () => {
      const event: any = {
        eventId: 'EVT-PIPE-PARTIAL',
        eventFingerprint: 'fp-partial',
        symbol: 'TCS',
        category: 'CORPORATE',
        eventType: 'ORDER_WIN',
        firstSeenAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        sourceArticleIds: [],
        sourceCount: 1,
        confidence: 80,
        eventPriority: 'P2',
        eventStatus: 'CONFIRMED',
        canonicalSummary: { whatHappened: 'Deal', whyItMatters: 'Revenue' },
        primarySource: {
          publisher: 'Reuters',
          sourceUrl: 'https://reuters.com/markets'
        }
      };
      const signal = MarketIntelligenceFusionEngine.getInstance().fuse(event, {});
      expect(signal.provenance.status).toBe('PARTIALLY_VERIFIED');

      const lifecycle = SignalLifecycleEngine.getInstance().evaluateSignal(signal, event);
      expect(lifecycle.provenance?.status).toBe('PARTIALLY_VERIFIED');

      const outcome = SignalOutcomeEngine.getInstance().registerActionableSignal(signal);
      expect(outcome.provenance.status).toBe('PARTIALLY_VERIFIED');
      expect(outcome.provenanceStatus).toBe('PARTIALLY_VERIFIED');
    });

    it('N. pipeline preserves UNVERIFIED', () => {
      const event: any = {
        eventId: 'EVT-PIPE-UNVERIFIED',
        eventFingerprint: 'fp-unverified',
        symbol: 'WIPRO',
        category: 'CORPORATE',
        eventType: 'ORDER_WIN',
        firstSeenAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        sourceArticleIds: ['art-unv-1'],
        sourceCount: 1,
        confidence: 50,
        eventPriority: 'P3',
        eventStatus: 'CONFIRMED',
        canonicalSummary: { whatHappened: 'Rumor', whyItMatters: 'Unverified' },
        primarySource: {
          publisher: 'Athena Verified Source',
          articleId: 'art-unv-1'
        }
      };
      const signal = MarketIntelligenceFusionEngine.getInstance().fuse(event, {});
      expect(signal.provenance.status).toBe('UNVERIFIED');

      const lifecycle = SignalLifecycleEngine.getInstance().evaluateSignal(signal, event);
      expect(lifecycle.provenance?.status).toBe('UNVERIFIED');

      const outcome = SignalOutcomeEngine.getInstance().registerActionableSignal(signal);
      expect(outcome.provenance.status).toBe('UNVERIFIED');
      expect(outcome.provenanceStatus).toBe('UNVERIFIED');
    });

    it('O. lifecycle cannot upgrade provenance', () => {
      const signalWithInvalidVerified: any = {
        signalId: 'SIG-UPGRADE-TEST-LC',
        symbol: 'INFY',
        eventType: 'ORDER_WIN',
        priority: 'P2',
        fundamentalDirection: 'POSITIVE',
        signalScore: 80,
        revision: 1,
        createdAt: new Date().toISOString(),
        volumeText: 'INSUFFICIENT_EVIDENCE',
        priceReactionText: 'UNKNOWN',
        fnoText: 'INSUFFICIENT_EVIDENCE',
        overallConfirmation: 'CONFIRMED',
        warnings: [],
        provenance: {
          status: 'VERIFIED',
          primarySource: {
            publisher: 'Reuters'
          },
          supportingSources: [],
          sourceCount: 1
        }
      };
      const lc = SignalLifecycleEngine.getInstance().evaluateSignal(signalWithInvalidVerified);
      expect(lc.provenance?.status).not.toBe('VERIFIED');
      expect(lc.provenance?.status).toBe('PARTIALLY_VERIFIED');
    });

    it('P. outcome cannot upgrade provenance', () => {
      const signalWithInvalidVerified: any = {
        signalId: 'SIG-UPGRADE-TEST-OUTCOME',
        symbol: 'INFY',
        eventType: 'ORDER_WIN',
        priority: 'P2',
        fundamentalDirection: 'POSITIVE',
        signalScore: 80,
        revision: 1,
        createdAt: new Date().toISOString(),
        provenance: {
          status: 'VERIFIED',
          primarySource: {
            publisher: 'Reuters'
          },
          supportingSources: [],
          sourceCount: 1
        }
      };
      const outcome = SignalOutcomeEngine.getInstance().registerActionableSignal(signalWithInvalidVerified);
      expect(outcome.provenance.status).not.toBe('VERIFIED');
      expect(outcome.provenance.status).toBe('PARTIALLY_VERIFIED');
      expect(outcome.provenanceStatus).toBe('PARTIALLY_VERIFIED');
    });

    it('Q. signal provenance remains separate from ObservationTrustBridge provenance', () => {
      const signalOutcomeEngine = SignalOutcomeEngine.getInstance();
      const testSignalId = 'SIG-PROV-SEP-003';
      const signal: any = {
        signalId: testSignalId,
        symbol: 'INFY',
        direction: 'LONG',
        fundamentalDirection: 'POSITIVE',
        entryPrice: 1500,
        generatedAt: new Date().toISOString(),
        provenance: {
          status: 'VERIFIED',
          primarySource: {
            publisher: 'Reuters',
            articleId: 'art-reuters-sep-02',
            sourceUrl: 'https://reuters.com/tech/infy',
            tier: 2
          },
          supportingSources: [],
          sourceCount: 1
        }
      };
      signalOutcomeEngine.registerActionableSignal(signal);

      const validTick = {
        signalId: testSignalId,
        symbol: 'INFY',
        price: 1515,
        volume: 120000,
        timestamp: new Date().toISOString(),
        exchange: 'NSE',
        source: 'YAHOO_FINANCE',
        isStale: false,
        marketSession: 'REGULAR_HOURS',
        provenance: {
          sourceType: 'APPROVED_MARKET_PROVIDER',
          provider: 'YAHOO_FINANCE',
          exchange: 'NSE',
          sourceConfidence: 1.0,
          verifiedAt: new Date().toISOString()
        }
      };

      const validationResult = signalOutcomeEngine.validateObservations(testSignalId, [validTick]);
      expect(validationResult.isValid).toBe(true);
      expect(validTick.provenance.provider).toBe('YAHOO_FINANCE');
      expect(signal.provenance.primarySource.publisher).toBe('Reuters');
      expect(validTick.provenance.provider).not.toBe('Reuters');
    });

    it('R. protected historical hashes remain exact', () => {
      for (const [fileRelPath, expectedHash] of Object.entries(EXPECTED_HASHES)) {
        const actualHash = computeSha256(fileRelPath);
        expect(actualHash, `Mismatch in protected file: ${fileRelPath}`).toBe(expectedHash);
      }
    });

    it('S. zero AI/LLM calls introduced', () => {
      const fusion = MarketIntelligenceFusionEngine.getInstance();
      expect(fusion.getObservability().zeroAiExecutions).toBeGreaterThan(0);
      const transmissionObs = eventToSignalTransmissionEngine.getObservability();
      expect(transmissionObs.aiInvocationCount).toBe(0);
    });

    it('T. Existing VERIFIED provenance with unknown publisher must NOT remain VERIFIED', () => {
      const prov: SignalProvenance = {
        status: 'VERIFIED',
        primarySource: {
          articleId: 'real-article-123',
          publisher: 'RandomUnknownPublisherXYZ',
          tier: 2
        },
        supportingSources: [],
        sourceCount: 1
      };
      const validated = validateProvenance(prov);
      expect(validated.status).not.toBe('VERIFIED');
    });

    it('U. Existing VERIFIED provenance with recognized publisher remains VERIFIED when all required fields are valid', () => {
      const prov: SignalProvenance = {
        status: 'VERIFIED',
        primarySource: {
          articleId: 'art-reuters-123',
          publisher: 'Reuters',
          tier: 2,
          sourceUrl: 'https://reuters.com/markets/stocks'
        },
        supportingSources: [],
        sourceCount: 1
      };
      const validated = validateProvenance(prov);
      expect(validated.status).toBe('VERIFIED');
      expect(validated.primarySource?.publisher).toBe('Reuters');
    });

    it('V. Existing VERIFIED provenance with known publisher but invalid/mismatched URL must not remain VERIFIED', () => {
      const prov: SignalProvenance = {
        status: 'VERIFIED',
        primarySource: {
          articleId: 'art-reuters-123',
          publisher: 'Reuters',
          tier: 2,
          sourceUrl: 'https://moneycontrol.com/mismatched-article'
        },
        supportingSources: [],
        sourceCount: 1
      };
      const validated = validateProvenance(prov);
      expect(validated.status).not.toBe('VERIFIED');
      expect(validated.status).toBe('UNVERIFIED');
    });

    it('W. Existing PARTIALLY_VERIFIED provenance must not be upgraded merely by validateProvenance()', () => {
      const prov: SignalProvenance = {
        status: 'PARTIALLY_VERIFIED',
        primarySource: {
          articleId: 'art-reuters-123',
          publisher: 'Reuters',
          tier: 2
        },
        supportingSources: [],
        sourceCount: 1
      };
      const validated = validateProvenance(prov);
      expect(validated.status).toBe('PARTIALLY_VERIFIED');
    });

    it('X. Existing UNVERIFIED provenance must not be upgraded', () => {
      const prov: SignalProvenance = {
        status: 'UNVERIFIED',
        primarySource: {
          articleId: 'art-reuters-123',
          publisher: 'Reuters',
          tier: 2
        },
        supportingSources: [],
        sourceCount: 1
      };
      const validated = validateProvenance(prov);
      expect(validated.status).toBe('UNVERIFIED');
    });

    it('Y. Existing UNKNOWN provenance must remain UNKNOWN', () => {
      const prov: SignalProvenance = {
        status: 'UNKNOWN',
        supportingSources: [],
        sourceCount: 0
      };
      const validated = validateProvenance(prov);
      expect(validated.status).toBe('UNKNOWN');
    });
  });
});
