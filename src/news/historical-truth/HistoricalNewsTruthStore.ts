/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalNewsTruthStore.ts
 * 
 * Immutable historical news repository strictly enforcing publication timestamp boundaries.
 */

import fs from 'fs';
import path from 'path';
import { HistoricalNewsEvent, HistoricalFilingEvent } from './types.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';
import { historicalFutureFirewall } from './HistoricalFutureFirewall.ts';

export class HistoricalNewsTruthStore {
  private static instance: HistoricalNewsTruthStore;
  private storageDir: string;
  private newsFilePath: string;
  private filingsFilePath: string;
  private inMemoryNews: HistoricalNewsEvent[] = [];
  private inMemoryFilings: HistoricalFilingEvent[] = [];

  private constructor() {
    this.storageDir = path.join(process.cwd(), 'data', 'history');
    this.newsFilePath = path.join(this.storageDir, 'news_events.json');
    this.filingsFilePath = path.join(this.storageDir, 'filings_events.json');
    this.initStorage();
  }

  public static getInstance(): HistoricalNewsTruthStore {
    if (!HistoricalNewsTruthStore.instance) {
      HistoricalNewsTruthStore.instance = new HistoricalNewsTruthStore();
    }
    return HistoricalNewsTruthStore.instance;
  }

  private initStorage(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      if (fs.existsSync(this.newsFilePath)) {
        const raw = fs.readFileSync(this.newsFilePath, 'utf-8');
        this.inMemoryNews = JSON.parse(raw);
      } else {
        this.seedInitialHistoricalNews();
      }

      if (fs.existsSync(this.filingsFilePath)) {
        const raw = fs.readFileSync(this.filingsFilePath, 'utf-8');
        this.inMemoryFilings = JSON.parse(raw);
      } else {
        this.seedInitialHistoricalFilings();
      }
    } catch (e) {
      console.warn('[HistoricalNewsTruthStore] Init warning:', e);
    }
  }

  /**
   * Stores a canonical historical news event
   */
  public storeNewsEvent(event: Omit<HistoricalNewsEvent, 'deterministicHash' | 'provenanceId' | 'schemaVersion'>): HistoricalNewsEvent {
    const raw = {
      ...event,
      schemaVersion: 'v23.1'
    };
    const deterministicHash = HistoricalHashUtils.hashObject(raw);
    const provenanceId = HistoricalHashUtils.generateProvenanceId(event.source, event.publishedAt);
    const fullEvent: HistoricalNewsEvent = {
      ...raw,
      deterministicHash,
      provenanceId
    };

    this.inMemoryNews.push(fullEvent);
    this.persistNews();
    return fullEvent;
  }

  /**
   * Retrieves all news available at or strictly before replayTimestamp.
   * If an article was published after replayTimestamp, it is STRICTLY excluded.
   */
  public getNewsAtTimestamp(replayTimestamp: string, symbol?: string): HistoricalNewsEvent[] {
    const replayTimeMs = new Date(replayTimestamp).getTime();

    // Inspect firewall
    historicalFutureFirewall.inspectRecord('INGESTION', replayTimestamp, 'NEWS_STORE', 'newsQuery', replayTimestamp);

    return this.inMemoryNews
      .filter(item => {
        // Critical rule: publication timestamp must be <= replayTimestamp
        const pubTimeMs = new Date(item.publishedAt).getTime();
        if (pubTimeMs > replayTimeMs) return false;

        if (symbol) {
          const matchEntity = item.entities.some(e => e.toUpperCase() === symbol.toUpperCase());
          return matchEntity;
        }
        return true;
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  /**
   * Retrieves news in a range
   */
  public getNewsInRange(fromTimestamp: string, toTimestamp: string, symbol?: string): HistoricalNewsEvent[] {
    const fromMs = new Date(fromTimestamp).getTime();
    const toMs = new Date(toTimestamp).getTime();

    return this.inMemoryNews
      .filter(item => {
        const pubMs = new Date(item.publishedAt).getTime();
        if (pubMs < fromMs || pubMs > toMs) return false;
        if (symbol) {
          return item.entities.some(e => e.toUpperCase() === symbol.toUpperCase());
        }
        return true;
      })
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  }

  /**
   * Retrieves corporate filings available at or before replayTimestamp
   */
  public getFilingsAtTimestamp(replayTimestamp: string, symbol?: string): HistoricalFilingEvent[] {
    const replayTimeMs = new Date(replayTimestamp).getTime();
    return this.inMemoryFilings
      .filter(f => {
        const fTimeMs = new Date(f.publishedAt).getTime();
        if (fTimeMs > replayTimeMs) return false;
        if (symbol) {
          return f.companySymbol.toUpperCase() === symbol.toUpperCase();
        }
        return true;
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  private persistNews(): void {
    try {
      fs.writeFileSync(this.newsFilePath, JSON.stringify(this.inMemoryNews, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[HistoricalNewsTruthStore] Write error:', e);
    }
  }

  private seedInitialHistoricalNews(): void {
    const baseDate = '2026-07-20';
    const seeds = [
      {
        id: 'news_hist_01',
        canonicalArticleId: 'art_20260720_0910',
        headline: 'RBI Governor indicates robust macro buffers ahead of monsoon session',
        summary: 'Reserve Bank of India reiterates liquidity stance and CPI alignment towards 4% target.',
        publishedAt: `${baseDate}T09:10:00.000Z`,
        ingestedAt: `${baseDate}T09:10:12.000Z`,
        source: 'REUTERS',
        publisher: 'Reuters Financial',
        entities: ['NIFTY 50', 'RBI', 'BANKNIFTY'],
        sectors: ['Banking', 'Macro'],
        sentiment: 'BULLISH' as const,
        catalystClassification: 'MACRO_POLICY',
        sourceReliability: 96,
        evidenceReferences: ['RBI_PR_20260720'],
        isFnO: true
      },
      {
        id: 'news_hist_02',
        canonicalArticleId: 'art_20260720_0921',
        headline: 'Reliance Retail signs strategic cross-border tech logistics partnership',
        summary: 'Reliance Retail expands omnichannel logistics with green energy fleet deployment.',
        publishedAt: `${baseDate}T09:21:00.000Z`,
        ingestedAt: `${baseDate}T09:21:05.000Z`,
        source: 'ECONOMIC_TIMES',
        publisher: 'Economic Times',
        entities: ['RELIANCE', 'NIFTY 50'],
        sectors: ['Retail', 'Energy'],
        sentiment: 'BULLISH' as const,
        catalystClassification: 'CORPORATE_EXPANSION',
        sourceReliability: 94,
        evidenceReferences: ['RIL_EXCHANGE_DISCLOSURE'],
        isFnO: true
      },
      {
        id: 'news_hist_03',
        canonicalArticleId: 'art_20260720_1130',
        headline: 'European natural gas prices surge amid Baltic pipeline maintenance',
        summary: 'Global energy benchmarks see temporary spike, putting short-term pressure on emerging market import bills.',
        publishedAt: `${baseDate}T11:30:00.000Z`,
        ingestedAt: `${baseDate}T11:30:45.000Z`,
        source: 'BLOOMBERG',
        publisher: 'Bloomberg Global',
        entities: ['CRUDE_OIL', 'NIFTY 50', 'RELIANCE'],
        sectors: ['Commodities', 'Energy'],
        sentiment: 'BEARISH' as const,
        catalystClassification: 'GLOBAL_COMMODITY_SHOCK',
        sourceReliability: 95,
        evidenceReferences: ['ICE_ENERGY_REPORT'],
        isFnO: true
      },
      {
        id: 'news_hist_04',
        canonicalArticleId: 'art_20260720_1315',
        headline: 'Ministry of Petroleum clarifies domestic gas allocation formula',
        summary: 'Refining margins protected under revised domestic pricing ceiling.',
        publishedAt: `${baseDate}T13:15:00.000Z`,
        ingestedAt: `${baseDate}T13:15:20.000Z`,
        source: 'PIB_INDIA',
        publisher: 'Press Information Bureau',
        entities: ['RELIANCE', 'ONGC', 'OIL'],
        sectors: ['Oil & Gas'],
        sentiment: 'BULLISH' as const,
        catalystClassification: 'POLICY_CLARIFICATION',
        sourceReliability: 99,
        evidenceReferences: ['MOPNG_GAZETTE_0720'],
        isFnO: true
      }
    ];

    for (const s of seeds) {
      this.storeNewsEvent(s);
    }
  }

  private seedInitialHistoricalFilings(): void {
    const baseDate = '2026-07-20';
    this.inMemoryFilings = [
      {
        id: 'filing_01',
        companySymbol: 'RELIANCE',
        filingType: 'DISCLOSURE',
        headline: 'Intimation of Commercial Agreement under Regulation 30',
        publishedAt: `${baseDate}T09:18:00.000Z`,
        source: 'NSE_DISCLOSURES',
        financialMetrics: { capexEstimatedCr: 1200 },
        deterministicHash: 'h_filing_rel_01',
        provenanceId: 'prov_filing_rel',
        schemaVersion: 'v23.1'
      }
    ];
  }

  public clear(): void {
    this.inMemoryNews = [];
    this.inMemoryFilings = [];
    this.seedInitialHistoricalNews();
    this.seedInitialHistoricalFilings();
  }
}

export const historicalNewsTruthStore = HistoricalNewsTruthStore.getInstance();
