/**
 * ATHENA FINANCIAL INTELLIGENCE — PHASE 10C
 * ControlledSignalExpiryEngine.ts
 *
 * Deterministic, Controlled Signal Expiry Engine for CURRENT/LIVE Signals.
 *
 * VALIDITY WINDOW SEMANTICS:
 * Validity windows in Athena (Phase 10.7 and Phase 10C) are strictly WALL-CLOCK BASED:
 * Age = (currentTime - generatedAtTime).
 * An event's information decay occurs across physical elapsed time (wall-clock)
 * rather than active trading minutes. Market session checks (via MarketSessionEngine)
 * may optionally govern whether the scheduler sweep executes during non-market hours
 * (for scheduler safety), but market sessions NEVER alter or compress validity-window duration.
 *
 * CRITICAL SAFETY RULES:
 * 1. NEVER use SignalOutcomeEngine.getAllOutcomeRecords() as the source of expiry candidates.
 *    The 446 historical outcome records must NEVER be interpreted as live signals.
 * 2. If an authoritative live signal source is unavailable, FAIL CLOSED.
 * 3. Never expire terminal states (EXPIRED, INVALIDATED).
 * 4. Strictly idempotent: repeated sweeps on already-expired signals produce zero mutations.
 * 5. Absolutely no price fabrication, synthetic observations, or artificial P&L.
 * 6. Zero timer execution in test environments (VITEST / NODE_ENV='test') unless autoStartInTest is set.
 */

import { SignalOutcomeEngine } from '../market-intelligence/SignalOutcomeEngine.ts';
import { SignalLifecycleEngine, SignalLifecycleState } from '../intelligence/SignalLifecycleEngine.ts';
import { MarketSessionEngine, SessionState } from './MarketSessionEngine.ts';
import {
  LiveSignalReference,
  ILiveSignalSource,
  FusionEngineLiveSignalSource
} from './AutomatedMarketObservationFeed.ts';

export interface ControlledExpiryOptions {
  intervalMs?: number; // default: 60000ms (1 min)
  allowOffHoursForTesting?: boolean; // bypass market session check for test simulation
  autoStartInTest?: boolean; // override test environment safety lock (default false)
  liveSignalSource?: ILiveSignalSource | (() => LiveSignalReference[]) | null;
  enforceMarketSession?: boolean; // default false (wall-clock semantics preserved)
  exchange?: 'NSE' | 'BSE' | 'FALLBACK'; // default: 'NSE'
}

export interface ExpiryEngineTelemetry {
  sweepsStarted: number;
  sweepsSkipped: number;
  liveSignalsDiscovered: number;
  expiryCandidates: number;
  signalsExpired: number;
  alreadyTerminalSignals: number;
  invalidCandidates: number;
  sourceUnavailableCount: number;
  sweepFailures: number;
  overlappingSweepsPrevented: number;
  lastSweepTimestamp?: string;
  lastSweepDurationMs: number;
}

export interface SweepExecutionResult {
  status: 'SUCCESS' | 'SKIPPED_MARKET_CLOSED' | 'SKIPPED_OVERLAPPING' | 'SOURCE_UNAVAILABLE' | 'ERROR';
  session?: SessionState | string;
  timestamp: string;
  durationMs: number;
  liveSignalsDiscovered: number;
  expiryCandidates: number;
  signalsExpired: number;
  alreadyTerminalSignals: number;
  invalidCandidates: number;
  expiredSignalIds: string[];
  message?: string;
}

export class ControlledSignalExpiryEngine {
  private static instance?: ControlledSignalExpiryEngine;

  private timerHandle: NodeJS.Timeout | null = null;
  private isProcessingSweep = false;
  private isRunningState = false;

  private readonly signalLifecycleEngine: SignalLifecycleEngine;
  private readonly signalOutcomeEngine: SignalOutcomeEngine;
  private readonly sessionEngine: typeof MarketSessionEngine;
  private readonly options: ControlledExpiryOptions;

  private liveSignalSource?: ILiveSignalSource | (() => LiveSignalReference[]) | null;
  private readonly localLiveSignals: Map<string, LiveSignalReference> = new Map();

  private telemetry: ExpiryEngineTelemetry = {
    sweepsStarted: 0,
    sweepsSkipped: 0,
    liveSignalsDiscovered: 0,
    expiryCandidates: 0,
    signalsExpired: 0,
    alreadyTerminalSignals: 0,
    invalidCandidates: 0,
    sourceUnavailableCount: 0,
    sweepFailures: 0,
    overlappingSweepsPrevented: 0,
    lastSweepDurationMs: 0
  };

  public constructor(
    lifecycleEngine?: SignalLifecycleEngine,
    outcomeEngine?: SignalOutcomeEngine,
    sessionEngine?: typeof MarketSessionEngine,
    options?: ControlledExpiryOptions
  ) {
    this.signalLifecycleEngine = lifecycleEngine || SignalLifecycleEngine.getInstance();
    this.signalOutcomeEngine = outcomeEngine || SignalOutcomeEngine.getInstance();
    this.sessionEngine = sessionEngine || MarketSessionEngine;
    this.options = {
      intervalMs: 60000,
      allowOffHoursForTesting: false,
      autoStartInTest: false,
      enforceMarketSession: false,
      exchange: 'NSE',
      ...options
    };
    this.liveSignalSource = options?.liveSignalSource !== undefined ? options.liveSignalSource : undefined;
  }

  public static getInstance(options?: ControlledExpiryOptions): ControlledSignalExpiryEngine {
    if (!ControlledSignalExpiryEngine.instance) {
      ControlledSignalExpiryEngine.instance = new ControlledSignalExpiryEngine(
        undefined,
        undefined,
        undefined,
        options
      );
    }
    return ControlledSignalExpiryEngine.instance;
  }

  public static resetInstance(): void {
    if (ControlledSignalExpiryEngine.instance) {
      ControlledSignalExpiryEngine.instance.stop();
      ControlledSignalExpiryEngine.instance = undefined;
    }
  }

  public registerLiveSignal(signal: LiveSignalReference): void {
    if (signal && signal.signalId) {
      this.localLiveSignals.set(signal.signalId, { ...signal });
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

  public getTelemetry(): ExpiryEngineTelemetry {
    return { ...this.telemetry };
  }

  public resetTelemetry(): void {
    this.telemetry = {
      sweepsStarted: 0,
      sweepsSkipped: 0,
      liveSignalsDiscovered: 0,
      expiryCandidates: 0,
      signalsExpired: 0,
      alreadyTerminalSignals: 0,
      invalidCandidates: 0,
      sourceUnavailableCount: 0,
      sweepFailures: 0,
      overlappingSweepsPrevented: 0,
      lastSweepDurationMs: 0
    };
  }

  public isActive(): boolean {
    return this.isRunningState;
  }

  public isRunning(): boolean {
    return this.isRunningState;
  }

  /**
   * Starts the background expiry scheduler.
   * Enforces safety lock against background timer execution during Vitest test runs.
   */
  public start(customIntervalMs?: number): void {
    const isTestEnv = !!(process.env.VITEST || process.env.NODE_ENV === 'test');
    if (isTestEnv && !this.options.autoStartInTest) {
      return;
    }

    if (this.isRunningState) {
      console.warn('[ControlledSignalExpiryEngine] Scheduler is already active. Duplicate start skipped.');
      return;
    }

    const interval = customIntervalMs || this.options.intervalMs || 60000;
    this.isRunningState = true;

    this.timerHandle = setInterval(() => {
      this.executeSweep().catch(err => {
        console.error('[ControlledSignalExpiryEngine] Background sweep error:', err?.message || err);
      });
    }, interval);

    console.log(`[ControlledSignalExpiryEngine] Started controlled expiry scheduler (interval: ${interval}ms).`);
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

  /**
   * Core synchronous/asynchronous deterministic expiry sweep.
   * Discovers authoritative live signals, verifies expiry eligibility,
   * calculates deterministic validity windows, and transitions expired signals.
   */
  public async executeSweep(nowMs?: number): Promise<SweepExecutionResult> {
    const sweepStart = Date.now();
    const evalNowMs = typeof nowMs === 'number' && isFinite(nowMs) ? nowMs : Date.now();
    const timestamp = new Date(evalNowMs).toISOString();

    // 1. Guard against overlapping sweep runs
    if (this.isProcessingSweep) {
      this.telemetry.overlappingSweepsPrevented++;
      this.telemetry.sweepsSkipped++;
      return {
        status: 'SKIPPED_OVERLAPPING',
        timestamp,
        durationMs: 0,
        liveSignalsDiscovered: 0,
        expiryCandidates: 0,
        signalsExpired: 0,
        alreadyTerminalSignals: 0,
        invalidCandidates: 0,
        expiredSignalIds: [],
        message: 'Previous expiry sweep is currently in flight'
      };
    }

    this.isProcessingSweep = true;
    this.telemetry.sweepsStarted++;

    try {
      // 2. Market Session Window Check (if enforceMarketSession option enabled)
      if (this.options.enforceMarketSession) {
        const exchange = this.options.exchange || 'NSE';
        const session = this.sessionEngine.determineSession(timestamp, exchange);
        const isLiveMarket = session === 'LIVE_SESSION';

        if (!isLiveMarket && !this.options.allowOffHoursForTesting) {
          this.telemetry.sweepsSkipped++;
          const durationMs = Date.now() - sweepStart;
          this.telemetry.lastSweepDurationMs = durationMs;
          this.telemetry.lastSweepTimestamp = timestamp;
          return {
            status: 'SKIPPED_MARKET_CLOSED',
            session,
            timestamp,
            durationMs,
            liveSignalsDiscovered: 0,
            expiryCandidates: 0,
            signalsExpired: 0,
            alreadyTerminalSignals: 0,
            invalidCandidates: 0,
            expiredSignalIds: [],
            message: `Expiry sweep inactive during non-trading market session: ${session}`
          };
        }
      }

      // 3. Live-Signal Collection from Authoritative Live Source Only
      // CRITICAL SAFETY RULE: Never use SignalOutcomeEngine.getAllOutcomeRecords().
      // The 446 historical records in SignalOutcomeEngine must NEVER enter live expiry evaluation.
      const rawLiveSignals: LiveSignalReference[] = [];
      let sourceQueried = false;

      if (this.liveSignalSource !== undefined) {
        if (this.liveSignalSource === null) {
          // Explicitly set to null: do NOT query fallback. Fail closed if no local live signals!
          sourceQueried = true;
        } else {
          try {
            sourceQueried = true;
            if (typeof this.liveSignalSource === 'function') {
              const res = this.liveSignalSource();
              if (Array.isArray(res)) rawLiveSignals.push(...res);
            } else if (typeof this.liveSignalSource.getActiveLiveSignals === 'function') {
              const res = this.liveSignalSource.getActiveLiveSignals();
              if (Array.isArray(res)) rawLiveSignals.push(...res);
            }
          } catch (sourceErr: any) {
            console.warn('[ControlledSignalExpiryEngine] Live signal source query error:', sourceErr?.message || sourceErr);
            this.telemetry.sourceUnavailableCount++;
          }
        }
      } else {
        // Default: Query MarketIntelligenceFusionEngine
        try {
          sourceQueried = true;
          const defaultSource = new FusionEngineLiveSignalSource();
          rawLiveSignals.push(...defaultSource.getActiveLiveSignals());
        } catch (defaultErr: any) {
          console.warn('[ControlledSignalExpiryEngine] Default live signal source error:', defaultErr?.message || defaultErr);
          this.telemetry.sourceUnavailableCount++;
        }
      }

      // Include locally registered live signals
      for (const sig of this.localLiveSignals.values()) {
        if (!rawLiveSignals.some(s => s.signalId === sig.signalId)) {
          rawLiveSignals.push(sig);
        }
      }

      // Fail Closed Check: If live source is null and no local signals, report source unavailable
      if (this.liveSignalSource === null && this.localLiveSignals.size === 0) {
        this.telemetry.sourceUnavailableCount++;
        this.telemetry.sweepsSkipped++;
        const durationMs = Date.now() - sweepStart;
        this.telemetry.lastSweepDurationMs = durationMs;
        this.telemetry.lastSweepTimestamp = timestamp;
        return {
          status: 'SOURCE_UNAVAILABLE',
          timestamp,
          durationMs,
          liveSignalsDiscovered: 0,
          expiryCandidates: 0,
          signalsExpired: 0,
          alreadyTerminalSignals: 0,
          invalidCandidates: 0,
          expiredSignalIds: [],
          message: 'Authoritative live signal source unavailable. Fail closed.'
        };
      }

      // If 0 live signals discovered
      if (rawLiveSignals.length === 0) {
        const durationMs = Date.now() - sweepStart;
        this.telemetry.lastSweepDurationMs = durationMs;
        this.telemetry.lastSweepTimestamp = timestamp;
        return {
          status: 'SUCCESS',
          timestamp,
          durationMs,
          liveSignalsDiscovered: 0,
          expiryCandidates: 0,
          signalsExpired: 0,
          alreadyTerminalSignals: 0,
          invalidCandidates: 0,
          expiredSignalIds: []
        };
      }

      const expiredSignalIds: string[] = [];
      let cycleDiscoveredCount = 0;
      let cycleCandidatesCount = 0;
      let cycleExpiredCount = 0;
      let cycleTerminalCount = 0;
      let cycleInvalidCount = 0;

      const allowedNonTerminalStates = new Set<SignalLifecycleState>([
        'NEW',
        'ACTIVE',
        'CONFIRMED',
        'WEAKENING',
        'CONTRADICTED'
      ]);

      const terminalStates = new Set<SignalLifecycleState>([
        'INVALIDATED',
        'EXPIRED'
      ]);

      for (const signal of rawLiveSignals) {
        cycleDiscoveredCount++;
        this.telemetry.liveSignalsDiscovered++;

        // 4. Candidate Validation
        // A. Validate signalId
        if (!signal || !signal.signalId || typeof signal.signalId !== 'string' || signal.signalId.trim() === '') {
          cycleInvalidCount++;
          this.telemetry.invalidCandidates++;
          continue;
        }

        // B. Validate timestamp
        const rawTime = signal.generatedAt || (signal as any).createdAt || (signal as any).timestamp;
        if (!rawTime || typeof rawTime !== 'string') {
          cycleInvalidCount++;
          this.telemetry.invalidCandidates++;
          continue;
        }

        const createdMs = new Date(rawTime).getTime();
        if (isNaN(createdMs) || createdMs <= 0) {
          cycleInvalidCount++;
          this.telemetry.invalidCandidates++;
          continue;
        }

        // C. Check existing state in lifecycle engine or outcome engine for terminal state
        const existingLifecycle = this.signalLifecycleEngine.getLifecycle(signal.signalId);
        const existingOutcomeRecord = this.signalOutcomeEngine.getRecord(signal.signalId);

        const currentLiveState = (existingLifecycle?.currentState ||
                                  signal.lifecycleState ||
                                  existingOutcomeRecord?.signalLifecycleState) as SignalLifecycleState | undefined;

        // Terminal Check: Never expire INVALIDATED or EXPIRED
        if (
          (currentLiveState && terminalStates.has(currentLiveState)) ||
          existingLifecycle?.currentState === 'EXPIRED' ||
          existingLifecycle?.currentState === 'INVALIDATED' ||
          existingOutcomeRecord?.signalLifecycleState === 'EXPIRED' ||
          existingOutcomeRecord?.signalLifecycleState === 'INVALIDATED' ||
          existingOutcomeRecord?.outcome === 'EXPIRED_WITHOUT_RESOLUTION'
        ) {
          cycleTerminalCount++;
          this.telemetry.alreadyTerminalSignals++;
          continue;
        }

        // D. Check non-actionability flag if explicitly marked non-actionable and not an allowed non-terminal state
        if (signal.isActionable === false && signal.lifecycleState && !allowedNonTerminalStates.has(signal.lifecycleState as SignalLifecycleState)) {
          cycleInvalidCount++;
          this.telemetry.invalidCandidates++;
          continue;
        }

        // State validation: must be an allowed candidate state
        if (currentLiveState && !allowedNonTerminalStates.has(currentLiveState)) {
          cycleInvalidCount++;
          this.telemetry.invalidCandidates++;
          continue;
        }

        // Passed candidate eligibility
        cycleCandidatesCount++;
        this.telemetry.expiryCandidates++;

        // 5. Deterministic Validity Window Calculation (Wall-Clock Based)
        const validityWindowSeconds = SignalLifecycleEngine.getValidityWindowSeconds(
          signal.signalType || (signal as any).eventType || '',
          signal.priority || ''
        );
        const validityWindowMs = validityWindowSeconds * 1000;
        const ageSeconds = Math.max(0, Math.floor((evalNowMs - createdMs) / 1000));

        // 6. Deterministic Expiry Check
        if (evalNowMs >= createdMs + validityWindowMs) {
          // Validity window has elapsed -> Transition to EXPIRED
          const expiryReason = 'VALIDITY_WINDOW_ELAPSED';
          const evidence = {
            validityWindowSeconds,
            ageSeconds,
            generatedAt: rawTime,
            expiredAt: new Date(evalNowMs).toISOString(),
            operator: 'controlled_signal_expiry_engine'
          };

          // Synchronize with SignalLifecycleEngine if tracked
          if (existingLifecycle) {
            this.signalLifecycleEngine.expireSignal(
              signal.signalId,
              expiryReason,
              evidence,
              this.signalOutcomeEngine
            );
          } else {
            // Direct synchronization with SignalOutcomeEngine
            this.signalOutcomeEngine.updateSignalLifecycleState(
              signal.signalId,
              'EXPIRED',
              expiryReason,
              false
            );
          }

          // Update local live signal reference state
          signal.lifecycleState = 'EXPIRED';
          if (this.localLiveSignals.has(signal.signalId)) {
            const loc = this.localLiveSignals.get(signal.signalId)!;
            loc.lifecycleState = 'EXPIRED';
          }

          cycleExpiredCount++;
          this.telemetry.signalsExpired++;
          expiredSignalIds.push(signal.signalId);
        }
      }

      const durationMs = Date.now() - sweepStart;
      this.telemetry.lastSweepDurationMs = durationMs;
      this.telemetry.lastSweepTimestamp = timestamp;

      return {
        status: 'SUCCESS',
        timestamp,
        durationMs,
        liveSignalsDiscovered: cycleDiscoveredCount,
        expiryCandidates: cycleCandidatesCount,
        signalsExpired: cycleExpiredCount,
        alreadyTerminalSignals: cycleTerminalCount,
        invalidCandidates: cycleInvalidCount,
        expiredSignalIds
      };
    } catch (err: any) {
      this.telemetry.sweepFailures++;
      const durationMs = Date.now() - sweepStart;
      this.telemetry.lastSweepDurationMs = durationMs;
      this.telemetry.lastSweepTimestamp = timestamp;
      return {
        status: 'ERROR',
        timestamp,
        durationMs,
        liveSignalsDiscovered: 0,
        expiryCandidates: 0,
        signalsExpired: 0,
        alreadyTerminalSignals: 0,
        invalidCandidates: 0,
        expiredSignalIds: [],
        message: err?.message || String(err)
      };
    } finally {
      this.isProcessingSweep = false;
    }
  }
}
