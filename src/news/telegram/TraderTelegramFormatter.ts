/**
 * ATHENA NEWS ENGINE — STAGE 8.4
 * TraderTelegramFormatter
 * 
 * High-signal, evidence-grounded Telegram Alert Formatter.
 * Implements Part G, Part I, and Stage 8.4 Event-Centric Alert Formatting.
 */

import { TelegramEligibilityAssessment } from './TelegramAlertEligibilityEngine';
import { NewsEvent } from '../types/NewsEvent';

export class TraderTelegramFormatter {
  /**
   * Escape HTML special characters for Telegram HTML mode
   */
  public static escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Format an assessment into the Stage 8.2B production Telegram notification
   */
  public static format(assessment: TelegramEligibilityAssessment): string {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    
    // Direction Icon
    let dirIcon = '⚪';
    if (assessment.direction === 'BULLISH') dirIcon = '🟢';
    else if (assessment.direction === 'BEARISH') dirIcon = '🔴';
    else if (assessment.direction === 'MIXED') dirIcon = '🟡';

    // Header Title
    const titleText = assessment.companyName.toUpperCase();

    let message = `${divider}\n`;
    message += `🚨 <b>ATHENA MARKET ALERT</b>\n`;
    message += `${divider}\n\n`;

    message += `${dirIcon} <b>${this.escapeHtml(titleText)}</b>\n\n`;
    message += `<b>Category:</b> ${this.escapeHtml(assessment.category)}\n\n`;
    
    message += `${divider}\n\n`;
    message += `📰 <b>Executive Summary</b>\n\n`;
    message += `${this.escapeHtml(assessment.executiveSummary)}\n\n`;

    message += `${divider}\n\n`;
    message += `📊 <b>Market Intelligence</b>\n\n`;
    message += `<b>Direction:</b> ${assessment.direction}\n`;
    message += `<b>Impact:</b> ${assessment.score}/100\n`;
    message += `<b>Confidence:</b> ${assessment.confidence}%\n`;
    message += `<b>Urgency:</b> ${assessment.urgency}\n\n`;

    if (assessment.observedMarketReaction) {
      message += `<b>Observed Reaction:</b> ${this.escapeHtml(assessment.observedMarketReaction)}\n\n`;
    }

    message += `<b>Why It Matters:</b>\n${this.escapeHtml(assessment.whyItMatters)}\n\n`;

    if (assessment.fnoEvidence && assessment.fnoEvidence.hasExplicitDerivativesData) {
      message += `${divider}\n\n`;
      message += `⚡ <b>F&O Intelligence</b>\n\n`;
      if (assessment.fnoEvidence.underlying) {
        message += `<b>Underlying:</b> ${this.escapeHtml(assessment.fnoEvidence.underlying)}\n`;
      }
      if (assessment.fnoEvidence.spot) {
        message += `<b>Spot:</b> ₹${this.escapeHtml(assessment.fnoEvidence.spot)}\n`;
      }
      if (assessment.fnoEvidence.future) {
        message += `<b>Future:</b> ₹${this.escapeHtml(assessment.fnoEvidence.future)}\n`;
      }
      if (assessment.fnoEvidence.pcr) {
        message += `<b>PCR:</b> ${this.escapeHtml(assessment.fnoEvidence.pcr)}\n`;
      }
      if (assessment.fnoEvidence.oiChange) {
        message += `<b>OI Change:</b> ${this.escapeHtml(assessment.fnoEvidence.oiChange)}\n`;
      }
      if (assessment.fnoEvidence.oi) {
        message += `<b>Open Interest:</b> ${this.escapeHtml(assessment.fnoEvidence.oi)}\n`;
      }
      if (assessment.fnoEvidence.callOi) {
        message += `<b>Call OI:</b> ${this.escapeHtml(assessment.fnoEvidence.callOi)}\n`;
      }
      if (assessment.fnoEvidence.putOi) {
        message += `<b>Put OI:</b> ${this.escapeHtml(assessment.fnoEvidence.putOi)}\n`;
      }
      if (assessment.fnoEvidence.iv) {
        message += `<b>IV:</b> ${this.escapeHtml(assessment.fnoEvidence.iv)}\n`;
      }
      if (assessment.fnoEvidence.strikes) {
        message += `<b>Key Strikes:</b> ${this.escapeHtml(assessment.fnoEvidence.strikes)}\n`;
      }

      message += `\n<b>Options Bias:</b> ${assessment.fnoEvidence.bias || 'INSUFFICIENT_INFORMATION'}\n`;
      if (assessment.fnoEvidence.evidenceExplanation) {
        message += `<b>Evidence:</b> ${this.escapeHtml(assessment.fnoEvidence.evidenceExplanation)}\n\n`;
      } else {
        message += `\n`;
      }
    }

    if (assessment.traderRelevance) {
      message += `${divider}\n\n`;
      message += `🎯 <b>Trader Relevance</b>\n\n`;
      message += `${this.escapeHtml(assessment.traderRelevance)}\n\n`;
    }

    if (assessment.whatToMonitor && assessment.whatToMonitor.length > 0) {
      message += `${divider}\n\n`;
      message += `👀 <b>What To Monitor</b>\n\n`;
      for (const item of assessment.whatToMonitor) {
        message += `• ${this.escapeHtml(item)}\n`;
      }
      message += `\n`;
    }

    const publisher = assessment.sources && assessment.sources.length > 0 ? assessment.sources[0] : 'Athena News';
    message += `${divider}\n\n`;
    message += `✓ <b>Source:</b> ${this.escapeHtml(publisher)}\n\n`;
    message += `🔗 <b>Open ATHENA</b>`;

    return message;
  }

  /**
   * Format Stage 8.4 Event-Centric Notifications
   */
  public static formatEvent(event: NewsEvent, action: 'NEW_EVENT' | 'EVENT_UPDATE' | 'EVENT_ESCALATION' | 'CONFLICT_DETECTED'): string {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    let headerText = '🚨 <b>ATHENA EVENT ALERT</b>';
    if (action === 'EVENT_UPDATE') headerText = '🔄 <b>ATHENA EVENT UPDATE</b>';
    if (action === 'EVENT_ESCALATION') headerText = '⚡ <b>ATHENA EVENT ESCALATION</b>';
    if (action === 'CONFLICT_DETECTED') headerText = '⚠️ <b>CONFLICT DETECTED</b>';

    let message = `${divider}\n${headerText}\n${divider}\n\n`;
    message += `📌 <b>Company:</b> ${this.escapeHtml(event.primaryEntity)} (${event.symbol})\n`;
    message += `🏷️ <b>Category:</b> ${this.escapeHtml(event.category)} | <b>Priority:</b> ${event.eventPriority}\n`;
    message += `📊 <b>Status:</b> ${event.eventStatus} | <b>Confidence:</b> ${event.confidence}%\n\n`;

    message += `${divider}\n\n`;
    message += `📰 <b>Executive Summary</b>\n`;
    message += `${this.escapeHtml(event.canonicalSummary.whatHappened)}\n\n`;

    message += `<b>Why It Matters:</b>\n${this.escapeHtml(event.canonicalSummary.whyItMatters)}\n\n`;

    if (event.keyNumbers && event.keyNumbers.length > 0) {
      message += `🔢 <b>Key Numbers:</b> ${event.keyNumbers.map(k => k.value).join(', ')}\n\n`;
    }

    if (action === 'EVENT_UPDATE' || action === 'EVENT_ESCALATION') {
      if (event.whatChanged) {
        message += `${divider}\n\n`;
        message += `📝 <b>What Changed:</b>\n${this.escapeHtml(event.whatChanged)}\n\n`;
      }
    }

    if (action === 'CONFLICT_DETECTED' && event.conflictingReports && event.conflictingReports.length > 0) {
      message += `${divider}\n\n`;
      message += `⚠️ <b>Conflicting Reports:</b>\n`;
      for (const conf of event.conflictingReports) {
        message += `• <b>${this.escapeHtml(conf.reportA.publisher)}:</b> ${this.escapeHtml(String(conf.reportA.value))}\n`;
        message += `• <b>${this.escapeHtml(conf.reportB.publisher)}:</b> ${this.escapeHtml(String(conf.reportB.value))}\n`;
      }
      message += `\n<b>Status:</b> Unresolved discrepancy being monitored\n\n`;
    }

    message += `${divider}\n\n`;
    message += `📡 <b>Primary Source:</b> ${this.escapeHtml(event.primarySource.publisher)} (Tier ${event.primarySource.tier})\n`;
    message += `🌐 <b>Covered by:</b> ${event.sourceCount} sources\n\n`;
    message += `🔗 <b>Open ATHENA</b>`;

    return message;
  }
}
