import axios from 'axios';

async function run() {
  try {
    const res = await axios.get('https://pypi.org/pypi/googlenews-decoder/json');
    console.log('Success! Release keys:', Object.keys(res.data.releases).slice(-3));
    const latestVersion = res.data.info.version;
    console.log('Latest Version:', latestVersion);
    const urls = res.data.releases[latestVersion];
    for (const file of urls) {
      console.log(`URL: ${file.url}`);
      console.log(`Filename: ${file.filename}`);
    }
  } catch (err) {
    console.error('googlenews-decoder failed:', err.message);
  }

  try {
    const res = await axios.get('https://pypi.org/pypi/gnews-decoder/json');
    console.log('Success gnews-decoder! Release keys:', Object.keys(res.data.releases).slice(-3));
    const latestVersion = res.data.info.version;
    console.log('Latest Version gnews-decoder:', latestVersion);
    const urls = res.data.releases[latestVersion];
    for (const file of urls) {
      console.log(`URL: ${file.url}`);
      console.log(`Filename: ${file.filename}`);
    }
  } catch (err) {
    console.error('gnews-decoder failed:', err.message);
  }
}

run();
