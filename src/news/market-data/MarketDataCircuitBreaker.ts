export type CircuitBreakerState = 'ACTIVE' | 'DEGRADED' | 'QUARANTINED' | 'DISABLED';

export interface ProviderHealthState {
  providerName: string;
  state: CircuitBreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  lastFailureReason: string | null;
  latencySum: number;
  requestCount: number;
  rateLimitCount: number;
  malformedCount: number;
  currentBackoffMs: number;
  recoveryProbesCount: number;
}

export class MarketDataCircuitBreaker {
  private static registry = new Map<string, ProviderHealthState>();
  private static readonly DEGRADED_THRESHOLD = 2;
  private static readonly QUARANTINE_THRESHOLD = 5;
  private static readonly RECOVERY_SUCCESSES_REQUIRED = 3; // Section 17 gradual recovery
  private static readonly BASE_BACKOFF_MS = 2000;
  private static readonly MAX_BACKOFF_MS = 60000;

  public static getOrCreateState(providerName: string): ProviderHealthState {
    const cleanName = providerName.toUpperCase();
    if (!this.registry.has(cleanName)) {
      this.registry.set(cleanName, {
        providerName: cleanName,
        state: 'ACTIVE',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        lastFailureReason: null,
        latencySum: 0,
        requestCount: 0,
        rateLimitCount: 0,
        malformedCount: 0,
        currentBackoffMs: 0,
        recoveryProbesCount: 0
      });
    }
    return this.registry.get(cleanName)!;
  }

  public static recordSuccess(providerName: string, latencyMs: number): void {
    const state = this.getOrCreateState(providerName);
    state.requestCount++;
    state.latencySum += latencyMs;
    state.lastSuccessTime = Date.now();

    if (state.state === 'QUARANTINED') {
      state.recoveryProbesCount++;
      state.consecutiveSuccesses++;
      
      // Gradually recovery (Section 17)
      if (state.consecutiveSuccesses >= this.RECOVERY_SUCCESSES_REQUIRED) {
        state.state = 'DEGRADED';
        state.consecutiveFailures = 0;
        state.consecutiveSuccesses = 0;
        state.currentBackoffMs = 0;
        state.recoveryProbesCount = 0;
      }
    } else if (state.state === 'DEGRADED') {
      state.consecutiveSuccesses++;
      if (state.consecutiveSuccesses >= 3) {
        state.state = 'ACTIVE';
        state.consecutiveFailures = 0;
        state.consecutiveSuccesses = 0;
      }
    } else {
      state.consecutiveFailures = 0;
      state.consecutiveSuccesses++;
      state.currentBackoffMs = 0;
    }
  }

  public static recordFailure(providerName: string, reason: string, isRateLimit: boolean = false): void {
    const state = this.getOrCreateState(providerName);
    state.requestCount++;
    state.lastFailureTime = Date.now();
    state.lastFailureReason = reason;
    state.consecutiveFailures++;
    state.consecutiveSuccesses = 0;

    if (isRateLimit) {
      state.rateLimitCount++;
    }

    // Exponential Backoff calculations
    if (state.currentBackoffMs === 0) {
      state.currentBackoffMs = this.BASE_BACKOFF_MS;
    } else {
      state.currentBackoffMs = Math.min(state.currentBackoffMs * 2, this.MAX_BACKOFF_MS);
    }

    // State Transitions
    if (state.state === 'ACTIVE' && state.consecutiveFailures >= this.DEGRADED_THRESHOLD) {
      state.state = 'DEGRADED';
    }
    if (state.consecutiveFailures >= this.QUARANTINE_THRESHOLD) {
      state.state = 'QUARANTINED';
    }
  }

  public static recordMalformed(providerName: string): void {
    const state = this.getOrCreateState(providerName);
    state.malformedCount++;
    this.recordFailure(providerName, 'INVALID_PROVIDER_PAYLOAD');
  }

  public static isAllowedToCall(providerName: string): boolean {
    const state = this.getOrCreateState(providerName);
    if (state.state === 'DISABLED') return false;
    if (state.state === 'QUARANTINED') {
      // In quarantine, allow calls only if backoff duration has expired (controlled recovery probe)
      if (state.lastFailureTime) {
        const elapsed = Date.now() - state.lastFailureTime;
        return elapsed >= state.currentBackoffMs;
      }
    }
    return true;
  }

  public static getAllStatuses(): ProviderHealthState[] {
    return Array.from(this.registry.values());
  }

  public static clear(): void {
    this.registry.clear();
  }
}
export default MarketDataCircuitBreaker;
