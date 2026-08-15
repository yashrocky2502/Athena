import { PriceReactionBlock } from './MarketContextTypes';

export class PriceReaction {
  public static analyze(text: string, title: string, company?: string): PriceReactionBlock | undefined {
    const combined = `${title} ${text}`;
    const combinedLower = combined.toLowerCase();

    // 1. Look for stock/shares keywords
    const keywords = [
      'shares rose', 'shares fell', 'stock gained', 'stock dropped',
      'shares surged', 'shares tumbled', 'stock rose', 'stock fell',
      'shares jumped', 'shares slumped', 'shares slipped', 'shares advanced'
    ];

    const hasKeyword = keywords.some(kw => combinedLower.includes(kw));
    const percentRegex = /(\+|-)?\d+(\.\d+)?%/g;
    const matchPercent = combined.match(percentRegex);

    let reactionVal = '';
    let isPositive = true;

    // Detect direction
    const positiveWords = ['rose', 'gained', 'surged', 'jumped', 'advanced', 'up'];
    const negativeWords = ['fell', 'dropped', 'tumbled', 'slumped', 'slipped', 'down', 'declined'];

    let foundPositive = positiveWords.some(w => combinedLower.includes(w));
    let foundNegative = negativeWords.some(w => combinedLower.includes(w));

    if (foundNegative && !foundPositive) {
      isPositive = false;
    }

    if (matchPercent && matchPercent.length > 0) {
      // Find the first percentage that seems related
      const pct = matchPercent[0];
      const numericPart = pct.replace(/[^0-9.]/g, '');
      reactionVal = (isPositive ? '▲' : '▼') + numericPart + '%';
    } else {
      // If we have direction but no percentage
      if (foundPositive) {
        reactionVal = '▲ Positive';
      } else if (foundNegative) {
        reactionVal = '▼ Negative';
      } else {
        // Default when nothing found
        return undefined;
      }
    }

    // Determine volume
    let volume = 'Unknown';
    if (combinedLower.includes('high volume') || combinedLower.includes('heavy volume') || combinedLower.includes('surged on volume')) {
      volume = 'High';
    } else if (combinedLower.includes('normal volume') || combinedLower.includes('average volume')) {
      volume = 'Normal';
    }

    const stockName = company || 'Stock';

    return {
      stock: stockName,
      reaction: reactionVal,
      volume: volume
    };
  }
}
