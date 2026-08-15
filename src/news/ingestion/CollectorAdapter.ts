import { RawArticlePayload } from '../normalization/ArticleNormalizer.ts';

export interface ICollectorSource {
    name: string;
    collect(): Promise<any[]>;
}

export interface CollectorBatchResult {
    collectorName: string;
    payloads: RawArticlePayload[];
    rawCount: number;
    error?: string;
}

export class CollectorAdapter {
    /**
     * Adapts an individual arbitrary collector output object into a standardized RawArticlePayload.
     */
    public static adaptRaw(raw: any, defaultPublisher: string = 'Unknown'): RawArticlePayload | null {
        if (!raw || typeof raw !== 'object') return null;

        const headline = (raw.headline || raw.title || '').trim();
        const url = (raw.url || raw.link || raw.sourceUrl || raw.canonicalUrl || '').trim();
        const body = (raw.body || raw.content || raw.description || raw.rawBody || headline).trim();
        const publisher = (raw.publisher || raw.source || raw.publisherId || defaultPublisher).trim();
        const publishedAt = raw.publishedAt || raw.pubDate || raw.date || raw.fetchedAt || new Date().toISOString();

        if (!headline || !url) {
            return null;
        }

        return {
            headline,
            title: headline,
            url,
            link: url,
            body,
            content: body,
            publisher,
            source: publisher,
            publishedAt,
            collectionMethod: raw.collectionMethod || 'RSS',
            rawMeta: raw
        };
    }

    /**
     * Adapts a list of raw items, filtering out malformed records safely.
     */
    public static adaptList(list: any[], defaultPublisher: string = 'Unknown'): RawArticlePayload[] {
        if (!Array.isArray(list)) return [];
        const adapted: RawArticlePayload[] = [];
        for (const item of list) {
            const res = this.adaptRaw(item, defaultPublisher);
            if (res) {
                adapted.push(res);
            }
        }
        return adapted;
    }

    /**
     * Executes a single collector safely with timeout protection and converts its output.
     */
    public static async collectFrom(
        collector: ICollectorSource,
        timeoutMs: number = 30000
    ): Promise<CollectorBatchResult> {
        const result: CollectorBatchResult = {
            collectorName: collector.name || 'UnknownCollector',
            payloads: [],
            rawCount: 0
        };

        try {
            const timeoutPromise = new Promise<any[]>((_, reject) => {
                setTimeout(() => reject(new Error(`Collector ${collector.name} timed out after ${timeoutMs}ms`)), timeoutMs);
            });

            const rawItems = await Promise.race([collector.collect(), timeoutPromise]);
            if (Array.isArray(rawItems)) {
                result.rawCount = rawItems.length;
                result.payloads = this.adaptList(rawItems, collector.name);
            }
        } catch (err: any) {
            result.error = err.message || 'Collector execution failed';
        }

        return result;
    }

    /**
     * Concurrently runs multiple collectors with isolated failure boundaries.
     */
    public static async collectFromAll(
        collectors: ICollectorSource[],
        timeoutMs: number = 30000
    ): Promise<CollectorBatchResult[]> {
        const promises = collectors.map(c => this.collectFrom(c, timeoutMs));
        return Promise.all(promises);
    }
}
