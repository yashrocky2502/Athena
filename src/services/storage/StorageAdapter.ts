import { UserCompanyPreference } from "../../types";

export interface StorageAdapter {
  getPreference(userId: string, companyId: string): Promise<UserCompanyPreference | null>;
  getAllPreferences(userId: string): Promise<UserCompanyPreference[]>;
  savePreference(preference: UserCompanyPreference): Promise<void>;
  deletePreference(userId: string, companyId: string): Promise<void>;
}
