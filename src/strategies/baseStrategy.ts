import {
  GameState,
  BotDecision,
  Position,
  BotAction,
  Direction,
} from "../types";

/**
 * Interface for bot strategies.
 */
export interface BotStrategy {
  name: string;
  priority: number;
  evaluate(gameState: GameState): BotDecision | null;
}

/**
 * Base class for all strategies.
 */
export abstract class BaseStrategy implements BotStrategy {
  abstract name: string;
  abstract priority: number;

  abstract evaluate(gameState: GameState): BotDecision | null;

  /**
   * Creates a decision object.
   * @param action The action to take.
   * @param priority The priority of the decision.
   * @param reason A descriptive reason for the decision.
   * @param direction The direction to move, if applicable.
   * @param target The target position, if applicable.
   * @returns A BotDecision object.
   */
  protected createDecision(
    action: BotAction,
    priority: number,
    reason: string,
    direction?: Direction,
    target?: Position
  ): BotDecision {
    const decision: BotDecision = { action, priority, reason };

    if (direction) {
      decision.direction = direction;
    }
    if (target) {
      decision.target = target;
    }

    return decision;
  }
}
