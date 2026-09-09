/**
 * ATHENA NEWS ENGINE — PHASE 14 / PHASE 20
 * ExecutionKillSwitch.ts
 * 
 * Execution Kill Switch & Emergency Safeguards.
 * Provides deterministic emergency shutdown controls across Global, Strategy, Instrument,
 * Broker, and Loss Limit levels.
 */

import { ExecutionKillSwitchStatus, KillSwitchTrigger } from './types.ts';

export class ExecutionKillSwitch {
  private static instance: ExecutionKillSwitch;
  private status: ExecutionKillSwitchStatus = {
    active: false,
    trigger: 'NONE',
    blockedOrdersCount: 0
  };

  private constructor() {}

  public static getInstance(): ExecutionKillSwitch {
    if (!this.instance) {
      this.instance = new ExecutionKillSwitch();
    }
    return this.instance;
  }

  public getStatus(): ExecutionKillSwitchStatus {
    return { ...this.status };
  }

  /**
   * Triggers emergency kill switch.
   */
  public triggerKillSwitch(
    trigger: KillSwitchTrigger,
    reason: string,
    triggeredBy: string = 'ATHENA_AUTOMATED_SAFETY'
  ): ExecutionKillSwitchStatus {
    this.status = {
      active: true,
      trigger,
      triggeredAt: new Date().toISOString(),
      triggeredBy,
      reason,
      blockedOrdersCount: this.status.blockedOrdersCount
    };
    console.error(`🚨 [CRITICAL ATHENA KILL SWITCH] Triggered: ${trigger} — Reason: ${reason}`);
    return this.getStatus();
  }

  public activateGlobalKillSwitch(reason: string, triggeredBy: string = 'ATHENA_ADMIN'): ExecutionKillSwitchStatus {
    return this.triggerKillSwitch('GLOBAL_KILL', reason, triggeredBy);
  }

  /**
   * Resumes execution after explicit human/system confirmation.
   */
  public resumeExecution(resumedBy: string = 'ATHENA_ADMIN'): ExecutionKillSwitchStatus {
    console.warn(`🟢 [ATHENA KILL SWITCH RESUMED] Resumed by ${resumedBy}`);
    this.status = {
      active: false,
      trigger: 'NONE',
      reason: `Resumed by ${resumedBy}`,
      blockedOrdersCount: 0
    };
    return this.getStatus();
  }

  public reset(resumedBy: string = 'TEST_RESET'): ExecutionKillSwitchStatus {
    return this.resumeExecution(resumedBy);
  }

  /**
   * Checks if an order execution should be blocked by the kill switch.
   */
  public checkBlockExecution(symbol?: string, strategyId?: string): boolean {
    if (!this.status.active) return false;

    if (this.status.trigger === 'GLOBAL_KILL' || this.status.trigger === 'PORTFOLIO_RISK_KILL' || this.status.trigger === 'LOSS_LIMIT_KILL') {
      this.status.blockedOrdersCount++;
      return true;
    }

    if (this.status.trigger === 'INSTRUMENT_KILL' && symbol && this.status.reason?.includes(symbol)) {
      this.status.blockedOrdersCount++;
      return true;
    }

    if (this.status.trigger === 'STRATEGY_KILL' && strategyId && this.status.reason?.includes(strategyId)) {
      this.status.blockedOrdersCount++;
      return true;
    }

    return false;
  }
}

export const executionKillSwitch = ExecutionKillSwitch.getInstance();
