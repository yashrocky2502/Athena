import fs from 'fs';
import { TelegramQualityGate } from '../src/news/NewsEngine/TelegramQualityGate';

const filePath = 'data/news_core_v2.json';
const articles = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const halArt = articles.find((a: any) => a.id === 'v2_1c07a7a40f29d79a');

if (halArt) {
  console.log('Article ID: v2_1c07a7a40f29d79a');
  console.log('Article FNO Metadata:', JSON.stringify(halArt.fno, null, 2));
  
  const result = TelegramQualityGate.evaluate(halArt);
  console.log('Quality Gate Result:', JSON.stringify(result, null, 2));
} else {
  console.log('HAL article not found in storage.');
}
