export type SessionState = 'PRE_MARKET' | 'LIVE_SESSION' | 'POST_MARKET' | 'WEEKEND' | 'MARKET_HOLIDAY' | 'UNKNOWN';

export class MarketSessionEngine {
  private static holidays = new Set<string>([
    '2026-01-26', // Republic Day
    '2026-03-06', // Holi
    '2026-04-02', // Mahavir Jayanti
    '2026-04-14', // Ambedkar Jayanti
    '2026-05-01', // Maharashtra Day
    '2026-08-15', // Independence Day
    '2026-10-02', // Gandhi Jayanti
    '2026-11-09', // Diwali
    '2026-12-25', // Christmas
  ]);

  public static isHoliday(dateStr: string): boolean {
    return this.holidays.has(dateStr);
  }

  public static registerHoliday(dateStr: string): void {
    this.holidays.add(dateStr);
  }

  public static determineSession(utcTimeStr: string, exchange: string = 'NSE'): SessionState {
    const d = new Date(utcTimeStr);
    if (isNaN(d.getTime())) return 'UNKNOWN';

    // Convert UTC to IST (+5.5 hours)
    const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    
    // Check Weekend
    // Using UTC day getter on the offset date to correctly represent IST day
    const day = istTime.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) {
      return 'WEEKEND';
    }

    // Check Holiday
    const datePart = istTime.toISOString().split('T')[0];
    if (this.isHoliday(datePart)) {
      return 'MARKET_HOLIDAY';
    }

    // Check Trading Hours (09:15 to 15:30 IST)
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;

    // 09:15 = 555 mins
    // 15:30 = 930 mins
    if (totalMinutes < 555) {
      return 'PRE_MARKET';
    } else if (totalMinutes >= 555 && totalMinutes <= 930) {
      return 'LIVE_SESSION';
    } else {
      return 'POST_MARKET';
    }
  }

  /**
   * Helper to convert UTC string to formatted IST string
   */
  public static convertUtcToIstString(utcStr: string): string {
    const d = new Date(utcStr);
    if (isNaN(d.getTime())) return 'N/A';
    const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const dateStr = istTime.toISOString().split('T')[0];
    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    return `${dateStr} ${hours}:${minutes} IST`;
  }
}
export default MarketSessionEngine;
