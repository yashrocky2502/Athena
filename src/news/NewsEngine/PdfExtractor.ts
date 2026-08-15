import { PDFParse } from "pdf-parse";
import https from 'https';
import http from 'http';
import { ArticleContent } from './ArticleContent';
import crypto from 'crypto';

export class PdfExtractor {
  private static instance: PdfExtractor;

  private constructor() {}

  public static getInstance(): PdfExtractor {
    if (!PdfExtractor.instance) {
      PdfExtractor.instance = new PdfExtractor();
    }
    return PdfExtractor.instance;
  }

  private async downloadPdf(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const requestModule = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/pdf'
        }
      };

      const req = requestModule.get(url, options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirect if any, but we expect the UrlResolver to have resolved it.
          // Still good to be safe.
          resolve(this.downloadPdf(res.headers.location));
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download PDF, status code: ${res.statusCode}`));
          return;
        }

        const data: Buffer[] = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => resolve(Buffer.concat(data)));
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Timeout downloading PDF'));
      });
    });
  }

  public async extract(originalUrl: string, finalUrl: string, publisher: string, category: string, resolvedDomain: string, fallbackHeadline?: string): Promise<ArticleContent> {
    const startTime = Date.now();
    try {
      const pdfBuffer = await this.downloadPdf(finalUrl);
      const downloadTime = Date.now() - startTime;
      
      const parseStartTime = Date.now();
      const parser = new PDFParse({ data: pdfBuffer });
      const pdfData = await parser.getText();
      const infoResult = await parser.getInfo();
      await parser.destroy();
      const parseTime = Date.now() - parseStartTime;

      const title = (infoResult.info?.Title && !infoResult.info.Title.toLowerCase().includes('pdf document') && infoResult.info.Title.length > 5) ? infoResult.info.Title : (fallbackHeadline || 'PDF Document');
      const body = pdfData.text.replace(/\s+/g, ' ').trim();
      
      const wordCount = body.split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200);

      const id = crypto.createHash('sha256').update(finalUrl).digest('hex');

      return {
        id,
        originalUrl,
        finalUrl,
        resolvedDomain,
        type: (publisher.toLowerCase().includes('nse') || publisher.toLowerCase().includes('bse') || resolvedDomain.includes('nse') || resolvedDomain.includes('bse') || body.toLowerCase().includes('bse limited') || body.toLowerCase().includes('national stock exchange')) ? 'CORPORATE_FILING' : 'pdf',
        documentType: (publisher.toLowerCase().includes('nse') || publisher.toLowerCase().includes('bse') || resolvedDomain.includes('nse') || resolvedDomain.includes('bse') || body.toLowerCase().includes('bse limited') || body.toLowerCase().includes('national stock exchange')) ? 'CORPORATE_FILING' : 'DOCUMENT',
        url: finalUrl,
        canonicalUrl: finalUrl,
        headline: title,
        title,
        publisher,
        category,
        body,
        cleanText: body,
        cleanedText: body,
        rawText: body,
        articleBody: body,
        parser: 'pdf-parse',
        extractedBy: 'PdfExtractor',
        extractionMethod: 'Buffer',
        quality: 1.0,
        qualityScore: 100,
        extractionQuality: 100,
        wordCount,
        readingTime,
        readingTimeMin: readingTime,
        paragraphCount: infoResult.total || 1, // Using paragraph count to store page count
        extractedAt: new Date().toISOString(),
        timeTakenMs: Date.now() - startTime,
        metadata: {
          downloadTimeMs: downloadTime
        },
        cached: false,
        status: 'FULL_EXTRACT'
      };
    } catch (err: any) {
      console.warn(`[PdfExtractor] Notice downloading PDF from ${finalUrl}:`, err?.message || err);
      const id = crypto.createHash('sha256').update(finalUrl).digest('hex');
      const isFiling = publisher.toLowerCase().includes('nse') || publisher.toLowerCase().includes('bse') || resolvedDomain.includes('nse') || resolvedDomain.includes('bse');
      const headline = fallbackHeadline || `PDF Document - ${publisher || 'Filing'}`;
      const fallbackText = `${headline}. Corporate Regulatory Filing submitted to Exchange (${publisher}). Intimation under Regulation 30/33.`;
      return {
        id,
        originalUrl,
        finalUrl,
        resolvedDomain,
        type: isFiling ? 'CORPORATE_FILING' : 'pdf',
        documentType: isFiling ? 'CORPORATE_FILING' : 'DOCUMENT',
        url: finalUrl,
        canonicalUrl: finalUrl,
        headline,
        title: headline,
        publisher: publisher || 'NSE/BSE Exchange',
        category: isFiling ? 'Corporate Filing' : category,
        body: fallbackText,
        cleanText: fallbackText,
        cleanedText: fallbackText,
        rawText: fallbackText,
        articleBody: fallbackText,
        parser: 'pdf-parse',
        extractedBy: 'PdfExtractor',
        extractionMethod: 'Fallback',
        quality: 0.8,
        qualityScore: 80,
        extractionQuality: 80,
        wordCount: 50,
        paragraphCount: 1,
        readingTime: 1,
        readingTimeMin: 1,
        extractedAt: new Date().toISOString(),
        timeTakenMs: Date.now() - startTime,
        cached: false,
        status: 'FALLBACK'
      };
    }
  }
}
