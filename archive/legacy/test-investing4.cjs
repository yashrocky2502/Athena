const axios = require('axios');
axios.get('https://api.codetabs.com/v1/proxy?quest=https://www.investing.com/news/economy-news/saudi-oil-exports-increasingly-depend-on-suez-as-red-sea-risks-mount-4812831').then(res => {
  console.log("codetabs:", res.status, res.data.length);
}).catch(err => console.log("codetabs:", err.message));
