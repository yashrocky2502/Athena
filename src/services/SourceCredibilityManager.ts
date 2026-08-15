import { SearchSource } from "../types";

export class SourceCredibilityManager {
  private static instance: SourceCredibilityManager;
  
  private weights: Record<string, number> = {
    "NSE": 100,
    "BSE": 100,
    "RBI": 100,
    "SEBI": 100,
    "Company Exchange Filing": 100,
    "Company IR": 95,
    "Reuters": 95,
    "Bloomberg": 95,
    "Moneycontrol": 90,
    "Economic Times": 90,
    "Business Standard": 90,
    "Google News": 70,
    "Unknown": 40
  };

  private constructor() {}

  public static getInstance(): SourceCredibilityManager {
    if (!SourceCredibilityManager.instance) {
      SourceCredibilityManager.instance = new SourceCredibilityManager();
    }
    return SourceCredibilityManager.instance;
  }

  public getWeight(source: string | SearchSource): number {
    const s = typeof source === "string" ? source : source.title;
    
    // Check for exact match
    if (this.weights[s]) return this.weights[s];
    
    // Partial match (e.g. "NSE India" -> "NSE")
    for (const [key, weight] of Object.entries(this.weights)) {
      if (s.toLowerCase().includes(key.toLowerCase())) {
        return weight;
      }
    }
    
    return this.weights["Unknown"];
  }

  public calculateConfidence(evidenceList: { source: string; baseConfidence: number }[]): number {
    if (evidenceList.length === 0) return 0;
    
    let totalWeightedConfidence = 0;
    let totalWeight = 0;
    
    evidenceList.forEach(e => {
      const weight = this.getWeight(e.source);
      totalWeightedConfidence += (e.baseConfidence * (weight / 100));
      totalWeight += (weight / 100);
    });
    
    // Average confidence weighted by source credibility
    const weightedAvg = totalWeightedConfidence / totalWeight;
    
    // Bonus for multiple sources (coverage bonus)
    const uniqueSources = new Set(evidenceList.map(e => e.source)).size;
    const coverageBonus = Math.min(10, (uniqueSources - 1) * 2);
    
    return Math.min(100, weightedAvg + coverageBonus);
  }
}
