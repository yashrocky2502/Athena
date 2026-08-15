
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

function getLegacyIds(): Set<string> {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'news_core_v2.json'), 'utf-8'));
    return new Set(data.map((a: any) => a.id as string));
}

function getV3Ids(): Set<string> {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'v3_news_store.json'), 'utf-8'));
    // V3 store has 'storiesMap' which is an object of story objects
    return new Set(Object.keys(data.storiesMap));
}

function getIntelligenceIds(): Set<string> {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'news_intelligence_v2.json'), 'utf-8'));
    // Intelligence records have 'articleId'
    return new Set(data.map((r: any) => r.articleId as string));
}

const legacyIds = getLegacyIds();
const v3Ids = getV3Ids();
const intelIds = getIntelligenceIds();

console.log('--- Forensic Inventory ---');
console.log('Legacy IDs:', legacyIds.size);
console.log('V3 IDs:', v3Ids.size);
console.log('Intelligence IDs:', intelIds.size);

const intersectionLegacyV3 = new Set([...legacyIds].filter(id => v3Ids.has(id)));
const intersectionLegacyIntel = new Set([...legacyIds].filter(id => intelIds.has(id)));
const intersectionV3Intel = new Set([...v3Ids].filter(id => intelIds.has(id)));
const allThree = new Set([...intersectionLegacyV3].filter(id => intelIds.has(id)));

const uniqueLegacy = new Set([...legacyIds].filter(id => !v3Ids.has(id) && !intelIds.has(id)));
const uniqueV3 = new Set([...v3Ids].filter(id => !legacyIds.has(id) && !intelIds.has(id)));
const uniqueIntel = new Set([...intelIds].filter(id => !legacyIds.has(id) && !v3Ids.has(id)));

const totalUniqueCanonical = new Set([...legacyIds, ...v3Ids, ...intelIds]);

console.log('\n--- Reconciliation Report ---');
console.log('Legacy ∩ V3:', intersectionLegacyV3.size);
console.log('Legacy ∩ Intel:', intersectionLegacyIntel.size);
console.log('V3 ∩ Intel:', intersectionV3Intel.size);
console.log('Present in all three:', allThree.size);
console.log('\nUnique to Legacy:', uniqueLegacy.size);
console.log('Unique to V3:', uniqueV3.size);
console.log('Unique to Intel:', uniqueIntel.size);
console.log('\nTotal Unique Canonical Candidates:', totalUniqueCanonical.size);
