import { NewsArticleV2 } from '../../newsCoreV2/domain/NewsArticle.ts';
import { IntelligenceRecord } from '../../newsCoreV2/intelligenceV2/IntelligenceTypes.ts';
import { TelegramNewsFormatter } from '../../newsCoreV2/notifications/TelegramNewsFormatter.ts';

export class TraderTelegramFormatter {
  /**
   * Formats an IntelligenceRecord or NewsArticleV2 into a compact, high-density Telegram HTML alert.
   * Delegates directly to TelegramNewsFormatter.
   */
  public static format(recordOrArticle: IntelligenceRecord | NewsArticleV2, customOptionsImpact?: string): string {
    return TelegramNewsFormatter.format(recordOrArticle, customOptionsImpact);
  }

  public static escapeHtml(str: string): string {
    return TelegramNewsFormatter.escapeHtml(str);
  }
}
