import { UserCompanyPreference } from "../types";
import { StorageAdapter } from "./storage/StorageAdapter";
import { LocalStorageAdapter } from "./storage/LocalStorageAdapter";
import { CompanyIdentityResolver } from "../lib/CompanyIdentityResolver";

export class UserPreferenceService {
  private static instance: UserPreferenceService;
  private adapter: StorageAdapter;
  private userId: string = "default_user"; // For now

  private constructor() {
    this.adapter = new LocalStorageAdapter();
  }

  public static getInstance(): UserPreferenceService {
    if (!UserPreferenceService.instance) {
      UserPreferenceService.instance = new UserPreferenceService();
    }
    return UserPreferenceService.instance;
  }

  private async getOrCreatePreference(companyId: string, symbol: string): Promise<UserCompanyPreference> {
    const canonical = CompanyIdentityResolver.getInstance().resolve(symbol || companyId);
    const resolvedSym = canonical.canonicalSymbol || symbol || companyId;
    const pref = await this.adapter.getPreference(this.userId, resolvedSym);
    if (pref) return pref;

    const newPref: UserCompanyPreference = {
      userId: this.userId,
      companyId: resolvedSym,
      symbol: resolvedSym,
      watchlisted: false,
      following: false,
      createdAt: new Date().toISOString(),
      alertPreferences: {
        importantNews: true,
        earnings: true,
        corporateActions: true,
        priceMovement: true,
        aiUpdates: true,
      }
    };
    await this.adapter.savePreference(newPref);
    return newPref;
  }

  async addToWatchlist(companyId: string, symbol: string): Promise<void> {
    const canonical = CompanyIdentityResolver.getInstance().resolve(symbol || companyId);
    const resolvedSym = canonical.canonicalSymbol || symbol || companyId;
    const pref = await this.getOrCreatePreference(resolvedSym, resolvedSym);
    pref.watchlisted = true;
    await this.adapter.savePreference(pref);
  }

  async removeFromWatchlist(companyId: string): Promise<void> {
    const canonical = CompanyIdentityResolver.getInstance().resolve(companyId);
    const resolvedSym = canonical.canonicalSymbol || companyId;
    const pref = await this.adapter.getPreference(this.userId, resolvedSym);
    if (pref) {
      pref.watchlisted = false;
      await this.adapter.savePreference(pref);
    }
  }

  async getWatchlist(): Promise<UserCompanyPreference[]> {
    const all = await this.adapter.getAllPreferences(this.userId);
    const watchlisted = all.filter(p => p.watchlisted);
    return CompanyIdentityResolver.getInstance().migrateWatchlist(watchlisted);
  }

  async followCompany(companyId: string, symbol: string): Promise<void> {
    const pref = await this.getOrCreatePreference(companyId, symbol);
    pref.following = true;
    await this.adapter.savePreference(pref);
  }

  async unfollowCompany(companyId: string): Promise<void> {
    const pref = await this.adapter.getPreference(this.userId, companyId);
    if (pref) {
      pref.following = false;
      await this.adapter.savePreference(pref);
    }
  }

  async getFollowedCompanies(): Promise<UserCompanyPreference[]> {
    const all = await this.adapter.getAllPreferences(this.userId);
    return all.filter(p => p.following);
  }

  async saveAlertPreferences(companyId: string, alertPreferences: any): Promise<void> {
    const pref = await this.adapter.getPreference(this.userId, companyId);
    if (pref) {
      pref.alertPreferences = { ...pref.alertPreferences, ...alertPreferences };
      await this.adapter.savePreference(pref);
    }
  }

  async getAlertPreferences(companyId: string): Promise<any> {
    const pref = await this.adapter.getPreference(this.userId, companyId);
    return pref ? pref.alertPreferences : null;
  }
}
