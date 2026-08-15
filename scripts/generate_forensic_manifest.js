import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const files = [
    'data/news_core_v2.json',
    'data/news_intelligence_v2.json',
    'data/v3_news_store.json',
    'data/news_core_v2.json.bak'
];

function getHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function getCount(filePath) {
    if (!fs.existsSync(filePath)) return 0;
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(data)) return data.length;
        if (data.storiesMap) return Object.keys(data.storiesMap).length;
        if (data.rawArticles) return Object.keys(data.rawArticles).length;
        return 0;
    } catch (e) {
        return 'ERROR: ' + e.message;
    }
}

const manifest = {
    generatedAt: new Date().toISOString(),
    files: files.map(file => ({
        file,
        articleCount: getCount(file),
        fileHash: getHash(file),
        fileSize: fs.existsSync(file) ? fs.statSync(file).size : 0
    }))
};

if (!fs.existsSync('data/forensic')) {
    fs.mkdirSync('data/forensic', { recursive: true });
}

fs.writeFileSync('data/forensic/pre-rebuild-manifest.json', JSON.stringify(manifest, null, 2));
console.log('Manifest generated at data/forensic/pre-rebuild-manifest.json');
console.log(JSON.stringify(manifest, null, 2));
