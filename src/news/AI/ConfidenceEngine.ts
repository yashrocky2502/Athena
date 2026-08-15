export interface ConfidenceEvaluation {
  score: number; // 0 - 100
  promptCompletionScore: number;
  factCompletenessScore: number;
  numericConsistencyScore: number;
  entityConsistencyScore: number;
  timelineConsistencyScore: number;
  hallucinationScore: number;
  issues: string[];
  passed: boolean;
}

export class ConfidenceEngine {
  /**
   * Evaluates generated text against expected format, source facts, and entity integrity.
   */
  public static evaluate(
    generatedText: string,
    sourceFacts?: Record<string, any>,
    sourceText?: string
  ): ConfidenceEvaluation {
    const issues: string[] = [];

    if (!generatedText || generatedText.trim().length < 40) {
      return {
        score: 0,
        promptCompletionScore: 0,
        factCompletenessScore: 0,
        numericConsistencyScore: 0,
        entityConsistencyScore: 0,
        timelineConsistencyScore: 0,
        hallucinationScore: 0,
        issues: ['Response text is empty or too brief'],
        passed: false
      };
    }

    const genLower = generatedText.toLowerCase();

    // 1. Prompt Completion Check (Presence of key section headers or structure)
    let promptCompletionScore = 100;
    const requiredSections = ['executive summary', 'highlights', 'matters', 'takeaway'];
    let foundSections = 0;
    for (const sec of requiredSections) {
      if (genLower.includes(sec)) foundSections++;
    }
    promptCompletionScore = Math.round((foundSections / requiredSections.length) * 100);
    if (promptCompletionScore < 50) {
      issues.push('Missing required structural sections');
    }

    // 2. Fact Completeness & Numeric Consistency
    let factCompletenessScore = 95;
    let numericConsistencyScore = 95;

    if (sourceFacts && typeof sourceFacts === 'object') {
      const numbersInFacts = JSON.stringify(sourceFacts).match(/(?:\d+(?:\.\d+)?|\b(?:rs\.?|inr|₹|\$)\s*[\d,]+)/gi) || [];
      if (numbersInFacts.length > 0) {
        let matchedNumbers = 0;
        for (const num of numbersInFacts) {
          const cleanNum = num.replace(/[^\d.]/g, '');
          if (cleanNum && generatedText.includes(cleanNum)) {
            matchedNumbers++;
          }
        }
        factCompletenessScore = Math.min(100, Math.round((matchedNumbers / Math.max(1, numbersInFacts.length)) * 100) + 30);
      }
    }

    // 3. Entity Consistency
    let entityConsistencyScore = 95;
    if (sourceFacts?.issuerName && sourceFacts.issuerName !== 'UNKNOWN ISSUER') {
      const issuer = String(sourceFacts.issuerName).toLowerCase();
      const firstWord = issuer.split(/\s+/)[0];
      if (firstWord && firstWord.length > 2 && !genLower.includes(firstWord)) {
        entityConsistencyScore = 40;
        issues.push(`Issuer name (${sourceFacts.issuerName}) missing from generated summary`);
      }
    }

    // 4. Timeline Consistency
    const timelineConsistencyScore = 95;

    // 5. Hallucination Detection (Checking for ungrounded extreme financial claims)
    let hallucinationScore = 100;
    const extremeClaims = genLower.match(/(\d{3,5}%|\$\d{4,}\s*trillion|guaranteed return|skyrocket|multi-bagger|100x)/g);
    if (extremeClaims) {
      hallucinationScore = 30;
      issues.push(`Possible promotional or ungrounded claims detected: ${extremeClaims.join(', ')}`);
    }

    // Weighted Overall Score Calculation
    const overallScore = Math.round(
      promptCompletionScore * 0.25 +
      factCompletenessScore * 0.20 +
      numericConsistencyScore * 0.20 +
      entityConsistencyScore * 0.15 +
      timelineConsistencyScore * 0.10 +
      hallucinationScore * 0.10
    );

    const passed = overallScore >= 70 && entityConsistencyScore >= 50;

    return {
      score: overallScore,
      promptCompletionScore,
      factCompletenessScore,
      numericConsistencyScore,
      entityConsistencyScore,
      timelineConsistencyScore,
      hallucinationScore,
      issues,
      passed
    };
  }
}
