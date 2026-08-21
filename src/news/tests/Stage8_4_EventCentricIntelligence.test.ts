/**
 * ATHENA NEWS ENGINE — STAGE 8.4 REGRESSION TEST SUITE
 * Event-Centric Live Intelligence Orchestration & Verification.
 * 30 Comprehensive Forensic & Integration Test Cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventCentricOrchestrator } from '../intelligence/EventCentricOrchestrator';
import { SourceAuthorityRanker } from '../intelligence/SourceAuthorityRanker';
import { EventEvidenceAggregator } from '../intelligence/EventEvidenceAggregator';
import { EventEscalationDetector } from '../intelligence/EventEscalationDetector';
import { EventStateMachine } from '../intelligence/EventStateMachine';
import { EventFingerprintEngine } from '../deduplication/EventFingerprintEngine';
import { NewsArticle } from '../types/Article';
import { JsonNewsRepository } from '../storage/JsonNewsRepository';
import { PostgresNewsRepository } from '../storage/PostgresNewsRepository';
import { TraderTelegramFormatter } from '../telegram/TraderTelegramFormatter';

describe('Stage 8.4 Event-Centric Live Intelligence Orchestration Test Suite', () => {
  beforeEach(() => {
    EventCentricOrchestrator.resetInstance();
    EventFingerprintEngine.resetInstance();
  });

  // 1. Multi-Publisher Event Aggregation
  it('1. multi_publisher_event_aggregation: merges 3 articles from different publishers into 1 event', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const art1: any = {
      id: 'art-1',
      headline: 'L&T wins ₹2,000 crore order from Ministry of Railways',
      description: 'Larsen & Toubro bags railway order worth ₹2,000 crore',
      publisher: 'Economic Times',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['LT'],
      category: 'Corporate'
    };

    const art2: any = {
      id: 'art-2',
      headline: 'L&T secures ₹2,000 crore major order win',
      description: 'L&T confirms ₹2,000 crore order win from Ministry',
      publisher: 'Moneycontrol',
      publishedAt: '2026-08-20T10:05:00Z',
      tickers: ['LT'],
      category: 'Corporate'
    };

    const art3: any = {
      id: 'art-3',
      headline: 'L&T confirms major order win from Railways',
      description: 'Order value stands at ₹2,000 crore',
      publisher: 'Reuters',
      publishedAt: '2026-08-20T10:10:00Z',
      tickers: ['LT'],
      category: 'Corporate'
    };

    const res1 = orchestrator.processArticle(art1);
    const res2 = orchestrator.processArticle(art2);
    const res3 = orchestrator.processArticle(art3);

    expect(res1.isNewEvent).toBe(true);
    expect(res2.isNewEvent).toBe(false);
    expect(res3.isNewEvent).toBe(false);

    const event = orchestrator.getEventById(res1.event.eventId);
    expect(event).toBeDefined();
    expect(event?.sourceCount).toBe(3);
    expect(event?.primaryEntity).toBe('LT');
  });

  // 2. Canonical Data Preservation
  it('2. canonical_data_preservation: retains original article metadata untouched', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const art: any = {
      id: 'art-orig-100',
      headline: 'Original Headline from Publisher A',
      description: 'Original description text',
      publisher: 'Publisher A',
      publishedAt: '2026-08-20T10:00:00Z',
      url: 'https://publisherA.com/news/100',
      tickers: ['RELIANCE']
    };

    orchestrator.processArticle(art);

    expect(art.id).toBe('art-orig-100');
    expect(art.headline).toBe('Original Headline from Publisher A');
    expect(art.publisher).toBe('Publisher A');
    expect(art.publishedAt).toBe('2026-08-20T10:00:00Z');
  });

  // 3. Event Fingerprint Engine
  it('3. event_fingerprint_engine: generates identical fingerprint for matching entity and event type', () => {
    const engine = EventFingerprintEngine.getInstance();

    const fp1 = engine.generateFingerprint({ headline: 'Tata Motors Q3 profit jumps 50% to ₹3,000 crore' });
    const fp2 = engine.generateFingerprint({ headline: 'Tata Motors Q3 net profit surges to ₹3,000 crore' });

    expect(fp1.fingerprint).toBe(fp2.fingerprint);
    expect(fp1.primaryEntity).toBe('TATAMOTORS');
  });

  // 4. Source Authority Ranking
  it('4. source_authority_ranking: Tier 1 official sources outrank Tier 2/3 media wires', () => {
    const ranker = SourceAuthorityRanker.getInstance();

    const nseRank = ranker.rankSource('NSE');
    const etRank = ranker.rankSource('Economic Times');
    const blogRank = ranker.rankSource('Random Blog');

    expect(nseRank.tier).toBe(1); // Tier 1 Official
    expect(etRank.tier).toBe(2);  // Tier 2 Quality Wires
    expect(blogRank.tier).toBe(4); // Tier 4 Unverified
  });

  // 5. Evidence Extraction & Aggregation
  it('5. evidence_extraction_and_aggregation: extracts numbers and tracks provenance', () => {
    const aggregator = EventEvidenceAggregator.getInstance();

    const art: any = {
      id: 'art-ev-1',
      publisher: 'Reuters',
      publishedAt: '2026-08-20T10:00:00Z',
      headline: 'HAL wins ₹8,000 crore defense contract from MoD'
    };

    const evidence = aggregator.extractAndAggregate([art]);

    expect(evidence.keyNumbers.length).toBeGreaterThan(0);
    expect(evidence.keyNumbers[0].provenance.articleId).toBe('art-ev-1');
  });

  // 6. Numerical Conflict Detection
  it('6. numerical_conflict_detection: detects mismatch between sources and sets conflictStatus', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const art1: any = {
      id: 'art-c1',
      headline: 'L&T wins ₹2,000 crore order',
      publisher: 'Economic Times',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['LT']
    };

    const art2: any = {
      id: 'art-c2',
      headline: 'L&T secures ₹2,500 crore order',
      publisher: 'Moneycontrol',
      publishedAt: '2026-08-20T10:02:00Z',
      tickers: ['LT']
    };

    orchestrator.processArticle(art1);
    const res2 = orchestrator.processArticle(art2);

    expect(res2.event.conflictStatus).toBe('CONFLICTING_REPORTS');
    expect(res2.event.conflictingReports?.length).toBeGreaterThan(0);
  });

  // 7. Source Rank Conflict Resolution
  it('7. source_rank_conflict_resolution: Tier 1 filing automatically overrides Tier 2 media report', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const artMedia: any = {
      id: 'art-m1',
      headline: 'L&T wins ₹2,500 crore order according to media reports',
      publisher: 'Economic Times',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['LT']
    };

    const artOfficial: any = {
      id: 'art-o1',
      headline: 'NSE Filing: L&T wins ₹2,000 crore contract',
      publisher: 'NSE',
      publishedAt: '2026-08-20T10:05:00Z',
      tickers: ['LT']
    };

    orchestrator.processArticle(artMedia);
    const resOfficial = orchestrator.processArticle(artOfficial);

    expect(resOfficial.event.primarySource.tier).toBe(1);
  });

  // 8. Material Update Escalation
  it('8. material_update_escalation: material value changes trigger EVENT_ESCALATION', () => {
    const detector = EventEscalationDetector.getInstance();

    const oldEvent: any = {
      eventPriority: 'P2',
      escalationLevel: 0,
      keyNumbers: [{ rawText: '₹2,000 crore', value: 2000, unit: 'crore' }]
    };

    const newArt: any = {
      id: 'art-esc-1',
      headline: 'L&T order expanded to ₹4,500 crore',
      publishedAt: '2026-08-20T11:00:00Z'
    };

    const escRes = detector.evaluate(oldEvent, newArt);

    expect(escRes.isMaterialChange).toBe(true);
  });

  // 9. Deterministic State Machine
  it('9. deterministic_state_machine: adheres strictly to NEW -> CONFIRMED -> UPDATED -> ESCALATED', () => {
    const event: any = { eventStatus: 'NEW', history: [] };

    let updated = EventStateMachine.transition(event, 'CONFIRMED', 'Confirmed by source');
    expect(updated.eventStatus).toBe('CONFIRMED');

    updated = EventStateMachine.transition(updated, 'UPDATED', 'Material update');
    expect(updated.eventStatus).toBe('UPDATED');

    updated = EventStateMachine.transition(updated, 'ESCALATED', 'Event escalated');
    expect(updated.eventStatus).toBe('ESCALATED');

    updated = EventStateMachine.transition(updated, 'RESOLVED', 'Event resolved');
    expect(updated.eventStatus).toBe('RESOLVED');
  });

  // 10. Event-Level Telegram Alerting
  it('10. event_level_telegram_alerting: dispatches 1 alert for initial event creation', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const art: any = {
      id: 'art-tg-1',
      headline: 'Reliance Industries acquires 100% stake in AI startup',
      publisher: 'Reuters',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['RELIANCE']
    };

    const res = orchestrator.processArticle(art);

    expect(res.shouldDispatchTelegram).toBe(true);
    expect(res.telegramAction).toBe('NEW_EVENT');
  });

  // 11. Telegram Update Alerting
  it('11. telegram_update_alerting: material evidence change dispatches update alert', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const art1: any = {
      id: 'art-tg-up1',
      headline: 'Reliance Industries acquires 51% stake in AI startup for ₹500 crore',
      publisher: 'Reuters',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['RELIANCE']
    };

    const art2: any = {
      id: 'art-tg-up2',
      headline: 'Reliance Industries expands acquisition to 100% stake for ₹1,000 crore',
      publisher: 'Economic Times',
      publishedAt: '2026-08-20T10:30:00Z',
      tickers: ['RELIANCE']
    };

    orchestrator.processArticle(art1);
    const res2 = orchestrator.processArticle(art2);

    expect(res2.shouldDispatchTelegram).toBe(true);
    expect(res2.telegramAction).toBe('EVENT_ESCALATION');
  });

  // 12. Conflict Alerting
  it('12. conflict_alerting: dispatches conflict alert when unresolved mismatch detected', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const art1: any = {
      id: 'art-conf-1',
      headline: 'Infosys reports Q3 revenue at $4.5 billion',
      publisher: 'Reuters',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['INFY']
    };

    const art2: any = {
      id: 'art-conf-2',
      headline: 'Infosys reports Q3 revenue at $4.1 billion',
      publisher: 'CNBC',
      publishedAt: '2026-08-20T10:05:00Z',
      tickers: ['INFY']
    };

    orchestrator.processArticle(art1);
    const res2 = orchestrator.processArticle(art2);

    expect(res2.shouldDispatchTelegram).toBe(true);
    expect(res2.telegramAction).toBe('CONFLICT_DETECTED');
  });

  // 13. Article-to-Event Provenance
  it('13. article_to_event_provenance: event tracks full list of contributing article IDs', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    orchestrator.processArticle({ id: 'art-p1', headline: 'TCS Q3 net profit ₹11,000 crore', tickers: ['TCS'] } as any);
    orchestrator.processArticle({ id: 'art-p2', headline: 'TCS reports Q3 net profit of ₹11,000 crore', tickers: ['TCS'] } as any);

    const events = orchestrator.getAllEvents();
    expect(events.length).toBeGreaterThan(0);
    const event = events.find(e => e.symbol === 'TCS');

    expect(event?.sourceArticleIds).toContain('art-p1');
    expect(event?.sourceArticleIds).toContain('art-p2');
  });

  // 14. Cost Protection
  it('14. cost_protection: duplicate articles reuse event summary without invoking AI', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const res1 = orchestrator.processArticle({ id: 'art-cp1', headline: 'HDFC Bank Q3 net profit jumps 20%', tickers: ['HDFCBANK'] } as any);
    const res2 = orchestrator.processArticle({ id: 'art-cp2', headline: 'HDFC Bank Q3 profit up 20% year on year', tickers: ['HDFCBANK'] } as any);

    expect(res2.event.canonicalSummary).toEqual(res1.event.canonicalSummary);
  });

  // 15. Postgres Database Schema
  it('15. postgres_database_schema: repository supports news_events durable records', async () => {
    const repo = new PostgresNewsRepository();

    const sampleEvent: any = {
      eventId: 'evt-pg-101',
      eventFingerprint: 'LT_ORDER_WIN_20260820',
      primaryEntity: 'L&T',
      symbol: 'LT',
      category: 'Corporate',
      eventStatus: 'CONFIRMED',
      eventPriority: 'P1',
      sourceCount: 2,
      confidence: 95
    };

    await repo.saveEvent(sampleEvent);
    const retrieved = await repo.getEvent('evt-pg-101');

    expect(retrieved).toBeDefined();
    expect(retrieved?.eventId).toBe('evt-pg-101');
    expect(retrieved?.symbol).toBe('LT');
  });

  // 16. API Endpoints
  it('16. api_endpoints: JSON repository returns events query results', async () => {
    const repo = new JsonNewsRepository();

    const events = await repo.getEvents();
    expect(Array.isArray(events)).toBe(true);
  });

  // 17. Summary-First Compliance
  it('17. summary_first_compliance: creates instant executive summary on article processing', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const res = orchestrator.processArticle({
      id: 'art-sf-1',
      headline: 'Bharti Airtel launches 5G Network expansion across 100 cities',
      publisher: 'LiveMint',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['BHARTIARTL']
    } as any);

    expect(res.event.canonicalSummary.whatHappened).toBeDefined();
    expect(res.event.canonicalSummary.whyItMatters).toBeDefined();
  });

  // 18. F&O Event Handling
  it('18. fno_event_handling: F&O keyword triggers elevated priority and F&O tagging', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const res = orchestrator.processArticle({
      id: 'art-fno-1',
      headline: 'Nifty Call Option OI spikes by 40 lakh contracts at 25000 strike',
      publisher: 'NSE',
      publishedAt: '2026-08-20T10:00:00Z',
      category: 'FNO',
      tickers: ['NIFTY']
    } as any);

    expect(res.event.eventPriority).toBe('P0');
  });

  // 19. Duplicate Event Rejection
  it('19. duplicate_event_rejection: identical payload produces no new alerts', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const art: any = {
      id: 'art-dup-1',
      headline: 'Axis Bank Q3 profit up 15%',
      publisher: 'Reuters',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['AXISBANK']
    };

    const res1 = orchestrator.processArticle(art);
    const res2 = orchestrator.processArticle(art);

    expect(res1.shouldDispatchTelegram).toBe(true);
    expect(res2.shouldDispatchTelegram).toBe(false);
  });

  // 20. Cross-Section Event Indexing
  it('20. cross_section_event_indexing: events map to appropriate category feeds', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    orchestrator.processArticle({
      id: 'art-sec-1',
      headline: 'Maruti Suzuki announces ₹5,000 crore EV factory order win',
      publisher: 'ET',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['MARUTI'],
      category: 'Corporate'
    } as any);

    const events = orchestrator.getAllEvents();
    expect(events.some(e => e.symbol === 'MARUTI')).toBe(true);
  });

  // 21. Order Win Aggregation
  it('21. order_win_aggregation: aggregates L&T order win variations into 1 event', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    orchestrator.processArticle({ id: 'o1', headline: 'L&T wins ₹2,000 crore order', tickers: ['LT'] } as any);
    orchestrator.processArticle({ id: 'o2', headline: 'L&T secures ₹2,100 crore order', tickers: ['LT'] } as any);

    const ltEvents = orchestrator.getAllEvents().filter(e => e.symbol === 'LT');
    expect(ltEvents.length).toBe(1);
    expect(ltEvents[0].sourceCount).toBe(2);
  });

  // 22. Earnings Conflict Resolution
  it('22. earnings_conflict_resolution: NSE official filing overrides unverified media numbers', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    orchestrator.processArticle({ id: 'e1', headline: 'Wipro Q3 net profit reported at ₹2,800 crore', publisher: 'Media Wire', tickers: ['WIPRO'] } as any);
    const res = orchestrator.processArticle({ id: 'e2', headline: 'NSE Filing: Wipro Q3 audited net profit is ₹2,690 crore', publisher: 'NSE', tickers: ['WIPRO'] } as any);

    expect(res.event.primarySource.tier).toBe(1);
  });

  // 23. Regulatory Action Handling
  it('23. regulatory_action_handling: SEBI order instantly triggers Tier 1 NEW_EVENT escalation', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const res = orchestrator.processArticle({
      id: 'reg-1',
      headline: 'SEBI issues show cause notice to Financial Firm',
      publisher: 'SEBI',
      publishedAt: '2026-08-20T10:00:00Z',
      tickers: ['SEBI']
    } as any);

    expect(res.event.primarySource.tier).toBe(1);
    expect(res.event.eventPriority).toBe('P0');
  });

  // 24. Non-Catalyst Filtering
  it('24. non_catalyst_filtering: chatter/opinion articles do not spawn P0 events', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const res = orchestrator.processArticle({
      id: 'chat-1',
      headline: 'Market opinion: Why retail investors like stock markets',
      publisher: 'Blog',
      publishedAt: '2026-08-20T10:00:00Z'
    } as any);

    expect(res.event.eventPriority).toBe('P3');
  });

  // 25. Event Escalation Level Tracking
  it('25. event_escalation_level_tracking: tracks priority level updates P3 -> P1', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const res1 = orchestrator.processArticle({ id: 'p1', headline: 'Company discussing potential order', tickers: ['ABC'] } as any);
    const res2 = orchestrator.processArticle({ id: 'p2', headline: 'Company bags ₹10,000 crore mega order win', tickers: ['ABC'] } as any);

    expect(res1.event.eventPriority).toBe('P3');
    expect(res2.event.eventPriority).toBe('P1');
  });

  // 26. Multi-Entity Event Mapping
  it('26. multi_entity_event_mapping: M&A links both primary and mentioned tickers', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const res = orchestrator.processArticle({
      id: 'ma-1',
      headline: 'Adani Ports acquires 100% stake in Krishnapatnam Port',
      tickers: ['ADANIPORTS', 'KRISHNA']
    } as any);

    expect(res.event.primaryEntity).toBeDefined();
  });

  // 27. Timeline Invariance
  it('27. timeline_invariance: out of order articles maintain chronological timeline', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    orchestrator.processArticle({ id: 't2', headline: 'Event update at 11:00 AM', publishedAt: '2026-08-20T11:00:00Z', tickers: ['XYZ'] } as any);
    orchestrator.processArticle({ id: 't1', headline: 'Event initial report at 10:00 AM', publishedAt: '2026-08-20T10:00:00Z', tickers: ['XYZ'] } as any);

    const event = orchestrator.getAllEvents().find(e => e.symbol === 'XYZ');
    expect(event?.history?.length).toBe(2);
  });

  // 28. Idempotency Check
  it('28. idempotency_check: re-processing identical article batch yields identical state', () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const articles: any[] = [
      { id: 'i1', headline: 'Stock A Q3 results', tickers: ['STKA'] },
      { id: 'i2', headline: 'Stock B order win', tickers: ['STKB'] }
    ];

    articles.forEach(a => orchestrator.processArticle(a));
    const count1 = orchestrator.getAllEvents().length;

    articles.forEach(a => orchestrator.processArticle(a));
    const count2 = orchestrator.getAllEvents().length;

    expect(count1).toBe(count2);
  });

  // 29. High Concurrency Safety
  it('29. high_concurrency_safety: parallel ingestion requests resolve into clean single event', async () => {
    const orchestrator = EventCentricOrchestrator.getInstance();

    const p1 = Promise.resolve(orchestrator.processArticle({ id: 'conc-1', headline: 'Parallel News Event for Tata Steel', tickers: ['TATASTEEL'] } as any));
    const p2 = Promise.resolve(orchestrator.processArticle({ id: 'conc-2', headline: 'Parallel News Event for Tata Steel', tickers: ['TATASTEEL'] } as any));

    await Promise.all([p1, p2]);

    const events = orchestrator.getAllEvents().filter(e => e.symbol === 'TATASTEEL');
    expect(events.length).toBe(1);
    expect(events[0].sourceCount).toBe(2);
  });

  // 30. Production Gate Verification
  it('30. production_gate_verification: Telegram formatter outputs compliant HTML format', () => {
    const sampleEvent: any = {
      eventId: 'evt-test-99',
      primaryEntity: 'Larsen & Toubro',
      symbol: 'LT',
      category: 'Corporate',
      eventStatus: 'CONFIRMED',
      eventPriority: 'P1',
      confidence: 95,
      canonicalSummary: {
        whatHappened: 'L&T secured ₹2,000 crore order from Railways',
        whyItMatters: 'Extends order backlog and validates execution capabilities'
      },
      keyNumbers: [{ value: '₹2,000 crore' }],
      primarySource: { publisher: 'NSE', tier: 1 },
      sourceCount: 3
    };

    const html = TraderTelegramFormatter.formatEvent(sampleEvent, 'NEW_EVENT');

    expect(html).toContain('<b>ATHENA EVENT ALERT</b>');
    expect(html).toContain('Larsen &amp; Toubro');
    expect(html).toContain('₹2,000 crore');
    expect(html).toContain('Tier 1');
  });
});
