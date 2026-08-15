const fs = require('fs');
let content = fs.readFileSync('src/news/NewsEngine/ArticleExtractor.ts', 'utf-8');

// Add imports
content = content.replace(
  /import \{ EntityExtractor, ExtractedEntities \} from '\.\/EntityExtractor';/,
  `import { EntityExtractor, ExtractedEntities } from './EntityExtractor';\nimport { UrlResolver } from './UrlResolver';\nimport { PdfExtractor } from './PdfExtractor';\nimport crypto from 'crypto';`
);

// Replace start of extractArticleContent
const newExtractStart = `
  public async extractArticleContent(item: NewsItem, forceRefresh: boolean = false): Promise<ArticleContent> {
    const startTime = Date.now();

    if (!forceRefresh) {
      const repoContent = this.repo.getEnrichedContent(item.id);
      if (repoContent) {
        return repoContent;
      }
    }

    const headline = Normalizer.normalizeHeadline(item.headline);
    const targetUrl = item.url;
    
    // STEP 1: Resolve URL
    const resolverResult = await UrlResolver.getInstance().resolveFinalUrl(targetUrl);
    const finalUrl = resolverResult.finalUrl;
    const originalUrl = resolverResult.originalUrl;
    let resolvedDomain = '';
    try {
      resolvedDomain = new URL(finalUrl).hostname;
    } catch {}

    // STEP 6: Cache using FINAL URL
    const finalId = crypto.createHash('sha256').update(finalUrl).digest('hex');

    if (!forceRefresh) {
      const cached = this.cache.get(\`extracted_article_\${finalId}\`);
      if (cached) {
        // Must return the cached item but the repo saves it using item.id
        // So we just return it, and server.ts will save it under item.id.
        return cached as ArticleContent;
      }
    }

    // STEP 2: Detect PDFs
    const isPdf = finalUrl.toLowerCase().endsWith('.pdf') || resolverResult.contentType.includes('application/pdf');

    if (isPdf) {
      const pdfExtractor = PdfExtractor.getInstance();
      const pdfContent = await pdfExtractor.extract(originalUrl, finalUrl, item.publisher, item.category || 'General', resolvedDomain);
      
      this.cache.set(\`extracted_article_\${finalId}\`, pdfContent, 24 * 60 * 60 * 1000);
      return pdfContent;
    }

    let html: string | null = null;
    let isBlocked = false;

    // 1. Download HTML using finalUrl
    if (finalUrl && finalUrl.startsWith('http')) {
      try {
        const response = await axios.get(finalUrl, {`;

content = content.replace(
  /public async extractArticleContent\(item: NewsItem, forceRefresh: boolean = false\): Promise<ArticleContent> \{[\s\S]*?const response = await axios\.get\(targetUrl, \{/,
  newExtractStart
);

// Replace where we use targetUrl to use finalUrl
content = content.replace(
  /\{ name: 'Readability', run: \(\) => html \? this\.extractReadability\(html, targetUrl\) : '' \}/,
  `{ name: 'Readability', run: () => html ? this.extractReadability(html, finalUrl) : '' }`
);
content = content.replace(
  /\{ name: 'Publisher Parser', run: \(\) => html \? this\.extractPublisherParser\(html, targetUrl\) : '' \}/,
  `{ name: 'Publisher Parser', run: () => html ? this.extractPublisherParser(html, finalUrl) : '' }`
);

// Add fields to returned ArticleContent
const finalFields = `
      id: finalId, // Step 6 uses SHA256 of finalUrl
      originalUrl,
      finalUrl,
      resolvedDomain,
      type: 'html',
      url: finalUrl,
`;

content = content.replace(
  /id: item\.id,\n\s*url: targetUrl,/g,
  finalFields
);

fs.writeFileSync('src/news/NewsEngine/ArticleExtractor.ts', content);
console.log("Patched ArticleExtractor");
