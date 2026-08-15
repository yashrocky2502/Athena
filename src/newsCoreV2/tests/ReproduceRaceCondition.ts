import { newsStore } from "../storage/PersistentNewsStore";
import { NewsArticleV2 } from "../domain/NewsArticle";

export async function reproduceRaceCondition() {
    console.log("Starting race condition reproduction test...");
    
    const article1: NewsArticleV2 = {
        id: "race_test_1",
        headline: "Test 1",
        canonicalUrl: "https://test1.com",
        source: { publisher: "Test", url: "https://test1.com", collectionMethod: "RSS" },
        publishedAt: new Date().toISOString(),
        collectedAt: new Date().toISOString(),
        category: "Market",
        primaryCategory: "Market",
    } as any;

    const article2: NewsArticleV2 = {
        id: "race_test_2",
        headline: "Test 2",
        canonicalUrl: "https://test2.com",
        source: { publisher: "Test", url: "https://test2.com", collectionMethod: "RSS" },
        publishedAt: new Date().toISOString(),
        collectedAt: new Date().toISOString(),
        category: "Market",
        primaryCategory: "Market",
    } as any;

    // Launch concurrent writes
    await Promise.all([
        newsStore.saveArticles([article1]),
        newsStore.saveArticles([article2])
    ]);

    const articles = newsStore.getAllArticles();
    const found1 = articles.find(a => a.id === "race_test_1");
    const found2 = articles.find(a => a.id === "race_test_2");
    
    if (found1 && found2) {
        console.log("Race condition test passed (both articles present).");
    } else {
        console.error("Race condition test failed! Missing articles.");
    }

}