import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Direction,
  Position,
} from "../types";
import { isPositionSafe, calculateBombScore } from "../utils/gameLogic";
import {
  getPositionInDirection,
  // Use unified collision system
  canMoveTo,
  isBlocked,
  PLAYER_SIZE,
} from "../utils";

/**
 * Attack strategy - places bombs to eliminate enemies.
 */
export class AttackStrategy extends BaseStrategy {
  name = "Attack";
  priority = 80;

  evaluate(gameState: GameState): BotDecision | null {
    const { currentBot } = gameState;
    const currentPos = currentBot.position;

    // Check if a bomb can be placed
    if (currentBot.bombCount <= 0) {
      return null;
    }

    // Calculate the score for placing a bomb at the current position
    const bombScore = calculateBombScore(currentPos, gameState);

    // Only place a bomb if it's likely to hit an enemy or destroy objects
    if (bombScore < 100) {
      return null;
    }

    // Check if it's possible to escape the blast radius after placing a bomb
    if (!this.canEscapeAfterBomb(currentPos, gameState)) {
      return null;
    }

    return this.createDecision(
      BotAction.BOMB,
      this.priority + Math.floor(bombScore / 100), // Increase priority based on score
      `Attack - place bomb (score: ${bombScore})`
    );
  }

  /**
   * Checks if it's possible to escape the blast radius after placing a bomb.
   * @param bombPosition The position where the bomb is placed.
   * @param gameState The current game state.
   * @returns True if an escape path is found, false otherwise.
   */
  private canEscapeAfterBomb(
    bombPosition: Position,
    gameState: GameState
  ): boolean {
    const simulatedBomb = {
      id: "temp",
      position: bombPosition,
      ownerId: gameState.currentBot.id,
      timeRemaining: 5000, // 5 seconds
      flameRange: gameState.currentBot.flameRange,
    };

    const tempGameState: GameState = {
      ...gameState,
      map: {
        ...gameState.map,
        bombs: [...gameState.map.bombs, simulatedBomb],
      },
    };

    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];

    for (const direction of directions) {
      let currentPos = { ...bombPosition };

      // Try moving up to 3 steps (based on max speed)
      for (let step = 1; step <= 3; step++) {
        currentPos = getPositionInDirection(currentPos, direction);

        if (!canMoveTo(currentPos, gameState)) {
          break;
        }

        if (isPositionSafe(currentPos, tempGameState)) {
          return true;
        }
      }
    }

    return false;
  }
}
