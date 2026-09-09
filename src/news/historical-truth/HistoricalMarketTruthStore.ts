/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalMarketTruthStore.ts
 * 
 * Deterministic storage and retrieval engine for canonical historical market snapshots,
 * ticks, and interval series.
 */

import fs from 'fs';
import path from 'path';
import { CanonicalMarketSnapshot, CanonicalMarketTick, CanonicalInstrumentState } from '../market-truth/types.ts';
import { HistoricalMarketTick, HistoricalProvenance } from './types.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';
import { historicalFutureFirewall } from './HistoricalFutureFirewall.ts';

export interface HistoricalQueryFilter {
  symbol?: string;
  exchange?: 'NSE' | 'BSE' | 'MCX' | 'GLOBAL';
  assetClass?: 'EQUITY' | 'INDEX' | 'DERIVATIVE' | 'COMMODITY' | 'FOREX';
  fromTimestamp?: string;
  toTimestamp?: string;
  maxResults?: number;
  interval?: '1m' | '5m' | '15m' | '30m' | '1h' | '1d';
}

export interface HistoricalSnapshotQueryResult {
  found: boolean;
  status: 'VALID' | 'DATA_UNAVAILABLE' | 'PARTIAL';
  snapshot?: CanonicalMarketSnapshot;
  ticks?: CanonicalMarketTick[];
  timestamp: string;
  missingIntervals: string[];
  deterministicHash: string;
}

export class HistoricalMarketTruthStore {
  private static instance: HistoricalMarketTruthStore;
  private storageDir: string;
  private snapshotsFilePath: string;
  private inMemorySnapshots: Map<string, CanonicalMarketSnapshot> = new Map(); // Key: timestamp ISO
  private inMemoryTicks: Map<string, CanonicalMarketTick[]> = new Map(); // Key: symbol -> ticks sorted

  private constructor() {
    this.storageDir = path.join(process.cwd(), 'data', 'history');
    this.snapshotsFilePath = path.join(this.storageDir, 'market_snapshots.json');
    this.initStorage();
  }

  public static getInstance(): HistoricalMarketTruthStore {
    if (!HistoricalMarketTruthStore.instance) {
      HistoricalMarketTruthStore.instance = new HistoricalMarketTruthStore();
    }
    return HistoricalMarketTruthStore.instance;
  }

  private initStorage(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      if (fs.existsSync(this.snapshotsFilePath)) {
        const raw = fs.readFileSync(this.snapshotsFilePath, 'utf-8');
        const list: CanonicalMarketSnapshot[] = JSON.parse(raw);
        for (const snap of list) {
          if (snap.timestamp) {
            this.inMemorySnapshots.set(snap.timestamp, snap);
            this.indexSnapshotTicks(snap);
          }
        }
      } else {
        // Seed standard historical dataset if empty
        this.seedInitialHistoricalData();
      }
    } catch (e) {
      console.warn('[HistoricalMarketTruthStore] Storage init warning:', e);
    }
  }

  private indexSnapshotTicks(snap: CanonicalMarketSnapshot): void {
    // Index indices
    if (snap.indices) {
      for (const [name, tick] of Object.entries(snap.indices)) {
        const arr = this.inMemoryTicks.get(name) || [];
        arr.push(tick);
        this.inMemoryTicks.set(name, arr);
      }
    }
    // Index equities
    if (snap.equities) {
      for (const [sym, eqState] of Object.entries(snap.equities)) {
        const arr = this.inMemoryTicks.get(sym) || [];
        if (eqState.latestTick) {
          arr.push(eqState.latestTick);
        }
        this.inMemoryTicks.set(sym, arr);
      }
    }
  }

  /**
   * Persists a canonical market snapshot historically
   */
  public storeSnapshot(snapshot: CanonicalMarketSnapshot): { hash: string; stored: boolean } {
    if (!snapshot.timestamp) {
      throw new Error('[HistoricalMarketTruthStore] Snapshot missing timestamp');
    }

    const hash = HistoricalHashUtils.hashObject(snapshot);
    this.inMemorySnapshots.set(snapshot.timestamp, snapshot);
    this.indexSnapshotTicks(snapshot);

    this.persistToDisk();
    return { hash, stored: true };
  }

  /**
   * Retrieves snapshot at an exact or nearest earlier timestamp (deterministic historical lookup)
   */
  public getSnapshotAtTimestamp(replayTimestamp: string): HistoricalSnapshotQueryResult {
    const replayTimeMs = new Date(replayTimestamp).getTime();
    
    // Check firewall
    historicalFutureFirewall.inspectRecord('INGESTION', replayTimestamp, 'STORE', 'snapshotRequest', replayTimestamp);

    // Find latest snapshot whose timestamp <= replayTimestamp
    const timestamps = Array.from(this.inMemorySnapshots.keys())
      .filter(ts => new Date(ts).getTime() <= replayTimeMs)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (timestamps.length === 0) {
      return {
        found: false,
        status: 'DATA_UNAVAILABLE',
        timestamp: replayTimestamp,
        missingIntervals: [replayTimestamp],
        deterministicHash: HistoricalHashUtils.hashObject({ status: 'DATA_UNAVAILABLE', timestamp: replayTimestamp })
      };
    }

    const chosenTs = timestamps[0];
    const rawSnapshot = this.inMemorySnapshots.get(chosenTs)!;

    // Filter snapshot to guarantee zero future ticks
    const sanitizedSnapshot: CanonicalMarketSnapshot = {
      ...rawSnapshot,
      timestamp: chosenTs,
      indices: this.filterTicksMap(rawSnapshot.indices, replayTimeMs),
      equities: this.filterEquitiesMap(rawSnapshot.equities, replayTimeMs)
    };

    const hash = HistoricalHashUtils.hashObject(sanitizedSnapshot);

    return {
      found: true,
      status: 'VALID',
      snapshot: sanitizedSnapshot,
      timestamp: chosenTs,
      missingIntervals: [],
      deterministicHash: hash
    };
  }

  private filterTicksMap(map: Record<string, CanonicalMarketTick> | undefined, maxTimeMs: number): Record<string, CanonicalMarketTick> {
    if (!map) return {};
    const res: Record<string, CanonicalMarketTick> = {};
    for (const [k, v] of Object.entries(map)) {
      if (new Date(v.timestamp).getTime() <= maxTimeMs) {
        res[k] = v;
      }
    }
    return res;
  }

  private filterEquitiesMap(map: Record<string, CanonicalInstrumentState> | undefined, maxTimeMs: number): Record<string, CanonicalInstrumentState> {
    if (!map) return {};
    const res: Record<string, CanonicalInstrumentState> = {};
    for (const [k, v] of Object.entries(map)) {
      if (v.latestTick && new Date(v.latestTick.timestamp).getTime() <= maxTimeMs) {
        res[k] = v;
      }
    }
    return res;
  }

  /**
   * Query ticks for a symbol within a strict historical window
   */
  public getTicksForSymbol(symbol: string, replayTimestamp: string, maxLookbackCount: number = 100): CanonicalMarketTick[] {
    const replayTimeMs = new Date(replayTimestamp).getTime();
    const all = this.inMemoryTicks.get(symbol) || [];

    return all
      .filter(t => new Date(t.timestamp).getTime() <= replayTimeMs)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-maxLookbackCount);
  }

  /**
   * Retrieves snapshots within a time range
   */
  public getSnapshotsInRange(fromTimestamp: string, toTimestamp: string): CanonicalMarketSnapshot[] {
    const fromMs = new Date(fromTimestamp).getTime();
    const toMs = new Date(toTimestamp).getTime();

    return Array.from(this.inMemorySnapshots.values())
      .filter(s => {
        const tMs = new Date(s.timestamp).getTime();
        return tMs >= fromMs && tMs <= toMs;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Detects missing intervals in a requested timeline
   */
  public detectMissingIntervals(
    fromTimestamp: string, 
    toTimestamp: string, 
    intervalMinutes: number = 5
  ): { missing: string[]; completenessScore: number } {
    const fromMs = new Date(fromTimestamp).getTime();
    const toMs = new Date(toTimestamp).getTime();
    const stepMs = intervalMinutes * 60 * 1000;

    const missing: string[] = [];
    let expectedCount = 0;
    let presentCount = 0;

    for (let t = fromMs; t <= toMs; t += stepMs) {
      expectedCount++;
      const iso = new Date(t).toISOString();
      const hasSnapshot = Array.from(this.inMemorySnapshots.keys()).some(ts => {
        const diff = Math.abs(new Date(ts).getTime() - t);
        return diff < (stepMs / 2);
      });

      if (hasSnapshot) {
        presentCount++;
      } else {
        missing.push(iso);
      }
    }

    const score = expectedCount > 0 ? Math.round((presentCount / expectedCount) * 100) : 100;
    return { missing, completenessScore: score };
  }

  private persistToDisk(): void {
    try {
      const list = Array.from(this.inMemorySnapshots.values());
      fs.writeFileSync(this.snapshotsFilePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[HistoricalMarketTruthStore] Disk write warning:', e);
    }
  }

  /**
   * Seeds benchmark historical market data for 2026-07-20 trading session (e.g. Budget / Policy Day)
   */
  public seedInitialHistoricalData(): void {
    const baseDate = '2026-07-20';
    const hours = [
      { time: '09:15:00.000Z', nifty: 24200.0, rel: 2930.0, infy: 1800.0, tcs: 4180.0, hdfc: 1650.0 },
      { time: '09:30:00.000Z', nifty: 24240.0, rel: 2938.0, infy: 1805.0, tcs: 4190.0, hdfc: 1655.0 },
      { time: '10:00:00.000Z', nifty: 24290.0, rel: 2945.0, infy: 1812.0, tcs: 4200.0, hdfc: 1662.0 },
      { time: '10:15:00.000Z', nifty: 24310.0, rel: 2950.0, infy: 1815.0, tcs: 4205.0, hdfc: 1668.0 },
      { time: '11:00:00.000Z', nifty: 24280.0, rel: 2942.0, infy: 1810.0, tcs: 4195.0, hdfc: 1660.0 },
      { time: '11:35:00.000Z', nifty: 24190.0, rel: 2915.0, infy: 1795.0, tcs: 4160.0, hdfc: 1640.0 }, // Midday dip
      { time: '12:30:00.000Z', nifty: 24220.0, rel: 2925.0, infy: 1802.0, tcs: 4175.0, hdfc: 1648.0 },
      { time: '13:20:00.000Z', nifty: 24270.0, rel: 2940.0, infy: 1812.0, tcs: 4190.0, hdfc: 1658.0 }, // Reliance recovery
      { time: '14:30:00.000Z', nifty: 24340.0, rel: 2955.0, infy: 1825.0, tcs: 4215.0, hdfc: 1672.0 },
      { time: '15:30:00.000Z', nifty: 24360.0, rel: 2960.0, infy: 1830.0, tcs: 4220.0, hdfc: 1675.0 }
    ];

    for (const item of hours) {
      const ts = `${baseDate}T${item.time}`;
      const snap: CanonicalMarketSnapshot = {
        snapshotId: `snap_${item.time}`,
        timestamp: ts,
        session: {
          exchange: 'NSE',
          state: item.time < '15:30:00' ? 'CONTINUOUS_TRADING' : 'POST_MARKET',
          isHoliday: false,
          isWeekend: false,
          isSpecialSession: false,
          isExpiryDay: false,
          sessionStartTime: `${baseDate}T09:15:00.000Z`,
          sessionEndTime: `${baseDate}T15:30:00.000Z`,
          timeToNextSessionMs: 0
        },
        indices: {
          'NIFTY 50': {
            instrumentId: 'NSE:INDEX:NIFTY50',
            symbol: '^NSEI',
            canonicalSymbol: 'NIFTY 50',
            exchange: 'NSE',
            assetClass: 'INDEX',
            timestamp: ts,
            exchangeTimestamp: ts,
            receivedTimestamp: ts,
            sequenceNumber: 1,
            lastPrice: item.nifty,
            previousClose: 24150.0,
            open: 24180.0,
            high: item.nifty + 20,
            low: 24150.0,
            volume: 180000000,
            tradedValue: 32000000000,
            bidPrice: null,
            askPrice: null,
            bidQuantity: null,
            askQuantity: null,
            spread: null,
            priceChange: item.nifty - 24150.0,
            priceChangePercent: Number((((item.nifty - 24150.0) / 24150.0) * 100).toFixed(2)),
            VWAP: item.nifty,
            marketStatus: 'CONTINUOUS_TRADING',
            source: 'NSE_DIRECT',
            sourcePriority: 'P0_AUTHORITATIVE',
            qualityStatus: 'VALID',
            freshnessStatus: 'FRESH',
            validationStatus: 'VALID',
            provenance: {
              source: 'NSE_DIRECT',
              sourceTimestamp: ts,
              receivedTimestamp: ts,
              normalizationVersion: 'v23.1',
              validationVersion: 'v23.1',
              qualityVersion: 'v23.1',
              correlationId: `seed_${item.time}`,
              isModified: false
            }
          }
        },
        sectors: {
          'NIFTY IT': { symbol: 'NIFTY IT', name: 'NIFTY IT', changePercent: 0.85, weightedContribution: 0.25 },
          'NIFTY BANK': { symbol: 'NIFTY BANK', name: 'NIFTY BANK', changePercent: 0.65, weightedContribution: 0.35 }
        },
        equities: {
          'RELIANCE': {
            symbol: 'RELIANCE',
            canonicalSymbol: 'RELIANCE',
            assetClass: 'EQUITY',
            exchange: 'NSE',
            historicalPrices: [2910, 2920, item.rel],
            recentAtrs: [18.5],
            rollingVolatilities: [14.2],
            freshnessScore: 100,
            qualityScore: 100,
            integrityScore: 100,
            sourceAgreementScore: 100,
            lastValidatedAt: ts,
            status: 'VALID',
            latestTick: {
              instrumentId: 'NSE:EQ:RELIANCE',
              symbol: 'RELIANCE',
              canonicalSymbol: 'RELIANCE',
              exchange: 'NSE',
              assetClass: 'EQUITY',
              timestamp: ts,
              exchangeTimestamp: ts,
              receivedTimestamp: ts,
              sequenceNumber: 101,
              lastPrice: item.rel,
              previousClose: 2920.0,
              open: 2925.0,
              high: item.rel + 10,
              low: 2910.0,
              volume: 1200000,
              tradedValue: 3500000000,
              bidPrice: item.rel - 0.5,
              askPrice: item.rel + 0.5,
              bidQuantity: 500,
              askQuantity: 500,
              spread: 1.0,
              priceChange: item.rel - 2920.0,
              priceChangePercent: Number((((item.rel - 2920.0) / 2920.0) * 100).toFixed(2)),
              VWAP: item.rel - 2.0,
              marketStatus: 'CONTINUOUS_TRADING',
              source: 'NSE_DIRECT',
              sourcePriority: 'P0_AUTHORITATIVE',
              qualityStatus: 'VALID',
              freshnessStatus: 'FRESH',
              validationStatus: 'VALID',
              provenance: {
                source: 'NSE_DIRECT',
                sourceTimestamp: ts,
                receivedTimestamp: ts,
                normalizationVersion: 'v23.1',
                validationVersion: 'v23.1',
                qualityVersion: 'v23.1',
                correlationId: `seed_rel_${item.time}`,
                isModified: false
              }
            }
          }
        },
        derivatives: {
          niftyFuturesBasis: 12.5,
          bankNiftyFuturesBasis: 25.0,
          indiaVix: 14.8,
          pcrRatio: 1.15,
          maxPainStrike: 24200,
          activeStrikes: []
        },
        volatilityState: {
          indiaVix: 14.8,
          vixChangePercent: -1.2,
          regime: 'NORMAL_VOL'
        },
        liquidityState: {
          averageSpreadPercent: 0.02,
          totalMarketTurnoverINR: 654000000000,
          liquidityCondition: 'AMPLE'
        },
        breadth: {
          advances: 32,
          declines: 18,
          unchanged: 0,
          advanceDeclineRatio: 1.77,
          newFiftyTwoWeekHighs: 14,
          newFiftyTwoWeekLows: 1
        },
        quality: {
          overallQualityScore: 98,
          freshnessScore: 100,
          integrityScore: 100,
          sourceAgreementScore: 100,
          activeSourcesCount: 3,
          staleInstrumentsCount: 0,
          anomalousInstrumentsCount: 0,
          contradictedInstrumentsCount: 0,
          status: 'VALID'
        },
        provenance: {
          source: 'NSE_DIRECT',
          sourceTimestamp: ts,
          receivedTimestamp: ts,
          normalizationVersion: 'v23.1',
          validationVersion: 'v23.1',
          qualityVersion: 'v23.1',
          correlationId: `seed_snap_${item.time}`,
          isModified: false
        }
      };

      this.inMemorySnapshots.set(ts, snap);
      this.indexSnapshotTicks(snap);
    }
  }

  public clear(): void {
    this.inMemorySnapshots.clear();
    this.inMemoryTicks.clear();
    this.seedInitialHistoricalData();
  }
}

export const historicalMarketTruthStore = HistoricalMarketTruthStore.getInstance();
