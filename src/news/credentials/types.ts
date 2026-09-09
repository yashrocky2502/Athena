/**
 * ATHENA NEWS ENGINE — PHASE 20
 * types.ts
 * 
 * Secure Credential Boundary and Broker Connection Types.
 * Strictly guarantees that API keys, secrets, tokens, TOTP secrets, and passwords
 * are isolated and NEVER leak into logs, telemetry, UI state, Telegram messages,
 * database payloads, or error objects.
 */

export type CredentialStatus = 'CONNECTED' | 'NOT_CONNECTED' | 'EXPIRED' | 'INVALID' | 'MISSING';

export type BrokerPlatform = 'ZERODHA' | 'BINANCE' | 'PAPER' | 'ANGEL_ONE' | 'INTERACTIVE_BROKERS';

export interface ZerodhaCredentials {
  apiKey: string;
  apiSecret?: string;
  accessToken?: string;
  requestToken?: string;
  totpSecret?: string;
  userId?: string;
  enctoken?: string;
}

export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
  subAccountId?: string;
  passphrase?: string;
  isTestnet?: boolean;
}

export interface PaperCredentials {
  sandboxKey: string;
  simulatedAccountBalance: number;
}

export type RawBrokerCredentials = ZerodhaCredentials | BinanceCredentials | PaperCredentials | Record<string, any>;

export interface CredentialDescriptor {
  broker: BrokerPlatform;
  status: CredentialStatus;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasAccessToken: boolean;
  maskedIdentifier: string; // e.g. "ZE***123" or "BI***987"
  expiresAt?: string;
  lastValidatedAt?: string;
  environmentSource: 'ENVIRONMENT' | 'ENCRYPTED_VAULT' | 'PAPER_MOCK' | 'NONE';
}
