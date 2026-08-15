const fs = require('fs');
let content = fs.readFileSync('src/news/NewsEngine/UrlResolver.ts', 'utf-8');

const newProps = `
  public metrics = {
    resolvedRedirects: 0,
    resolvedPDFs: 0,
    googleNewsResolved: 0
  };

  private constructor() {}`;

content = content.replace(/private constructor\(\) \{\}/, newProps);

const incrementLogic = `
        const statusCode = response.statusCode || 200;
        const location = response.headers.location;

        if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
          if (currentUrl.includes('news.google.com')) {
            this.metrics.googleNewsResolved++;
          }
          this.metrics.resolvedRedirects++;
`;

content = content.replace(/const statusCode = response.statusCode \|\| 200;\n\s*const location = response.headers.location;\n\n\s*if \(\[301, 302, 303, 307, 308\]\.includes\(statusCode\) && location\) \{/, incrementLogic);

const pdfLogic = `
        const contentType = response.headers['content-type'] || '';
        
        if (currentUrl.toLowerCase().endsWith('.pdf') || contentType.toLowerCase().includes('application/pdf')) {
          this.metrics.resolvedPDFs++;
        }

        return {
`;

content = content.replace(/const contentType = response.headers\['content-type'\] \|\| '';\n\s*return \{/, pdfLogic);

fs.writeFileSync('src/news/NewsEngine/UrlResolver.ts', content);
console.log("Patched UrlResolver health counters");
