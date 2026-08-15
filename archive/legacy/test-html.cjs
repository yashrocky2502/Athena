const axios = require('axios');
axios.get('https://html.duckduckgo.com/html/?q=' + encodeURIComponent('https://www.investing.com/news/economy-news/saudi-oil-exports-increasingly-depend-on-suez-as-red-sea-risks-mount-4812831')).then(res => {
  console.log("ddg:", res.status, res.data.length);
}).catch(err => console.log("ddg err:", err.message, err.response?.status));
