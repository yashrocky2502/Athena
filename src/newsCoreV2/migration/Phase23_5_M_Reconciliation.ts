
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NewsArticleV2 } from '../domain/NewsArticle.ts';
import { IntelligenceRecord } from '../intelligenceV2/IntelligenceTypes.ts';

interface MigrationReport {
    timestamp: string;
    sources: {
        legacy: number;
        intelligence: number;
        v3: number;
    };
    uniques: {
        byExactId: number;
        bySemanticMatch: number;
        finalCanonicalCount: number;
    };
    quarantined: string[];
    intelligenceOverlays: number;
    dryRun: boolean;
}

export class Phase23_5_M_Reconciliation {
    private dataDir = path.join(process.cwd(), 'data');
    private dryRun = true;

    constructor(dryRun = true) {
        this.dryRun = dryRun;
    }

    public async execute(): Promise<MigrationReport> {
        console.log(`[MIGRATION_23_5_M] Starting reconciliation in ${this.dryRun ? 'DRY-RUN' : 'LIVE'} mode...`);

        // 1. Load Stores
        const legacyPath = path.join(this.dataDir, 'news_core_v2.json');
        const intelPath = path.join(this.dataDir, 'news_intelligence_v2.json');
        const v3Path = path.join(this.dataDir, 'v3_news_store.json');

        const legacyRaw: NewsArticleV2[] = fs.existsSync(legacyPath) ? JSON.parse(fs.readFileSync(legacyPath, 'utf-8')) : [];
        const intelRaw: IntelligenceRecord[] = fs.existsSync(intelPath) ? JSON.parse(fs.readFileSync(intelPath, 'utf-8')) : [];
        const v3Raw = fs.existsSync(v3Path) ? JSON.parse(fs.readFileSync(v3Path, 'utf-8')) : { storiesMap: {} };
        const v3Stories: any[] = Object.values(v3Raw.storiesMap || {});

        const report: MigrationReport = {
            timestamp: new Date().toISOString(),
            sources: {
                legacy: legacyRaw.length,
                intelligence: intelRaw.length,
                v3: v3Stories.length
            },
            uniques: {
                byExactId: 0,
                bySemanticMatch: 0,
                finalCanonicalCount: 0
            },
            quarantined: [],
            intelligenceOverlays: 0,
            dryRun: this.dryRun
        };

        // 2. Map Intelligence by Article ID and Semantic Key
        const intelByArticleId = new Map<string, IntelligenceRecord>();
        const intelBySemanticKey = new Map<string, IntelligenceRecord>();
        for (const rec of intelRaw) {
            intelByArticleId.set(rec.articleId, rec);
            const url = (rec.canonicalUrl || '').trim().toLowerCase();
            const headline = (rec.headline || '').trim().toLowerCase();
            if (url && url.length > 15) intelBySemanticKey.set(`url:${url}`, rec);
            if (headline && headline.length > 10) intelBySemanticKey.set(`headline:${headline}`, rec);
        }

        // 3. Primary Identity Pool (Legacy + Intelligence Union)
        const canonicalArticles = new Map<string, NewsArticleV2>();
        const headlineMap = new Map<string, string>();
        const urlMap = new Map<string, string>();

        const getSemanticMatch = (art: any): string | null => {
            const url = (art.canonicalUrl || art.url || art.source?.url || '').trim().toLowerCase();
            const headline = (art.headline || art.title || '').trim().toLowerCase();
            
            if (url && url.length > 15 && !url.includes('example.com')) {
                const cleanUrl = url.includes('?') ? url.split('?')[0] : url;
                if (urlMap.has(cleanUrl)) return urlMap.get(cleanUrl)!;
            }
            if (headline && headline.length > 10 && headlineMap.has(headline)) {
                return headlineMap.get(headline)!;
            }
            return null;
        };

        const registerSemantic = (art: any, id: string) => {
            const url = (art.canonicalUrl || art.url || art.source?.url || '').trim().toLowerCase();
            const headline = (art.headline || art.title || '').trim().toLowerCase();
            
            if (url && url.length > 15 && !url.includes('example.com')) {
                const cleanUrl = url.includes('?') ? url.split('?')[0] : url;
                urlMap.set(cleanUrl, id);
            }
            if (headline && headline.length > 10) {
                headlineMap.set(headline, id);
            }
        };

        // A. Process Legacy (Highest Priority)
        for (const art of legacyRaw) {
            if (art.id === 'adv_1' || art.id === 'adv_2') {
                report.quarantined.push(art.id);
                continue;
            }
            canonicalArticles.set(art.id, art);
            registerSemantic(art, art.id);
        }

        // B. Process Intelligence articles not in Legacy
        for (const rec of intelRaw) {
            if (canonicalArticles.has(rec.articleId)) continue;
            
            const existingId = getSemanticMatch(rec);
            if (existingId) {
                report.uniques.bySemanticMatch++;
                continue;
            }

            // New identity from intelligence store
            const newArt: NewsArticleV2 = {
                id: rec.articleId,
                canonicalUrl: rec.canonicalUrl,
                headline: rec.headline,
                body: rec.executiveSummary || rec.headline,
                source: {
                    publisher: rec.source,
                    url: rec.canonicalUrl,
                    collectionMethod: 'MIGRATED_INTELLIGENCE'
                },
                publishedAt: rec.publishedAt,
                collectedAt: rec.generatedAt,
                category: rec.category as any,
                sentiment: rec.sentiment as any,
                relevanceScore: rec.relevanceScore,
                fno: {
                    eligible: rec.fnoEligible,
                    symbol: rec.symbol,
                    decision: rec.fnoEligible ? 'INCLUDE' : 'EXCLUDE',
                    reason: 'Migrated from Intelligence V2',
                    confidence: rec.fnoConfidence as any
                }
            };
            canonicalArticles.set(newArt.id, newArt);
            registerSemantic(newArt, newArt.id);
        }

        // C. Process V3 Articles
        for (const v3 of v3Stories) {
            const existingId = getSemanticMatch(v3);
            if (existingId) {
                report.uniques.bySemanticMatch++;
                continue;
            }

            // New identity from V3
            const id = "v2_" + crypto.createHash("sha256").update(v3.canonicalUrl || v3.headline).digest("hex").slice(0, 16);
            const newArt: NewsArticleV2 = {
                id,
                canonicalUrl: v3.canonicalUrl,
                headline: v3.headline,
                body: v3.body || v3.headline,
                source: {
                    publisher: v3.publisher?.name || 'V3_SOURCE',
                    url: v3.canonicalUrl || '',
                    collectionMethod: 'MIGRATED_V3'
                },
                publishedAt: v3.publishedAt,
                collectedAt: new Date().toISOString(),
                category: (v3.category || 'General') as any,
                sentiment: (v3.sentiment || 'NEUTRAL') as any,
                relevanceScore: v3.relevanceScore || 70,
                fno: {
                    eligible: !!v3.isFnO,
                    symbol: v3.tickers?.[0] || null,
                    decision: v3.isFnO ? 'INCLUDE' : 'EXCLUDE',
                    reason: 'Migrated from V3 Store',
                    confidence: 'MEDIUM'
                }
            };
            canonicalArticles.set(newArt.id, newArt);
            registerSemantic(newArt, newArt.id);
        }

        // 4. Final Merge & Enrichment
        for (const [id, art] of canonicalArticles) {
            let intel = intelByArticleId.get(id);
            if (!intel) {
                // Try semantic match for intelligence
                const url = (art.canonicalUrl || art.source?.url || '').trim().toLowerCase();
                const headline = (art.headline || '').trim().toLowerCase();
                intel = (url && url.length > 15) ? intelBySemanticKey.get(`url:${url}`) : undefined;
                if (!intel && headline) intel = intelBySemanticKey.get(`headline:${headline}`);
            }

            if (intel) {
                art.summary = intel.executiveSummary;
                art.whatChanged = Array.isArray(intel.keyFacts) ? intel.keyFacts : (intel.keyFacts ? [intel.keyFacts] : []);
                art.keyMetrics = intel.financialMetrics;
                art.whyItMatters = intel.whyItMatters;
                art.marketImpact = intel.marketImpact;
                art.riskWatchpoints = Array.isArray(intel.risk) ? intel.risk : (intel.risk ? [intel.risk] : []);
                art.summaryConfidence = intel.materialityScore;
                art.summaryProcessingMode = 'DETERMINISTIC';
                report.intelligenceOverlays++;
            }
        }

        report.uniques.byExactId = canonicalArticles.size;
        report.uniques.finalCanonicalCount = canonicalArticles.size;

        console.log(`[MIGRATION_23_5_M] Reconciliation complete. Final Canonical Count: ${report.uniques.finalCanonicalCount}`);

        if (!this.dryRun) {
            // LIVE MODE - Write files
            const finalArticles = Array.from(canonicalArticles.values()).sort((a, b) => 
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            );
            fs.writeFileSync(path.join(this.dataDir, 'news_core_v2.json.migrated'), JSON.stringify(finalArticles, null, 2));
            console.log(`[MIGRATION_23_5_M] Wrote ${finalArticles.length} articles to news_core_v2.json.migrated`);
        }

        return report;
    }
}
