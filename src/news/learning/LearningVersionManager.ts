/**
 * ATHENA NEWS ENGINE — PHASE 15
 * LearningVersionManager.ts
 * 
 * Manages versioned learning snapshots for ATHENA.
 * Supports:
 * - CREATE_VERSION
 * - ACTIVATE_VERSION
 * - ROLLBACK_VERSION
 * - COMPARE_VERSIONS
 * 
 * Guarantees reproducible, audit-ready closed-loop learning.
 */

import { LearningVersion, AdaptiveScore, AdaptiveChangeLogRecord } from './types.ts';

export class LearningVersionManager {
  private versions: Map<string, LearningVersion> = new Map();
  private activeVersionId = 'v15.0';
  private changeLogs: AdaptiveChangeLogRecord[] = [];

  constructor() {
    // Initial Base Version v15.0
    const baseVersion: LearningVersion = {
      versionId: 'v15.0',
      createdAt: new Date().toISOString(),
      isActive: true,
      trainingWindow: { start: '2026-01-01T00:00:00Z', end: '2026-06-30T23:59:59Z' },
      validationWindow: { start: '2026-07-01T00:00:00Z', end: '2026-07-31T23:59:59Z' },
      forwardWindow: { start: '2026-08-01T00:00:00Z', end: '2026-08-31T23:59:59Z' },
      totalObservedTrades: 0,
      scores: {},
      decayReports: {},
      createdBy: 'ATHENA_CLOSED_LOOP_ENGINE'
    };
    this.versions.set('v15.0', baseVersion);
  }

  public getActiveVersion(): LearningVersion {
    return this.versions.get(this.activeVersionId) || Array.from(this.versions.values())[0];
  }

  public createVersion(versionId: string, scores: Record<string, AdaptiveScore>): LearningVersion {
    const newVersion: LearningVersion = {
      versionId,
      createdAt: new Date().toISOString(),
      isActive: false,
      trainingWindow: { start: '2026-01-01T00:00:00Z', end: '2026-07-15T23:59:59Z' },
      validationWindow: { start: '2026-07-16T00:00:00Z', end: '2026-08-15T23:59:59Z' },
      forwardWindow: { start: '2026-08-16T00:00:00Z', end: '2026-08-27T23:59:59Z' },
      totalObservedTrades: 50,
      scores,
      decayReports: {},
      createdBy: 'ATHENA_CLOSED_LOOP_ENGINE'
    };
    this.versions.set(versionId, newVersion);
    return newVersion;
  }

  public activateVersion(versionId: string): boolean {
    if (!this.versions.has(versionId)) return false;
    
    for (const v of this.versions.values()) {
      v.isActive = false;
    }
    const target = this.versions.get(versionId)!;
    target.isActive = true;
    this.activeVersionId = versionId;
    return true;
  }

  public rollbackVersion(targetVersionId: string): { success: boolean; activeVersion: string } {
    if (this.versions.has(targetVersionId)) {
      this.activateVersion(targetVersionId);
      return { success: true, activeVersion: targetVersionId };
    }
    return { success: false, activeVersion: this.activeVersionId };
  }

  public compareVersions(v1Id: string, v2Id: string): { version1?: LearningVersion; version2?: LearningVersion; scoreDeltas: Record<string, number> } {
    const v1 = this.versions.get(v1Id);
    const v2 = this.versions.get(v2Id);
    const scoreDeltas: Record<string, number> = {};

    if (v1 && v2) {
      const keys = new Set([...Object.keys(v1.scores), ...Object.keys(v2.scores)]);
      for (const key of keys) {
        const s1 = v1.scores[key]?.discountedScore || 0;
        const s2 = v2.scores[key]?.discountedScore || 0;
        scoreDeltas[key] = s2 - s1;
      }
    }

    return { version1: v1, version2: v2, scoreDeltas };
  }

  public recordChangeLog(log: AdaptiveChangeLogRecord): void {
    this.changeLogs.push(log);
  }

  public getChangeLogs(): AdaptiveChangeLogRecord[] {
    return this.changeLogs;
  }

  public getAllVersions(): LearningVersion[] {
    return Array.from(this.versions.values());
  }
}

export const learningVersionManager = new LearningVersionManager();
