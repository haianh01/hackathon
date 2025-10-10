import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Direction,
  Position,
} from "../types";
import {
  getSafeAdjacentPositions,
  isPositionInDangerZone,
} from "../utils/gameLogic";
import { Pathfinding } from "../utils/pathfinding";
import {
  getPositionInDirection,
  canMoveTo,
  getDirectionToTarget,
} from "../utils";
/**
 * Escape strategy for when the bot is in a danger zone.
 */
export class EscapeStrategy extends BaseStrategy {
  name = "Escape";
  priority = 100; // Highest priority

  evaluate(gameState: GameState): BotDecision | null {
    const { currentBot } = gameState;
    const currentPos = currentBot.position;

    if (!isPositionInDangerZone(currentPos, gameState)) {
      return null;
    }

    // Find the best safe position to move to.
    const bestSafePosition = this.findBestSafePosition(gameState);

    if (bestSafePosition) {
      const direction = getDirectionToTarget(currentPos, bestSafePosition);
      return this.createDecision(
        BotAction.MOVE,
        this.priority,
        `Escape - moving to best safe position (${bestSafePosition.x}, ${bestSafePosition.y})`,
        direction,
        bestSafePosition
      );
    }

    // Emergency: No immediate safe positions, try to move away from danger.
    const emergencyDecision = this.handleEmergency(gameState);
    if (emergencyDecision) {
      return emergencyDecision;
    }

    // If completely stuck, stop and log the situation.
    return this.createDecision(
      BotAction.STOP,
      this.priority,
      "Escape - Completely stuck, accepting risk!",
      Direction.STOP
    );
  }

  /**
   * Finds the best adjacent safe position by scoring them.
   * @param gameState The current game state.
   * @returns The best position to move to, or null if none are found.
   */
  private findBestSafePosition(gameState: GameState): Position | null {
    const safePositions = getSafeAdjacentPositions(
      gameState.currentBot.position,
      gameState
    );

    if (safePositions.length === 0) {
      return null;
    }

    if (safePositions.length === 1) {
      return safePositions[0] ?? null;
    }

    // Score each safe position and return the best one.
    const scoredPositions = safePositions.map((pos) => ({
      position: pos,
      score: this.scorePosition(pos, gameState),
    }));

    scoredPositions.sort((a, b) => b.score - a.score);

    return scoredPositions[0]?.position ?? null;
  }

  /**
   * Scores a position based on its long-term safety.
   * @param position The position to score.
   * @param gameState The current game state.
   * @returns A numerical score.
   */
  private scorePosition(position: Position, gameState: GameState): number {
    // Higher score is better.
    let score = 0;

    // Criterion 1: Safety Depth (number of subsequent escape routes)
    const subsequentSafePositions = getSafeAdjacentPositions(
      position,
      gameState
    );
    score += subsequentSafePositions.length * 10;

    // Criterion 2: Distance from danger
    // Find the closest bomb to the bot's current position
    const closestBomb =
      gameState.map.bombs.length > 0
        ? gameState.map.bombs.reduce((closest, bomb) => {
            const dist = Pathfinding.heuristic(
              gameState.currentBot.position,
              bomb.position
            );
            const closestDist = closest
              ? Pathfinding.heuristic(
                  gameState.currentBot.position,
                  closest.position
                )
              : Infinity;
            return dist < closestDist ? bomb : closest;
          }, null as (typeof gameState.map.bombs)[0] | null)
        : null;

    if (closestBomb) {
      const distanceFromBomb = Pathfinding.heuristic(
        position,
        closestBomb.position
      );
      score += distanceFromBomb; // Further is better
    }

    return score;
  }

  /**
   * Handles the emergency case where no adjacent safe positions are available.
   * @param gameState The current game state.
   * @returns A move decision, or null if no move is possible.
   */
  private handleEmergency(gameState: GameState): BotDecision | null {
    const { currentBot } = gameState;
    const currentPos = currentBot.position;

    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];
    const possibleMoves: { direction: Direction; score: number }[] = [];

    for (const direction of directions) {
      const newPos = getPositionInDirection(currentPos, direction);
      if (canMoveTo(newPos, gameState)) {
        // Score the move based on whether it leads away from danger.
        let score = 0;
        if (!isPositionInDangerZone(newPos, gameState)) {
          score = 100; // Highest score for getting out of danger immediately.
        }
        possibleMoves.push({ direction, score });
      }
    }

    if (possibleMoves.length > 0) {
      possibleMoves.sort((a, b) => b.score - a.score);
      const bestMove = possibleMoves[0];
      if (bestMove) {
        return this.createDecision(
          BotAction.MOVE,
          this.priority,
          "Escape (Emergency) - moving to less dangerous area",
          bestMove.direction
        );
      }
    }

    return null;
  }
}
