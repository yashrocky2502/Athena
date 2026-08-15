export interface MetricDirectionResult {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  statusText: string;
}

export class MetricResolver {
  /**
   * Safe parser to turn currency/unit strings into numeric values for safe comparisons.
   */
  public static parseNumericValue(valText: string): number | null {
    if (!valText) return null;
    let clean = valText.toLowerCase().replace(/prev:?/i, '').trim();
    
    // Check if it's a zero or empty state
    if (clean === '—' || clean === '-' || clean === 'nil' || clean === 'null') {
      return 0;
    }

    // Capture first contiguous number with decimal point
    const match = clean.match(/([\-]?\d+(?:[\d,.]*\d)?)/);
    if (!match) return null;

    let num = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(num)) return null;

    // Apply scaling factor based on financial unit
    if (clean.includes('cr') || clean.includes('crore')) {
      num *= 10000000;
    } else if (clean.includes('lakh')) {
      num *= 100000;
    } else if (clean.includes('bn') || clean.includes('billion')) {
      num *= 1000000000;
    } else if (clean.includes('million') || /\b(m)\b/.test(clean)) {
      num *= 1000000;
    }

    return num;
  }

  /**
   * Central authoritative metric direction and status resolver.
   */
  public static resolve(current: string, previous?: string, change?: string): MetricDirectionResult {
    let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';

    const currentLower = current ? current.toLowerCase() : '';
    const previousLower = previous ? previous.toLowerCase() : '';
    const changeLower = change ? change.toLowerCase() : '';

    // 1. Check for explicit unchanged indicator
    if (changeLower.includes('unchanged') || changeLower.includes('flat') || changeLower === '0' || changeLower === '0%') {
      return { direction: 'NEUTRAL', statusText: 'Unchanged' };
    }

    // 2. Check explicit signs/words in Change parameter first
    if (change) {
      if (change.includes('+') || change.includes('▲') || /\b(rose|grew|up|jumped|surged|increased|expanded|rises|improved|higher|gained|climbed|boosted)\b/i.test(change)) {
        direction = 'UP';
      } else if (change.includes('-') || change.includes('▼') || /\b(fell|dropped|declined|contracted|down|lower|sank|slipped|plunged|decreased)\b/i.test(change)) {
        direction = 'DOWN';
      }
    }

    // 3. Check explicit signs/words in Current parameter if direction still neutral
    if (direction === 'NEUTRAL' && current) {
      if (current.includes('+') || current.includes('▲') || /\b(rose|grew|up|jumped|surged|increased|expanded|rises|improved|higher)\b/i.test(current)) {
        direction = 'UP';
      } else if (current.includes('-') || current.includes('▼') || /\b(fell|dropped|declined|contracted|down|lower|sank|slipped|plunged|decreased)\b/i.test(current)) {
        direction = 'DOWN';
      }
    }

    // 4. Compare current vs previous values mathematically if we have both and direction is still neutral
    if (direction === 'NEUTRAL') {
      const currentNum = this.parseNumericValue(current);
      const prevNum = previous ? this.parseNumericValue(previous) : null;

      if (currentNum !== null && prevNum !== null) {
        if (currentNum > prevNum) {
          direction = 'UP';
        } else if (currentNum < prevNum) {
          direction = 'DOWN';
        } else {
          direction = 'NEUTRAL';
        }
      }
    }

    // Extract clean value of change (remove signs and arrow symbols for statusText)
    let cleanChangeText = '';
    const sourceText = change || current || '';
    
    // Find numeric pattern with percentage or percentage points or bps
    const pctMatch = sourceText.match(/(\d+(?:\.\d+)?\s*(?:%|percentage points|bps|cr|crore|lakh|bn|m|billion|million)?)/i);
    if (pctMatch) {
      cleanChangeText = pctMatch[1].trim();
    } else {
      // Stripping signs, arrows and leading spaces
      cleanChangeText = sourceText.replace(/[+\-▲▼]/g, '').trim();
    }

    let statusText = 'Unchanged';
    if (direction === 'UP') {
      statusText = cleanChangeText ? `Increased by ${cleanChangeText}` : 'Increased';
    } else if (direction === 'DOWN') {
      statusText = cleanChangeText ? `Decreased by ${cleanChangeText}` : 'Decreased';
    }

    return { direction, statusText };
  }
}
