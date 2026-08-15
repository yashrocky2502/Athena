import { ExpectationBlock } from './MarketContextTypes';

export class ExpectationAnalyzer {
  public static analyze(text: string, title: string): ExpectationBlock {
    const combined = `${title} ${text}`.toLowerCase();

    // Beat
    if (
      combined.includes('above estimates') ||
      combined.includes('beat estimates') ||
      combined.includes('beating estimates') ||
      combined.includes('topped estimates') ||
      combined.includes('better than expected') ||
      combined.includes('exceeded expectations') ||
      combined.includes('beat expectations') ||
      combined.includes('above expectation')
    ) {
      return {
        status: 'Beat',
        detail: 'Performance came in above consensus analyst estimates.'
      };
    }

    // Miss
    if (
      combined.includes('below estimates') ||
      combined.includes('missed estimates') ||
      combined.includes('missing estimates') ||
      combined.includes('fell short of estimates') ||
      combined.includes('worse than expected') ||
      combined.includes('missed expectations') ||
      combined.includes('below expectation')
    ) {
      return {
        status: 'Miss',
        detail: 'Performance came in below consensus analyst estimates.'
      };
    }

    // Inline
    if (
      combined.includes('in line with') ||
      combined.includes('inline with') ||
      combined.includes('matched estimates') ||
      combined.includes('matching expectations') ||
      combined.includes('in-line')
    ) {
      return {
        status: 'Inline',
        detail: 'Performance aligned closely with market expectations.'
      };
    }

    return null as any;
  }
}
