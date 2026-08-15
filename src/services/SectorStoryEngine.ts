import { SectorStory } from "../types";
import { supabaseAdmin } from "../lib/supabase";

export class SectorStoryEngine {
  private static instance: SectorStoryEngine;
  private sectors: Record<string, SectorStory> = {};

  private constructor() {
    this.seedSectors();
  }

  public static getInstance(): SectorStoryEngine {
    if (!SectorStoryEngine.instance) {
      SectorStoryEngine.instance = new SectorStoryEngine();
    }
    return SectorStoryEngine.instance;
  }

  private seedSectors(): void {
    const defaultSectors: SectorStory[] = [
      {
        sector: "Automotive & EVs",
        storyStatus: "Accelerated capital expenditure into commercial EV platforms alongside robust order pipelines.",
        confidence: 94,
        keyDrivers: [
          "Favorable state EV policies and commercial road tax exemptions.",
          "Strategic backward integration of battery manufacturing hubs by major OEMs."
        ],
        recentEvents: [
          "Tata Motors commissioned a localized cell production complex.",
          "Two-wheeler EV registrations reached a multi-quarter high in urban metros."
        ],
        trend: "strong_up"
      },
      {
        sector: "IT Services",
        storyStatus: "Post-earnings momentum stabilization with improved operating margins across mid-tier firms.",
        confidence: 88,
        keyDrivers: [
          "Discretionary cloud and automation spend renewal cycles in North America.",
          "Generative AI integration transforming standard billable software contracts."
        ],
        recentEvents: [
          "Infosys secured a massive multi-quarter $3.2B digital transformation deal.",
          "NASSCOM announced stabilizing employee attrition ratios for core tech cohorts."
        ],
        trend: "up"
      },
      {
        sector: "Green Energy & Power",
        storyStatus: "Massive institutional bidding following policy updates and long-term transmission grid allocations.",
        confidence: 91,
        keyDrivers: [
          "Government infrastructure solar hybrid bidding mandates.",
          "Expanding grid transmission corridors to absorb western wind-power surges."
        ],
        recentEvents: [
          "Reliance announced pilot scale-ups of green hydrogen fuel assemblies.",
          "Sovereign green bond issuances closed with substantial oversubscriptions."
        ],
        trend: "strong_up"
      },
      {
        sector: "Pharmaceuticals & Biotech",
        storyStatus: "Defensive rotation and US FDA approval pipelines driving specific enterprise value breakouts.",
        confidence: 85,
        keyDrivers: [
          "Expanding market share in global biosimilar copycat pipelines.",
          "Price increases under local drug price regulatory adjustments."
        ],
        recentEvents: [
          "Three major formulation sites cleared FDA reviews without negative observations.",
          "Surgical exports to South American medical depots surged YoY."
        ],
        trend: "up"
      },
      {
        sector: "FMCG & Consumer Staples",
        storyStatus: "Softening rural consumer demand metrics keeping primary volume growth trajectories horizontal.",
        confidence: 78,
        keyDrivers: [
          "Monsoon distribution patterns affecting direct agricultural farm income levels.",
          "Intense local competition in lower-unit-pack consumer staple distributions."
        ],
        recentEvents: [
          "ITC reported steady cigarette volumes but modest rural soap demand gains.",
          "Direct-to-consumer digital channels captured urban market shares."
        ],
        trend: "flat"
      },
      {
        sector: "Private Banking & HFCs",
        storyStatus: "Easing net interest margins (NIMs) capping credit growth expectations in high-beta portfolios.",
        confidence: 72,
        keyDrivers: [
          "Persistent elevated cost of deposits resulting from fierce system liquidity competition.",
          "RBI warnings targeting unsecured high-yield retail personal advances."
        ],
        trend: "flat",
        recentEvents: [
          "HDFC Bank stabilized loan-to-deposit adjustments near regulatory target bands.",
          "Sovereign treasury yields remained steady, stabilizing banking treasury margins."
        ]
      },
      {
        sector: "Metals & Mining",
        storyStatus: "Structural cooling of domestic commodity pricing coupled with foreign distribution pressure.",
        confidence: 65,
        keyDrivers: [
          "Excessive steel manufacturing inventories redirected from overseas ports.",
          "Volatility in international premium coking coal input rates."
        ],
        recentEvents: [
          "Tata Steel finalized high-capex furnace modernization budgets in Europe.",
          "Domestic steel spot benchmarks softened amid excessive local retail inventory."
        ],
        trend: "down"
      },
      {
        sector: "Real Estate & Housing",
        storyStatus: "Selective localized price actions amid high cost-of-capital environment; luxury sector leads.",
        confidence: 80,
        keyDrivers: [
          "Sustained luxury home bookings in major financial hubs.",
          "Pre-sales velocity expansion outpacing land bank regulatory clearances."
        ],
        recentEvents: [
          "New premium residential project registrations peaked in Mumbai.",
          "Mortgage disbursements recorded steady single-digit expansion."
        ],
        trend: "up"
      }
    ];

    defaultSectors.forEach(sec => {
      this.sectors[sec.sector] = sec;
    });
  }

  public getSectorStory(sectorName: string): SectorStory | null {
    return this.sectors[sectorName] || null;
  }

  public getAllSectors(): SectorStory[] {
    return Object.values(this.sectors);
  }

  public async updateSectorStory(sectorName: string, status: string, confidence: number): Promise<void> {
    const sec = this.sectors[sectorName];
    if (sec) {
      sec.storyStatus = status;
      sec.confidence = confidence;

      // Log update to Supabase
      try {
        await supabaseAdmin.from('news_events').insert({
          event_id: `SEC-${sectorName}-${Date.now()}`,
          headline: `Sector Update: ${sectorName}`,
          summary: status,
          company: 'MARKET',
          category: 'SECTOR_INTELLIGENCE',
          timestamp: new Date().toISOString(),
          priority: 'Low',
          confidence: confidence / 100
        });
      } catch (e) {
        console.error("Failed to persist sector update to Supabase", e);
      }
    }
  }

  public async recordRecentEvent(sectorName: string, event: string): Promise<void> {
    const sec = this.sectors[sectorName];
    if (sec) {
      sec.recentEvents.push(event);

      await supabaseAdmin.from('news_events').insert({
        event_id: `EVT-${sectorName}-${Date.now()}`,
        headline: `Sector Event: ${sectorName}`,
        summary: event,
        company: 'MARKET',
        category: 'SECTOR_EVENT',
        timestamp: new Date().toISOString(),
        priority: 'Low'
      });
    }
  }
}
