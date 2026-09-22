/**
 * ATHENA FINANCIAL INTELLIGENCE — PHASE 10B-3
 * AutomatedMarketObservationFeed.ts
 *
 * Automated Real Market Observation Feed & Ingestion Scheduler.
 * Periodically and deterministically discovers actionable, unresolved signals from
 * SignalOutcomeEngine, retrieves authentic equity observations via YahooMarketDataService,
 * passes them through ObservationTrustBridge, and feeds trusted observations into
 * SignalOutcomeEngine.
 *
 * Guarantees:
 * - Operating exclusively during valid market observation windows via MarketSessionEngine.
 * - Signal-driven symbol collection (no arbitrary universe or synthetic symbols).
 * - Preservation of canonical Phase 10A signalId (${eventId}::${signalType}::${revision}).
 * - Absolute trust boundary: YahooMarketDataService -> EquityObservation -> ObservationTrustBridge -> MarketObservationTick -> SignalOutcomeEngine.
 * - Strict no-fabrication: skips on missing price, missing OHLC, 404, 502, 504, 429, or invalid bounds.
 * - Duplicate symbol suppression within a single observation cycle.
 * - Bounded concurrency and protection against overlapping scheduler cycles.
 * - Fail-closed, non-destructive behavior on provider error (leaves signals untouched/unresolved).
 * - Zero background timer execution during test harness execution (process.env.VITEST / NODE_ENV='test').
 */

import { SignalOutcomeEngine, SignalOutcomeRecord } from '../market-intelligence/SignalOutcomeEngine.ts';
import { YahooMarketDataService } from './server/YahooMarketDataService.ts';
import { ObservationTrustBridge } from './ObservationTrustBridge.ts';
import { MarketSessionEngine, SessionState } from './MarketSessionEngine.ts';
import { marketIntelligenceFusionEngine, MarketIntelligenceFusionEngine } from '../intelligence/MarketIntelligenceFusionEngine.ts';

export interface LiveSignalReference {
  signalId: string;
  symbol: string;
  signalType?: string;
  revision?: number;
  direction?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | string;
  lifecycleState?: string;
  priority?: string;
  generatedAt?: string;
  isActionable?: boolean;
}

export interface ILiveSignalSource {
  getActiveLiveSignals(): LiveSignalReference[];
}

export class FusionEngineLiveSignalSource implements ILiveSignalSource {
  private fusionEngine?: MarketIntelligenceFusionEngine;

  constructor(fusionEngine?: MarketIntelligenceFusionEngine) {
    this.fusionEngine = fusionEngine;
  }

  public getActiveLiveSignals(): LiveSignalReference[] {
    try {
      const engine = this.fusionEngine || marketIntelligenceFusionEngine;
      if (!engine || typeof engine.rankMarketSignals !== 'function') {
        return [];
      }
      const signals = engine.rankMarketSignals();
      if (!Array.isArray(signals)) return [];
      return signals.map(s => ({
        signalId: s.signalId,
        symbol: s.symbol,
        signalType: s.signalType,
        revision: s.revision,
        direction: s.fundamentalDirection,
        lifecycleState: s.lifecycleState,
        priority: s.priority,
        generatedAt: s.timestamp,
        isActionable: s.lifecycleState === 'ACTIVE' || s.lifecycleState === 'CONFIRMED' || s.lifecycleState === 'WEAKENING'
      }));
    } catch {
      return [];
    }
  }
}

export interface ObservationFeedTelemetry {
  cyclesStarted: number;
  cyclesSkippedMarketClosed: number;
  actionableSignalsDiscovered: number;
  uniqueSymbolsDiscovered: number;
  observationsRequested: number;
  observationsTrusted: number;
  observationsRejected: number;
  providerFailures: number;
  skippedInvalidSymbols: number;
  overlappingCyclesPrevented: number;
  lastCycleDurationMs: number;
  lastCycleTimestamp?: string;
  lastCycleStats?: {
    timestamp: string;
    sessionState: string;
    signalsFound: number;
    uniqueSymbols: number;
    trustedCount: number;
    failedCount: number;
    skippedCount: number;
    durationMs: number;
  };
}

export interface ObservationFeedOptions {
  intervalMs?: number; // default: 30000ms (30s)
  maxConcurrency?: number; // default: 5
  exchange?: 'NSE' | 'BSE' | 'FALLBACK'; // default: 'NSE'
  allowOffHoursForTesting?: boolean; // bypass market session check for test simulation
  autoStartInTest?: boolean; // override test environment safety lock
  liveSignalSource?: ILiveSignalSource | (() => LiveSignalReference[]) | null;
}

export interface CycleExecutionResult {
  status: 'SUCCESS' | 'SKIPPED_MARKET_CLOSED' | 'SKIPPED_OVERLAPPING' | 'ERROR';
  session?: SessionState | string;
  timestamp: string;
  durationMs: number;
  actionableSignalsCount?: number;
  uniqueSymbolsCount?: number;
  observationsTrusted?: number;
  providerFailures?: number;
  skippedInvalidCount?: number;
  message?: string;
}

export class AutomatedMarketObservationFeed {
  private static instance?: AutomatedMarketObservationFeed;

  private timerHandle: NodeJS.Timeout | null = null;
  private isProcessingCycle = false;
  private isRunningState = false;

  private readonly signalOutcomeEngine: SignalOutcomeEngine;
  private readonly yahooService: YahooMarketDataService;
  private readonly trustBridge: ObservationTrustBridge;
  private readonly sessionEngine: typeof MarketSessionEngine;
  private readonly options: ObservationFeedOptions;
  private liveSignalSource?: ILiveSignalSource | (() => LiveSignalReference[]) | null;
  private readonly localLiveSignals: Map<string, LiveSignalReference> = new Map();

  private telemetry: ObservationFeedTelemetry = {
    cyclesStarted: 0,
    cyclesSkippedMarketClosed: 0,
    actionableSignalsDiscovered: 0,
    uniqueSymbolsDiscovered: 0,
    observationsRequested: 0,
    observationsTrusted: 0,
    observationsRejected: 0,
    providerFailures: 0,
    skippedInvalidSymbols: 0,
    overlappingCyclesPrevented: 0,
    lastCycleDurationMs: 0
  };

  public constructor(
    signalOutcomeEngine?: SignalOutcomeEngine,
    yahooService?: YahooMarketDataService,
    trustBridge?: ObservationTrustBridge,
    sessionEngine?: typeof MarketSessionEngine,
    options?: ObservationFeedOptions
  ) {
    this.signalOutcomeEngine = signalOutcomeEngine || SignalOutcomeEngine.getInstance();
    this.yahooService = yahooService || YahooMarketDataService.getInstance();
    this.trustBridge = trustBridge || new ObservationTrustBridge(this.signalOutcomeEngine);
    this.sessionEngine = sessionEngine || MarketSessionEngine;
    this.options = {
      intervalMs: 30000,
      maxConcurrency: 5,
      exchange: 'NSE',
      allowOffHoursForTesting: false,
      autoStartInTest: false,
      ...options
    };
    this.liveSignalSource = options?.liveSignalSource !== undefined ? options.liveSignalSource : undefined;
  }

  public registerLiveSignal(signal: LiveSignalReference): void {
    if (signal && signal.signalId) {
      this.localLiveSignals.set(signal.signalId, signal);
    }
  }

  public unregisterLiveSignal(signalId: string): void {
    this.localLiveSignals.delete(signalId);
  }

  public clearLiveSignals(): void {
    this.localLiveSignals.clear();
  }

  public setLiveSignalSource(source?: ILiveSignalSource | (() => LiveSignalReference[]) | null): void {
    this.liveSignalSource = source;
  }

  public static getInstance(options?: ObservationFeedOptions): AutomatedMarketObservationFeed {
    if (!AutomatedMarketObservationFeed.instance) {
      AutomatedMarketObservationFeed.instance = new AutomatedMarketObservationFeed(
        undefined,
        undefined,
        undefined,
        undefined,
        options
      );
    }
    return AutomatedMarketObservationFeed.instance;
  }

  public static resetInstance(): void {
    if (AutomatedMarketObservationFeed.instance) {
      AutomatedMarketObservationFeed.instance.stop();
      AutomatedMarketObservationFeed.instance = undefined;
    }
  }

  /**
   * Starts the automated background observation scheduler.
   * Enforces safety lock against running background timers inside Vitest test runners.
   */
  public start(customIntervalMs?: number): void {
    const isTestEnv = !!(process.env.VITEST || process.env.NODE_ENV === 'test');
    if (isTestEnv && !this.options.autoStartInTest) {
      return;
    }

    if (this.isRunningState) {
      console.warn('[AutomatedMarketObservationFeed] Scheduler is already active. Duplicate start skipped.');
      return;
    }

    const interval = customIntervalMs || this.options.intervalMs || 30000;
    this.isRunningState = true;

    this.timerHandle = setInterval(() => {
      this.executeCycle().catch(err => {
        console.error('[AutomatedMarketObservationFeed] Background observation cycle error:', err?.message || err);
      });
    }, interval);

    console.log(`[AutomatedMarketObservationFeed] Started automated observation feed (interval: ${interval}ms).`);
  }

  /**
   * Stops the background scheduler and cleans up timers.
   */
  public stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.isRunningState = false;
  }

  public isActive(): boolean {
    return this.isRunningState;
  }

  public isRunning(): boolean {
    return this.isRunningState;
  }

  public getTelemetry(): ObservationFeedTelemetry {
    return { ...this.telemetry };
  }

  public resetTelemetry(): void {
    this.telemetry = {
      cyclesStarted: 0,
      cyclesSkippedMarketClosed: 0,
      actionableSignalsDiscovered: 0,
      uniqueSymbolsDiscovered: 0,
      observationsRequested: 0,
      observationsTrusted: 0,
      observationsRejected: 0,
      providerFailures: 0,
      skippedInvalidSymbols: 0,
      overlappingCyclesPrevented: 0,
      lastCycleDurationMs: 0
    };
  }

  /**
   * Checks if a symbol string represents a generic placeholder or test stub
   */
  public isPlaceholderOrGenericSymbol(raw: string): boolean {
    if (!raw || typeof raw !== 'string') return true;
    const s = raw.trim().toUpperCase();
    if (s.length === 0 || s.length > 30) return true;

    const genericTokens = new Set([
      'N/A', 'NA', 'UNKNOWN', 'TEST', 'PLACEHOLDER', 'GENERIC', 'ARTICLE',
      'NONE', 'NULL', 'UNDEFINED', 'XX', '--', 'SAMPLE', 'MOCK', 'PLACEHOLDER_SYMBOL',
      'EXAMPLE', 'DUMMY', 'FAKE'
    ]);

    if (genericTokens.has(s)) return true;
    if (s.startsWith('TEST_') || s.startsWith('MOCK_') || s.startsWith('PLACEHOLDER_') || s.startsWith('ARTICLE_')) {
      return true;
    }

    // Multi-word strings must strictly match supported multi-word index aliases
    const supportedMultiWordIndices = new Set([
      'NIFTY 50', 'NIFTY BANK', 'NIFTY FIN SERVICE', 'INDIA VIX', 'BSE SENSEX', 'BSE 100'
    ]);
    if (s.includes(' ') && !supportedMultiWordIndices.has(s)) {
      return true;
    }

    return false;
  }

  /**
   * Core synchronous/asynchronous single observation cycle execution.
   * Callable manually or via background interval.
   */
  public async executeCycle(): Promise<CycleExecutionResult> {
    const cycleStart = Date.now();
    const timestamp = new Date().toISOString();

    // 1. Guard against overlapping cycle runs
    if (this.isProcessingCycle) {
      this.telemetry.overlappingCyclesPrevented++;
      return {
        status: 'SKIPPED_OVERLAPPING',
        timestamp,
        durationMs: 0,
        message: 'Previous observation cycle is currently in flight'
      };
    }

    this.isProcessingCycle = true;
    this.telemetry.cyclesStarted++;

    try {
      // 2. Market Session Window Safety Check
      const exchange = this.options.exchange || 'NSE';
      const session = this.sessionEngine.determineSession(timestamp, exchange);
      const isLiveMarket = session === 'LIVE_SESSION';

      if (!isLiveMarket && !this.options.allowOffHoursForTesting) {
        this.telemetry.cyclesSkippedMarketClosed++;
        const durationMs = Date.now() - cycleStart;
        this.telemetry.lastCycleDurationMs = durationMs;
        this.telemetry.lastCycleTimestamp = timestamp;
        this.telemetry.lastCycleStats = {
          timestamp,
          sessionState: session,
          signalsFound: 0,
          uniqueSymbols: 0,
          trustedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          durationMs
        };
        return {
          status: 'SKIPPED_MARKET_CLOSED',
          session,
          timestamp,
          durationMs,
          message: `Observation feed inactive during non-trading market session: ${session}`
        };
      }

      // 3. Live-Signal Collection from Authoritative Live Source Only
      // SAFETY DIRECTIVE: Never query SignalOutcomeEngine.getAllOutcomeRecords() to discover signals.
      // The 446 historical records in SignalOutcomeEngine must NEVER enter live automated observation.
      const rawLiveSignals: LiveSignalReference[] = [];

      if (this.liveSignalSource) {
        try {
          if (typeof this.liveSignalSource === 'function') {
            const res = this.liveSignalSource();
            if (Array.isArray(res)) rawLiveSignals.push(...res);
          } else if (typeof this.liveSignalSource.getActiveLiveSignals === 'function') {
            const res = this.liveSignalSource.getActiveLiveSignals();
            if (Array.isArray(res)) rawLiveSignals.push(...res);
          }
        } catch (sourceErr: any) {
          console.warn('[AutomatedMarketObservationFeed] Live signal source query error (failing closed):', sourceErr?.message || sourceErr);
        }
      } else if (this.liveSignalSource === undefined) {
        // Default: Query MarketIntelligenceFusionEngine
        try {
          const defaultSource = new FusionEngineLiveSignalSource();
          rawLiveSignals.push(...defaultSource.getActiveLiveSignals());
        } catch {}
      }

      // Include locally registered live signals
      for (const sig of this.localLiveSignals.values()) {
        if (!rawLiveSignals.some(s => s.signalId === sig.signalId)) {
          rawLiveSignals.push(sig);
        }
      }

      if (rawLiveSignals.length === 0) {
        // Fail closed: zero live signals found -> zero observation ingestion
        const durationMs = Date.now() - cycleStart;
        this.telemetry.lastCycleDurationMs = durationMs;
        this.telemetry.lastCycleTimestamp = timestamp;
        this.telemetry.lastCycleStats = {
          timestamp,
          sessionState: session,
          signalsFound: 0,
          uniqueSymbols: 0,
          trustedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          durationMs
        };
        return {
          status: 'SUCCESS',
          session,
          timestamp,
          durationMs,
          actionableSignalsCount: 0,
          uniqueSymbolsCount: 0,
          observationsTrusted: 0,
          providerFailures: 0,
          skippedInvalidCount: 0
        };
      }

      // 4. Actionability Filtering, Symbol Validation & Deduplication Grouping
      const actionableRecords = rawLiveSignals.filter(r => {
        if (!r.signalId || !r.symbol) return false;
        const state = (r.lifecycleState || 'ACTIVE').toUpperCase();
        if (state === 'EXPIRED' || state === 'INVALIDATED' || state === 'SUPPRESSED') return false;
        if (r.isActionable === false) return false;

        // If an outcome record exists in SignalOutcomeEngine, verify it is unresolved
        const existingOutcome = this.signalOutcomeEngine.getOutcomeRecord(r.signalId);
        if (existingOutcome) {
          if (existingOutcome.isResolved) return false;
          const outState = (existingOutcome.signalLifecycleState || '').toUpperCase();
          if (outState === 'EXPIRED' || outState === 'INVALIDATED') return false;
        }

        return true;
      });

      const symbolMap = new Map<string, LiveSignalReference[]>();
      let skippedInvalid = 0;

      for (const record of actionableRecords) {
        const rawSym = record.symbol;
        const val = this.yahooService.validateSymbol(rawSym);

        if (!val.valid || !val.symbol || this.isPlaceholderOrGenericSymbol(rawSym)) {
          skippedInvalid++;
          this.telemetry.skippedInvalidSymbols++;
          continue;
        }

        const canonicalSym = val.symbol;
        const list = symbolMap.get(canonicalSym) || [];
        list.push(record);
        symbolMap.set(canonicalSym, list);
      }

      const uniqueSymbols = Array.from(symbolMap.keys());
      const totalValidSignals = Array.from(symbolMap.values()).reduce((sum, list) => sum + list.length, 0);

      this.telemetry.actionableSignalsDiscovered += totalValidSignals;
      this.telemetry.uniqueSymbolsDiscovered += uniqueSymbols.length;

      let cycleTrusted = 0;
      let cycleFailed = 0;

      // 5. Bounded Concurrency Observation Retrieval & Trust Ingestion
      const concurrency = Math.max(1, this.options.maxConcurrency || 5);
      const symbolChunks: string[][] = [];
      for (let i = 0; i < uniqueSymbols.length; i += concurrency) {
        symbolChunks.push(uniqueSymbols.slice(i, i + concurrency));
      }

      for (const chunk of symbolChunks) {
        await Promise.all(
          chunk.map(async sym => {
            const signalsForSymbol = symbolMap.get(sym) || [];
            this.telemetry.observationsRequested++;

            const fetchResult = await this.yahooService.fetchEquityObservation(sym, exchange);

            if (fetchResult.status !== 200 || !fetchResult.observation) {
              cycleFailed++;
              this.telemetry.providerFailures++;
              // Non-destructive: target signals remain untouched & unresolved
              return;
            }

            const equityObs = fetchResult.observation;

            // Submit verified EquityObservation through ObservationTrustBridge for each target live signal
            for (const signalRecord of signalsForSymbol) {
              const ingestRes = this.trustBridge.ingestTrustedEquityObservations(
                signalRecord.signalId,
                [equityObs]
              );

              if (ingestRes.success) {
                cycleTrusted++;
                this.telemetry.observationsTrusted++;
              } else {
                this.telemetry.observationsRejected++;
              }
            }
          })
        );
      }

      const durationMs = Date.now() - cycleStart;
      this.telemetry.lastCycleDurationMs = durationMs;
      this.telemetry.lastCycleTimestamp = timestamp;
      this.telemetry.lastCycleStats = {
        timestamp,
        sessionState: session,
        signalsFound: totalValidSignals,
        uniqueSymbols: uniqueSymbols.length,
        trustedCount: cycleTrusted,
        failedCount: cycleFailed,
        skippedCount: skippedInvalid,
        durationMs
      };

      return {
        status: 'SUCCESS',
        session,
        timestamp,
        durationMs,
        actionableSignalsCount: totalValidSignals,
        uniqueSymbolsCount: uniqueSymbols.length,
        observationsTrusted: cycleTrusted,
        providerFailures: cycleFailed,
        skippedInvalidCount: skippedInvalid
      };
    } catch (err: any) {
      const durationMs = Date.now() - cycleStart;
      return {
        status: 'ERROR',
        timestamp,
        durationMs,
        message: err?.message || 'Unexpected observation feed failure'
      };
    } finally {
      this.isProcessingCycle = false;
    }
  }
}

export const automatedMarketObservationFeed = AutomatedMarketObservationFeed.getInstance();
