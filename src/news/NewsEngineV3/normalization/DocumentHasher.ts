/**
 * ATHENA NEWS ENGINE V3 — DOCUMENT HASHER
 * 
 * Generates deterministic hashes for raw text, normalized documents,
 * individual paragraphs, and individual sentences.
 * Used by Phase 4 Cross-Publisher Deduplication Engine.
 */

import { NormalizedParagraph, NormalizedSentence, NormalizedHashes } from './types/NormalizationTypes';

export class DocumentHasher {
  /**
   * Generates a deterministic 64-bit hex hash string for any input text.
   */
  public static hashString(str: string): string {
    if (!str) return '0000000000000000';

    let h1 = 0xdeadbeef ^ 0;
    let h2 = 0x41c6ce57 ^ 0;

    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');

    return `${hex1}${hex2}`;
  }

  /**
   * Generates complete NormalizedHashes structure.
   */
  public static generateHashes(
    rawText: string,
    normalizedText: string,
    paragraphs: NormalizedParagraph[],
    sentences: NormalizedSentence[]
  ): NormalizedHashes {
    const rawHash = this.hashString(rawText);
    const normalizedHash = this.hashString(normalizedText);
    const paragraphHashes = paragraphs.map(p => p.hash);
    const sentenceHashes = sentences.map(s => s.hash);

    return {
      rawHash,
      normalizedHash,
      paragraphHashes,
      sentenceHashes
    };
  }
}
