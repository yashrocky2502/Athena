/**
 * ATHENA NEWS ENGINE V3 — CLASSIFICATION VALIDATOR
 * 
 * Strict quality gate validator for classification results.
 * Enforces company requirement rules, sector checks, category sanity, and routing presence.
 */

import { ClassificationResult, ClassificationValidationResult, ClassificationCategory } from './types/ClassificationTypes';

export class ClassificationValidator {
  private static readonly COMPANY_REQUIRED_CATEGORIES: Set<ClassificationCategory> = new Set([
    'QUARTERLY_RESULTS',
    'RESULT_PREVIEW',
    'RESULT_REACTION',
    'DIVIDEND',
    'BONUS',
    'SPLIT',
    'BUYBACK',
    'MERGER',
    'ACQUISITION',
    'ORDER_WIN',
    'ORDER_LOSS',
    'CEO_CHANGE',
    'CFO_CHANGE',
    'RESIGNATION',
    'MANAGEMENT_CHANGE',
    'BOARD_MEETING',
    'QIP',
    'RIGHTS_ISSUE',
    'PROMOTER_ACTION'
  ]);

  /**
   * Validates a ClassificationResult object.
   */
  public static validate(result: ClassificationResult): ClassificationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Unknown Category check
    if (result.primaryCategory === 'UNKNOWN') {
      errors.push('Rejected: Category is UNKNOWN');
    }

    // 2. Missing Routing check
    if (!result.targetParser || !result.targetParser.parserName) {
      errors.push('Rejected: Missing parser routing configuration');
    }

    // 3. Company Requirement check
    const isCompanyRequired = this.COMPANY_REQUIRED_CATEGORIES.has(result.primaryCategory);
    if (isCompanyRequired && result.resolvedCompanies.length === 0) {
      errors.push(`Rejected: Category ${result.primaryCategory} requires a resolved company entity`);
    }

    // 4. Sector Requirement check
    if (result.resolvedCompanies.length > 0) {
      const missingSector = result.resolvedCompanies.some(c => !c.sector);
      if (missingSector) {
        errors.push('Rejected: Resolved company is missing sector mapping');
      }
    }

    // 5. Conflicting categories check
    if (result.allCategories.includes('QUARTERLY_RESULTS') && result.allCategories.includes('RESULT_PREVIEW')) {
      errors.push('Rejected: Unresolved conflict between QUARTERLY_RESULTS and RESULT_PREVIEW');
    }

    // 6. Low Confidence Warning
    if (result.classificationConfidence < 60) {
      warnings.push(`Low classification confidence score: ${result.classificationConfidence}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
