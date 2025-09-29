import { GameState, BotDecision, Position, BotAction } from "../types";

/**
 * Interface cho các chiến thuật bot
 */
export interface BotStrategy {
  name: string;
  priority: number;
  evaluate(gameState: GameState): BotDecision | null;
}

/**
 * Base class cho tất cả các chiến thuật
 */
export abstract class BaseStrategy implements BotStrategy {
  abstract name: string;
  abstract priority: number;

  abstract evaluate(gameState: GameState): BotDecision | null;

  protected createDecision(
    action: BotAction,
    priority: number,
    reason: string,
    direction?: any,
    target?: Position
  ): BotDecision {
    const decision: BotDecision = {
      action,
      priority,
      reason,
    };

    if (direction !== undefined) {
      decision.direction = direction;
    }

    if (target !== undefined) {
      decision.target = target;
    }

    return decision;
  }
}
