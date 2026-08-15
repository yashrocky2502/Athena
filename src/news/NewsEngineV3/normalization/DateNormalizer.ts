/**
 * ATHENA NEWS ENGINE V3 — DATE NORMALIZER
 * 
 * Standardizes date/time strings into ISO-8601 format with timezone handling for IST (UTC+5:30).
 * Handles Indian news publication formats, relative dates ("5 hours ago"), and custom timestamp formats.
 */

export interface NormalizedDateResult {
  isoString: string;
  displayDate: string;
}

export class DateNormalizer {
  /**
   * Normalizes any input date representation into ISO 8601 and display format.
   */
  public static normalize(inputDate?: string | number | Date): NormalizedDateResult {
    if (!inputDate) {
      const now = new Date();
      return { isoString: now.toISOString(), displayDate: this.formatDisplay(now) };
    }

    if (inputDate instanceof Date) {
      return { isoString: inputDate.toISOString(), displayDate: this.formatDisplay(inputDate) };
    }

    if (typeof inputDate === 'number') {
      const d = new Date(inputDate);
      return { isoString: d.toISOString(), displayDate: this.formatDisplay(d) };
    }

    let str = inputDate.trim();

    // 1. Check relative time e.g. "5 hours ago", "10 mins ago", "1 day ago"
    const relativeMatch = str.match(/(\d+)\s+(min|minute|hour|day|week)s?\s+ago/i);
    if (relativeMatch) {
      const num = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      const now = new Date();

      if (unit.startsWith('min')) now.setMinutes(now.getMinutes() - num);
      else if (unit.startsWith('hour')) now.setHours(now.getHours() - num);
      else if (unit.startsWith('day')) now.setDate(now.getDate() - num);
      else if (unit.startsWith('week')) now.setDate(now.getDate() - num * 7);

      return { isoString: now.toISOString(), displayDate: this.formatDisplay(now) };
    }

    // 2. Strip prefix labels like "Updated:", "Published:", "LAST UPDATED:"
    str = str.replace(/^(updated|published|first published|last updated)\s*:?\s*/i, '');

    // 3. Handle IST suffix ("August 7, 2026 08:30 IST", "07 Aug 2026, 02:15 PM IST")
    let hasIst = false;
    if (/\bIST\b/i.test(str)) {
      hasIst = true;
      str = str.replace(/\bIST\b/gi, '').trim();
    }

    // Attempt JS Date parse
    let parsedDate = new Date(str);

    // 4. Handle DD-MM-YYYY or DD/MM/YYYY
    if (isNaN(parsedDate.getTime())) {
      const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(.*))?$/);
      if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1], 10);
        const month = parseInt(ddmmyyyy[2], 10) - 1;
        const year = parseInt(ddmmyyyy[3], 10);
        parsedDate = new Date(Date.UTC(year, month, day));
      }
    }

    // Fallback to current time if unparseable
    if (isNaN(parsedDate.getTime())) {
      parsedDate = new Date();
    }

    // Adjust for IST if explicitly present
    if (hasIst) {
      // Subtract 5:30 to convert IST time to UTC
      parsedDate = new Date(parsedDate.getTime() - (5.5 * 3600 * 1000));
    }

    return {
      isoString: parsedDate.toISOString(),
      displayDate: this.formatDisplay(parsedDate)
    };
  }

  private static formatDisplay(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStr = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const mins = date.getUTCMinutes().toString().padStart(2, '0');

    return `${monthStr} ${day}, ${year} ${hours}:${mins} UTC`;
  }
}
