import { MacroContextBlock } from './MarketContextTypes';

export class MacroContext {
  public static analyze(text: string, title: string): MacroContextBlock | undefined {
    const combined = `${title} ${text}`.toLowerCase();

    // 1. RBI
    if (combined.includes('rbi') || combined.includes('reserve bank of india')) {
      return {
        topic: 'RBI Policy',
        explanation: 'Monetary policy actions adjust systemic liquidity and set interest rate guidance for commercial banks.'
      };
    }

    // 2. Budget
    if (combined.includes('budget') || combined.includes('union budget') || combined.includes('fiscal')) {
      return {
        topic: 'Union Budget',
        explanation: 'Fiscal directives and infrastructure allocations set growth priorities across key core sectors.'
      };
    }

    // 3. GST
    if (combined.includes('gst ') || combined.includes('gst council') || combined.includes('goods and services tax')) {
      return {
        topic: 'GST Directives',
        explanation: 'Tax rationalization and compliance updates streamline operational frameworks for corporate entities.'
      };
    }

    // 4. Inflation
    if (combined.includes('inflation') || combined.includes('cpi') || combined.includes('wpi')) {
      return {
        topic: 'Inflation Outlook',
        explanation: 'Elevated consumer prices or cooling retail inflation patterns guide central bank policy rate trajectories.'
      };
    }

    // 5. Fed
    if (combined.includes('fed ') || combined.includes('federal reserve') || combined.includes('fomc')) {
      return {
        topic: 'Federal Reserve Policy',
        explanation: 'Interest rate decisions by the Federal Reserve set global macro-liquidity tones and capital flows.'
      };
    }

    // 6. Oil
    if (combined.includes('oil') || combined.includes('crude') || combined.includes('brent')) {
      return {
        topic: 'Crude Oil Dynamics',
        explanation: 'Fluctuations in crude oil prices affect input costs for manufacturing, paint, and logistics players.'
      };
    }

    // 7. Gold
    if (combined.includes('gold') || combined.includes('bullion')) {
      return {
        topic: 'Gold Safe Haven',
        explanation: 'Rising geopolitical tensions and macro-uncertainty support gold as a primary safe-haven asset class.'
      };
    }

    return undefined;
  }
}
