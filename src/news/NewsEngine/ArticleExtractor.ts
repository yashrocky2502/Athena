import axios from 'axios';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { ArticleContent } from './ArticleContent';
import { NewsItem } from '../models/NewsItem';
import { Normalizer } from './Normalizer';
import { isExchangeArticle, isExchangeDocumentUrl, getExchangeName, getExchangeDocumentType } from '../utils/ExchangeUtils';
import { Cache } from './Cache';
import { ArticleRepository } from './ArticleRepository';
import { EntityExtractor, ExtractedEntities } from './EntityExtractor';
import { UrlResolver } from './UrlResolver';
import { PdfExtractor } from './PdfExtractor';
import { FilingIntelligenceEngine } from './FilingIntelligenceEngine';
import crypto from 'crypto';
import { GeminiProvider } from '../AI/GeminiProvider';
import { ProductionLogger } from './ProductionLogger';
import { OpenIntelligence } from '../../services/OpenIntelligenceEngine';

export class ArticleExtractor {
  private static instance: ArticleExtractor;
  private cache = Cache.getInstance();
  private repo = ArticleRepository.getInstance();

  private constructor() {}

  public static getInstance(): ArticleExtractor {
    if (!ArticleExtractor.instance) {
      ArticleExtractor.instance = new ArticleExtractor();
    }
    return ArticleExtractor.instance;
  }

  /**
   * Helper to create a structured RSS fallback content object for an article.
   */
  public createFallbackContent(item: NewsItem): ArticleContent {
    const text = (item.description || item.headline || '').trim();
    const wordCount = text ? this.getWordCount(text) : 0;
    const paragraphs = text ? text.split('\n\n').filter(Boolean) : [];
    const paragraphCount = paragraphs.length > 0 ? paragraphs.length : (text ? 1 : 0);
    const qualityScore = text && wordCount > 0 ? 20 : 0;
    const qualityBreakdown = {
      parserScore: 0,
      bodyCompleteness: qualityScore,
      metadata: 0,
      entities: 0,
      metrics: 0,
      timeline: 0,
      quotes: 0,
      tables: 0,
      boilerplate: 10,
      readability: 0,
      overall: qualityScore
    };
    const parser = 'NEWSPAPER4K_FALLBACK';
    const readingTime = text && wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0;

    const fallback: ArticleContent = {
      id: item.id,
      url: item.url,
      canonicalUrl: item.url,
      headline: Normalizer.normalizeHeadline(item.headline),
      title: Normalizer.normalizeHeadline(item.headline),
      publisher: item.publisher,
      author: item.author || item.publisher,
      publishedAt: item.publishedAt,
      category: item.category,
      image: item.image,

      body: text,
      cleanText: text,
      cleanedText: text,
      rawText: text,
      articleBody: text,

      parser,
      extractedBy: parser,
      extractionMethod: parser,

      quality: qualityBreakdown as any,
      qualityScore: qualityScore,
      extractionQuality: qualityScore,

      wordCount,
      readingTime,
      readingTimeMin: readingTime,
      paragraphCount,

      tables: [],
      tableCount: 0,
      entities: [],
      entityCount: 0,
      financialMetrics: [],
      financialMetricsCount: 0,

      extractedAt: new Date().toISOString(),
      timeTakenMs: 0,
      metadata: { downloadTimeMs: 0 },
      cached: false,
      status: 'FALLBACK',
      extractionState: 'RSS_FALLBACK',
    };

    return fallback;
  }

  /**
   * Main Article Extraction Entry Point
   * Download HTML -> JSON-LD -> ARTICLE tag -> Readability -> Publisher Parser -> Raw HTML -> RSS Fallback
   * Stops immediately when one parser extracts > 300 words.
   */
  
  public async extractArticleContent(item: NewsItem, forceRefresh: boolean = false): Promise<ArticleContent> {
    const startTime = Date.now();

    if (!forceRefresh) {
      const repoContent = this.repo.getEnrichedContent(item.id);
      if (repoContent) {
        return repoContent;
      }
    }

    const headline = Normalizer.normalizeHeadline(item.headline);
    const targetUrl = item.url;
    
    // STAGE 1: Google News redirect resolver (integrated inside UrlResolver)
    const resolverResult = await UrlResolver.getInstance().resolveFinalUrl(targetUrl);
    const finalUrl = resolverResult.finalUrl;
    const originalUrl = resolverResult.originalUrl;
    console.log(`[FLOW] URL: ${originalUrl} -> ${finalUrl}`);
    let resolvedDomain = '';
    try {
      resolvedDomain = new URL(finalUrl).hostname;
    } catch {}

    // STEP 6: Cache using FINAL URL
    const finalId = crypto.createHash('sha256').update(finalUrl).digest('hex');

    if (!forceRefresh) {
      const cached = this.cache.get(`extracted_article_${finalId}`);
      if (cached) {
        return cached as ArticleContent;
      }
    }

    // ATHENA V5.2 — DIRECT EXCHANGE DOCUMENT MODE
    const isExchangeDoc = isExchangeArticle(item) || isExchangeDocumentUrl(targetUrl) || isExchangeDocumentUrl(finalUrl) || isExchangeDocumentUrl(originalUrl);
    if (isExchangeDoc) {
      const exchangeName = getExchangeName(finalUrl || targetUrl || item.publisher);
      const docType = getExchangeDocumentType(headline || finalUrl);
      console.log(`[ATHENA V5.2] Direct Exchange Document detected: ${exchangeName} (${docType}). Bypassing AI processing.`);

      const exchangeContent: ArticleContent = {
        id: item.id,
        url: finalUrl || targetUrl,
        originalUrl: originalUrl || targetUrl,
        finalUrl: finalUrl || targetUrl,
        resolvedDomain: resolvedDomain || (exchangeName === 'NSE India' ? 'nseindia.com' : 'bseindia.com'),
        headline: headline,
        title: headline,
        publisher: exchangeName,
        publishedAt: item.publishedAt,
        category: 'Exchange Filing',
        documentType: docType,
        type: 'EXCHANGE_FILING',
        isExchangeDocument: true,
        isExchangeFiling: true,
        body: `Official Exchange Filing (${exchangeName}). This filing is hosted directly by the exchange.`,
        cleanText: `Official Exchange Filing (${exchangeName}). This filing is hosted directly by the exchange.`,
        cleanedText: `Official Exchange Filing (${exchangeName}). This filing is hosted directly by the exchange.`,
        rawText: `Official Exchange Filing (${exchangeName}). This filing is hosted directly by the exchange.`,
        articleBody: `Official Exchange Filing (${exchangeName}). This filing is hosted directly by the exchange.`,
        parser: 'DIRECT_EXCHANGE_DOCUMENT',
        extractedBy: 'DIRECT_EXCHANGE_MODE',
        extractionMethod: 'DIRECT_EXCHANGE',
        quality: 100,
        qualityScore: 100,
        wordCount: 15,
        readingTime: 1
      };

      this.cache.set(`extracted_article_${finalId}`, exchangeContent, 24 * 60 * 60 * 1000);
      this.repo.saveEnrichedContent(item.id, exchangeContent);

      ProductionLogger.getInstance().logExtraction({
        id: item.id,
        url: finalUrl,
        headline: item.headline,
        publisher: exchangeName,
        timestamp: new Date().toISOString(),
        parserUsed: 'DIRECT_EXCHANGE_DOCUMENT',
        fallbackUsed: false,
        timeTakenMs: Date.now() - startTime,
        qualityScore: 100,
        isPdf: finalUrl.toLowerCase().endsWith('.pdf'),
        pdfSuccess: true,
        retriesCount: 0,
        retrySuccess: true,
        is500Error: false
      });

      return exchangeContent;
    }

    // STAGE 6: PDF parser (if PDF)
    const isPdf = finalUrl.toLowerCase().endsWith('.pdf') || resolverResult.contentType.includes('application/pdf');
    console.log(`[FLOW] PDF detected: ${isPdf}`);

    let pdfSuccess = false;
    if (isPdf) {
      try {
        const pdfExtractor = PdfExtractor.getInstance();
        const pdfContent = await pdfExtractor.extract(originalUrl, finalUrl, item.publisher, item.category || 'General', resolvedDomain, headline);
        
        const isFiling = FilingIntelligenceEngine.getInstance().isCorporateFiling(pdfContent, item);
        console.log(`[FLOW] Corporate Filing detected = ${isFiling}`);
        if (isFiling) {
          console.log('[FLOW] Selected Engine = Filing');
          pdfContent.documentType = 'CORPORATE_FILING';
          pdfContent.type = 'CORPORATE_FILING';
          pdfContent.category = 'Corporate Filing';
          const filingRes = await FilingIntelligenceEngine.getInstance().processFiling(pdfContent);
          console.log(`[FLOW] Summary Generator Used: FilingIntelligenceEngine (${filingRes.provider})`);
        }

        pdfSuccess = true;
        this.cache.set(`extracted_article_${finalId}`, pdfContent, 24 * 60 * 60 * 1000);
        this.repo.saveEnrichedContent(item.id, pdfContent);

        // Log PDF success
        ProductionLogger.getInstance().logExtraction({
          id: item.id,
          url: finalUrl,
          headline: item.headline,
          publisher: item.publisher,
          timestamp: new Date().toISOString(),
          parserUsed: 'PDF_PARSER',
          fallbackUsed: false,
          timeTakenMs: Date.now() - startTime,
          qualityScore: pdfContent.qualityScore || 85,
          isPdf: true,
          pdfSuccess: true,
          retriesCount: 0,
          retrySuccess: true,
          is500Error: false
        });

        return pdfContent;
      } catch (err) {
        console.error('[ArticleExtractor] PDF parsing failed:', err);
      }
    }

    let html: string | null = null;
    let isBlocked = false;
    let is500Error = false;

    // STAGE 2: Normal HTML downloader
    if (finalUrl && finalUrl.startsWith('http')) {
      try {
        const response = await axios.get(finalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: 6000,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 600, // allow 500 so we can handle it silently
        });

        if (response.status >= 500) {
          is500Error = true;
          isBlocked = true;
        } else if (response.status === 401 || response.status === 403 || response.status === 429) {
          isBlocked = true;
        } else if (response.status >= 200 && response.status < 300 && typeof response.data === 'string') {
          html = response.data;
          if (html.includes('cf-browser-verification') || html.includes('Challenge Validation') || html.includes('captcha')) {
            isBlocked = true;
            html = null;
          }
        }
      } catch (err: any) {
        isBlocked = true;
        html = null;
        if (err?.response?.status >= 500) {
          is500Error = true;
        }
      }
    }

    let extractedBody = '';
    let extractionMethod = 'RSS_FALLBACK';
    let extractionTrace = '';
    let aiUsed = '';
    let retriesCount = 0;
    let retrySuccess = false;

    // Available HTML parsers (Stage 2: Normal HTML, Stage 3: Readability, Stage 4: Mozilla Readability, Stage 5: Mercury-style Heuristics)
    const parsers = [
      { name: 'JSON-LD', run: () => html ? this.extractJsonLd(html) : '' },
      { name: 'OpenGraph', run: () => html ? this.extractOpenGraph(html) : '' },
      { name: 'Article Tag', run: () => html ? this.extractArticleTag(html) : '' },
      { name: 'Readability', run: () => html ? this.extractReadability(html, finalUrl) : '' },
      { name: 'Publisher Parser', run: () => html ? this.extractPublisherParser(html, finalUrl) : '' },
      { name: 'Microdata', run: () => html ? this.extractMicrodata(html) : '' },
      { name: 'Mercury Parser', run: () => html ? this.extractMercuryParser(html) : '' },
      { name: 'Raw HTML', run: () => html ? this.extractRawHtmlParagraphs(html) : '' },
      { name: 'RSS', run: () => item.description || headline }
    ];

    const parserScores: { [key: string]: number } = {};
    const parserBodies: { [key: string]: string } = {};
    const tableCount = html ? (html.match(/<table\b[^>]*>/gi) || []).length : 0;

    const runAllParsers = () => {
      if (!isBlocked && html) {
        for (const parser of parsers) {
          try {
            const rawText = parser.run();
            const cleanText = ArticleExtractor.reconstructParagraphs(rawText);
            const wCount = this.getWordCount(cleanText);

            parserBodies[parser.name] = cleanText;

            if (cleanText && wCount >= 10) {
              const dummyContent = {
                headline,
                body: cleanText,
                url: item.url,
                publisher: item.publisher
              } as any;
              const tempExtract = EntityExtractor.getInstance().extract(dummyContent);
              const entityRichness = (tempExtract.v3Entities || []).length;
              const metricsRichness = (tempExtract.financialNumbers || []).length;

              const score = this.scoreParser(
                parser.name,
                cleanText,
                entityRichness,
                metricsRichness,
                tableCount,
                !!(item.author || item.publisher || item.image || item.category),
                headline
              );
              parserScores[parser.name] = score;
            } else {
              parserScores[parser.name] = 0;
            }
          } catch {
            parserScores[parser.name] = 0;
            parserBodies[parser.name] = '';
          }
        }
      }
    };

    runAllParsers();

    const getSelectedParserAndBody = () => {
      let highestScore = -1;
      let selectedParser = 'RSS';

      for (const parser of parsers) {
        const score = parserScores[parser.name] || 0;
        if (score > highestScore && parserBodies[parser.name]) {
          highestScore = score;
          selectedParser = parser.name;
        }
      }

      return {
        body: parserBodies[selectedParser] || '',
        method: selectedParser,
        score: highestScore
      };
    };

    let selected = getSelectedParserAndBody();
    extractedBody = selected.body;
    extractionMethod = selected.method;
    let initialScore = selected.score;

    // STAGE 7 Retry Engine: If initial score < 70, execute AI assisted extraction
    if ((!extractedBody || initialScore < 70) && !isPdf && html) {
      retriesCount++;
      const geminiProvider = new GeminiProvider();
      if (geminiProvider.isHealthy()) {
        try {
          console.log('[ArticleExtractor] Triggering STAGE 7 — AI Assisted Extraction due to low score:', initialScore);
          const response = await geminiProvider.generate({
            systemPrompt: "You are an expert financial journalist and Web scraper. Extract the full news article content from the given HTML. Ignore boilerplate, headers, footers, sidebars, ads, and navigation menus. Only output the clean, readable article body with paragraphs separated by double newlines. Do not include summaries, metadata, intros, or markdown blocks.",
            prompt: `Here is the raw HTML of the article with headline "${headline}" and URL "${finalUrl}":\n\n${html.substring(0, 50000)}`,
            temperature: 0.1,
            maxTokens: 2000
          });

          if (response && response.text && response.text.length > 100) {
            const cleanText = ArticleExtractor.reconstructParagraphs(response.text);
            const wCount = this.getWordCount(cleanText);
            if (wCount >= 50) {
              parserBodies['AI Assisted'] = cleanText;
              
              const dummyContent = {
                headline,
                body: cleanText,
                url: item.url,
                publisher: item.publisher
              } as any;
              const tempExtract = EntityExtractor.getInstance().extract(dummyContent);
              const entityRichness = (tempExtract.v3Entities || []).length;
              const metricsRichness = (tempExtract.financialNumbers || []).length;

              const aiScore = this.scoreParser(
                'AI Assisted',
                cleanText,
                entityRichness,
                metricsRichness,
                tableCount,
                !!(item.author || item.publisher || item.image || item.category),
                headline
              );
              
              parserScores['AI Assisted'] = aiScore;
              if (aiScore > initialScore) {
                extractedBody = cleanText;
                extractionMethod = 'AI Assisted';
                aiUsed = 'gemini-3.7-flash';
                retrySuccess = true;
              }
            }
          }
        } catch (err: any) {
          console.info('[ArticleExtractor] AI Assisted Extraction skipped (using deterministic extractor):', err?.message || err);
        }
      }
    }

    // STAGE 8: Local fallback if everything else fails
    let isFallbackUsed = false;
    if (!extractedBody || this.getWordCount(extractedBody) < 50) {
      extractedBody = "We couldn't extract the complete article. Showing the best available version.\n\n" + (parserBodies['RSS'] || item.description || headline);
      extractionMethod = 'RSS_FALLBACK';
      isFallbackUsed = true;
    }

    const isFallbackMethod = extractionMethod === 'RSS_FALLBACK';

    // Format the trace output
    const traceParts: string[] = [];
    for (const parser of parsers) {
      const score = parserScores[parser.name] !== undefined ? parserScores[parser.name] : 0;
      traceParts.push(`${parser.name}\n${score}`);
    }
    if (parserScores['AI Assisted'] !== undefined) {
      traceParts.push(`AI Assisted\n${parserScores['AI Assisted']}`);
    }
    traceParts.push(`Selected:\n${extractionMethod}`);
    extractionTrace = traceParts.join('\n\n');

    const reconstructedBody = ArticleExtractor.reconstructParagraphs(extractedBody);
    const paragraphs = reconstructedBody ? reconstructedBody.split('\n\n').filter(Boolean) : [];
    const paragraphCount = paragraphs.length;
    const wordCount = this.getWordCount(reconstructedBody);
    const readingTime = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0;

    let knowledge: ExtractedEntities | undefined = undefined;
    let entitiesList: any[] = [];
    let metricsList: any[] = [];
    let timeline: any = undefined;

    try {
      const tempContent = {
        id: item.id,
        headline,
        title: headline,
        articleBody: reconstructedBody,
        cleanedText: reconstructedBody,
        body: reconstructedBody,
        cleanText: reconstructedBody,
        url: item.url,
        publisher: item.publisher,
        publishedAt: item.publishedAt
      } as any;

      knowledge = EntityExtractor.getInstance().extract(tempContent);
      if (knowledge) {
        const validatedContent = EntityExtractor.validateExtraction({
          ...tempContent,
          entities: knowledge.v3Entities || [],
          financialMetrics: knowledge.financialNumbers || [],
          timeline: knowledge.timeline
        });

        entitiesList = validatedContent.entities || [];
        metricsList = validatedContent.financialMetrics || [];
        timeline = validatedContent.timeline;
      }
    } catch {}

    const parser = isFallbackMethod ? 'RSS_FALLBACK' : extractionMethod;
    const downloadTimeMs = Date.now() - startTime;

    const { qualityScore, qualityLabel, breakdown } = ArticleExtractor.calculateQualityScoreV3(
      wordCount,
      paragraphCount,
      parser,
      entitiesList.length,
      metricsList.length,
      !!(item.author || item.publisher || item.image || item.category),
      reconstructedBody
    );

    let status: 'FULL_EXTRACT' | 'PARTIAL' | 'RSS_BODY' | 'FALLBACK' = 'FALLBACK';
    let extractionState: 'FULL_ARTICLE' | 'PARTIAL_ARTICLE' | 'RSS_FALLBACK' = 'RSS_FALLBACK';

    if (!isFallbackMethod && wordCount >= 150) {
      status = 'FULL_EXTRACT';
      extractionState = 'FULL_ARTICLE';
    } else if (!isFallbackMethod && wordCount >= 50) {
      status = 'PARTIAL';
      extractionState = 'PARTIAL_ARTICLE';
    } else if (wordCount > 0) {
      status = 'RSS_BODY';
      extractionState = 'RSS_FALLBACK';
    } else {
      status = 'FALLBACK';
      extractionState = 'RSS_FALLBACK';
    }

    const contentResult: ArticleContent = {
      id: item.id,
      url: item.url,
      canonicalUrl: item.url,
      headline,
      title: headline,
      publisher: item.publisher,
      author: item.author || item.publisher,
      publishedAt: item.publishedAt,
      category: knowledge?.classification?.category || item.category || 'Markets',
      image: item.image,

      body: reconstructedBody,
      cleanText: reconstructedBody,
      cleanedText: reconstructedBody,
      rawText: reconstructedBody,
      articleBody: reconstructedBody,

      parser,
      extractedBy: parser,
      extractionMethod: parser,
      extractionState,

      quality: breakdown as any,
      qualityScore: qualityScore,
      extractionQuality: qualityLabel,

      wordCount,
      readingTime,
      readingTimeMin: readingTime,
      paragraphCount,

      tables: [],
      tableCount,

      entities: entitiesList,
      entityCount: entitiesList.length,

      financialMetrics: metricsList,
      financialMetricsCount: metricsList.length,

      timeline,
      knowledge,
      extractionTrace,
      extractedAt: new Date().toISOString(),
      timeTakenMs: downloadTimeMs,
      metadata: { downloadTimeMs },
      cached: false,
      status,
    };

    const isFiling = FilingIntelligenceEngine.getInstance().isCorporateFiling(contentResult, item);
    console.log(`[FLOW] Corporate Filing detected = ${isFiling}`);
    if (isFiling) {
      console.log('[FLOW] Selected Engine = Filing');
      contentResult.documentType = 'CORPORATE_FILING';
      contentResult.type = contentResult.type || 'CORPORATE_FILING';
      contentResult.category = 'Corporate Filing';
      const filingRes = await FilingIntelligenceEngine.getInstance().processFiling(contentResult);
      console.log(`[FLOW] Summary Generator Used: FilingIntelligenceEngine (${filingRes.provider})`);
    }

    // Save to Cache & Central ArticleRepository
    this.cache.set(`extracted_article_${item.id}`, contentResult, 24 * 60 * 60 * 1000);
    this.repo.saveEnrichedContent(item.id, contentResult);

    // Silently log metrics
    ProductionLogger.getInstance().logExtraction({
      id: item.id,
      url: finalUrl,
      headline: item.headline,
      publisher: item.publisher,
      timestamp: new Date().toISOString(),
      parserUsed: parser,
      aiUsed,
      fallbackUsed: isFallbackUsed,
      timeTakenMs: downloadTimeMs,
      qualityScore,
      isPdf: false,
      pdfSuccess: false,
      retriesCount,
      retrySuccess,
      is500Error
    });

    return contentResult;
  }

  /**
   * Stage 5 Mercury-style Parser heuristics using structural tags and elements
   */
  private extractMercuryParser(html: string): string {
    try {
      const $ = cheerio.load(html);
      
      const mercurySelectors = [
        '.main-content', '#main-content', '.article-content', '.article-body',
        '.story-body', '.story-content', '.post-content', '.entry-content',
        '#article-body', '#story-body', '.artText', '[itemprop="articleBody"]',
        'article', '.article__body'
      ];

      let bestElementText = '';
      
      for (const selector of mercurySelectors) {
        const el = $(selector);
        if (el.length > 0) {
          const cloned = el.clone();
          cloned.find('script, style, iframe, nav, header, footer, .ad, .advertisement, .social-share, .tags, .et-prime-promo').remove();
          const cleanTxt = Normalizer.cleanText(cloned.text());
          if (cleanTxt.length > bestElementText.length) {
            bestElementText = cleanTxt;
          }
        }
      }

      return bestElementText;
    } catch {
      return '';
    }
  }

  /**
   * Intelligently splits monolithic raw text into well-formed paragraphs of 2-4 sentences.
   * Cleans out journalist biographies, disclaimers, app download blocks, navigation/ads, and duplicates.
   */
  public static reconstructParagraphs(rawText: string): string {
    if (!rawText) return '';

    // Apply Boilerplate Cleaner to cut off text at boundary markers
    let text = ArticleExtractor.cleanBoilerplate(rawText);

    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    let existingParagraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    let finalParagraphs: string[] = [];
    const seenParagraphs = new Set<string>();

    for (const para of existingParagraphs) {
      // Phase 1 - BoilerplateCleaner: Duplicate Detection
      const normalizedPara = para.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenParagraphs.has(normalizedPara) && normalizedPara.length > 20) {
        continue;
      }
      seenParagraphs.add(normalizedPara);

      // Phase 1 - BoilerplateCleaner: Drop blacklisted standalone sentences
      let isBoilerplate = false;
      const lowerPara = para.toLowerCase();

      // Priority 1 Checks 4-9: Filter out biography, disclaimer, download app, news-promos, ads, navigation
      if (
        // 4. Journalist biographies
        lowerPara.includes('is a financial journalist') ||
        lowerPara.includes('is a reporter') ||
        lowerPara.includes('written by ') ||
        lowerPara.includes('reporting by ') ||
        lowerPara.includes('edited by ') ||
        lowerPara.includes('specializes in ') ||
        lowerPara.includes('views are personal') ||
        /about the author/i.test(lowerPara) ||
        // 5. Disclaimers
        lowerPara.includes('disclaimer:') ||
        lowerPara.includes('investment tips expressed') ||
        lowerPara.includes('certified financial advisor') ||
        lowerPara.includes('the views expressed by') ||
        lowerPara.includes('consult your financial advisor') ||
        lowerPara.includes('the authors or the publication') ||
        // 6. Download app blocks
        (lowerPara.includes('download') && (lowerPara.includes('app') || lowerPara.includes('apk'))) ||
        lowerPara.includes('click here to download') ||
        // 7. "Catch all latest news"
        lowerPara.includes('catch all the latest') ||
        lowerPara.includes('catch all latest news') ||
        lowerPara.includes('stay tuned for') ||
        lowerPara.includes('get all the latest news') ||
        // 8. Advertisement
        lowerPara.includes('story continues below advertisement') ||
        lowerPara.includes('advertisement') ||
        lowerPara.includes('promoted content') ||
        lowerPara.includes('sponsored link') ||
        // 9. Navigation text
        lowerPara.includes('back to home') ||
        lowerPara.includes('follow us on') ||
        lowerPara.includes('subscribe to our') ||
        lowerPara.includes('join our telegram') ||
        lowerPara.includes('newsletter')
      ) {
        isBoilerplate = true;
      }

      for (const pattern of ArticleExtractor.BOILERPLATE_PATTERNS) {
        if (lowerPara === pattern || lowerPara.startsWith(pattern + ' ')) {
          isBoilerplate = true;
          break;
        }
      }

      if (isBoilerplate) continue;

      const words = para.split(/\s+/).filter(Boolean);
      if (words.length > 90) {
        // Split long wall of text into sentence clusters of 2-4 sentences
        const sentences = para.match(/[^.!?]+[.!?]+(?=\s+[A-Z0-9"“'‘]|$)/g) || [para];
        let currentCluster: string[] = [];

        for (let i = 0; i < sentences.length; i++) {
          currentCluster.push(sentences[i].trim());
          if (currentCluster.length >= 3 || i === sentences.length - 1) {
            finalParagraphs.push(currentCluster.join(' '));
            currentCluster = [];
          }
        }
      } else {
        finalParagraphs.push(para);
      }
    }

    return finalParagraphs.join('\n\n');
  }

  /**
   * Phase 2 - Article Boundary Detection
   * Discards everything after common boilerplate footers.
   */
  public static cleanBoilerplate(text: string): string {
    const boundaryMarkers = [
      'about the author',
      'reporter profile',
      'editorial profile',
      'written by',
      'reported by',
      'related coverage',
      'related stories',
      'more stories',
      'recommended',
      'trending',
      'top stocks',
      'advertisement',
      'read more',
      'et prime',
      'subscribe',
      'newsletter',
      'whatsapp channel',
      'telegram channel',
      'comments',
      'stories you might be interested in',
      'you may also like',
      'disclaimer:',
      'download the'
    ];

    let lowerText = text.toLowerCase();
    let earliestCutoff = text.length;

    for (const marker of boundaryMarkers) {
      const idx = lowerText.indexOf(marker);
      if (idx !== -1 && idx < earliestCutoff) {
        earliestCutoff = idx;
      }
    }

    return text.substring(0, earliestCutoff).trim();
  }

  private static readonly BOILERPLATE_PATTERNS = [
    'subscribe to', 'sign up', 'newsletter', 'privacy policy', 'terms of service',
    'related stories', 'read also', 'recommended for you', 'cookie policy',
    'advertisement', 'copyright ©', 'all rights reserved', 'follow us on',
    'share this article', 'click here to', 'comments section', 'footer', 'navigation',
    'sign in', 'create account', 'unlimited access', 'subscription', 'paywall',
    'sponsored content', 'promoted stories', 'join our channel', 'telegram'
  ];

  /**
   * Internal Parser Scorer Engine based on the 10 mandatory factors
   */
  private scoreParser(
    parserName: string,
    text: string,
    entitiesCount: number,
    metricsCount: number,
    tableCount: number,
    hasMetadata: boolean,
    headline: string
  ): number {
    if (!text) return 0;
    const words = this.getWordCount(text);
    if (words < 10) return 0;

    let score = 0;

    // 1. Content Density & Length (max 20)
    if (words >= 600) score += 20;
    else if (words >= 300) score += 15;
    else if (words >= 150) score += 10;
    else score += 5;

    // 2. Paragraph Quality & Sentence Uniqueness (max 15)
    const paragraphs = text.split('\n\n').filter(Boolean);
    if (paragraphs.length >= 8) score += 15;
    else if (paragraphs.length >= 4) score += 10;
    else if (paragraphs.length >= 2) score += 5;

    // Calculate duplicates
    let duplicates = 0;
    const seen = new Set();
    for (const p of paragraphs) {
      const lower = p.toLowerCase().trim();
      if (seen.has(lower)) duplicates++;
      seen.add(lower);
    }
    const duplicatePercent = duplicates / Math.max(1, paragraphs.length);
    if (duplicatePercent > 0.1) score -= 15; // Penalty for high duplicates

    // 3. Financial Entities (max 15)
    if (entitiesCount >= 8) score += 15;
    else if (entitiesCount >= 4) score += 10;
    else if (entitiesCount >= 1) score += 5;

    // 4. Financial Metrics (max 10)
    if (metricsCount >= 4) score += 10;
    else if (metricsCount >= 2) score += 5;
    else if (metricsCount >= 1) score += 3;

    // 5. Tables presence (max 10)
    if (tableCount > 0) score += 10;

    // 6. Metadata presence (max 10)
    if (hasMetadata) score += 10;

    // 7. Headline Overlap (max 5)
    if (headline && text.toLowerCase().includes(headline.toLowerCase())) {
      score += 5;
    }

    // 8. Publisher Confidence (max 15)
    if (['JSON-LD', 'Publisher Parser'].includes(parserName)) score += 15;
    else if (parserName === 'Readability') score += 10;
    else if (['Article Tag', 'Microdata'].includes(parserName)) score += 5;

    // 9 & 10. Boilerplate %
    let boilerplateCount = 0;
    const lowerText = text.toLowerCase();
    for (const pattern of ArticleExtractor.BOILERPLATE_PATTERNS) {
      if (lowerText.includes(pattern)) {
        boilerplateCount += lowerText.split(pattern).length - 1;
      }
    }
    
    // Estimate boilerplate word count (assume ~10 words per pattern match)
    const estimatedBoilerplateWords = boilerplateCount * 10;
    const boilerplatePercent = estimatedBoilerplateWords / Math.max(1, words);

    if (boilerplatePercent > 0.15) {
      if (parserName === 'Raw HTML') {
        score -= 50; // Raw HTML must lose if boilerplate > 15%
      } else {
        score -= 25;
      }
    } else if (boilerplateCount > 0) {
      score -= Math.min(20, boilerplateCount * 5);
    }

    return Math.max(0, score);
  }

  /**
   * Extraction Quality Score V3 Algorithm (Weighted) - Phase 14
   */
  public static calculateQualityScoreV3(
    wordCount: number,
    paragraphCount: number,
    parser: string,
    entityCount: number,
    metricCount: number,
    hasMetadata: boolean,
    bodyText: string
  ): { qualityScore: number; qualityLabel: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR'; breakdown: any } {
    const breakdown = {
      parserScore: 0,
      bodyCompleteness: 0,
      metadata: 0,
      entities: 0,
      metrics: 0,
      timeline: 5, // baseline
      quotes: 5,   // baseline
      tables: 0,
      boilerplate: 10, // max start
      readability: 0,
      overall: 0
    };

    if (parser === 'RSS_FALLBACK' || wordCount === 0) {
      breakdown.overall = wordCount > 0 ? 20 : 0;
      return { qualityScore: breakdown.overall, qualityLabel: 'POOR', breakdown };
    }

    // 1. Extraction / Completeness (Max 25)
    if (wordCount >= 500) breakdown.bodyCompleteness = 25;
    else if (wordCount >= 300) breakdown.bodyCompleteness = 20;
    else if (wordCount >= 150) breakdown.bodyCompleteness = 12;
    else if (wordCount >= 50) breakdown.bodyCompleteness = 6;
    else breakdown.bodyCompleteness = 2;

    // 2. Parser quality (Max 15)
    if (['JSON-LD', 'PUBLISHER_PARSER', 'Publisher Parser'].includes(parser)) breakdown.parserScore = 15;
    else if (parser === 'READABILITY' || parser === 'Readability') breakdown.parserScore = 12;
    else if (['ARTICLE_TAG', 'MICRODATA', 'Article Tag', 'Microdata'].includes(parser)) breakdown.parserScore = 9;
    else if (['RAW_HTML', 'OPEN_GRAPH', 'OpenGraph', 'Raw HTML'].includes(parser)) breakdown.parserScore = 6;
    else breakdown.parserScore = 2;

    // 3. Entity richness (Max 15)
    if (entityCount >= 8) breakdown.entities = 15;
    else if (entityCount >= 5) breakdown.entities = 11;
    else if (entityCount >= 2) breakdown.entities = 7;
    else if (entityCount >= 1) breakdown.entities = 3;

    // 4. Financial metrics (Max 15)
    if (metricCount >= 4) breakdown.metrics = 15;
    else if (metricCount >= 2) breakdown.metrics = 11;
    else if (metricCount >= 1) breakdown.metrics = 6;

    // 5. Structure / Tables (Max 5)
    if (paragraphCount >= 6) breakdown.tables = 5;
    else if (paragraphCount >= 4) breakdown.tables = 4;
    else if (paragraphCount >= 2) breakdown.tables = 2;
    else breakdown.tables = 1;

    // 6. Metadata (Max 10)
    if (hasMetadata) breakdown.metadata = 10;
    else breakdown.metadata = 4;

    // 7. Readability (Max 5)
    const sentences = bodyText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    if (sentences.length > 0) {
      const avgSentenceLength = wordCount / sentences.length;
      if (avgSentenceLength >= 10 && avgSentenceLength <= 25) breakdown.readability = 5;
      else if (avgSentenceLength >= 5 && avgSentenceLength <= 35) breakdown.readability = 3;
      else breakdown.readability = 1;
    } else {
      breakdown.readability = 1;
    }

    // Boilerplate penalty
    let boilerplateCount = 0;
    const lowerText = bodyText.toLowerCase();
    for (const pattern of ArticleExtractor.BOILERPLATE_PATTERNS) {
      if (lowerText.includes(pattern)) {
        boilerplateCount += lowerText.split(pattern).length - 1;
      }
    }
    const penalty = Math.min(25, boilerplateCount * 4);
    breakdown.boilerplate = Math.max(0, 10 - penalty); // Convert penalty to a score out of 10

    let score = breakdown.bodyCompleteness + breakdown.parserScore + breakdown.entities + breakdown.metrics + breakdown.tables + breakdown.metadata + breakdown.readability + breakdown.timeline + breakdown.quotes - penalty;
    const finalScore = Math.max(0, Math.min(100, score));
    breakdown.overall = finalScore;

    let qualityLabel: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' = 'POOR';
    if (finalScore >= 80) qualityLabel = 'EXCELLENT';
    else if (finalScore >= 60) qualityLabel = 'GOOD';
    else if (finalScore >= 40) qualityLabel = 'AVERAGE';

    return { qualityScore: finalScore, qualityLabel, breakdown };
  }

  /**
   * Additional Parser Implementations
   */
  private extractOpenGraph(html: string): string {
    try {
      const $ = cheerio.load(html);
      const ogDesc = $('meta[property="og:description"]').attr('content') || '';
      const description = $('meta[name="description"]').attr('content') || '';
      const body = ogDesc.length > description.length ? ogDesc : description;
      return Normalizer.cleanText(body);
    } catch {
      return '';
    }
  }

  private extractMicrodata(html: string): string {
    try {
      const $ = cheerio.load(html);
      let foundText = '';
      $('[itemprop="articleBody"], [itemprop="text"]').each((_, el) => {
        const txt = Normalizer.cleanText($(el).text());
        if (txt.length > foundText.length) {
          foundText = txt;
        }
      });
      return foundText;
    } catch {
      return '';
    }
  }

  private extractJsonLd(html: string): string {
    try {
      const $ = cheerio.load(html);
      let foundBody = '';
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || '{}');
          const items = Array.isArray(json) ? json : [json];
          for (const obj of items) {
            if (obj && (obj['@type'] === 'NewsArticle' || obj['@type'] === 'Article')) {
              const body = obj.articleBody || obj.description;
              if (body && body.length > foundBody.length) {
                foundBody = Normalizer.cleanText(body);
              }
            }
          }
        } catch {}
      });
      return foundBody;
    } catch {
      return '';
    }
  }

  private extractArticleTag(html: string): string {
    try {
      const $ = cheerio.load(html);
      const articleEl = $('article');
      if (articleEl.length > 0) {
        const text = Normalizer.cleanText(articleEl.text());
        return text;
      }
      return '';
    } catch {
      return '';
    }
  }

  private extractReadability(html: string, url: string): string {
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const parsed = reader.parse();
      if (parsed && parsed.textContent) {
        return Normalizer.cleanText(parsed.textContent);
      }
      return '';
    } catch {
      return '';
    }
  }

  private static readonly PUBLISHER_PROFILES = [
    {
      name: 'Reuters',
      domain: 'reuters.com',
      selectors: ['.article-body p', '.story-content p'],
      noiseBlocks: ['.ad', '.trust-principles', '.social-share'],
      footerBlocks: ['footer', '.author-bio'],
      recommendedParser: 'PUBLISHER_PARSER',
      confidence: 0.95,
      knownBoilerplate: ['our standards: the thomson reuters trust principles']
    },
    {
      name: 'Bloomberg',
      domain: 'bloomberg.com',
      selectors: ['.engine-body p', '.story-content p', '.body-copy p'],
      noiseBlocks: ['.paywall', '.newsletter-signup', '.ad'],
      footerBlocks: ['.byline', 'footer'],
      recommendedParser: 'PUBLISHER_PARSER',
      confidence: 0.95,
      knownBoilerplate: ['subscribe to bloomberg', 'sign up for']
    },
    {
      name: 'Economic Times',
      domain: 'economictimes.indiatimes.com',
      selectors: ['.artText', '.article_content', 'arttext'], // usually text nodes or p inside these
      noiseBlocks: ['.ad', '.social-share', '.et-prime-promo', '.content_wrapper .readMore'],
      footerBlocks: ['footer', '.comments'],
      recommendedParser: 'PUBLISHER_PARSER',
      confidence: 0.90,
      knownBoilerplate: ['download app', 'et prime', 'read more']
    },
    {
      name: 'Moneycontrol',
      domain: 'moneycontrol.com',
      selectors: ['.content_wrapper p', '#article-main p'],
      noiseBlocks: ['.ad', '.tags', '.social-share'],
      footerBlocks: ['footer', '.article-comments'],
      recommendedParser: 'PUBLISHER_PARSER',
      confidence: 0.90,
      knownBoilerplate: ['copyright ©']
    },
    {
      name: 'Business Standard',
      domain: 'business-standard.com',
      selectors: ['.p-content p', '.story-content p'],
      noiseBlocks: ['.ad', '.social'],
      footerBlocks: ['footer'],
      recommendedParser: 'PUBLISHER_PARSER',
      confidence: 0.90,
      knownBoilerplate: ['read more on']
    },
    {
      name: 'LiveMint',
      domain: 'livemint.com',
      selectors: ['.mainArea p', '.storyPage_storyContent__l1Ebq p'],
      noiseBlocks: ['.ad', '.share'],
      footerBlocks: ['footer'],
      recommendedParser: 'PUBLISHER_PARSER',
      confidence: 0.90,
      knownBoilerplate: ['catch all business news']
    },
    {
      name: 'CNBC TV18',
      domain: 'cnbctv18.com',
      selectors: ['.article-content p', '.story-body p'],
      noiseBlocks: ['.ad'],
      footerBlocks: ['footer'],
      recommendedParser: 'PUBLISHER_PARSER',
      confidence: 0.90,
      knownBoilerplate: ['telegram']
    },
    {
      name: 'CoinDesk',
      domain: 'coindesk.com',
      selectors: ['.at-text p', '.typography__StyledTypography-owin6q-0 p'],
      noiseBlocks: ['.ad', '.newsletter'],
      footerBlocks: ['footer'],
      recommendedParser: 'JSON-LD', // Coindesk often has good JSON-LD
      confidence: 0.90,
      knownBoilerplate: ['coindesk is an independent']
    },
    {
      name: 'CoinTelegraph',
      domain: 'cointelegraph.com',
      selectors: ['.post-content p'],
      noiseBlocks: ['.ad', '.social-share'],
      footerBlocks: ['footer'],
      recommendedParser: 'JSON-LD',
      confidence: 0.90,
      knownBoilerplate: ['disclaimer:']
    },
    {
      name: 'BusinessLine',
      domain: 'thehindubusinessline.com',
      selectors: ['.artcl-body p', '.content-body p'],
      noiseBlocks: ['.ad'],
      footerBlocks: ['footer'],
      recommendedParser: 'PUBLISHER_PARSER',
      confidence: 0.90,
      knownBoilerplate: ['published on']
    }
  ];

  private extractPublisherParser(html: string, url: string): string {
    try {
      const $ = cheerio.load(html);
      
      let profile = ArticleExtractor.PUBLISHER_PROFILES.find(p => url.includes(p.domain));
      
      if (profile) {
        $(profile.noiseBlocks.join(', ')).remove();
        $(profile.footerBlocks.join(', ')).remove();
      }
      
      // Default unwanted elements
      $('script, style, iframe, nav, header, footer, .ad, .advertisement, .social-share').remove();

      let textPieces: string[] = [];
      const selectors = profile ? profile.selectors.join(', ') : '.article-body p, .story-details p, .content_wrapper p, .main-content p, .article_content p';
      
      $(selectors).each((_, el) => {
        const pText = Normalizer.cleanText($(el).text());
        if (pText.length > 20) {
          textPieces.push(pText);
        }
      });
      
      if (textPieces.length === 0 && profile && profile.name === 'Economic Times') {
         // Fallback for ET
         $('.artText, .article_content').contents().each((_, el) => {
           if (el.type === 'text') {
             const t = Normalizer.cleanText($(el).text());
             if (t.length > 20) textPieces.push(t);
           }
         });
      }

      return textPieces.join('\n\n');
    } catch {
      return '';
    }
  }

  private extractRawHtmlParagraphs(html: string): string {
    try {
      const $ = cheerio.load(html);
      $('script, style, iframe, nav, header, footer').remove();

      let textPieces: string[] = [];
      $('p').each((_, el) => {
        const pText = Normalizer.cleanText($(el).text());
        if (pText.length > 30) {
          textPieces.push(pText);
        }
      });

      return textPieces.join('\n\n');
    } catch {
      return '';
    }
  }

  private getWordCount(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}
