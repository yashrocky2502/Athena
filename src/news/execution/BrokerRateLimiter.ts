/**
 * ATHENA NEWS ENGINE — PHASE 20
 * BrokerRateLimiter.ts
 * 
 * Production Broker Rate Limiter & Safe Retry Policy.
 * Protects broker REST/WebSocket endpoints from rate limit violations (429 Too Many Requests).
 * Implements deterministic retry only for idempotent/safe read operations.
 * Strictly avoids auto-duplicating unsafe operations like placeOrder.
 */

export interface RateLimitConfig {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
}

export class BrokerRateLimiter {
  private static instance: BrokerRateLimiter;
  private requestHistory: Map<string, number[]> = new Map();
  
  private brokerConfigs: Map<string, RateLimitConfig> = new Map([
    ['ZERODHA', { maxRequestsPerSecond: 3, maxRequestsPerMinute: 200 }],
    ['BINANCE', { maxRequestsPerSecond: 20, maxRequestsPerMinute: 1200 }],
    ['PAPER', { maxRequestsPerSecond: 1000, maxRequestsPerMinute: 60000 }]
  ]);

  private constructor() {}

  public static getInstance(): BrokerRateLimiter {
    if (!this.instance) {
      this.instance = new BrokerRateLimiter();
    }
    return this.instance;
  }

  /**
   * Checks if an API request is currently permitted under rate limits.
   */
  public checkLimit(broker: string): { allowed: boolean; remainingInMinute: number; waitMs: number } {
    const config = this.brokerConfigs.get(broker) || { maxRequestsPerSecond: 5, maxRequestsPerMinute: 300 };
    const now = Date.now();
    const history = this.requestHistory.get(broker) || [];

    // Filter to last 60 seconds
    const minuteWindow = history.filter(t => now - t < 60000);
    const secondWindow = minuteWindow.filter(t => now - t < 1000);

    if (secondWindow.length >= config.maxRequestsPerSecond) {
      return { allowed: false, remainingInMinute: Math.max(0, config.maxRequestsPerMinute - minuteWindow.length), waitMs: 1000 - (now - secondWindow[0]) };
    }

    if (minuteWindow.length >= config.maxRequestsPerMinute) {
      return { allowed: false, remainingInMinute: 0, waitMs: 60000 - (now - minuteWindow[0]) };
    }

    minuteWindow.push(now);
    this.requestHistory.set(broker, minuteWindow);

    return {
      allowed: true,
      remainingInMinute: config.maxRequestsPerMinute - minuteWindow.length,
      waitMs: 0
    };
  }

  /**
   * Executes an idempotent safe operation with exponential backoff retry.
   */
  public async executeSafeWithRetry<T>(
    broker: string,
    operationName: string,
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    const SAFE_OPERATIONS = ['getOrderStatus', 'getPositions', 'getMargins', 'healthCheck', 'getQuote', 'getMarketDepth', 'getTradeBook'];
    
    if (!SAFE_OPERATIONS.includes(operationName)) {
      throw new Error(`UNSAFE_RETRY_BLOCKED: Operation '${operationName}' is non-idempotent and cannot be automatically retried.`);
    }

    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      try {
        const check = this.checkLimit(broker);
        if (!check.allowed) {
          await new Promise(r => setTimeout(r, check.waitMs));
        }
        return await fn();
      } catch (err: any) {
        if (attempt >= maxRetries) {
          throw err;
        }
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error(`Exceeded max retries for ${operationName}`);
  }
}

export const brokerRateLimiter = BrokerRateLimiter.getInstance();
