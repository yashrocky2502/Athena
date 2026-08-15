import axios from 'axios';
async function test() {
  try {
    const response = await axios.get("https://www.bseindia.com/xml-data/corpfiling/AttachLive/91bebd12-f19b-4b16-bb64-c011e0dc4e8c.pdf", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    console.log("Success! Status:", response.status);
    console.log("Content-Length:", response.data.length);
  } catch (e) {
    console.error("Failed:", e.message);
  }
}
test();
