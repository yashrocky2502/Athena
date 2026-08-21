/**
 * ATHENA NEWS ENGINE — STAGE 8.4 EVENT STATE MACHINE
 * Manages deterministic state transitions for NewsEvent objects.
 */

import { NewsEvent, EventStatus, EventHistoryRecord } from '../types/NewsEvent';

export class EventStateMachine {
  /**
   * Evaluates valid state transitions and returns updated state with audit history entry.
   */
  public static transition(
    event: NewsEvent,
    targetStatus: EventStatus,
    reason: string,
    triggerArticleId?: string,
    whatChanged?: string
  ): NewsEvent {
    const currentStatus = event.eventStatus;

    // Check valid transitions
    if (currentStatus === targetStatus && targetStatus !== 'UPDATED') {
      return event;
    }

    const historyRecord: EventHistoryRecord = {
      timestamp: new Date().toISOString(),
      previousStatus: currentStatus,
      newStatus: targetStatus,
      reason,
      triggerArticleId,
      whatChanged
    };

    const history = [...(event.history || []), historyRecord];

    return {
      ...event,
      eventStatus: targetStatus,
      lastUpdatedAt: new Date().toISOString(),
      whatChanged: whatChanged || event.whatChanged,
      history
    };
  }
}
