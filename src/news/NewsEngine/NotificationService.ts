import { TelegramService, TelegramSendResult } from './TelegramService';
import { InstitutionalTelegramFormatter } from './InstitutionalTelegramFormatter';
import { ProductionAuditEngine, DecisionResultCode } from './ProductionAuditEngine';
import { CanonicalClassificationEngine } from './CanonicalClassificationEngine';
import { CompanyDetector } from '../detection/CompanyDetector';

export interface ArticleNotificationResult {
  articleId: string;
  eligible: boolean;
  sent: boolean;
  reason?: string;
  messageId?: number;
  httpStatus?: number;
  error?: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private notifiedArticleIds: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public isEligible(rawArticle: any): boolean {
    if (!rawArticle) return false;

    // Check direct flag first
    if (rawArticle.isFO === true) return true;

    // Work on a mutable clone if frozen to safely allow enrichment
    const article = Object.isFrozen(rawArticle) ? { ...rawArticle } : rawArticle;

    const safeSet = (obj: any, key: string, val: any) => {
      try {
        if (!Object.isFrozen(obj)) {
          obj[key] = val;
        }
      } catch {
        // Fallback for read-only or frozen properties
      }
    };

    // Run canonical classification & entity detection
    const classification = CanonicalClassificationEngine.classify(article);
    if (classification.isFO) {
      safeSet(rawArticle, 'isFO', true);
      safeSet(article, 'isFO', true);
      if (classification.resolvedCompany) {
        if (!article.symbol) {
          safeSet(rawArticle, 'symbol', classification.resolvedCompany.symbol);
          safeSet(article, 'symbol', classification.resolvedCompany.symbol);
        }
        if (!article.company) {
          safeSet(rawArticle, 'company', classification.resolvedCompany.name);
          safeSet(article, 'company', classification.resolvedCompany.name);
        }
      }
      return true;
    }

    const detection = CompanyDetector.detectUniversal({
      headline: article.headline || article.title || '',
      subheadline: article.subheadline || article.description || article.summary || '',
      summary: article.summary || '',
      articleBody: article.fullArticleBody || article.content || '',
      keywords: article.categories || article.tags || []
    });

    if (detection.isFnO) {
      safeSet(rawArticle, 'isFO', true);
      safeSet(article, 'isFO', true);
      if (detection.detectedCompanies.length > 0) {
        if (!article.symbol) {
          safeSet(rawArticle, 'symbol', detection.detectedCompanies[0].ticker);
          safeSet(article, 'symbol', detection.detectedCompanies[0].ticker);
        }
        if (!article.company) {
          safeSet(rawArticle, 'company', detection.detectedCompanies[0].name);
          safeSet(article, 'company', detection.detectedCompanies[0].name);
        }
      }
      return true;
    }

    const headline = (article.headline || article.title || '').toUpperCase();
    const category = (article.category || article.primaryCategory || '').toUpperCase();
    const tags = Array.isArray(article.tags) ? article.tags.map((t: string) => String(t).toUpperCase()) : [];

    const isFO =
      category.includes('F&O') ||
      tags.includes('F&O') ||
      headline.includes('F&O') ||
      headline.includes('DERIVATIVES') ||
      headline.includes('CALL OPTION') ||
      headline.includes('PUT OPTION') ||
      headline.includes('FUTURES') ||
      article.priorityLevel === 'CRITICAL' ||
      (typeof article.aiPriority === 'number' && article.aiPriority >= 85);

    return isFO;
  }

  public formatArticleMessage(article: any): string {
    return InstitutionalTelegramFormatter.format(article);
  }

  public async processArticle(rawArticle: any): Promise<ArticleNotificationResult> {
    const startTime = Date.now();
    if (!rawArticle || !rawArticle.id) {
      ProductionAuditEngine.getInstance().logNotificationDecision({
        articleId: rawArticle?.id || 'unknown',
        ticker: 'N/A',
        headline: 'Invalid or missing article payload',
        publishedTime: new Date().toISOString(),
        eligible: false,
        notificationServiceCalled: true,
        telegramServiceCalled: false,
        httpRequestExecuted: false,
        finalResult: 'UNKNOWN',
        reason: 'INVALID_ARTICLE_PAYLOAD'
      });

      return {
        articleId: rawArticle?.id || 'unknown',
        eligible: false,
        sent: false,
        reason: 'INVALID_ARTICLE',
      };
    }

    // Ensure mutable shallow copy for processing if rawArticle is frozen or read-only
    const article = Object.isFrozen(rawArticle) ? { ...rawArticle } : rawArticle;

    const ticker = article.symbol || article.ticker || (article.affectedAssets && article.affectedAssets[0]) || 'N/A';
    const publishedTime = article.publishedAt || article.publishedTime || new Date().toISOString();
    const headline = article.headline || article.title || 'Market Update';

    // Prevent duplicate notifications using ONLY article.id
    if (this.notifiedArticleIds.has(article.id)) {
      ProductionAuditEngine.getInstance().logNotificationDecision({
        articleId: article.id,
        ticker,
        headline,
        publishedTime,
        eligible: true,
        notificationServiceCalled: true,
        telegramServiceCalled: false,
        httpRequestExecuted: false,
        finalResult: 'DUPLICATE',
        reason: `Article ID ${article.id} already dispatched in this session`
      });

      return {
        articleId: article.id,
        eligible: true,
        sent: false,
        reason: 'DUPLICATE_ARTICLE_ID',
      };
    }

    // Eligibility Check
    const eligible = this.isEligible(article);
    if (!eligible) {
      ProductionAuditEngine.getInstance().logNotificationDecision({
        articleId: article.id,
        ticker,
        headline,
        publishedTime,
        eligible: false,
        notificationServiceCalled: true,
        telegramServiceCalled: false,
        httpRequestExecuted: false,
        finalResult: 'NOT_ELIGIBLE',
        reason: 'Ineligible: Article does not cross F&O impact threshold or ticker universe criteria'
      });

      return {
        articleId: article.id,
        eligible: false,
        sent: false,
        reason: 'INELIGIBLE_NOT_FO',
      };
    }

    // Mark article ID as processed
    this.notifiedArticleIds.add(article.id);

    // Format & send directly
    const text = this.formatArticleMessage(article);
    const result = await TelegramService.getInstance().sendMessage(text);
    const deliveryTimeMs = Date.now() - startTime;

    let resultCode: DecisionResultCode = 'SENT';
    let detailedReason = `Delivered to Telegram: HTTP ${result.httpStatus || 200}`;

    if (!result.success) {
      if (result.httpStatus === 400 || result.error?.includes('chat')) {
        resultCode = 'FAILED_CHAT';
        detailedReason = `Telegram API Chat ID error: ${result.error || 'Invalid Chat'}`;
      } else if (result.httpStatus === 401 || result.error?.includes('token') || result.error?.includes('credentials')) {
        resultCode = 'FAILED_TOKEN';
        detailedReason = `Telegram API Token error: ${result.error || 'Unauthorized'}`;
      } else if (result.httpStatus && result.httpStatus >= 400) {
        resultCode = 'FAILED_HTTP';
        detailedReason = `Telegram API returned HTTP ${result.httpStatus}: ${result.error || 'HTTP Error'}`;
      } else {
        resultCode = 'FAILED_NETWORK';
        detailedReason = `Network error connecting to Telegram API: ${result.error || 'Connection Failed'}`;
      }
    }

    ProductionAuditEngine.getInstance().logNotificationDecision({
      articleId: article.id,
      ticker: article.symbol || ticker,
      headline,
      publishedTime,
      eligible: true,
      notificationServiceCalled: true,
      telegramServiceCalled: true,
      httpRequestExecuted: true,
      telegramHttpStatus: result.httpStatus ?? (result.success ? 200 : 500),
      telegramResponse: result.responseBody,
      deliveryTimeMs,
      retryCount: 0,
      finalResult: resultCode,
      reason: detailedReason
    });

    return {
      articleId: article.id,
      eligible: true,
      sent: result.success,
      reason: result.success ? 'DELIVERED' : result.error,
      messageId: result.messageId,
      httpStatus: result.httpStatus,
      error: result.error,
    };
  }

  public async sendTestMessage(
    customToken?: string,
    customChatId?: string
  ): Promise<TelegramSendResult> {
    const sampleTestArticle = {
      id: `TEST_${Date.now()}`,
      symbol: 'RELIANCE',
      company: 'Reliance Industries Limited',
      headline: 'Reliance Industries Board Approves Strategic Energy Division Expansion',
      description: 'Reliance Industries reported strong quarterly momentum across oil-to-chemicals and green energy segments. Operating margins expanded 120 bps year-on-year. Derivatives open interest surged 14% with heavy call option writing at 3000 strike.',
      publisher: 'NSE Disclosures',
      category: 'F&O',
      url: 'https://athena.terminal/news'
    };

    const testText = this.formatArticleMessage(sampleTestArticle);
    return TelegramService.getInstance().sendMessage(testText, customToken, customChatId);
  }

  public getNotifiedCount(): number {
    return this.notifiedArticleIds.size;
  }

  public clearDeduplicationCache(): void {
    this.notifiedArticleIds.clear();
  }
}
