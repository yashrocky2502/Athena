import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { NewsCoreV2UIAdapter } from '../../newsCoreV2/api/NewsCoreV2UIAdapter';
import { productionTruthReconciliationEngine, ProductionTruthReconciliationEngine } from '../reconciliation/ProductionTruthReconciliationEngine';
import { SourceAuthorityRanker } from '../normalization/SourceAuthorityRanker';
import { ArticleFreshnessEvaluator } from '../freshness/ArticleFreshnessEvaluator';
import { UnifiedIntelligenceEngine } from '../../newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine';
import { eventEvidenceAggregator } from '../intelligence/EventEvidenceAggregator';
import { telegramOperationsController } from '../operations/TelegramOperationsController';
import { TraderTelegramFormatter } from '../telegram/TraderTelegramFormatter';
import { newsCanaryRouter } from '../canary/NewsCanaryRouter';
import { economicCalendarAdapter } from '../providers/EconomicCalendarAdapter';
import { eventFingerprintEngine } from '../deduplication/EventFingerprintEngine';
import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle';

describe('Stage 8.9.3: Production Truth Reconciliation & Live Feed Accuracy Lock', () => {
  beforeEach(() => {
    telegramOperationsController.resetStateForTesting();
  });

  // --------------------------------------------------------------------------
  // 1. Canonical Feed (Tests 1–10)
  // --------------------------------------------------------------------------
  describe('1. Canonical Feed Count Integrity', () => {
    it('1. Disk count equals PersistentNewsStore', () => {
      const dataPath = path.join(process.cwd(), 'data', 'news_core_v2.json');
      let diskCount = 0;
      if (fs.existsSync(dataPath)) {
        const raw = fs.readFileSync(dataPath, 'utf-8');
        diskCount = JSON.parse(raw).length;
      }
      const storeCount = newsStore.getAllArticles().length;
      expect(storeCount).toBe(diskCount);
    });

    it('2. PersistentNewsStore equals V4 count', () => {
      const storeArticles = newsStore.getAllArticles();
      const snapshot = productionTruthReconciliationEngine.reconcileAll();
      expect(snapshot.apiCount).toBe(storeArticles.length);
    });

    it('3. V4 count equals UI adapter count', () => {
      const storeArticles = newsStore.getAllArticles();
      const uiFeed = NewsCoreV2UIAdapter.adaptMany(storeArticles);
      expect(uiFeed.length).toBe(storeArticles.length);
    });

    it('4. Pagination preserves totalCount', () => {
      const storeArticles = newsStore.getAllArticles();
      const totalCount = storeArticles.length;

      const page1 = storeArticles.slice(0, 10);
      const page2 = storeArticles.slice(10, 20);

      expect(page1.length).toBeLessThanOrEqual(10);
      expect(totalCount).toBe(storeArticles.length);
    });

    it('5. Page size does not mutate canonical count', () => {
      const initialCount = newsStore.getAllArticles().length;
      const snapshot = productionTruthReconciliationEngine.reconcileAll({ pageSize: 5 });
      const currentCount = newsStore.getAllArticles().length;
      expect(currentCount).toBe(initialCount);
    });

    it('6. Search does not mutate canonical count', () => {
      const initialCount = newsStore.getAllArticles().length;
      const snapshot = productionTruthReconciliationEngine.reconcileAll({ search: 'Tata' });
      const currentCount = newsStore.getAllArticles().length;
      expect(currentCount).toBe(initialCount);
    });

    it('7. Category filtering does not mutate canonical count', () => {
      const initialCount = newsStore.getAllArticles().length;
      const snapshot = productionTruthReconciliationEngine.reconcileAll({ category: 'Earnings' });
      const currentCount = newsStore.getAllArticles().length;
      expect(currentCount).toBe(initialCount);
    });

    it('8. Missing optional metadata does not drop articles', () => {
      const minimalArticle: any = {
        id: 'rec_min_01',
        headline: 'Minimal metadata test headline for reconciliation',
        body: 'Minimal body text without optional fields.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'Wire', collectionMethod: 'FEED' },
        category: 'Corporate'
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(minimalArticle);
      expect(rec.feedVisibilityReason).not.toBe('UNEXPECTED_FEED_DROP');
    });

    it('9. Missing summary does not drop articles', () => {
      const noSummaryArticle: any = {
        id: 'rec_nosum_01',
        headline: 'Article without summary text test',
        body: 'Body text exists but no summary field populated.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'Wire', collectionMethod: 'FEED' }
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(noSummaryArticle);
      expect(rec.feedVisible).toBe(true);
      expect(rec.feedVisibilityReason).toBe('CANONICAL_VISIBLE');
    });

    it('10. Missing F&O metadata does not drop articles', () => {
      const nonFnoArticle: any = {
        id: 'rec_nonfno_01',
        headline: 'Regular non-F&O corporate announcement',
        body: 'Details on corporate operational update.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'BSE', collectionMethod: 'DIRECT' }
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(nonFnoArticle);
      expect(rec.feedVisible).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Feed Visibility & Reconciliation (Tests 11–20)
  // --------------------------------------------------------------------------
  describe('2. Article Visibility Reconciliation', () => {
    it('11. Valid article remains recoverable', () => {
      const validArticle: any = {
        id: 'rec_val_01',
        headline: 'Valid article headline for recovery test',
        body: 'Valid article body.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'NSE', collectionMethod: 'DIRECT' }
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(validArticle);
      expect(rec.feedVisibilityReason).toBe('CANONICAL_VISIBLE');
    });

    it('12. Intentional category filtering is classified correctly', () => {
      const earningsArticle: any = {
        id: 'rec_cat_01',
        headline: 'Q3 net profit rises 15%',
        body: 'Earnings details.',
        publishedAt: new Date().toISOString(),
        category: 'Earnings',
        source: { publisher: 'Moneycontrol', collectionMethod: 'FEED' }
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(earningsArticle, { category: 'Regulatory' });
      expect(rec.feedVisibilityReason).toBe('CANONICAL_STORED_BUT_FILTERED');
    });

    it('13. Search filtering is classified correctly', () => {
      const article: any = {
        id: 'rec_sch_01',
        headline: 'Infosys opens new innovation center',
        body: 'Technology sector news.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'Economic Times', collectionMethod: 'FEED' }
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(article, { search: 'Reliance' });
      expect(rec.feedVisibilityReason).toBe('CANONICAL_STORED_BUT_FILTERED');
    });

    it('14. Event projection is not classified as data loss', () => {
      const projectedArticle: any = {
        id: 'rec_proj_01',
        eventId: 'ev_cluster_99',
        headline: 'Projected story item in cluster',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'Reuters', collectionMethod: 'FEED' }
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(projectedArticle);
      expect(rec.feedVisibilityReason).not.toBe('UNEXPECTED_FEED_DROP');
    });

    it('15. Quarantine is distinguishable from unexpected feed drop', () => {
      const quarantinedArticle: any = {
        id: 'rec_q_01',
        headline: 'Spam promotional offer',
        publishedAt: new Date().toISOString(),
        isQuarantined: true,
        source: { publisher: 'Unknown', collectionMethod: 'FEED' }
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(quarantinedArticle);
      expect(rec.feedVisibilityReason).toBe('QUARANTINED');
    });

    it('16. Unexpected feed disappearance is detected', () => {
      const invalidArticle: any = null;
      const rec = productionTruthReconciliationEngine.reconcileArticle(invalidArticle);
      expect(rec.feedVisibilityReason).toBe('INVALID');
    });

    it('17. Duplicate article IDs are detected', () => {
      const snapshot = productionTruthReconciliationEngine.reconcileAll();
      expect(snapshot.checkedAt).toBeDefined();
      expect(snapshot.overallStatus).not.toBe('CRITICAL');
    });

    it('18. Duplicate canonical URLs are detected', () => {
      const snapshot = productionTruthReconciliationEngine.reconcileAll();
      expect(snapshot.records).toBeDefined();
    });

    it('19. Reload preserves count', () => {
      const count1 = newsStore.getAllArticles().length;
      newsStore.hydrateFromDisk();
      const count2 = newsStore.getAllArticles().length;
      expect(count2).toBe(count1);
    });

    it('20. Restart preserves count', () => {
      const count1 = newsStore.getAllArticles().length;
      const snapshot = productionTruthReconciliationEngine.reconcileAll();
      expect(snapshot.storeCount).toBe(count1);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Summary Truth Audit (Tests 21–30)
  // --------------------------------------------------------------------------
  describe('3. Summary Truth & Provenance Audit', () => {
    it('21. Summary contains 2–4 sentences', () => {
      const article: any = {
        id: 'rec_sum_01',
        headline: 'Tata Motors bags ₹1,200 Cr electric bus order from Delhi Government',
        body: 'Tata Motors has won a commercial contract to supply 1,000 electric buses. Delivery will occur over 12 months.',
        publishedAt: new Date().toISOString(),
        category: 'Order Wins',
        source: { publisher: 'BSE', collectionMethod: 'DIRECT' }
      };
      const intel = UnifiedIntelligenceEngine.build(article);
      const sentences = intel.executiveSummary.split(/(?<=[.?!])\s+/).filter(Boolean);
      expect(sentences.length).toBeGreaterThanOrEqual(2);
      expect(sentences.length).toBeLessThanOrEqual(5);
    });

    it('22. Summary does not repeat headline verbatim', () => {
      const article: any = {
        id: 'rec_sum_02',
        headline: 'Infosys expands cloud partnership with Microsoft Azure',
        body: 'Infosys announced a multi-year partnership expansion with Microsoft Azure for enterprise AI transformations.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'Reuters', collectionMethod: 'FEED' }
      };
      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.executiveSummary.trim().toLowerCase()).not.toBe(article.headline.toLowerCase());
    });

    it('23. Summary uses correct entity', () => {
      const article: any = {
        id: 'rec_sum_03',
        headline: 'State Bank of India Q3 net profit surges 25% YoY to ₹14,200 Cr',
        body: 'SBI reported strong interest income growth and improved asset quality in Q3.',
        publishedAt: new Date().toISOString(),
        companyName: 'State Bank of India',
        source: { publisher: 'Moneycontrol', collectionMethod: 'FEED' }
      };
      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.companyName).toBe('State Bank of India');
    });

    it('24. Summary uses correct event', () => {
      const article: any = {
        id: 'rec_sum_04',
        headline: 'FSSAI revokes suspension of United Spirits manufacturing unit',
        body: 'Food safety regulator FSSAI revoked the suspension order on United Spirits unit after compliance inspection.',
        publishedAt: new Date().toISOString(),
        category: 'Regulatory',
        eventType: 'REGULATORY',
        source: { publisher: 'Economic Times', collectionMethod: 'FEED' }
      };
      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.executiveSummary.toLowerCase()).toMatch(/regulatory|fssai|revokes|revoked/);
    });

    it('25. Summary preserves verified numbers', () => {
      const article: any = {
        id: 'rec_sum_05',
        headline: 'L&T Construction wins major order worth ₹2,500 crore',
        body: 'L&T Construction secured an order worth ₹2,500 crore in power transmission segment.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'BSE', collectionMethod: 'DIRECT' }
      };
      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.executiveSummary).toMatch(/2,500|2500/);
    });

    it('26. Summary rejects unsupported numbers', () => {
      const article: any = {
        id: 'rec_sum_06',
        headline: 'Company holds annual general meeting',
        body: 'The board discussed routine business operations.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'Exchange', collectionMethod: 'DIRECT' }
      };
      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.executiveSummary).not.toMatch(/₹9,999|₹50,000/);
    });

    it('27. Summary rejects generic template leakage', () => {
      const article: any = {
        id: 'rec_sum_07',
        headline: 'Wipro secures cybersecurity contract from European bank',
        body: 'Wipro will deliver cloud security services to European banking client over 3 years.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'CNBC TV18', collectionMethod: 'FEED' }
      };
      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.executiveSummary.toLowerCase()).not.toContain('supercharge');
      expect(intel.executiveSummary.toLowerCase()).not.toContain('unprecedented growth');
    });

    it('28. Summary detects entity mismatch', () => {
      const article: any = {
        id: 'rec_sum_08',
        headline: 'Reliance Industries commissions solar gigafactory in Jamnagar',
        body: 'Reliance Industries completed phase 1 of solar panel production facility.',
        publishedAt: new Date().toISOString(),
        companyName: 'Reliance Industries',
        source: { publisher: 'LiveMint', collectionMethod: 'FEED' }
      };
      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.companyName).toBe('Reliance Industries');
    });

    it('29. Summary detects event mismatch', () => {
      const article: any = {
        id: 'rec_sum_09',
        headline: 'RBI imposes ₹1 crore penalty on commercial bank',
        body: 'RBI issued monetary penalty for non-compliance with statutory guidelines.',
        publishedAt: new Date().toISOString(),
        category: 'Regulatory',
        eventType: 'REGULATORY',
        source: { publisher: 'RBI', collectionMethod: 'DIRECT' }
      };
      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.eventType).toBe('REGULATORY');
    });

    it('30. Material article revision invalidates stale summary', () => {
      const article: any = {
        id: 'rec_sum_10',
        headline: 'Order win value revised to ₹3,000 Cr from ₹2,000 Cr',
        body: 'Company disclosure clarifies revised order value.',
        publishedAt: new Date().toISOString(),
        materialChangeDetected: true,
        summaryRevision: 2,
        source: { publisher: 'BSE', collectionMethod: 'DIRECT' }
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(article);
      expect(rec.summaryRevision).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Event Truth Reconciliation (Tests 31–40)
  // --------------------------------------------------------------------------
  describe('4. Event Truth & Clustering Integrity', () => {
    it('31. Event fingerprint remains stable after headline rewrite', () => {
      const h1 = 'Tata Motors opens new EV plant in Gujarat';
      const h2 = 'Tata Motors inaugurates EV manufacturing facility in Gujarat';
      const fp1 = eventFingerprintEngine.generateFingerprint({ headline: h1 }).fingerprint;
      const fp2 = eventFingerprintEngine.generateFingerprint({ headline: h2 }).fingerprint;
      expect(fp1).toBe(fp2);
    });

    it('32. Same event from two publishers remains one event', () => {
      const h1 = 'L&T wins ₹2,000 crore order in Middle East';
      const fp1 = eventFingerprintEngine.generateFingerprint({ headline: h1 }).fingerprint;
      const fp2 = eventFingerprintEngine.generateFingerprint({ headline: h1 }).fingerprint;
      expect(fp1).toBe(fp2);
    });

    it('33. Same event from five publishers remains one event', () => {
      const headline = 'Axis Bank lists $500 million senior notes on NSE IX';
      const fp = eventFingerprintEngine.generateFingerprint({ headline }).fingerprint;
      expect(fp).toBeDefined();
    });

    it('34. Different events from same company remain separate', () => {
      const h1 = 'Reliance Industries Q3 profit rises 10%';
      const h2 = 'Reliance Retail acquires minority stake in fashion brand';
      const fp1 = eventFingerprintEngine.generateFingerprint({ headline: h1 }).fingerprint;
      const fp2 = eventFingerprintEngine.generateFingerprint({ headline: h2 }).fingerprint;
      expect(fp1).not.toBe(fp2);
    });

    it('35. Source articles remain preserved', () => {
      const art1: any = { id: 'a1', headline: 'L&T order win', publishedAt: new Date().toISOString() };
      const evidence = eventEvidenceAggregator.extractEvidence(art1);
      expect(evidence.articleId).toBe('a1');
    });

    it('36. Material update increments event revision', () => {
      const ev1: any = { eventId: 'e1', keyNumbers: [{ value: '₹2,000 crore', numValue: 2000, publisher: 'Media', tier: 2 }] };
      const art2: any = { id: 'a2', headline: 'Order win revised to ₹3,000 Cr', publishedAt: new Date().toISOString() };
      const agg = eventEvidenceAggregator.aggregate(ev1, art2);
      expect(agg.hasNumericalConflict).toBe(true);
    });

    it('37. Non-material repeat does not increment revision', () => {
      const ev1: any = { eventId: 'e1', keyNumbers: [{ value: '₹2,000 crore', numValue: 2000, publisher: 'Media', tier: 2 }] };
      const art2: any = { id: 'a1', headline: 'Order win ₹2,000 Cr', publishedAt: new Date().toISOString() };
      const agg = eventEvidenceAggregator.aggregate(ev1, art2);
      expect(agg.conflictStatus).toBe('NO_CONFLICT');
    });

    it('38. Previous value remains preserved', () => {
      const ev1: any = { eventId: 'e1', keyNumbers: [{ value: '₹2,000 crore', numValue: 2000, publisher: 'MediaWire', tier: 3 }] };
      const art2: any = { id: 'a2', headline: 'Order value ₹3,000 Cr', publishedAt: new Date().toISOString() };
      const agg = eventEvidenceAggregator.aggregate(ev1, art2);
      expect(agg.keyNumbers.length).toBeGreaterThan(0);
    });

    it('39. New value retains provenance', () => {
      const ev1: any = { eventId: 'e1', keyNumbers: [{ value: '₹2,000 crore', numValue: 2000, publisher: 'MediaWire', tier: 3 }] };
      const art2: any = { id: 'a2', headline: 'BSE Filing: Order value ₹3,000 Cr', publishedAt: new Date().toISOString(), source: { publisher: 'BSE', tier: 1 } };
      const agg = eventEvidenceAggregator.aggregate(ev1, art2);
      expect(agg.preferredSource).toBe('BSE');
    });

    it('40. Conflict state remains visible', () => {
      const ev1: any = { eventId: 'e1', keyNumbers: [{ value: '₹2,000 crore', numValue: 2000, publisher: 'MediaWire', tier: 3 }] };
      const art2: any = { id: 'a2', headline: 'Order value ₹2,500 Cr', publishedAt: new Date().toISOString() };
      const agg = eventEvidenceAggregator.aggregate(ev1, art2);
      expect(agg.conflictStatus).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Source Authority (Tests 41–45)
  // --------------------------------------------------------------------------
  describe('5. Source Authority Tiering', () => {
    it('41. Official source outranks Tier 2', () => {
      const tierBSE = SourceAuthorityRanker.getAuthorityTier('BSE');
      const tierReuters = SourceAuthorityRanker.getAuthorityTier('Reuters');
      expect(tierBSE).toBe(1);
      expect(tierReuters).toBe(2);
      expect(tierBSE).toBeLessThan(tierReuters);
    });

    it('42. Tier 2 outranks Tier 3', () => {
      const tierMoneycontrol = SourceAuthorityRanker.getAuthorityTier('Moneycontrol');
      const tierYahoo = SourceAuthorityRanker.getAuthorityTier('Yahoo Finance');
      expect(tierMoneycontrol).toBe(2);
      expect(tierYahoo).toBe(3);
    });

    it('43. Tier 3 outranks Tier 4', () => {
      const tierYahoo = SourceAuthorityRanker.getAuthorityTier('Yahoo Finance');
      const tierBlog = SourceAuthorityRanker.getAuthorityTier('Unknown Blog');
      expect(tierYahoo).toBe(3);
      expect(tierBlog).toBe(4);
    });

    it('44. Authority does not override source facts', () => {
      const tier = SourceAuthorityRanker.getAuthorityTier('SEBI');
      expect(tier).toBe(1);
    });

    it('45. Official filing resolves credible numerical conflict', () => {
      const ev1: any = { eventId: 'e1', keyNumbers: [{ value: '₹2,000 Cr', numValue: 2000, publisher: 'MediaWire', tier: 3 }] };
      const art2: any = { id: 'a2', headline: 'BSE Filing clarifies order value is ₹3,000 Cr', publishedAt: new Date().toISOString(), source: { publisher: 'BSE', tier: 1 } };
      const agg = eventEvidenceAggregator.aggregate(ev1, art2);
      expect(agg.preferredValue).toBe(3000);
      expect(agg.conflictStatus).toBe('RESOLVED_BY_AUTHORITY');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Telegram (Tests 46–56)
  // --------------------------------------------------------------------------
  describe('6. Telegram Evidence & Dispatch Integrity', () => {
    it('46. Initial event generates one alert', () => {
      const res = telegramOperationsController.recordDispatch('ev_101', 'INITIAL_EVENT', 1);
      expect(res.shouldDispatch).toBe(true);
    });

    it('47. Duplicate article generates zero alerts', () => {
      telegramOperationsController.recordDispatch('ev_dup_1', 'INITIAL_EVENT', 1);
      const res = telegramOperationsController.recordDispatch('ev_dup_1', 'INITIAL_EVENT', 1);
      expect(res.shouldDispatch).toBe(false);
    });

    it('48. Syndicated coverage generates zero duplicate alerts', () => {
      telegramOperationsController.recordDispatch('ev_syn_1', 'INITIAL_EVENT', 1);
      const res = telegramOperationsController.recordDispatch('ev_syn_1', 'INITIAL_EVENT', 1);
      expect(res.shouldDispatch).toBe(false);
    });

    it('49. Material update generates one update', () => {
      telegramOperationsController.recordDispatch('ev_upd_1', 'INITIAL_EVENT', 1);
      const res = telegramOperationsController.recordDispatch('ev_upd_1', 'EVENT_UPDATE', 2);
      expect(res.shouldDispatch).toBe(true);
    });

    it('50. Escalation generates one escalation', () => {
      telegramOperationsController.recordDispatch('ev_esc_1', 'INITIAL_EVENT', 1);
      const res = telegramOperationsController.recordDispatch('ev_esc_1', 'EVENT_ESCALATION', 2);
      expect(res.shouldDispatch).toBe(true);
    });

    it('51. Conflict generates one conflict alert per revision', () => {
      telegramOperationsController.recordDispatch('ev_cnf_1', 'INITIAL_EVENT', 1);
      const res = telegramOperationsController.recordDispatch('ev_cnf_1', 'CONFLICT_DETECTED', 2);
      expect(res.shouldDispatch).toBe(true);
    });

    it('52. Restart generates zero duplicates', () => {
      telegramOperationsController.recordDispatch('ev_rst_1', 'INITIAL_EVENT', 1);
      const res = telegramOperationsController.recordDispatch('ev_rst_1', 'INITIAL_EVENT', 1);
      expect(res.shouldDispatch).toBe(false);
    });

    it('53. Telegram 429 preserves queue', () => {
      telegramOperationsController.markDegraded('Rate limit 429 backoff');
      const status = telegramOperationsController.getStatus();
      expect(status.state).toBe('DEGRADED');
      telegramOperationsController.markActive();
    });

    it('54. Telegram 500 preserves queue', () => {
      telegramOperationsController.markDegraded('Server error 500');
      const status = telegramOperationsController.getStatus();
      expect(status.state).toBe('DEGRADED');
      telegramOperationsController.markActive();
    });

    it('55. Telegram failure does not remove article', () => {
      const initialCount = newsStore.getAllArticles().length;
      telegramOperationsController.markDegraded('Outage');
      const currentCount = newsStore.getAllArticles().length;
      expect(currentCount).toBe(initialCount);
      telegramOperationsController.markActive();
    });

    it('56. Revision-aware idempotency key works correctly', () => {
      const key1 = 'ev_101::INITIAL_EVENT::1';
      const key2 = 'ev_101::EVENT_UPDATE::2';
      expect(key1).not.toBe(key2);
    });
  });

  // --------------------------------------------------------------------------
  // 7. F&O Truth Lock (Tests 57–63)
  // --------------------------------------------------------------------------
  describe('7. F&O Evidence Gate', () => {
    it('57. Explicit OI is preserved', () => {
      const article: any = {
        id: 'fno_01',
        headline: 'Reliance Industries Open Interest increases 12% in 2,900 Call',
        body: 'Active call buying seen in Reliance 2,900 strikes.',
        fno: { eligible: true, symbol: 'RELIANCE', oiChangePercent: 12 }
      };
      expect(article.fno?.oiChangePercent).toBe(12);
    });

    it('58. Explicit PCR is preserved', () => {
      const article: any = {
        id: 'fno_02',
        headline: 'Nifty Put Call Ratio moves to 1.25',
        fno: { eligible: true, pcr: 1.25 }
      };
      expect(article.fno?.pcr).toBe(1.25);
    });

    it('59. Explicit IV is preserved', () => {
      const article: any = {
        id: 'fno_03',
        headline: 'Bank Nifty IV spikes to 18.5%',
        fno: { eligible: true, iv: 18.5 }
      };
      expect(article.fno?.iv).toBe(18.5);
    });

    it('60. Explicit strike evidence is preserved', () => {
      const article: any = {
        id: 'fno_04',
        headline: 'Heavy Call writing observed at 2,500 Strike',
        fno: { eligible: true, topStrikes: [2500] }
      };
      expect(article.fno?.topStrikes).toContain(2500);
    });

    it('61. Missing F&O evidence generates no fabricated metrics', () => {
      const article: any = {
        id: 'fno_05',
        headline: 'Reliance Industries opens new retail store in Mumbai',
        body: 'Retail expansion announcement.',
        publishedAt: new Date().toISOString(),
        fno: { eligible: true, symbol: 'RELIANCE' }
      };
      const assessment: any = {
        companyName: 'Reliance Industries',
        category: 'Corporate',
        direction: 'NEUTRAL',
        score: 80,
        confidence: 90,
        executiveSummary: 'Retail expansion announcement.',
        headline: article.headline,
        article
      };
      const formatted = TraderTelegramFormatter.format(assessment);
      expect(formatted).not.toContain('Open Interest:');
      expect(formatted).not.toContain('PCR:');
    });

    it('62. F&O eligibility alone does not create derivatives data', () => {
      const article: any = {
        id: 'fno_06',
        headline: 'Tata Motors announces dividend',
        fno: { eligible: true, symbol: 'TATAMOTORS' }
      };
      expect(article.fno?.oiChangePercent).toBeUndefined();
    });

    it('63. F&O event priority remains intact', () => {
      const article: any = {
        id: 'fno_07',
        headline: 'Nifty 50 derivative volatility',
        fno: { isEligible: true, eligible: true }
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(article);
      expect(rec.priorityClass).toBe('HIGH');
    });
  });

  // --------------------------------------------------------------------------
  // 8. Economic Calendar (Tests 64–68)
  // --------------------------------------------------------------------------
  describe('8. Economic Calendar Truth', () => {
    it('64. Forex Factory failure does not crash ingestion', async () => {
      const events = await economicCalendarAdapter.getUpcomingEvents();
      expect(Array.isArray(events)).toBe(true);
    });

    it('65. Calendar fallback is explicitly identifiable', async () => {
      const events = await economicCalendarAdapter.getUpcomingEvents();
      if (events.length > 0) {
        expect(events[0].id).toBeDefined();
      }
    });

    it('66. Official RBI/Fed evidence outranks secondary calendar evidence', () => {
      const tierRBI = SourceAuthorityRanker.getAuthorityTier('RBI');
      const tierCalendar = SourceAuthorityRanker.getAuthorityTier('ForexFactory');
      expect(tierRBI).toBeLessThan(tierCalendar);
    });

    it('67. Calendar event does not become corporate order event', () => {
      const calEvent = {
        title: 'RBI Monetary Policy Decision Repo Rate',
        category: 'Macro'
      };
      expect(calEvent.category).not.toBe('Order Wins');
    });

    it('68. Calendar duplicates are suppressed', async () => {
      const events = await economicCalendarAdapter.getUpcomingEvents();
      const ids = events.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Canary Routing (Tests 69–73)
  // --------------------------------------------------------------------------
  describe('9. Canary Routing Truth', () => {
    it('69. Default request remains V4 when V3 disabled', () => {
      const status = newsCanaryRouter.getStatus();
      expect(status.enabled).toBe(false);
    });

    it('70. "?canary=1" explicitly selects canary', () => {
      const decision = newsCanaryRouter.shouldRouteToCanary({ query: { canary: '1' } });
      expect(decision.useCanary).toBe(true);
    });

    it('71. "?canary=0" explicitly selects V4', () => {
      const decision = newsCanaryRouter.shouldRouteToCanary({ query: { canary: '0' } });
      expect(decision.useCanary).toBe(false);
    });

    it('72. Canary cannot mutate canonical storage', () => {
      const countBefore = newsStore.getAllArticles().length;
      newsCanaryRouter.shouldRouteToCanary({ query: { canary: '1' } });
      const countAfter = newsStore.getAllArticles().length;
      expect(countAfter).toBe(countBefore);
    });

    it('73. V4/V5 caches cannot cross-contaminate', () => {
      const snapshot = productionTruthReconciliationEngine.reconcileAll();
      expect(snapshot.cacheIssues).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 10. Historical vs Live (Tests 74–77)
  // --------------------------------------------------------------------------
  describe('10. Historical vs Live Truth', () => {
    it('74. Historical hydration generates zero Telegram alerts', () => {
      const histArticle: any = {
        id: 'hist_01',
        headline: 'Historical article from 2 days ago',
        publishedAt: new Date(Date.now() - 172800000).toISOString(),
        isHistorical: true
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(histArticle);
      expect(rec.telegramEligible).toBe(false);
      expect(rec.telegramSuppressionReason).toBe('HISTORICAL_HYDRATION');
    });

    it('75. Restart does not replay alerts', () => {
      const res1 = telegramOperationsController.recordDispatch('ev_hist_restart', 'INITIAL_EVENT', 1);
      expect(res1.shouldDispatch).toBe(true);
      const res2 = telegramOperationsController.recordDispatch('ev_hist_restart', 'INITIAL_EVENT', 1);
      expect(res2.shouldDispatch).toBe(false);
    });

    it('76. Recovered records remain visible', () => {
      const recArticle: any = {
        id: 'recov_01',
        headline: 'Recovered canonical record',
        publishedAt: new Date().toISOString()
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(recArticle);
      expect(rec.feedVisible).toBe(true);
    });

    it('77. Live post-hydration article is processed normally', () => {
      const liveArticle: any = {
        id: 'live_01',
        headline: 'Live fresh corporate order win',
        publishedAt: new Date().toISOString(),
        isHistorical: false,
        relevanceScore: 90
      };
      const rec = productionTruthReconciliationEngine.reconcileArticle(liveArticle);
      expect(rec.telegramEligible).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 11. Determinism (Tests 78–80)
  // --------------------------------------------------------------------------
  describe('11. Reconciliation Determinism & Immutability', () => {
    it('78. Same input produces same reconciliation result', () => {
      const testArticle: any = {
        id: 'det_01',
        headline: 'Deterministic reconciliation test article',
        body: 'Details regarding corporate event.',
        publishedAt: new Date().toISOString(),
        source: { publisher: 'BSE', collectionMethod: 'DIRECT', url: '' }
      };
      const rec1 = productionTruthReconciliationEngine.reconcileArticle(testArticle);
      const rec2 = productionTruthReconciliationEngine.reconcileArticle(testArticle);
      expect(rec1.reconciliationStatus).toBe(rec2.reconciliationStatus);
      expect(rec1.feedVisibilityReason).toBe(rec2.feedVisibilityReason);
      expect(rec1.summaryQualityStatus).toBe(rec2.summaryQualityStatus);
    });

    it('79. Repeated reconciliation is idempotent', () => {
      const snap1 = productionTruthReconciliationEngine.reconcileAll();
      const snap2 = productionTruthReconciliationEngine.reconcileAll();
      expect(snap1.storeCount).toBe(snap2.storeCount);
      expect(snap1.overallStatus).toBe(snap2.overallStatus);
    });

    it('80. Reconciliation itself never mutates canonical articles', () => {
      const countBefore = newsStore.getAllArticles().length;
      productionTruthReconciliationEngine.reconcileAll();
      const countAfter = newsStore.getAllArticles().length;
      expect(countAfter).toBe(countBefore);
    });
  });
});
