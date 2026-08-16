import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

function calculateFileMeta(relPath: string) {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) return { hash: 'NOT_FOUND', count: 0, exists: false, size: 0 };
    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    let count = 0;
    try {
        const parsed = JSON.parse(content.toString('utf-8'));
        if (Array.isArray(parsed)) count = parsed.length;
        else if (parsed.storiesMap) count = Object.keys(parsed.storiesMap).length;
        else if (parsed.rawArticles) count = Object.keys(parsed.rawArticles).length;
        else count = Object.keys(parsed).length;
    } catch {
        count = -1;
    }
    return { hash, count, exists: true, size: content.length };
}

function fetchJson(urlPath: string, method = 'GET', postData: any = null, headers: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(urlPath, BASE_URL);
        const req = http.request(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 3000,
                path: `${parsedUrl.pathname}${parsedUrl.search}`,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close',
                    ...headers
                },
                agent: false
            },
            (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ statusCode: res.statusCode, data: json });
                    } catch (e: any) {
                        resolve({ statusCode: res.statusCode, raw: data, error: e.message });
                    }
                });
            }
        );
        req.on('error', reject);
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

async function runLiveDryRunAudit() {
    console.log('===============================================================');
    console.log('ATHENA STAGE 3.4: LIVE LEGACY WRITER ISOLATION AUDIT');
    console.log('===============================================================\n');

    const datasets = [
        'data/news_core_v2.json',
        'data/news_core_v2.json.bak',
        'data/v3_news_store.json',
        'data/news_intelligence_v2.json',
        'data/news_stage2_store.json',
        'data/news_stage2_store.json.bak'
    ];

    console.log('1. CAPTURING DATASET STATE (BEFORE):');
    const beforeHashes: Record<string, any> = {};
    for (const d of datasets) {
        beforeHashes[d] = calculateFileMeta(d);
        console.log(` - ${d}: count=${beforeHashes[d].count}, size=${beforeHashes[d].size} bytes, hash=${beforeHashes[d].hash}`);
    }

    console.log('\n2. ISOLATING LEGACY WRITERS (SETTING ATHENA_LEGACY_WRITERS_ENABLED = false):');
    const isoRes = await fetchJson('/api/v5/news/isolation/toggle', 'POST', { enabled: false });
    console.log(` - Legacy writers enabled: ${isoRes.data?.isolation?.legacyWritersEnabled}`);

    console.log('\n3. VERIFYING COMPREHENSIVE V2 & V3 READ PATHS ACROSS ALL 12 CATEGORIES:');
    const categories = [
        'All', 'Results', 'Crypto', 'IPO', 'F&O', 'Economy',
        'Market', 'Corporate', 'Commodities', 'Global', 'Technology', 'Exchange'
    ];

    let v2ReadSuccess = 0;
    let v3ReadSuccess = 0;

    for (const cat of categories) {
        // V2 Read Path
        const resV2 = await fetchJson(`/api/v4/news/feed?category=${cat}&page=1&limit=20`);
        if (resV2.statusCode === 200 && resV2.data?.status === 'success') {
            v2ReadSuccess++;
        }

        // V3 Read Path
        const resV3 = await fetchJson(`/api/v5/news/feed?category=${cat}&page=1&limit=20`);
        if (resV3.statusCode === 200 && resV3.data?.status === 'success') {
            v3ReadSuccess++;
        }
    }

    console.log(` - V2 Read Path: ${v2ReadSuccess} / ${categories.length} categories accessible`);
    console.log(` - V3 Read Path: ${v3ReadSuccess} / ${categories.length} categories accessible`);

    console.log('\n4. VERIFYING MANUAL SYNC TRIGGER SUPPRESSION:');
    const syncRes = await fetchJson('/api/v4/news/sync', 'POST');
    console.log(` - Legacy sync trigger response:`, JSON.stringify(syncRes.data));

    console.log('\n5. RETRIEVING DIAGNOSTIC HEALTH TELEMETRY:');
    const healthRes = await fetchJson('/api/v5/news/health');
    console.log(' - Health Telemetry Summary:');
    console.log(JSON.stringify({
        legacyWritersEnabled: healthRes.data?.legacyWritersEnabled,
        v3Enabled: healthRes.data?.v3Enabled,
        shadowModeEnabled: healthRes.data?.shadowModeEnabled,
        v2StoreAvailable: healthRes.data?.v2StoreAvailable,
        v3StoreAvailable: healthRes.data?.v3StoreAvailable,
        legacySchedulerStatus: healthRes.data?.legacySchedulerStatus,
        activeCounts: healthRes.data?.activeCounts
    }, null, 2));

    console.log('\n6. ISOLATION ROLLBACK VERIFICATION (TOGGLING TO TRUE THEN BACK TO FALSE):');
    const rbRes = await fetchJson('/api/v5/news/isolation/toggle', 'POST', { enabled: true });
    console.log(` - Legacy writers re-enabled temporarily: ${rbRes.data?.isolation?.legacyWritersEnabled}`);
    const rbRes2 = await fetchJson('/api/v5/news/isolation/toggle', 'POST', { enabled: false });
    console.log(` - Legacy writers returned to isolated state: ${rbRes2.data?.isolation?.legacyWritersEnabled}`);

    console.log('\n7. CAPTURING DATASET STATE (AFTER):');
    const afterHashes: Record<string, any> = {};
    let allUnmutated = true;
    for (const d of datasets) {
        afterHashes[d] = calculateFileMeta(d);
        const changed = afterHashes[d].hash !== beforeHashes[d].hash;
        if (changed) allUnmutated = false;
        console.log(` - ${d}: count=${afterHashes[d].count} (before=${beforeHashes[d].count}), size=${afterHashes[d].size} (before=${beforeHashes[d].size}), changed=${changed}`);
    }

    console.log('\n===============================================================');
    console.log(`AUDIT COMPLETE — ALL PROTECTED DATASETS UNMUTATED: ${allUnmutated}`);
    console.log('===============================================================');
}

runLiveDryRunAudit().catch(err => {
    console.error('Dry-run audit crashed:', err);
    process.exit(1);
});
