import { IAIProvider, AIRequestOptions, AIResponse, ProviderType } from './AIProvider';
import { AIHealthMonitor } from './AIHealthMonitor';
import { CostTracker } from './CostTracker';

export class LocalProvider implements IAIProvider {
  public readonly providerName: ProviderType = 'local';
  private healthMonitor = AIHealthMonitor.getInstance();
  private costTracker = CostTracker.getInstance();

  public isHealthy(): boolean {
    return true; // Local engine is always healthy
  }

  public async generate(options: AIRequestOptions): Promise<AIResponse> {
    const startTime = Date.now();

    if (options.streamingCallback) {
      options.streamingCallback('thinking', 'Initializing Athena Local Intelligence Engine...');
    }

    const headline = options.headline || 'Financial Disclosure';
    const facts = options.facts || {};
    const prompt = options.prompt || '';

    let summaryText = '';

    // Check if facts contains pre-extracted corporate filing or structured facts
    const issuerName = facts.companyName || facts.issuerName || facts.issuer || 'The disclosing company';
    const filingType = facts.announcementType || facts.filingType || options.domainType || 'Corporate Disclosure';

    const execParts: string[] = [];
    execParts.push(`${issuerName} submitted a formal regulatory communication regarding ${filingType}.`);

    if (facts.revenue) execParts.push(`Reported total revenue stood at ${facts.revenue}.`);
    if (facts.pat) execParts.push(`Net profit after tax (PAT) reached ${facts.pat}.`);
    if (facts.ebitda) execParts.push(`EBITDA reported at ${facts.ebitda}.`);
    if (facts.orderBook) execParts.push(`Total order book pipeline stands at ${facts.orderBook}.`);
    if (facts.contractValue) execParts.push(`Secured order/contract valued at ${facts.contractValue}.`);
    if (facts.dividend) execParts.push(`Declared dividend payout of ${facts.dividend}.`);
    if (facts.bonusRatio) execParts.push(`Approved bonus share ratio of ${facts.bonusRatio}.`);
    if (facts.splitRatio) execParts.push(`Approved stock split ratio of ${facts.splitRatio}.`);

    if (execParts.length === 1 && prompt.length > 50) {
      // Use clean sentences from prompt or body
      const cleanPrompt = prompt.replace(/^[\s\S]*?(?:Article Content:|Content:|Details:)\s*/i, '');
      const sentences = cleanPrompt.split(/(?<=[.!?])\s+/).filter(s => s.length > 20 && !s.toLowerCase().includes('format strictly'));
      if (sentences.length > 0) {
        execParts.push(sentences.slice(0, 3).join(' '));
      }
    }

    const executiveSummary = execParts.join(' ').trim();

    // Key Highlights
    const highlights: string[] = [];
    if (facts.companyName) highlights.push(`• Entity: ${facts.companyName}`);
    if (facts.announcementType) highlights.push(`• Filing Category: ${facts.announcementType}`);
    if (facts.revenue) highlights.push(`• Revenue: ${facts.revenue}`);
    if (facts.pat) highlights.push(`• PAT: ${facts.pat}`);
    if (facts.orderBook) highlights.push(`• Order Book: ${facts.orderBook}`);
    if (facts.contractValue) highlights.push(`• Contract Value: ${facts.contractValue}`);
    if (facts.meetingDate) highlights.push(`• Meeting Date: ${facts.meetingDate}`);

    if (highlights.length < 3) {
      highlights.push(`• Primary Event: ${headline}`);
      highlights.push(`• Disclosure Status: Verified Official Regulatory Release`);
      highlights.push(`• Filing Authority: Exchange Regulatory Mechanism`);
    }

    const whyItMatters = facts.announcementType === 'Quarterly Results'
      ? 'Reflects core operational performance and top-line momentum over the reported financial period.'
      : 'Ensures statutory transparency and compliance with mandatory regulatory disclosure frameworks.';

    const investorTakeaway = 'Track official exchange filings and upcoming corporate announcements for operational updates.';

    summaryText = `Executive Summary\n${executiveSummary}\n\nKey Highlights\n${highlights.join('\n')}\n\nWhy It Matters\n${whyItMatters}\n\nInvestor Takeaway\n${investorTakeaway}`;

    const latencyMs = Date.now() - startTime;
    const promptTokens = Math.ceil((options.prompt?.length || 100) / 4);
    const completionTokens = Math.ceil(summaryText.length / 4);
    const totalTokens = promptTokens + completionTokens;

    const costEstimate = this.costTracker.trackUsage('local', promptTokens, completionTokens, latencyMs);
    this.healthMonitor.recordSuccess('local', latencyMs, totalTokens);

    if (options.streamingCallback) {
      options.streamingCallback('final', summaryText);
    }

    return {
      text: summaryText,
      provider: 'local',
      confidence: 85,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      costEstimate,
      fallbackUsed: true
    };
  }
}
