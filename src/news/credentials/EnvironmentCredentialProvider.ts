/**
 * ATHENA NEWS ENGINE — PHASE 20
 * EnvironmentCredentialProvider.ts
 * 
 * Reads broker credentials securely from environment variables.
 * Automatically registers secret values with CredentialSanitizer to guarantee redacting.
 */

import { CredentialProvider } from './CredentialProvider.ts';
import { BrokerPlatform, RawBrokerCredentials, CredentialDescriptor, CredentialStatus, ZerodhaCredentials, BinanceCredentials } from './types.ts';
import { CredentialSanitizer } from './CredentialSanitizer.ts';

export class EnvironmentCredentialProvider implements CredentialProvider {
  public providerName = 'EnvironmentCredentialProvider';

  public async getDescriptor(broker: BrokerPlatform): Promise<CredentialDescriptor> {
    const status = await this.getCredentialStatus(broker);
    let hasApiKey = false;
    let hasApiSecret = false;
    let hasAccessToken = false;
    let masked = 'UNKNOWN';

    if (broker === 'ZERODHA') {
      const apiKey = process.env.KITE_API_KEY || process.env.ZERODHA_API_KEY;
      const apiSecret = process.env.KITE_API_SECRET || process.env.ZERODHA_API_SECRET;
      const accessToken = process.env.KITE_ACCESS_TOKEN || process.env.ZERODHA_ACCESS_TOKEN;
      hasApiKey = Boolean(apiKey);
      hasApiSecret = Boolean(apiSecret);
      hasAccessToken = Boolean(accessToken);
      masked = CredentialSanitizer.createMaskedIdentifier('KITE', apiKey);
    } else if (broker === 'BINANCE') {
      const apiKey = process.env.BINANCE_API_KEY;
      const apiSecret = process.env.BINANCE_API_SECRET;
      hasApiKey = Boolean(apiKey);
      hasApiSecret = Boolean(apiSecret);
      masked = CredentialSanitizer.createMaskedIdentifier('BINANCE', apiKey);
    } else if (broker === 'PAPER') {
      return {
        broker: 'PAPER',
        status: 'CONNECTED',
        hasApiKey: true,
        hasApiSecret: true,
        hasAccessToken: true,
        maskedIdentifier: 'PAPER_MOCK_ENV',
        environmentSource: 'PAPER_MOCK',
        lastValidatedAt: new Date().toISOString()
      };
    }

    return {
      broker,
      status,
      hasApiKey,
      hasApiSecret,
      hasAccessToken,
      maskedIdentifier: masked,
      environmentSource: 'ENVIRONMENT',
      lastValidatedAt: new Date().toISOString()
    };
  }

  public async getCredentialStatus(broker: BrokerPlatform): Promise<CredentialStatus> {
    if (broker === 'PAPER') return 'CONNECTED';

    if (broker === 'ZERODHA') {
      const apiKey = process.env.KITE_API_KEY || process.env.ZERODHA_API_KEY;
      const accessToken = process.env.KITE_ACCESS_TOKEN || process.env.ZERODHA_ACCESS_TOKEN;
      if (!apiKey) return 'MISSING';
      if (!accessToken) return 'NOT_CONNECTED';
      return 'CONNECTED';
    }

    if (broker === 'BINANCE') {
      const apiKey = process.env.BINANCE_API_KEY;
      const apiSecret = process.env.BINANCE_API_SECRET;
      if (!apiKey || !apiSecret) return 'MISSING';
      return 'CONNECTED';
    }

    return 'NOT_CONNECTED';
  }

  public async getRawCredentials<T extends RawBrokerCredentials>(broker: BrokerPlatform): Promise<T | null> {
    if (broker === 'ZERODHA') {
      const apiKey = process.env.KITE_API_KEY || process.env.ZERODHA_API_KEY || '';
      const apiSecret = process.env.KITE_API_SECRET || process.env.ZERODHA_API_SECRET || '';
      const accessToken = process.env.KITE_ACCESS_TOKEN || process.env.ZERODHA_ACCESS_TOKEN || '';
      const userId = process.env.KITE_USER_ID || process.env.ZERODHA_USER_ID || '';
      
      // Auto register with sanitizer
      if (apiKey) CredentialSanitizer.registerSecret(apiKey);
      if (apiSecret) CredentialSanitizer.registerSecret(apiSecret);
      if (accessToken) CredentialSanitizer.registerSecret(accessToken);

      const creds: ZerodhaCredentials = { apiKey, apiSecret, accessToken, userId };
      return creds as unknown as T;
    }

    if (broker === 'BINANCE') {
      const apiKey = process.env.BINANCE_API_KEY || '';
      const apiSecret = process.env.BINANCE_API_SECRET || '';
      if (apiKey) CredentialSanitizer.registerSecret(apiKey);
      if (apiSecret) CredentialSanitizer.registerSecret(apiSecret);

      const creds: BinanceCredentials = { apiKey, apiSecret, isTestnet: process.env.BINANCE_TESTNET === 'true' };
      return creds as unknown as T;
    }

    if (broker === 'PAPER') {
      return { sandboxKey: 'paper_env_key', simulatedAccountBalance: 500000 } as unknown as T;
    }

    return null;
  }

  public async setCredentials(broker: BrokerPlatform, credentials: RawBrokerCredentials): Promise<boolean> {
    // In-memory process.env update for current runtime session
    if (broker === 'ZERODHA') {
      const c = credentials as ZerodhaCredentials;
      if (c.apiKey) {
        process.env.KITE_API_KEY = c.apiKey;
        CredentialSanitizer.registerSecret(c.apiKey);
      }
      if (c.accessToken) {
        process.env.KITE_ACCESS_TOKEN = c.accessToken;
        CredentialSanitizer.registerSecret(c.accessToken);
      }
      if (c.apiSecret) {
        process.env.KITE_API_SECRET = c.apiSecret;
        CredentialSanitizer.registerSecret(c.apiSecret);
      }
      return true;
    }

    if (broker === 'BINANCE') {
      const c = credentials as BinanceCredentials;
      if (c.apiKey) {
        process.env.BINANCE_API_KEY = c.apiKey;
        CredentialSanitizer.registerSecret(c.apiKey);
      }
      if (c.apiSecret) {
        process.env.BINANCE_API_SECRET = c.apiSecret;
        CredentialSanitizer.registerSecret(c.apiSecret);
      }
      return true;
    }

    return false;
  }

  public async clearCredentials(broker: BrokerPlatform): Promise<boolean> {
    if (broker === 'ZERODHA') {
      delete process.env.KITE_API_KEY;
      delete process.env.ZERODHA_API_KEY;
      delete process.env.KITE_ACCESS_TOKEN;
      delete process.env.ZERODHA_ACCESS_TOKEN;
      delete process.env.KITE_API_SECRET;
      delete process.env.ZERODHA_API_SECRET;
      return true;
    }
    if (broker === 'BINANCE') {
      delete process.env.BINANCE_API_KEY;
      delete process.env.BINANCE_API_SECRET;
      return true;
    }
    return true;
  }
}
