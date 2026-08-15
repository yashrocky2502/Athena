import { MarketStory, AthenaAlert, UserCompanyPreference } from "../types";
import { UserPreferenceService } from "./UserPreferenceService";
import { AlertDecisionEngine } from "./AlertDecisionEngine";

export interface RankedIntelligenceItem {
  id: string;
  type: "Story" | "Alert";
  data: MarketStory | AthenaAlert;
  score: number;
  explanation: string;
}

export class ForYouRankingEngine {
  private static instance: ForYouRankingEngine;

  public static getInstance(): ForYouRankingEngine {
    if (!ForYouRankingEngine.instance) {
      ForYouRankingEngine.instance = new ForYouRankingEngine();
    }
    return ForYouRankingEngine.instance;
  }

  public async rankIntelligence(
    stories: MarketStory[],
    alerts: AthenaAlert[]
  ): Promise<RankedIntelligenceItem[]> {
    const prefService = UserPreferenceService.getInstance();
    const followed = await prefService.getFollowedCompanies();
    const watchlisted = await prefService.getWatchlist();
    const alertPrefs = await prefService.getAlertPreferences("default_user"); // Assuming userId

    const ranked: RankedIntelligenceItem[] = [];

    // Process Stories
    for (const story of stories) {
      const score = this.calculateScore(story, followed, watchlisted, alertPrefs);
      if (score > 0) {
        ranked.push({
          id: story.id,
          type: "Story",
          data: story,
          score,
          explanation: this.getExplanation(story, followed, watchlisted)
        });
      }
    }

    // Process Alerts
    for (const alert of alerts) {
      const score = this.calculateAlertScore(alert, followed, watchlisted, alertPrefs);
      if (score > 0) {
        ranked.push({
          id: alert.id,
          type: "Alert",
          data: alert,
          score,
          explanation: this.getAlertExplanation(alert, followed, watchlisted)
        });
      }
    }

    return ranked.sort((a, b) => b.score - a.score);
  }

  private calculateScore(story: MarketStory, followed: UserCompanyPreference[], watchlisted: UserCompanyPreference[], alertPrefs: any): number {
    let score = 0;
    
    // User Relationship
    const isFollowed = (story.tags || []).some(tag => followed.some(f => f.companyId === tag));
    const isWatchlisted = (story.tags || []).some(tag => watchlisted.some(w => w.companyId === tag));
    if (isFollowed) score += 40;
    else if (isWatchlisted) score += 25;

    // Event Importance/Impact (Market Impact)
    // Story tags might have impact info, assuming mock-style check
    if ((story.tags || []).some(t => t.includes("Market"))) score += 30;
    else if ((story.tags || []).some(t => t.includes("Sector"))) score += 20;
    else score += 15;

    // Freshness
    // Story.timeline check
    if (story.timeline && story.timeline.length > 0) score += 10;

    return Math.min(score, 100);
  }

  private calculateAlertScore(alert: AthenaAlert, followed: UserCompanyPreference[], watchlisted: UserCompanyPreference[], alertPrefs: any): number {
    let score = 0;

    // User Relationship
    const isFollowed = (alert.companies || []).some(c => followed.some(f => f.companyId === c));
    const isWatchlisted = (alert.companies || []).some(c => watchlisted.some(w => w.companyId === c));
    if (isFollowed) score += 40;
    else if (isWatchlisted) score += 25;

    // Event Importance (Priority)
    if (alert.priority === "Critical") score += 40;
    else if (alert.priority === "High") score += 30;
    else score += 15;

    // Market Impact
    score += 15; // Assume company specific

    return Math.min(score, 100);
  }

  private getExplanation(story: MarketStory, followed: UserCompanyPreference[], watchlisted: UserCompanyPreference[]): string {
    const isFollowed = (story.tags || []).some(tag => followed.some(f => f.companyId === tag));
    if (isFollowed) return "You follow a company involved in this event.";
    const isWatchlisted = (story.tags || []).some(tag => watchlisted.some(w => w.companyId === tag));
    if (isWatchlisted) return "You have this company in your watchlist.";
    return "Event matches your general interest profile.";
  }

  private getAlertExplanation(alert: AthenaAlert, followed: UserCompanyPreference[], watchlisted: UserCompanyPreference[]): string {
    const isFollowed = (alert.companies || []).some(c => followed.some(f => f.companyId === c));
    if (isFollowed) return `Critical update for followed company ${(alert.companies || []).join(", ")}.`;
    return `Update for ${(alert.companies || []).join(", ")} in your watchlist.`;
  }
}
