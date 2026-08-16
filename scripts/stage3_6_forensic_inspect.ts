import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function computeSha256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

function analyzeDataset(relPath: string) {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) {
        return {
            path: relPath,
            exists: false,
            count: 0,
            sizeB: 0,
            sha256: 'FILE_NOT_FOUND',
            oldestTime: null,
            newestTime: null,
            earliestArticle: null,
            latestArticle: null,
            duplicateIdsCount: 0,
            uniqueUrlsCount: 0,
            totalUrlsCount: 0,
            v3Subcounts: null
        };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const sizeB = fs.statSync(fullPath).size;

    let items: any[] = [];
    let v3Subcounts: any = null;

    try {
        const parsed = JSON.parse(content);
        if (relPath.includes('v3_news_store.json')) {
            const rawCount = Object.keys(parsed.rawArticles || {}).length;
            const normCount = Object.keys(parsed.normalizedArticles || {}).length;
            const structCount = Object.keys(parsed.structuredDataMap || {}).length;
            const intelCount = Object.keys(parsed.intelligenceMap || {}).length;
            const storyCount = Object.keys(parsed.storiesMap || {}).length;
            const auditCount = Object.keys(parsed.auditLogsMap || {}).length;

            v3Subcounts = {
                rawArticles: rawCount,
                normalizedArticles: normCount,
                structuredDataMap: structCount,
                intelligenceMap: intelCount,
                storiesMap: storyCount,
                auditLogsMap: auditCount
            };
            items = Object.values(parsed.storiesMap || parsed.rawArticles || {});
        } else if (Array.isArray(parsed)) {
            items = parsed;
        } else if (parsed.articles) {
            items = parsed.articles;
        } else {
            items = Object.values(parsed);
        }
    } catch (e: any) {
        console.error(`Failed to parse ${relPath}:`, e.message);
    }

    const ids = new Set<string>();
    let duplicateIdsCount = 0;
    const urls = new Set<string>();
    let totalUrlsCount = 0;

    let oldestTime: Date | null = null;
    let newestTime: Date | null = null;
    let earliestArticle: any = null;
    let latestArticle: any = null;

    for (const item of items) {
        if (!item) continue;
        const id = item.id || item.storyId || item.articleId;
        if (id) {
            if (ids.has(id)) duplicateIdsCount++;
            else ids.add(id);
        }

        const url = item.canonicalUrl || item.sourceUrl || item.url || item.source?.url;
        if (url) {
            totalUrlsCount++;
            urls.add(url);
        }

        const dateStr = item.publishedAt || item.collectedAt || item.timestamp || item.createdAt;
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                if (!oldestTime || d < oldestTime) {
                    oldestTime = d;
                    earliestArticle = { id, title: item.headline || item.title, date: dateStr };
                }
                if (!newestTime || d > newestTime) {
                    newestTime = d;
                    latestArticle = { id, title: item.headline || item.title, date: dateStr };
                }
            }
        }
    }

    return {
        path: relPath,
        exists: true,
        count: items.length,
        sizeB,
        sha256,
        oldestTime: oldestTime ? oldestTime.toISOString() : null,
        newestTime: newestTime ? newestTime.toISOString() : null,
        earliestArticle,
        latestArticle,
        duplicateIdsCount,
        uniqueUrlsCount: urls.size,
        totalUrlsCount,
        v3Subcounts
    };
}

async function main() {
    console.log("=================================================");
    console.log("STAGE 3.6 DATASET FORENSIC ANALYSIS");
    console.log("=================================================\n");

    const files = [
        'data/news_core_v2.json',
        'data/news_core_v2.json.bak',
        'data/v3_news_store.json',
        'data/news_intelligence_v2.json',
        'data/news_stage2_store.json',
        'data/news_stage2_store.json.bak'
    ];

    for (const f of files) {
        const res = analyzeDataset(f);
        console.log(`--- ${f} ---`);
        console.log(`Exists: ${res.exists}`);
        console.log(`Size: ${res.sizeB} bytes (${(res.sizeB / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`SHA256: ${res.sha256}`);
        console.log(`Record Count: ${res.count}`);
        if (res.v3Subcounts) {
            console.log(`V3 Sub-counts:`, JSON.stringify(res.v3Subcounts));
        }
        console.log(`Duplicate IDs: ${res.duplicateIdsCount}`);
        console.log(`Unique Canonical URLs: ${res.uniqueUrlsCount} (out of ${res.totalUrlsCount})`);
        console.log(`Oldest Timestamp: ${res.oldestTime}`);
        console.log(`Newest Timestamp: ${res.newestTime}`);
        console.log(`Earliest Article:`, JSON.stringify(res.earliestArticle));
        console.log(`Latest Article:`, JSON.stringify(res.latestArticle));
        console.log("");
    }
}

main().catch(console.error);
