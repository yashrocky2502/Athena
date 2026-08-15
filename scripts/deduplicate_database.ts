import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findDuplicateStory, mergeStories } from '../src/news/NewsEngineV3/storage/V3StorageInterfaces';
import { V3Story } from '../src/news/NewsEngineV3/types/V3Types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storePath = path.resolve(__dirname, '../data/v3_news_store.json');
console.log('Resolved __filename:', __filename);
console.log('Resolved __dirname:', __dirname);
console.log('Resolved storePath:', storePath);

if (!fs.existsSync(storePath)) {
  console.log('No store file found at:', storePath);
  process.exit(1);
}

const raw = fs.readFileSync(storePath, 'utf8');
const data = JSON.parse(raw);

const originalStories = Object.values(data.storiesMap || {}) as V3Story[];
console.log(`Original stories count: ${originalStories.length}`);

const cleanStoriesMap = new Map<string, V3Story>();
let duplicateCount = 0;
let mergeCount = 0;

// Sort by publishedAt ascending so older stories are processed first (or direct override logic can naturally take place)
originalStories.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

for (const story of originalStories) {
  const existingList = Array.from(cleanStoriesMap.values());
  const duplicate = findDuplicateStory(story, existingList);

  if (duplicate) {
    duplicateCount++;
    const merged = mergeStories(duplicate, story);
    // Keep the original storyId
    cleanStoriesMap.set(duplicate.storyId, merged);
    mergeCount++;
    console.log(`Merged duplicate: "${story.headline}" (${story.publisher.id}) -> existing: "${duplicate.headline}" (${duplicate.publisher.id})`);
  } else {
    cleanStoriesMap.set(story.storyId, story);
  }
}

console.log(`\nProcessed ${originalStories.length} stories.`);
console.log(`Detected and merged ${duplicateCount} duplicate stories.`);
console.log(`Final clean stories count: ${cleanStoriesMap.size}`);

// Update the storiesMap in-place
data.storiesMap = Object.fromEntries(cleanStoriesMap);
data.lastPersistedAt = new Date().toISOString();

// Create backup first
const backupPath = `${storePath}.bak`;
fs.writeFileSync(backupPath, raw, 'utf8');
console.log(`Backup saved to ${backupPath}`);

// Write updated store
fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Deduplicated data successfully written to ${storePath}`);
