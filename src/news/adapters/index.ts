import { ProviderAdapter } from './ProviderAdapter';
import { GoogleAdapter } from './GoogleAdapter';
import { ReutersAdapter } from './ReutersAdapter';
import { CNBCAdapter } from './CNBCAdapter';
import { MoneycontrolAdapter } from './MoneycontrolAdapter';
import { LiveMintAdapter } from './LiveMintAdapter';
import { BusinessStandardAdapter } from './BusinessStandardAdapter';
import { EconomicTimesAdapter } from './EconomicTimesAdapter';
import { YahooFinanceAdapter } from './YahooFinanceAdapter';
import { MarketWatchAdapter } from './MarketWatchAdapter';
import { CoinDeskAdapter } from './CoinDeskAdapter';
import { CoinTelegraphAdapter } from './CoinTelegraphAdapter';
import { NSEAdapter } from './NSEAdapter';
import { BSEAdapter } from './BSEAdapter';
import { SEBIAdapter } from './SEBIAdapter';
import { RBIAdapter } from './RBIAdapter';
import { PIBAdapter } from './PIBAdapter';
import { MCAAdapter } from './MCAAdapter';
import { InvestingAdapter } from './InvestingAdapter';

export * from './ProviderAdapter';
export * from './GoogleAdapter';
export * from './ReutersAdapter';
export * from './CNBCAdapter';
export * from './MoneycontrolAdapter';
export * from './LiveMintAdapter';
export * from './BusinessStandardAdapter';
export * from './EconomicTimesAdapter';
export * from './YahooFinanceAdapter';
export * from './MarketWatchAdapter';
export * from './CoinDeskAdapter';
export * from './CoinTelegraphAdapter';
export * from './NSEAdapter';
export * from './BSEAdapter';
export * from './SEBIAdapter';
export * from './RBIAdapter';
export * from './PIBAdapter';
export * from './MCAAdapter';
export * from './InvestingAdapter';

const adapters: ProviderAdapter[] = [
  new GoogleAdapter(),
  new ReutersAdapter(),
  new CNBCAdapter(),
  new MoneycontrolAdapter(),
  new LiveMintAdapter(),
  new BusinessStandardAdapter(),
  new EconomicTimesAdapter(),
  new YahooFinanceAdapter(),
  new MarketWatchAdapter(),
  new CoinDeskAdapter(),
  new CoinTelegraphAdapter(),
  new NSEAdapter(),
  new BSEAdapter(),
  new SEBIAdapter(),
  new RBIAdapter(),
  new PIBAdapter(),
  new MCAAdapter(),
  new InvestingAdapter(),
];

export function getAdapterForUrl(url: string): ProviderAdapter | null {
  if (!url) return null;
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('reuters.com') || lowerUrl.includes('reutersagency.com')) {
    return adapters.find((a) => a.id === 'reuters') || null;
  }
  if (lowerUrl.includes('cnbctv18.com') || lowerUrl.includes('cnbc.com')) {
    return adapters.find((a) => a.id === 'cnbc') || null;
  }
  if (lowerUrl.includes('livemint.com')) {
    return adapters.find((a) => a.id === 'livemint') || null;
  }
  if (lowerUrl.includes('economictimes.indiatimes.com') || lowerUrl.includes('economictimes')) {
    return adapters.find((a) => a.id === 'economic_times') || null;
  }
  if (lowerUrl.includes('business-standard.com')) {
    return adapters.find((a) => a.id === 'business_standard') || null;
  }
  if (lowerUrl.includes('moneycontrol.com')) {
    return adapters.find((a) => a.id === 'moneycontrol') || null;
  }
  if (lowerUrl.includes('coindesk.com')) {
    return adapters.find((a) => a.id === 'coindesk') || null;
  }
  if (lowerUrl.includes('cointelegraph.com')) {
    return adapters.find((a) => a.id === 'cointelegraph') || null;
  }
  if (lowerUrl.includes('finance.yahoo.com') || lowerUrl.includes('yahoo.com')) {
    return adapters.find((a) => a.id === 'yahoo_finance') || null;
  }
  if (lowerUrl.includes('marketwatch.com')) {
    return adapters.find((a) => a.id === 'marketwatch') || null;
  }
  if (lowerUrl.includes('nseindia.com') || lowerUrl.includes('nse')) {
    return adapters.find((a) => a.id === 'nse') || null;
  }
  if (lowerUrl.includes('bseindia.com') || lowerUrl.includes('bse')) {
    return adapters.find((a) => a.id === 'bse') || null;
  }
  if (lowerUrl.includes('sebi.gov.in') || lowerUrl.includes('sebi')) {
    return adapters.find((a) => a.id === 'sebi') || null;
  }
  if (lowerUrl.includes('rbi.org.in') || lowerUrl.includes('rbi')) {
    return adapters.find((a) => a.id === 'rbi') || null;
  }
  if (lowerUrl.includes('pib.gov.in') || lowerUrl.includes('pib')) {
    return adapters.find((a) => a.id === 'pib') || null;
  }
  if (lowerUrl.includes('mca.gov.in') || lowerUrl.includes('mca')) {
    return adapters.find((a) => a.id === 'mca') || null;
  }
  if (lowerUrl.includes('google.com') || lowerUrl.includes('google')) {
    return adapters.find((a) => a.id === 'google') || null;
  }
  if (lowerUrl.includes('investing.com')) {
    return adapters.find((a) => a.id === 'investing') || null;
  }

  return null;
}

export function getAllAdapters(): ProviderAdapter[] {
  return adapters;
}
