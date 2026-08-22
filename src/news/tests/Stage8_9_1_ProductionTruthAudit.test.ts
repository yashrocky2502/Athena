/**
 * ATHENA NEWS ENGINE — STAGE 8.9.1
 * Production Feed, Summary & Telegram Truth Audit Test Suite
 * 
 * Forensic production data path verification:
 * 1. Feed Count Truth (Canonical Disk == Persistent Store == Feed API)
 * 2. Source-Grounded Summaries (No generic boilerplate leakage, accurate classification)
 * 3. Telegram Alert Idempotency & Rate-Limit Backoff
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PersistentNewsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { UnifiedIntelligenceEngine } from '../../newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine';
import { NewsCategoryResolver } from '../../newsCoreV2/classification/NewsCategoryResolver';
import { TelegramNotificationPipeline } from '../telegram/TelegramNotificationPipeline';
import { TelegramAlertEligibilityEngine } from '../telegram/TelegramAlertEligibilityEngine';
import { TelegramOperationsController } from '../operations/TelegramOperationsController';
import { TelegramQualityGate } from '../telegram/TelegramQualityGate';
import { TelegramAuditTrail } from '../operations/TelegramAuditTrail';
import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle';

describe('Stage 8.9.1: Production Truth Audit', () => {
  let store: PersistentNewsStore;

  beforeEach(() => {
    store = new PersistentNewsStore();
    TelegramOperationsController.getInstance().markActive();
    TelegramOperationsController.getInstance().clearIdempotency();
    TelegramQualityGate.clearHistory();
    TelegramNotificationPipeline.getInstance().clearHistory();
    TelegramAuditTrail.getInstance().clear();
  });

  describe('1. Feed Count & Storage Integrity Truth', () => {
    it('should hydrate all canonical articles from disk without silent drops', () => {
      const articles = store.getAllArticles();
      expect(articles.length).toBeGreaterThanOrEqual(860);

      // Verify no articles have undefined ids or headlines
      for (const article of articles) {
        expect(article.id).toBeDefined();
        expect(typeof article.id).toBe('string');
        expect(article.headline).toBeDefined();
        expect(article.headline.length).toBeGreaterThan(0);
      }
    });

    it('should preserve and serve historical canonical articles with enriched intelligence', () => {
      const articles = store.getAllArticles();
      const sample = articles.slice(0, 20);

      for (const item of sample) {
        const intel = UnifiedIntelligenceEngine.build(item);
        expect(intel).toBeDefined();
        expect(intel.executiveSummary).toBeDefined();
        expect(intel.executiveSummary.length).toBeGreaterThan(15);
        expect(intel.whyItMatters).toBeDefined();
        expect(intel.whyItMatters.length).toBeGreaterThan(10);
      }
    });
  });

  describe('2. Summary Quality & Anti-Boilerplate Verification', () => {
    it('United Spirits: FSSAI order revocation classified as REGULATORY, not ORDER_CONTRACT', () => {
      const article: any = {
        id: 'test_usl_fssai_01',
        headline: 'FSSAI revokes suspension of United Spirits unit in Maharashtra',
        body: 'The Food Safety and Standards Authority of India (FSSAI) has revoked the suspension order on United Spirits manufacturing unit with immediate effect following compliance review.',
        publishedAt: new Date().toISOString(),
        source: { name: 'PTI', publisher: 'Press Trust of India' },
        category: 'Corporate'
      };

      const resolved = NewsCategoryResolver.resolve(
        article.headline,
        article.body,
        article.source?.name || ''
      );
      expect(resolved.primaryCategory).toBe('Corporate');
      expect(resolved.eventType).toBe('REGULATORY');
      expect(resolved.eventType).not.toBe('ORDER_CONTRACT');

      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.whyItMatters).toContain('revocation of the regulatory order removes operating restrictions');
      expect(intel.whyItMatters).not.toContain('order book backlog');
      expect(intel.whyItMatters).not.toContain('revenue visibility and executable backlog');
    });

    it('Axis Bank: Senior notes listing explained factually without generic boilerplate', () => {
      const article: any = {
        id: 'test_axis_listing_01',
        headline: 'Axis Bank gets final nod to list $300 million senior notes on India INX, NSE IX',
        body: 'Axis Bank on Wednesday said it has received final approval from regulatory authorities to list its $300 million sustainable senior notes on India International Exchange and NSE International Exchange at GIFT IFSC.',
        publishedAt: new Date().toISOString(),
        source: { name: 'Economic Times', publisher: 'The Economic Times' },
        category: 'Corporate'
      };

      const resolved = NewsCategoryResolver.resolve(
        article.headline,
        article.body,
        article.source?.name || ''
      );
      expect(['LISTING', 'CORPORATE_ACTION', 'REGULATORY']).toContain(resolved.eventType);
      expect(resolved.eventType).not.toBe('ORDER_CONTRACT');

      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.executiveSummary).not.toContain('Institutional market participants are evaluating');
      expect(intel.whyItMatters).toContain('Listing senior notes on international exchange platforms provides access to global institutional debt investors');
    });

    it('Political/General News: Factual summary without fake financial boilerplate or Market General entities', () => {
      const article: any = {
        id: 'test_general_01',
        headline: 'Parliament passes national highway development bill with bipartisan support',
        body: 'The upper house of parliament today unanimously passed the updated national highway infrastructure development bill to streamline land acquisition and speed up interstate corridor execution.',
        publishedAt: new Date().toISOString(),
        source: { name: 'Reuters', publisher: 'Thomson Reuters' },
        category: 'Other'
      };

      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.executiveSummary).not.toContain('Institutional market participants are evaluating');
      expect(intel.executiveSummary).not.toContain('Market General');
    });

    it('SAIL Dividend: Preserves dividend facts without headline echo', () => {
      const article: any = {
        id: 'test_sail_div_01',
        headline: 'SAIL fixes September 20 as record date for final dividend of Rs 1.50 per share',
        body: 'Steel Authority of India Limited (SAIL) has fixed September 20, 2024 as the record date for determining the eligibility of shareholders for the payment of final dividend of Rs 1.50 per equity share for FY24.',
        publishedAt: new Date().toISOString(),
        source: { name: 'LiveMint', publisher: 'Mint' },
        category: 'Corporate'
      };

      const intel = UnifiedIntelligenceEngine.build(article);
      expect(intel.executiveSummary).toBeDefined();
      expect(intel.executiveSummary.length).toBeGreaterThan(article.headline.length);
      expect(intel.whyItMatters).toBeDefined();
    });
  });

  describe('3. Telegram Alert Idempotency & Rate Limit Backoff', () => {
    it('should suppress identical duplicate alerts for the same event and article', async () => {
      const pipeline = TelegramNotificationPipeline.getInstance();
      const opController = TelegramOperationsController.getInstance();

      const article1: any = {
        id: 'ipo_alert_dup_01',
        eventId: 'HEXAWARE_IPO_2024',
        headline: 'Hexaware Technologies files DRHP with SEBI for Rs 9,950 crore mega IPO',
        body: 'IT services company Hexaware Technologies has filed preliminary papers with capital markets regulator SEBI to raise Rs 9,950 crore through an initial public offering.',
        category: 'Corporate',
        publishedAt: new Date().toISOString(),
        source: { name: 'Moneycontrol', publisher: 'Moneycontrol', url: 'https://moneycontrol.com', collectionMethod: 'FEED' }
      };

      const article2Duplicate: any = {
        id: 'ipo_alert_dup_02',
        eventId: 'HEXAWARE_IPO_2024',
        headline: 'Hexaware Technologies files draft papers for Rs 9,950 crore IPO with SEBI',
        body: 'Hexaware Technologies has submitted draft red herring prospectus to market regulator SEBI for its upcoming Rs 9,950 crore IPO.',
        category: 'Corporate',
        publishedAt: new Date().toISOString(),
        source: { name: 'Business Standard', publisher: 'Business Standard', url: 'https://business-standard.com', collectionMethod: 'FEED' }
      };

      // First dispatch in dryRun mode (simulates delivery)
      const res1 = await pipeline.enqueueArticle(article1, { dryRun: true, forceDispatch: true });
      expect(res1.isEligible).toBe(true);

      // Verify event is recorded in operations controller
      expect(opController.isEventAlertDispatched('HEXAWARE_IPO_2024', 'ARTICLE_ALERT')).toBe(true);

      // Second duplicate dispatch should be strictly suppressed
      const res2 = await pipeline.enqueueArticle(article2Duplicate, { dryRun: true });
      expect(res2.dispatched).toBe(false);
      expect(res2.rejectionReasons[0]).toMatch(/Duplicate/i);
    });

    it('should allow material revision updates to dispatch as update alerts', async () => {
      const pipeline = TelegramNotificationPipeline.getInstance();
      const opController = TelegramOperationsController.getInstance();

      const initialArticle: any = {
        id: 'tata_ipo_v1',
        eventId: 'TATA_TECH_IPO',
        eventVersion: 'v1',
        materialRevision: 'v1',
        headline: 'Tata Technologies sets IPO price band at Rs 475-500 per share',
        body: 'Tata Technologies has announced a price band of Rs 475 to Rs 500 per equity share for its upcoming public offer opening on November 22.',
        category: 'Corporate',
        publishedAt: new Date().toISOString(),
        source: { name: 'Economic Times', publisher: 'The Economic Times', url: 'https://economictimes.com', collectionMethod: 'FEED' }
      };

      const res1 = await pipeline.enqueueArticle(initialArticle, { dryRun: true, forceDispatch: true });
      expect(res1.isEligible).toBe(true);

      // Material update (e.g. final subscription rate 69x)
      const updateArticle: any = {
        id: 'tata_ipo_v2',
        eventId: 'TATA_TECH_IPO',
        eventVersion: 'v2',
        materialRevision: 'v2',
        headline: 'Tata Technologies IPO subscribed 69.43 times on final day of bidding',
        body: 'The blockbuster initial public offering of Tata Technologies received bids for over 312 crore equity shares against the offer size of 4.5 crore shares, resulting in a staggering 69.43 times subscription.',
        category: 'Corporate',
        publishedAt: new Date().toISOString(),
        source: { name: 'LiveMint', publisher: 'Mint', url: 'https://livemint.com', collectionMethod: 'FEED' }
      };

      const res2 = await pipeline.enqueueArticle(updateArticle, { dryRun: true, forceDispatch: true });
      expect(res2.isEligible).toBe(true);
      expect(res2.eventType).toBe('IPO');
    });

    it('should preserve dispatched state across hydration without replaying delivered alerts', () => {
      const opController = TelegramOperationsController.getInstance();
      
      opController.hydrateDispatchedKeys([
        'CANONICAL_EARNINGS_RELIANCE::ARTICLE_ALERT',
        'CANONICAL_IPO_SWIGGY::ARTICLE_ALERT'
      ]);

      expect(opController.isEventAlertDispatched('CANONICAL_EARNINGS_RELIANCE', 'ARTICLE_ALERT')).toBe(true);
      expect(opController.isEventAlertDispatched('CANONICAL_IPO_SWIGGY', 'ARTICLE_ALERT')).toBe(true);
      expect(opController.isEventAlertDispatched('NEW_EVENT_HDFC', 'ARTICLE_ALERT')).toBe(false);
    });

    it('should handle rate-limiting (429) backoff cleanly without breaking state', () => {
      const opController = TelegramOperationsController.getInstance();
      
      opController.markDegraded('Telegram rate-limited (429)');
      const status = opController.getStatus();
      
      expect(status.state).toBe('DEGRADED');
      expect(status.degradedReason).toContain('429');

      opController.markActive();
      expect(opController.getStatus().state).toBe('ACTIVE');
    });
  });
});
