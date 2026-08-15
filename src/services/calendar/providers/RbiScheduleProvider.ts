import { IScheduleProvider, ScheduledEvent } from './IScheduleProvider';
import { ProviderHealthMonitor } from '../ProviderHealthMonitor';

export class RbiScheduleProvider implements IScheduleProvider {
  public readonly providerName = 'RBI MPC Official Schedule Provider';
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
      const apiResp = await fetch('/api/calendar/rbi', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
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

      // Step 2: Direct Fallback Fetch if API unavailable
      const response = await fetch('https://www.rbi.org.in/rssfeed/pressrelease.xml', {
        headers: { 'User-Agent': 'Mozilla/5.0 (ATHENA Institutional Terminal)' },
        signal: AbortSignal.timeout(4000)
      }).catch(() => null);

      let events: ScheduledEvent[] = [];

      if (response && response.ok) {
        const text = await response.text();
        const matches = text.matchAll(/<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>/g);
        let idx = 0;
        for (const match of matches) {
          idx++;
          const title = match[1]?.trim() || '';
          const url = match[2]?.trim() || 'https://www.rbi.org.in';
          const pubDate = match[3]?.trim() || '';

          if (title.toUpperCase().includes('MPC') || title.toUpperCase().includes('MONETARY POLICY') || title.toUpperCase().includes('INTEREST RATE')) {
            const releaseTimeUTC = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
            events.push({
              id: `rbi_${idx}_${Buffer.from(title).toString('hex').slice(0, 10)}`,
              title,
              country: 'India',
              countryCode: 'IN',
              region: 'RBI',
              timezone: 'Asia/Kolkata',
              officialReleaseTime: releaseTimeUTC,
              officialReleaseTimeUTC: releaseTimeUTC,
              impact: 'CRITICAL',
              category: 'Central Bank',
              officialSource: 'Reserve Bank of India (RBI)',
              officialSourceUrl: url,
              verified: true,
              confidence: 100,
              lastUpdated: new Date().toISOString(),
              providerName: this.providerName,
              announcementDocRef: `RBI-MPC-${releaseTimeUTC.slice(0, 10)}`
            });
          }
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
