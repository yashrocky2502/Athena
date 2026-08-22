/**
 * ATHENA NEWS ENGINE — STAGE 8.4 MATERIAL CHANGE & EVENT ESCALATION DETECTOR
 * Deterministically evaluates whether an incoming article constitutes a material change/escalation for an event.
 */

import { NewsArticle } from '../types/Article';
import { NewsEvent } from '../types/NewsEvent';
import { sourceAuthorityRanker } from './SourceAuthorityRanker';

export interface EscalationAssessment {
  isMaterialChange: boolean;
  isEscalation: boolean;
  isConfirmation: boolean;
  reason?: string;
  whatChanged?: string;
  newEscalationLevel: number;
}

export class EventEscalationDetector {
  private static instance: EventEscalationDetector;

  private constructor() {}

  public static getInstance(): EventEscalationDetector {
    if (!EventEscalationDetector.instance) {
      EventEscalationDetector.instance = new EventEscalationDetector();
    }
    return EventEscalationDetector.instance;
  }

  /**
   * Evaluates if new article brings material changes to existing event.
   */
  public evaluate(existingEvent: NewsEvent, newArticle: Partial<NewsArticle>): EscalationAssessment {
    const headline = (newArticle.headline || newArticle.title || '').toLowerCase();
    const body = (newArticle.body || (newArticle as any).summary || '').toLowerCase();
    const fullText = `${headline} ${body}`;

    const publisher = newArticle.source?.name || newArticle.publisher || 'Unknown';
    const tier = (newArticle.source as any)?.tier || sourceAuthorityRanker.getTier(publisher, newArticle.sourceUrl);

    let isMaterialChange = false;
    let isEscalation = false;
    let isConfirmation = false;
    let reason = '';
    let whatChanged = '';
    let newEscalationLevel = existingEvent.escalationLevel || 0;

    // 1. Official Confirmation: Tier 1 source confirms media report
    if (tier === 1 && existingEvent.primarySource.tier > 1) {
      isMaterialChange = true;
      isConfirmation = true;
      reason = `Official Tier 1 source (${publisher}) confirmed event previously reported by media`;
      whatChanged = `Status upgraded to CONFIRMED by official filing from ${publisher}`;
      newEscalationLevel += 1;
    }

    // 2. Numerical Increase / Escalation (e.g., order value increases >10%)
    const rawNumbers = fullText.match(/\b\d+(?:,\d+)*(?:\.\d+)?\b/g) || [];
    const numValues = rawNumbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => n > 10);

    const existingMainNum = existingEvent.keyNumbers.find(k => (k.numValue || (k as any).value) && ((k.numValue || (k as any).value) > 10))?.numValue || (existingEvent.keyNumbers.find(k => (k.numValue || (k as any).value) && ((k.numValue || (k as any).value) > 10)) as any)?.value;
    if (existingMainNum && numValues.length > 0) {
      const maxNewNum = Math.max(...numValues);
      if (maxNewNum > existingMainNum * 1.15) {
        isMaterialChange = true;
        isEscalation = true;
        reason = `Financial metric increased materially from ₹${existingMainNum} Cr to ₹${maxNewNum} Cr`;
        whatChanged = `Value revised upward from ₹${existingMainNum} Cr to ₹${maxNewNum} Cr`;
        newEscalationLevel += 1;
      } else if (maxNewNum < existingMainNum * 0.85) {
        isMaterialChange = true;
        isEscalation = true;
        reason = `Financial metric revised downward from ₹${existingMainNum} Cr to ₹${maxNewNum} Cr`;
        whatChanged = `Value revised downward from ₹${existingMainNum} Cr to ₹${maxNewNum} Cr`;
        newEscalationLevel += 1;
      }
    }

    // 3. Keywords triggering Escalation or Material Update
    if (!isMaterialChange) {
      if (/\bescalates\b|\bshow cause\b|\bpenalty imposed\b|\bban imposed\b|\bsearch and seizure\b|\braid\b/i.test(fullText)) {
        isMaterialChange = true;
        isEscalation = true;
        reason = 'Regulatory or enforcement action escalated';
        whatChanged = 'Regulatory scrutiny or penalty escalated';
        newEscalationLevel += 2;
      } else if (/\bconfirms\b|\bfiles with exchange\b|\bboard approves\b|\bshareholder approval\b/i.test(fullText)) {
        isMaterialChange = true;
        isConfirmation = true;
        reason = 'Event explicitly confirmed by company/board/exchange filing';
        whatChanged = 'Formal approval or confirmation obtained';
        newEscalationLevel += 1;
      } else if (/\brevised guidance\b|\bprofit warning\b|\brating downgrade\b|\brating upgrade\b/i.test(fullText)) {
        isMaterialChange = true;
        isEscalation = true;
        reason = 'Material revision to corporate guidance or rating';
        whatChanged = 'Guidance or credit rating updated';
        newEscalationLevel += 1;
      }
    }

    return {
      isMaterialChange,
      isEscalation,
      isConfirmation,
      reason,
      whatChanged,
      newEscalationLevel
    };
  }
}

export const eventEscalationDetector = EventEscalationDetector.getInstance();
