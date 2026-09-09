/**
 * ATHENA NEWS ENGINE — PHASE 14
 * OrderLifecycleStateMachine.ts
 * 
 * Deterministic Order Lifecycle State Machine.
 * Validates and enforces state transitions across the order lifecycle:
 * CREATED -> VALIDATING -> APPROVED -> SUBMITTED -> ACKNOWLEDGED -> PARTIALLY_FILLED -> FILLED.
 * Terminal states: REJECTED, CANCELLED, EXPIRED, FAILED.
 */

import { OrderState } from './types.ts';

export class OrderLifecycleStateMachine {
  private static instance: OrderLifecycleStateMachine;

  // Allowed state transition map
  private validTransitions: Record<OrderState, OrderState[]> = {
    CREATED: ['VALIDATING', 'REJECTED', 'FAILED'],
    VALIDATING: ['APPROVED', 'REJECTED', 'FAILED'],
    APPROVED: ['SUBMITTED', 'CANCELLED', 'FAILED'],
    SUBMITTED: ['ACKNOWLEDGED', 'PARTIALLY_FILLED', 'FILLED', 'REJECTED', 'CANCELLED', 'FAILED'],
    ACKNOWLEDGED: ['PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'FAILED'],
    PARTIALLY_FILLED: ['PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'FAILED'],
    FILLED: [],       // Terminal
    REJECTED: [],     // Terminal
    CANCELLED: [],    // Terminal
    EXPIRED: [],      // Terminal
    FAILED: []        // Terminal
  };

  private constructor() {}

  public static getInstance(): OrderLifecycleStateMachine {
    if (!this.instance) {
      this.instance = new OrderLifecycleStateMachine();
    }
    return this.instance;
  }

  /**
   * Validates if a state transition is legal. Throws error on invalid transition.
   */
  public transition(currentState: OrderState, nextState: OrderState): OrderState {
    if (currentState === nextState) return nextState;

    const allowedNextStates = this.validTransitions[currentState] || [];
    if (!allowedNextStates.includes(nextState)) {
      throw new Error(`[ILLEGAL STATE TRANSITION] Cannot transition order state from ${currentState} to ${nextState}.`);
    }

    return nextState;
  }

  /**
   * Checks whether a state transition is valid without throwing.
   */
  public isValidTransition(currentState: OrderState, nextState: OrderState): boolean {
    if (currentState === nextState) return true;
    const allowedNextStates = this.validTransitions[currentState] || [];
    return allowedNextStates.includes(nextState);
  }

  /**
   * Returns whether a state is terminal.
   */
  public isTerminal(state: OrderState): boolean {
    return ['FILLED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(state);
  }
}

export const orderLifecycleStateMachine = OrderLifecycleStateMachine.getInstance();
