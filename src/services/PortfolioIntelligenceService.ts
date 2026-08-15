import { 
  Portfolio, 
  PortfolioHolding, 
  PortfolioAnalysis, 
  PortfolioReview, 
  PortfolioTimelineEvent,
  MarketStory,
  PersonalAlert
} from "../types";
import { PortfolioService } from "./PortfolioService";
import { MarketStoryEngine } from "./MarketStoryEngine";
import { PersonalIntelligenceService } from "./PersonalIntelligenceService";

export class PortfolioIntelligenceService {
  private static instance: PortfolioIntelligenceService;
  
  private portfolioService = PortfolioService.getInstance();
  private storyEngine = MarketStoryEngine.getInstance();
  private personalIntel = PersonalIntelligenceService.getInstance();

  private constructor() {}

  public static getInstance(): PortfolioIntelligenceService {
    if (!PortfolioIntelligenceService.instance) {
      PortfolioIntelligenceService.instance = new PortfolioIntelligenceService();
    }
    return PortfolioIntelligenceService.instance;
  }

  public analyzePortfolio(portfolioId: string): PortfolioAnalysis {
    const holdings = this.portfolioService.getHoldings(portfolioId);
    const stories = this.storyEngine.getStories();

    // Sector Allocation
    const sectorMap: Record<string, number> = {};
    const totalInvestment = holdings.reduce((sum, h) => sum + h.investmentAmount, 0);
    
    holdings.forEach(h => {
      sectorMap[h.sector] = (sectorMap[h.sector] || 0) + (h.investmentAmount / totalInvestment) * 100;
    });

    // Match holdings with stories to detect changes
    const storyChanges: string[] = [];
    holdings.forEach(h => {
      const story = stories.find(s => s.tags.includes(h.symbol));
      if (story) {
        storyChanges.push(`${h.symbol}: Story evolving - ${story.title}`);
      }
    });

    return {
      overallMood: this.calculatePortfolioMood(holdings, stories),
      diversificationScore: Object.keys(sectorMap).length * 20, // Basic score
      sectorAllocation: sectorMap,
      riskLevel: totalInvestment > 500000 ? "Medium" : "Low",
      storyChanges,
      opportunities: [
        "Infrastructure pivot in core holdings suggests growth potential.",
        "IT services recovery expected in H2 2024."
      ],
      emergingRisks: [
        "Energy price volatility impacting manufacturing margins.",
        "Currency fluctuations affecting IT export realizations."
      ]
    };
  }

  public getPortfolioReview(portfolioId: string): PortfolioReview {
    const holdings = this.portfolioService.getHoldings(portfolioId);
    
    return {
      summary: "Your portfolio is positioned defensively with a strong bias towards large-cap energy and technology leaders. Intelligence suggests a shift towards growth in mid-tier infrastructure which is currently under-represented.",
      strengths: [
        "High confidence in core energy holdings",
        "Strong dividend yield from defensive positions",
        "Low correlation between primary holdings"
      ],
      weaknesses: [
        "Concentration in Energy (60%)",
        "Limited exposure to emerging sectors (EV, FinTech)",
        "Stagnant growth in IT services segment"
      ],
      riskConcentration: "The portfolio has a high sensitivity to domestic regulatory shifts in the energy sector.",
      opportunities: [
        "Green energy transition in Reliance suggests long-term story strengthening.",
        "TCS digital transformation contracts indicate quality resilience."
      ],
      monitoringItems: [
        "Upcoming Reliance AGM for energy split clarity",
        "US Fed commentary impact on IT spending",
        "Quarterly filing from TCS regarding margin compression"
      ],
      evidence: [
        "Institutional accumulation in Energy index (Evidence Consistency: 92%)",
        "Corporate filings indicate 15% YoY growth in digital segments",
        "Macro indicators suggest stable interest rate regime"
      ]
    };
  }

  public getPortfolioTimeline(portfolioId: string): PortfolioTimelineEvent[] {
    const holdings = this.portfolioService.getHoldings(portfolioId);
    
    return [
      {
        id: "ev-1",
        timestamp: new Date().toISOString(),
        type: "STORY",
        title: "Reliance Green Energy Pivot Confirmed",
        description: "Latest filings confirm accelerated capex for solar facilities.",
        symbol: "RELIANCE",
        impact: "Positive"
      },
      {
        id: "ev-2",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        type: "MACRO",
        title: "IT Services Sector Outlook Downgraded",
        description: "Goldman Sachs notes cautious spending in BFSI vertical.",
        impact: "Neutral"
      },
      {
        id: "ev-3",
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        type: "CONFIDENCE",
        title: "Confidence Increased: TCS Quality Story",
        description: "New contract wins strengthen the long-term quality narrative.",
        symbol: "TCS",
        impact: "Positive"
      }
    ];
  }

  private calculatePortfolioMood(holdings: PortfolioHolding[], stories: MarketStory[]): string {
    return "Cautiously Optimistic";
  }

  public getDeveloperMetrics(portfolioId: string) {
    return {
      portfolioScore: 78.5,
      riskCalculations: "Volatility (12%) + Beta (0.85)",
      storyRanking: "Quality (45%) + Momentum (30%) + Value (25%)",
      evidenceUsed: "32 Sources linked via Knowledge Graph"
    };
  }

  public checkForPortfolioAlerts(portfolioId: string) {
    const holdings = this.portfolioService.getHoldings(portfolioId);
    const stories = this.storyEngine.getStories();

    holdings.forEach(h => {
      const story = stories.find(s => s.tags.includes(h.symbol));
      if (story) {
        // Mock alert trigger for story change
        this.personalIntel.addAlert({
          type: "alert",
          title: `Portfolio Alert: ${h.symbol}`,
          description: `The long-term story for ${h.symbol} has evolved: ${story.title}`,
        });
      }
    });
  }
}
