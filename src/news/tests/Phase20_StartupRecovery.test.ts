/**
 * ATHENA NEWS ENGINE — PHASE 20 STARTUP RECOVERY REGRESSION SUITE
 * Phase20_StartupRecovery.test.ts
 * 
 * Verifies that the application starts up safely and remains accessible under all circumstances,
 * even when production broker credentials are completely absent or external services are offline.
 * Defaults always to PAPER mode and fails closed for LIVE mode.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { executionModeController } from '../execution/ExecutionModeController.ts';
import { executionAdapterFactory } from '../execution/ExecutionAdapterFactory.ts';
import { credentialManager } from '../credentials/CredentialManager.ts';
import { executionKillSwitch } from '../execution/ExecutionKillSwitch.ts';

describe('Phase 20 Startup Recovery & Safety Boundary Regression Suite', () => {

  beforeEach(() => {
    // Reset to safe default state before each test
    executionAdapterFactory.setAdapter('PAPER', 'PAPER');
  });

  it('1. ATHENA MUST OPEN EVEN WHEN PRODUCTION BROKER CREDENTIALS ARE ABSENT', async () => {
    // Verify that attempting to retrieve credentials when they are absent does not throw a fatal error
    const credsZerodha = await credentialManager.getRawCredentials<any>('ZERODHA');
    const credsBinance = await credentialManager.getRawCredentials<any>('BINANCE');
    
    // Credentials may be null or return empty template structures, both represent non-configured states
    const isZerodhaAbsent = !credsZerodha || credsZerodha.apiKey === '';
    const isBinanceAbsent = !credsBinance || credsBinance.apiKey === '';

    expect(isZerodhaAbsent).toBe(true);
    expect(isBinanceAbsent).toBe(true);

    // Verify we can still get the adapter and execute its healthCheck without crashing
    const adapter = executionAdapterFactory.getAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.broker).toBe('PAPER');

    const health = await adapter.healthCheck();
    expect(health.connected).toBe(true);
    expect(health.authenticated).toBe(true);
    expect(health.status).toBe('HEALTHY');
  });

  it('2. Default startup mode must remain: PAPER', () => {
    const currentMode = executionModeController.getMode();
    const activeBroker = executionAdapterFactory.getAdapter().broker;

    expect(currentMode).toBe('PAPER');
    expect(activeBroker).toBe('PAPER');
  });

  it('3. Never fix startup problems by weakening security (Live prerequisite check fails closed)', async () => {
    // Attempting to evaluate LIVE prerequisites must fail closed when explicit dual-confirmation is absent
    const check = await executionModeController.checkLivePrerequisites('ZERODHA');
    
    expect(check.allPassed).toBe(false);
    expect(check.failureReasons.length).toBeGreaterThan(0);
    expect(check.failureReasons).toContain('EXPLICIT_CONFIRMATION_REQUIRED: Admin has not provided explicit dual-confirmation for LIVE mode.');
  });

  it('4. Do NOT terminate the application or crash when optional brokers are evaluated', async () => {
    // Test that the adapter factory can switch or set adapters without crashing even if optional credentials are empty
    expect(() => {
      executionAdapterFactory.setAdapter('ZERODHA', 'READ_ONLY');
    }).not.toThrow();

    const adapter = executionAdapterFactory.getAdapter();
    expect(adapter.broker).toBe('ZERODHA');
    expect(adapter.mode).toBe('READ_ONLY');

    // Test that disconnecting or checking authentication handles empty credentials gracefully without throwing
    const authStatus = adapter.isAuthenticated();
    expect(authStatus).toBe(false);

    const disconnectSuccess = await adapter.disconnect();
    expect(disconnectSuccess).toBe(true);
  });
});
