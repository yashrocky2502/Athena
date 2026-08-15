import { IntelligenceRepository, CacheEntry } from "./IntelligenceRepository";
import { supabaseAdmin } from "../../lib/supabase";
import { CompanyKnowledge } from "../../types";

export class SupabaseRepository implements IntelligenceRepository {
  private memoryCache = new Map<string, CacheEntry>();

  async get(key: string): Promise<CacheEntry | null> {
    // Strategy: Memory Cache -> Supabase
    
    // 1. Check Memory Cache
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      console.log(`[Cache Hit] Memory cache hit for: ${key}`);
      return memEntry;
    }

    // 2. Query Supabase
    console.log(`[Repository Read] Fetching from Supabase: ${key}`);
    const { data, error } = await supabaseAdmin
      .from('intelligence_reports')
      .select('*')
      .eq('company', key)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[Repository Error] Supabase read failed: ${error.message}`);
      return null;
    }

    if (data) {
      console.log(`[Cache Miss] Supabase hit, updating memory cache for: ${key}`);
      const entry: CacheEntry = {
        knowledge: data.intelligence_json as CompanyKnowledge,
        timestamp: new Date(data.generated_at).getTime(),
        marketOpenState: false // Default to false if not stored, will be refreshed if needed
      };
      
      // Update memory cache
      this.memoryCache.set(key, entry);
      return entry;
    }

    console.log(`[Cache Miss] No entry found in Supabase for: ${key}`);
    return null;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    console.log(`[Repository Write] Saving to Supabase: ${key}`);
    
    // Save to Memory Cache first
    this.memoryCache.set(key, entry);

    // Prepare payload for Supabase
    const eventId = entry.knowledge.diagnostics?.canonicalId || `REPORT-${key}-${entry.timestamp}`;
    
    const payload = {
      event_id: eventId,
      company: key,
      headline: entry.knowledge.name,
      intelligence_json: entry.knowledge,
      confidence: entry.knowledge.confidence || 0,
      evidence_count: entry.knowledge.timeline?.length || 0,
      source_urls: entry.knowledge.sources?.map(s => s.uri) || [],
      generated_at: new Date(entry.timestamp).toISOString(),
      updated_at: new Date().toISOString()
    };

    // Use event_id as the primary key for upsert to handle deterministic merging
    const { error } = await supabaseAdmin
      .from('intelligence_reports')
      .upsert(payload, { onConflict: 'event_id' }); 

    if (error) {
      console.error(`[Repository Error] Supabase write failed: ${error.message}`);
    } else {
      console.log(`[Repository Write] Successfully saved intelligence for: ${key}`);
    }
  }

  async update(key: string, entry: CacheEntry): Promise<void> {
    console.log(`[Repository Update] Updating Supabase: ${key}`);
    this.memoryCache.set(key, entry);

    const { error } = await supabaseAdmin
      .from('intelligence_reports')
      .update({
        intelligence_json: entry.knowledge,
        confidence: entry.knowledge.confidence,
        evidence_count: entry.knowledge.timeline?.length,
        source_urls: entry.knowledge.sources?.map(s => s.uri),
        updated_at: new Date().toISOString()
      })
      .eq('company', key);

    if (error) {
      console.error(`[Repository Error] Supabase update failed: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    console.log(`[Repository Delete] Deleting from Supabase: ${key}`);
    this.memoryCache.delete(key);

    const { error } = await supabaseAdmin
      .from('intelligence_reports')
      .delete()
      .eq('company', key);

    if (error) {
      console.error(`[Repository Error] Supabase delete failed: ${error.message}`);
    }
  }

  // Specialized methods for Athena Production
  async fetchByEventId(eventId: string): Promise<CacheEntry | null> {
    const { data, error } = await supabaseAdmin
      .from('intelligence_reports')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    
    if (error || !data) return null;
    return {
      knowledge: data.intelligence_json as CompanyKnowledge,
      timestamp: new Date(data.generated_at).getTime(),
      marketOpenState: false
    };
  }

  async updateConfidence(eventId: string, confidence: number): Promise<void> {
    console.log(`[Repository Merge] Updating confidence for ${eventId} to ${confidence}`);
    await supabaseAdmin
      .from('intelligence_reports')
      .update({ confidence, updated_at: new Date().toISOString() })
      .eq('event_id', eventId);
  }

  async updateSources(eventId: string, sources: string[]): Promise<void> {
    console.log(`[Repository Merge] Updating sources for ${eventId}`);
    await supabaseAdmin
      .from('intelligence_reports')
      .update({ source_urls: sources, updated_at: new Date().toISOString() })
      .eq('event_id', eventId);
  }

  // Advanced Persistence Support
  async fetchByCompany(symbol: string): Promise<CacheEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('intelligence_reports')
      .select('*')
      .eq('company', symbol);

    if (error || !data) return [];
    return data.map(d => ({
      knowledge: d.intelligence_json as CompanyKnowledge,
      timestamp: new Date(d.generated_at).getTime(),
      marketOpenState: false
    }));
  }

  async fetchByCategory(category: string): Promise<CacheEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('intelligence_reports')
      .select('*')
      .contains('intelligence_json->profile', { sector: category }); // Example mapping

    if (error || !data) return [];
    return data.map(d => ({
      knowledge: d.intelligence_json as CompanyKnowledge,
      timestamp: new Date(d.generated_at).getTime(),
      marketOpenState: false
    }));
  }

  async fetchRecent(limit: number = 10): Promise<CacheEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('intelligence_reports')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map(d => ({
      knowledge: d.intelligence_json as CompanyKnowledge,
      timestamp: new Date(d.generated_at).getTime(),
      marketOpenState: false
    }));
  }
}
