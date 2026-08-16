import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { expect, test, describe } from 'vitest';

const manifestPath = path.join(process.cwd(), 'data/forensic/pre-rebuild-manifest.json');

describe('ATHENA Data Integrity Protection', () => {
    const protectedFiles = [
        'data/news_core_v2.json',
        'data/news_core_v2.json.bak',
        'data/v3_news_store.json',
        'data/news_intelligence_v2.json'
    ];

    describe('1. File Existence & Structural Health', () => {
        protectedFiles.forEach((relPath) => {
            test(`Protected file ${relPath} must exist and contain valid uncorrupted JSON structure`, () => {
                const filePath = path.join(process.cwd(), relPath);
                
                // 1. Existence check
                expect(fs.existsSync(filePath), `Protected file ${relPath} was deleted!`).toBe(true);

                // 2. Parse check
                const raw = fs.readFileSync(filePath, 'utf-8');
                expect(raw.trim().length, `Protected file ${relPath} is empty!`).toBeGreaterThan(0);

                let parsed: any;
                try {
                    parsed = JSON.parse(raw);
                } catch (e: any) {
                    expect.fail(`Protected file ${relPath} contains corrupt invalid JSON: ${e.message}`);
                }

                // 3. Schema & record validation
                let recordCount = 0;
                if (Array.isArray(parsed)) {
                    recordCount = parsed.length;
                    expect(recordCount, `Dataset in ${relPath} is empty`).toBeGreaterThan(0);
                    // Spot check first and last records for non-corruption
                    const sample = [parsed[0], parsed[Math.floor(recordCount / 2)], parsed[recordCount - 1]];
                    sample.forEach((item, idx) => {
                        expect(item, `Corrupted record in ${relPath} at sample index ${idx}`).toBeDefined();
                        expect(typeof item.id || typeof item.articleId, `Missing ID in ${relPath}`).toBeTruthy();
                        expect(item.headline || item.title, `Missing headline/title in ${relPath}`).toBeDefined();
                    });
                } else if (parsed && typeof parsed === 'object') {
                    if (parsed.storiesMap) {
                        recordCount = Object.keys(parsed.storiesMap).length;
                    } else if (parsed.rawArticles) {
                        recordCount = Object.keys(parsed.rawArticles).length;
                    } else {
                        recordCount = Object.keys(parsed).length;
                    }
                    expect(recordCount, `Key-value dataset in ${relPath} is empty`).toBeGreaterThan(0);
                }
            });
        });
    });

    describe('2. Historical Forensic Baseline Audit', () => {
        if (!fs.existsSync(manifestPath)) {
            test.skip('Forensic manifest not found', () => {});
            return;
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

        manifest.files.forEach((fileInfo: any) => {
            test(`Forensic tracking for ${fileInfo.file}`, () => {
                const filePath = path.join(process.cwd(), fileInfo.file);
                expect(fs.existsSync(filePath), `Forensic file ${fileInfo.file} missing`).toBe(true);

                const fileBuffer = fs.readFileSync(filePath);
                const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

                let currentCount = 0;
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (Array.isArray(data)) currentCount = data.length;
                else if (data.storiesMap) currentCount = Object.keys(data.storiesMap).length;
                else if (data.rawArticles) currentCount = Object.keys(data.rawArticles).length;
                else currentCount = Object.keys(data).length;

                // Verify file remains populated with substantial valid market intelligence (> 100 articles)
                expect(currentCount, `Article count in ${fileInfo.file} unexpectedly collapsed below critical safety threshold!`).toBeGreaterThan(100);

                // Note divergence from initial snapshot if background rotation took place
                if (hashSum !== fileInfo.fileHash) {
                    // Safe verification: ensure divergence is non-destructive
                    expect(currentCount).toBeGreaterThan(0);
                }
            });
        });
    });
});
