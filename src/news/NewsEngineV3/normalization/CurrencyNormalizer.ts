/**
 * ATHENA NEWS ENGINE V3 — CURRENCY NORMALIZER
 * 
 * Extracts and normalizes financial currency metrics from text into Crores & Millions.
 * Handles INR (Rs., ₹, Cr, Lakh), USD ($, Bn, Mn), EUR (€), GBP (£).
 */

import { NormalizedCurrency } from './types/NormalizationTypes';

export class CurrencyNormalizer {
  private static readonly CURRENCY_REGEX = /(?:₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*(\d+(?:\.\d+)?)\s*(crore|cr|lakh|l|million|mn|billion|bn|trillion|tn)?/gi;

  /**
   * Extracts currency occurrences from text and converts them into standardized metrics.
   */
  public static extractAndNormalize(text: string): NormalizedCurrency[] {
    if (!text) return [];

    const results: NormalizedCurrency[] = [];
    const matches = Array.from(text.matchAll(this.CURRENCY_REGEX));

    for (const match of matches) {
      const fullText = match[0].trim();
      const numStr = match[1];
      const unitStr = (match[2] || '').toLowerCase();

      const rawAmount = parseFloat(numStr);
      if (isNaN(rawAmount)) continue;

      let currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'OTHER' = 'INR';
      if (fullText.startsWith('$') || /USD/i.test(fullText)) currency = 'USD';
      else if (fullText.startsWith('€') || /EUR/i.test(fullText)) currency = 'EUR';
      else if (fullText.startsWith('£') || /GBP/i.test(fullText)) currency = 'GBP';

      let unitMultiplier = 1;
      let numericValueCr = 0;
      let numericValueMn = 0;
      let standardizedDisplay = '';

      if (currency === 'INR') {
        if (unitStr === 'crore' || unitStr === 'cr') {
          unitMultiplier = 10000000;
          numericValueCr = rawAmount;
          numericValueMn = rawAmount * 1.2; // approx Cr to Mn equivalent
          standardizedDisplay = `₹${rawAmount} Cr`;
        } else if (unitStr === 'lakh' || unitStr === 'l') {
          unitMultiplier = 100000;
          numericValueCr = rawAmount / 100;
          numericValueMn = rawAmount / 8.33;
          standardizedDisplay = `₹${rawAmount} Lakh`;
        } else {
          numericValueCr = rawAmount / 10000000;
          numericValueMn = rawAmount / 83300000;
          standardizedDisplay = `₹${rawAmount}`;
        }
      } else {
        // USD / EUR / GBP
        const currSymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
        const usdRateInInr = 84; // Nominal reference conversion rate for Crores estimation

        if (unitStr === 'billion' || unitStr === 'bn') {
          unitMultiplier = 1000000000;
          numericValueMn = rawAmount * 1000;
          numericValueCr = (numericValueMn * usdRateInInr) / 10;
          standardizedDisplay = `${currSymbol}${rawAmount} Bn`;
        } else if (unitStr === 'million' || unitStr === 'mn') {
          unitMultiplier = 1000000;
          numericValueMn = rawAmount;
          numericValueCr = (numericValueMn * usdRateInInr) / 10;
          standardizedDisplay = `${currSymbol}${rawAmount} Mn`;
        } else if (unitStr === 'trillion' || unitStr === 'tn') {
          unitMultiplier = 1000000000000;
          numericValueMn = rawAmount * 1000000;
          numericValueCr = (numericValueMn * usdRateInInr) / 10;
          standardizedDisplay = `${currSymbol}${rawAmount} Tn`;
        } else {
          numericValueMn = rawAmount / 1000000;
          numericValueCr = (numericValueMn * usdRateInInr) / 10;
          standardizedDisplay = `${currSymbol}${rawAmount}`;
        }
      }

      results.push({
        originalText: fullText,
        currency,
        rawAmount,
        unitMultiplier,
        numericValueCr: Math.round(numericValueCr * 100) / 100,
        numericValueMn: Math.round(numericValueMn * 100) / 100,
        standardizedDisplay
      });
    }

    return results;
  }
}
