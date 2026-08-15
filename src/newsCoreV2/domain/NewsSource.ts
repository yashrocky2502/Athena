export type CollectionMethod = "DIRECT" | "RSS" | "MIGRATED_V3" | "MIGRATED_INTELLIGENCE" | "MIGRATION";

export interface NewsSource {
  publisher: string;
  url: string;
  collectionMethod: CollectionMethod;
}
