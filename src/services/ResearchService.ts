import { SavedResearch } from "../types";
import { supabaseAdmin } from "../lib/supabase";
import { safeLocalStorage } from "./storage/safeStorage";

export class ResearchService {
  private static instance: ResearchService;
  private bookmarks: SavedResearch[] = [];
  private readonly STORAGE_KEY = "athena_saved_research";

  private constructor() {
    this.load();
  }

  public static getInstance(): ResearchService {
    if (!ResearchService.instance) {
      ResearchService.instance = new ResearchService();
    }
    return ResearchService.instance;
  }

  private async load() {
    const saved = safeLocalStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.bookmarks = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load bookmarks from localStorage", e);
      }
    }

    // Parallel sync from Supabase
    try {
      const { data, error } = await supabaseAdmin
        .from('saved_research')
        .select('*')
        .order('saved_at', { ascending: false });

      if (!error && data) {
        console.log(`[ResearchService] Synced ${data.length} bookmarks from Supabase.`);
        // Merge or replace depending on logic. Here we replace for production consistency.
        this.bookmarks = data.map(d => ({
          id: d.id,
          type: d.data?.type || "Report",
          title: d.data?.title || "Untitled Research",
          data: d.data?.data,
          savedAt: d.saved_at
        }));
        this.saveLocally();
      }
    } catch (e) {
      console.error("Failed to sync bookmarks from Supabase", e);
    }
  }

  private saveLocally() {
    safeLocalStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.bookmarks));
  }

  public async saveResearch(type: SavedResearch["type"], title: string, data: any): Promise<SavedResearch> {
    const newBookmark: SavedResearch = {
      id: Math.random().toString(36).substring(7),
      type,
      title,
      data,
      savedAt: new Date().toISOString()
    };
    this.bookmarks.unshift(newBookmark);
    this.saveLocally();

    // Persist to Supabase
    try {
      await supabaseAdmin.from('saved_research').insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Default system user
        data: newBookmark,
        saved_at: newBookmark.savedAt
      });
    } catch (e) {
      console.error("Failed to persist bookmark to Supabase", e);
    }

    return newBookmark;
  }

  public removeResearch(id: string) {
    this.bookmarks = this.bookmarks.filter(b => b.id !== id);
    this.saveLocally();
  }

  public getBookmarks(): SavedResearch[] {
    return [...this.bookmarks];
  }
}
