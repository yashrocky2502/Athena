const axios = require('axios');
axios.get('https://www.investing.com/news/economy-news/saudi-oil-exports-increasingly-depend-on-suez-as-red-sea-risks-mount-4812831', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.google.com/'
  }
}).then(res => console.log(res.status)).catch(err => console.log(err.message));
