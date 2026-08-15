export type CollectionMethod = "DIRECT" | "RSS";

export interface NewsSource {
  publisher: string;
  url: string;
  collectionMethod: CollectionMethod;
}
