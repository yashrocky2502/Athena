import { StoryEngineRecord } from "../types";

// In-memory array of Story Engine Records
let storyEngineRecords: StoryEngineRecord[] = [];

export function getStories(): StoryEngineRecord[] {
  return storyEngineRecords;
}

export function addStory(story: Omit<StoryEngineRecord, "id" | "timestamp">): StoryEngineRecord {
  const newStory: StoryEngineRecord = {
    ...story,
    id: `st-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString()
  };
  storyEngineRecords.unshift(newStory);
  return newStory;
}

export function updateStoryStatus(id: string, status: StoryEngineRecord["status"]): boolean {
  const story = storyEngineRecords.find(s => s.id === id);
  if (story) {
    story.status = status;
    return true;
  }
  return false;
}

export function deleteStory(id: string): boolean {
  const initialLength = storyEngineRecords.length;
  storyEngineRecords = storyEngineRecords.filter(s => s.id !== id);
  return storyEngineRecords.length < initialLength;
}
