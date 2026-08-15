import { StoryImpact, Priority, EventType } from "../types";

export interface AnalysisResult {
  impact: StoryImpact;
  severityScore: number;
  priority: Priority;
  detectionConfidence: number;
  impactConfidence: number;
}

export class ImpactAnalyzer {
  /**
   * Analyzes an event to determine Story Impact, Severity Score, and Priority.
   */
  public static analyze(params: {
    title: string;
    description: string;
    category: EventType;
    metadata?: any;
    evidenceCount: number;
    sourceCredibility: number;
  }): AnalysisResult {
    const { title, description, category, metadata = {}, evidenceCount, sourceCredibility } = params;
    const text = `${title} ${description}`.toLowerCase();

    // 1. Determine Story Impact
    let impact = StoryImpact.Unknown;
    const positiveKeywords = [
      "expansion", "growth", "profit", "surge", "gain", "strengthening", "upgrade", "won", "secured", 
      "commissioned", "breakeven", "record high", "bullish", "positive", "hike", "approval", "cleared",
      "success", "recovery", "outperformed", "beat", "dividend", "buyback", "promoter buying"
    ];

    const negativeKeywords = [
      "drop", "loss", "warning", "fine", "penalty", "weakening", "downgrade", "slowdown", "slump", 
      "cut", "decline", "fell", "deficit", "risk", "hazard", "investigation", "sanction", "bearish",
      "negative", "depressed", "struggle", "friction", "panic", "promoter selling", "default"
    ];

    let pos = positiveKeywords.filter(kw => text.includes(kw)).length;
    let neg = negativeKeywords.filter(kw => text.includes(kw)).length;

    if (pos > neg) impact = StoryImpact.Positive;
    else if (neg > pos) impact = StoryImpact.Negative;
    else impact = StoryImpact.Neutral;

    // 2. Dynamic Severity Scoring (0-100)
    let score = 0;

    // Base weight by category
    const categoryWeights: Record<EventType, number> = {
      [EventType.Earnings]: 25,
      [EventType.CorporateAction]: 15,
      [EventType.OrderWin]: 20,
      [EventType.MA]: 30,
      [EventType.RegulatoryFiling]: 35,
      [EventType.ManagementCommentary]: 10,
      [EventType.CreditRating]: 20,
      [EventType.Dividend]: 5,
      [EventType.Buyback]: 10,
      [EventType.PromoterActivity]: 25,
      [EventType.BlockBulkDeal]: 15,
      [EventType.FIIDIIFlow]: 15,
      [EventType.InsiderTrading]: 30,
      [EventType.IndexInclusionRemoval]: 20,
      [EventType.SectorRotation]: 10,
      [EventType.MacroEconomy]: 15,
      [EventType.RBIPolicy]: 40,
      [EventType.GovernmentPolicy]: 30,
      [EventType.CommodityImpact]: 15,
      [EventType.ForexImpact]: 15,
      [EventType.TechnicalBreakout]: 15,
      [EventType.UnusualVolume]: 15,
      [EventType.MarketWideRisk]: 45
    };

    // If it's a pure price alert, we reset base category weight or use a lower one
    // as the price movement itself will drive the score.
    if (category === "Price Alert" as any) {
      score = 0;
    } else {
      score += categoryWeights[category] || 10;
    }

    // Price Movement Impact with Volatility-Aware Rules
    if (metadata.priceMovement !== undefined) {
      const movement = Math.abs(metadata.priceMovement);
      const cap = this.categorizeMarketCap(metadata.marketCap, metadata.capString);
      
      let movementScore = 0;
      let pricePriority = Priority.Ignore;

      if (cap === "Large") {
        if (movement > 8) { movementScore = 90; pricePriority = Priority.Critical; }
        else if (movement > 6) { movementScore = 75; pricePriority = Priority.High; }
        else if (movement > 4) { movementScore = 50; pricePriority = Priority.Medium; }
        else if (movement > 2) { movementScore = 25; pricePriority = Priority.Low; }
        else { movementScore = 0; pricePriority = Priority.Ignore; }
      } else if (cap === "Mid") {
        if (movement > 8) { movementScore = 90; pricePriority = Priority.Critical; }
        else if (movement > 5) { movementScore = 70; pricePriority = Priority.High; }
        else if (movement > 3) { movementScore = 45; pricePriority = Priority.Medium; }
        else { movementScore = 0; pricePriority = Priority.Ignore; }
      } else { // Small Cap
        if (movement > 10) { movementScore = 90; pricePriority = Priority.Critical; }
        else if (movement > 5) { movementScore = 65; pricePriority = Priority.High; }
        else { movementScore = 0; pricePriority = Priority.Ignore; }
      }

      // Movement Significance Adjustment (Relative to Market/Sector)
      if (metadata.marketMovement !== undefined) {
        const relativeMovement = Math.abs(metadata.priceMovement - metadata.marketMovement);
        // If stock is moving with the market, reduce score
        // If stock is moving against or much faster than market, increase score
        const marketCorrelation = Math.abs(metadata.marketMovement) > 0 ? 
          (metadata.priceMovement * metadata.marketMovement > 0 ? 0.7 : 1.3) : 1.0;
        
        movementScore *= marketCorrelation;
        
        // Add significance based on relative delta
        if (relativeMovement > 3) movementScore += 10;
        if (relativeMovement > 5) movementScore += 15;
      }

      // Volume Spike Impact
      if (metadata.volumeChange && metadata.volumeChange > 2) { // > 2x average volume
        movementScore += Math.min(15, (metadata.volumeChange - 1) * 3);
      }

      score += movementScore;
    }

    // Evidence & Source Multiplier
    score += Math.min(10, (evidenceCount - 1) * 2);
    score += (sourceCredibility / 100) * 10;

    // Sentiment intensity
    if (pos > 3 || neg > 3) score += 10;

    // Final Clamp
    const severityScore = Math.min(100, Math.round(score));

    // 3. Determine Priority (Re-derive based on refined score)
    let priority = Priority.Low;
    if (severityScore >= 85) priority = Priority.Critical;
    else if (severityScore >= 65) priority = Priority.High;
    else if (severityScore >= 40) priority = Priority.Medium;
    else if (severityScore >= 15) priority = Priority.Low;
    else priority = Priority.Ignore;

    // 4. Confidence Calculations
    const detectionConfidence = Math.min(100, Math.round((sourceCredibility * 0.7) + (evidenceCount * 5)));
    const impactConfidence = Math.min(100, Math.round(70 + (pos + neg) * 5));

    return { impact, severityScore, priority, detectionConfidence, impactConfidence };
  }

  private static categorizeMarketCap(capNum?: number, capStr?: string): "Large" | "Mid" | "Small" {
    if (capStr) {
      const lower = capStr.toLowerCase();
      if (lower.includes("lakh cr") || lower.includes("large")) return "Large";
      if (lower.includes("mid")) return "Mid";
      if (lower.includes("small")) return "Small";
      
      // Parse numeric from string like "₹1.5 Lakh Cr" or "₹15000 Cr"
      const numMatch = capStr.match(/₹?([\d.]+)/);
      if (numMatch) {
        let val = parseFloat(numMatch[1]);
        if (lower.includes("lakh")) val *= 100000;
        if (val > 20000) return "Large";
        if (val > 5000) return "Mid";
      }
    }

    if (capNum) {
      const cr = capNum / 1e7;
      if (cr > 20000) return "Large";
      if (cr > 5000) return "Mid";
    }

    return "Small";
  }
}
