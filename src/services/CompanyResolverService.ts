import { CompanyKnowledge } from "../types";
import { CompanyKnowledgeService } from "./CompanyKnowledgeService";
import { CompanyIdentityResolver } from "../lib/CompanyIdentityResolver";

export class CompanyResolverService {
  private static instance: CompanyResolverService;
  private cache: Map<string, CompanyKnowledge> = new Map();

  private constructor() {}

  public static getInstance(): CompanyResolverService {
    if (!CompanyResolverService.instance) {
      CompanyResolverService.instance = new CompanyResolverService();
    }
    return CompanyResolverService.instance;
  }

  public async resolveCompany(query: string): Promise<CompanyKnowledge | null> {
    const canonical = CompanyIdentityResolver.getInstance().resolve(query);

    if (this.cache.has(query)) {
      const cached = this.cache.get(query);
      if (cached && cached.name === canonical.officialName && cached.symbol === canonical.canonicalSymbol) {
        return cached;
      }
      this.cache.delete(query);
    }
    
    // Call server-side API
    const res = await fetch("/api/company/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });
    
    if (!res.ok) return null;
    let knowledge = await res.json();
    
    // Enforce canonical metadata on resolved knowledge object
    const validated = CompanyIdentityResolver.getInstance().validateCompanyRecord(knowledge).correctedRecord;
    
    CompanyKnowledgeService.getInstance().addCompanyKnowledge(validated);
    this.cache.set(query, validated);
    return validated;
  }
}
