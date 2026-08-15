import { Watchlist, WatchlistItem } from "../types";
import { supabaseAdmin } from "../lib/supabase";
import { safeLocalStorage } from "./storage/safeStorage";

export class WatchlistService {
  private static instance: WatchlistService;
  private watchlists: Watchlist[] = [];
  private readonly STORAGE_KEY = "athena_watchlists";

  private constructor() {
    this.load();
    if (this.watchlists.length === 0) {
      this.createDefaultWatchlist();
    }
  }

  public static getInstance(): WatchlistService {
    if (!WatchlistService.instance) {
      WatchlistService.instance = new WatchlistService();
    }
    return WatchlistService.instance;
  }

  private async load() {
    const saved = safeLocalStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.watchlists = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load watchlists from localStorage", e);
        this.watchlists = [];
      }
    }

    // Sync from Supabase
    try {
      const { data, error } = await supabaseAdmin
        .from('watchlists')
        .select('*');

      if (!error && data && data.length > 0) {
        console.log(`[WatchlistService] Synced ${data.length} items from Supabase.`);
        // Simple merge/sync logic: Add missing symbols to the default watchlist
        const defaultWL = this.watchlists.find(w => w.id === "default");
        if (defaultWL) {
          data.forEach(d => {
            if (!defaultWL.items.some(i => i.symbol === d.symbol)) {
              defaultWL.items.push({
                symbol: d.symbol,
                isPinned: false,
                addedAt: d.created_at
              });
            }
          });
          this.saveLocally();
        }
      }
    } catch (e) {
      console.error("Failed to sync watchlists from Supabase", e);
    }
  }

  private saveLocally() {
    safeLocalStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.watchlists));
  }

  private createDefaultWatchlist() {
    const defaultWatchlist: Watchlist = {
      id: "default",
      name: "My Portfolio",
      items: [
        { symbol: "RELIANCE", isPinned: true, addedAt: new Date().toISOString() },
        { symbol: "TCS", isPinned: false, addedAt: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString()
    };
    this.watchlists = [defaultWatchlist];
    this.saveLocally();
  }

  public getWatchlists(): Watchlist[] {
    return [...this.watchlists];
  }

  public createWatchlist(name: string): Watchlist {
    const newWatchlist: Watchlist = {
      id: Math.random().toString(36).substring(7),
      name,
      items: [],
      createdAt: new Date().toISOString()
    };
    this.watchlists.push(newWatchlist);
    this.saveLocally();
    return newWatchlist;
  }

  public removeWatchlist(id: string) {
    this.watchlists = this.watchlists.filter(w => w.id !== id);
    this.saveLocally();
  }

  public async addToWatchlist(watchlistId: string, symbol: string) {
    const watchlist = this.watchlists.find(w => w.id === watchlistId);
    if (watchlist && !watchlist.items.some(i => i.symbol === symbol)) {
      const item: WatchlistItem = {
        symbol: symbol.toUpperCase(),
        isPinned: false,
        addedAt: new Date().toISOString()
      };
      watchlist.items.push(item);
      this.saveLocally();

      // Persist to Supabase
      try {
        await supabaseAdmin.from('watchlists').insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          symbol: item.symbol,
          created_at: item.addedAt
        });
      } catch (e) {
        console.error("Failed to persist watchlist item to Supabase", e);
      }
    }
  }

  public removeFromWatchlist(watchlistId: string, symbol: string) {
    const watchlist = this.watchlists.find(w => w.id === watchlistId);
    if (watchlist) {
      watchlist.items = watchlist.items.filter(i => i.symbol !== symbol);
      this.saveLocally();
    }
  }

  public togglePin(watchlistId: string, symbol: string) {
    const watchlist = this.watchlists.find(w => w.id === watchlistId);
    if (watchlist) {
      const item = watchlist.items.find(i => i.symbol === symbol);
      if (item) {
        item.isPinned = !item.isPinned;
        this.saveLocally();
      }
    }
  }

  public isSymbolInAnyWatchlist(symbol: string): boolean {
    return this.watchlists.some(w => w.items.some(i => i.symbol === symbol));
  }
}
