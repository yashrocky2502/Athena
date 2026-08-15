import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  const url = 'https://news.google.com/rss/articles/CBMickFVX3lxTE92OVlNZzhOY2s0UEZfYW8yWU5CZ0hITjh2UlF4dkdFV2RKTWY5anVJWk5GLXdjY0dTNl9FdnFUWEhQV09PaDVUdlk1NU00Vkt1YThDZUMwWjMwOXJnRC1JZWFoZEdBWFpZcVljaTlVT2d2Zw?oc=5';
  
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = res.data;
    const $ = cheerio.load(html);
    
    console.log('--- SCRIPT TAGS CONTENT ---');
    $('script').each((i, el) => {
      const content = $(el).html() || '';
      if (content.includes('http') || content.includes('CBMi') || content.includes('data:')) {
        console.log(`Script ${i} length:`, content.length);
        if (content.length < 1000) {
          console.log(content);
        } else {
          console.log(content.substring(0, 500) + '...[TRUNCATED]...' + content.substring(content.length - 200));
        }
      }
    });

    console.log('--- LINKS IN HTML ---');
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        console.log(`Link ${i}:`, href);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
