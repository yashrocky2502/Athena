const fs = require('fs');
const path = require('path');

const storePath = path.resolve(__dirname, '../data/v3_news_store.json');

if (!fs.existsSync(storePath)) {
  console.log('No store file found at:', storePath);
  process.exit(1);
}

const raw = fs.readFileSync(storePath, 'utf8');
const data = JSON.parse(raw);

const stories = Object.values(data.storiesMap || {});

console.log(`Loaded ${stories.length} stories from the storage file.`);

const urlGroups = {};
const headlinePubGroups = {};
const hashGroups = {};

stories.forEach(story => {
  const url = story.primaryArticle.canonicalUrl || story.publisher.baseUrl || '';
  const headline = story.headline.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const publisher = story.publisher.id;
  const hash = story.primaryArticle.contentHash || '';

  if (url) {
    urlGroups[url] = urlGroups[url] || [];
    urlGroups[url].push(story);
  }

  const headlinePub = `${publisher}::${headline}`;
  headlinePubGroups[headlinePub] = headlinePubGroups[headlinePub] || [];
  headlinePubGroups[headlinePub].push(story);

  if (hash) {
    hashGroups[hash] = hashGroups[hash] || [];
    hashGroups[hash].push(story);
  }
});

console.log('\n--- DUPLICATES BY CANONICAL URL ---');
let urlDups = 0;
for (const [url, list] of Object.entries(urlGroups)) {
  if (list.length > 1) {
    urlDups++;
    console.log(`\nURL: ${url} (${list.length} occurrences)`);
    list.forEach(s => {
      console.log(`  - Story ID: ${s.storyId}`);
      console.log(`    Headline: "${s.headline}"`);
      console.log(`    Publisher: ${s.publisher.id} (${s.primaryArticle.id})`);
      console.log(`    PublishedAt: ${s.publishedAt}`);
    });
  }
}
console.log(`Total duplicate URL groups: ${urlDups}`);

console.log('\n--- DUPLICATES BY PUBLISHER + NORMALIZED HEADLINE ---');
let headPubDups = 0;
for (const [key, list] of Object.entries(headlinePubGroups)) {
  if (list.length > 1) {
    headPubDups++;
    console.log(`\nPublisher::Headline: ${key} (${list.length} occurrences)`);
    list.forEach(s => {
      console.log(`  - Story ID: ${s.storyId}`);
      console.log(`    Headline: "${s.headline}"`);
      console.log(`    Publisher: ${s.publisher.id}`);
      console.log(`    URL: ${s.primaryArticle.canonicalUrl}`);
    });
  }
}
console.log(`Total duplicate Publisher+Headline groups: ${headPubDups}`);

console.log('\n--- DUPLICATES BY CONTENT HASH ---');
let hashDups = 0;
for (const [hash, list] of Object.entries(hashGroups)) {
  if (list.length > 1) {
    hashDups++;
    console.log(`\nContent Hash: ${hash} (${list.length} occurrences)`);
    list.forEach(s => {
      console.log(`  - Story ID: ${s.storyId}`);
      console.log(`    Headline: "${s.headline}"`);
      console.log(`    Publisher: ${s.publisher.id}`);
    });
  }
}
console.log(`Total duplicate Content Hash groups: ${hashDups}`);
