/**
 * ATHENA NEWS ENGINE — PHASE 16
 * AutonomousResearchQueue.ts
 * 
 * Autonomous Research Queue.
 * Prioritizes research items, pending backtests, failed experiments, promising mutations,
 * regime anomalies, and strategy decay alerts using a priority scoring engine.
 */

export interface ResearchQueueItem {
  itemId: string;
  type: 'HYPOTHESIS' | 'MUTATION_BACKTEST' | 'FAILED_EXPERIMENT' | 'DECAY_ALERT' | 'REGIME_ANOMALY' | 'UNEXPLAINED_REACTION';
  title: string;
  description: string;
  expectedInformationGain: number; // 0 to 1
  marketRelevanceScore: number;    // 0 to 100
  statisticalPotential: number;   // 0 to 100
  priorityScore: number;          // Expected Information Gain * Market Relevance * Statistical Potential
  status: 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'DEFERRED';
  createdAt: string;
}

export class AutonomousResearchQueue {
  private static queue: ResearchQueueItem[] = [];

  /**
   * Adds an item to the research queue and re-calculates its deterministic score
   */
  public static enqueue(item: Omit<ResearchQueueItem, 'priorityScore' | 'createdAt'>): ResearchQueueItem {
    const priorityScore = Number((item.expectedInformationGain * item.marketRelevanceScore * (item.statisticalPotential / 100)).toFixed(2));
    const fullItem: ResearchQueueItem = {
      ...item,
      priorityScore,
      createdAt: new Date().toISOString()
    };
    this.queue.push(fullItem);
    this.sortQueue();
    return fullItem;
  }

  public static getQueue(): ResearchQueueItem[] {
    return this.queue;
  }

  public static updateStatus(id: string, status: ResearchQueueItem['status']): void {
    const item = this.queue.find(q => q.itemId === id);
    if (item) {
      item.status = status;
    }
  }

  public static remove(id: string): void {
    this.queue = this.queue.filter(q => q.itemId !== id);
  }

  public static clear(): void {
    this.queue = [];
  }

  private static sortQueue(): void {
    // Sort descending by priority score
    this.queue.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Seed mock queue items
   */
  public static seedQueue(): void {
    this.enqueue({
      itemId: 'RQ_1',
      type: 'HYPOTHESIS',
      title: 'Post-Surprise Drift Confirmation',
      description: 'Backtesting drift dynamics after earnings beats under BULL conditions.',
      expectedInformationGain: 0.85,
      marketRelevanceScore: 90,
      statisticalPotential: 80,
      status: 'ACTIVE'
    });
    this.enqueue({
      itemId: 'RQ_2',
      type: 'DECAY_ALERT',
      title: 'Iron Condor Performance Degradation',
      description: 'Investigating volatility contraction decay rates on short option sets.',
      expectedInformationGain: 0.90,
      marketRelevanceScore: 95,
      statisticalPotential: 75,
      status: 'QUEUED'
    });
    this.enqueue({
      itemId: 'RQ_3',
      type: 'MUTATION_BACKTEST',
      title: 'Futures Breakout Threshold Lift (v3.1)',
      description: 'Backtesting the mutation of RVOL filter from 1.5 to 1.8 to cut out false breakouts.',
      expectedInformationGain: 0.75,
      marketRelevanceScore: 80,
      statisticalPotential: 85,
      status: 'QUEUED'
    });
    this.enqueue({
      itemId: 'RQ_4',
      type: 'REGIME_ANOMALY',
      title: 'India VIX Spikes under Sideways Index',
      description: 'Investigating option implied volatility inflation while benchmark remains range-bound.',
      expectedInformationGain: 0.70,
      marketRelevanceScore: 85,
      statisticalPotential: 60,
      status: 'DEFERRED'
    });
  }
}
export const autonomousResearchQueue = AutonomousResearchQueue;
