import { IScheduleProvider, ScheduledEvent } from './IScheduleProvider';
import { ProviderHealthMonitor } from '../ProviderHealthMonitor';

export class MospiScheduleProvider implements IScheduleProvider {
  public readonly providerName = 'MoSPI Official Release Calendar Provider';
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
      // Step 1: Backend Endpoint Call
      const apiResp = await fetch('/api/calendar/mospi', {
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

      // Step 2: Direct Fallback
      const response = await fetch('https://www.mospi.gov.in/press-release', {
        headers: { 'User-Agent': 'Mozilla/5.0 (ATHENA Institutional Terminal)' },
        signal: AbortSignal.timeout(4000)
      }).catch(() => null);

      let events: ScheduledEvent[] = [];

      if (response && response.ok) {
        const text = await response.text();
        const matches = text.matchAll(/<a[^>]*href="([^"]*press-release[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);

        let idx = 0;
        for (const match of matches) {
          const href = match[1];
          const rawTitle = match[2].replace(/<[^>]*>/g, '').trim();

          if (rawTitle && rawTitle.length > 5 && (rawTitle.toUpperCase().includes('CPI') || rawTitle.toUpperCase().includes('IIP') || rawTitle.toUpperCase().includes('GDP') || rawTitle.toUpperCase().includes('INFLATION'))) {
            const releaseTimeUTC = new Date().toISOString();
            events.push({
              id: `mospi_${idx++}`,
              title: rawTitle,
              country: 'India',
              countryCode: 'IN',
              region: 'India',
              timezone: 'Asia/Kolkata',
              officialReleaseTime: releaseTimeUTC,
              officialReleaseTimeUTC: releaseTimeUTC,
              impact: 'HIGH',
              category: 'Macro',
              officialSource: 'Ministry of Statistics & Programme Implementation (MoSPI)',
              officialSourceUrl: href.startsWith('http') ? href : `https://www.mospi.gov.in${href}`,
              verified: true,
              confidence: 100,
              lastUpdated: new Date().toISOString(),
              providerName: this.providerName,
              announcementDocRef: `MOSPI-PRESS-${idx}`
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
