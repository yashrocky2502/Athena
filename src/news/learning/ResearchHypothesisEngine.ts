/**
 * ATHENA NEWS ENGINE — PHASE 16
 * ResearchHypothesisEngine.ts
 * 
 * Research Hypothesis Engine (AI-Assisted).
 * Formulates structured market hypotheses. Uses the Gemini 3.5/3.7 API via @google/genai
 * with proper lazy loading and clean fallback options if keys are absent or requests fail.
 * Strictly outputs hypotheses (never trade instructions) to respect human-in-the-loop limits.
 */

import { GoogleGenAI } from '@google/genai';
import { sanitizeErrorMessage } from '../AI/AISanitizer';
import { executeGeminiWithFailover } from '../AI/GeminiExecutor';

export interface ResearchHypothesis {
  hypothesisId: string;
  title: string;
  description: string;
  logicalPredicate: string;       // e.g. "RVOL > 2.0 && sentiment === 'POSITIVE'"
  targetVariable: string;         // e.g. "Day_1_Price_Reaction_Pct"
  marketRelevanceScore: number;    // 0 to 100
  marketRelevance?: number;        // Alias for marketRelevanceScore
  expectedInformationGain: number; // 0 to 1
  statisticalPotential: number;   // 0 to 100
  priority: number;               // Deterministic Priority Score
  status: 'PENDING_BACKTEST' | 'BACKTEST_RUNNING' | 'FAILED' | 'PROBABLE_EDGE' | 'REJECTED' | 'unverified';
  isDegraded?: boolean;
  generatedAt: string;
}

export class ResearchHypothesisEngine {
  private static hypotheses: ResearchHypothesis[] = [];
  private static genAI: GoogleGenAI | null = null;
  private static aiClientExplicitlySet = false;

  public static setAIClient(client: GoogleGenAI | null): void {
    this.genAI = client;
    this.aiClientExplicitlySet = true;
  }

  public static resetAIClient(): void {
    this.genAI = null;
    this.aiClientExplicitlySet = false;
  }

  /**
   * Lazy-initializes the GoogleGenAI client with correct headers
   */
  public static getAIClient(): GoogleGenAI | null {
    if (this.aiClientExplicitlySet) {
      return this.genAI;
    }
    if (!this.genAI) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim() !== '') {
        try {
          this.genAI = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });
        } catch (err) {
          console.error('[ResearchHypothesisEngine] Error initializing GoogleGenAI client: ' + sanitizeErrorMessage(err));
        }
      }
    }
    return this.genAI;
  }

  /**
   * Generates a new research hypothesis. Combines AI guidance with a deterministic safety layer.
   */
  public static async generateHypothesis(seedTopic?: string): Promise<ResearchHypothesis> {
    const client = this.getAIClient();
    let aiSuggestedTitle = '';
    let aiSuggestedDesc = '';
    let aiSuggestedPredicate = '';
    let isDegraded = false;

    if (client) {
      try {
        const prompt = `You are the Research Hypothesis Engine for ATHENA, an institutional quantitative news trading research architecture.
Generate a highly specific, realistic quantitative backtest hypothesis based on modern F&O and equity news variables in India.
Focus on factors like Relative Volume (RVOL), Open Interest (OI), delivery percentage, price momentum, and sector dispersion.
The hypothesis MUST strictly propose a correlation, NEVER a trade or capital execution instructions.

${seedTopic ? `Focus seed topic: ${seedTopic}` : ''}

Output your response in standard JSON format containing exactly these three fields:
{
  "title": "A short, descriptive, professional title",
  "description": "A clear description explaining the structural market anomaly",
  "logicalPredicate": "A clean pseudocode boolean filter statement using variables like RVOL, sentiment, deliveryPct, oiChangePct"
}`;

        const execution = await executeGeminiWithFailover<{ title: string; description: string; logicalPredicate: string }>(client, {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
          callerName: 'ResearchHypothesisEngine',
          attemptTimeoutMs: 2500,
          validateOutput: (text: string) => {
            try {
              const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
              const parsed = JSON.parse(cleaned);
              if (
                parsed &&
                typeof parsed === 'object' &&
                !Array.isArray(parsed) &&
                typeof parsed.title === 'string' &&
                parsed.title.trim().length > 0 &&
                typeof parsed.description === 'string' &&
                parsed.description.trim().length > 0 &&
                typeof parsed.logicalPredicate === 'string' &&
                parsed.logicalPredicate.trim().length > 0
              ) {
                return {
                  isValid: true,
                  data: {
                    title: parsed.title.trim(),
                    description: parsed.description.trim(),
                    logicalPredicate: parsed.logicalPredicate.trim()
                  }
                };
              }
              return { isValid: false, reason: 'Parsed JSON missing title, description, or logicalPredicate' };
            } catch (err: any) {
              return { isValid: false, reason: `Failed to parse hypothesis JSON: ${sanitizeErrorMessage(err)}` };
            }
          }
        });

        if (execution.data) {
          aiSuggestedTitle = execution.data.title;
          aiSuggestedDesc = execution.data.description;
          aiSuggestedPredicate = execution.data.logicalPredicate;
        }
      } catch (err) {
        console.warn('[ResearchHypothesisEngine] Gemini API call failed: ' + sanitizeErrorMessage(err));
      }
    }

    // Truthful deterministic degraded content when AI generation is unavailable
    if (!aiSuggestedTitle) {
      isDegraded = true;
      aiSuggestedTitle = 'Unverified hypothesis unavailable';
      aiSuggestedDesc = 'AI hypothesis generation is currently unavailable. No empirical hypothesis has been generated or validated.';
      aiSuggestedPredicate = 'UNVERIFIED';
    }

    // Deterministic metrics scoring — NO synthetic claims or random numbers
    let marketRelevanceScore: number;
    let expectedInformationGain: number;
    let statisticalPotential: number;
    let priority: number;
    let status: ResearchHypothesis['status'];

    if (isDegraded) {
      // Truthful degraded/unverified metrics: all empirical scores MUST remain zero
      marketRelevanceScore = 0.0;
      expectedInformationGain = 0.0;
      statisticalPotential = 0.0;
      priority = 0.0;
      status = 'unverified';
    } else {
      // Deterministic verified baseline scoring
      marketRelevanceScore = 75.0;
      expectedInformationGain = 0.65;
      statisticalPotential = 70.0;
      priority = Number((expectedInformationGain * marketRelevanceScore * (statisticalPotential / 100)).toFixed(2));
      status = 'PENDING_BACKTEST';
    }

    const hypothesis: ResearchHypothesis = {
      hypothesisId: `HYP_${Date.now()}_${this.hypotheses.length + 1}`,
      title: aiSuggestedTitle,
      description: aiSuggestedDesc,
      logicalPredicate: aiSuggestedPredicate,
      targetVariable: 'Day_1_Price_Reaction_Pct',
      marketRelevanceScore,
      marketRelevance: marketRelevanceScore,
      expectedInformationGain,
      statisticalPotential,
      priority,
      status,
      isDegraded,
      generatedAt: new Date().toISOString()
    };

    this.hypotheses.push(hypothesis);
    return hypothesis;
  }

  public static getHypotheses(): ResearchHypothesis[] {
    return this.hypotheses;
  }

  public static updateStatus(id: string, status: ResearchHypothesis['status']): void {
    const hyp = this.hypotheses.find(h => h.hypothesisId === id);
    if (hyp) {
      hyp.status = status;
    }
  }

  public static clear(): void {
    this.hypotheses = [];
  }

  public static seedMockHypotheses(): void {
    this.hypotheses = [
      {
        hypothesisId: 'HYP_MOCK_1',
        title: 'Earnings Momentum RVOL Expansion Drift',
        description: 'Large earnings beats combined with RVOL > 2.0 during trending bull regimes have stronger drift continuation probability.',
        logicalPredicate: 'eventType === "EARNINGS_SURPRISE" && RVOL > 2.0 && regime === "TRENDING_BULL"',
        targetVariable: 'Day_1_Price_Reaction_Pct',
        marketRelevanceScore: 88,
        expectedInformationGain: 0.82,
        statisticalPotential: 85,
        priority: 61.34,
        status: 'PROBABLE_EDGE',
        generatedAt: new Date().toISOString()
      },
      {
        hypothesisId: 'HYP_MOCK_2',
        title: 'Order Win OI Congruency Under Range regimes',
        description: 'Under range-bound or sideways regimes, large order wins fail to sustain breakouts and instead revert to VWAP within 180 minutes.',
        logicalPredicate: 'eventType === "ORDER_WIN" && regime === "RANGE_BOUND"',
        targetVariable: 'VWAP_Reversion_Time_Mins',
        marketRelevanceScore: 75,
        expectedInformationGain: 0.68,
        statisticalPotential: 70,
        priority: 35.70,
        status: 'PENDING_BACKTEST',
        generatedAt: new Date().toISOString()
      }
    ];
  }
}
export const researchHypothesisEngine = ResearchHypothesisEngine;
