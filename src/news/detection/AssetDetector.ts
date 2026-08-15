export class AssetDetector {
  public static detect(text: string): string[] {
    const lower = text.toLowerCase();
    const assets = new Set<string>();

    if (lower.includes('f&o') || lower.includes('futures') || lower.includes('options') || lower.includes('derivative') || lower.includes('call option') || lower.includes('put option')) {
      assets.add('F&O');
    }

    if (lower.includes('stock') || lower.includes('shares') || lower.includes('equity') || lower.includes('share price')) {
      assets.add('Stocks');
    }

    if (lower.includes('nifty') || lower.includes('sensex') || lower.includes('index') || lower.includes('indices') || lower.includes('nasdaq') || lower.includes('s&p 500')) {
      assets.add('Indices');
    }

    if (lower.includes('etf') || lower.includes('exchange traded fund') || lower.includes('mutual fund')) {
      assets.add('ETF');
    }

    if (lower.includes('ipo') || lower.includes('listing') || lower.includes('public issue') || lower.includes('drhp')) {
      assets.add('IPO');
    }

    if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('ethereum') || lower.includes('solana') || lower.includes('coindesk') || lower.includes('cointelegraph')) {
      assets.add('Crypto');
    }

    if (lower.includes('forex') || lower.includes('currency') || lower.includes('rupee') || lower.includes('dollar') || lower.includes('fx') || lower.includes('usd/inr')) {
      assets.add('Forex');
    }

    if (lower.includes('gold') || lower.includes('yellow metal')) {
      assets.add('Gold');
    }

    if (lower.includes('silver')) {
      assets.add('Silver');
    }

    if (lower.includes('oil') || lower.includes('crude') || lower.includes('brent')) {
      assets.add('Oil');
    }

    if (lower.includes('gas') || lower.includes('natural gas')) {
      assets.add('Natural Gas');
    }

    if (lower.includes('commodity') || lower.includes('gold') || lower.includes('silver') || lower.includes('oil') || lower.includes('metals')) {
      assets.add('Commodities');
    }

    return Array.from(assets);
  }
}
