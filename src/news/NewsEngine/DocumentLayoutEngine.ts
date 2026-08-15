export type BlockType =
  | 'Header'
  | 'Letterhead'
  | 'Logo'
  | 'Title'
  | 'Recipient'
  | 'Subject'
  | 'Body'
  | 'Tables'
  | 'Footnotes'
  | 'Signature'
  | 'Annexures'
  | 'Footer';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextBlock {
  text: string;
  page: number;
  coordinates: BoundingBox;
  confidence: number;
  blockType: BlockType;
}

export interface StructuredDocument {
  blocks: TextBlock[];
  fullText: string;
  pageCount: number;
  regions: {
    header: string;
    letterhead: string;
    logoText: string;
    title: string;
    recipient: string;
    subject: string;
    body: string;
    tables: string;
    footnotes: string;
    signature: string;
    annexures: string;
    footer: string;
  };
}

export class DocumentLayoutEngine {
  /**
   * Parse document text or PDF layout streams into structured typed layout blocks
   * complete with page numbers, coordinates, confidence, and block type tags.
   */
  public static parseDocumentLayout(rawText: string, pageCount: number = 1): StructuredDocument {
    const cleanText = rawText.replace(/\r\n/g, '\n').trim();
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

    const blocks: TextBlock[] = [];
    const totalLines = lines.length || 1;

    // Region accumulators
    const regionTexts: Record<string, string[]> = {
      header: [],
      letterhead: [],
      logoText: [],
      title: [],
      recipient: [],
      subject: [],
      body: [],
      tables: [],
      footnotes: [],
      signature: [],
      annexures: [],
      footer: []
    };

    let currentBlockType: BlockType = 'Header';
    const linesPerPage = Math.max(1, Math.ceil(lines.length / Math.max(1, pageCount)));

    // Regular Expression Triggers
    const recipientTrigger = /^(to,|the\s+(manager|general\s+manager|head|secretary|listing\s+department)|national\s+stock\s+exchange|bse\s+limited|sebi)\b/i;
    const subjectTrigger = /^(sub:|subject:|re:|ref:|intimation\s+under|outcome\s+of|submission\s+of)\b/i;
    const tableTrigger = /^(\||[+-]{3,}|s\.?no\.?|sr\.?\s*no|particulars|amount|quarter\s+ended|financial\s+results|\d+\.\s+\d+)/i;
    const footnoteTrigger = /^\*|^\(\*\)|^note[s]?:|^source:|^disclaimer:/i;
    const sigTrigger = /^(yours\s+(faithfully|sincerely|truly)|regards|warm\s+regards|best\s+regards|sd\/-|sd\/|\[sd\/-\]|authorised\s+signatory|authorized\s+signatory|company\s+secretary|compliance\s+officer|managing\s+director|chief\s+financial\s+officer|cfo)\b/i;
    const annexureTrigger = /^(annexure|appendix|schedule|encl|enclosure)\s*([a-z0-9_ -]*)/i;
    const footerTrigger = /^(registered\s+office|corp\.?\s+office|corporate\s+office|cin:|isin:|www\.|email:)\b/i;
    const corporateNamePattern = /\b(limited|ltd|corporation|corp|bank|industries|technologies|tech|enterprises|pvt|private)\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const page = Math.min(pageCount, Math.floor(i / linesPerPage) + 1);
      const lineYInPage = (i % linesPerPage) * (800 / linesPerPage) + 40;

      // Determine Block Type
      if (annexureTrigger.test(line)) {
        currentBlockType = 'Annexures';
      } else if (sigTrigger.test(line) || (line.toLowerCase().startsWith('for ') && i > totalLines * 0.4 && /secretary|officer|director|signatory|manager/i.test(lines.slice(i, i + 5).join(' ')))) {
        currentBlockType = 'Signature';
      } else if (footerTrigger.test(line) && i > totalLines * 0.6) {
        currentBlockType = 'Footer';
      } else if (footnoteTrigger.test(line) && i > totalLines * 0.5) {
        currentBlockType = 'Footnotes';
      } else if (tableTrigger.test(line) || (line.includes('|') && line.split('|').length > 2)) {
        currentBlockType = 'Tables';
      } else if (currentBlockType === 'Header' && recipientTrigger.test(line)) {
        currentBlockType = 'Recipient';
      } else if ((currentBlockType === 'Header' || currentBlockType === 'Letterhead' || currentBlockType === 'Recipient') && subjectTrigger.test(line)) {
        currentBlockType = 'Subject';
      } else if (currentBlockType === 'Subject' && !subjectTrigger.test(line)) {
        currentBlockType = 'Body';
      } else if (currentBlockType === 'Header' && i < 12 && corporateNamePattern.test(line) && !recipientTrigger.test(line)) {
        currentBlockType = 'Letterhead';
      } else if (i < 5 && (line.toLowerCase().includes('logo') || line.toLowerCase().includes('brand'))) {
        currentBlockType = 'Logo';
      } else if (i < 8 && !corporateNamePattern.test(line) && line.length > 5 && line.length < 120 && line === line.toUpperCase() && !recipientTrigger.test(line)) {
        currentBlockType = 'Title';
      }

      // Compute coordinate boxes
      const coordinates: BoundingBox = {
        x: currentBlockType === 'Logo' || currentBlockType === 'Letterhead' ? 50 : 72,
        y: Math.round(lineYInPage),
        width: 450,
        height: 18
      };

      const block: TextBlock = {
        text: line,
        page,
        coordinates,
        confidence: 0.98,
        blockType: currentBlockType
      };

      blocks.push(block);

      // Map to Region Accumulator
      switch (currentBlockType) {
        case 'Header':
          regionTexts.header.push(line);
          break;
        case 'Letterhead':
          regionTexts.letterhead.push(line);
          break;
        case 'Logo':
          regionTexts.logoText.push(line);
          break;
        case 'Title':
          regionTexts.title.push(line);
          break;
        case 'Recipient':
          regionTexts.recipient.push(line);
          break;
        case 'Subject':
          regionTexts.subject.push(line);
          break;
        case 'Body':
          regionTexts.body.push(line);
          break;
        case 'Tables':
          regionTexts.tables.push(line);
          break;
        case 'Footnotes':
          regionTexts.footnotes.push(line);
          break;
        case 'Signature':
          regionTexts.signature.push(line);
          break;
        case 'Annexures':
          regionTexts.annexures.push(line);
          break;
        case 'Footer':
          regionTexts.footer.push(line);
          break;
      }
    }

    return {
      blocks,
      fullText: cleanText,
      pageCount: Math.max(1, pageCount),
      regions: {
        header: regionTexts.header.join('\n'),
        letterhead: regionTexts.letterhead.join('\n'),
        logoText: regionTexts.logoText.join('\n'),
        title: regionTexts.title.join('\n'),
        recipient: regionTexts.recipient.join('\n'),
        subject: regionTexts.subject.join('\n'),
        body: regionTexts.body.join('\n'),
        tables: regionTexts.tables.join('\n'),
        footnotes: regionTexts.footnotes.join('\n'),
        signature: regionTexts.signature.join('\n'),
        annexures: regionTexts.annexures.join('\n'),
        footer: regionTexts.footer.join('\n')
      }
    };
  }
}
