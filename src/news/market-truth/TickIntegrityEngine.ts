/**
 * ATHENA — PHASE 22: REAL-TIME MARKET TRUTH LAYER
 * TickIntegrityEngine.ts
 * 
 * Deterministic microstructure integrity and anomaly validation engine.
 * ZERO-AI: Mathematical and rule-based invariants.
 */

import { CanonicalMarketTick, TickValidationStatus } from './types.ts';

export interface IntegrityValidationResult {
  isValid: boolean;
  status: TickValidationStatus;
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
  integrityScore: number; // 0 to 100
}

export class TickIntegrityEngine {
  private static instance: TickIntegrityEngine;

  // Track last known state per instrument for sequence, timestamp, and duplicate tracking
  private lastTicks: Map<string, { timestamp: number; sequenceNumber: number; price: number; volume: number }> = new Map();

  private constructor() {}

  public static getInstance(): TickIntegrityEngine {
    if (!TickIntegrityEngine.instance) {
      TickIntegrityEngine.instance = new TickIntegrityEngine();
    }
    return TickIntegrityEngine.instance;
  }

  public reset(): void {
    this.lastTicks.clear();
  }

  /**
   * Evaluates the integrity of an incoming CanonicalMarketTick.
   */
  public validateTick(tick: CanonicalMarketTick, referenceTimeMs: number = Date.now()): IntegrityValidationResult {
    const reasons: string[] = [];
    let severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'NONE';
    let status: TickValidationStatus = 'VALID';
    let penalty = 0;

    const tickTime = new Date(tick.timestamp).getTime();
    const lastSeen = this.lastTicks.get(tick.instrumentId);

    // 1. Check Invalid / Non-Positive Price
    if (tick.lastPrice <= 0 || isNaN(tick.lastPrice)) {
      reasons.push(`INVALID_PRICE: lastPrice ${tick.lastPrice} is non-positive or NaN`);
      status = 'INVALID_PRICE';
      severity = 'CRITICAL';
      penalty += 100;
    }

    // 2. Impossible Timestamps
    if (isNaN(tickTime)) {
      reasons.push('INVALID_TIMESTAMP: Unparseable timestamp');
      status = 'REJECTED';
      severity = 'CRITICAL';
      penalty += 100;
    } else {
      // Future drift (> 60s ahead of reference)
      if (tickTime > referenceTimeMs + 60000) {
        reasons.push(`IMPOSSIBLE_FUTURE_TIMESTAMP: ${tick.timestamp} is ahead of clock by ${Math.round((tickTime - referenceTimeMs) / 1000)}s`);
        status = 'ANOMALOUS';
        severity = 'HIGH';
        penalty += 50;
      }
      // Out of order timestamps
      if (lastSeen && tickTime < lastSeen.timestamp) {
        reasons.push(`OUT_OF_ORDER_TIMESTAMP: Received ${tickTime} after previously seeing ${lastSeen.timestamp}`);
        status = 'OUT_OF_ORDER';
        severity = 'MEDIUM';
        penalty += 30;
      }
    }

    // 3. Duplicate Detection
    if (lastSeen && lastSeen.sequenceNumber === tick.sequenceNumber && lastSeen.price === tick.lastPrice && lastSeen.volume === (tick.volume || 0)) {
      reasons.push(`DUPLICATE_TICK: Identical sequence ${tick.sequenceNumber}, price ${tick.lastPrice}, volume ${tick.volume}`);
      status = 'DUPLICATE';
      severity = 'LOW';
      penalty += 20;
    }

    // 4. Sequence Gaps
    if (lastSeen && tick.sequenceNumber > lastSeen.sequenceNumber + 1) {
      const gap = tick.sequenceNumber - lastSeen.sequenceNumber - 1;
      reasons.push(`SEQUENCE_GAP: Missed ${gap} sequence ticks (from ${lastSeen.sequenceNumber} to ${tick.sequenceNumber})`);
      if (severity !== 'CRITICAL' && severity !== 'HIGH') {
        severity = 'MEDIUM';
      }
      penalty += 15;
    }

    // 5. Impossible OHLC Relationships
    if (tick.high !== null && tick.low !== null) {
      if (tick.high < tick.low) {
        reasons.push(`INVALID_OHLC: High (${tick.high}) is less than Low (${tick.low})`);
        status = 'INVALID_OHLC';
        severity = 'CRITICAL';
        penalty += 80;
      }
      if (tick.open !== null && (tick.open > tick.high || tick.open < tick.low)) {
        reasons.push(`INVALID_OHLC: Open (${tick.open}) outside High (${tick.high}) / Low (${tick.low}) range`);
        if (severity !== 'CRITICAL') severity = 'HIGH';
        penalty += 40;
      }
      // Check lastPrice drastically exceeding High or Low bounds without OHLC updating
      if (tick.lastPrice > tick.high * 1.02) {
        reasons.push(`OHLC_BREACH: lastPrice (${tick.lastPrice}) exceeds High (${tick.high}) by > 2%`);
        status = 'INVALID_OHLC';
        if (severity !== 'CRITICAL') severity = 'HIGH';
        penalty += 40;
      }
      if (tick.lastPrice < tick.low * 0.98) {
        reasons.push(`OHLC_BREACH: lastPrice (${tick.lastPrice}) below Low (${tick.low}) by > 2%`);
        status = 'INVALID_OHLC';
        if (severity !== 'CRITICAL') severity = 'HIGH';
        penalty += 40;
      }
    }

    // 6. Bid/Ask Relationships & Crossed Markets
    if (tick.bidPrice !== null && tick.askPrice !== null) {
      if (tick.bidPrice < 0 || tick.askPrice < 0) {
        reasons.push(`NEGATIVE_QUOTE: Bid (${tick.bidPrice}) or Ask (${tick.askPrice}) is negative`);
        status = 'INVALID_SPREAD';
        severity = 'HIGH';
        penalty += 50;
      } else if (tick.bidPrice > tick.askPrice) {
        reasons.push(`CROSSED_MARKET: Bid (${tick.bidPrice}) is strictly greater than Ask (${tick.askPrice})`);
        status = 'CROSSED_MARKET';
        severity = 'HIGH';
        penalty += 50;
      } else if (tick.spread !== null && tick.spread < 0) {
        reasons.push(`NEGATIVE_SPREAD: Spread (${tick.spread}) is negative`);
        status = 'INVALID_SPREAD';
        severity = 'HIGH';
        penalty += 40;
      }
    }

    // 7. Negative Quantities
    if ((tick.volume !== null && tick.volume < 0) || 
        (tick.bidQuantity !== null && tick.bidQuantity < 0) || 
        (tick.askQuantity !== null && tick.askQuantity < 0)) {
      reasons.push('NEGATIVE_QUANTITY: Volume or Bid/Ask quantity is negative');
      status = 'REJECTED';
      severity = 'HIGH';
      penalty += 40;
    }

    // Update state memory if not completely invalid timestamp
    if (!isNaN(tickTime)) {
      this.lastTicks.set(tick.instrumentId, {
        timestamp: tickTime,
        sequenceNumber: tick.sequenceNumber,
        price: tick.lastPrice,
        volume: tick.volume || 0
      });
    }

    const integrityScore = Math.max(0, 100 - penalty);
    const isValid = severity === 'NONE' || severity === 'LOW';

    return {
      isValid,
      status,
      severity,
      reasons,
      integrityScore
    };
  }
}

export const tickIntegrityEngine = TickIntegrityEngine.getInstance();
