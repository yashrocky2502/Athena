import { FollowedCompany } from "../types";
import { safeLocalStorage } from "./storage/safeStorage";

export class FollowService {
  private static instance: FollowService;
  private followedCompanies: Map<string, FollowedCompany> = new Map();
  private readonly STORAGE_KEY = "athena_followed_companies";

  private constructor() {
    this.load();
  }

  public static getInstance(): FollowService {
    if (!FollowService.instance) {
      FollowService.instance = new FollowService();
    }
    return FollowService.instance;
  }

  private load() {
    const saved = safeLocalStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const data: FollowedCompany[] = JSON.parse(saved);
        data.forEach(c => this.followedCompanies.set(c.symbol, c));
      } catch (e) {
        console.error("Failed to load followed companies", e);
      }
    }
  }

  private save() {
    safeLocalStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(this.followedCompanies.values())));
  }

  public follow(symbol: string) {
    const s = symbol.toUpperCase();
    if (!this.followedCompanies.has(s)) {
      this.followedCompanies.set(s, {
        symbol: s,
        followedAt: new Date().toISOString(),
        notificationsEnabled: true
      });
      this.save();
    }
  }

  public unfollow(symbol: string) {
    const s = symbol.toUpperCase();
    if (this.followedCompanies.has(s)) {
      this.followedCompanies.delete(s);
      this.save();
    }
  }

  public isFollowing(symbol: string): boolean {
    return this.followedCompanies.has(symbol.toUpperCase());
  }

  public getFollowedSymbols(): string[] {
    return Array.from(this.followedCompanies.keys());
  }
}
