/**
 * ATHENA NEWS ENGINE V3 — STORY CLUSTERING REGRESSION TEST SUITE
 * 
 * Runs 500+ real-world scenario tests covering major Indian market companies:
 * Hero MotoCorp, LIC, MCX, Trent, Britannia, Kalyan Jewellers, ICICI Bank, HDFC Bank, Infosys, TCS.
 * 
 * Validates Phase 4 Success Targets:
 * - Duplicate Detection: > 99%
 * - False Merge: < 0.5%
 * - Missed Duplicate: < 1%
 * - Processing Latency: < 150 ms/article
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StoryClusterEngine } from '../deduplication/StoryClusterEngine';
import { ClusterRepository } from '../deduplication/ClusterRepository';
import { NormalizationEngine } from '../normalization/NormalizationEngine';
import { RawArticleInput } from '../normalization/NormalizationEngine';

describe('StoryClusteringRegression (500+ Scenarios)', () => {
  let clusterEngine: StoryClusterEngine;
  let normalizationEngine: NormalizationEngine;
  let repository: ClusterRepository;

  beforeEach(() => {
    repository = ClusterRepository.getInstance();
    repository.clear();
    clusterEngine = new StoryClusterEngine();
    normalizationEngine = new NormalizationEngine();
  });

  const COMPANIES = [
    { name: 'Hero MotoCorp', ticker: 'HEROMOTOCO', isin: 'INE158A01026' },
    { name: 'Life Insurance Corporation of India', ticker: 'LIC', isin: 'INE0J1Y01017' },
    { name: 'Multi Commodity Exchange of India', ticker: 'MCX', isin: 'INE745G01035' },
    { name: 'Trent Limited', ticker: 'TRENT', isin: 'INE849A01020' },
    { name: 'Britannia Industries', ticker: 'BRITANNIA', isin: 'INE216A01030' },
    { name: 'Kalyan Jewellers India', ticker: 'KALYANKJIL', isin: 'INE079U01024' },
    { name: 'ICICI Bank', ticker: 'ICICIBANK', isin: 'INE090A01021' },
    { name: 'HDFC Bank', ticker: 'HDFCBANK', isin: 'INE040A01034' },
    { name: 'Infosys Limited', ticker: 'INFY', isin: 'INE009A01021' },
    { name: 'Tata Consultancy Services', ticker: 'TCS', isin: 'INE467B01029' }
  ];

  const PUBLISHERS = [
    { id: 'REUTERS', name: 'Reuters' },
    { id: 'ECONOMIC_TIMES', name: 'Economic Times' },
    { id: 'MONEYCONTROL', name: 'Moneycontrol' },
    { id: 'LIVEMINT', name: 'LiveMint' },
    { id: 'BUSINESS_STANDARD', name: 'Business Standard' },
    { id: 'NSE', name: 'NSE' },
    { id: 'BSE', name: 'BSE' }
  ];

  const EVENT_TEMPLATES = [
    {
      quarter: 'Q1 FY27',
      headlines: [
        "{company} Q1 Net Profit surges 28% YoY to Rs {amount} crore; EBITDA margin expands",
        "{company} Q1 Results: PAT rises 28% to Rs {amount} cr; beats street estimates",
        "{company} reports 28% YoY growth in Q1 net profit at Rs {amount} crore",
        "{company} Q1 Earnings: Net profit jumps 28% to Rs {amount} cr, revenue up 18%"
      ]
    },
    {
      quarter: 'Q1 FY27',
      headlines: [
        "{company} announces Rs {amount} dividend per share; record date fixed for August 20",
        "{company} Board approves Rs {amount} per share final dividend",
        "{company} declares dividend of Rs {amount} per equity share"
      ]
    },
    {
      quarter: 'Q2 FY27',
      headlines: [
        "{company} Q2 PAT jumps 35% to Rs {amount} crore on strong volume growth",
        "{company} Q2 net profit climbs 35% to Rs {amount} cr, declares interim dividend",
        "{company} Q2 Results: Net profit at Rs {amount} cr vs Rs 1,200 cr YoY"
      ]
    },
    {
      quarter: 'GENERAL',
      headlines: [
        "{company} receives Rs {amount} crore GST penalty demand notice from tax authority",
        "Tax authority issues Rs {amount} cr demand notice to {company}",
        "GST department demands Rs {amount} crore penalty from {company}"
      ]
    },
    {
      quarter: 'GENERAL',
      headlines: [
        "Jefferies maintains BUY on {company} with target price of Rs {amount}",
        "Brokerage Radar: Jefferies keeps BUY rating on {company}, sees upside to Rs {amount}",
        "{company} target price raised to Rs {amount} by Jefferies on strong outlook"
      ]
    }
  ];

  it('Executes 500+ real-world story clustering scenarios and satisfies all Phase 4 success targets', async () => {
    let totalArticles = 0;
    let expectedDuplicates = 0;
    let detectedDuplicates = 0;
    let falseMerges = 0;
    let missedDuplicates = 0;
    let totalLatencyMs = 0;

    // Generate 500 scenario articles (50 story events across 10 companies with 10 publisher variations each = 500 articles)
    for (let i = 0; i < 50; i++) {
      const company = COMPANIES[i % COMPANIES.length];
      const template = EVENT_TEMPLATES[i % EVENT_TEMPLATES.length];
      const baseAmount = (100 + (i * 17)) % 1500 + 50;

      // Create 10 publisher articles for this exact same story event
      for (let pIdx = 0; pIdx < 10; pIdx++) {
        const pub = PUBLISHERS[pIdx % PUBLISHERS.length];
        const headlineTemplate = template.headlines[pIdx % template.headlines.length];
        const title = headlineTemplate.replace('{company}', company.name).replace('{amount}', baseAmount.toString());

        const rawContent = `Mumbai: ${company.name} (${company.ticker}) published its official release today. ${title}. Total financial impact is estimated at Rs ${baseAmount} crore. Management expressed strong confidence.`;

        const rawArticle: RawArticleInput = {
          title,
          publisher: pub.name,
          publisherId: pub.id as any,
          sourceUrl: `https://${pub.id.toLowerCase()}.com/article_${i}_${pIdx}`,
          publishedAt: new Date(Date.now() - (i * 3600000) + (pIdx * 60000)).toISOString(),
          rawContent
        };

        const normResult = await normalizationEngine.normalize(rawArticle);
        const normDoc = normResult.document!;

        const start = Date.now();
        const result = await clusterEngine.processDocument(normDoc);
        const latency = Date.now() - start;

        totalLatencyMs += latency;
        totalArticles++;

        if (pIdx === 0) {
          // First article of this story event should create a new cluster
          expect(result.action).toBe('CREATED_NEW_CLUSTER');
        } else {
          // Subsequent 9 articles should be recognized as duplicates and merged
          expectedDuplicates++;
          if (result.action === 'MERGED_INTO_CLUSTER') {
            detectedDuplicates++;
            // Check if false merge (merged into wrong company/cluster)
            if (!result.cluster.tickers.includes(company.ticker)) {
              falseMerges++;
            }
          } else {
            missedDuplicates++;
          }
        }
      }
    }

    // 500 Articles Processed
    expect(totalArticles).toBe(500);

    const duplicateDetectionRate = (detectedDuplicates / expectedDuplicates) * 100;
    const falseMergeRate = (falseMerges / totalArticles) * 100;
    const missedDuplicateRate = (missedDuplicates / expectedDuplicates) * 100;
    const avgLatencyMs = totalLatencyMs / totalArticles;

    // Verify Phase 4 Success Targets
    // 1. Duplicate detection > 99%
    expect(duplicateDetectionRate).toBeGreaterThanOrEqual(99.0);

    // 2. False merge < 0.5%
    expect(falseMergeRate).toBeLessThan(0.5);

    // 3. Missed duplicate < 1%
    expect(missedDuplicateRate).toBeLessThan(1.0);

    // 4. Processing latency < 150 ms/article
    expect(avgLatencyMs).toBeLessThan(150);
  });
});
