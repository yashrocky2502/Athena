import { IScheduleProvider, ScheduledEvent } from './IScheduleProvider';
import { ProviderHealthMonitor } from '../ProviderHealthMonitor';

export class NseScheduleProvider implements IScheduleProvider {
  public readonly providerName = 'NSE Corporate Calendar Provider';
  private cache: ScheduledEvent[] = [];
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 6 * 3600 * 1000; // 6 Hours

  public async fetchEvents(): Promise<ScheduledEvent[]> {
    const now = Date.now();
    if (this.cache.length > 0 && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cache;
    }

    const startTime = Date.now();
    try {
      // Step 1: Call Backend Proxy Endpoint (handles session cookies and Akamai headers)
      const apiResp = await fetch('/api/calendar/nse', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      }).catch(() => null);

      if (apiResp && apiResp.ok) {
        const result = await apiResp.json().catch(() => null);
        if (result && Array.isArray(result.events)) {
          this.cache = result.events;
          this.lastFetchTime = Date.now();
          const latency = Date.now() - startTime;
          ProviderHealthMonitor.getInstance().recordSync(this.providerName, result.events.length, latency, null);
          return result.events;
        }
      }

      // Step 2: Direct Fallback Fetch if API endpoint fails
      const response = await fetch('https://www.nseindia.com/api/event-calendar', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(4000)
      }).catch(() => null);

      let events: ScheduledEvent[] = [];

      if (response && response.ok) {
        const data = await response.json().catch(() => []);
        if (Array.isArray(data)) {
          events = data.slice(0, 50).map((item: any, idx: number) => {
            const symbol = item.symbol || item.companyName || 'NSE';
            const dateStr = item.date || item.purposeDate || new Date().toISOString().split('T')[0];
            const releaseTimeUTC = new Date(`${dateStr}T09:00:00Z`).toISOString();

            return {
              id: `nse_${symbol}_${idx}`,
              title: `${symbol} - ${item.purpose || 'Corporate Announcement'}`,
              country: 'India',
              countryCode: 'IN',
              region: 'India',
              timezone: 'Asia/Kolkata',
              officialReleaseTime: releaseTimeUTC,
              officialReleaseTimeUTC: releaseTimeUTC,
              impact: item.purpose?.toUpperCase().includes('FINANCIAL') ? 'HIGH' : 'MEDIUM',
              category: item.purpose?.toUpperCase().includes('DIVIDEND') ? 'Dividend' : 'Earnings',
              officialSource: 'National Stock Exchange of India (NSE)',
              officialSourceUrl: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`,
              verified: true,
              confidence: 100,
              lastUpdated: new Date().toISOString(),
              providerName: this.providerName,
              symbol,
              announcementDocRef: `NSE-CORP-${symbol}-${dateStr}`
            };
          });
        }
      }

      this.cache = events;
      this.lastFetchTime = Date.now();
      const latency = Date.now() - startTime;
      ProviderHealthMonitor.getInstance().recordSync(this.providerName, events.length, latency, null);
      return events;
    } catch (err: any) {
      const latency = Date.now() - startTime;
      ProviderHealthMonitor.getInstance().recordSync(this.providerName, 0, latency, err.message || 'Fetch failed');
      return [];
    }
  }
}
