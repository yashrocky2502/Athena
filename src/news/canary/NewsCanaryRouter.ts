/**
 * ATHENA NEWS CORE — CANARY ROUTER & CONTROLLER
 *
 * Implements a controlled, deterministic canary mechanism for routing feed requests
 * between legacy (V2) and modern canonical (V3/V5) pipelines.
 *
 * Environment Variables:
 * - ATHENA_NEWS_CANARY_ENABLED (default: false)
 * - ATHENA_NEWS_CANARY_PERCENTAGE (default: 0)
 *
 * Canary Features:
 * - Explicit Header / Query Override: `x-news-canary: true | false` or `?canary=1|0`
 * - Hash-based deterministic bucketing per IP / Client-ID when percentage > 0
 * - In-flight metrics tracking (total routed, canary routed, control routed)
 */

import crypto from 'crypto';

export interface CanaryStatus {
    enabled: boolean;
    percentage: number;
    totalRequests: number;
    canaryRouted: number;
    controlRouted: number;
    overridesCount: number;
    lastDecision?: 'CANARY' | 'CONTROL';
}

export class NewsCanaryRouter {
    private static instance: NewsCanaryRouter;

    private enabled: boolean = false;
    private percentage: number = 0; // 0 to 100
    private totalRequests: number = 0;
    private canaryRouted: number = 0;
    private controlRouted: number = 0;
    private overridesCount: number = 0;
    private lastDecision?: 'CANARY' | 'CONTROL';

    private constructor() {
        this.enabled = process.env.ATHENA_NEWS_CANARY_ENABLED === 'true';
        const parsedPct = parseInt(process.env.ATHENA_NEWS_CANARY_PERCENTAGE || '0', 10);
        this.percentage = isNaN(parsedPct) ? 0 : Math.max(0, Math.min(100, parsedPct));
    }

    public static getInstance(): NewsCanaryRouter {
        if (!NewsCanaryRouter.instance) {
            NewsCanaryRouter.instance = new NewsCanaryRouter();
        }
        return NewsCanaryRouter.instance;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setPercentage(pct: number): void {
        this.percentage = Math.max(0, Math.min(100, pct));
    }

    public getPercentage(): number {
        return this.percentage;
    }

    /**
     * Determines whether a specific request should be routed to Canary (V3) or Control (V2).
     */
    public shouldRouteToCanary(req: {
        headers?: Record<string, any>;
        query?: Record<string, any>;
        ip?: string;
    }): { useCanary: boolean; reason: string } {
        this.totalRequests++;

        // 1. Explicit Header Override
        const headerVal = req.headers?.['x-news-canary'] || req.headers?.['x-athena-canary'];
        if (headerVal === 'true' || headerVal === '1') {
            this.canaryRouted++;
            this.overridesCount++;
            this.lastDecision = 'CANARY';
            return { useCanary: true, reason: 'HEADER_OVERRIDE_CANARY' };
        }
        if (headerVal === 'false' || headerVal === '0') {
            this.controlRouted++;
            this.overridesCount++;
            this.lastDecision = 'CONTROL';
            return { useCanary: false, reason: 'HEADER_OVERRIDE_CONTROL' };
        }

        // 2. Explicit Query Override
        const queryVal = req.query?.['canary'] || req.query?.['v3'];
        if (queryVal === 'true' || queryVal === '1') {
            this.canaryRouted++;
            this.overridesCount++;
            this.lastDecision = 'CANARY';
            return { useCanary: true, reason: 'QUERY_OVERRIDE_CANARY' };
        }
        if (queryVal === 'false' || queryVal === '0') {
            this.controlRouted++;
            this.overridesCount++;
            this.lastDecision = 'CONTROL';
            return { useCanary: false, reason: 'QUERY_OVERRIDE_CONTROL' };
        }

        // 3. Canary Disabled
        if (!this.enabled || this.percentage <= 0) {
            this.controlRouted++;
            this.lastDecision = 'CONTROL';
            return { useCanary: false, reason: 'CANARY_DISABLED' };
        }

        // 4. Deterministic Hash Bucketing (0-99)
        const clientIdentifier = req.headers?.['x-client-id'] || 
                                 req.headers?.['user-agent'] || 
                                 req.ip || 
                                 'anonymous_user';
        
        const hash = crypto.createHash('md5').update(clientIdentifier).digest('hex');
        const bucket = parseInt(hash.substring(0, 4), 16) % 100;

        if (bucket < this.percentage) {
            this.canaryRouted++;
            this.lastDecision = 'CANARY';
            return { useCanary: true, reason: `BUCKET_${bucket}_LT_${this.percentage}` };
        }

        this.controlRouted++;
        this.lastDecision = 'CONTROL';
        return { useCanary: false, reason: `BUCKET_${bucket}_GTE_${this.percentage}` };
    }

    public getStatus(): CanaryStatus {
        return {
            enabled: this.enabled,
            percentage: this.percentage,
            totalRequests: this.totalRequests,
            canaryRouted: this.canaryRouted,
            controlRouted: this.controlRouted,
            overridesCount: this.overridesCount,
            lastDecision: this.lastDecision
        };
    }

    public resetMetrics(): void {
        this.totalRequests = 0;
        this.canaryRouted = 0;
        this.controlRouted = 0;
        this.overridesCount = 0;
        this.lastDecision = undefined;
    }
}

export const newsCanaryRouter = NewsCanaryRouter.getInstance();
