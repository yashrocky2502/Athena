/**
 * ATHENA — PHASE 26: PERSONAL BROKER CONNECTION + PORTFOLIO INTELLIGENCE HUB
 * BrokerCredentialVault.ts
 * 
 * Secure, Encrypted-at-Rest Credential Storage for Personal Broker Connections.
 * Strictly isolates sensitive tokens, API secrets, and keys.
 * Exposes ONLY masked descriptors to APIs, frontend UI, and telemetry.
 */

import crypto from 'node:crypto';
import { BrokerId, BrokerConnectionStatus, MaskedCredentialDescriptor } from './types.ts';
import { CredentialSanitizer } from '../../credentials/CredentialSanitizer.ts';

export interface RawBrokerSecrets {
  apiKey: string;
  apiSecret?: string;
  requestToken?: string;
  accessToken?: string;
  publicToken?: string;
  userId?: string;
  userType?: string;
  createdAt?: string;
  expiresAt?: string;
}

interface EncryptedVaultRecord {
  broker: BrokerId;
  encryptedData: string; // Base64 ciphertext
  iv: string; // Base64 IV
  authTag: string; // Base64 auth tag
  status: BrokerConnectionStatus;
  maskedAccount: string;
  maskedToken: string;
  updatedAt: string;
}

export class BrokerCredentialVault {
  private static instance: BrokerCredentialVault;
  private vaultKey: Buffer;
  private records: Map<BrokerId, EncryptedVaultRecord> = new Map();

  private constructor() {
    // Derived master vault key from env or dedicated persistent salt
    const masterKeySource = process.env.ATHENA_BROKER_VAULT_KEY || 'ATHENA_CANONICAL_PORTFOLIO_PERSONAL_VAULT_KEY_2026';
    this.vaultKey = crypto.createHash('sha256').update(masterKeySource).digest();
  }

  public static getInstance(): BrokerCredentialVault {
    if (!this.instance) {
      this.instance = new BrokerCredentialVault();
    }
    return this.instance;
  }

  /**
   * Encrypts plaintext string using AES-256-GCM.
   */
  public encrypt(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.vaultKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    return {
      ciphertext: encrypted,
      iv: iv.toString('base64'),
      authTag
    };
  }

  /**
   * Decrypts ciphertext using AES-256-GCM.
   */
  public decrypt(ciphertext: string, ivBase64: string, authTagBase64: string): string {
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.vaultKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Securely saves broker credentials in the vault.
   * Auto-registers raw secrets in the CredentialSanitizer to block leakage into logs.
   */
  public storeCredentials(
    broker: BrokerId,
    secrets: RawBrokerSecrets,
    status: BrokerConnectionStatus = 'CONNECTED'
  ): void {
    // Register secrets into sanitizer boundary
    if (secrets.apiKey) CredentialSanitizer.registerSecret(secrets.apiKey);
    if (secrets.apiSecret) CredentialSanitizer.registerSecret(secrets.apiSecret);
    if (secrets.accessToken) CredentialSanitizer.registerSecret(secrets.accessToken);
    if (secrets.requestToken) CredentialSanitizer.registerSecret(secrets.requestToken);

    // Compute masked descriptors
    const rawUserId = secrets.userId || secrets.apiKey || 'USER';
    const maskedAccount = rawUserId.length > 4 
      ? `****${rawUserId.slice(-4)}` 
      : '****' + rawUserId;
    
    const maskedToken = secrets.accessToken 
      ? `****${secrets.accessToken.slice(-4)}` 
      : (secrets.apiKey ? `****${secrets.apiKey.slice(-4)}` : '********');

    const json = JSON.stringify({
      ...secrets,
      storedAt: new Date().toISOString()
    });

    const { ciphertext, iv, authTag } = this.encrypt(json);

    this.records.set(broker, {
      broker,
      encryptedData: ciphertext,
      iv,
      authTag,
      status,
      maskedAccount,
      maskedToken,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Retrieves decrypted credentials strictly for internal server-side BrokerAdapter use.
   * NEVER pass the output of this method to HTTP responses or React components.
   */
  public getDecryptedCredentials(broker: BrokerId): RawBrokerSecrets | null {
    const record = this.records.get(broker);
    if (!record) return null;

    try {
      const decryptedJson = this.decrypt(record.encryptedData, record.iv, record.authTag);
      return JSON.parse(decryptedJson) as RawBrokerSecrets;
    } catch (err: any) {
      console.error(`[BrokerCredentialVault] Failed to decrypt credentials for ${broker}:`, CredentialSanitizer.sanitizeString(err.message));
      return null;
    }
  }

  /**
   * Updates the connection status of a stored broker record.
   */
  public updateStatus(broker: BrokerId, status: BrokerConnectionStatus): void {
    const record = this.records.get(broker);
    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Returns a sanitized, safe-to-transmit masked descriptor.
   * Guaranteed to contain zero plaintext secrets or tokens.
   */
  public getMaskedDescriptor(broker: BrokerId): MaskedCredentialDescriptor {
    const record = this.records.get(broker);
    if (!record) {
      return {
        broker,
        status: 'DISCONNECTED',
        hasApiKey: false,
        hasApiSecret: false,
        hasAccessToken: false,
        maskedIdentifier: 'Account: Not Connected',
        lastValidatedAt: undefined
      };
    }

    const decrypted = this.getDecryptedCredentials(broker);

    return {
      broker,
      status: record.status,
      hasApiKey: !!decrypted?.apiKey,
      hasApiSecret: !!decrypted?.apiSecret,
      hasAccessToken: !!decrypted?.accessToken,
      maskedIdentifier: `Account: ${record.maskedAccount}, Token: ${record.maskedToken}`,
      lastValidatedAt: record.updatedAt
    };
  }

  /**
   * Rotates the vault encryption key and re-encrypts all stored records.
   */
  public rotate(newMasterKey?: string): void {
    const nextKeySource = newMasterKey || crypto.randomBytes(32).toString('hex');
    const nextVaultKey = crypto.createHash('sha256').update(nextKeySource).digest();

    const decryptedEntries: Array<{ broker: BrokerId; secrets: RawBrokerSecrets; status: BrokerConnectionStatus }> = [];

    for (const [broker] of this.records.entries()) {
      const secrets = this.getDecryptedCredentials(broker);
      const record = this.records.get(broker);
      if (secrets && record) {
        decryptedEntries.push({ broker, secrets, status: record.status });
      }
    }

    // Switch key
    this.vaultKey = nextVaultKey;
    this.records.clear();

    // Re-encrypt
    for (const entry of decryptedEntries) {
      this.storeCredentials(entry.broker, entry.secrets, entry.status);
    }
  }

  /**
   * Securely wipes credentials for a broker from memory.
   */
  public delete(broker: BrokerId): boolean {
    return this.records.delete(broker);
  }

  /**
   * Clears all stored records.
   */
  public clear(): void {
    this.records.clear();
  }
}

export const brokerCredentialVault = BrokerCredentialVault.getInstance();
