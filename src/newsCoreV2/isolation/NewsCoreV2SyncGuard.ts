/**
 * ATHENA NEWS CORE V2 — PRODUCTION SYNC GUARD
 *
 * Dedicated runtime and environment control for authoritative News Core V2 ingestion and synchronization.
 *
 * Environment Variable: ATHENA_NEWS_CORE_V2_SYNC_ENABLED (default: true)
 * When true, authoritative News Core V2 collectors and sync pipeline operate normally.
 * When false, News Core V2 sync is cleanly bypassed without affecting read paths.
 *
 * Completely separated from ATHENA_LEGACY_WRITERS_ENABLED (which controls legacy V2/V3/RSS writers).
 */

export class NewsCoreV2SyncGuard {
  private static runtimeOverride: boolean | null = null;

  /**
   * Determines whether authoritative News Core V2 sync is enabled.
   * Defaults to TRUE to ensure production ingestion operates continuously.
   */
  public static isSyncEnabled(): boolean {
    if (this.runtimeOverride !== null) {
      return this.runtimeOverride;
    }

    const envVal = process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED;
    if (envVal === "false" || envVal === "0") {
      return false;
    }

    return true;
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
      console.log(`[NewsCoreV2SyncGuard] Suppressed sync operation '${operationName}' (ATHENA_NEWS_CORE_V2_SYNC_ENABLED=false).`);
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
      envSetting: process.env.ATHENA_NEWS_CORE_V2_SYNC_ENABLED || "true (default)"
    };
  }
}
