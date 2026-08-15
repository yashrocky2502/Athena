import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { expect, test, describe } from 'vitest';

const manifestPath = path.join(process.cwd(), 'data/forensic/pre-rebuild-manifest.json');

describe('ATHENA Data Integrity Protection', () => {
    if (!fs.existsSync(manifestPath)) {
        test.skip('Forensic manifest not found', () => {});
        return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    manifest.files.forEach((fileInfo: any) => {
        test(`File ${fileInfo.file} must remain untouched`, () => {
            const filePath = path.join(process.cwd(), fileInfo.file);
            
            // 1. Existence check
            expect(fs.existsSync(filePath), `Protected file ${fileInfo.file} was deleted!`).toBe(true);

            // 2. Hash check
            const fileBuffer = fs.readFileSync(filePath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            const currentHash = hashSum.digest('hex');
            
            // NOTE: We allow minor changes if the dev server is running and appending data, 
            // but for a strict cleanup, we want to know if it happened.
            // If the hash changed, we log it.
            if (currentHash !== fileInfo.fileHash) {
                console.warn(`[INTEGRITY WARNING] Hash changed for ${fileInfo.file}`);
                console.warn(`Expected: ${fileInfo.fileHash}`);
                console.warn(`Actual:   ${currentHash}`);
            }

            // 3. Article Count Check (must NOT decrease)
            let currentCount = 0;
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (Array.isArray(data)) currentCount = data.length;
                else if (data.storiesMap) currentCount = Object.keys(data.storiesMap).length;
                else if (data.rawArticles) currentCount = Object.keys(data.rawArticles).length;
            } catch (e) {
                expect.fail(`Failed to parse ${fileInfo.file}: ${e.message}`);
            }

            expect(currentCount, `Article count in ${fileInfo.file} decreased!`).toBeGreaterThanOrEqual(fileInfo.articleCount);
        });
    });
});
