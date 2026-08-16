import { describe, it, expect } from 'vitest';
import { getAllSectionDefinitions, isValidSectionId, normalizeSectionId } from '../types/NewsSection';

describe('Stage 6.1: Section UX & Taxonomy Validation', () => {
  it('should have exactly 16 fixed sections with complete explanations and correct ordering', () => {
    const definitions = getAllSectionDefinitions();
    expect(definitions.length).toBe(16);
    for (const def of definitions) {
      expect(def.id).toBeDefined();
      expect(def.name).toBeDefined();
      expect(def.explanation).toBeDefined();
      expect(typeof def.order).toBe('number');
    }
  });

  it('should successfully normalize valid aliases and reject invalid section IDs', () => {
    expect(normalizeSectionId('FNO')).toBe('FNO');
    expect(normalizeSectionId('F&O')).toBe('FNO');
    expect(normalizeSectionId('MARKET')).toBe('MARKET');
    expect(normalizeSectionId('INVALID_SECTION')).toBeNull();
    expect(isValidSectionId('BREAKING')).toBe(true);
    expect(isValidSectionId('BAD')).toBe(false);
  });
});
