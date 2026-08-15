const axios = require('axios');
axios.get('https://thingproxy.freeboard.io/fetch/https://www.investing.com/news/economy-news/saudi-oil-exports-increasingly-depend-on-suez-as-red-sea-risks-mount-4812831').then(res => {
  console.log("thingproxy:", res.status, res.data.length);
}).catch(err => console.log("thingproxy:", err.message));
