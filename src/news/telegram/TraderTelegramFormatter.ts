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
    message += `📰 <b>CANONICAL NEWS SUMMARY</b>\n\n`;
    const execSummary = assessment.executiveSummary && assessment.executiveSummary.trim()
      ? assessment.executiveSummary.trim()
      : 'Material event reported by primary market source.';
    message += `${this.escapeHtml(execSummary)}\n\n`;

    message += `${divider}\n\n`;
    message += `📊 <b>TRADER INTELLIGENCE</b>\n\n`;
    message += `<b>Direction:</b> ${assessment.direction}\n`;
    if (assessment.directionReason && assessment.directionReason.trim()) {
      message += `<b>Reasoning:</b> ${this.escapeHtml(assessment.directionReason.trim())}\n`;
    }
    message += `<b>Impact Score:</b> ${assessment.score}/100\n`;
    message += `<b>Confidence:</b> ${assessment.confidence}%\n`;
    message += `<b>Urgency:</b> ${assessment.urgency}\n\n`;

    if (assessment.observedMarketReaction && assessment.observedMarketReaction.trim()) {
      message += `<b>Observed Reaction:</b> ${this.escapeHtml(assessment.observedMarketReaction.trim())}\n\n`;
    }

    if (assessment.traderRelevance && assessment.traderRelevance.trim()) {
      message += `${divider}\n\n`;
      message += `🎯 <b>Trader Relevance</b>\n\n`;
      message += `${this.escapeHtml(assessment.traderRelevance.trim())}\n\n`;
    }

    const whyItMattersText = assessment.whyItMatters && assessment.whyItMatters.trim()
      ? assessment.whyItMatters.trim()
      : 'Material corporate development affecting market expectations based on published disclosure.';

    message += `${divider}\n\n`;
    message += `🧠 <b>Why It Matters</b>\n\n`;
    message += `${this.escapeHtml(whyItMattersText)}\n\n`;

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

    if (assessment.whatToMonitor && assessment.whatToMonitor.length > 0) {
      const validPoints = assessment.whatToMonitor.filter(p => p && p.trim().length > 0);
      if (validPoints.length > 0) {
        message += `${divider}\n\n`;
        message += `👀 <b>What To Monitor</b>\n\n`;
        for (const item of validPoints) {
          message += `• ${this.escapeHtml(item.trim())}\n`;
        }
        message += `\n`;
      }
    }

    const publisher = assessment.sources && assessment.sources.length > 0 ? assessment.sources[0] : 'Athena Verified Wire';
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
    message += `📡 <b>Primary Source:</b> ${this.escapeHtml((event as any).primarySource?.publisher || (event as any).primaryPublisher || 'Market Wire')}\n`;
    message += `🌐 <b>Covered by:</b> ${(event as any).sourceCount || ((event as any).publishers ? (event as any).publishers.length : 1)} sources\n\n`;
    message += `🔗 <b>Open ATHENA</b>`;

    return message;
  }

  public formatEventAlert(event: NewsEvent, action: string = 'INITIAL_EVENT'): string {
    const evAny = event as any;
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    const primaryPub = evAny.primaryPublisher || (evAny.publishers && evAny.publishers[0]) || 'Market Wire';
    
    let msg = `${divider}\n🚨 <b>ATHENA MARKET ALERT</b>\n${divider}\n\n`;
    msg += `📌 <b>Headline:</b> ${TraderTelegramFormatter.escapeHtml(evAny.headline || evAny.title || '')}\n\n`;
    msg += `📰 <b>Executive Summary</b>\n${TraderTelegramFormatter.escapeHtml(evAny.summary || evAny.headline || '')}\n\n`;
    if (evAny.whyItMatters) {
      msg += `💡 <b>Why It Matters:</b>\n${TraderTelegramFormatter.escapeHtml(evAny.whyItMatters)}\n\n`;
    }
    msg += `${divider}\n\n`;
    msg += `✓ <b>Source:</b> ${TraderTelegramFormatter.escapeHtml(primaryPub)}\n\n`;
    msg += `🔗 <b>Open ATHENA</b>`;
    return msg;
  }

  /**
   * Format the high-value production intelligence dossier for Telegram.
   */
  public static formatProductionDossier(dossier: any): string {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    let msg = `${divider}\n🚨 <b>ATHENA MARKET ALERT</b>\n${divider}\n\n`;

    const entity = dossier.event?.primaryEntity ? dossier.event.primaryEntity.toUpperCase() : 'UNKNOWN';
    const eventType = dossier.event?.eventType || 'UNKNOWN';

    msg += `<b>ENTITY</b>\n${this.escapeHtml(entity)}\n\n`;
    msg += `<b>EVENT</b>\n${this.escapeHtml(eventType)}\n\n`;

    const newsSummaryText = dossier.canonicalSummary?.summary || dossier.executiveSummary || dossier.summary || '';
    if (newsSummaryText && newsSummaryText.trim().length > 0) {
      msg += `<b>CANONICAL NEWS SUMMARY</b>\n${this.escapeHtml(newsSummaryText.trim())}\n\n`;
    }

    const verifiedFact = dossier.facts?.verifiedFacts?.[0] || dossier.whatChanged?.evidenceText || '';
    if (verifiedFact && verifiedFact.trim().length > 0 && verifiedFact.trim() !== newsSummaryText.trim()) {
      msg += `<b>WHAT HAPPENED</b>\n${this.escapeHtml(verifiedFact.trim())}\n\n`;
    }

    const whyItMatters = dossier.whyItMatters?.transmissionMechanism || dossier.canonicalSummary?.whyItMatters || '';
    if (whyItMatters && whyItMatters.trim().length > 0) {
      msg += `<b>WHY IT MATTERS</b>\n${this.escapeHtml(whyItMatters.trim())}\n\n`;
    }

    const marketReaction = dossier.marketReaction?.status === 'VERIFIED' && dossier.marketReaction?.evidenceText
      ? `${dossier.marketReaction.direction}: ${dossier.marketReaction.evidenceText}`
      : 'UNAVAILABLE';
    msg += `<b>MARKET REACTION</b>\n${this.escapeHtml(marketReaction)}\n\n`;

    const volume = dossier.volumeConfirmation?.confirmationStatus || dossier.optionsSellerView?.details?.volume || 'UNAVAILABLE';
    msg += `<b>VOLUME</b>\n${this.escapeHtml(volume)}\n\n`;

    const fnoView = dossier.optionsSellerView?.details?.volatilityEvidence || dossier.optionsSellerView?.details?.oiChange || 'UNAVAILABLE';
    msg += `<b>F&O VIEW</b>\n${this.escapeHtml(fnoView)}\n\n`;

    let confState = 'NEUTRAL';
    const osMc = dossier.optionsSellerView?.optionsSellerMarketConfirmation;
    if (osMc === 'AVOID') confState = 'CONTRADICTED';
    else if (osMc === 'INSUFFICIENT_EVIDENCE') confState = 'INSUFFICIENT_EVIDENCE';
    else if (osMc?.startsWith('FAVORABLE_')) confState = 'CONFIRMED';
    else if (osMc === 'WAIT_FOR_CONFIRMATION') confState = 'PARTIAL';
    else if (dossier.overallConfirmation) confState = dossier.overallConfirmation;

    msg += `<b>ATHENA CONFIRMATION</b>\n${confState}\n\n`;

    const traderState = dossier.tradeability || (confState === 'CONFIRMED' ? 'TRADEABLE' : confState === 'CONTRADICTED' ? 'NO_TRADE' : confState === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_EVIDENCE' : 'WATCH');
    msg += `<b>TRADER STATE</b>\n${traderState}\n\n`;

    const riskLevel = dossier.risk?.level || 'UNKNOWN';
    const riskReason = dossier.risk?.reason || '';
    msg += `<b>RISK</b>\n${riskLevel}${riskReason ? `: ${this.escapeHtml(riskReason)}` : ''}\n\n`;

    const sourceTier = dossier.evidence?.sourceAuthorityTier || 'Tier 1';
    const sourceName = dossier.evidence?.sourceName || 'Athena Verified Wire';
    msg += `<b>SOURCE</b>\n${this.escapeHtml(sourceTier)} + ${this.escapeHtml(sourceName)}\n\n`;

    msg += `🔗 <b>Open ATHENA</b>`;
    return msg;
  }

  /**
   * Format Phase 10.7 Production Signal Lifecycle update for Telegram.
   */
  public static formatLifecycleNotification(lifecycle: any, action: string, reason?: string): string {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    let header = '🚨 NEW SIGNAL';
    if (action === 'CONFIRMED' || action === 'CONFIRMATION') header = '✅ SIGNAL CONFIRMED';
    else if (action === 'UPDATED' || action === 'MATERIAL_UPDATE') header = '🔄 SIGNAL UPDATED';
    else if (action === 'WEAKENING') header = '⚠️ SIGNAL WEAKENING';
    else if (action === 'CONTRADICTED') header = '🔴 SIGNAL CONTRADICTED';
    else if (action === 'INVALIDATED') header = '⛔ SIGNAL INVALIDATED';
    else if (action === 'EXPIRED') header = '⌛ SIGNAL EXPIRED';

    let msg = `${divider}\n${header}\n${divider}\n\n`;
    msg += `<b>ENTITY:</b> ${this.escapeHtml(lifecycle.symbol ? lifecycle.symbol.toUpperCase() : 'UNKNOWN')}\n`;
    msg += `<b>EVENT TYPE:</b> ${this.escapeHtml(lifecycle.signalType || 'Catalyst Alert')}\n`;
    msg += `<b>LIFECYCLE STATE:</b> ${lifecycle.currentState}\n`;
    msg += `<b>ACTIONABILITY:</b> ${lifecycle.actionability}\n\n`;

    msg += `${divider}\n\n`;
    msg += `<b>SCORE PROFILE:</b>\n`;
    msg += `• <b>Initial Score:</b> ${lifecycle.initialScore}\n`;
    msg += `• <b>Current Score:</b> ${lifecycle.decayedScore} (Decay: ${lifecycle.decayFactor}x)\n`;
    msg += `• <b>Age:</b> ${lifecycle.scoreAge} seconds\n\n`;

    if (reason || lifecycle.invalidationReason || lifecycle.contradictionReason) {
      msg += `<b>DETAIL/REASON:</b>\n`;
      msg += `${this.escapeHtml(reason || lifecycle.invalidationReason || lifecycle.contradictionReason || 'Deterministic re-evaluation update')}\n\n`;
    }

    msg += `${divider}\n`;
    msg += `🔗 <b>Open ATHENA</b>`;
    return msg;
  }

  /**
   * Format Phase 9.4 Production Trader Decision Dossier for Telegram.
   */
  public static formatDecision(dossier: any): string {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    let dirIcon = '⚪';
    if (dossier.tradeability === 'TRADEABLE') {
      dirIcon = dossier.confirmedDirection === 'BULLISH' ? '🟢' : dossier.confirmedDirection === 'BEARISH' ? '🔴' : '🟢';
    } else if (dossier.tradeability === 'WATCH') {
      dirIcon = '🟡';
    } else if (dossier.tradeability === 'INSUFFICIENT_EVIDENCE') {
      dirIcon = '🔴';
    }

    let msg = `🚨 <b>ATHENA TRADE INTELLIGENCE</b>\n\n`;
    msg += `<b>${this.escapeHtml(dossier.entity ? dossier.entity.toUpperCase() : 'MARKET INSTRUMENT')}</b>\n`;
    msg += `<b>Event:</b> ${this.escapeHtml(dossier.eventType || 'Corporate Action')}\n\n`;
    msg += `${divider}\n\n`;

    msg += `🧠 <b>DECISION</b>\n`;
    msg += `${dirIcon} <b>${dossier.tradeability}</b>\n\n`;
    msg += `<b>Fundamental:</b> ${dossier.fundamentalDirection}\n`;
    msg += `<b>Market:</b> ${dossier.confirmedDirection}\n`;
    msg += `<b>Confidence:</b> ${dossier.decisionConfidence}%\n\n`;
    msg += `${divider}\n\n`;

    msg += `📊 <b>MARKET</b>\n`;
    const pChange = dossier.marketConfirmation?.priceChange;
    const pStr = pChange !== undefined ? `${pChange >= 0 ? '+' : ''}${pChange}%` : 'N/A';
    msg += `<b>Price Reaction:</b> ${pStr}\n`;
    msg += `<b>Volume:</b> ${dossier.volumeConfirmation?.confirmationStatus || 'N/A'}\n`;
    msg += `<b>F&O:</b> ${dossier.fnoConfirmation?.classification || 'N/A'}\n\n`;
    msg += `${divider}\n\n`;

    msg += `🎯 <b>OPTIONS SELLER</b>\n`;
    msg += `<b>${dossier.optionsSellerPlaybook?.strategy || 'NO_TRADE'}</b>\n\n`;
    if (dossier.optionsSellerPlaybook?.entryCondition) {
      msg += `<b>Trigger:</b>\n${this.escapeHtml(dossier.optionsSellerPlaybook.entryCondition)}\n\n`;
    }
    if (dossier.optionsSellerPlaybook?.invalidationCondition) {
      msg += `<b>Invalidation:</b>\n${this.escapeHtml(dossier.optionsSellerPlaybook.invalidationCondition)}\n\n`;
    }
    msg += `${divider}\n\n`;

    msg += `⚠️ <b>RISK</b>\n`;
    msg += `<b>${dossier.risk?.level || 'MODERATE'}</b>\n`;
    msg += `${this.escapeHtml(dossier.risk?.primaryRisk || 'Standard market risk.')}\n\n`;
    msg += `${divider}\n\n`;

    msg += `📚 <b>EVIDENCE</b>\n`;
    msg += `${this.escapeHtml(dossier.sourceAuthority || 'Tier 1 / Tier 2 verified source')}\n\n`;

    if (dossier.historicalPrecedent || dossier.historicalContext) {
      msg += TraderTelegramFormatter.formatHistoricalContextSection(dossier.historicalPrecedent || dossier.historicalContext);
    }

    msg += `🔗 <b>Open ATHENA</b>`;

    return msg;
  }

  /**
   * Formats Phase 10.9 Historical Context for Telegram alerts
   */
  public static formatHistoricalContextSection(precedent: any): string {
    if (!precedent) return '';
    const divider = '━━━━━━━━━━━━━━━━━━━━━━\n';
    let section = `${divider}📚 <b>Historical Context</b>\n`;

    if (precedent.sampleQuality === 'INSUFFICIENT_SAMPLE' || precedent.similarEventsCount < 5 || precedent.historicalDirectionalAccuracyPct === 'INSUFFICIENT_SAMPLE') {
      section += `Insufficient comparable events\n\n`;
    } else {
      section += `<b>Similar Events:</b> ${precedent.similarEventsCount}\n`;
      section += `<b>Historical Directional Accuracy:</b> ${precedent.historicalDirectionalAccuracyPct}%\n`;
      if (precedent.averageReactionPct !== undefined) {
        section += `<b>Average Reaction:</b> ${precedent.averageReactionPct}%\n`;
      }
      if (precedent.medianMFE !== undefined) {
        section += `<b>Median MFE:</b> +${precedent.medianMFE}%\n`;
      }
      if (precedent.medianMAE !== undefined) {
        section += `<b>Median MAE:</b> ${precedent.medianMAE}%\n`;
      }
      section += `<i>Historical observation (Descriptive only)</i>\n\n`;
    }

    return section;
  }
}

export const traderTelegramFormatter = new TraderTelegramFormatter();

