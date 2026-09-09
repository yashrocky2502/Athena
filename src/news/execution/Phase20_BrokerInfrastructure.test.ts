/**
 * ATHENA NEWS ENGINE — PHASE 20
 * Phase20_BrokerInfrastructure.test.ts
 * 
 * Comprehensive Test Suite for Phase 20:
 * Production Broker Infrastructure, Secure Credential Boundary,
 * Live Market Connectivity & Deterministic Position Reconciliation.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Credential Boundary
import { CredentialSanitizer } from '../credentials/CredentialSanitizer.ts';
import { EnvironmentCredentialProvider } from '../credentials/EnvironmentCredentialProvider.ts';
import { EncryptedCredentialProvider } from '../credentials/EncryptedCredentialProvider.ts';
import { PaperCredentialProvider } from '../credentials/PaperCredentialProvider.ts';
import { credentialManager } from '../credentials/CredentialManager.ts';

// Broker Adapters
import { PaperExecutionAdapter } from './PaperExecutionAdapter.ts';
import { ZerodhaKiteExecutionAdapter } from './ZerodhaKiteExecutionAdapter.ts';
import { BinanceExecutionAdapter } from './BinanceExecutionAdapter.ts';
import { executionAdapterFactory } from './ExecutionAdapterFactory.ts';

// Execution Mode & Multi-Gate Controller
import { executionModeController } from './ExecutionModeController.ts';
import { liveExecutionGateController } from './LiveExecutionGateController.ts';
import { executionKillSwitch } from './ExecutionKillSwitch.ts';

// Market Data Quality
import { marketDataQualityEngine } from '../marketdata/MarketDataQualityEngine.ts';
import { PaperMarketDataAdapter } from '../marketdata/MarketDataAdapters.ts';

// Reconciliation Engines
import { positionReconciliationEngine } from './PositionReconciliationEngine.ts';
import { orderReconciliationEngine } from './OrderReconciliationEngine.ts';
import { fillReconciliationEngine } from './FillReconciliationEngine.ts';
import { brokerRateLimiter } from './BrokerRateLimiter.ts';

// AI Boundary
import { executionAIBoundary } from './ExecutionAIBoundary.ts';

// Types
import { ExecutionOrder, ExecutionIntent, ExecutionValidationResult, ExecutionRiskGateResult } from './types.ts';
import { RawPortfolioPosition } from '../portfolio/types.ts';
import { BrokerPosition } from './BrokerExecutionAdapter.ts';

describe('ATHENA Phase 20 — Production Broker Infrastructure & Security Suite', () => {

  beforeEach(() => {
    executionKillSwitch.reset();
    executionModeController.setMode('PAPER');
    marketDataQualityEngine.setFeedConnected(true);
  });

  // ==========================================
  // SECTION 1: CREDENTIAL BOUNDARY & SANITIZER
  // ==========================================
  describe('20.4 Credential Boundary & Sanitizer', () => {
    it('redacts registered secret tokens and sensitive keys from objects recursively', () => {
      const secret = 'super_secret_kite_token_xyz987';
      CredentialSanitizer.registerSecret(secret);

      const sensitivePayload = {
        user: 'trader1',
        apiKey: 'zerodha_key_123',
        secretToken: secret,
        nested: {
          accessToken: 'token_abc456',
          rawLog: `Connecting with token: ${secret}`
        }
      };

      const sanitized = CredentialSanitizer.sanitizeObject(sensitivePayload);

      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.secretToken).toBe('[REDACTED]');
      expect(sanitized.nested.accessToken).toBe('[REDACTED]');
      expect(sanitized.nested.rawLog).not.toContain(secret);
      expect(sanitized.nested.rawLog).toContain('[REDACTED_SECRET]');
    });

    it('generates masked identifiers without exposing raw keys', () => {
      const masked = CredentialSanitizer.maskIdentifier('abcdefghijklmnop1234');
      expect(masked).toBe('abcd...1234');
      expect(masked).not.toBe('abcdefghijklmnop1234');
    });

    it('manages encrypted credential vault storage and retrieval', async () => {
      const vault = new EncryptedCredentialProvider('master_athena_vault_key');
      await vault.setCredentials('ZERODHA', {
        apiKey: 'kite_key_prod',
        apiSecret: 'kite_secret_prod',
        accessToken: 'kite_access_token_prod'
      });

      const descriptor = await vault.getDescriptor('ZERODHA');
      expect(descriptor.status).toBe('CONNECTED');
      expect(descriptor.hasApiKey).toBe(true);
      expect(descriptor.hasAccessToken).toBe(true);
      expect(descriptor.maskedIdentifier).toBe('ZERODHA_kite...prod');

      const raw = await vault.getRawCredentials<any>('ZERODHA');
      expect(raw?.apiKey).toBe('kite_key_prod');
    });

    it('CredentialManager exposes sanitized descriptors for UI without leaking raw keys', async () => {
      const descriptors = await credentialManager.getAllDescriptors();
      expect(descriptors.length).toBeGreaterThanOrEqual(3);
      for (const d of descriptors) {
        expect(d).toHaveProperty('broker');
        expect(d).toHaveProperty('status');
        expect(d).toHaveProperty('hasApiKey');
        expect(d).not.toHaveProperty('apiKey');
        expect(d).not.toHaveProperty('apiSecret');
      }
    });
  });

  // ==========================================
  // SECTION 2: BROKER EXECUTION ADAPTERS
  // ==========================================
  describe('20.1 - 20.3 Broker Execution Adapters', () => {
    it('PaperExecutionAdapter executes simulated orders with slippage, fills, and trade book', async () => {
      const adapter = new PaperExecutionAdapter();
      await adapter.connect();

      const health = await adapter.healthCheck();
      expect(health.status).toBe('HEALTHY');
      expect(health.authenticated).toBe(true);

      const order: ExecutionOrder = {
        planId: 'plan-test-1',
        legId: 'leg-test-1',
        intentId: 'intent-test-1',
        underlyingSymbol: 'INFY',
        exchange: 'NSE',
        orderId: `ord-test-${Date.now()}`,
        clientOrderId: `client-${Date.now()}`,
        symbol: 'INFY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 100,
        limitPrice: 1860,
        timeInForce: 'DAY',
        status: 'CREATED',
        filledQuantity: 0,
        remainingQuantity: 100,
        avgFillPrice: 0,
        slippageINR: 0,
        slippagePct: 0,
        implementationShortfallINR: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const filled = await adapter.placeOrder(order);
      expect(filled.status).toBe('FILLED');
      expect(filled.filledQuantity).toBe(100);
      expect(filled.remainingQuantity).toBe(0);
      expect(filled.avgFillPrice).toBeGreaterThan(0);
      expect(filled.slippageINR).toBeGreaterThanOrEqual(0);

      const fills = await adapter.getTradeBook();
      expect(fills.length).toBeGreaterThan(0);
      expect(fills[0].symbol).toBe('INFY');

      const positions = await adapter.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0].symbol).toBe('INFY');
      expect(positions[0].quantity).toBe(100);
      expect(positions[0].side).toBe('LONG');
    });

    it('ZerodhaKiteExecutionAdapter blocks live order submission when mode is not LIVE', async () => {
      const adapter = new ZerodhaKiteExecutionAdapter('READ_ONLY');
      await adapter.connect();

      const order: ExecutionOrder = {
        planId: 'plan-test-1',
        legId: 'leg-test-1',
        intentId: 'intent-test-1',
        underlyingSymbol: 'RELIANCE',
        exchange: 'NSE',
        orderId: `ord-kite-${Date.now()}`,
        clientOrderId: `client-${Date.now()}`,
        symbol: 'RELIANCE',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 50,
        limitPrice: 3000,
        timeInForce: 'DAY',
        status: 'CREATED',
        filledQuantity: 0,
        remainingQuantity: 50,
        avgFillPrice: 0,
        slippageINR: 0,
        slippagePct: 0,
        implementationShortfallINR: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await expect(adapter.placeOrder(order)).rejects.toThrow('SECURITY VIOLATION');
    });

    it('BinanceExecutionAdapter throws explicit NOT_SUPPORTED for order modification', async () => {
      const adapter = new BinanceExecutionAdapter('LIVE');
      await expect(adapter.modifyOrder('binance-123', 10, 65000)).rejects.toThrow('NOT_SUPPORTED');
    });
  });

  // ==========================================
  // SECTION 3: EXECUTION MODE CONTROL PLANE
  // ==========================================
  describe('20.5 Execution Mode Control Plane', () => {
    it('defaults to PAPER mode and routes to PaperExecutionAdapter', () => {
      expect(executionModeController.getMode()).toBe('PAPER');
      const adapter = executionAdapterFactory.getAdapter();
      expect(adapter.broker).toBe('PAPER');
    });

    it('allows clean transition to SANDBOX mode', async () => {
      const res = await executionModeController.setMode('SANDBOX', 'ZERODHA');
      expect(res.success).toBe(true);
      expect(executionModeController.getMode()).toBe('SANDBOX');
    });

    it('blocks LIVE mode transition if admin passphrase is missing or incorrect', async () => {
      const res = await executionModeController.setMode('LIVE', 'ZERODHA', 'wrong_passphrase');
      expect(res.success).toBe(false);
      expect(res.reason).toContain('EXECUTION_BLOCKED');
      expect(executionModeController.getMode()).not.toBe('LIVE');
    });

    it('fails closed when prerequisites are missing (never silently downgrades)', async () => {
      marketDataQualityEngine.setFeedConnected(false); // break market feed prerequisite
      const res = await executionModeController.setMode('LIVE', 'ZERODHA', 'ATHENA_AUTHORIZE_LIVE_EXECUTION_2026');
      expect(res.success).toBe(false);
      expect(res.reason).toContain('EXECUTION_BLOCKED');
      expect(executionModeController.getMode()).not.toBe('LIVE');
    });
  });

  // ==========================================
  // SECTION 4: 12-GATE MULTI-GATE AUTHORIZATION
  // ==========================================
  describe('20.6 Live Execution Multi-Gate Authorizer', () => {
    const mockOrder: ExecutionOrder = {
      planId: 'plan-test-1',
      legId: 'leg-test-1',
      intentId: 'intent-test-1',
      underlyingSymbol: 'INFY',
      exchange: 'NSE',
      orderId: 'ord-gate-1',
      clientOrderId: 'client-1',
      symbol: 'INFY',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 100,
      limitPrice: 1860,
      timeInForce: 'DAY',
      status: 'CREATED',
      filledQuantity: 0,
      remainingQuantity: 100,
      avgFillPrice: 0,
      slippageINR: 0,
      slippagePct: 0,
      implementationShortfallINR: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockIntent: ExecutionIntent = {
      schemaVersion: 'v14_execution_intelligence',
      executionId: 'exec-1',
      strategyId: 'strat-1',
      portfolioDecisionId: 'dec-1',
      symbol: 'INFY',
      underlyingSymbol: 'INFY',
      instrument: 'INFY',
      assetClass: 'EQUITY',
      side: 'BUY',
      quantity: 100,
      targetPrice: 1860,
      orderType: 'LIMIT',
      timeInForce: 'DAY',
      entryRationale: 'Momentum breakout',
      sourceSignalId: 'sig-1',
      riskGateStatus: 'APPROVED',
      portfolioGateStatus: 'APPROVED',
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      confidenceScore: 0.92,
      executionPriority: 'HIGH',
      mode: 'LIVE'
    };

    it('blocks order when execution mode is PAPER (Gate 1 failure)', async () => {
      await executionModeController.setMode('PAPER');
      const result = await liveExecutionGateController.evaluateLiveGates(mockOrder, mockIntent, 'ZERODHA');
      expect(result.decision).toBe('ORDER_BLOCKED');
      expect(result.gateResults.gate1_ModeIsLive).toBe('FAIL');
      expect(result.failureReasons[0]).toContain('GATE_1_FAIL');
    });

    it('blocks order when market data is stale or disconnected (Gate 4 failure)', async () => {
      marketDataQualityEngine.setFeedConnected(false);
      const result = await liveExecutionGateController.evaluateLiveGates(mockOrder, mockIntent, 'ZERODHA');
      expect(result.decision).toBe('ORDER_BLOCKED');
      expect(result.gateResults.gate4_MarketDataHealthy).toBe('FAIL');
    });

    it('blocks order when critical factual contradiction is detected (Gate 7 failure)', async () => {
      const result = await liveExecutionGateController.evaluateLiveGates(
        mockOrder, mockIntent, 'ZERODHA', undefined, true, 'CRITICAL'
      );
      expect(result.decision).toBe('ORDER_BLOCKED');
      expect(result.gateResults.gate7_NoCriticalContradiction).toBe('FAIL');
    });

    it('blocks order when ExecutionKillSwitch is active (Gate 10 failure)', async () => {
      executionKillSwitch.activateGlobalKillSwitch('Emergency Drill', 'TEST');
      const result = await liveExecutionGateController.evaluateLiveGates(mockOrder, mockIntent, 'ZERODHA');
      expect(result.decision).toBe('ORDER_BLOCKED');
      expect(result.gateResults.gate10_KillSwitchOff).toBe('FAIL');
    });

    it('blocks order when quantity or price is zero/invalid (Gate 11 failure)', async () => {
      const invalidOrder = { ...mockOrder, quantity: 0, limitPrice: -10 };
      const result = await liveExecutionGateController.evaluateLiveGates(invalidOrder, mockIntent, 'ZERODHA');
      expect(result.decision).toBe('ORDER_BLOCKED');
      expect(result.gateResults.gate11_OrderParamsValid).toBe('FAIL');
    });
  });

  // ==========================================
  // SECTION 5: MARKET DATA QUALITY ENGINE
  // ==========================================
  describe('20.8 Market Data Quality Engine', () => {
    it('evaluates healthy market ticks accurately', () => {
      const now = Date.now();
      marketDataQualityEngine.recordTick({
        type: 'TICK',
        symbol: 'TCS',
        exchange: 'NSE',
        source: 'DIRECT',
        lastPrice: 4200,
        volume: 50000,
        timestamp: new Date(now).toISOString()
      });

      const report = marketDataQualityEngine.evaluateQuality('TCS', now + 100);
      expect(report.status).toBe('DATA_HEALTHY');
      expect(report.isStale).toBe(false);
      expect(marketDataQualityEngine.isExecutionPermitted('TCS', now + 100)).toBe(true);
    });

    it('detects stale ticks exceeding staleness threshold', () => {
      const pastTime = Date.now() - 10000; // 10s ago
      marketDataQualityEngine.recordTick({
        type: 'TICK',
        symbol: 'INFY',
        exchange: 'NSE',
        source: 'DIRECT',
        lastPrice: 1860,
        volume: 20000,
        timestamp: new Date(pastTime).toISOString()
      });

      const report = marketDataQualityEngine.evaluateQuality('INFY', Date.now());
      expect(report.status).toBe('DATA_STALE');
      expect(report.isStale).toBe(true);
      expect(marketDataQualityEngine.isExecutionPermitted('INFY', Date.now())).toBe(false);
    });

    it('detects price discontinuity spike > 15%', () => {
      const now = Date.now();
      marketDataQualityEngine.recordTick({
        type: 'TICK',
        symbol: 'RELIANCE',
        exchange: 'NSE',
        source: 'DIRECT',
        lastPrice: 3000,
        volume: 10000,
        timestamp: new Date(now).toISOString()
      });

      marketDataQualityEngine.recordTick({
        type: 'TICK',
        symbol: 'RELIANCE',
        exchange: 'NSE',
        source: 'DIRECT',
        lastPrice: 3600, // 20% jump
        volume: 12000,
        timestamp: new Date(now + 200).toISOString()
      });

      const report = marketDataQualityEngine.evaluateQuality('RELIANCE', now + 250);
      expect(report.hasPriceDiscontinuity).toBe(true);
      expect(report.status).toBe('DATA_DEGRADED');
    });
  });

  // ==========================================
  // SECTION 6: POSITION, ORDER & FILL RECONCILIATION
  // ==========================================
  describe('20.9 - 20.11 Position, Order & Fill Reconciliation', () => {
    it('reconciles perfectly matched positions as MATCHED', () => {
      const athenaPositions: RawPortfolioPosition[] = [{
        symbol: 'INFY',
        quantity: 100,
        entryPrice: 1860,
        currentPrice: 1860,
        marketValue: 186000,
        unrealizedPnL: 0,
        realizedPnL: 0,
        allocationPct: 10,
        sector: 'IT',
        assetClass: 'EQUITY'
      } as any];

      const brokerPositions: BrokerPosition[] = [{
        symbol: 'INFY',
        quantity: 100,
        averagePrice: 1860,
        currentPrice: 1860,
        unrealizedPnLINR: 0,
        realizedPnLINR: 0,
        side: 'LONG',
        assetClass: 'EQUITY'
      }];

      const report = positionReconciliationEngine.reconcilePositions(athenaPositions, brokerPositions);
      expect(report.overallClassification).toBe('MATCHED');
      expect(report.isExecutionBlocked).toBe(false);
    });

    it('classifies unexpected positions in broker as CRITICAL_MISMATCH and blocks execution', () => {
      const athenaPositions: RawPortfolioPosition[] = [];
      const brokerPositions: BrokerPosition[] = [{
        symbol: 'UNKNOWN_RISK',
        quantity: 500,
        averagePrice: 250,
        currentPrice: 250,
        unrealizedPnLINR: 0,
        side: 'LONG',
        assetClass: 'EQUITY'
      }];

      const report = positionReconciliationEngine.reconcilePositions(athenaPositions, brokerPositions);
      expect(report.overallClassification).toBe('CRITICAL_MISMATCH');
      expect(report.isExecutionBlocked).toBe(true);
      expect(positionReconciliationEngine.hasActiveCriticalMismatch()).toBe(true);
    });

    it('OrderReconciliationEngine is idempotent and suppresses repeated responses', () => {
      const ord: ExecutionOrder = {
        planId: 'plan-test-1',
        legId: 'leg-test-1',
        intentId: 'intent-test-1',
        underlyingSymbol: 'INFY',
        exchange: 'NSE',
        orderId: 'ord-rec-1',
        clientOrderId: 'client-rec-1',
        symbol: 'INFY',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 50,
        limitPrice: 1860,
        timeInForce: 'DAY',
        status: 'SUBMITTED',
        filledQuantity: 0,
        remainingQuantity: 50,
        avgFillPrice: 0,
        slippageINR: 0,
        slippagePct: 0,
        implementationShortfallINR: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      orderReconciliationEngine.registerOrder(ord);

      const firstRec = orderReconciliationEngine.reconcileOrder('ord-rec-1', {
        brokerOrderId: 'broker-ord-1',
        symbol: 'INFY',
        side: 'BUY',
        status: 'FILLED',
        requestedQuantity: 50,
        filledQuantity: 50,
        remainingQuantity: 0,
        avgFillPrice: 1860,
        limitPrice: 1860,
        timestamp: new Date().toISOString()
      });

      expect(firstRec.isSynchronized).toBe(true);
      expect(firstRec.isDuplicateResponse).toBe(false);
      expect(firstRec.newFillsGenerated.length).toBe(1);

      // Repeated identical response
      const secondRec = orderReconciliationEngine.reconcileOrder('ord-rec-1', {
        brokerOrderId: 'broker-ord-1',
        symbol: 'INFY',
        side: 'BUY',
        status: 'FILLED',
        requestedQuantity: 50,
        filledQuantity: 50,
        remainingQuantity: 0,
        avgFillPrice: 1860,
        limitPrice: 1860,
        timestamp: new Date().toISOString()
      });

      expect(secondRec.isDuplicateResponse).toBe(true);
      expect(secondRec.newFillsGenerated.length).toBe(0); // zero duplicate fills!
    });

    it('FillReconciliationEngine enforces quantity > 0, price > 0, and non-future timestamps', () => {
      const badQty = fillReconciliationEngine.createFill({
        fillId: 'fill-bad-qty',
        orderId: 'ord-1',
        brokerOrderId: 'brok-1',
        symbol: 'INFY',
        side: 'BUY',
        quantity: -10,
        price: 1860,
        timestamp: new Date().toISOString(),
        commission: 20,
        exchange: 'NSE',
        executionMode: 'PAPER'
      });
      expect(badQty.success).toBe(false);
      expect(badQty.errorReason).toContain('INVALID_QUANTITY');

      const futureTime = new Date(Date.now() + 10000000).toISOString();
      const badTime = fillReconciliationEngine.createFill({
        fillId: 'fill-bad-time',
        orderId: 'ord-1',
        brokerOrderId: 'brok-1',
        symbol: 'INFY',
        side: 'BUY',
        quantity: 10,
        price: 1860,
        timestamp: futureTime,
        commission: 20,
        exchange: 'NSE',
        executionMode: 'PAPER'
      });
      expect(badTime.success).toBe(false);
      expect(badTime.errorReason).toContain('IMPOSSIBLE_FUTURE_TIMESTAMP');
    });
  });

  // ==========================================
  // SECTION 7: AI BOUNDARY SECURITY TESTS
  // ==========================================
  describe('20.23 AI Boundary Security Suite', () => {
    it('throws AI_EXECUTION_BYPASS_BLOCKED when AI attempts to directly place/modify trades', () => {
      expect(() => {
        executionAIBoundary.verifyAIBoundaryPass(undefined, undefined, undefined, true);
      }).toThrow('AI_EXECUTION_BYPASS_BLOCKED');
    });

    it('throws AI_EXECUTION_BYPASS_BLOCKED if PreTradeValidation is invalid or hard rejected', () => {
      const failedValidation: ExecutionValidationResult = {
        isValid: false,
        hardRejection: true,
        rejectionReasons: ['Exceeded position limit'],
        warnings: [],
        validatedAt: new Date().toISOString(),
        quoteTimestampAgeMs: 200,
        marketSessionValid: true
      };

      expect(() => {
        executionAIBoundary.verifyAIBoundaryPass(undefined, failedValidation, undefined, false);
      }).toThrow('AI_EXECUTION_BYPASS_BLOCKED');
    });
  });

  // ==========================================
  // SECTION 8: BROKER RATE LIMITER & RETRY
  // ==========================================
  describe('20.14 Broker Rate Limiter & Retry Policy', () => {
    it('allows idempotent safe operations with retries but blocks unsafe operations', async () => {
      let attempts = 0;
      const result = await brokerRateLimiter.executeSafeWithRetry('ZERODHA', 'getQuote', async () => {
        attempts++;
        if (attempts < 2) throw new Error('Transient network glitch');
        return { ltp: 1860 };
      });

      expect(result.ltp).toBe(1860);
      expect(attempts).toBe(2);

      // Attempting to retry placeOrder must throw UNSAFE_RETRY_BLOCKED
      await expect(
        brokerRateLimiter.executeSafeWithRetry('ZERODHA', 'placeOrder', async () => ({}))
      ).rejects.toThrow('UNSAFE_RETRY_BLOCKED');
    });
  });
});
