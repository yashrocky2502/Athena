/**
 * ATHENA NEWS ENGINE V3 — UNIVERSAL EXTRACTOR
 */

import axios from 'axios';
import { EconomicTimesExtractor } from './EconomicTimesExtractor';
import { MoneycontrolExtractor } from './MoneycontrolExtractor';
import { ReutersExtractor } from './ReutersExtractor';
import { LiveMintExtractor } from './LiveMintExtractor';
import { BusinessStandardExtractor } from './BusinessStandardExtractor';
import { V3PublisherId } from '../../types/V3Types';
import { UrlResolver } from '../../../NewsEngine/UrlResolver';
import { PdfExtractor } from '../../../NewsEngine/PdfExtractor';

export class UniversalExtractor {
  /**
   * Universal entrypoint for full-body extraction.
   * Dynamically fetches html if content is short or sparse, and routes to publisher-specific parser.
   */
  public static async extractFullBody(
    publisherId: V3PublisherId,
    url: string,
    rawContent: string
  ): Promise<{ body: string; paragraphs: string[] }> {
    let html = rawContent || '';
    const isShort = html.trim().length < 500;
    const isUrlValid = url && url.startsWith('http') && !url.includes('localhost') && !url.includes('127.0.0.1');
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || url.includes('/article_') || url.includes('mock-');

    if (isShort && isUrlValid && !isTest) {
      try {
        const resolved = await UrlResolver.getInstance().resolveFinalUrl(url, 10, 8000);
        const finalUrl = resolved.finalUrl;
        const isPdf = finalUrl.toLowerCase().endsWith('.pdf') || resolved.contentType.includes('application/pdf');

        if (isPdf) {
          console.log(`[UniversalExtractor] Extracting PDF content for ${publisherId} from: ${finalUrl}`);
          const pdfContent = await PdfExtractor.getInstance().extract(
            url,
            finalUrl,
            String(publisherId),
            'General',
            new URL(finalUrl).hostname,
            'PDF Document'
          );
          
          if (pdfContent && pdfContent.body) {
            const paragraphs = pdfContent.body
              .split(/\n\n+/)
              .map(p => p.trim())
              .filter(p => p.length > 20);
            
            return {
              body: pdfContent.body,
              paragraphs: paragraphs.length > 0 ? paragraphs : [pdfContent.body]
            };
          }
        } else if (!finalUrl.includes('news.google.com') && !finalUrl.includes('google.com/rss')) {
          const response = await axios.get(finalUrl, {
            timeout: 8000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5'
            }
          });
          if (response && response.data && typeof response.data === 'string') {
            html = response.data;
          }
        }
      } catch (err: any) {
        // Suppress noisy warnings for standard 401/403 paywalls or unresolvable Google redirects
        if (err?.response?.status !== 401 && err?.response?.status !== 403) {
          console.warn(`[UniversalExtractor] Warning crawling URL ${url}:`, err?.message || err);
        }
        // Fallback to initial content silently
      }
    }

    let paragraphs: string[] = [];

    // Route to source-specific extractors
    const pub = String(publisherId).toUpperCase();
    if (pub === 'ECONOMIC_TIMES') {
      paragraphs = EconomicTimesExtractor.extract(html);
    } else if (pub === 'MONEYCONTROL') {
      paragraphs = MoneycontrolExtractor.extract(html);
    } else if (pub === 'REUTERS') {
      paragraphs = ReutersExtractor.extract(html);
    } else if (pub === 'LIVEMINT') {
      paragraphs = LiveMintExtractor.extract(html);
    } else if (pub === 'BUSINESS_STANDARD') {
      paragraphs = BusinessStandardExtractor.extract(html);
    } else {
      // Generic Extractor
      const pMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
      if (pMatches && pMatches.length > 0) {
        for (const p of pMatches) {
          const text = p.replace(/<[^>]+>/g, '').trim();
          if (text.length > 30) {
            paragraphs.push(text);
          }
        }
      }
    }

    // Fallback if extraction returned nothing
    if (paragraphs.length === 0) {
      const plainText = html.replace(/<[^>]+>/g, ' ');
      const rawParas = plainText.split(/\n\s*\n+/);
      for (const p of rawParas) {
        const trimmed = p.replace(/\s+/g, ' ').trim();
        if (trimmed.length > 30) {
          paragraphs.push(trimmed);
        }
      }
    }

    // If still nothing, use initial rawContent
    if (paragraphs.length === 0 && rawContent) {
      paragraphs = rawContent.split(/\n+/).map(p => p.trim()).filter(p => p.length > 10);
    }

    return {
      body: paragraphs.join('\n\n'),
      paragraphs
    };
  }
}
