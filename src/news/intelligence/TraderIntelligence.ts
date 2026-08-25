import {
  TraderIntelligence as ITraderIntelligence,
  TraderIntelligenceEventType,
  EvidenceState,
  EvidenceItem,
  TraderRelevanceProfile,
  MarketReactionData,
  FnoIntelligenceData,
  WhatChangedData,
  ConfidenceData
} from './TraderIntelligenceTypes.ts';

export class TraderIntelligence implements ITraderIntelligence {
  public eventId?: string;
  public articleId: string;
  public entity: string;
  public symbol: string | null;
  public category: string;
  public eventType: TraderIntelligenceEventType;
  public executiveInterpretation: string;
  public fundamentalImpact: EvidenceState;
  public fundamentalMechanism: string;
  public marketImpact: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED' | 'UNKNOWN';
  public marketDirection: string;
  public marketReaction: MarketReactionData;
  public traderRelevance: TraderRelevanceProfile[];
  public fnoIntelligence: FnoIntelligenceData;
  public evidence: EvidenceItem[];
  public evidenceQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  public confidence: ConfidenceData;
  public uncertainty: string[];
  public whatChanged: WhatChangedData;
  public whatToMonitor: string[];
  public generatedAt: string;
  public engineVersion: string;

  constructor(data: ITraderIntelligence) {
    this.eventId = data.eventId;
    this.articleId = data.articleId;
    this.entity = data.entity;
    this.symbol = data.symbol;
    this.category = data.category;
    this.eventType = data.eventType;
    this.executiveInterpretation = data.executiveInterpretation;
    this.fundamentalImpact = data.fundamentalImpact;
    this.fundamentalMechanism = data.fundamentalMechanism;
    this.marketImpact = data.marketImpact;
    this.marketDirection = data.marketDirection;
    this.marketReaction = data.marketReaction;
    this.traderRelevance = data.traderRelevance;
    this.fnoIntelligence = data.fnoIntelligence;
    this.evidence = data.evidence;
    this.evidenceQuality = data.evidenceQuality;
    this.confidence = data.confidence;
    this.uncertainty = data.uncertainty;
    this.whatChanged = data.whatChanged;
    this.whatToMonitor = data.whatToMonitor;
    this.generatedAt = data.generatedAt || new Date().toISOString();
    this.engineVersion = data.engineVersion || 'ATHENA_V9_EVIDENCE';
  }

  /**
   * Safe serialization to JSON.
   */
  public toJSON(): ITraderIntelligence {
    return {
      eventId: this.eventId,
      articleId: this.articleId,
      entity: this.entity,
      symbol: this.symbol,
      category: this.category,
      eventType: this.eventType,
      executiveInterpretation: this.executiveInterpretation,
      fundamentalImpact: this.fundamentalImpact,
      fundamentalMechanism: this.fundamentalMechanism,
      marketImpact: this.marketImpact,
      marketDirection: this.marketDirection,
      marketReaction: this.marketReaction,
      traderRelevance: this.traderRelevance,
      fnoIntelligence: this.fnoIntelligence,
      evidence: this.evidence,
      evidenceQuality: this.evidenceQuality,
      confidence: this.confidence,
      uncertainty: this.uncertainty,
      whatChanged: this.whatChanged,
      whatToMonitor: this.whatToMonitor,
      generatedAt: this.generatedAt,
      engineVersion: this.engineVersion
    };
  }

  /**
   * Validates if a dimension has verified supporting evidence.
   */
  public isVerified(dimension: 'fundamental' | 'marketReaction' | 'fno'): boolean {
    if (dimension === 'fundamental') {
      return this.fundamentalImpact === 'VERIFIED';
    }
    if (dimension === 'marketReaction') {
      return this.marketReaction.status === 'VERIFIED';
    }
    if (dimension === 'fno') {
      return this.fnoIntelligence.status === 'VERIFIED' && this.fnoIntelligence.available;
    }
    return false;
  }
}
