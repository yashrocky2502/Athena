/**
 * ATHENA NEWS CORE V2 — PRODUCTION SYNC GUARD
 *
 * Dedicated runtime and environment control for authoritative News Core V2 ingestion and synchronization.
 *
 * Environment Variable: ATHENA_NEWS_CORE_V2_SYNC_ENABLED (default: false)
 * When strictly "true" or "1", authoritative News Core V2 collectors and sync pipeline operate normally.
 * When absent or any other value, News Core V2 sync is cleanly bypassed without affecting read paths.
 * This ensures that in non-production, test, or preview environments, background synchronization is disabled by default.
 *
 * Completely separated from ATHENA_LEGACY_WRITERS_ENABLED (which controls legacy V2/V3/RSS writers).
 */

export class NewsCoreV2SyncGuard {
  private static runtimeOverride: boolean | null = null;

  /**
   * Determines whether authoritative News Core V2 sync is enabled.
   * Defaults to FALSE (disabled) unless explicitly enabled via ATHENA_NEWS_CORE_V2_SYNC_ENABLED=true or "1".
   */
  public static isSyncEnabled(): boolean {
    if (this.runtimeOverride !== null) {
      return this.runtimeOverride;
    }

    const envVal = (process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED || "").trim().toLowerCase();
    if (envVal === "true" || envVal === "1") {
      return true;
    }

    return false;
  }

  /**
   * Overrides sync permission at runtime (for testing and controlled dry-runs).
   */
  public static setSyncEnabled(enabled: boolean | null): void {
    this.runtimeOverride = enabled;
  }

  /**
   * Resets runtime override back to environment variable default.
   */
  public static resetToDefault(): void {
    this.runtimeOverride = null;
  }

  /**
   * Asserts whether a sync operation is allowed.
   */
  public static assertAllowed(operationName: string): boolean {
    const allowed = this.isSyncEnabled();
    if (!allowed) {
      console.log(`[NewsCoreV2SyncGuard] Suppressed sync operation '${operationName}' (ATHENA_NEWS_CORE_V2_SYNC_ENABLED is not explicitly enabled).`);
    }
    return allowed;
  }

  /**
   * Returns diagnostic status object for health checks.
   */
  public static getStatus() {
    return {
      syncEnabled: this.isSyncEnabled(),
      runtimeOverride: this.runtimeOverride,
      envSetting: process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED || "false (default)"
    };
  }
}
