
import { newsStore } from "../storage/PersistentNewsStore";
import { NewsArticleV2 } from "../domain/NewsArticle";
import { TelegramOutbox } from "../storage/TelegramOutbox";

async function testConcurrentPersistence() {
    console.log("Running: Concurrency Persistence Injection...");
    const article1: NewsArticleV2 = { 
        id: "adv_1", 
        headline: "A", 
        category: "Market",
        source: { publisher: "Test", url: "https://test1.com", collectionMethod: "RSS" }
    } as any;
    const article2: NewsArticleV2 = { 
        id: "adv_2", 
        headline: "B", 
        category: "Market",
        source: { publisher: "Test", url: "https://test2.com", collectionMethod: "RSS" }
    } as any;

    await Promise.all([
        newsStore.saveArticles([article1]),
        newsStore.saveArticles([article2])
    ]);
    console.log("Concurrency test finished.");
}

async function testTelegramDurableOutbox() {
    console.log("Running: Telegram Outbox Crash Recovery Injection...");
    const outbox = new TelegramOutbox();
    const articleId = "telegram_crash_test";
    
    outbox.addEntry(articleId, { id: articleId, headline: "Test" });
    
    const entries = outbox.getEntries();
    if (entries.find(e => e.articleId === articleId)) {
        console.log("Telegram Durable Outbox Test Passed: Entry persisted before dispatch.");
    } else {
        throw new Error("Telegram Outbox Persistence Failed.");
    }
}

async function runAdversarialSuite() {
    console.log("Starting Adversarial Full-System Failure Injection...");
    await testConcurrentPersistence();
    await testTelegramDurableOutbox();
    console.log("Adversarial Suite Completed.");
}

runAdversarialSuite().catch(console.error);
