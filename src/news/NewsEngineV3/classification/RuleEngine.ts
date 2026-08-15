/**
 * ATHENA NEWS ENGINE V3 — RULE ENGINE
 * 
 * Executes rule matching across normalized financial documents.
 * Handles multi-label classification and automatic conflict resolution (e.g. Quarterly Results vs Result Preview).
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { CategoryRules, CategoryRuleDefinition } from './CategoryRules';
import { CategoryMatch, ClassificationCategory } from './types/ClassificationTypes';

export class RuleEngine {
  /**
   * Evaluates all category rules on a normalized document.
   */
  public static evaluateRules(doc: NormalizedDocument): { matches: CategoryMatch[]; conflicts: string[] } {
    const titleText = doc.title;
    const bodyText = doc.plainText.slice(0, 3000);
    const fullText = `${titleText} \n ${bodyText}`;

    const rawMatches: CategoryMatch[] = [];

    for (const rule of CategoryRules.RULES) {
      // Check negative patterns first
      if (rule.negativePatterns) {
        const hasNegative = rule.negativePatterns.some(p => p.test(fullText));
        if (hasNegative) continue;
      }

      // Check positive patterns
      let matchedKeywords: string[] = [];
      let isMatched = false;

      for (const pattern of rule.patterns) {
        const match = pattern.exec(fullText);
        if (match) {
          isMatched = true;
          matchedKeywords.push(match[0]);
        }
      }

      if (isMatched) {
        // Higher confidence if title match vs body-only match
        const isTitleMatch = rule.patterns.some(p => p.test(titleText));
        const confidence = isTitleMatch ? rule.weight : Math.round(rule.weight * 0.85);

        rawMatches.push({
          category: rule.category,
          confidence,
          matchedKeywords: Array.from(new Set(matchedKeywords)),
          ruleId: rule.id
        });
      }
    }

    // Perform Conflict Resolution
    return this.resolveConflicts(rawMatches);
  }

  /**
   * Deterministically resolves category conflicts.
   */
  private static resolveConflicts(matches: CategoryMatch[]): { matches: CategoryMatch[]; conflicts: string[] } {
    const conflicts: string[] = [];
    let categories = new Set<ClassificationCategory>(matches.map(m => m.category));

    // Conflict Rule 1: QUARTERLY_RESULTS vs RESULT_PREVIEW
    if (categories.has('QUARTERLY_RESULTS') && categories.has('RESULT_PREVIEW')) {
      conflicts.push('Resolved conflict: QUARTERLY_RESULTS vs RESULT_PREVIEW -> Keep RESULT_PREVIEW');
      categories.delete('QUARTERLY_RESULTS');
    }

    // Conflict Rule 2: QUARTERLY_RESULTS vs RESULT_REACTION
    if (categories.has('QUARTERLY_RESULTS') && categories.has('RESULT_REACTION')) {
      conflicts.push('Resolved conflict: QUARTERLY_RESULTS vs RESULT_REACTION -> Keep RESULT_REACTION');
      categories.delete('QUARTERLY_RESULTS');
    }

    // Conflict Rule 3: RESULT_PREVIEW vs RESULT_REACTION
    if (categories.has('RESULT_PREVIEW') && categories.has('RESULT_REACTION')) {
      conflicts.push('Resolved conflict: RESULT_PREVIEW vs RESULT_REACTION -> Keep RESULT_REACTION');
      categories.delete('RESULT_PREVIEW');
    }

    // Filter matches based on remaining categories
    const resolvedMatches = matches.filter(m => categories.has(m.category));

    // Deduplicate matches per category (keep highest confidence)
    const categoryMap = new Map<ClassificationCategory, CategoryMatch>();
    for (const match of resolvedMatches) {
      const existing = categoryMap.get(match.category);
      if (!existing || match.confidence > existing.confidence) {
        categoryMap.set(match.category, match);
      }
    }

    return {
      matches: Array.from(categoryMap.values()),
      conflicts
    };
  }
}
