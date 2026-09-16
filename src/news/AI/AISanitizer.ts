/**
 * ATHENA — Centralized AI Error Sanitizer (Phase 2A - F-02)
 *
 * Strips sensitive credentials, API keys, and authorization tokens
 * from diagnostic messages and error traces before logging.
 */

export function sanitizeErrorMessage(rawInput: unknown): string {
  if (!rawInput) return "";
  let sanitized = "";

  if (typeof rawInput === "string") {
    sanitized = rawInput;
  } else if (rawInput instanceof Error) {
    sanitized = rawInput.message || rawInput.toString();
  } else if (typeof rawInput === "object") {
    try {
      sanitized = JSON.stringify(rawInput);
    } catch {
      sanitized = String(rawInput);
    }
  } else {
    sanitized = String(rawInput);
  }

  // 1. Redact configured GEMINI_API_KEY if present in environment
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim().length > 5) {
    sanitized = sanitized.split(envKey).join("[REDACTED_API_KEY]");
  }

  // Also redact GROQ_API_KEY if present in environment
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.trim().length > 5) {
    sanitized = sanitized.split(groqKey).join("[REDACTED_API_KEY]");
  }

  // 2. Redact key query params: e.g. key=AIza..., api_key=..., apiKey=..., token=...
  sanitized = sanitized.replace(/([?&](?:api_?key|key|token)=)[^&\s"'\\]+/gi, "$1[REDACTED_KEY]");

  // 3. Redact Bearer / Basic authorization tokens and Authorization headers
  sanitized = sanitized.replace(/(Bearer\s+)[A-Za-z0-9_\-\.]{8,}/gi, "$1[REDACTED_TOKEN]");
  sanitized = sanitized.replace(/(Authorization:\s*)[^\r\n"'\\]+/gi, "$1[REDACTED_AUTH]");

  // 4. Redact potential Google API keys (AIza...)
  sanitized = sanitized.replace(/\bAIza[0-9A-Za-z-_]{35}\b/g, "[REDACTED_AIZA_KEY]");

  return sanitized;
}
