/**
 * ATHENA — Phase 18 Event Transmission
 * SurveillanceEventPublisher.ts
 */

import { AthenaEventBus } from '../intelligence/AthenaEventBus.ts';
import { UnifiedAthenaEvent } from '../intelligence/UnifiedIntelligenceTypes.ts';
import { MarketSurveillanceEvent } from './types.ts';

export class SurveillanceEventPublisher {
  private static instance: SurveillanceEventPublisher;

  private constructor() {}

  public static getInstance(): SurveillanceEventPublisher {
    if (!SurveillanceEventPublisher.instance) {
      SurveillanceEventPublisher.instance = new SurveillanceEventPublisher();
    }
    return SurveillanceEventPublisher.instance;
  }

  /**
   * Transforms a Phase 18 MarketSurveillanceEvent into a Phase 17 UnifiedAthenaEvent
   * and publishes it onto the Central AthenaEventBus.
   */
  public async publish(event: MarketSurveillanceEvent): Promise<UnifiedAthenaEvent> {
    const unifiedEvent: UnifiedAthenaEvent = {
      schemaVersion: 'v17_unified_event',
      eventId: event.id,
      correlationId: `corr_${event.symbol}_${Date.now()}`,
      parentEventId: null,
      timestamp: event.timestamp,
      source: `ATHENA Surveillance Engine (${event.eventType})`,
      sourceType: event.priority === 'P0_CRITICAL' ? 'P0' : event.priority === 'P1_HIGH' ? 'P1' : 'P2',
      eventType: 'SURVEILLANCE_ANOMALY_DETECTED',
      articleId: event.id,
      evidenceIds: event.evidence,
      entityIds: [event.symbol],
      sectorIds: [event.sector],
      indexIds: event.indices,
      macroAssetIds: [],
      marketReactionId: event.lineage.detectorId,
      regimeSnapshotId: 'REGIME_NORMAL',
      signalId: `sig_${event.id}`,
      strategyCandidateIds: [],
      portfolioDecisionId: null,
      executionIntentId: null,
      executionOrderIds: [],
      fillIds: [],
      outcomeId: null,
      attributionId: null,
      learningRecordId: null,
      researchHypothesisIds: [],
      strategyVariantIds: [],
      confidence: event.confidence,
      lifecycleState: event.actionability as any,
      actionability: event.actionability,
      contradictionState: event.contradictions.length > 0 ? 'CONTRADICTED' : 'UNCONTRADICTED',
      provenance: JSON.stringify(event.lineage),
      deterministicOrAI: 'DETERMINISTIC',
    };

    await AthenaEventBus.getInstance().publish(unifiedEvent);
    return unifiedEvent;
  }
}
export const surveillanceEventPublisher = SurveillanceEventPublisher.getInstance();
