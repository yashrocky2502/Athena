/**
 * ATHENA NEWS ENGINE — PHASE 20
 * PaperCredentialProvider.ts
 * 
 * Default mock / simulation credential provider for Paper trading.
 */

import { CredentialProvider } from './CredentialProvider.ts';
import { BrokerPlatform, RawBrokerCredentials, CredentialDescriptor, CredentialStatus, PaperCredentials } from './types.ts';

export class PaperCredentialProvider implements CredentialProvider {
  public providerName = 'PaperCredentialProvider';

  public async getDescriptor(broker: BrokerPlatform): Promise<CredentialDescriptor> {
    return {
      broker: 'PAPER',
      status: 'CONNECTED',
      hasApiKey: true,
      hasApiSecret: true,
      hasAccessToken: true,
      maskedIdentifier: 'PAPER_SIM_OK',
      environmentSource: 'PAPER_MOCK',
      lastValidatedAt: new Date().toISOString()
    };
  }

  public async getCredentialStatus(broker: BrokerPlatform): Promise<CredentialStatus> {
    return 'CONNECTED';
  }

  public async getRawCredentials<T extends RawBrokerCredentials>(broker: BrokerPlatform): Promise<T | null> {
    const creds: PaperCredentials = {
      sandboxKey: 'athena_paper_simulation_key_v20',
      simulatedAccountBalance: 500000
    };
    return creds as unknown as T;
  }

  public async setCredentials(broker: BrokerPlatform, credentials: RawBrokerCredentials): Promise<boolean> {
    return true;
  }

  public async clearCredentials(broker: BrokerPlatform): Promise<boolean> {
    return true;
  }
}
