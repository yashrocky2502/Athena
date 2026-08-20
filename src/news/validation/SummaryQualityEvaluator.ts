/**
 * ATHENA NEWS ENGINE — SUMMARY QUALITY EVALUATOR (STAGE 7.6)
 */

export type SummaryQuality = "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "WEAK" | "FAILED";

export interface SummaryEvaluationResult {
  score: number;
  quality: SummaryQuality;
  breakdown: {
    factualAccuracy: number; // 25
    coverageOfKeyFacts: number; // 20
    entityAccuracy: number; // 15
    numericalAccuracy: number; // 15
    whyItMattersQuality: number; // 10
    conciseness: number; // 10
    headlineIndependence: number; // 5
  };
  reasons: string[];
}

export class SummaryQualityEvaluator {
  public static evaluate(
    summaryData: {
      summary?: string;
      whatHappened?: string;
      whyItMatters?: string;
      importantNumbers?: Array<{ value: string; context: string }>;
    },
    headline: string,
    articleBody: string
  ): SummaryEvaluationResult {
    const reasons: string[] = [];
    const textSummary = (summaryData.summary || "").trim();
    const whatHappened = (summaryData.whatHappened || "").trim();
    const whyItMatters = (summaryData.whyItMatters || "").trim();
    const fullSummaryText = `${textSummary} ${whatHappened} ${whyItMatters}`.trim();

    if (!fullSummaryText || fullSummaryText.length < 20) {
      return {
        score: 0,
        quality: "FAILED",
        breakdown: {
          factualAccuracy: 0,
          coverageOfKeyFacts: 0,
          entityAccuracy: 0,
          numericalAccuracy: 0,
          whyItMattersQuality: 0,
          conciseness: 0,
          headlineIndependence: 0
        },
        reasons: ["Empty or trivially short summary text."]
      };
    }

    // 1. Headline Independence (5) & Semantic Repetition Check
    let headlineIndependence = 5;
    const lowerHeadline = headline.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    const lowerSummary = textSummary.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    
    // Check direct word overlap ratio
    const headlineWords = new Set(lowerHeadline.split(/\s+/).filter(w => w.length > 3));
    const summaryWords = lowerSummary.split(/\s+/).filter(w => w.length > 3);
    const overlappingHeadlineWords = summaryWords.filter(w => headlineWords.has(w));
    const overlapRatio = summaryWords.length > 0 ? overlappingHeadlineWords.length / summaryWords.length : 0;

    // Check string similarity / Levenshtein-like character repetition
    const isDirectCopy = lowerSummary === lowerHeadline || lowerSummary.includes(lowerHeadline) || lowerHeadline.includes(lowerSummary);

    if (isDirectCopy || overlapRatio > 0.85) {
      headlineIndependence = 0;
      reasons.push("Summary is a verbatim or near-verbatim repetition of headline.");
    }

    // 2. Factual Accuracy (25)
    let factualAccuracy = 25;
    // Check if summary contains words completely alien to article body
    if (articleBody && articleBody.length > 50) {
      const lowerBody = articleBody.toLowerCase();
      const nonHeadlineSummaryWords = summaryWords.filter(w => !headlineWords.has(w));
      const halluCount = nonHeadlineSummaryWords.filter(w => !lowerBody.includes(w)).length;
      if (halluCount > 5) {
        factualAccuracy = 10;
        reasons.push("Summary contains terms unsupported by article body.");
      }
    }

    // 3. Coverage of Key Facts (20)
    let coverageOfKeyFacts = 20;
    if (fullSummaryText.length < 150) {
      coverageOfKeyFacts = 10;
      reasons.push("Summary lacks sufficient depth of facts.");
    }

    // 4. Entity Accuracy (15)
    let entityAccuracy = 15;
    // Check for malformed entity strings like "ibe for Lalithaa"
    if (/ibe for|subscribe for/i.test(fullSummaryText) && !/recommendation|rating/i.test(fullSummaryText)) {
      entityAccuracy = 5;
      reasons.push("Malformed entity prefix detected in summary text.");
    }

    // 5. Numerical Accuracy (15)
    let numericalAccuracy = 15;
    if (summaryData.importantNumbers && summaryData.importantNumbers.length > 0 && articleBody) {
      const lowerBody = articleBody.toLowerCase();
      for (const num of summaryData.importantNumbers) {
        const numVal = (num.value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (numVal && !lowerBody.replace(/[^a-z0-9]/g, "").includes(numVal)) {
          numericalAccuracy = 0;
          reasons.push(`Invented numerical value detected: ${num.value}`);
          break;
        }
      }

      if (numericalAccuracy === 15) {
        if (summaryData.importantNumbers.length === 1) {
          numericalAccuracy = 5;
        }
      }
    } else if ((!summaryData.importantNumbers || summaryData.importantNumbers.length === 0) && articleBody && /\d/.test(articleBody)) {
      numericalAccuracy = 0;
      reasons.push("Failed to extract any important numbers from a numerically dense article");
    }

    // 6. Why-It-Matters Quality (10)
    let whyItMattersQuality = 10;
    if (!whyItMatters || whyItMatters.length < 15) {
      whyItMattersQuality = 3;
      reasons.push("Missing or weak 'Why It Matters' section.");
    }

    // 7. Conciseness (10)
    let conciseness = 10;
    if (fullSummaryText.length > 1000) {
      conciseness = 5;
      reasons.push("Summary is excessively verbose (>1000 chars).");
    }

    // Total Score
    let totalScore = factualAccuracy + coverageOfKeyFacts + entityAccuracy + numericalAccuracy + whyItMattersQuality + conciseness + headlineIndependence;

    // Hard penalty if summary merely repeats headline
    if (headlineIndependence === 0) {
      totalScore = Math.min(totalScore, 35); // Force to FAILED
    }

    // Hard penalty if severe numerical hallucination exists
    if (numericalAccuracy === 0) {
      totalScore = Math.min(totalScore, 45); // Force score to be low
    }

    // Hard penalty if forbidden trading advice or guaranteed return language exists
    const forbiddenAdviceRegex = /100% guaranteed|sure shot|guaranteed profit|massive gains|buy immediately|must buy now|target 1000%|risk free profit/gi;
    const hasForbiddenAdvice = forbiddenAdviceRegex.test(textSummary) || forbiddenAdviceRegex.test(whatHappened) || forbiddenAdviceRegex.test(whyItMatters);
    if (hasForbiddenAdvice) {
      totalScore = Math.min(totalScore, 30); // Force to <= 30
      reasons.push("Contains forbidden trading advice / guaranteed return language");
    }

    let quality: SummaryQuality = "FAILED";
    if (totalScore >= 90) quality = "EXCELLENT";
    else if (totalScore >= 80) quality = "GOOD";
    else if (totalScore >= 65) quality = "ACCEPTABLE";
    else if (totalScore >= 40) quality = "WEAK";
    else quality = "FAILED";

    return {
      score: totalScore,
      quality,
      breakdown: {
        factualAccuracy,
        coverageOfKeyFacts,
        entityAccuracy,
        numericalAccuracy,
        whyItMattersQuality,
        conciseness,
        headlineIndependence
      },
      reasons
    };
  }
}
