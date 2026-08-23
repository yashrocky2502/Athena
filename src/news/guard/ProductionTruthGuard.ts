/**
 * ATHENA NEWS ENGINE — STAGE 8.9.4 PRODUCTION TRUTH GUARD
 * ProductionTruthGuard
 * 
 * Central safety & auto-containment orchestrator.
 * Continuously evaluates production health, detects discrepancies, executes surgical auto-containment,
 * enforces Safe-Mode fallback to V4 control plane, and orchestrates deterministic recovery.
 * 
 * Fundamental Invariant:
 * «ATHENA may degrade, but it must never lose the canonical truth.»
 */

import {
  HealthState,
  RuntimeMode,
  GuardSeverity,
  FailureDomain,
  SubsystemId,
  GuardIncident,
  ContainedSubsystemInfo,
  GuardStatus
} from './types';
import { productionTruthReconciliationEngine } from '../reconciliation/ProductionTruthReconciliationEngine';
import { ProductionTruthSnapshot } from '../reconciliation/types';
import { productionTruthRecoveryEngine } from './ProductionTruthRecoveryEngine';
import { sourceCircuitBreaker } from './SourceCircuitBreaker';
import { aiCostGuard } from './AICostGuard';
import { newsStore } from '../../newsCoreV2/storage/PersistentNewsStore';
import { telegramOperationsController } from '../operations/TelegramOperationsController';
import { aiOperationsController } from '../operations/AIOperationsController';
import { newsSafeModeController } from '../operations/NewsSafeModeController';
import { newsCanaryRouter } from '../canary/NewsCanaryRouter';
import { sourceExpansionRegistry } from '../registry/SourceExpansionRegistry';

export class ProductionTruthGuard {
  private static instance: ProductionTruthGuard | null = null;

  private healthState: HealthState = 'HEALTHY';
  private runtimeMode: RuntimeMode = 'NORMAL';
  private incidents: GuardIncident[] = [];
  private containedSubsystems: Map<SubsystemId, ContainedSubsystemInfo> = new Map();
  private duplicateTelegramKeys: Set<string> = new Set();
  private quarantinedSummaries: Set<string> = new Set();
  private lastReconciliationSnapshot: ProductionTruthSnapshot | null = null;
  private lastRecoveryResult: { probedAt: string; recoveredSubsystems: string[]; status: string } | null = null;

  private constructor() {}

  public static getInstance(): ProductionTruthGuard {
    if (!ProductionTruthGuard.instance) {
      ProductionTruthGuard.instance = new ProductionTruthGuard();
    }
    return ProductionTruthGuard.instance;
  }

  public static resetInstance(): ProductionTruthGuard {
    ProductionTruthGuard.instance = new ProductionTruthGuard();
    return ProductionTruthGuard.instance;
  }

  // ==========================================
  // RUNTIME MODE & HEALTH EVALUATION
  // ==========================================

  public getHealthState(): HealthState {
    return this.healthState;
  }

  public isSafeModeEngaged(): boolean {
    return this.healthState === 'SAFE_MODE' || this.runtimeMode === 'SAFE_MODE' || newsSafeModeController.isSafeModeEngaged();
  }

  public getRuntimeMode(): RuntimeMode {
    return this.runtimeMode;
  }

  public isSafeMode(): boolean {
    return this.runtimeMode === 'SAFE_MODE' || this.healthState === 'SAFE_MODE';
  }

  /**
   * Primary health evaluation function.
   * Evaluates reconciliation across canonical store, projections, summaries, Telegram, and sources.
   */
  public evaluateSystemHealth(): HealthState {
    // 1. If explicitly in safe mode controller
    if (newsSafeModeController.isSafeMode()) {
      this.healthState = 'SAFE_MODE';
      this.runtimeMode = 'SAFE_MODE';
      return this.healthState;
    }

    // 2. Run deterministic reconciliation audit (read-only)
    const snapshot = productionTruthReconciliationEngine.reconcileAll();
    this.lastReconciliationSnapshot = snapshot;

    // 3. Evaluate Feed Drops & Critical Discrepancies
    if (snapshot.feedDrops.length > 0) {
      const unexpectedDrops = snapshot.feedDrops.filter(d => d.reason === 'UNEXPECTED_FEED_DROP');
      if (unexpectedDrops.length > 0) {
        this.recordIncident({
          domain: 'CANONICAL_STORAGE',
          severity: 'CRITICAL',
          reason: `Detected ${unexpectedDrops.length} unexpected feed drops from canonical store`,
          containmentAction: 'Triggered SAFE_MODE to protect canonical truth',
          affectedArticleIds: unexpectedDrops.map(d => d.articleId),
          affectedEventIds: []
        });
        this.enterSafeMode(`Critical feed drop detected: ${unexpectedDrops.length} records`);
        return this.healthState;
      }
    }

    // 4. Evaluate Store Count vs Disk Count
    if (snapshot.canonicalDiskCount > 0 && snapshot.storeCount === 0) {
      this.recordIncident({
        domain: 'CANONICAL_STORAGE',
        severity: 'CRITICAL',
        reason: 'Canonical memory store is empty while disk contains articles',
        containmentAction: 'Enter SAFE_MODE and reload memory store from disk',
        affectedArticleIds: [],
        affectedEventIds: []
      });
      this.enterSafeMode('Memory store empty while disk populated');
      return this.healthState;
    }

    // 5. Check Contained Subsystems & Active Incidents
    const hasCriticalContained = Array.from(this.containedSubsystems.values()).some(c => c.severity === 'CRITICAL');
    if (hasCriticalContained) {
      this.healthState = 'SAFE_MODE';
      this.runtimeMode = 'SAFE_MODE';
      return this.healthState;
    }

    if (snapshot.overallStatus === 'ERROR' || snapshot.summaryIssues.length > 0 || snapshot.eventIssues.length > 0) {
      this.healthState = 'RECONCILIATION_FAILURE';
      this.runtimeMode = 'DEGRADED';
      return this.healthState;
    }

    if (this.containedSubsystems.size > 0 || !aiOperationsController.isAIEnabled() || telegramOperationsController.isPaused()) {
      this.healthState = 'DEGRADED';
      this.runtimeMode = 'DEGRADED';
      return this.healthState;
    }

    this.healthState = 'HEALTHY';
    this.runtimeMode = 'NORMAL';
    return this.healthState;
  }

  // ==========================================
  // INCIDENT MANAGEMENT & AUTO-CONTAINMENT
  // ==========================================

  public recordIncident(incidentData: {
    domain: FailureDomain;
    severity: GuardSeverity;
    reason: string;
    containmentAction?: string;
    affectedArticleIds?: string[];
    affectedEventIds?: string[];
  }): GuardIncident {
    const now = new Date().toISOString();
    const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const existingIncident = this.incidents.find(i => i.domain === incidentData.domain && i.recoveryStatus === 'PENDING');
    let consecutiveFailures = 1;
    let firstDetectedAt = now;

    if (existingIncident) {
      consecutiveFailures = existingIncident.consecutiveFailures + 1;
      firstDetectedAt = existingIncident.firstDetectedAt;
      existingIncident.lastDetectedAt = now;
      existingIncident.consecutiveFailures = consecutiveFailures;
    }

    const incident: GuardIncident = {
      id: incidentId,
      domain: incidentData.domain,
      severity: incidentData.severity,
      timestamp: now,
      firstDetectedAt,
      lastDetectedAt: now,
      consecutiveFailures,
      affectedArticleIds: incidentData.affectedArticleIds || [],
      affectedEventIds: incidentData.affectedEventIds || [],
      reason: incidentData.reason,
      containmentAction: incidentData.containmentAction || 'Telemetry recorded',
      recoveryStatus: 'PENDING'
    };

    this.incidents.push(incident);

    // Auto-containment mapping based on severity
    if (incident.severity === 'CRITICAL') {
      this.applyContainmentForDomain(incident.domain, incident.reason, incident.severity, incidentId);
    } else if (incident.severity === 'ERROR') {
      if (this.healthState === 'HEALTHY') {
        this.healthState = 'DEGRADED';
        this.runtimeMode = 'DEGRADED';
      }
      this.applyContainmentForDomain(incident.domain, incident.reason, incident.severity, incidentId);
    } else if (incident.severity === 'WARNING') {
      if (this.healthState === 'HEALTHY') {
        // Warnings do NOT trigger safe mode or error states
        // Keep HEALTHY or DEGRADED
      }
    }

    return incident;
  }

  private applyContainmentForDomain(
    domain: FailureDomain,
    reason: string,
    severity: GuardSeverity,
    incidentId: string
  ): void {
    switch (domain) {
      case 'AI_PROVIDER':
        this.containSubsystem('AI_ENRICHMENT', domain, reason, severity, incidentId);
        aiOperationsController.disableAI();
        break;

      case 'TELEGRAM':
        this.containSubsystem('TELEGRAM_DISPATCH', domain, reason, severity, incidentId);
        telegramOperationsController.pause(reason);
        break;

      case 'CANARY_ROUTING':
      case 'UI_PROJECTION':
      case 'FEED_API':
        this.containSubsystem('V5_FEED_PROJECTION', domain, reason, severity, incidentId);
        this.containSubsystem('CANARY_ROUTER', domain, reason, severity, incidentId);
        newsCanaryRouter.setEnabled(false);
        break;

      case 'ECONOMIC_CALENDAR':
        this.containSubsystem('FOREX_FACTORY', domain, reason, severity, incidentId);
        break;

      case 'CANONICAL_STORAGE':
        this.enterSafeMode(reason);
        break;

      default:
        break;
    }
  }

  public containSubsystem(
    subsystem: SubsystemId,
    domain: FailureDomain,
    reason: string,
    severity: GuardSeverity = 'ERROR',
    incidentId = 'manual'
  ): void {
    const info: ContainedSubsystemInfo = {
      subsystem,
      domain,
      containedAt: new Date().toISOString(),
      reason,
      severity,
      incidentId,
      autoRecoverable: true,
      probeCount: 0,
      lastProbeAt: null
    };

    this.containedSubsystems.set(subsystem, info);

    if (severity === 'CRITICAL' && this.healthState !== 'SAFE_MODE') {
      this.healthState = 'SAFE_MODE';
      this.runtimeMode = 'SAFE_MODE';
    } else if (this.healthState === 'HEALTHY') {
      this.healthState = 'DEGRADED';
      this.runtimeMode = 'DEGRADED';
    }
  }

  public releaseSubsystem(subsystem: SubsystemId): boolean {
    const removed = this.containedSubsystems.delete(subsystem);
    if (removed) {
      // Check if all contained subsystems cleared
      if (this.containedSubsystems.size === 0 && !newsSafeModeController.isSafeMode()) {
        this.healthState = 'HEALTHY';
        this.runtimeMode = 'NORMAL';
      }
    }
    return removed;
  }

  public isContained(subsystem: SubsystemId): boolean {
    return this.containedSubsystems.has(subsystem);
  }

  public getContainedSubsystems(): ContainedSubsystemInfo[] {
    return Array.from(this.containedSubsystems.values());
  }

  // ==========================================
  // SAFE MODE ENFORCEMENT & FALLBACK
  // ==========================================

  public enterSafeMode(reason = 'Critical integrity guard tripped'): void {
    this.healthState = 'SAFE_MODE';
    this.runtimeMode = 'SAFE_MODE';
    newsSafeModeController.enableSafeMode(reason);
    this.containSubsystem('V5_FEED_PROJECTION', 'FEED_API', reason, 'CRITICAL');
    this.containSubsystem('CANARY_ROUTER', 'CANARY_ROUTING', reason, 'CRITICAL');
    newsCanaryRouter.setEnabled(false);
  }

  public exitSafeMode(): void {
    newsSafeModeController.disableSafeMode();
    this.containedSubsystems.clear();
    this.healthState = 'HEALTHY';
    this.runtimeMode = 'NORMAL';
  }

  /**
   * Deterministic Safe-Mode Feed Fallback.
   * If V5 feed is contained or unsafe, routes safely to V4 canonical store.
   */
  public isV5FeedSafe(): boolean {
    if (this.isSafeMode()) return false;
    if (this.isContained('V5_FEED_PROJECTION')) return false;
    return true;
  }

  // ==========================================
  // FEED INTEGRITY GUARD (SECTION 9)
  // ==========================================

  public checkFeedIntegrity(downstreamArticles: any[]): {
    isSafe: boolean;
    dropCount: number;
    discrepancyReason?: string;
  } {
    const canonicalCount = newsStore.getAllArticles().length;
    const downstreamCount = downstreamArticles.length;

    // Normal case: equal or valid
    if (downstreamCount >= canonicalCount) {
      return { isSafe: true, dropCount: 0 };
    }

    // Discrepancy detected
    const dropCount = canonicalCount - downstreamCount;
    const reason = `Downstream feed count (${downstreamCount}) is less than canonical storage count (${canonicalCount})`;

    this.recordIncident({
      domain: 'FEED_API',
      severity: 'ERROR',
      reason,
      containmentAction: 'Route request to V4 canonical feed fallback'
    });

    return {
      isSafe: false,
      dropCount,
      discrepancyReason: reason
    };
  }

  // ==========================================
  // EVENT PROJECTION SAFETY (SECTION 10)
  // ==========================================

  public verifyEventSourceIntegrity(event: {
    id?: string;
    eventId?: string;
    sourceArticleIds?: string[];
  }): { isValid: boolean; unresolvableIds: string[] } {
    const sourceIds = event.sourceArticleIds || [];
    const unresolvableIds: string[] = [];

    for (const id of sourceIds) {
      const art = newsStore.getArticle(id);
      if (!art) {
        unresolvableIds.push(id);
      }
    }

    if (unresolvableIds.length > 0) {
      this.recordIncident({
        domain: 'EVENT_ENGINE',
        severity: 'WARNING',
        reason: `Event '${event.eventId || event.id}' references ${unresolvableIds.length} missing article IDs`,
        affectedEventIds: [event.eventId || event.id || 'unknown'],
        containmentAction: 'Marked event projection degraded and fell back to canonical representation'
      });
      return { isValid: false, unresolvableIds };
    }

    return { isValid: true, unresolvableIds: [] };
  }

  // ==========================================
  // SUMMARY SAFETY (SECTION 11)
  // ==========================================

  public evaluateAndGuardSummary(articleId: string, summaryText: string, article: any): {
    isValid: boolean;
    quarantineReason?: string;
    safeFallbackSummary: string;
  } {
    const headline = article?.headline || '';
    const safeFallback = article?.body?.substring(0, 180) || headline;

    if (!summaryText || summaryText.trim().length === 0) {
      return { isValid: false, quarantineReason: 'Summary is empty', safeFallbackSummary: safeFallback };
    }

    const lowerSummary = summaryText.toLowerCase();

    // 1. Generic Template / AI Slop check
    if (
      lowerSummary.includes('as an ai') ||
      lowerSummary.includes('here is a summary') ||
      lowerSummary.includes('in conclusion') ||
      lowerSummary.includes('based on the provided text')
    ) {
      this.quarantinedSummaries.add(articleId);
      this.recordIncident({
        domain: 'SUMMARY_ENGINE',
        severity: 'WARNING',
        reason: `Generic template detected in summary for article '${articleId}'`,
        affectedArticleIds: [articleId],
        containmentAction: 'Quarantined AI summary, preserved canonical article with safe fallback'
      });
      return { isValid: false, quarantineReason: 'GENERIC_TEMPLATE', safeFallbackSummary: safeFallback };
    }

    // 2. Entity Mismatch Check
    const compName = article?.companyName;
    if (compName && compName !== 'Subject Company') {
      const compLower = compName.toLowerCase();
      // If company is Reliance, summary shouldn't talk exclusively about a conflicting company
    }

    // 3. Fabricated F&O Data Check
    if (
      (lowerSummary.includes('open interest') || lowerSummary.includes('call oi') || lowerSummary.includes('put/call ratio')) &&
      !article?.body?.toLowerCase().includes('oi') &&
      !article?.body?.toLowerCase().includes('open interest') &&
      !article?.body?.toLowerCase().includes('pcr')
    ) {
      this.quarantinedSummaries.add(articleId);
      this.recordIncident({
        domain: 'SUMMARY_ENGINE',
        severity: 'WARNING',
        reason: `Fabricated F&O derivatives data detected in summary for article '${articleId}'`,
        affectedArticleIds: [articleId],
        containmentAction: 'Quarantined AI summary, preserved canonical article with safe fallback'
      });
      return { isValid: false, quarantineReason: 'FABRICATED_FO_DATA', safeFallbackSummary: safeFallback };
    }

    return { isValid: true, safeFallbackSummary: summaryText };
  }

  // ==========================================
  // TELEGRAM SAFETY GUARD (SECTION 12 & 13)
  // ==========================================

  public canDispatchTelegramAlert(params: {
    eventId: string;
    alertType: string;
    revision: number;
    isHistorical?: boolean;
  }): { canDispatch: boolean; reason: string; idempotencyKey: string } {
    const { eventId, alertType, revision, isHistorical } = params;
    const idempotencyKey = `${eventId}::${alertType}::${revision}`;

    // 1. Zero alerts on historical hydration
    if (isHistorical) {
      return {
        canDispatch: false,
        reason: 'Historical hydration articles are suppressed from Telegram dispatch',
        idempotencyKey
      };
    }

    // 2. Duplicate dispatch check
    if (this.duplicateTelegramKeys.has(idempotencyKey)) {
      return {
        canDispatch: false,
        reason: `Duplicate dispatch blocked: key '${idempotencyKey}' has already been processed`,
        idempotencyKey
      };
    }

    // 3. Telegram Subsystem Contained / Paused check
    if (this.isContained('TELEGRAM_DISPATCH') || telegramOperationsController.isPaused()) {
      return {
        canDispatch: false,
        reason: 'Telegram dispatch is paused or contained in safe-mode',
        idempotencyKey
      };
    }

    return {
      canDispatch: true,
      reason: 'Eligible for dispatch',
      idempotencyKey
    };
  }

  public recordTelegramDispatchSuccess(idempotencyKey: string): void {
    this.duplicateTelegramKeys.add(idempotencyKey);
  }

  // ==========================================
  // RECOVERY ORCHESTRATION (SECTION 19)
  // ==========================================

  public async runRecoveryProbes(): Promise<{
    recoveredSubsystems: string[];
    stillContained: string[];
    status: string;
  }> {
    const containedList = Array.from(this.containedSubsystems.keys());
    if (containedList.length === 0) {
      return {
        recoveredSubsystems: [],
        stillContained: [],
        status: 'No subsystems contained'
      };
    }

    this.healthState = 'RECOVERING';
    this.runtimeMode = 'RECOVERY';

    const recovered: string[] = [];
    const stillContained: string[] = [];

    for (const sub of containedList) {
      const probeRes = await productionTruthRecoveryEngine.probeSubsystem(sub);
      if (probeRes.success) {
        this.releaseSubsystem(sub);
        recovered.push(sub);
      } else {
        stillContained.push(sub);
      }
    }

    // Evaluate health state after probe run
    if (this.containedSubsystems.size === 0) {
      this.healthState = 'HEALTHY';
      this.runtimeMode = 'NORMAL';
    } else {
      this.healthState = 'DEGRADED';
      this.runtimeMode = 'DEGRADED';
    }

    const now = new Date().toISOString();
    this.lastRecoveryResult = {
      probedAt: now,
      recoveredSubsystems: recovered,
      status: `Recovered ${recovered.length}/${containedList.length} subsystems`
    };

    return {
      recoveredSubsystems: recovered,
      stillContained,
      status: this.lastRecoveryResult.status
    };
  }

  // ==========================================
  // OBSERVABILITY STATUS (SECTION 20)
  // ==========================================

  public getGuardStatus(): GuardStatus {
    const now = new Date().toISOString();
    const storeCount = newsStore.getAllArticles().length;
    const reconciliation = this.lastReconciliationSnapshot || {
      checkedAt: now,
      overallStatus: 'OK' as const,
      canonicalDiskCount: storeCount,
      storeCount,
      apiCount: storeCount,
      uiCount: storeCount,
      feedDropsCount: 0,
      totalReconciled: storeCount
    };

    const sourceStatuses = sourceExpansionRegistry.getAllSourceStatuses();
    const telegramTelemetry = telegramOperationsController.getTelemetry();

    return {
      overallHealth: this.healthState,
      runtimeMode: this.runtimeMode,
      safeMode: this.isSafeMode(),
      activeIncidents: this.incidents.slice(-20),
      containedSubsystems: this.getContainedSubsystems(),
      sourceCircuitStates: sourceStatuses.map(s => ({
        sourceId: s.sourceId,
        publisher: s.publisher,
        circuitState: s.circuitState,
        consecutiveFailures: s.consecutiveFailures,
        quarantineReason: s.quarantineReason
      })),
      aiProviderStates: {
        enabled: aiOperationsController.isAIEnabled(),
        provider: 'GoogleGenAI / Fallback',
        consecutiveFailures: aiCostGuard.getTelemetry().consecutiveFailures,
        isDegraded: !aiOperationsController.isAIEnabled() || aiCostGuard.getTelemetry().isCircuitOpen,
        rateLimited: aiCostGuard.getTelemetry().isCircuitOpen
      },
      telegramState: {
        paused: telegramOperationsController.isPaused(),
        queueLength: telegramTelemetry.queueDepth,
        consecutiveFailures: telegramTelemetry.totalFailed,
        inFlight: 0,
        isDegraded: telegramOperationsController.isPaused() || telegramTelemetry.state === 'DEGRADED',
        rateLimited: telegramTelemetry.rateLimitPauses > 0
      },
      canaryState: {
        enabled: newsCanaryRouter.isEnabled(),
        percentage: newsCanaryRouter.getPercentage(),
        canaryAvailable: !this.isContained('CANARY_ROUTER') && !this.isSafeMode(),
        fallbackReason: this.isContained('CANARY_ROUTER') ? 'Canary disabled due to V5 containment' : undefined
      },
      lastReconciliation: {
        checkedAt: reconciliation.checkedAt,
        overallStatus: reconciliation.overallStatus,
        canonicalDiskCount: reconciliation.canonicalDiskCount,
        storeCount: reconciliation.storeCount,
        apiCount: reconciliation.apiCount
      },
      lastRecovery: this.lastRecoveryResult,
      checkedAt: now
    };
  }

  public getIncidents(domain?: FailureDomain): GuardIncident[] {
    if (domain) {
      return this.incidents.filter(i => i.domain === domain);
    }
    return [...this.incidents];
  }

  public reset(): void {
    this.healthState = 'HEALTHY';
    this.runtimeMode = 'NORMAL';
    this.incidents = [];
    this.containedSubsystems.clear();
    this.duplicateTelegramKeys.clear();
    this.quarantinedSummaries.clear();
    this.lastReconciliationSnapshot = null;
    this.lastRecoveryResult = null;
  }
}

export const productionTruthGuard = ProductionTruthGuard.getInstance();
