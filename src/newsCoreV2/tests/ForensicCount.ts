
import fs from 'fs';
import path from 'path';

function countArticles(filePath: string, type: 'legacy' | 'v3' | 'intelligence') {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (type === 'legacy') {
            console.log(`Legacy (${path.basename(filePath)}): ${data.length} articles`);
        } else if (type === 'v3') {
            console.log(`V3 (${path.basename(filePath)}): ${Object.keys(data.storiesMap).length} stories`);
        } else if (type === 'intelligence') {
             console.log(`Intelligence (${path.basename(filePath)}): ${Object.keys(data).length} records`);
        }
    } catch (e) {
        console.error(`Error processing ${filePath}: ${e}`);
    }
}

countArticles(path.join(process.cwd(), 'data', 'news_core_v2.json'), 'legacy');
countArticles(path.join(process.cwd(), 'data', 'v3_news_store.json'), 'v3');
countArticles(path.join(process.cwd(), 'data', 'news_intelligence_v2.json'), 'intelligence');
