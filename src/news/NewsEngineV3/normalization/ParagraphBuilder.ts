/**
 * ATHENA NEWS ENGINE V3 — PARAGRAPH BUILDER
 * 
 * Preserves logical paragraph structures and prevents collapsing the document into a single block.
 * Generates paragraph hashes and word/character counts.
 */

import { NormalizedParagraph } from './types/NormalizationTypes';
import { DocumentHasher } from './DocumentHasher';

export class ParagraphBuilder {
  /**
   * Splits cleaned text into logical normalized paragraphs.
   */
  public static buildParagraphs(cleanedText: string): NormalizedParagraph[] {
    if (!cleanedText || !cleanedText.trim()) return [];

    // Split on double newlines or multiple newlines
    const rawChunks = cleanedText.split(/\n\s*\n+/);

    const paragraphs: NormalizedParagraph[] = [];
    let idx = 0;

    for (const chunk of rawChunks) {
      // Normalize internal whitespace of the paragraph chunk
      const paragraphText = chunk.replace(/[ \t]+/g, ' ').trim();

      if (paragraphText.length > 0) {
        const wordCount = paragraphText.split(/\s+/).filter(Boolean).length;
        const charCount = paragraphText.length;
        const hash = DocumentHasher.hashString(paragraphText);

        paragraphs.push({
          id: `PARA_${idx + 1}`,
          index: idx,
          text: paragraphText,
          wordCount,
          charCount,
          hash
        });

        idx++;
      }
    }

    // Fallback: If no double newlines were found but single newlines exist, try single newline if paragraph count is 1
    if (paragraphs.length === 1 && cleanedText.includes('\n')) {
      const singleNewlineChunks = cleanedText.split(/\n+/);
      if (singleNewlineChunks.length > 1) {
        const fallbackParagraphs: NormalizedParagraph[] = [];
        let fIdx = 0;
        for (const fChunk of singleNewlineChunks) {
          const fText = fChunk.replace(/[ \t]+/g, ' ').trim();
          if (fText.length > 0) {
            const fWordCount = fText.split(/\s+/).filter(Boolean).length;
            const fCharCount = fText.length;
            const fHash = DocumentHasher.hashString(fText);

            fallbackParagraphs.push({
              id: `PARA_${fIdx + 1}`,
              index: fIdx,
              text: fText,
              wordCount: fWordCount,
              charCount: fCharCount,
              hash: fHash
            });
            fIdx++;
          }
        }
        if (fallbackParagraphs.length > 1) {
          return fallbackParagraphs;
        }
      }
    }

    return paragraphs;
  }
}
