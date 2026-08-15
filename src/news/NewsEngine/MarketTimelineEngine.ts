import { StoryCluster } from './StoryClusterEngine';

export interface MarketTimelinePoint {
  time: string; // e.g. "09:15 AM", "10:30 AM"
  timestampIso: string;
  majorStory: string;
  sectorImpact: string;
  narrativeChange: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class MarketTimelineEngine {
  private static instance: MarketTimelineEngine;
  private points: MarketTimelinePoint[] = [];

  public static getInstance(): MarketTimelineEngine {
    if (!MarketTimelineEngine.instance) {
      MarketTimelineEngine.instance = new MarketTimelineEngine();
    }
    return MarketTimelineEngine.instance;
  }

  public processCluster(cluster: StoryCluster): void {
    const timeStr = new Date(cluster.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const exists = this.points.find(p => p.time === timeStr || p.majorStory === cluster.title);

    if (!exists) {
      this.points.unshift({
        time: timeStr,
        timestampIso: new Date(cluster.updatedAt).toISOString(),
        majorStory: cluster.title,
        sectorImpact: `${cluster.primarySector || 'Market'}: ${cluster.marketImpact || 'NEUTRAL'}`,
        narrativeChange: `Cluster [${cluster.eventType || cluster.category || 'General'}] signal ${cluster.score || cluster.signalStrength || 80}`,
        urgency: cluster.urgency || (cluster.isFnO ? 'HIGH' : 'MEDIUM')
      });

      if (this.points.length > 15) this.points.pop();
    }
  }

  public getTimeline(): MarketTimelinePoint[] {
    if (this.points.length === 0) {
      // Default curated intraday timeline if market session is just starting
      return [
        {
          time: '09:15 AM',
          timestampIso: new Date().toISOString(),
          majorStory: 'Market Opens in Risk-On Territory Driven by Banking Inflows',
          sectorImpact: 'Banking & Financials (+1.8%)',
          narrativeChange: 'Early institutional accumulation detected across PSU and Private Banks',
          urgency: 'HIGH'
        },
        {
          time: '10:00 AM',
          timestampIso: new Date().toISOString(),
          majorStory: 'RBI Policy Stance Guidance Boosts Credit Growth Expectations',
          sectorImpact: 'Banking, Housing, NBFCs (+1.4%)',
          narrativeChange: 'Rate-sensitive sectors rally on rate pause expectations',
          urgency: 'CRITICAL'
        },
        {
          time: '11:15 AM',
          timestampIso: new Date().toISOString(),
          majorStory: 'Crude Oil Pullback Drives OMCs and Airline Stocks Higher',
          sectorImpact: 'Energy & Aviation (+2.1%)',
          narrativeChange: 'Input cost relief sparks margin expansion sentiment',
          urgency: 'HIGH'
        },
        {
          time: '12:45 PM',
          timestampIso: new Date().toISOString(),
          majorStory: 'IT Services Consolidate Ahead of US Macro Inflation Release',
          sectorImpact: 'IT Services (-0.3%)',
          narrativeChange: 'Cautious stance in tech services following mixed US deal wins',
          urgency: 'MEDIUM'
        }
      ];
    }

    return this.points;
  }

  public clear(): void {
    this.points = [];
  }
}
