/**
 * ATHENA NEWS ENGINE — PHASE 20
 * CredentialSanitizer.ts
 * 
 * Strict Redaction & Sanitization Boundary.
 * Ensures zero credential leakage into logs, telemetry, UI, Telegram alerts,
 * database payloads, errors, and JSON serialization.
 */

const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key/i,
  /api[_-]?secret/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /request[_-]?token/i,
  /totp[_-]?secret/i,
  /auth[_-]?token/i,
  /bearer/i,
  /password/i,
  /(?:api_?secret|client_?secret|jwt_?secret|totp_?secret|^secret$)/i,
  /private[_-]?key/i,
  /enctoken/i,
  /session[_-]?token/i,
  /credential/i
];

export class CredentialSanitizer {
  private static registeredSecretValues: Set<string> = new Set();

  /**
   * Registers a sensitive secret value to ensure exact substring matching and redaction across all logs.
   */
  public static registerSecret(secret: string): void {
    if (secret && typeof secret === 'string' && secret.trim().length > 3) {
      this.registeredSecretValues.add(secret.trim());
    }
  }

  /**
   * Redacts all registered secrets and sensitive patterns from a raw string.
   */
  public static redactString(input: string): string {
    if (!input || typeof input !== 'string') return '';
    let result = input;

    // 1. Explicit registered secret substitution
    for (const secret of this.registeredSecretValues) {
      if (secret.length > 0 && result.includes(secret)) {
        result = result.split(secret).join('[REDACTED_SECRET]');
      }
    }

    // 2. Regex pattern substitution
    result = result.replace(/(api_?key[:=]\s*["']?)[^"'\s,;]+/gi, '$1[REDACTED_API_KEY]');
    result = result.replace(/(api_?secret[:=]\s*["']?)[^"'\s,;]+/gi, '$1[REDACTED_API_SECRET]');
    result = result.replace(/(access_?token[:=]\s*["']?)[^"'\s,;]+/gi, '$1[REDACTED_ACCESS_TOKEN]');
    result = result.replace(/(totp_?secret[:=]\s*["']?)[^"'\s,;]+/gi, '$1[REDACTED_TOTP]');
    result = result.replace(/(enctoken[:=]\s*["']?)[^"'\s,;]+/gi, '$1[REDACTED_ENCTOKEN]');
    result = result.replace(/(password[:=]\s*["']?)[^"'\s,;]+/gi, '$1[REDACTED_PASSWORD]');

    return result;
  }

  public static sanitizeString(input: string): string {
    return this.redactString(input);
  }

  public static sanitizePayload<T>(input: T): T {
    return this.sanitizeObject(input);
  }

  /**
   * Recursively sanitizes any object or array, masking sensitive fields.
   */
  public static sanitizeObject<T>(input: T, seen: WeakSet<object> = new WeakSet()): T {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'string') {
      return this.redactString(input) as unknown as T;
    }

    if (typeof input !== 'object') {
      return input;
    }

    // Prevent circular reference crashes
    if (seen.has(input as object)) {
      return '[CIRCULAR_REF]' as unknown as T;
    }
    seen.add(input as object);

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeObject(item, seen)) as unknown as T;
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
      if (isSensitiveKey && value !== undefined && value !== null) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitizeObject(value, seen);
      }
    }

    return sanitized as T;
  }

  /**
   * Safe JSON.stringify that automatically sanitizes all properties and values.
   */
  public static safeJsonStringify(obj: any, space?: number): string {
    try {
      const sanitized = this.sanitizeObject(obj);
      const rawString = JSON.stringify(sanitized, null, space);
      return this.redactString(rawString);
    } catch (e: any) {
      return `{"error": "Sanitization stringify failure: ${this.redactString(e?.message || 'unknown')}"}`;
    }
  }

  /**
   * Masks a raw key into a short display identifier, e.g. "abcd...1234"
   */
  public static maskIdentifier(key?: string): string {
    if (!key || key.length < 8) return '****';
    const start = key.slice(0, 4);
    const end = key.slice(-4);
    return `${start}...${end}`;
  }

  /**
   * Creates a safe masked identifier with broker prefix, e.g. "ZERODHA_abcd...1234"
   */
  public static createMaskedIdentifier(prefix: string, key?: string): string {
    if (!key || key.length < 4) return `${prefix}_UNKNOWN`;
    return `${prefix}_${this.maskIdentifier(key)}`;
  }
}
