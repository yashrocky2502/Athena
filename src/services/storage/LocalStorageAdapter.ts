import { UserCompanyPreference } from "../../types";
import { StorageAdapter } from "./StorageAdapter";
import { safeLocalStorage } from "./safeStorage";

export class LocalStorageAdapter implements StorageAdapter {
  private STORAGE_KEY = 'athena_user_preferences';

  private getStore(): Record<string, UserCompanyPreference> {
    const data = safeLocalStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  }

  private saveStore(store: Record<string, UserCompanyPreference>): void {
    safeLocalStorage.setItem(this.STORAGE_KEY, JSON.stringify(store));
  }

  async getPreference(userId: string, companyId: string): Promise<UserCompanyPreference | null> {
    const store = this.getStore();
    return store[`${userId}_${companyId}`] || null;
  }

  async getAllPreferences(userId: string): Promise<UserCompanyPreference[]> {
    const store = this.getStore();
    return Object.values(store).filter(p => p.userId === userId);
  }

  async savePreference(preference: UserCompanyPreference): Promise<void> {
    const store = this.getStore();
    store[`${preference.userId}_${preference.companyId}`] = preference;
    this.saveStore(store);
  }

  async deletePreference(userId: string, companyId: string): Promise<void> {
    const store = this.getStore();
    delete store[`${userId}_${companyId}`];
    this.saveStore(store);
  }
}
