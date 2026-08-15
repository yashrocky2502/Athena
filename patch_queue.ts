import fs from 'fs';

let content = fs.readFileSync('src/news/NewsEngine/TelegramDecisionEngine.ts', 'utf-8');

// 1. Add Import
if (!content.includes('PersistentTelegramQueue')) {
  content = content.replace(
    "import { ResolvedArticle, createResolvedArticle } from '../models/ResolvedArticle';",
    "import { ResolvedArticle, createResolvedArticle } from '../models/ResolvedArticle';\nimport { PersistentTelegramQueue, TelegramQueueItem } from './PersistentTelegramQueue';"
  );
}

// 2. Remove old TelegramQueueItem interface
content = content.replace(/export interface TelegramQueueItem \{[\s\S]*?\n\}\n\n/m, '');

// 3. Remove RAM queue and replace startWorker logic
content = content.replace(
  /private queue: TelegramQueueItem\[\] = \[\];\n/,
  ''
);

// 4. Update the Queueing logic inside processArticle
// From:
// const queueItem: TelegramQueueItem = {
//   id: articleId,
//   ...
//   retryCount: 0,
// };
// this.queue.push(queueItem);
// log.queueInserted = true;
// log.queued = true;
//
// To:
// const eventId = `${symbol}_${category.replace(/\s+/g, '_')}`;
// const queueItem: TelegramQueueItem = {
//   id: articleId,
//   eventId,
//   ...
//   retryCount: 0,
//   queuedAt: nowIso,
//   nextRetryAt: Date.now(),
// };
// PersistentTelegramQueue.getInstance().enqueue(queueItem);
// log.queueInserted = true;
// log.queued = true;

content = content.replace(
  /const queueItem: TelegramQueueItem = \{([\s\S]*?)retryCount: 0,\n\s*\};\n\n\s*this\.queue\.push\(queueItem\);/m,
  `const eventId = \`\${symbol}_\${category.replace(/\\s+/g, '_')}\`;
        const queueItem: TelegramQueueItem = {
          $1retryCount: 0,
          eventId,
          queuedAt: nowIso,
          nextRetryAt: Date.now(),
          finalStatus: 'PENDING'
        };
        PersistentTelegramQueue.getInstance().enqueue(queueItem);`
);

// 5. Update startWorker
content = content.replace(
  /if \(this\.queue\.length > 0\) \{[\s\S]*?\} else \{[\s\S]*?\/\/ Idle polling interval[\s\S]*?await new Promise\(\(resolve\) => setTimeout\(resolve, 1000\)\);\n\s*\}/m,
  `const item = PersistentTelegramQueue.getInstance().getNextReadyItem();
          if (item) {
            await this.processQueueItem(item);
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }`
);

// 6. Fix getQueuePosition logging
content = content.replace(
  /Position: \$\{this\.queue\.length\}/m,
  `Position: \${PersistentTelegramQueue.getInstance().getQueuePosition(articleId)}`
);

fs.writeFileSync('src/news/NewsEngine/TelegramDecisionEngine.ts', content);
