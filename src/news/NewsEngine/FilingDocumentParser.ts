export interface DocumentRegions {
  header: string;
  letterhead: string;
  recipient: string;
  subject: string;
  body: string;
  tables: string;
  signature: string;
  footer: string;
}

export class FilingDocumentParser {
  /**
   * Logical Filing Region Parser
   * Splits filing text into 8 distinct structural sections:
   * HEADER, LETTERHEAD, RECIPIENT, SUBJECT, BODY, TABLES, SIGNATURE, FOOTER
   */
  public static parseDocumentRegions(text: string): DocumentRegions {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let headerLines: string[] = [];
    let letterheadLines: string[] = [];
    let recipientLines: string[] = [];
    let subjectLines: string[] = [];
    let bodyLines: string[] = [];
    let tableLines: string[] = [];
    let signatureLines: string[] = [];
    let footerLines: string[] = [];

    let currentRegion: 'header' | 'letterhead' | 'recipient' | 'subject' | 'body' | 'tables' | 'signature' | 'footer' = 'header';

    const sigTrigger = /^(yours\s+(faithfully|sincerely|truly)|regards|warm\s+regards|best\s+regards|thanks|thanking\s+you|sd\/-|sd\/|\[sd\/-\]|authorised\s+signatory|authorized\s+signatory|company\s+secretary|compliance\s+officer|managing\s+director|chief\s+financial\s+officer|cfo|chief\s+executive\s+officer|ceo)\b/i;

    const recipientTrigger = /^(to,|the\s+(manager|general\s+manager|head|secretary)|listing\s+department|national\s+stock\s+exchange|bse\s+limited|sebi)\b/i;

    const subjectTrigger = /^(sub:|subject:|re:|ref:|intimation\s+under|outcome\s+of)\b/i;

    const footerTrigger = /^(registered\s+office|corp\.?\s+office|cin:|isin:|www\.|email:)\b/i;

    const tableTrigger = /([|]|\b(particulars|rs\.?\s+in\s+(lakhs|crores)|quarter\s+ended|standalone|consolidated|audited|unaudited)\b)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Signature trigger check
      if (sigTrigger.test(line) || (line.toLowerCase().startsWith('for ') && i > lines.length * 0.4 && /secretary|officer|director|signatory|manager/i.test(lines.slice(i, i + 5).join(' ')))) {
        currentRegion = 'signature';
      } else if (currentRegion === 'header' && recipientTrigger.test(line)) {
        currentRegion = 'recipient';
      } else if ((currentRegion === 'header' || currentRegion === 'letterhead' || currentRegion === 'recipient') && subjectTrigger.test(line)) {
        currentRegion = 'subject';
      } else if (currentRegion === 'subject' && !subjectTrigger.test(line)) {
        currentRegion = 'body';
      } else if (currentRegion === 'header' && i < 10 && /\b(limited|ltd|corporation|corp|bank|industries|technologies|tech|enterprises|pvt|private)\b/i.test(line) && !recipientTrigger.test(line)) {
        currentRegion = 'letterhead';
        letterheadLines.push(line);
        continue;
      }

      if (footerTrigger.test(line) && i > lines.length * 0.6) {
        currentRegion = 'footer';
        footerLines.push(line);
        continue;
      }

      if (currentRegion === 'body' && tableTrigger.test(line) && (line.includes('|') || /\d+\.\d+/.test(line))) {
        tableLines.push(line);
      }

      switch (currentRegion) {
        case 'header':
          headerLines.push(line);
          break;
        case 'letterhead':
          letterheadLines.push(line);
          break;
        case 'recipient':
          recipientLines.push(line);
          break;
        case 'subject':
          subjectLines.push(line);
          break;
        case 'body':
          bodyLines.push(line);
          break;
        case 'signature':
          signatureLines.push(line);
          break;
        case 'footer':
          footerLines.push(line);
          break;
      }
    }

    return {
      header: headerLines.join('\n'),
      letterhead: letterheadLines.join('\n'),
      recipient: recipientLines.join('\n'),
      subject: subjectLines.join('\n'),
      body: bodyLines.join('\n'),
      tables: tableLines.join('\n'),
      signature: signatureLines.join('\n'),
      footer: footerLines.join('\n')
    };
  }
}
