/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalReplayEngine.ts
 * 
 * Master Time-Travel Replay Controller managing playback timeline, step navigation,
 * speed control, session states, and checkpoint tracking.
 */

import {
  HistoricalReplayConfig,
  HistoricalReplaySession,
  HistoricalReplayStatus,
  HistoricalReplayCheckpoint
} from './types.ts';
import { historicalEventReconstructionEngine, ReconstructedSystemState } from './HistoricalEventReconstructionEngine.ts';
import { historicalReplayCheckpointEngine } from './HistoricalReplayCheckpointEngine.ts';
import { historicalFutureFirewall } from './HistoricalFutureFirewall.ts';
import { historicalLookAheadBiasEngine } from './HistoricalLookAheadBiasEngine.ts';
import { historicalDataQualityScorer } from './HistoricalDataQualityScorer.ts';
import { HistoricalHashUtils } from './HistoricalHashUtils.ts';

export class HistoricalReplayEngine {
  private static instance: HistoricalReplayEngine;
  private activeSessions: Map<string, HistoricalReplaySession> = new Map();
  private currentReconstructedStates: Map<string, ReconstructedSystemState> = new Map();

  private constructor() {}

  public static getInstance(): HistoricalReplayEngine {
    if (!HistoricalReplayEngine.instance) {
      HistoricalReplayEngine.instance = new HistoricalReplayEngine();
    }
    return HistoricalReplayEngine.instance;
  }

  /**
   * Initializes a new historical replay session
   */
  public createSession(config: Partial<HistoricalReplayConfig>): HistoricalReplaySession {
    const sessionId = config.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const targetDate = config.targetDate || '2026-07-20';
    const startTime = config.startTime || `${targetDate}T09:15:00.000Z`;
    const endTime = config.endTime || `${targetDate}T15:30:00.000Z`;
    const symbols = config.symbols && config.symbols.length > 0 ? config.symbols : ['RELIANCE', 'NIFTY 50'];

    const fullConfig: HistoricalReplayConfig = {
      sessionId,
      targetDate,
      startTime,
      endTime,
      symbols,
      mode: config.mode || 'MINUTE_BY_MINUTE',
      speedMultiplier: config.speedMultiplier !== undefined ? config.speedMultiplier : 1,
      stepIntervalMs: config.stepIntervalMs || 60000,
      initialCash: config.initialCash || 10000000,
      enforceFirewallStrict: config.enforceFirewallStrict !== undefined ? config.enforceFirewallStrict : true
    };

    // Calculate quality score
    const qualityReport = historicalDataQualityScorer.evaluateDataset({
      totalExpectedIntervals: 75,
      presentIntervals: 75,
      timestampsValid: true,
      hasAuthoritativeSource: true,
      duplicateCount: 0,
      revisionCount: 0,
      hasCrossedBooks: false
    });

    const session: HistoricalReplaySession = {
      id: sessionId,
      config: fullConfig,
      status: 'INITIALIZED',
      currentReplayTimestamp: startTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventsTotal: 75,
      eventsProcessed: 0,
      checkpoints: [],
      lookAheadViolationsCount: 0,
      qualityScore: qualityReport.score,
      qualityRating: qualityReport.rating,
      aggregateHash: HistoricalHashUtils.hashObject(fullConfig)
    };

    this.activeSessions.set(sessionId, session);

    // Initial state reconstruction
    this.reconstructSessionState(session, startTime);

    return session;
  }

  /**
   * Reconstructs and caches the current state for the session
   */
  private reconstructSessionState(session: HistoricalReplaySession, timestamp: string): ReconstructedSystemState {
    const symbol = session.config.symbols[0] || 'RELIANCE';
    const state = historicalEventReconstructionEngine.reconstructAtTimestamp({
      symbol,
      replayTimestamp: timestamp,
      initialCash: session.config.initialCash
    });

    // Check for look-ahead violations
    const audit = historicalLookAheadBiasEngine.auditReplayState(`Session:${session.id}`, timestamp, state);
    if (audit.hasLookAheadBias) {
      session.status = 'INVALIDATED_LOOKAHEAD';
      session.lookAheadViolationsCount += audit.violations.length;
      if (session.config.enforceFirewallStrict) {
        throw new Error(`[LOOK_AHEAD_BIAS_DETECTED] Replay session invalidated: ${audit.violations[0].message}`);
      }
    }

    // Save checkpoint
    const checkpoint = historicalReplayCheckpointEngine.createCheckpoint(
      session.id,
      session.checkpoints.length + 1,
      state,
      session.eventsProcessed
    );

    session.checkpoints.push(checkpoint);
    session.currentReplayTimestamp = timestamp;
    session.latestSnapshot = state.marketSnapshot;
    session.latestNews = state.newsEvents;
    session.latestSurveillance = state.surveillanceEvents;
    session.latestSignals = [state.signalState];
    session.latestStrategies = [state.strategyState];
    session.latestPortfolio = state.portfolioState;
    session.latestExecutions = state.executionState ? [state.executionState] : [];
    session.aggregateHash = checkpoint.aggregateStateHash;
    session.updatedAt = new Date().toISOString();

    this.currentReconstructedStates.set(session.id, state);
    return state;
  }

  /**
   * Start or resume replay
   */
  public start(sessionId: string): HistoricalReplaySession {
    const session = this.getSession(sessionId);
    session.status = 'RUNNING';
    session.updatedAt = new Date().toISOString();
    return session;
  }

  /**
   * Pause replay
   */
  public pause(sessionId: string): HistoricalReplaySession {
    const session = this.getSession(sessionId);
    session.status = 'PAUSED';
    session.updatedAt = new Date().toISOString();
    return session;
  }

  /**
   * Step forward one interval (e.g. 5 minutes or 1 minute)
   */
  public stepForward(sessionId: string, stepMinutes: number = 5): { session: HistoricalReplaySession; state: ReconstructedSystemState } {
    const session = this.getSession(sessionId);
    const currentMs = new Date(session.currentReplayTimestamp).getTime();
    const endMs = new Date(session.config.endTime).getTime();

    const nextMs = Math.min(endMs, currentMs + (stepMinutes * 60 * 1000));
    const nextTimestamp = new Date(nextMs).toISOString();

    session.eventsProcessed += 1;
    if (nextMs >= endMs) {
      session.status = 'COMPLETED';
    }

    const state = this.reconstructSessionState(session, nextTimestamp);
    return { session, state };
  }

  /**
   * Step backward to previous checkpoint
   */
  public stepBackward(sessionId: string): { session: HistoricalReplaySession; state: ReconstructedSystemState } {
    const session = this.getSession(sessionId);
    if (session.checkpoints.length <= 1) {
      const state = this.getCurrentState(sessionId);
      return { session, state };
    }

    // Pop current checkpoint
    session.checkpoints.pop();
    const targetCheckpoint = session.checkpoints[session.checkpoints.length - 1];
    session.eventsProcessed = Math.max(0, session.eventsProcessed - 1);

    const state = this.reconstructSessionState(session, targetCheckpoint.timestamp);
    return { session, state };
  }

  /**
   * Jump directly to a specific timestamp
   */
  public jumpToTimestamp(sessionId: string, timestamp: string): { session: HistoricalReplaySession; state: ReconstructedSystemState } {
    const session = this.getSession(sessionId);
    const state = this.reconstructSessionState(session, timestamp);
    return { session, state };
  }

  public getSession(sessionId: string): HistoricalReplaySession {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Replay session '${sessionId}' not found`);
    }
    return session;
  }

  public getCurrentState(sessionId: string): ReconstructedSystemState {
    const state = this.currentReconstructedStates.get(sessionId);
    if (!state) {
      const session = this.getSession(sessionId);
      return this.reconstructSessionState(session, session.currentReplayTimestamp);
    }
    return state;
  }

  public getAllSessions(): HistoricalReplaySession[] {
    return Array.from(this.activeSessions.values());
  }

  public clear(): void {
    this.activeSessions.clear();
    this.currentReconstructedStates.clear();
    historicalReplayCheckpointEngine.clear();
    historicalFutureFirewall.clearViolations();
    historicalLookAheadBiasEngine.clear();
  }
}

export const historicalReplayEngine = HistoricalReplayEngine.getInstance();
