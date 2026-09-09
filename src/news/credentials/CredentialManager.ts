/**
 * ATHENA NEWS ENGINE — PHASE 20
 * CredentialManager.ts
 * 
 * Central Credential Orchestrator.
 * Delegates to Environment, Encrypted, or Paper providers.
 * Exposes sanitized descriptors for UI and API endpoints without ever returning raw secrets.
 */

import { CredentialProvider } from './CredentialProvider.ts';
import { EnvironmentCredentialProvider } from './EnvironmentCredentialProvider.ts';
import { EncryptedCredentialProvider } from './EncryptedCredentialProvider.ts';
import { PaperCredentialProvider } from './PaperCredentialProvider.ts';
import { BrokerPlatform, RawBrokerCredentials, CredentialDescriptor, CredentialStatus } from './types.ts';
import { CredentialSanitizer } from './CredentialSanitizer.ts';

export class CredentialManager {
  private static instance: CredentialManager;
  private providers: Map<string, CredentialProvider> = new Map();
  private activeProvider: CredentialProvider;

  private constructor() {
    const envProvider = new EnvironmentCredentialProvider();
    const encProvider = new EncryptedCredentialProvider();
    const paperProvider = new PaperCredentialProvider();

    this.providers.set('ENVIRONMENT', envProvider);
    this.providers.set('ENCRYPTED_VAULT', encProvider);
    this.providers.set('PAPER', paperProvider);

    this.activeProvider = envProvider;
  }

  public static getInstance(): CredentialManager {
    if (!this.instance) {
      this.instance = new CredentialManager();
    }
    return this.instance;
  }

  public setProvider(type: 'ENVIRONMENT' | 'ENCRYPTED_VAULT' | 'PAPER'): void {
    const p = this.providers.get(type);
    if (p) {
      this.activeProvider = p;
    }
  }

  public getActiveProvider(): CredentialProvider {
    return this.activeProvider;
  }

  /**
   * Returns sanitized descriptors for all supported broker platforms.
   * Guaranteed safe to expose in API responses, UI components, and telemetry.
   */
  public async getAllDescriptors(): Promise<CredentialDescriptor[]> {
    const brokers: BrokerPlatform[] = ['PAPER', 'ZERODHA', 'BINANCE'];
    const results: CredentialDescriptor[] = [];
    for (const b of brokers) {
      const desc = await this.activeProvider.getDescriptor(b);
      results.push(CredentialSanitizer.sanitizeObject(desc));
    }
    return results;
  }

  public async getDescriptor(broker: BrokerPlatform): Promise<CredentialDescriptor> {
    const desc = await this.activeProvider.getDescriptor(broker);
    return CredentialSanitizer.sanitizeObject(desc);
  }

  public async getStatus(broker: BrokerPlatform): Promise<CredentialStatus> {
    return this.activeProvider.getCredentialStatus(broker);
  }

  /**
   * Internal broker adapter method. Returns raw credentials only to internal adapters.
   */
  public async getRawCredentials<T extends RawBrokerCredentials>(broker: BrokerPlatform): Promise<T | null> {
    return this.activeProvider.getRawCredentials<T>(broker);
  }

  public async setCredentials(broker: BrokerPlatform, credentials: RawBrokerCredentials): Promise<boolean> {
    return this.activeProvider.setCredentials(broker, credentials);
  }

  public async clearCredentials(broker: BrokerPlatform): Promise<boolean> {
    return this.activeProvider.clearCredentials(broker);
  }
}

export const credentialManager = CredentialManager.getInstance();
