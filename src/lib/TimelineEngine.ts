import { TimelineRecord } from "../types";

export class TimelineEngine {
  private timeline: TimelineRecord[] = [];

  constructor() {
    // Initialize with some dummy history data to make it look active
  }

  // Store every verified event chronologically.
  // The Timeline Engine never deletes history. Events are immutable.
  addEvent(record: TimelineRecord): void {
    // Immutable addition
    this.timeline = [...this.timeline, { ...record, timestamp: new Date().toISOString() }];
  }

  getTimeline(): TimelineRecord[] {
    return [...this.timeline].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getCompanyTimeline(company: string): TimelineRecord[] {
    return this.getTimeline().filter(r => r.company === company);
  }

  getSectorTimeline(sector: string): TimelineRecord[] {
    return this.getTimeline().filter(r => r.sector === sector);
  }

  getMarketTimeline(): TimelineRecord[] {
    // General market events might not have a specific company or sector, or we can filter by theme
    return this.getTimeline();
  }

  getEventsBetweenDates(startDate: string, endDate: string): TimelineRecord[] {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return this.getTimeline().filter(r => {
      const time = new Date(r.timestamp).getTime();
      return time >= start && time <= end;
    });
  }
}
