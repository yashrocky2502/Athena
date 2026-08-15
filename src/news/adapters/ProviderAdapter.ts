export interface ProviderAdapter {
  id: string;
  name: string;
  getHeaders(url: string): Record<string, string>;
  getTimeout?(): number;
  getUrls?(): string[];
  handleQuirks?(html: string, url: string): string;
  rewriteUrl?(url: string): string;
}
