import { StoryEvolution } from "../types";

export class StoryEvolutionEngine {
  // Compare previous and current company stories.
  // Automatically detect: Strengthening, Weakening, Stable, Reversal, Emerging Story, Completed Story

  detectEvolution(
    previousStory: string, 
    currentStory: string, 
    previousConfidence: number, 
    currentConfidence: number
  ): Partial<StoryEvolution> {
    
    let detectedStatus = "Stable";
    let reason = "No significant changes detected in the narrative.";
    
    // Simplistic detection logic
    if (currentConfidence > previousConfidence + 5) {
      detectedStatus = "Strengthening";
      reason = "Evidence confidence has notably increased, solidifying the narrative.";
    } else if (currentConfidence < previousConfidence - 5) {
      detectedStatus = "Weakening";
      reason = "Conflicting evidence or fading momentum has weakened the story.";
    }
    
    // Check for reversal or emerging keywords (mock implementation)
    const currentLower = currentStory.toLowerCase();
    const prevLower = previousStory.toLowerCase();
    
    if (currentLower.includes("reversal") || currentLower.includes("downside") && !prevLower.includes("downside")) {
      detectedStatus = "Reversal";
      reason = "Key metrics indicate a trend reversal from the previous trajectory.";
    }

    if (previousStory === "" && currentStory !== "") {
      detectedStatus = "Emerging Story";
      reason = "A new market narrative has started forming based on recent events.";
    }

    return {
      previousStory,
      currentStory,
      reasonForChange: reason,
      storyConfidence: currentConfidence
    };
  }

  // Clusters related events
  clusterEvents(events: any[]) {
    // Identify common themes and group them
    return {
      clusterId: "cluster-" + Date.now(),
      theme: "Sector Story",
      events: events.map(e => e.id)
    };
  }
}
