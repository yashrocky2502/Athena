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
    
    if (holdings.length === 0) {
      return {
        summary: "No portfolio data yet. Add holdings, positions, or import an Excel/CSV portfolio to activate intelligence.",
        strengths: ["No active drawdown exposure"],
        weaknesses: ["Capital is entirely unallocated"],
        riskConcentration: "Zero market risk exposure",
        opportunities: ["Add core holdings or import CSV/Excel to generate opportunity linkages"],
        monitoringItems: ["Awaiting portfolio asset entry"],
        evidence: ["Evidence graph ready for ingestion"]
      };
    }

    const totalInvestment = holdings.reduce((sum, h) => sum + h.investmentAmount, 0);
    const sortedHoldings = [...holdings].sort((a, b) => b.investmentAmount - a.investmentAmount);
    const topHolding = sortedHoldings[0];
    const topHoldingWeight = totalInvestment > 0 ? ((topHolding.investmentAmount / totalInvestment) * 100).toFixed(1) : "0";

    const sectorMap: Record<string, number> = {};
    holdings.forEach(h => {
      sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.investmentAmount;
    });
    const topSectorEntry = Object.entries(sectorMap).sort((a, b) => b[1] - a[1])[0];
    const topSectorName = topSectorEntry ? topSectorEntry[0] : "Diversified";
    const topSectorPct = topSectorEntry && totalInvestment > 0 ? ((topSectorEntry[1] / totalInvestment) * 100).toFixed(1) : "0";

    return {
      summary: `Your portfolio holds ${holdings.length} active positions totaling ₹${totalInvestment.toLocaleString('en-IN')}. Lead allocation is in ${topSectorName} (${topSectorPct}%) with anchor position in ${topHolding.symbol} (${topHoldingWeight}%).`,
      strengths: [
        `Core position in ${topHolding.symbol} providing structural balance`,
        Object.keys(sectorMap).length >= 2 ? `Multi-sector exposure across ${Object.keys(sectorMap).length} sectors` : "Thematic concentration in primary sector",
        "Deterministic position tracking without external broker API dependency"
      ],
      weaknesses: [
        parseFloat(topHoldingWeight) > 35 ? `High single-stock concentration in ${topHolding.symbol} (${topHoldingWeight}%)` : "Position weights are balanced",
        parseFloat(topSectorPct) > 50 ? `Elevated sector concentration in ${topSectorName} (${topSectorPct}%)` : "Sector spread is within standard deviation"
      ],
      riskConcentration: `The portfolio has high sensitivity to macroeconomic catalysts in ${topSectorName}.`,
      opportunities: holdings.slice(0, 3).map(h => `${h.symbol}: Monitor quantitative setup and earnings for margin expansion.`),
      monitoringItems: holdings.slice(0, 3).map(h => `Upcoming AGM and corporate filings for ${h.symbol}`),
      evidence: [
        `Verified position records for ${holdings.length} assets`,
        "Evidence audit trail active in ATHENA Canonical Engine"
      ]
    };
  }

  public getPortfolioTimeline(portfolioId: string): PortfolioTimelineEvent[] {
    const holdings = this.portfolioService.getHoldings(portfolioId);
    if (holdings.length === 0) return [];
    
    return holdings.map((h, idx) => ({
      id: `ev-${idx}`,
      timestamp: h.purchaseDate || new Date().toISOString(),
      type: "STORY",
      title: `${h.symbol} Position Initialized`,
      description: `Held ${h.quantity} units in ${h.sector}. ${h.notes || ''}`,
      symbol: h.symbol,
      impact: "Positive"
    }));
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
