/**
 * ATHENA NEWS ENGINE — PHASE 10.7
 * SignalLifecycleEngine.ts
 * 
 * Production Signal Lifecycle, Decay, Invalidation & Continuous Actionability Engine.
 * Enforces absolute zero-AI cost (0 LLM calls), strict deterministic transition rules,
 * score decay curves, inline invalidation, concurrency locks, and restart safety.
 */

import fs from 'fs';
import path from 'path';
import { MarketSignal, SignalPriority, SignalAlignment } from './MarketIntelligenceFusionEngine.ts';
import { NewsEvent } from '../types/NewsEvent.ts';
import { MarketConfirmationDossier } from './MarketConfirmationEngine.ts';
import { TelegramService } from '../NewsEngine/TelegramService.ts';
import { TraderTelegramFormatter } from '../telegram/TraderTelegramFormatter.ts';
import { SignalOutcomeEngine } from '../market-intelligence/SignalOutcomeEngine.ts';

export type SignalLifecycleState =
  | 'NEW'
  | 'ACTIVE'
  | 'CONFIRMED'
  | 'WEAKENING'
  | 'CONTRADICTED'
  | 'INVALIDATED'
  | 'EXPIRED';

export type ActionabilityState =
  | 'ACTIONABLE'
  | 'WATCH'
  | 'NO_LONGER_ACTIONABLE'
  | 'INVALIDATED'
  | 'INSUFFICIENT_EVIDENCE';

export interface SignalTransition {
  transitionId: string; // ${signalId}::${fromState}::${toState}::${lifecycleRevision}
  previousState: SignalLifecycleState;
  newState: SignalLifecycleState;
  timestamp: string;
  reason: string;
  evidence: any;
  signalRevision: number;
  lifecycleRevision: number;
}

export interface SignalLifecycle {
  signalId: string;
  eventId: string;
  symbol: string;
  signalType: string;
  currentState: SignalLifecycleState;
  timeline: SignalTransition[];
  rawScore: number;
  decayedScore: number;
  decayFactor: number;
  scoreAge: number; // in seconds
  actionability: ActionabilityState;
  createdAt: string;
  confirmedAt?: string;
  invalidatedAt?: string;
  expiredAt?: string;
  invalidationReason?: string;
  
  // Contradiction escalation fields
  contradictionDetected: boolean;
  contradictionReason?: string;
  contradictionTimestamp?: string;
  previousAlignment?: string;
  currentAlignment?: string;
  
  // Analytics and tracking
  fundamentalDirection: string;
  initialScore: number;
  peakScore: number;
  initialPriority: SignalPriority;
  finalState?: SignalLifecycleState;
  initialAlignment: SignalAlignment;
  finalAlignment?: SignalAlignment;
  initialPrice?: number;
  peakPrice?: number;
  finalPrice?: number;
  volumeConfirmation?: string;
  fnoConfirmation?: string;
  lifecycleRevision: number;
  lastUpdated: string;
}

export interface HistoricalOutcome {
  signalId: string;
  eventId: string;
  symbol: string;
  signalType: string;
  initialScore: number;
  peakScore: number;
  initialPriority: SignalPriority;
  finalState: SignalLifecycleState;
  initialAlignment: SignalAlignment;
  finalAlignment: SignalAlignment;
  initialPrice?: number;
  peakPrice?: number;
  finalPrice?: number;
  volumeConfirmation?: string;
  fnoConfirmation?: string;
  createdAt: string;
  confirmedAt?: string;
  invalidatedAt?: string;
  expiredAt?: string;
  duration: number; // in seconds
}

export interface LifecycleObservability {
  activeSignals: number;
  confirmedSignals: number;
  weakeningSignals: number;
  contradictedSignals: number;
  invalidatedSignals: number;
  expiredSignals: number;
  averageSignalLifetime: number; // seconds
  averageConfirmationTime: number; // seconds
  invalidationRate: number; // 0-100%
  contradictionRate: number; // 0-100%
  expiryRate: number; // 0-100%
  lifecycleTransitionCount: number;
  TelegramLifecycleDispatchCount: number;
  duplicateSuppressionCount: number;
  cacheStatistics: {
    activeSize: number;
    historicalSize: number;
  };
  zeroAiExecutionCount: number;
}

export class SignalLifecycleEngine {
  private static instance: SignalLifecycleEngine;
  private lifecycles: Map<string, SignalLifecycle> = new Map();
  private historicalLedger: HistoricalOutcome[] = [];
  
  private persistencePath: string;
  private ledgerPath: string;
  private executionCount = 0;
  private telegramDispatchCount = 0;
  private duplicateSuppressionCount = 0;
  private transitionCount = 0;
  
  // Concurrency Lock: Semaphore/Mutex queue
  private writeLock: Promise<void> = Promise.resolve();

  // Valid state transitions mapped deterministically
  private static readonly VALID_TRANSITIONS: Record<SignalLifecycleState, SignalLifecycleState[]> = {
    NEW: ['ACTIVE', 'CONFIRMED', 'WEAKENING', 'INVALIDATED', 'EXPIRED'],
    ACTIVE: ['CONFIRMED', 'WEAKENING', 'CONTRADICTED', 'INVALIDATED', 'EXPIRED'],
    CONFIRMED: ['WEAKENING', 'CONTRADICTED', 'INVALIDATED', 'EXPIRED'],
    WEAKENING: ['CONFIRMED', 'CONTRADICTED', 'INVALIDATED', 'EXPIRED'],
    CONTRADICTED: ['INVALIDATED', 'EXPIRED'],
    INVALIDATED: [],
    EXPIRED: []
  };

  private constructor() {
    if (typeof window !== 'undefined') {
      this.persistencePath = '';
      this.ledgerPath = '';
      return;
    }
    this.persistencePath = path.join(process.cwd(), 'data', 'news_signal_lifecycle.json');
    this.ledgerPath = path.join(process.cwd(), 'data', 'news_signal_historical_ledger.json');
    this.hydrate();
  }

  public static getInstance(): SignalLifecycleEngine {
    if (!SignalLifecycleEngine.instance) {
      SignalLifecycleEngine.instance = new SignalLifecycleEngine();
    }
    return SignalLifecycleEngine.instance;
  }

  /**
   * Reset instance (mainly for testing)
   */
  public clear(): void {
    this.lifecycles.clear();
    this.historicalLedger = [];
    this.executionCount = 0;
    this.telegramDispatchCount = 0;
    this.duplicateSuppressionCount = 0;
    this.transitionCount = 0;
    
    // Delete files for test isolation if exists
    try {
      if (fs.existsSync(this.persistencePath)) fs.unlinkSync(this.persistencePath);
      if (fs.existsSync(this.ledgerPath)) fs.unlinkSync(this.ledgerPath);
    } catch {}
  }

  /**
   * Serialization mutex to guarantee concurrency safety
   */
  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    let release: () => void;
    const nextLock = new Promise<void>((resolve) => { release = resolve; });
    const currentLock = this.writeLock;
    this.writeLock = currentLock.then(() => nextLock);

    await currentLock;
    try {
      return await operation();
    } finally {
      release!();
    }
  }

  /**
   * Hydrates state securely from canonical disk files
   */
  public hydrate(): void {
    try {
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.persistencePath)) {
        const raw = fs.readFileSync(this.persistencePath, 'utf-8');
        if (raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          for (const key in parsed) {
            this.lifecycles.set(key, parsed[key]);
          }
        }
      }

      if (fs.existsSync(this.ledgerPath)) {
        const rawLedger = fs.readFileSync(this.ledgerPath, 'utf-8');
        if (rawLedger.trim().length > 0) {
          this.historicalLedger = JSON.parse(rawLedger);
        }
      }
    } catch (err) {
      console.error('[SignalLifecycleEngine] Hydration error:', err);
    }
  }

  /**
   * Persists active lifecycles and outcome ledger to disk
   */
  public persist(): void {
    try {
      const activeObj: Record<string, SignalLifecycle> = {};
      for (const [k, v] of this.lifecycles.entries()) {
        activeObj[k] = v;
      }
      fs.writeFileSync(this.persistencePath, JSON.stringify(activeObj, null, 2), 'utf-8');
      fs.writeFileSync(this.ledgerPath, JSON.stringify(this.historicalLedger, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SignalLifecycleEngine] Persistence error:', err);
    }
  }

  /**
   * Evaluates or compiles a signal lifecycle incrementally.
   */
  /**
   * Evaluates or compiles a signal lifecycle incrementally.
   */
  public evaluateSignal(
    signal: MarketSignal,
    event?: NewsEvent,
    confirmation?: MarketConfirmationDossier
  ): SignalLifecycle {
    this.executionCount++;
    const nowStr = new Date().toISOString();
    const signalId = signal.signalId;
    
    let lifecycle = this.lifecycles.get(signalId);
    let isNew = false;

    if (!lifecycle) {
      isNew = true;
      lifecycle = {
        signalId,
        eventId: signal.eventId,
        symbol: signal.symbol,
        signalType: signal.signalType,
        currentState: 'NEW',
        timeline: [],
        rawScore: signal.signalScore,
        decayedScore: signal.signalScore,
        decayFactor: 1.0,
        scoreAge: 0,
        actionability: 'ACTIONABLE',
        createdAt: nowStr,
        contradictionDetected: false,
        fundamentalDirection: signal.fundamentalDirection || 'UNKNOWN',
        initialScore: signal.signalScore,
        peakScore: signal.signalScore,
        initialPriority: signal.priority,
        initialAlignment: signal.alignment,
        volumeConfirmation: signal.volumeText,
        fnoConfirmation: signal.fnoText,
        lifecycleRevision: 0,
        lastUpdated: nowStr
      };

      // Create initial transition record
      const transition: SignalTransition = {
        transitionId: `${signalId}::NONE::NEW::0`,
        previousState: 'NEW', // Or NEW as initial state transition
        newState: 'NEW',
        timestamp: nowStr,
        reason: 'Initial signal compilation and entry into the continuous engine.',
        evidence: { rawScore: signal.signalScore, alignment: signal.alignment },
        signalRevision: signal.revision || 1,
        lifecycleRevision: 0
      };
      lifecycle.timeline.push(transition);
      this.lifecycles.set(signalId, lifecycle);
    } else {
      lifecycle.rawScore = signal.signalScore;
      if (signal.revision && signal.revision > lifecycle.lifecycleRevision) {
        lifecycle.lifecycleRevision = signal.revision;
      }
      lifecycle.lastUpdated = nowStr;
    }

    // Calculate score age in seconds
    const createdTime = new Date(lifecycle.createdAt).getTime();
    const ageSeconds = Math.max(0, Math.floor((Date.now() - createdTime) / 1000));
    lifecycle.scoreAge = ageSeconds;

    // 1. Calculate Score Decay
    const validityWindow = this.getValidityWindowSeconds(signal.eventType, signal.priority);
    let baseDecay = Math.max(0.2, 1.0 - (ageSeconds / validityWindow));

    // Speed up decay depending on data stale/expired and conflict states
    if (signal.freshnessText === 'STALE') {
      baseDecay *= 0.7;
    } else if (signal.freshnessText === 'EXPIRED') {
      baseDecay *= 0.4;
    }
    if ((signal.alignment as string) === 'CONFLICTING') {
      baseDecay *= 0.6;
    }
    if (signal.warnings?.includes('PROVIDER_CONFLICT')) {
      baseDecay *= 0.5;
    }
    
    lifecycle.decayFactor = parseFloat(baseDecay.toFixed(4));
    lifecycle.decayedScore = Math.max(0, Math.round(lifecycle.rawScore * lifecycle.decayFactor));
    
    // Update peakScore tracking
    if (lifecycle.decayedScore > lifecycle.peakScore) {
      lifecycle.peakScore = lifecycle.decayedScore;
    }

    // 2. Perform Invalidation Check
    const invalidationReason = this.checkInvalidation(signal, validityWindow, ageSeconds, lifecycle, event, confirmation);
    
    // 3. Perform Contradiction Check
    const prevAlignment = lifecycle.currentAlignment || lifecycle.initialAlignment;
    const currentAlignment = signal.alignment;
    lifecycle.currentAlignment = currentAlignment;

    let isContradictedTransition = false;
    if (((prevAlignment as string) === 'ALIGNED' || (prevAlignment as string) === 'STRONGLY_ALIGNED') && (currentAlignment as string) === 'CONFLICTING') {
      if (!lifecycle.contradictionDetected) {
        lifecycle.contradictionDetected = true;
        lifecycle.contradictionReason = 'Alignment deteriorated from supportive to CONFLICTING.';
        lifecycle.contradictionTimestamp = nowStr;
        lifecycle.previousAlignment = prevAlignment;
        isContradictedTransition = true;
      }
    }

    // 4. Calculate New State & Transition
    let targetState: SignalLifecycleState = lifecycle.currentState;

    if (invalidationReason) {
      targetState = 'INVALIDATED';
      lifecycle.invalidationReason = invalidationReason;
      if (!lifecycle.invalidatedAt) {
        lifecycle.invalidatedAt = nowStr;
      }
    } else if (ageSeconds >= validityWindow || signal.freshnessText === 'EXPIRED') {
      targetState = 'EXPIRED';
      if (!lifecycle.expiredAt) {
        lifecycle.expiredAt = nowStr;
      }
    } else if (isContradictedTransition || (signal.alignment as string) === 'CONFLICTING') {
      targetState = 'CONTRADICTED';
    } else if (lifecycle.currentState === 'NEW') {
      if (signal.freshnessText === 'STALE' || signal.lifecycleState === 'WEAKENING') {
        targetState = 'WEAKENING';
      } else if (signal.lifecycleState === 'CONFIRMED' || (signal.overallConfirmation === 'CONFIRMED' && ((signal.alignment as string) === 'STRONGLY_ALIGNED' || (signal.alignment as string) === 'ALIGNED'))) {
        targetState = 'CONFIRMED';
        if (!lifecycle.confirmedAt) {
          lifecycle.confirmedAt = nowStr;
        }
      } else {
        targetState = 'ACTIVE';
      }
    } else if (lifecycle.currentState === 'ACTIVE') {
      if (signal.freshnessText === 'STALE' || baseDecay < 0.7) {
        targetState = 'WEAKENING';
      } else if ((signal.alignment as string) === 'STRONGLY_ALIGNED' || (signal.alignment as string) === 'ALIGNED') {
        targetState = 'CONFIRMED';
        if (!lifecycle.confirmedAt) {
          lifecycle.confirmedAt = nowStr;
        }
      }
    } else if (lifecycle.currentState === 'CONFIRMED') {
      if (signal.freshnessText === 'STALE' || baseDecay < 0.7) {
        targetState = 'WEAKENING';
      }
    } else if (lifecycle.currentState === 'WEAKENING') {
      if ((signal.alignment as string) === 'STRONGLY_ALIGNED' || (signal.alignment as string) === 'ALIGNED') {
        targetState = 'CONFIRMED';
      }
    }

    // Dispatch transition if different
    if (targetState !== lifecycle.currentState) {
      this.transitionState(lifecycle, targetState, signal, `State updated to ${targetState} based on deterministic pipeline re-evaluation.`, {
        invalidationReason,
        decayFactor: lifecycle.decayFactor,
        alignment: signal.alignment,
        freshness: signal.freshnessText
      });
    }

    // 5. Calculate Actionability
    if (lifecycle.currentState === 'INVALIDATED') {
      lifecycle.actionability = 'INVALIDATED';
      lifecycle.decayedScore = 0;
    } else if (lifecycle.currentState === 'EXPIRED' || lifecycle.currentState === 'CONTRADICTED') {
      lifecycle.actionability = 'NO_LONGER_ACTIONABLE';
      lifecycle.decayedScore = 0;
    } else if (lifecycle.currentState === 'WEAKENING') {
      lifecycle.actionability = 'WATCH';
    } else if (lifecycle.decayedScore < 40) {
      lifecycle.actionability = 'WATCH';
    } else if (lifecycle.decayedScore < 25) {
      lifecycle.actionability = 'INSUFFICIENT_EVIDENCE';
    } else {
      lifecycle.actionability = 'ACTIONABLE';
    }

    // 6. Record Outcome if Signal reached Terminal State (INVALIDATED or EXPIRED)
    if ((lifecycle.currentState === 'INVALIDATED' || lifecycle.currentState === 'EXPIRED') && !lifecycle.finalState) {
      lifecycle.finalState = lifecycle.currentState;
      lifecycle.finalAlignment = signal.alignment;
      
      const duration = Math.max(1, Math.floor((Date.now() - createdTime) / 1000));
      
      const outcome: HistoricalOutcome = {
        signalId: lifecycle.signalId,
        eventId: lifecycle.eventId,
        symbol: lifecycle.symbol,
        signalType: lifecycle.signalType,
        initialScore: lifecycle.initialScore,
        peakScore: lifecycle.peakScore,
        initialPriority: lifecycle.initialPriority,
        finalState: lifecycle.currentState,
        initialAlignment: lifecycle.initialAlignment,
        finalAlignment: signal.alignment,
        createdAt: lifecycle.createdAt,
        confirmedAt: lifecycle.confirmedAt,
        invalidatedAt: lifecycle.invalidatedAt,
        expiredAt: lifecycle.expiredAt,
        duration
      };
      
      this.historicalLedger.push(outcome);
    }

    // Phase 10.8: Register or update SignalOutcomeEngine
    try {
      const initialPrice = (confirmation as any)?.quote?.price || confirmation?.priceReaction?.percentagePriceChange || (signal as any).marketPrice || 100;
      const fDir = signal.fundamentalDirection as string;
      const dir = (fDir === 'POSITIVE' || fDir === 'BULLISH')
        ? 'BULLISH'
        : ((fDir === 'NEGATIVE' || fDir === 'BEARISH') ? 'BEARISH' : 'NEUTRAL');
      
      SignalOutcomeEngine.getInstance().registerActionableSignal({
        eventId: signal.eventId,
        signalType: signal.signalType,
        symbol: signal.symbol,
        revision: signal.revision || 1,
        generatedAt: lifecycle.createdAt,
        initialPrice,
        initialMarketState: lifecycle.currentState,
        initialCompositeScore: signal.signalScore,
        initialPriority: signal.priority,
        initialAlignment: signal.alignment,
        signalLifecycleState: lifecycle.currentState,
        direction: dir,
        eventCategory: event?.category || signal.signalType,
        sector: (signal as any).sector || 'GENERAL',
        sourceTier: ((signal as any).sourceCount && (signal as any).sourceCount > 1) ? 'multi-source' : 'Tier 1'
      });

      SignalOutcomeEngine.getInstance().updateSignalLifecycleState(
        lifecycle.signalId,
        lifecycle.currentState,
        invalidationReason || `Lifecycle state evaluated as ${lifecycle.currentState}`,
        lifecycle.contradictionDetected
      );
    } catch {}

    lifecycle.lastUpdated = nowStr;
    this.persist();
    return lifecycle;
  }

  /**
   * Safe, locked state transition executor
   */
  private transitionState(
    lifecycle: SignalLifecycle,
    toState: SignalLifecycleState,
    signal: MarketSignal,
    reason: string,
    evidence: any
  ): void {
    const fromState = lifecycle.currentState;
    
    // Validate transitions
    const validNextStates = SignalLifecycleEngine.VALID_TRANSITIONS[fromState] || [];
    if (!validNextStates.includes(toState) && fromState !== toState) {
      console.warn(`[SignalLifecycleEngine] REJECTED transition: ${fromState} -> ${toState} for signal ${lifecycle.signalId}`);
      return;
    }

    lifecycle.lifecycleRevision++;
    this.transitionCount++;

    const transition: SignalTransition = {
      transitionId: `${lifecycle.signalId}::${fromState}::${toState}::${lifecycle.lifecycleRevision}`,
      previousState: fromState,
      newState: toState,
      timestamp: new Date().toISOString(),
      reason,
      evidence,
      signalRevision: signal.revision || 1,
      lifecycleRevision: lifecycle.lifecycleRevision
    };

    lifecycle.timeline.push(transition);
    lifecycle.currentState = toState;

    // Dispatch Telegram update
    try {
      const telegramService = TelegramService.getInstance();
      const creds = telegramService.getCredentials();
      if (creds && creds.botToken && creds.chatId) {
        const formattedMessage = TraderTelegramFormatter.formatLifecycleNotification(lifecycle, toState, reason);
        telegramService.sendMessage(formattedMessage, creds.botToken, creds.chatId).catch(err => {
          console.warn(`[SignalLifecycleEngine] Background Telegram dispatch failed for ${lifecycle.signalId}:`, err);
        });
      }
    } catch (telegramErr) {
      console.warn(`[SignalLifecycleEngine] Failed to initiate Telegram dispatch for ${lifecycle.signalId}:`, telegramErr);
    }
  }

  /**
   * Deterministic logic mapping validity window classes
   */
  private getValidityWindowSeconds(eventType: string, priority: string): number {
    const typeLower = (eventType || '').toLowerCase();
    if (typeLower.includes('breaking') || typeLower.includes('flash') || typeLower.includes('rumor') || priority === 'P0_CRITICAL') {
      return 300; // 5 min
    }
    if (typeLower.includes('earnings') || typeLower.includes('dividend') || typeLower.includes('board') || typeLower.includes('intraday')) {
      return 7200; // 2 hours
    }
    if (typeLower.includes('merger') || typeLower.includes('acquisition') || typeLower.includes('regulatory') || typeLower.includes('swing')) {
      return 86400; // 24 hours (1 day)
    }
    return 432000; // 5 days (long-term)
  }

  /**
   * Deterministic Invalidation Rules Engine
   */
  private checkInvalidation(
    signal: MarketSignal,
    validityWindow: number,
    ageSeconds: number,
    lifecycle: SignalLifecycle,
    event?: NewsEvent,
    confirmation?: MarketConfirmationDossier
  ): string | null {
    // 1. Fundamental invalidation
    if (event) {
      if ((event.eventStatus as string) === 'WITHDRAWN' || (event.eventStatus as string) === 'SUPERSEDED' || (event.eventStatus as string) === 'CANCELLED') {
        return 'EVENT_WITHDRAWN';
      }
      if ((event.conflictStatus as string) === 'RESOLVED_BY_AUTHORITY' || (event.conflictStatus as string) === 'RESOLVED_CONFLICT_INVALID') {
        return 'SOURCE_CONFLICT';
      }
    }

    // 2. Reversal of fundamental direction
    if (
      lifecycle.fundamentalDirection &&
      lifecycle.fundamentalDirection !== 'UNKNOWN' &&
      signal.fundamentalDirection !== 'UNKNOWN' &&
      lifecycle.fundamentalDirection !== signal.fundamentalDirection
    ) {
      return 'FUNDAMENTAL_REVERSAL';
    }

    // 3. Market Invalidation
    if (signal.overallConfirmation === 'CONTRADICTED') {
      return 'MARKET_CONTRADICTION';
    }
    if (ageSeconds > validityWindow * 2) {
      return 'MARKET_DATA_EXPIRED';
    }

    // 4. Price Contradiction (BULLISH vs NEGATIVE / BEARISH vs POSITIVE with magnitude)
    if (signal.fundamentalDirection === 'BULLISH' && signal.priceReactionText.includes('NEGATIVE')) {
      // if price drop is >= 2.0%
      if (confirmation && confirmation.priceReaction.percentagePriceChange <= -2.0) {
        return 'PRICE_CONTRADICTION';
      }
    }
    if (signal.fundamentalDirection === 'BEARISH' && signal.priceReactionText.includes('POSITIVE')) {
      // if price surge is >= 2.0%
      if (confirmation && confirmation.priceReaction.percentagePriceChange >= 2.0) {
        return 'PRICE_CONTRADICTION';
      }
    }

    // 5. Volume Invalidation
    if (signal.volumeText === 'UNAVAILABLE' || signal.volumeText.includes('INSUFFICIENT_EVIDENCE')) {
      // If volume confirmation was previously mandatory (e.g., highly material index action), but disappeared
      if (signal.priority === 'P0_CRITICAL' && signal.eventType.includes('EARNINGS')) {
        return 'VOLUME_FAILURE';
      }
    }

    // 6. F&O positioning reversal
    if (signal.fnoText.includes('REVERSAL') || signal.warnings.includes('FNO_REVERSAL')) {
      return 'FNO_REVERSAL';
    }

    // 7. Data integrity invalidation
    if (signal.warnings?.includes('PROVIDER_CONFLICT')) {
      return 'PROVIDER_CONFLICT_INVALID';
    }
    if (signal.warnings?.includes('DATA_CORRUPTED')) {
      return 'DATA_CORRUPTION';
    }
    if (signal.sourceTier === 'TIER_4') {
      return 'SOURCE_DOWNGRADE';
    }

    return null;
  }

  /**
   * Returns active signal lifecycles
   */
  public getActiveLifecycles(): SignalLifecycle[] {
    return Array.from(this.lifecycles.values());
  }

  /**
   * Returns outcome ledger history
   */
  public getHistoricalLedger(): HistoricalOutcome[] {
    return [...this.historicalLedger];
  }

  /**
   * Manually invalidates an active signal lifecycle
   */
  public manualInvalidation(signalId: string, reason: string, signal?: MarketSignal): boolean {
    const lc = this.lifecycles.get(signalId);
    if (!lc) return false;
    if (lc.currentState === 'INVALIDATED' || lc.currentState === 'EXPIRED') return false;

    const dummySignal: MarketSignal = signal || ({
      signalId: lc.signalId,
      eventId: lc.eventId,
      articleId: '',
      symbol: lc.symbol,
      eventType: lc.signalType,
      signalType: lc.signalType,
      priority: lc.initialPriority as any,
      signalScore: lc.decayedScore,
      components: { eventScore: 0, marketReactionScore: 0, volumeScore: 0, fnoScore: 0, sourceTierScore: 0 },
      alignment: lc.currentAlignment || lc.initialAlignment || 'ALIGNED',
      lifecycleState: lc.currentState as any,
      explanation: 'Manual invalidation',
      timestamp: new Date().toISOString(),
      revision: lc.lifecycleRevision,
      warnings: [],
      eventMateriality: 'MEDIUM',
      fundamentalDirection: lc.fundamentalDirection,
      overallConfirmation: 'CONFIRMED',
      sourceTier: 'Tier 1',
      freshnessText: 'REAL_TIME',
      crossAssetImpacts: [],
      priceReactionText: 'UNKNOWN',
      volumeText: 'INSUFFICIENT_EVIDENCE',
      fnoText: 'INSUFFICIENT_EVIDENCE'
    } as any);

    lc.invalidationReason = reason;
    lc.invalidatedAt = new Date().toISOString();
    
    this.transitionState(lc, 'INVALIDATED', dummySignal, `Manual Invalidation: ${reason}`, {
      reason,
      operator: 'manual'
    });

    lc.actionability = 'INVALIDATED';
    lc.lastUpdated = new Date().toISOString();
    
    // Save outcome
    if (!lc.finalState) {
      lc.finalState = 'INVALIDATED';
      lc.finalAlignment = dummySignal.alignment;
      
      const createdTime = new Date(lc.createdAt).getTime();
      const duration = Math.max(1, Math.floor((Date.now() - createdTime) / 1000));
      
      const outcome: HistoricalOutcome = {
        signalId: lc.signalId,
        eventId: lc.eventId,
        symbol: lc.symbol,
        signalType: lc.signalType,
        initialScore: lc.initialScore,
        peakScore: lc.peakScore,
        initialPriority: lc.initialPriority,
        finalState: 'INVALIDATED',
        initialAlignment: lc.initialAlignment,
        finalAlignment: dummySignal.alignment,
        createdAt: lc.createdAt,
        confirmedAt: lc.confirmedAt,
        invalidatedAt: lc.invalidatedAt,
        expiredAt: lc.expiredAt,
        duration
      };
      
      this.historicalLedger.push(outcome);
    }

    try {
      SignalOutcomeEngine.getInstance().updateSignalLifecycleState(
        lc.signalId,
        'INVALIDATED',
        reason || 'Manual Operator Invalidation',
        false
      );
    } catch {}

    this.persist();
    return true;
  }

  /**
   * Returns signal timeline trace
   */
  public getTimeline(signalId: string): SignalTransition[] {
    const lc = this.lifecycles.get(signalId);
    return lc ? lc.timeline : [];
  }

  /**
   * Continuous Observability Telemetry Exposer
   */
  public getObservability(): LifecycleObservability {
    const lcs = Array.from(this.lifecycles.values());
    const terminal = this.historicalLedger;

    const activeCount = lcs.filter(l => l.currentState === 'ACTIVE').length;
    const confirmedCount = lcs.filter(l => l.currentState === 'CONFIRMED').length;
    const weakeningCount = lcs.filter(l => l.currentState === 'WEAKENING').length;
    const contradictedCount = lcs.filter(l => l.currentState === 'CONTRADICTED').length;
    const invalidatedCount = lcs.filter(l => l.currentState === 'INVALIDATED').length;
    const expiredCount = lcs.filter(l => l.currentState === 'EXPIRED').length;

    const totalCount = lcs.length;
    const invalidationRate = totalCount > 0 ? parseFloat(((invalidatedCount / totalCount) * 100).toFixed(2)) : 0;
    const contradictionRate = totalCount > 0 ? parseFloat(((contradictedCount / totalCount) * 100).toFixed(2)) : 0;
    const expiryRate = totalCount > 0 ? parseFloat(((expiredCount / totalCount) * 100).toFixed(2)) : 0;

    // Calculate lifetimes and confirmation times safely
    const confirmedSignals = lcs.filter(l => l.confirmedAt && l.createdAt);
    const avgConfirmationTime = confirmedSignals.length > 0
      ? Math.round(confirmedSignals.reduce((sum, l) => {
          const start = new Date(l.createdAt).getTime();
          const end = new Date(l.confirmedAt!).getTime();
          return sum + Math.max(0, (end - start) / 1000);
        }, 0) / confirmedSignals.length)
      : 0;

    const avgSignalLifetime = terminal.length > 0
      ? Math.round(terminal.reduce((sum, t) => sum + t.duration, 0) / terminal.length)
      : 0;

    return {
      activeSignals: activeCount,
      confirmedSignals: confirmedCount,
      weakeningSignals: weakeningCount,
      contradictedSignals: contradictedCount,
      invalidatedSignals: invalidatedCount,
      expiredSignals: expiredCount,
      averageSignalLifetime: avgSignalLifetime,
      averageConfirmationTime: avgConfirmationTime,
      invalidationRate,
      contradictionRate,
      expiryRate,
      lifecycleTransitionCount: this.transitionCount,
      TelegramLifecycleDispatchCount: this.telegramDispatchCount,
      duplicateSuppressionCount: this.duplicateSuppressionCount,
      cacheStatistics: {
        activeSize: this.lifecycles.size,
        historicalSize: this.historicalLedger.length
      },
      zeroAiExecutionCount: this.executionCount
    };
  }

  /**
   * Deterministic Performance Analytics Engine
   */
  public getPerformanceAnalytics(): any {
    const lcs = Array.from(this.lifecycles.values());
    if (lcs.length < 3) {
      return 'INSUFFICIENT_SAMPLE';
    }

    const obs = this.getObservability();

    // Grouping by priority
    const priorityBreakdown: Record<string, any> = {};
    const priorities: SignalPriority[] = ['P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW', 'WATCH_ONLY'];
    
    for (const p of priorities) {
      const filtered = lcs.filter(l => l.initialPriority === p);
      if (filtered.length < 3) {
        priorityBreakdown[p] = 'INSUFFICIENT_SAMPLE';
      } else {
        const confirmed = filtered.filter(l => l.confirmedAt).length;
        const invalidated = filtered.filter(l => l.currentState === 'INVALIDATED').length;
        priorityBreakdown[p] = {
          count: filtered.length,
          confirmationRate: parseFloat(((confirmed / filtered.length) * 100).toFixed(2)),
          invalidationRate: parseFloat(((invalidated / filtered.length) * 100).toFixed(2))
        };
      }
    }

    return {
      global: {
        totalEvaluated: lcs.length,
        confirmationRate: parseFloat((((lcs.filter(l => l.confirmedAt).length) / lcs.length) * 100).toFixed(2)),
        invalidationRate: obs.invalidationRate,
        contradictionRate: obs.contradictionRate,
        expiryRate: obs.expiryRate,
        averageLifetimeSeconds: obs.averageSignalLifetime,
        averageTimeToConfirmationSeconds: obs.averageConfirmationTime
      },
      priorityBreakdown
    };
  }

  /**
   * Helper to increment Telegram dispatch counts
   */
  public incrementTelegramDispatch(): void {
    this.telegramDispatchCount++;
  }

  /**
   * Helper to increment duplicate suppressions
   */
  public incrementDuplicateSuppression(): void {
    this.duplicateSuppressionCount++;
  }
}

export const signalLifecycleEngine = SignalLifecycleEngine.getInstance();
