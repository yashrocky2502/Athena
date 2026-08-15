import { CollectionMethod } from "../domain/NewsSource";

export interface RawNewsItem {
  rawId?: string;
  headline: string;
  body: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  collectionMethod: CollectionMethod;
}

export interface NewsCollector {
  name: string;
  collect(): Promise<RawNewsItem[]>;
}
