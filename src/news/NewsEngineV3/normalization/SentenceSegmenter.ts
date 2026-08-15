/**
 * ATHENA NEWS ENGINE V3 — SENTENCE SEGMENTER
 * 
 * Financial-grade sentence tokenizer with abbreviation and metric protection.
 * Prevents false sentence splits on:
 * - Currency prefixes: Rs., ₹, $
 * - Corporate suffixes: Ltd., Inc., Pvt., Co., Corp.
 * - Month abbreviations: Jan., Feb., Mar., Apr., Aug., Sept., Oct., Nov., Dec.
 * - Metric codes: Q1 FY27, FY26, YoY, QoQ, MoM, %, decimals (5.4%)
 * - Decimal numbers e.g. "Rs. 593.50 crore"
 */

import { NormalizedParagraph, NormalizedSentence } from './types/NormalizationTypes';
import { DocumentHasher } from './DocumentHasher';

export class SentenceSegmenter {
  private static readonly PROTECTED_ABBREVIATIONS: Record<string, string> = {
    'Rs.': 'Rs__DOT__',
    'rs.': 'rs__DOT__',
    'RS.': 'RS__DOT__',
    'Ltd.': 'Ltd__DOT__',
    'ltd.': 'ltd__DOT__',
    'Inc.': 'Inc__DOT__',
    'Pvt.': 'Pvt__DOT__',
    'pvt.': 'pvt__DOT__',
    'Co.': 'Co__DOT__',
    'co.': 'co__DOT__',
    'Corp.': 'Corp__DOT__',
    'Bros.': 'Bros__DOT__',
    'Mfg.': 'Mfg__DOT__',
    'Jan.': 'Jan__DOT__',
    'Feb.': 'Feb__DOT__',
    'Mar.': 'Mar__DOT__',
    'Apr.': 'Apr__DOT__',
    'Jun.': 'Jun__DOT__',
    'Jul.': 'Jul__DOT__',
    'Aug.': 'Aug__DOT__',
    'Sep.': 'Sep__DOT__',
    'Sept.': 'Sept__DOT__',
    'Oct.': 'Oct__DOT__',
    'Nov.': 'Nov__DOT__',
    'Dec.': 'Dec__DOT__',
    'Dr.': 'Dr__DOT__',
    'Mr.': 'Mr__DOT__',
    'Mrs.': 'Mrs__DOT__',
    'Ms.': 'Ms__DOT__',
    'Prof.': 'Prof__DOT__',
    'vs.': 'vs__DOT__',
    'v.': 'v__DOT__',
    'No.': 'No__DOT__',
    'Nos.': 'Nos__DOT__',
    'St.': 'St__DOT__'
  };

  /**
   * Tokenizes paragraphs into sentence objects preserving protected tokens.
   */
  public static segmentParagraphs(paragraphs: NormalizedParagraph[]): NormalizedSentence[] {
    const sentences: NormalizedSentence[] = [];
    let globalIdx = 0;

    paragraphs.forEach(para => {
      let text = para.text;
      const detectedTokens: string[] = [];

      // 1. Protect numeric decimals (e.g. 593.50 -> 593__DECIMAL__50)
      text = text.replace(/(\d+)\.(\d+)/g, (match, p1, p2) => {
        detectedTokens.push(match);
        return `${p1}__DECIMAL__${p2}`;
      });

      // 2. Protect known abbreviations
      Object.entries(this.PROTECTED_ABBREVIATIONS).forEach(([abbr, replacement]) => {
        if (text.includes(abbr)) {
          detectedTokens.push(abbr);
          text = text.replace(new RegExp(this.escapeRegex(abbr), 'g'), replacement);
        }
      });

      // 3. Protect ellipses
      text = text.replace(/\.\.\./g, '__ELLIPSIS__');

      // 4. Split into sentences on [.!?] followed by whitespace or end of line
      const rawSentences = text.split(/(?<=[.!?])\s+(?=[A-Z"'\u201C\u2018\u20B9₹$0-9])/g);

      let inParaIdx = 0;
      rawSentences.forEach(rawSent => {
        let sentText = rawSent;

        // Restore protected replacements
        sentText = sentText.replace(/__DECIMAL__/g, '.');
        Object.entries(this.PROTECTED_ABBREVIATIONS).forEach(([abbr, replacement]) => {
          sentText = sentText.replace(new RegExp(replacement, 'g'), abbr);
        });
        sentText = sentText.replace(/__ELLIPSIS__/g, '...');

        sentText = sentText.trim();
        if (sentText.length > 0) {
          const hash = DocumentHasher.hashString(sentText);

          sentences.push({
            id: `SENT_${globalIdx + 1}`,
            paragraphIndex: para.index,
            indexInParagraph: inParaIdx,
            globalIndex: globalIdx,
            text: sentText,
            protectedTokens: Array.from(new Set(detectedTokens)),
            hash
          });

          inParaIdx++;
          globalIdx++;
        }
      });
    });

    return sentences;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
