import axios from 'axios';

async function test(name) {
  try {
    const res = await axios.get(`https://pypi.org/pypi/${name}/json`);
    console.log(`Success with ${name}! Latest version:`, res.data.info.version);
    const latestVersion = res.data.info.version;
    const urls = res.data.releases[latestVersion];
    for (const file of urls) {
      console.log(`  Filename: ${file.filename}`);
      console.log(`  URL: ${file.url}`);
    }
    return true;
  } catch (err) {
    console.log(`Failed for ${name}: ${err.message}`);
    return false;
  }
}

async function run() {
  const variations = [
    'googlenews-decoder',
    'googlenews_decoder',
    'googlenewsdecoder',
    'google-news-decoder',
    'google_news_decoder',
    'gnews_decoder',
    'gnewsdecoder',
    'googlenews-url-decoder',
    'googlenewsurldecoder'
  ];
  for (const v of variations) {
    await test(v);
  }
}

run();
