const axios = require('axios');
axios.get('https://webcache.googleusercontent.com/search?q=cache:https://www.investing.com/news/economy-news/saudi-oil-exports-increasingly-depend-on-suez-as-red-sea-risks-mount-4812831', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  }
}).then(res => {
  console.log("google cache:", res.status, res.data.length);
}).catch(err => console.log("google cache error:", err.message, err.response?.status));
