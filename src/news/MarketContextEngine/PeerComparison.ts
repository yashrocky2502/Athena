import { PeerComparisonBlock } from './MarketContextTypes';
import { CompanyMasterDatabase } from '../NewsEngine/CompanyMasterDatabase';

export class PeerComparison {
  public static analyze(text: string, title: string, firstCompany?: string): PeerComparisonBlock | undefined {
    const combined = `${title} ${text}`;
    const query = firstCompany || combined;

    const peersList = CompanyMasterDatabase.getPeersForCompany(query);
    if (peersList && peersList.length > 0) {
      return {
        company: firstCompany || peersList[0]?.name || 'Target Company',
        peers: peersList.map(p => `${p.name} (${p.symbol})`)
      };
    }

    return undefined;
  }
}
