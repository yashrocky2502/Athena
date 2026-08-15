export type SectionLabel =
  | 'LEAD'
  | 'FINANCIAL_RESULTS'
  | 'BUSINESS_UPDATE'
  | 'EXECUTIVE_COMMENT'
  | 'BROKER_COMMENT'
  | 'GUIDANCE'
  | 'REGULATORY'
  | 'BACKGROUND'
  | 'IGNORE';

export interface ASTSentenceNode {
  id: string;
  text: string;
  wordCount: number;
  confidence: number;
}

export interface ASTParagraphNode {
  id: string;
  sentences: ASTSentenceNode[];
  label: SectionLabel;
  confidence: number;
  rawText: string;
}

export interface ASTHeadlineNode {
  text: string;
  confidence: number;
}

export interface ASTLeadNode {
  sentences: ASTSentenceNode[];
  confidence: number;
}

export interface ASTQuoteNode {
  id: string;
  speaker: string;
  designation: string;
  company: string;
  quote: string;
  sourceSentence: string;
  confidence: number;
}

export interface ASTTableNode {
  headers: string[];
  rows: string[][];
  confidence: number;
}

export interface ASTFooterNode {
  text: string;
  confidence: number;
}

export interface ASTMetadataNode {
  publisher?: string;
  publishedAt?: string;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  confidence: number;
}

export interface ASTFinancialMetric {
  metric: string;
  current: string;
  previous?: string;
  comparison?: string; // YoY, QoQ, MoM, etc.
  direction: 'UP' | 'DOWN' | 'FLAT';
  sourceSentence: string;
  confidence: number;
}

export interface ASTFinancialBlock {
  metrics: ASTFinancialMetric[];
  confidence: number;
}

export type EventCategory =
  | 'Expansion'
  | 'Acquisition'
  | 'Order Win'
  | 'Plant'
  | 'Capacity'
  | 'Client Win'
  | 'Launch'
  | 'Approval'
  | 'Guidance'
  | 'Technology'
  | 'Partnership'
  | 'Other';

export interface ASTBusinessEvent {
  title: string;
  description: string;
  category: EventCategory;
  sourceSentence: string;
  confidence: number;
}

export interface DocumentAST {
  headline: ASTHeadlineNode;
  lead?: ASTLeadNode;
  body: {
    paragraphs: ASTParagraphNode[];
    confidence: number;
  };
  quotes: ASTQuoteNode[];
  tables: ASTTableNode[];
  footer?: ASTFooterNode;
  metadata: ASTMetadataNode;
  financials: ASTFinancialBlock;
  events: ASTBusinessEvent[];
  confidence: number; // 0 - 100 overall parserConfidence
  confidenceBreakdown: {
    sentenceConfidence: number;
    paragraphConfidence: number;
    quoteConfidence: number;
    metricConfidence: number;
    eventConfidence: number;
  };
}

export class DocumentASTEngine {
  // Protective REGEX rules & Abbreviations
  private static readonly PROTECTED_ABBREVIATIONS = [
    'q1 fy27', 'q2 fy27', 'q3 fy27', 'q4 fy27',
    'q1 fy26', 'q2 fy26', 'q3 fy26', 'q4 fy26',
    'q1 fy25', 'q2 fy25', 'q3 fy25', 'q4 fy25',
    'fy27', 'fy26', 'fy25', 'fy24',
    'q1', 'q2', 'q3', 'q4',
    'rs.', 'rs', '₹', 'ltd.', 'ltd', 'pvt.', 'pvt', 'inc.', 'inc',
    'co.', 'co', 'corp.', 'corp', 'yoy', 'qoq', 'mom',
    'no.', 'sec.', 'reg.', 'dr.', 'mr.', 'mrs.', 'ms.', 'prof.',
    'v.', 'vs.', 'approx.', 'est.', 'ed.', 'vol.', 'e.g.', 'i.e.'
  ];

  private static readonly FORBIDDEN_STARTERS = /^(and|but|however|with|or|because)\b/i;

  private static readonly FORBIDDEN_ENDINGS = [
    'stood.', 'stood',
    'pressure on.', 'pressure on',
    'margin .', 'margin.', 'margin',
    'revenue .', 'revenue.', 'revenue',
    'what should investors do?', 'what should investors do',
    'commenting on.', 'commenting on',
    'market position.', 'market position',
    'strategic outlook.', 'strategic outlook',
    'live updates.', 'live updates',
    'share price.', 'share price',
    'read more.', 'read more'
  ];

  private static readonly BROKER_NAMES = [
    'morgan stanley', 'jefferies', 'nomura', 'emkay', 'icici securities',
    'goldman sachs', 'jp morgan', 'macquarie', 'citi', 'ubs', 'motilal oswal',
    'kotak institutional', 'hdfc securities', 'nirmal bang', 'axis capital',
    'jm financial', 'clsa', 'bernstein', 'investec', 'elara capital'
  ];

  private static readonly EXECUTIVE_TITLE_REGEX = /\b(ceo|cfo|md|managing director|chairman|chief executive|chief financial officer|director|founder|co-founder|president|executive vice president)\b/i;

  /**
   * Main Entry Point: Build Document AST from raw article data
   */
  public static buildAST(input: {
    headline: string;
    rawBody: string;
    publisher?: string;
    publishedAt?: string;
  }): DocumentAST {
    const rawHeadline = (input.headline || 'Market Update').trim();
    const rawBodyText = (input.rawBody || '').trim();

    // Clean headline
    const cleanHeadline = rawHeadline.replace(/^["'“`]+|["'”`]+$/g, '').trim();
    const headlineNode: ASTHeadlineNode = {
      text: cleanHeadline,
      confidence: cleanHeadline.length > 5 ? 100 : 80
    };

    // PHASE 2 — Paragraph Detection
    const rawParagraphTexts = this.detectParagraphs(rawBodyText, cleanHeadline);

    // PHASE 3 — Sentence Segmentation & Phase 5 Quote Isolation & Phase 8 Sentence Validation
    const paragraphNodes: ASTParagraphNode[] = [];
    const extractedQuotes: ASTQuoteNode[] = [];
    const extractedTables: ASTTableNode[] = [];

    let totalValidSentences = 0;
    let totalCandidateSentences = 0;

    rawParagraphTexts.forEach((pText, pIndex) => {
      if (!pText || pText.trim().length === 0) return;

      // Extract quotes from paragraph to isolate quotes from narration
      const { cleanParagraphText, quotesInParagraph } = this.isolateQuotesFromParagraph(pText, input.publisher);
      extractedQuotes.push(...quotesInParagraph);

      // Segment sentences protected against abbreviations, decimals, money, fiscal periods
      const sentences = this.segmentSentences(cleanParagraphText);
      totalCandidateSentences += sentences.length;

      const validSentencesInP: ASTSentenceNode[] = [];
      sentences.forEach((sText) => {
        const validated = this.validateAndCleanSentence(sText);
        if (validated) {
          validSentencesInP.push(validated);
          totalValidSentences++;
        }
      });

      if (validSentencesInP.length > 0) {
        // PHASE 4 — Section Classification (Exactly 1 label per paragraph)
        const label = this.classifyParagraphSection(validSentencesInP, pIndex, rawParagraphTexts.length);
        const paragraphConfidence = this.calculateParagraphConfidence(validSentencesInP, label);

        paragraphNodes.push({
          id: `para-${pIndex + 1}`,
          sentences: validSentencesInP,
          label,
          confidence: paragraphConfidence,
          rawText: cleanParagraphText
        });
      }
    });

    // Extract Lead Node
    let leadNode: ASTLeadNode | undefined = undefined;
    const leadPara = paragraphNodes.find(p => p.label === 'LEAD') || paragraphNodes[0];
    if (leadPara) {
      leadNode = {
        sentences: leadPara.sentences,
        confidence: leadPara.confidence
      };
    }

    // PHASE 6 — Financial Block Detection (From AST Paragraphs ONLY)
    const financialBlock = this.extractFinancialBlockFromAST(paragraphNodes);

    // PHASE 7 — Event Extraction (From AST Paragraphs ONLY)
    const events = this.extractBusinessEventsFromAST(paragraphNodes, cleanHeadline);

    // PHASE 10 — Confidence System Calculations
    const sentenceConfidence = totalCandidateSentences > 0
      ? Math.min(100, Math.round((totalValidSentences / totalCandidateSentences) * 100))
      : 100;

    const paragraphConfidence = paragraphNodes.length > 0
      ? Math.round(paragraphNodes.reduce((acc, p) => acc + p.confidence, 0) / paragraphNodes.length)
      : 100;

    const quoteConfidence = extractedQuotes.length > 0
      ? Math.round(extractedQuotes.reduce((acc, q) => acc + q.confidence, 0) / extractedQuotes.length)
      : 100; // If no quotes exist, quote score is 100 (doesn't penalize article)

    const metricConfidence = financialBlock.metrics.length > 0
      ? Math.round(financialBlock.metrics.reduce((acc, m) => acc + m.confidence, 0) / financialBlock.metrics.length)
      : 100; // If no metrics exist, metric score is 100

    const eventConfidence = events.length > 0
      ? Math.round(events.reduce((acc, e) => acc + e.confidence, 0) / events.length)
      : 100; // If no events exist, event score is 100

    // Weighted Average Parser Confidence
    // Sentence (30%), Paragraph (20%), Quote (15%), Metric (20%), Event (15%)
    const parserConfidence = Math.min(100, Math.round(
      (sentenceConfidence * 0.30) +
      (paragraphConfidence * 0.20) +
      (quoteConfidence * 0.15) +
      (metricConfidence * 0.20) +
      (eventConfidence * 0.15)
    ));

    const totalWordCount = paragraphNodes.reduce(
      (acc, p) => acc + p.sentences.reduce((sAcc, s) => sAcc + s.wordCount, 0),
      0
    );

    const metadata: ASTMetadataNode = {
      publisher: input.publisher,
      publishedAt: input.publishedAt,
      wordCount: totalWordCount,
      sentenceCount: totalValidSentences,
      paragraphCount: paragraphNodes.length,
      confidence: 100
    };

    return {
      headline: headlineNode,
      lead: leadNode,
      body: {
        paragraphs: paragraphNodes,
        confidence: paragraphConfidence
      },
      quotes: extractedQuotes,
      tables: extractedTables,
      metadata,
      financials: financialBlock,
      events,
      confidence: parserConfidence,
      confidenceBreakdown: {
        sentenceConfidence,
        paragraphConfidence,
        quoteConfidence,
        metricConfidence,
        eventConfidence
      }
    };
  }

  // --------------------------------------------------------------------------
  // PHASE 2 — Paragraph Detection
  // --------------------------------------------------------------------------
  private static detectParagraphs(text: string, headline: string): string[] {
    if (!text) return [];

    // Strip noise & OCR remnants first
    let cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p>/gi, '')
      .replace(/&nbsp;/g, ' ');

    const normHeadline = headline.toLowerCase().trim();

    // Split on double or multiple newlines
    const rawBlocks = cleanText.split(/\n\s*\n+/);
    const finalParagraphs: string[] = [];

    rawBlocks.forEach((block) => {
      const trimmedBlock = block.replace(/\s+/g, ' ').trim();
      if (!trimmedBlock) return;

      const lowerBlock = trimmedBlock.toLowerCase();
      if (lowerBlock === normHeadline) return;
      if (lowerBlock.startsWith('read more') || lowerBlock.startsWith('live updates')) return;
      if (lowerBlock.startsWith('what should investors do')) return;

      finalParagraphs.push(trimmedBlock);
    });

    // If text had single newlines instead of double newlines, split on single newlines if paragraphs exist
    if (finalParagraphs.length === 1 && finalParagraphs[0].includes('\n')) {
      const subLines = cleanText.split('\n').map(s => s.trim()).filter(Boolean);
      if (subLines.length > 1) {
        return subLines.filter(line => line.toLowerCase() !== normHeadline);
      }
    }

    return finalParagraphs.length > 0 ? finalParagraphs : [text.trim()];
  }

  // --------------------------------------------------------------------------
  // PHASE 3 — Sentence Segmentation
  // Protects: Decimals, Percentages, Money, Quotes, Parentheses, Fiscal periods
  // --------------------------------------------------------------------------
  public static segmentSentences(text: string): string[] {
    if (!text || text.trim().length === 0) return [];

    let normalized = text.trim();

    // Placeholder mask for protected tokens during splitting
    const placeholders: { token: string; original: string }[] = [];

    // 1. Protect Money & Decimals & Percentages (e.g. Rs. 1,200.50, ₹100.5, 12.5%, $120.5 mn)
    normalized = normalized.replace(/\b(Rs\.?|₹|\$|€|£)\s*(\d+[\d,]*\.\d+|\d+[\d,]*)/gi, (match) => {
      const token = `__PROTECTED_MONEY_${placeholders.length}__`;
      placeholders.push({ token, original: match });
      return token;
    });

    normalized = normalized.replace(/(\d+)\.(\d+)\s*(%|percent|cr|crore|lakh|mn|million|bn|billion)?\b/gi, (match) => {
      const token = `__PROTECTED_DECIMAL_${placeholders.length}__`;
      placeholders.push({ token, original: match });
      return token;
    });

    // 2. Protect Fiscal periods (e.g. Q1 FY27, Q4 FY26, FY26)
    normalized = normalized.replace(/\b(Q[1-4])\s*(FY\d{2,4})\b/gi, (match) => {
      const token = `__PROTECTED_FISCAL_${placeholders.length}__`;
      placeholders.push({ token, original: match });
      return token;
    });

    // 3. Protect Protected Abbreviations (e.g. Ltd., Pvt., Inc., Corp., Co., vs., Dr., Mr., Mrs., No., Sec.)
    this.PROTECTED_ABBREVIATIONS.forEach((abbr) => {
      const regex = new RegExp(`\\b${abbr.replace('.', '\\.')}`, 'gi');
      normalized = normalized.replace(regex, (match) => {
        const token = `__PROTECTED_ABBR_${placeholders.length}__`;
        placeholders.push({ token, original: match });
        return token;
      });
    });

    // Perform sentence boundary splitting on [.!?]+ followed by space or quote or end of string
    const rawSegments = normalized.split(/(?<=[.!?])\s+(?=[A-Z"“'])|(?<=[.!?])$/);

    const resultSentences: string[] = [];

    rawSegments.forEach((segment) => {
      let restored = segment.trim();
      if (!restored) return;

      // Restore placeholders
      placeholders.forEach(({ token, original }) => {
        restored = restored.replace(token, original);
      });

      // Clean up whitespace
      restored = restored.replace(/\s+/g, ' ').trim();
      if (restored.length > 0) {
        resultSentences.push(restored);
      }
    });

    return resultSentences;
  }

  // --------------------------------------------------------------------------
  // PHASE 5 — Quote Isolation
  // Prevents paragraphs from mixing quotes and narration
  // --------------------------------------------------------------------------
  private static isolateQuotesFromParagraph(
    paragraphText: string,
    publisher?: string
  ): { cleanParagraphText: string; quotesInParagraph: ASTQuoteNode[] } {
    const quotesInParagraph: ASTQuoteNode[] = [];
    const cleanParagraphText = paragraphText;

    // Detect speech quotes inside double quotation marks or explicit speech verb patterns
    const quoteRegex = /(?:["“]([^"”]{10,500})["”])\s*(?:,?\s*(said|stated|noted|commented|added|remarked|highlighted|explained)\s+([A-Z][a-zA-Z\s\.-]+?)(?:\s*,?\s*([^,.]+))?)?/gi;

    let match: RegExpExecArray | null;
    while ((match = quoteRegex.exec(paragraphText)) !== null) {
      const quoteBody = match[1]?.trim();
      let speakerName = match[3]?.trim() || 'Management';
      let designation = match[4]?.trim() || 'Executive';

      // Clean speaker name from date or article lead remnants
      speakerName = speakerName
        .replace(/^(?:th|st|nd|rd)?\s*,?\s*(?:e\s+)?the\s+/i, '')
        .replace(/^(?:announced\s+on\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d+(?:st|nd|rd|th)?,?\s*(?:the\s+)?/i, '')
        .trim();

      if (!speakerName || speakerName.length < 2 || /^(the|th|e)$/i.test(speakerName)) {
        speakerName = 'Management';
      }

      designation = designation.replace(/^(?:stated|said|noted|commented|added|remarked|highlighted|explained)\s*/i, '').trim();
      if (!designation || designation.length < 3) {
        designation = 'Executive';
      }

      if (quoteBody && quoteBody.split(/\s+/).length >= 3) {
        quotesInParagraph.push({
          id: `quote-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          speaker: speakerName,
          designation,
          company: publisher || 'Company',
          quote: quoteBody,
          sourceSentence: match[0],
          confidence: 95
        });
      }
    }

    return { cleanParagraphText, quotesInParagraph };
  }

  // --------------------------------------------------------------------------
  // PHASE 4 — Section Classification (Exactly 1 label per paragraph)
  // --------------------------------------------------------------------------
  private static classifyParagraphSection(
    sentences: ASTSentenceNode[],
    index: number,
    totalParagraphs: number
  ): SectionLabel {
    const combinedText = sentences.map(s => s.text).join(' ').toLowerCase();

    // Ignore boilerplate / nav / disclaimers
    if (
      combinedText.includes('disclaimer') ||
      combinedText.includes('read more') ||
      combinedText.includes('what should investors do') ||
      combinedText.includes('all rights reserved') ||
      combinedText.includes('share price today') ||
      combinedText.includes('live updates')
    ) {
      return 'IGNORE';
    }

    // Broker comment
    const isBroker = this.BROKER_NAMES.some(b => combinedText.includes(b)) ||
      /\b(buy|sell|hold|outperform|overweight|target price|brokerage|rating)\b/i.test(combinedText);
    if (isBroker) {
      return 'BROKER_COMMENT';
    }

    // Executive comment
    if (
      this.EXECUTIVE_TITLE_REGEX.test(combinedText) ||
      /\b(said|stated|commented|noted|highlighted|remarked|quoted)\b/i.test(combinedText)
    ) {
      return 'EXECUTIVE_COMMENT';
    }

    // Guidance
    if (
      /\b(guidance|outlook|target|expects|projected|forecast|fy27|fy26)\b/i.test(combinedText) &&
      /\b(revenue|margin|growth|capex|profit|ebitda)\b/i.test(combinedText)
    ) {
      return 'GUIDANCE';
    }

    // Financial Results
    if (
      /\b(net profit|pat|revenue|ebitda|operating profit|margin|q1|q2|q3|q4|yoy|qoq|crore|cr|lakh|million|billion)\b/i.test(combinedText)
    ) {
      return 'FINANCIAL_RESULTS';
    }

    // Business Update
    if (
      /\b(order|capacity|plant|acquisition|expanded|launch|client|contract|deal|partnership|facility|commissioned|raised)\b/i.test(combinedText)
    ) {
      return 'BUSINESS_UPDATE';
    }

    // Regulatory
    if (
      /\b(sebi|nclt|rbi|circular|order|court|tax|penalty|notice|exchange|bse|nse|approval|regulatory)\b/i.test(combinedText)
    ) {
      return 'REGULATORY';
    }

    // First paragraph defaults to LEAD
    if (index === 0) {
      return 'LEAD';
    }

    return 'BACKGROUND';
  }

  private static calculateParagraphConfidence(sentences: ASTSentenceNode[], label: SectionLabel): number {
    if (label === 'IGNORE') return 50;
    if (sentences.length === 0) return 0;
    const avgSentConf = sentences.reduce((acc, s) => acc + s.confidence, 0) / sentences.length;
    return Math.round(avgSentConf);
  }

  // --------------------------------------------------------------------------
  // PHASE 8 — Sentence Validation & Cleaning Rules
  // Filters out sentences with <6 words, forbidden starters, or forbidden endings
  // --------------------------------------------------------------------------
  private static validateAndCleanSentence(sentenceText: string): ASTSentenceNode | null {
    let cleanText = sentenceText
      .replace(/^["'“`]+|["'”`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return null;

    // Rule 1: Words count >= 6
    const words = cleanText.split(/\s+/).filter(Boolean);
    if (words.length < 6) return null;

    // Rule 2: Cannot start with forbidden starters: and, but, however, with, or, because
    if (this.FORBIDDEN_STARTERS.test(cleanText)) return null;

    // Rule 3: Cannot end with forbidden endings
    const lowerClean = cleanText.toLowerCase();
    const hasForbiddenEnding = this.FORBIDDEN_ENDINGS.some(ending => {
      return lowerClean.endsWith(ending) || lowerClean.endsWith(`${ending}.`);
    });

    if (hasForbiddenEnding) return null;

    return {
      id: `sent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      text: cleanText,
      wordCount: words.length,
      confidence: 100
    };
  }

  // --------------------------------------------------------------------------
  // PHASE 6 — Financial Block Detection From AST
  // --------------------------------------------------------------------------
  private static extractFinancialBlockFromAST(paragraphs: ASTParagraphNode[]): ASTFinancialBlock {
    const metrics: ASTFinancialMetric[] = [];

    // Scan ALL non-IGNORE paragraphs for financial metrics
    const financialParas = paragraphs.filter(p => p.label !== 'IGNORE');

    financialParas.forEach(p => {
      p.sentences.forEach(sNode => {
        const text = sNode.text;

        // Revenue / Sales / NII
        const revMatch = text.match(/\b(revenue|income|sales|topline|net interest income|nii|domestic sales)\b[^.]*?\b(rs\.?|₹|\$)?\s*([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|mn|billion|lakh crore)?\b/i);
        if (revMatch) {
          metrics.push({
            metric: revMatch[1].match(/nii|net interest income/i) ? 'NII' : 'Revenue',
            current: `${revMatch[2] || 'Rs. '}${revMatch[3]} ${revMatch[4] || 'crore'}`.trim(),
            comparison: text.match(/\bYoY\b/i) ? 'YoY' : text.match(/\bQoQ\b/i) ? 'QoQ' : undefined,
            direction: text.match(/rose|grew|up|jumped|surged|increased|expanded|rises/i) ? 'UP' : text.match(/fell|dropped|down|slumped|declined/i) ? 'DOWN' : 'FLAT',
            sourceSentence: text,
            confidence: 95
          });
        }

        // Net Profit / PAT
        const patMatch = text.match(/\b(net profit|pat|profit after tax|standalone net profit|consolidated net profit)\b[^.]*?\b(rs\.?|₹|\$)?\s*([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|mn|billion)?\b/i);
        if (patMatch) {
          metrics.push({
            metric: 'Net Profit',
            current: `${patMatch[2] || 'Rs. '}${patMatch[3]} ${patMatch[4] || 'crore'}`.trim(),
            comparison: text.match(/\bYoY\b/i) ? 'YoY' : text.match(/\bQoQ\b/i) ? 'QoQ' : undefined,
            direction: text.match(/rose|grew|up|jumped|surged|doubled|increased|rises/i) ? 'UP' : text.match(/fell|dropped|down|slumped|declined|decreased/i) ? 'DOWN' : 'FLAT',
            sourceSentence: text,
            confidence: 95
          });
        }

        // EBITDA / Operating Profit
        const ebitdaMatch = text.match(/\b(ebitda|operating profit|core operating profit)\b[^.]*?\b(rs\.?|₹|\$)?\s*([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|mn|billion)?\b/i);
        if (ebitdaMatch) {
          metrics.push({
            metric: 'EBITDA',
            current: `${ebitdaMatch[2] || 'Rs. '}${ebitdaMatch[3]} ${ebitdaMatch[4] || 'crore'}`.trim(),
            comparison: text.match(/\bYoY\b/i) ? 'YoY' : text.match(/\bQoQ\b/i) ? 'QoQ' : undefined,
            direction: text.match(/rose|grew|up|jumped|surged|increased|rises/i) ? 'UP' : text.match(/fell|dropped|down|slumped|declined/i) ? 'DOWN' : 'FLAT',
            sourceSentence: text,
            confidence: 95
          });
        }

        // Margin / NIM / ARPU / NPA
        const marginMatch = text.match(/\b(ebitda margin|operating margin|margin|nim|net interest margin|arpu|gnpa|net npa|npa)\b[^.]*?\b(rs\.?|₹)?\s*([\d,]+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*bps|rs\.?\s*\d+)\b/i);
        if (marginMatch) {
          metrics.push({
            metric: marginMatch[1].toUpperCase(),
            current: marginMatch[3],
            comparison: text.match(/\bYoY\b/i) ? 'YoY' : text.match(/\bQoQ\b/i) ? 'QoQ' : undefined,
            direction: text.match(/expanded|improved|rose|up|rises/i) ? 'UP' : text.match(/contracted|fell|down|dropped|declined/i) ? 'DOWN' : 'FLAT',
            sourceSentence: text,
            confidence: 95
          });
        }
      });
    });

    return {
      metrics,
      confidence: metrics.length > 0 ? 95 : 100
    };
  }

  // --------------------------------------------------------------------------
  // PHASE 7 — Event Extraction From AST
  // --------------------------------------------------------------------------
  private static extractBusinessEventsFromAST(
    paragraphs: ASTParagraphNode[],
    headline: string
  ): ASTBusinessEvent[] {
    const events: ASTBusinessEvent[] = [];

    const eventParas = paragraphs.filter(p => p.label !== 'IGNORE');

    eventParas.forEach(p => {
      p.sentences.forEach(sNode => {
        const text = sNode.text;
        const lower = text.toLowerCase();

        let category: EventCategory | undefined = undefined;

        if (lower.includes('order') || lower.includes('contract') || lower.includes('win')) category = 'Order Win';
        else if (lower.includes('plant') || lower.includes('facility') || lower.includes('factory')) category = 'Plant';
        else if (lower.includes('capacity') || lower.includes('expansion')) category = 'Capacity';
        else if (lower.includes('acquisition') || lower.includes('acquire') || lower.includes('bought')) category = 'Acquisition';
        else if (lower.includes('client') || lower.includes('customer')) category = 'Client Win';
        else if (lower.includes('launch') || lower.includes('introduced')) category = 'Launch';
        else if (lower.includes('approval') || lower.includes('cleared') || lower.includes('sanction')) category = 'Approval';
        else if (lower.includes('guidance') || lower.includes('target')) category = 'Guidance';
        else if (lower.includes('partnership') || lower.includes('tie-up') || lower.includes('joint venture')) category = 'Partnership';

        if (category) {
          events.push({
            title: `${category} Update`,
            description: text,
            category,
            sourceSentence: text,
            confidence: 95
          });
        }
      });
    });

    return events;
  }
}
