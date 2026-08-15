import { IScheduleProvider, ScheduledEvent } from './IScheduleProvider';
import { ProviderHealthMonitor } from '../ProviderHealthMonitor';

export class BseScheduleProvider implements IScheduleProvider {
  public readonly providerName = 'BSE Corporate Calendar Provider';
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
      // Step 1: Call Backend Proxy Endpoint
      const apiResp = await fetch('/api/calendar/bse', {
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

      // Step 2: Direct Fallback Fetch
      const response = await fetch('https://api.bseindia.com/BseIndiaAPI/api/CorpAnnouncement/w', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(4000)
      }).catch(() => null);

      let events: ScheduledEvent[] = [];

      if (response && response.ok) {
        const data = await response.json().catch(() => ({ Table: [] }));
        const list = data?.Table || [];
        if (Array.isArray(list)) {
          events = list.slice(0, 50).map((item: any, idx: number) => {
            const symbol = item.SLONGNAME || item.SCRIP_CD || 'BSE';
            const dateStr = item.NEWS_DT ? new Date(item.NEWS_DT).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const releaseTimeUTC = new Date(`${dateStr}T09:30:00Z`).toISOString();

            return {
              id: `bse_${item.NEWSID || idx}`,
              title: `${symbol} - ${item.NEWSSUB || item.CATEGORYNAME || 'BSE Disclosure'}`,
              country: 'India',
              countryCode: 'IN',
              region: 'India',
              timezone: 'Asia/Kolkata',
              officialReleaseTime: releaseTimeUTC,
              officialReleaseTimeUTC: releaseTimeUTC,
              impact: 'MEDIUM',
              category: 'Corporate Action',
              officialSource: 'Bombay Stock Exchange (BSE)',
              officialSourceUrl: `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME || ''}`,
              verified: true,
              confidence: 100,
              lastUpdated: new Date().toISOString(),
              providerName: this.providerName,
              symbol: String(symbol),
              announcementDocRef: `BSE-ANNC-${item.NEWSID || idx}`
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
