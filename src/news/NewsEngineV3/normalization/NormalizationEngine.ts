/**
 * ATHENA NEWS ENGINE V3 — UNIVERSAL NORMALIZATION ENGINE
 * 
 * Orchestrates the 24-step pure normalization pipeline:
 * Converts raw html/unstructured article inputs into clean, canonical NormalizedDocument instances.
 * NO AI, NO CLASSIFICATION, NO PARSING, NO SUMMARIZATION. ONLY NORMALIZATION.
 */

import { V3PublisherId } from '../types/V3Types';
import { NormalizedDocument, NormalizationValidationResult } from './types/NormalizationTypes';
import { HtmlCleaner } from './HtmlCleaner';
import { UnicodeNormalizer } from './UnicodeNormalizer';
import { NoiseRemovalEngine } from './NoiseRemovalEngine';
import { ParagraphBuilder } from './ParagraphBuilder';
import { SentenceSegmenter } from './SentenceSegmenter';
import { MetadataExtractor } from './MetadataExtractor';
import { CompanyDetector } from './CompanyDetector';
import { CurrencyNormalizer } from './CurrencyNormalizer';
import { LanguageDetector } from './LanguageDetector';
import { DocumentHasher } from './DocumentHasher';
import { NormalizerValidator } from './NormalizerValidator';
import { V3EventBus } from '../events/V3EventBus';
import { NotificationHub } from '../notificationHub/NotificationHub';
import { V3Logger } from '../logging/V3Logger';
import { V3Utils } from '../utils/V3Utils';
import { UniversalExtractor } from './extractors/UniversalExtractor';
import { ContentCompletenessValidator } from './ContentCompletenessValidator';

export interface RawArticleInput {
  title?: string;
  publisher?: string;
  publisherId?: V3PublisherId;
  sourceUrl?: string;
  canonicalUrl?: string;
  publishedAt?: string;
  modifiedAt?: string;
  author?: string;
  subtitle?: string;
  category?: string;
  tags?: string[];
  rawContent: string;
}

export interface NormalizationEngineResult {
  success: boolean;
  document?: NormalizedDocument;
  validationResult: NormalizationValidationResult;
  processingTimeMs: number;
}

export class NormalizationEngine {
  private logger = V3Logger.getInstance();
  private eventBus = V3EventBus.getInstance();
  private notificationHub = NotificationHub.getInstance();

  /**
   * Executes the 24-step Universal Normalization Pipeline.
   */
  public async normalize(input: RawArticleInput): Promise<NormalizationEngineResult> {
    const startTime = Date.now();
    const correlationId = V3Utils.generateId('CORR');

    this.logger.info('NormalizationEngine', `Starting normalization for article: "${input.title || 'Untitled'}"`, { correlationId }, correlationId);

    // 0. Extract full-body original content if needed
    const extractionResult = await UniversalExtractor.extractFullBody(
      input.publisherId || 'OTHER_PUBLISHER',
      input.sourceUrl || '',
      input.rawContent || ''
    );
    const resolvedRawContent = extractionResult.body;
    const rawLength = resolvedRawContent.length;

    // 1. HTML Cleaning
    const cleanedHtml = HtmlCleaner.cleanHtml(resolvedRawContent);

    // 2. Unicode Normalization
    const unicodeNormalized = UnicodeNormalizer.normalize(cleanedHtml);

    // 3. Noise & Boilerplate Removal
    let noiseRemovedText = NoiseRemovalEngine.removeNoise(unicodeNormalized);

    // Fallback: If noiseRemovedText is empty or sparse, use title/subtitle to ensure valid article text
    if (!noiseRemovedText || !noiseRemovedText.trim()) {
      const titleFallback = [input.title, input.subtitle].filter(Boolean).join('. ');
      if (titleFallback.trim().length > 0) {
        noiseRemovedText = UnicodeNormalizer.normalize(titleFallback);
      }
    } else if (input.title && input.title.trim().length > 0) {
      const testParas = ParagraphBuilder.buildParagraphs(noiseRemovedText);
      const testSents = SentenceSegmenter.segmentParagraphs(testParas);
      if (testSents.length < 2 && !noiseRemovedText.toLowerCase().includes(input.title.trim().toLowerCase())) {
        noiseRemovedText = `${input.title.trim()}.\n\n${noiseRemovedText}`;
      }
    }

    const noiseRemovedLength = noiseRemovedText.length;

    // 4. Paragraph Detection
    const paragraphs = ParagraphBuilder.buildParagraphs(noiseRemovedText);

    // 5. Sentence Segmentation
    const sentences = SentenceSegmenter.segmentParagraphs(paragraphs);

    // 6. Plain Text Reconstruction
    const plainText = paragraphs.map(p => p.text).join('\n\n');

    // 7. Metadata Extraction
    const metadata = MetadataExtractor.extractMetadata({
      ...input,
      rawContent: plainText
    });

    // 8. Company Detection
    const companies = CompanyDetector.detectCompanies(metadata.title, plainText);
    const primaryCompany = companies.find(c => c.isPrimary) || companies[0];

    // 9. Currency Normalization
    const currencies = CurrencyNormalizer.extractAndNormalize(plainText);

    // 10. Language Detection
    const language = LanguageDetector.detectLanguage(plainText);
    metadata.language = language;

    // 11. Document Hashes
    const hashes = DocumentHasher.generateHashes(
      resolvedRawContent,
      plainText,
      paragraphs,
      sentences
    );

    // Calculate word & character counts
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    const characterCount = plainText.length;
    const docId = `DOC_${hashes.normalizedHash.slice(0, 16)}`;

    const candidateDoc: Partial<NormalizedDocument> = {
      documentId: docId,
      publisherId: metadata.publisherId,
      publisherName: metadata.publisher,
      canonicalUrl: metadata.canonicalUrl,
      sourceUrl: metadata.sourceUrl,
      title: metadata.title,
      subtitle: metadata.subtitle,
      companies,
      primaryCompany,
      currencies,
      category: metadata.category,
      language,
      paragraphs,
      sentences,
      plainText,
      metadata,
      hashes,
      wordCount,
      characterCount
    };

    // 12. Quality Validation Gate
    const validationResult = NormalizerValidator.validate(candidateDoc, rawLength, noiseRemovedLength);
    
    // 12.5 Content Completeness Gate
    const completenessResult = ContentCompletenessValidator.validate(candidateDoc);
    if (!completenessResult.isValid) {
      validationResult.isValid = false;
      validationResult.errors.push(completenessResult.reason || 'SOURCE_SPARSE: Content completeness check failed.');
    }

    const processingTimeMs = Date.now() - startTime;

    if (!validationResult.isValid) {
      this.logger.warn('NormalizationEngine', `Quality gate validation failed for doc ${docId}`, { errors: validationResult.errors }, correlationId);

      // Notify Operations channel of failure
      await this.notificationHub.dispatch({
        type: 'NORMALIZATION',
        title: `Normalization Failed: ${metadata.publisher}`,
        message: `Article "${metadata.title}" failed Phase 3 Quality Gate.\nErrors: ${validationResult.errors.join(', ')}`,
        priority: 'HIGH',
        metadata: { docId, errors: validationResult.errors, publisher: metadata.publisher }
      });

      return {
        success: false,
        validationResult,
        processingTimeMs
      };
    }

    const normalizedDoc: NormalizedDocument = {
      ...(candidateDoc as NormalizedDocument),
      processingTimeMs,
      normalizedAt: new Date().toISOString()
    };

    // Publish ARTICLE_NORMALIZED event to V3EventBus
    await this.eventBus.publish({
      eventId: V3Utils.generateId('EVT'),
      type: 'ARTICLE_NORMALIZED',
      priority: 'NORMAL',
      timestamp: new Date().toISOString(),
      correlationId,
      payload: {
        documentId: docId,
        publisher: metadata.publisher,
        title: metadata.title,
        paragraphCount: paragraphs.length,
        sentenceCount: sentences.length,
        companyCount: companies.length,
        wordCount,
        processingTimeMs
      }
    });

    // Notify Developer channel of successful normalization
    await this.notificationHub.dispatch({
      type: 'NORMALIZATION',
      title: `Normalized: ${metadata.publisher}`,
      message: `Successfully normalized "${metadata.title}"\n• Paragraphs: ${paragraphs.length}\n• Sentences: ${sentences.length}\n• Companies Detected: ${companies.length}\n• Words: ${wordCount}\n• Latency: ${processingTimeMs}ms\n• Hash: ${hashes.normalizedHash.slice(0, 12)}`,
      priority: 'LOW',
      metadata: { docId, hash: hashes.normalizedHash, processingTimeMs }
    });

    this.logger.info('NormalizationEngine', `Normalization completed in ${processingTimeMs}ms for doc ${docId}`, { docId, processingTimeMs }, correlationId);

    return {
      success: true,
      document: normalizedDoc,
      validationResult,
      processingTimeMs
    };
  }
}
