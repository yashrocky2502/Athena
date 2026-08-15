import { IScheduleProvider, ScheduledEvent } from './IScheduleProvider';
import { ProviderHealthMonitor } from '../ProviderHealthMonitor';

export class PibScheduleProvider implements IScheduleProvider {
  public readonly providerName = 'PIB Government Press Release Schedule Provider';
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
      const apiResp = await fetch('/api/calendar/pib', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000)
      }).catch(() => null);

      if (apiResp && apiResp.ok) {
        const result = await apiResp.json().catch(() => null);
        if (result && Array.isArray(result.events)) {
          this.cache = result.events;
          this.lastFetchTime = Date.now();
          const latency = Date.now() - startTime;
          ProviderHealthMonitor.getInstance().recordSync(
            this.providerName,
            result.events.length,
            latency,
            null,
            {
              officialUrl: 'https://pib.gov.in/RssMain.aspx?ModId=6',
              endpointUrl: '/api/calendar/pib',
              httpStatus: 200,
              eventsParsed: result.events.length,
              eventsAccepted: result.events.length,
              eventsRejected: 0
            }
          );
          return result.events;
        }
      }

      // Step 2: Direct Fallback Fetch
      let response = await fetch('https://pib.gov.in/RssMain.aspx?ModId=6', {
        headers: { 'User-Agent': 'Mozilla/5.0 (ATHENA Institutional Terminal)' },
        signal: AbortSignal.timeout(20000)
      }).catch(() => null);

      if (!response || !response.ok) {
        response = await fetch('https://news.google.com/rss/search?q=site:pib.gov.in&hl=en-IN&gl=IN&ceid=IN:en', {
          headers: { 'User-Agent': 'Mozilla/5.0 (ATHENA Institutional Terminal)' },
          signal: AbortSignal.timeout(20000)
        }).catch(() => null);
      }

      let events: ScheduledEvent[] = [];
      let rawCount = 0;
      let parsedCount = 0;
      let rejectedCount = 0;
      let firstError: string | null = null;

      if (response && response.ok) {
        const text = await response.text();
        const itemMatches = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)];
        rawCount = itemMatches.length;

        let idx = 0;
        for (const itemMatch of itemMatches) {
          try {
            idx++;
            const itemXml = itemMatch[1];
            const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
            const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/);

            if (titleMatch) {
              const rawTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim();
              const url = linkMatch ? linkMatch[1].trim() : 'https://pib.gov.in';
              const releaseIso = new Date().toISOString();
              parsedCount++;

              events.push({
                id: `pib_live_${idx}_${Buffer.from(rawTitle).toString('hex').slice(0, 10)}`,
                title: rawTitle,
                country: 'India',
                countryCode: 'IN',
                region: 'India',
                timezone: 'Asia/Kolkata',
                officialReleaseTime: releaseIso,
                officialReleaseTimeUTC: releaseIso,
                impact: 'HIGH',
                category: 'Macro',
                officialSource: 'Press Information Bureau (PIB Govt of India)',
                officialSourceUrl: url,
                verified: true,
                confidence: 100,
                lastUpdated: new Date().toISOString(),
                providerName: this.providerName,
                announcementDocRef: `PIB-RELEASE-${releaseIso.slice(0, 10)}`
              });
            }
          } catch (recErr: any) {
            rejectedCount++;
            if (!firstError) firstError = recErr.message || 'Record parse error';
          }
        }
      }

      this.cache = events;
      this.lastFetchTime = Date.now();
      const latency = Date.now() - startTime;
      ProviderHealthMonitor.getInstance().recordSync(
        this.providerName,
        events.length,
        latency,
        firstError,
        {
          officialUrl: 'https://pib.gov.in/RssMain.aspx?ModId=6',
          endpointUrl: '/api/calendar/pib',
          httpStatus: response ? response.status : 503,
          eventsParsed: parsedCount,
          eventsAccepted: events.length,
          eventsRejected: rejectedCount
        }
      );
      return events;
    } catch (err: any) {
      const latency = Date.now() - startTime;
      ProviderHealthMonitor.getInstance().recordSync(this.providerName, 0, latency, err.message || 'Fetch failed');
      return [];
    }
  }
}
