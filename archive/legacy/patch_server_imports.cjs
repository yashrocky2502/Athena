const fs = require('fs');
let serverContent = fs.readFileSync('server.ts', 'utf8');
serverContent = serverContent.replace(
  /ArticleRepository,\n  Cache\n\} from ".\/src\/news\/NewsEngine\/index";/,
  'ArticleRepository,\n  Cache,\n  UrlResolver,\n  PdfExtractor\n} from "./src/news/NewsEngine/index";'
);
fs.writeFileSync('server.ts', serverContent);
