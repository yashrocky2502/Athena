export type FNOConfidence = "HIGH" | "MEDIUM" | "NONE";
export type FNODecision = "INCLUDE" | "EXCLUDE";

export interface FNOClassificationResult {
  eligible: boolean;
  symbol: string | null;
  confidence: FNOConfidence;
  decision: FNODecision;
  reason: string;
}
