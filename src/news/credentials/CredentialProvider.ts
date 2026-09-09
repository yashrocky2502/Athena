/**
 * ATHENA NEWS ENGINE — PHASE 20
 * CredentialProvider.ts
 * 
 * Abstract Credential Provider Interface.
 * Encapsulates credential retrieval, validation, descriptor generation, and lifecycle management.
 */

import { BrokerPlatform, RawBrokerCredentials, CredentialDescriptor, CredentialStatus } from './types.ts';

export interface CredentialProvider {
  providerName: string;
  
  /**
   * Retrieves sanitized descriptor safe for UI, telemetry, API, and logging.
   */
  getDescriptor(broker: BrokerPlatform): Promise<CredentialDescriptor>;
  
  /**
   * Checks credential health / validity status without exposing secrets.
   */
  getCredentialStatus(broker: BrokerPlatform): Promise<CredentialStatus>;

  /**
   * Securely returns the raw credentials ONLY for authorized internal broker adapters.
   * Execution engines should NEVER log or expose the return value.
   */
  getRawCredentials<T extends RawBrokerCredentials>(broker: BrokerPlatform): Promise<T | null>;

  /**
   * Securely stores or updates credentials in the provider.
   */
  setCredentials(broker: BrokerPlatform, credentials: RawBrokerCredentials): Promise<boolean>;

  /**
   * Clears or invalidates stored credentials.
   */
  clearCredentials(broker: BrokerPlatform): Promise<boolean>;
}
