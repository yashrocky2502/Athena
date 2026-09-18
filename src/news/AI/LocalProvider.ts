import { IAIProvider, AIRequestOptions, AIResponse, ProviderType } from './AIProvider';
import { AIHealthMonitor } from './AIHealthMonitor';
import { CostTracker } from './CostTracker';
import { ConfidenceEngine } from './ConfidenceEngine';

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
    const issuerName = facts.companyName || facts.issuerName || facts.issuer || (options.publisher ? options.publisher : undefined);
    const filingType = facts.announcementType || facts.filingType || options.domainType || 'Corporate Disclosure';

    const execParts: string[] = [];
    if (issuerName) {
      execParts.push(`${issuerName} reported an update regarding ${filingType}.`);
    } else {
      execParts.push(`Disclosure recorded regarding ${filingType}.`);
    }

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
    if (facts.companyName || facts.issuerName || facts.issuer) {
      highlights.push(`• Entity: ${facts.companyName || facts.issuerName || facts.issuer}`);
    }
    if (facts.announcementType || facts.filingType) {
      highlights.push(`• Filing Category: ${facts.announcementType || facts.filingType}`);
    }
    if (facts.revenue) highlights.push(`• Revenue: ${facts.revenue}`);
    if (facts.pat) highlights.push(`• PAT: ${facts.pat}`);
    if (facts.orderBook) highlights.push(`• Order Book: ${facts.orderBook}`);
    if (facts.contractValue) highlights.push(`• Contract Value: ${facts.contractValue}`);
    if (facts.dividend) highlights.push(`• Dividend: ${facts.dividend}`);
    if (facts.bonusRatio) highlights.push(`• Bonus Ratio: ${facts.bonusRatio}`);
    if (facts.splitRatio) highlights.push(`• Split Ratio: ${facts.splitRatio}`);
    if (facts.meetingDate) highlights.push(`• Meeting Date: ${facts.meetingDate}`);

    if (highlights.length < 3) {
      highlights.push(`• Primary Event: ${headline}`);
      const sourceName = options.publisher || facts.publisher || facts.source;
      if (sourceName) {
        highlights.push(`• Disclosing Source: ${sourceName}`);
      } else {
        highlights.push(`• Record Type: Corporate / Market Disclosure`);
      }
      if (facts.filingDate || facts.date) {
        highlights.push(`• Filing Date: ${facts.filingDate || facts.date}`);
      } else {
        highlights.push(`• Processing Mode: Deterministic Fact-Grounded Extraction`);
      }
    }

    const whyItMatters = facts.announcementType === 'Quarterly Results'
      ? 'Reflects reported financial and operational metrics for the period.'
      : 'Provides factual disclosure regarding corporate and market developments.';

    const investorTakeaway = 'Track official company announcements and disclosures for further updates.';

    summaryText = `Executive Summary\n${executiveSummary}\n\nKey Highlights\n${highlights.join('\n')}\n\nWhy It Matters\n${whyItMatters}\n\nInvestor Takeaway\n${investorTakeaway}`;

    const latencyMs = Date.now() - startTime;
    const promptTokens = Math.ceil((options.prompt?.length || 100) / 4);
    const completionTokens = Math.ceil(summaryText.length / 4);
    const totalTokens = promptTokens + completionTokens;

    const costEstimate = this.costTracker.trackUsage('local', promptTokens, completionTokens, latencyMs);
    this.healthMonitor.recordSuccess('local', latencyMs, totalTokens);

    // Compute measured post-generation confidence evaluation
    const evalResult = ConfidenceEngine.evaluate(summaryText, facts, options.prompt);

    if (options.streamingCallback) {
      options.streamingCallback('final', summaryText);
    }

    return {
      text: summaryText,
      provider: 'local',
      confidence: evalResult.score,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      costEstimate,
      fallbackUsed: true
    };
  }
}
