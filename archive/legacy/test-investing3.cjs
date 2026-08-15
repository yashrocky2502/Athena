const axios = require('axios');
axios.get('https://api.allorigins.win/get?url=https://www.investing.com/news/economy-news/saudi-oil-exports-increasingly-depend-on-suez-as-red-sea-risks-mount-4812831', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  }
}).then(res => {
  console.log(res.status);
  const data = res.data;
  if(data && data.contents) console.log("Has contents! length: " + data.contents.length);
}).catch(err => console.log(err.message));
