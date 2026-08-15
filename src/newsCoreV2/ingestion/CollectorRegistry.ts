import { NewsCollector, RawNewsItem } from "./NewsCollector";
import { GoogleNewsRSSCollector } from "./collectors/GoogleNewsRSSCollector";
import { EconomicTimesCollector } from "./collectors/EconomicTimesCollector";
import { LiveMintCollector } from "./collectors/LiveMintCollector";
import { BusinessStandardCollector } from "./collectors/BusinessStandardCollector";
import { MoneycontrolCollector } from "./collectors/MoneycontrolCollector";
import { CNBCTV18Collector } from "./collectors/CNBCTV18Collector";
import {
  PIBCollector,
  RBICollector,
  SEBICollector,
  NSECollector,
  BSECollector
} from "./collectors/RegulatorsCollector";

export class CollectorRegistry {
  private collectors: NewsCollector[] = [];

  constructor() {
    this.registerDefaultCollectors();
  }

  public registerCollector(collector: NewsCollector): void {
    this.collectors.push(collector);
  }

  private registerDefaultCollectors(): void {
    this.collectors = [
      new GoogleNewsRSSCollector(),
      new EconomicTimesCollector(),
      new LiveMintCollector(),
      new BusinessStandardCollector(),
      new MoneycontrolCollector(),
      new CNBCTV18Collector(),
      new PIBCollector(),
      new RBICollector(),
      new SEBICollector(),
      new NSECollector(),
      new BSECollector()
    ];
  }

  public getActiveCollectorsCount(): number {
    return this.collectors.length;
  }

  /**
   * Concurrently collects raw news items from all registered collectors.
   * Isolates failures so that one broken feed never impacts others.
   */
  public async collectAll(): Promise<RawNewsItem[]> {
    const promises = this.collectors.map(async (collector) => {
      try {
        const timeoutPromise = new Promise<RawNewsItem[]>((_, reject) => {
          setTimeout(() => reject(new Error(`Collector "${collector.name}" timed out after 25s`)), 25000);
        });
        const items = await Promise.race([collector.collect(), timeoutPromise]);
        return items;
      } catch (err: any) {
        console.warn(`[CollectorRegistry] Collector "${collector.name}" failed:`, err.message);
        return [];
      }
    });

    const results = await Promise.allSettled(promises);
    const allItems: RawNewsItem[] = [];

    for (const res of results) {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        allItems.push(...res.value);
      }
    }

    return allItems;
  }
}
