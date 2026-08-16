import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface InventoryBaseline {
    timestamp: string;
    sha256: string;
    count: number;
    ids: string[];
}

function computeSha256(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
}

async function runInventory() {
    console.log("=================================================");
    console.log("ATHENA STAGE 3.7: CANONICAL STORE FORENSIC INVENTORY");
    console.log("=================================================\n");

    const storePath = path.join(process.cwd(), 'data', 'news_stage2_store.json');
    if (!fs.existsSync(storePath)) {
        console.error(`CRITICAL ERROR: Canonical store file not found at ${storePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(storePath, 'utf-8');
    const sha256 = computeSha256(content);
    const sizeBytes = fs.statSync(storePath).size;

    let articles: any[] = [];
    try {
        articles = JSON.parse(content);
        if (!Array.isArray(articles)) {
            throw new Error("Store content is not a JSON array.");
        }
    } catch (err: any) {
        console.error(`CRITICAL ERROR: Failed to parse canonical store: ${err.message}`);
        process.exit(1);
    }

    const totalCount = articles.length;

    // Sets and maps for analysis
    const seenIds = new Set<string>();
    const duplicateIds: string[] = [];
    const seenUrls = new Set<string>();
    const duplicateUrls: string[] = [];
    
    let oldestPublished: Date | null = null;
    let newestPublished: Date | null = null;

    const categoryCounts: Record<string, number> = {};
    const publisherCounts: Record<string, number> = {};
    const monthYearCounts: Record<string, number> = {};
    const unusuallyOldArticles: any[] = [];
    const missingFieldsArticles: Array<{ id: string; headline: string; missing: string[] }> = [];

    const CUTOFF_YEAR = 2020; // Articles published before Jan 1, 2020 are flagged as unusually old

    for (const art of articles) {
        if (!art) continue;

        // 1. Unique IDs & Duplicates check
        const id = art.id;
        if (id) {
            if (seenIds.has(id)) {
                duplicateIds.push(id);
            } else {
                seenIds.add(id);
            }
        }

        // 2. Unique URLs & Duplicates check
        const url = art.sourceUrl || art.url;
        if (url) {
            const normalizedUrl = url.split('?')[0].replace(/\/$/, '').toLowerCase();
            if (seenUrls.has(normalizedUrl)) {
                duplicateUrls.push(url);
            } else {
                seenUrls.add(normalizedUrl);
            }
        }

        // 3. Date Parsing & range tracking
        const pubDateStr = art.publishedAt;
        if (pubDateStr) {
            const d = new Date(pubDateStr);
            if (!isNaN(d.getTime())) {
                if (!oldestPublished || d < oldestPublished) oldestPublished = d;
                if (!newestPublished || d > newestPublished) newestPublished = d;

                // Month/Year grouping
                const myKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthYearCounts[myKey] = (monthYearCounts[myKey] || 0) + 1;

                // Unusually old check
                if (d.getFullYear() < CUTOFF_YEAR) {
                    unusuallyOldArticles.push({
                        id,
                        headline: art.headline || art.title,
                        publishedAt: pubDateStr
                    });
                }
            }
        }

        // 4. Category breakdown
        const category = art.primaryCategory || art.category || 'Unclassified';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;

        // 5. Publisher breakdown
        const publisher = art.source?.name || art.publisher || 'Unknown';
        publisherCounts[publisher] = (publisherCounts[publisher] || 0) + 1;

        // 6. Schema compliance (required fields checklist)
        const missing: string[] = [];
        if (!art.id) missing.push('id');
        if (!art.headline && !art.title) missing.push('headline');
        if (!art.body && !art.content) missing.push('body');
        if (!art.publishedAt) missing.push('publishedAt');
        if (!art.fetchedAt) missing.push('fetchedAt');
        if (!art.primaryCategory && !art.category) missing.push('primaryCategory');
        if (!art.sourceUrl && !art.url) missing.push('sourceUrl');
        if (!art.source) {
            missing.push('source');
        } else {
            if (!art.source.name) missing.push('source.name');
            if (!art.source.url) missing.push('source.url');
            if (!art.source.collectionMethod) missing.push('source.collectionMethod');
        }

        if (missing.length > 0) {
            missingFieldsArticles.push({
                id: id || 'MISSING_ID',
                headline: art.headline || art.title || 'MISSING_HEADLINE',
                missing
            });
        }
    }

    // 7. Added since previous inventory tracking
    const baselinePath = path.join(process.cwd(), 'data', '.inventory_baseline.json');
    let addedCount = 0;
    let addedArticles: string[] = [];

    if (fs.existsSync(baselinePath)) {
        try {
            const rawBaseline = fs.readFileSync(baselinePath, 'utf-8');
            const baseline: InventoryBaseline = JSON.parse(rawBaseline);
            const baselineIds = new Set(baseline.ids);

            for (const id of seenIds) {
                if (!baselineIds.has(id)) {
                    addedCount++;
                    addedArticles.push(id);
                }
            }
        } catch (err: any) {
            console.warn(`[Inventory] Warning loading baseline file: ${err.message}`);
        }
    }

    // Always update baseline file so the next runs are relative to current
    const newBaseline: InventoryBaseline = {
        timestamp: new Date().toISOString(),
        sha256,
        count: totalCount,
        ids: Array.from(seenIds)
    };
    fs.writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 2), 'utf-8');

    // PRINT REPORT
    console.log(`File: data/news_stage2_store.json`);
    console.log(`File Size: ${sizeBytes} bytes (${(sizeBytes / 1024 / 1024).toFixed(3)} MB)`);
    console.log(`SHA-256 Hash: ${sha256}`);
    console.log(`-------------------------------------------------`);
    console.log(`Total Canonical Articles: ${totalCount}`);
    console.log(`Unique Articles (by ID): ${seenIds.size}`);
    console.log(`Unique Canonical URLs:   ${seenUrls.size}`);
    console.log(`Duplicate IDs Count:     ${duplicateIds.length}`);
    console.log(`Duplicate URLs Count:    ${duplicateUrls.length}`);
    console.log(`Articles Added Since Baseline: ${addedCount}`);
    if (addedCount > 0) {
        console.log(` -> New IDs: ${addedArticles.slice(0, 10).join(', ')}${addedArticles.length > 10 ? '...' : ''}`);
    }
    console.log(`-------------------------------------------------`);
    console.log(`Oldest Published Date:  ${oldestPublished ? oldestPublished.toISOString() : 'N/A'}`);
    console.log(`Newest Published Date:  ${newestPublished ? newestPublished.toISOString() : 'N/A'}`);
    console.log(`-------------------------------------------------`);

    console.log(`Articles By Category:`);
    Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
            console.log(` - ${cat}: ${count}`);
        });

    console.log(`\nArticles By Publisher:`);
    Object.entries(publisherCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([pub, count]) => {
            console.log(` - ${pub}: ${count}`);
        });

    console.log(`\nArticles By Month/Year (Top 10 chronological):`);
    Object.entries(monthYearCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-10)
        .forEach(([my, count]) => {
            console.log(` - ${my}: ${count}`);
        });

    console.log(`\nUnusually Old Articles (published before ${CUTOFF_YEAR}):`);
    console.log(`Total Count: ${unusuallyOldArticles.length}`);
    unusuallyOldArticles.slice(0, 5).forEach((art) => {
        console.log(` - [${art.id}] (${art.publishedAt}) ${art.headline}`);
    });
    if (unusuallyOldArticles.length > 5) {
        console.log(` ... and ${unusuallyOldArticles.length - 5} more unusually old records.`);
    }

    console.log(`\nArticles Missing Required Schema Fields:`);
    console.log(`Total Non-compliant Count: ${missingFieldsArticles.length}`);
    missingFieldsArticles.slice(0, 5).forEach((art) => {
        console.log(` - [${art.id}] "${art.headline}" missing fields: [${art.missing.join(', ')}]`);
    });
    if (missingFieldsArticles.length > 5) {
        console.log(` ... and ${missingFieldsArticles.length - 5} more non-compliant records.`);
    }

    console.log("\n=================================================");
    console.log("INVENTORY COMPLETED SUCCESSFULLY");
    console.log("=================================================");
}

runInventory().catch(err => {
    console.error("Inventory execution failed:", err);
    process.exit(1);
});
