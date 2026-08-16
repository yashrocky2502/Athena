/**
 * ATHENA NEWS CORE — LEGACY WRITER ISOLATION GUARD
 *
 * Provides central, runtime-controllable gating for all legacy news writers
 * (such as V2 NewsSyncService, legacy server V3 scheduler, and legacy reclassification routines).
 *
 * Environment Variable: ATHENA_LEGACY_WRITERS_ENABLED (default: true)
 * When false, all legacy storage writes, background ingestion loops, and manual sync endpoints
 * are cleanly skipped while leaving read paths, memory hydration, and the canonical V3/V5 pipeline 100% operational.
 */

export class LegacyWriterGuard {
    private static runtimeOverride: boolean | null = null;

    /**
     * Determines whether legacy news writers are currently permitted to execute.
     * Defaults to TRUE to preserve existing behavior until explicitly disabled.
     */
    public static isLegacyWritersEnabled(): boolean {
        if (this.runtimeOverride !== null) {
            return this.runtimeOverride;
        }

        const envVal = process.env.ATHENA_LEGACY_WRITERS_ENABLED;
        if (envVal === 'false' || envVal === '0') {
            return false;
        }

        return true;
    }

    /**
     * Overrides legacy writer permission at runtime (primarily for testing and controlled dry-runs).
     */
    public static setLegacyWritersEnabled(enabled: boolean | null): void {
        this.runtimeOverride = enabled;
        console.log(`[LegacyWriterGuard] Legacy writers runtime override set to: ${enabled === null ? 'DEFAULT (env)' : enabled}`);
    }

    /**
     * Resets runtime override back to environment variable default.
     */
    public static resetToDefault(): void {
        this.runtimeOverride = null;
    }

    /**
     * Asserts whether a legacy writer operation is allowed.
     * Logs a descriptive warning when execution is suppressed.
     */
    public static assertAllowed(operationName: string): boolean {
        const allowed = this.isLegacyWritersEnabled();
        if (!allowed) {
            console.log(`[LegacyWriterGuard] Suppressed legacy write operation '${operationName}' (ATHENA_LEGACY_WRITERS_ENABLED=false).`);
        }
        return allowed;
    }

    /**
     * Returns diagnostic status object for health checks.
     */
    public static getStatus() {
        return {
            legacyWritersEnabled: this.isLegacyWritersEnabled(),
            runtimeOverride: this.runtimeOverride,
            envSetting: process.env.ATHENA_LEGACY_WRITERS_ENABLED || 'true (default)'
        };
    }
}
