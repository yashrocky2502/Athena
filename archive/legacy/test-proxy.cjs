const axios = require('axios');
axios.get('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.investing.com/news/economy-news/saudi-oil-exports-increasingly-depend-on-suez-as-red-sea-risks-mount-4812831')).then(res => {
  console.log("allorigins:", res.status, res.data.length);
}).catch(err => console.log("allorigins err:", err.message, err.response?.status));
