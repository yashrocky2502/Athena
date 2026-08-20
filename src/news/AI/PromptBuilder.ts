import { DomainCategory, PROMPT_TEMPLATES } from './PromptTemplates';

export interface PromptBuildInput {
  category?: DomainCategory | string;
  headline?: string;
  body?: string;
  facts?: Record<string, any> | string;
  issuer?: string;
  filingType?: string;
  symbols?: string[];
}

export interface BuiltPrompt {
  category: DomainCategory;
  systemPrompt: string;
  userPrompt: string;
}

export class PromptBuilder {
  public static build(input: PromptBuildInput): BuiltPrompt {
    const rawCategory = (input.category || 'News Summary') as DomainCategory;
    const category: DomainCategory = PROMPT_TEMPLATES[rawCategory] ? rawCategory : 'News Summary';

    const template = PROMPT_TEMPLATES[category];

    const headline = input.headline || 'Financial Disclosure';
    const body = (input.body || '').substring(0, 4000);

    let formattedFacts = '';
    if (typeof input.facts === 'object' && input.facts !== null) {
      formattedFacts = Object.entries(input.facts)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n');
    } else {
      formattedFacts = String(input.facts || 'N/A');
    }

    const userPrompt = template.userPromptTemplate
      .replace('{headline}', headline)
      .replace('{facts}', formattedFacts || 'No specific extracted facts')
      .replace('{body}', body || headline)
      .replace('{issuer}', input.issuer || 'Listed Corporate Entity')
      .replace('{filingType}', input.filingType || 'Exchange Filing');

    return {
      category,
      systemPrompt: template.systemInstruction,
      userPrompt
    };
  }
}
