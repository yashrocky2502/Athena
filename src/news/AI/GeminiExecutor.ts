/**
 * ATHENA — Centralized Gemini Execution & Failover Module (Phase 2B)
 *
 * Authoritative, server-safe executor for Google Gemini API calls via @google/genai.
 * Enforces model cascade, response validation, per-model JSON validation,
 * retryable error classification, timeout safety, and credential sanitization.
 */

import { GoogleGenAI } from "@google/genai";
import { AIModelConfig } from "./AIModelConfig";
import { sanitizeErrorMessage } from "./AISanitizer";

export interface OutputValidationResult<T = any> {
  isValid: boolean;
  reason?: string;
  data?: T;
}

export interface ExecuteGeminiOptions<T = any> {
  contents: any;
  config?: any;
  /**
   * Backwards-compatible parameter. Does NOT override the authoritative production cascade.
   */
  defaultModel?: string;
  /**
   * Explicit test-only candidate override for mock test environments.
   * In production, this remains undefined so AIModelConfig.gemini.candidates is authoritative.
   */
  testOnlyCandidateOverride?: string[];
  callerName?: string;
  attemptTimeoutMs?: number;
  totalTimeoutMs?: number;
  applyBackoff?: boolean;
  validateOutput?: (text: string, rawResponse: any) => OutputValidationResult<T>;
}

export interface GeminiExecutionResult<T = any> {
  response: any;
  text: string;
  data?: T;
  modelUsed: string;
  attempts: number;
}

export interface GeminiResponseValidation {
  isValid: boolean;
  reason?: string;
  text?: string;
}

/**
 * Validates structural integrity of a Gemini response.
 * Checks candidate presence, finish reason (safety/recitation blocks), and non-empty text.
 */
export function validateGeminiResponse(response: any): GeminiResponseValidation {
  if (!response || typeof response !== "object") {
    return { isValid: false, reason: "Response is null or not an object" };
  }

  const candidates = response.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { isValid: false, reason: "Response has no candidates" };
  }

  const firstCandidate = candidates[0];
  if (!firstCandidate) {
    return { isValid: false, reason: "First candidate is null or undefined" };
  }

  const finishReason = String(firstCandidate.finishReason || "").toUpperCase();
  const blockedFinishReasons = ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"];
  if (blockedFinishReasons.includes(finishReason)) {
    return { isValid: false, reason: `Blocked finish reason: ${finishReason}` };
  }

  let extractedText = typeof response.text === "string" ? response.text : "";
  if (!extractedText && firstCandidate.content?.parts && Array.isArray(firstCandidate.content.parts)) {
    extractedText = firstCandidate.content.parts
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("");
  }

  if (!extractedText || extractedText.trim().length === 0) {
    return { isValid: false, reason: "Empty or whitespace-only response text" };
  }

  return { isValid: true, text: extractedText };
}

/**
 * Classifies an error as retryable (transient/failover-eligible) or non-retryable (fail-fast).
 */
export function isRetryableGeminiError(err: any): boolean {
  if (!err) return false;

  // Unusable response from Gemini validation (e.g. empty text, safety finish reason, malformed JSON) is retryable across models
  if (err.isUnusableResponse || (typeof err.message === "string" && err.message.startsWith("UNUSABLE_RESPONSE:"))) {
    return true;
  }

  const rawStatus = err.status ?? err.statusCode ?? err.error?.code ?? err.response?.status;
  const status = typeof rawStatus === "number" ? rawStatus : Number(rawStatus);
  const code = String(err.code || "");
  const name = String(err.name || "");
  const msg = String(err.message || err);

  // 1. Permanent / non-retryable failures: HTTP 400, 401, 403, invalid keys, invalid argument -> FAIL FAST
  if (status === 400 || status === 401 || status === 403) {
    return false;
  }
  if (
    msg.includes("INVALID_ARGUMENT") ||
    msg.includes("UNAUTHENTICATED") ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("API_KEY_INVALID") ||
    msg.includes("API key not valid") ||
    msg.includes("API key expired") ||
    msg.includes("401 Unauthorized") ||
    msg.includes("401") ||
    msg.includes("403 Forbidden") ||
    msg.includes("403") ||
    (msg.includes("400") && !msg.includes("404"))
  ) {
    return false;
  }

  // 2. Retryable HTTP status codes
  if ([404, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  // 3. Retryable error codes / names (transient network / socket / timeout)
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EAI_AGAIN" ||
    name === "AbortError" ||
    name === "TimeoutError"
  ) {
    return true;
  }

  // 4. Retryable message signatures
  const isQuota =
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("quota exceeded") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.toLowerCase().includes("too many requests");

  const isNotFound =
    msg.includes("404") ||
    msg.includes("NOT_FOUND") ||
    msg.toLowerCase().includes("model not found") ||
    msg.toLowerCase().includes("not found");

  const isUnavailableOrServer =
    msg.includes("503") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("UNAVAILABLE") ||
    msg.toLowerCase().includes("service unavailable") ||
    msg.includes("INTERNAL") ||
    msg.toLowerCase().includes("internal server error") ||
    msg.toLowerCase().includes("bad gateway") ||
    msg.toLowerCase().includes("gateway timeout");

  const isNetwork =
    msg.toLowerCase().includes("fetch failed") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("EAI_AGAIN") ||
    msg.includes("AbortError") ||
    msg.toLowerCase().includes("socket hang up") ||
    msg.toLowerCase().includes("network timeout");

  return isQuota || isNotFound || isUnavailableOrServer || isNetwork;
}

export interface CandidateModelOptions {
  /**
   * Explicit test-only candidate override for mock test environments.
   * In production, this must remain undefined so that AIModelConfig.gemini.candidates
   * is strictly authoritative.
   */
  testOnlyCandidateOverride?: string[];
  /**
   * Backwards-compatible parameter. Does NOT override the authoritative production cascade.
   */
  defaultModel?: string;
}

/**
 * Returns candidate models strictly derived from the authoritative AIModelConfig.gemini.candidates.
 *
 * Authoritative production cascade:
 * 1. AIModelConfig.gemini.candidates[0] ("gemini-3.7-flash")
 * 2. AIModelConfig.gemini.candidates[1] ("gemini-3.1-flash-lite")
 *
 * Environment variables (e.g. process.env.GEMINI_MODEL) and legacy defaultModel parameters
 * CANNOT silently override this production cascade.
 *
 * If a test explicitly provides testOnlyCandidateOverride, that override is used (for mock test harnesses).
 * Duplicate candidates are handled deterministically, retaining the first occurrence.
 */
export function getCandidateModels(options?: string | CandidateModelOptions): string[] {
  let candidateSource: readonly string[] = AIModelConfig.gemini.candidates;

  if (options && typeof options === "object" && Array.isArray(options.testOnlyCandidateOverride)) {
    candidateSource = options.testOnlyCandidateOverride;
  }

  const unique: string[] = [];
  for (const item of candidateSource) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed.length > 0 && !unique.includes(trimmed)) {
        unique.push(trimmed);
      }
    }
  }

  return unique;
}

/**
 * Executes a Gemini request with automatic candidate failover, timeout protection,
 * per-model output/schema validation, and credential-sanitized logging.
 */
export async function executeGeminiWithFailover<T = any>(
  aiClient: GoogleGenAI,
  options: ExecuteGeminiOptions<T>
): Promise<GeminiExecutionResult<T>> {
  if (!aiClient || !aiClient.models) {
    throw new Error("Gemini AI client is not available or uninitialized");
  }

  const caller = options.callerName || "GeminiExecutor";
  const candidateModels = getCandidateModels({
    testOnlyCandidateOverride: options.testOnlyCandidateOverride,
    defaultModel: options.defaultModel
  });
  const attemptTimeoutMs = options.attemptTimeoutMs ?? 8000;
  const totalTimeoutMs = options.totalTimeoutMs ?? 25000;
  const startTime = Date.now();

  let lastError: any = null;
  let attempts = 0;

  for (const modelCandidate of candidateModels) {
    if (Date.now() - startTime > totalTimeoutMs) {
      const totalTimeoutErr: any = new Error(`[${caller}] Total execution timeout exceeded (${totalTimeoutMs}ms)`);
      totalTimeoutErr.code = "ETIMEDOUT";
      throw totalTimeoutErr;
    }

    attempts++;
    const attemptController = new AbortController();
    let timerId: NodeJS.Timeout | null = null;
    let forwardAbortListener: (() => void) | null = null;

    if (options.config?.abortSignal) {
      if (options.config.abortSignal.aborted) {
        attemptController.abort(options.config.abortSignal.reason);
      } else {
        forwardAbortListener = () => {
          attemptController.abort(options.config.abortSignal.reason);
        };
        options.config.abortSignal.addEventListener("abort", forwardAbortListener, { once: true });
      }
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
          const timeoutErr: any = new Error(`[${caller}] Request timed out after ${attemptTimeoutMs}ms on model ${modelCandidate}`);
          timeoutErr.code = "ETIMEDOUT";
          timeoutErr.name = "TimeoutError";
          // Officially supported by @google/genai via GenerateContentConfig.abortSignal:
          // abort in-flight request so underlying HTTP request is not left running in the background.
          attemptController.abort(timeoutErr);
          reject(timeoutErr);
        }, attemptTimeoutMs);
      });

      // Pass abortSignal to @google/genai via config.abortSignal (officially supported in GenerateContentConfig)
      const callConfig = {
        ...options.config,
        abortSignal: attemptController.signal
      };

      const apiPromise = aiClient.models.generateContent({
        model: modelCandidate,
        contents: options.contents,
        config: callConfig
      });

      // Attach catch handler to apiPromise to prevent unhandled rejection if it rejects after timeout race
      apiPromise.catch(() => {});

      const rawResponse: any = await Promise.race([apiPromise, timeoutPromise]);

      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (forwardAbortListener && options.config?.abortSignal) {
        options.config.abortSignal.removeEventListener("abort", forwardAbortListener);
        forwardAbortListener = null;
      }

      // Step 1: Raw response structural validation
      const validation = validateGeminiResponse(rawResponse);
      if (!validation.isValid) {
        const unusableErr: any = new Error(`UNUSABLE_RESPONSE: ${validation.reason}`);
        unusableErr.isUnusableResponse = true;
        throw unusableErr;
      }

      const extractedText = validation.text || "";

      // Step 2: Per-model output / JSON schema validation (if provided by caller)
      let validatedData: T | undefined = undefined;
      if (options.validateOutput) {
        const outputValidation = options.validateOutput(extractedText, rawResponse);
        if (!outputValidation.isValid) {
          const unusableErr: any = new Error(`UNUSABLE_RESPONSE: ${outputValidation.reason || "Output validation failed"}`);
          unusableErr.isUnusableResponse = true;
          throw unusableErr;
        }
        validatedData = outputValidation.data;
      }

      // Requirement 3: Ensure the controller is also aborted/cleaned up when the request completes normally
      if (!attemptController.signal.aborted) {
        attemptController.abort();
      }

      return {
        response: rawResponse,
        text: extractedText,
        data: validatedData,
        modelUsed: modelCandidate,
        attempts
      };
    } catch (err: any) {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (forwardAbortListener && options.config?.abortSignal) {
        options.config.abortSignal.removeEventListener("abort", forwardAbortListener);
        forwardAbortListener = null;
      }
      // Ensure the attempt controller is aborted/cleaned up on failure/timeout as well
      if (!attemptController.signal.aborted) {
        attemptController.abort(err);
      }

      lastError = err;
      const safeMsg = sanitizeErrorMessage(String(err?.message || err));
      console.warn(`[${caller}] Model ${modelCandidate} failed (${safeMsg}). Trying next candidate model...`);

      if (!isRetryableGeminiError(err)) {
        // Non-retryable error (400, 401, 403, invalid key) -> FAIL FAST immediately
        break;
      }

      if (options.applyBackoff !== false && attempts < candidateModels.length) {
        // Brief jittered backoff before next candidate attempt
        const jitterMs = 30 + Math.floor(Math.random() * 40);
        await new Promise((resolve) => setTimeout(resolve, jitterMs));
      }
    }
  }

  throw lastError || new Error(`[${caller}] All Gemini candidate models failed`);
}
