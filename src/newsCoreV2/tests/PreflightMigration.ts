
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

const legacyRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'news_core_v2.json'), 'utf-8'));
const v3Raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'v3_news_store.json'), 'utf-8'));
const intelRaw = JSON.parse(fs.readFileSync(path.join(dataDir, 'news_intelligence_v2.json'), 'utf-8'));

function normalize(art: any, type: 'legacy' | 'v3' | 'intel') {
    if (type === 'legacy') {
        return {
            id: art.id,
            url: art.canonicalUrl || art.source?.url,
            headline: art.headline?.trim().toLowerCase(),
            source: art.source?.publisher?.trim().toLowerCase()
        };
    } else if (type === 'intel') {
        return {
            id: art.articleId,
            url: art.canonicalUrl,
            headline: art.headline?.trim().toLowerCase(),
            source: art.source?.trim().toLowerCase()
        };
    } else { // v3
        // V3 storiesMap is an object
        return {
            id: art.storyId,
            url: art.canonicalUrl,
            headline: art.headline?.trim().toLowerCase(),
            source: art.publisher?.name?.trim().toLowerCase()
        };
    }
}

const legacyMap = new Map<string, any>(legacyRaw.map((a: any) => [a.id, normalize(a, 'legacy')]));
const intelMap = new Map<string, any>(intelRaw.map((a: any) => [a.articleId, normalize(a, 'intel')]));
const v3Map = new Map<string, any>(Object.values(v3Raw.storiesMap).map((a: any) => [a.storyId, normalize(a, 'v3')]));

// 1. Classification of Intelligence-only (74 records identified earlier)
const intelOnlyIds = [...intelMap.keys()].filter(id => !legacyMap.has(id) && !v3Map.has(id));
console.log('--- Intelligence-Only (74 IDs) Analysis ---');
intelOnlyIds.forEach(id => {
    const intel = intelMap.get(id);
    // Match against Legacy/V3 using normalized URL/headline
    const matchLegacy = [...legacyMap.values()].find((a: any) => a.url === intel!.url || a.headline === intel!.headline);
    const matchV3 = [...v3Map.values()].find((a: any) => a.url === intel!.url || a.headline === intel!.headline);
    
    console.log(`ID: ${id}, URL: ${intel!.url}, MatchLegacy: ${!!matchLegacy}, MatchV3: ${!!matchV3}`);
});

// 2. Legacy-only (2 records identified earlier)
const legacyOnlyIds = [...legacyMap.keys()].filter(id => !intelMap.has(id) && !v3Map.has(id));
console.log('\n--- Legacy-Only (2 IDs) Analysis ---');
legacyOnlyIds.forEach(id => console.log('Legacy-Only ID:', id));

// 3. V3 Cross-store analysis (zero ID overlap)
console.log('\n--- V3 Cross-Store Analysis ---');
let v3Matched = 0;
for(const v3Art of Array.from(v3Map.values()) as any[]) {
    const matchLegacy = [...legacyMap.values()].find((a: any) => a.url === v3Art.url || a.headline === v3Art.headline);
    const matchIntel = [...intelMap.values()].find((a: any) => a.url === v3Art.url || a.headline === v3Art.headline);
    if(matchLegacy || matchIntel) v3Matched++;
}
console.log('V3 articles matched by URL/headline:', v3Matched, 'out of', v3Map.size);

// 4. Populations
const popA = new Set([...legacyMap.keys(), ...v3Map.keys(), ...intelMap.keys()]).size;
console.log('\n--- Population Counts ---');
console.log('Population A (Exact ID Union):', popA);
