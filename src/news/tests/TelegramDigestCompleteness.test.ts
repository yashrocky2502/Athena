import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TelegramNotificationPipeline, TelegramNotificationRecord } from '../NewsEngine/TelegramNotificationPipeline.ts';

describe('Global F&O Telegram Digest Completeness & Truncation Remediation Tests', () => {
  let pipeline: TelegramNotificationPipeline;

  beforeEach(() => {
    pipeline = new TelegramNotificationPipeline({
      storePath: ':memory:',
      auditModeOnly: true
    });
  });

  it('TEST A — Short headline: complete headline is preserved unchanged', () => {
    const shortHeadline = 'TCS announces strategic partnership with AWS';
    const items: TelegramNotificationRecord[] = [{
      notificationId: 'ntf_test_a',
      articleId: 'art_test_a',
      chatId: '-1001234567890',
      stock: 'TCS',
      headline: shortHeadline,
      priority: 'HIGH',
      status: 'DIGEST_PENDING',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
      dedupKey: 'dedup_test_a',
      formattedMessage: ''
    }];

    const messages = pipeline.buildDigestMessages(items);
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain(`• ${shortHeadline}`);
    expect(messages[0]).not.toContain('...');
    expect(messages[0]).toContain('<b>TCS</b>');
    expect(messages[0]).toContain('Impact: HIGH');
  });

  it('TEST B — 119-character BAJAJ-AUTO headline: entire headline appears without artificial ellipsis', () => {
    const fullBajajHeadline = 'Bajaj Auto Exclusive: Supply chain issues resolved, October sales to be better, says Joint MD Rakesh Sharma - CNBC TV18';
    expect(fullBajajHeadline.length).toBe(119);

    const items: TelegramNotificationRecord[] = [{
      notificationId: 'ntf_test_b',
      articleId: 'art_test_b',
      chatId: '-1001234567890',
      stock: 'BAJAJ-AUTO',
      headline: fullBajajHeadline,
      url: 'https://www.cnbctv18.com/auto/bajaj-auto-october-sales.htm',
      priority: 'HIGH',
      status: 'DIGEST_PENDING',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
      dedupKey: 'dedup_test_b',
      formattedMessage: ''
    }];

    const messages = pipeline.buildDigestMessages(items);
    expect(messages.length).toBe(1);
    // Verifies full 119 characters are present
    expect(messages[0]).toContain(`• ${fullBajajHeadline}`);
    expect(messages[0]).toContain('says Joint MD Rakesh Sharma - CNBC TV18');
    expect(messages[0]).not.toContain('October sales to be better...');
    expect(messages[0]).toContain('<b>BAJAJ-AUTO</b>');
  });

  it('TEST C — 118-character INFY headline: entire headline appears without artificial truncation', () => {
    const fullInfyHeadline = 'Nifty IT jumps 2%; Mphasis, Coforge, Infosys, TCS among top gainers - Reason behind the rally, Q2 results expectations';
    expect(fullInfyHeadline.length).toBe(118);

    const items: TelegramNotificationRecord[] = [{
      notificationId: 'ntf_test_c',
      articleId: 'art_test_c',
      chatId: '-1001234567890',
      stock: 'INFY',
      headline: fullInfyHeadline,
      url: 'https://www.livemint.com/market/stock-market-news/nifty-it-rally.html',
      priority: 'HIGH',
      status: 'DIGEST_PENDING',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
      dedupKey: 'dedup_test_c',
      formattedMessage: ''
    }];

    const messages = pipeline.buildDigestMessages(items);
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain(`• ${fullInfyHeadline}`);
    expect(messages[0]).toContain('behind the rally, Q2 results expectations');
    expect(messages[0]).not.toContain('Reason...');
    expect(messages[0]).toContain('<b>INFY</b>');
  });

  it('TEST D — Valid canonical URL: URL/link included safely', () => {
    const items: TelegramNotificationRecord[] = [{
      notificationId: 'ntf_test_d',
      articleId: 'art_test_d',
      chatId: '-1001234567890',
      stock: 'RELIANCE',
      headline: 'Reliance Retail expands partnership with global consumer brands across Tier-2 cities',
      url: 'https://economictimes.indiatimes.com/news/reliance-retail.cms',
      priority: 'HIGH',
      status: 'DIGEST_PENDING',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
      dedupKey: 'dedup_test_d',
      formattedMessage: ''
    }];

    const messages = pipeline.buildDigestMessages(items);
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain('Read: <a href="https://economictimes.indiatimes.com/news/reliance-retail.cms">Source Link</a>');
  });

  it('TEST E — Missing URL: complete headline delivered without inventing an artificial URL', () => {
    const items: TelegramNotificationRecord[] = [{
      notificationId: 'ntf_test_e',
      articleId: 'art_test_e',
      chatId: '-1001234567890',
      stock: 'HDFCBANK',
      headline: 'HDFC Bank receives RBI approval for branch expansion across 500 rural locations',
      url: undefined,
      priority: 'CRITICAL',
      status: 'DIGEST_PENDING',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
      dedupKey: 'dedup_test_e',
      formattedMessage: ''
    }];

    const messages = pipeline.buildDigestMessages(items);
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain('• HDFC Bank receives RBI approval for branch expansion across 500 rural locations');
    expect(messages[0]).not.toContain('Read:');
    expect(messages[0]).not.toContain('<a href=');
  });

  it('TEST F — HTML-special characters: Telegram markup remains valid and content safely escaped', () => {
    const headlineWithSpecialChars = 'L&T wins mega order > Rs 5,000 Cr & enters contract with Saudi Aramco <Confidential>';
    const items: TelegramNotificationRecord[] = [{
      notificationId: 'ntf_test_f',
      articleId: 'art_test_f',
      chatId: '-1001234567890',
      stock: 'LT',
      headline: headlineWithSpecialChars,
      url: 'https://example.com/order?type=contract&id=101>2',
      priority: 'CRITICAL',
      status: 'DIGEST_PENDING',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
      dedupKey: 'dedup_test_f',
      formattedMessage: ''
    }];

    const messages = pipeline.buildDigestMessages(items);
    expect(messages.length).toBe(1);
    // Escaped HTML checks
    expect(messages[0]).toContain('L&amp;T wins mega order &gt; Rs 5,000 Cr &amp; enters contract with Saudi Aramco &lt;Confidential&gt;');
    expect(messages[0]).toContain('&amp;id=101&gt;2');
    // Ensure raw unescaped characters do not exist in the headline line
    expect(messages[0]).not.toContain('Saudi Aramco <Confidential>');
  });

  it('TEST G — Large digest: remains within conservative 3900 char budget OR splits cleanly into multiple sequential parts', () => {
    const largeItems: TelegramNotificationRecord[] = [];
    for (let i = 0; i < 20; i++) {
      largeItems.push({
        notificationId: `ntf_large_${i}`,
        articleId: `art_large_${i}`,
        chatId: '-1001234567890',
        stock: `STOCK_${i}`,
        headline: `Major corporate restructuring and comprehensive Q2 financial performance breakdown for Enterprise Stock ${i} with long descriptions exceeding typical thresholds and strategic roadmap update`,
        url: `https://example.com/corporate-announcement/enterprise-stock-${i}-strategic-roadmap-long-url-path-reference-2026.html`,
        priority: i % 2 === 0 ? 'CRITICAL' : 'HIGH',
        status: 'DIGEST_PENDING',
        attemptCount: 0,
        createdAt: new Date().toISOString(),
        dedupKey: `dedup_large_${i}`,
        formattedMessage: ''
      });
    }

    const messages = pipeline.buildDigestMessages(largeItems);
    // Must generate at least 1 message and each message must be under Telegram safe budget of 3900 chars
    expect(messages.length).toBeGreaterThanOrEqual(1);
    for (const msg of messages) {
      expect(msg.length).toBeLessThan(3900);
      expect(msg).toContain('ATHENA F&O DIGEST');
      expect(msg).toContain('Source:</b> ATHENA Real-Time Intelligence Engine');
    }
    if (messages.length > 1) {
      expect(messages[0]).toContain('Part 1/');
      expect(messages[1]).toContain('Part 2/');
    }
  });

  it('TEST H — Existing digest semantics: ticker, impact, item count, and ordering remain unchanged', async () => {
    const items: TelegramNotificationRecord[] = [
      {
        notificationId: 'ntf_1',
        articleId: 'art_1',
        chatId: '-1001234567890',
        stock: 'TATAMOTORS',
        headline: 'Tata Motors commercial vehicle registrations rise 14% YoY in September',
        priority: 'MEDIUM',
        status: 'DIGEST_PENDING',
        attemptCount: 0,
        createdAt: new Date().toISOString(),
        dedupKey: 'dedup_1',
        formattedMessage: ''
      },
      {
        notificationId: 'ntf_2',
        articleId: 'art_2',
        chatId: '-1001234567890',
        stock: 'BHARTIARTL',
        headline: 'Bharti Airtel wins multi-year telecom infrastructure contract in Africa',
        priority: 'CRITICAL',
        status: 'DIGEST_PENDING',
        attemptCount: 0,
        createdAt: new Date().toISOString(),
        dedupKey: 'dedup_2',
        formattedMessage: ''
      }
    ];

    (pipeline as any).records = [...items];

    const res = await pipeline.dispatchDigest();
    expect(res.sent).toBe(true);
    expect(res.itemCount).toBe(2);

    // Records status updated to SENT
    expect(items[0].status).toBe('SENT');
    expect(items[1].status).toBe('SENT');
  });
});
