/**
 * ATHENA NEWS ENGINE V3 — ENTITY MATCHER
 * 
 * Compares company tickers, primary companies, currency metrics, and financial entities.
 */

import { NormalizedDocument, NormalizedCompany } from '../normalization/types/NormalizationTypes';

export interface EntityMatchResult {
  companyOverlapScore: number; // 0 - 1
  tickerOverlapScore: number; // 0 - 1
  entityOverlapScore: number; // 0 - 1
  financialMetricScore: number; // 0 - 1
  hasMatchingPrimaryCompany: boolean;
  hasCompanyConflict: boolean;
}

export class EntityMatcher {
  /**
   * Matches entity alignment between two NormalizedDocuments.
   */
  public static matchEntities(docA: NormalizedDocument, docB: NormalizedDocument): EntityMatchResult {
    // 1. Primary Company check
    const primaryA = docA.primaryCompany;
    const primaryB = docB.primaryCompany;

    let hasMatchingPrimaryCompany = false;
    let hasCompanyConflict = false;

    if (primaryA && primaryB) {
      if (primaryA.ticker === primaryB.ticker) {
        hasMatchingPrimaryCompany = true;
      } else {
        // Different primary companies mentioned as primary!
        hasCompanyConflict = true;
      }
    }

    // 2. All Tickers Overlap
    const tickersA = new Set(docA.companies.map(c => c.ticker));
    const tickersB = new Set(docB.companies.map(c => c.ticker));

    let tickerOverlapScore = 0;
    if (tickersA.size > 0 && tickersB.size > 0) {
      let commonTickers = 0;
      tickersA.forEach(t => {
        if (tickersB.has(t)) commonTickers++;
      });
      tickerOverlapScore = commonTickers / Math.max(tickersA.size, tickersB.size);
    } else if (tickersA.size === 0 && tickersB.size === 0) {
      tickerOverlapScore = 1.0; // Macro/non-company stories match neutral
    }

    // 3. Company Name / Sector Overlap
    const companiesA = docA.companies.map(c => c.name.toLowerCase());
    const companiesB = docB.companies.map(c => c.name.toLowerCase());
    const companyOverlapScore = this.jaccardArray(companiesA, companiesB);

    // 4. Financial Currency Metric Overlap
    const metricsA = docA.currencies.map(c => `${c.currency}_${c.numericValueCr}`);
    const metricsB = docB.currencies.map(c => `${c.currency}_${c.numericValueCr}`);
    const financialMetricScore = this.jaccardArray(metricsA, metricsB);

    // Composite Entity Overlap
    const entityOverlapScore = (tickerOverlapScore * 0.5) + (companyOverlapScore * 0.3) + (financialMetricScore * 0.2);

    return {
      companyOverlapScore,
      tickerOverlapScore,
      entityOverlapScore,
      financialMetricScore,
      hasMatchingPrimaryCompany,
      hasCompanyConflict
    };
  }

  private static jaccardArray(arrA: string[], arrB: string[]): number {
    if (arrA.length === 0 && arrB.length === 0) return 1.0;
    if (arrA.length === 0 || arrB.length === 0) return 0;

    const setA = new Set(arrA);
    const setB = new Set(arrB);
    let intersection = 0;

    setA.forEach(item => {
      if (setB.has(item)) intersection++;
    });

    const union = new Set([...arrA, ...arrB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
