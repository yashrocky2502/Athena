import { GroqProvider } from './GroqProvider';

/**
 * Backward compatibility alias for GrokProvider -> GroqProvider
 * Under ATHENA STAGE 4.3 architecture, Groq is the authoritative primary provider.
 * xAI / Grok is strictly removed from the primary/fallback chain.
 */
export class GrokProvider extends GroqProvider {}
