
import fs from 'fs';
import path from 'path';

const v3Store = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'v3_news_store.json'), 'utf-8'));
console.log('V3 Stories Count:', Object.keys(v3Store.storiesMap).length);
const legacyStore = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'news_core_v2.json'), 'utf-8'));
console.log('Legacy Stories Count:', legacyStore.length);
