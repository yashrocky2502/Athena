import fs from 'fs';

function run() {
  if (!fs.existsSync('/gnews_article.html')) {
    console.log('File /gnews_article.html does not exist.');
    return;
  }
  const html = fs.readFileSync('/gnews_article.html', 'utf8');
  console.log('HTML loaded, size:', html.length);

  // Search for occurrence of the base64 string
  const base64Str = 'CBMickFVX3lxTE92OVlNZzhOY2s0UEZfYW8yWU5CZ0hITjh2UlF4dkdFV2RKTWY5anVJWk5GLXdjY0dTNl9FdnFUWEhQV09PaDVUdlk1NU00Vkt1YThDZUMwWjMwOXJnRC1JZWFoZEdBWFpZcVljaTlVT2d2Zw';
  const shortBase64 = base64Str.substring(0, 20);
  
  let idx = 0;
  while ((idx = html.indexOf(shortBase64, idx)) !== -1) {
    console.log(`\nFound shortBase64 at index ${idx}:`);
    console.log(html.substring(idx - 100, idx + 200));
    idx += shortBase64.length;
  }

  // Let's also look for any string that looks like a base64 string or has "data-"
  console.log('\nSearching for c-wiz or data-n-a attributes...');
  const dataAttributes = html.match(/data-n-a-[a-z]+="[^"]+"/g) || [];
  console.log('data-n-a-* attributes found:', dataAttributes);

  // Search for any occurrence of 'bseindia' or 'nseindia' inside the HTML (even if not part of a URL)
  console.log('\nSearching for "bseindia" or "nseindia" inside HTML...');
  const bseMatch = html.match(/.{0,100}bseindia.{0,100}/gi) || [];
  const nseMatch = html.match(/.{0,100}nseindia.{0,100}/gi) || [];
  console.log(`bseindia matches found: ${bseMatch.length}`);
  bseMatch.forEach((m, i) => console.log(`BSE[${i}]:`, m));
  console.log(`nseindia matches found: ${nseMatch.length}`);
  nseMatch.forEach((m, i) => console.log(`NSE[${i}]:`, m));
}

run();
