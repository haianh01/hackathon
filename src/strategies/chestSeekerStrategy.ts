import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Position,
  Direction,
} from "../types";
import { Pathfinding } from "../utils/pathfinding";
import { manhattanDistance } from "../utils/position";

/**
 * Strategy to actively seek and move towards nearby chests.
 * Helps bot find bombing opportunities.
 */
export class ChestSeekerStrategy extends BaseStrategy {
  name = "ChestSeeker";
  priority = 55; // Between CollectStrategy (60) and WallBreakerStrategy (50)

  evaluate(gameState: GameState): BotDecision | null {
    const { currentBot, map } = gameState;
    const botPosition = currentBot.position;

    if (map.chests.length === 0) {
      console.log("[ChestSeeker] No chests on map");
      return null;
    }

    // Find nearest chest
    const nearestChest = this.findNearestChest(botPosition, map.chests);
    if (!nearestChest) {
      return null;
    }

    const distance = manhattanDistance(botPosition, nearestChest.position);

    // If very close to chest (within 2 cells), let AlignAndBomb handle it
    if (distance <= 80) {
      // 2 cells * 40px
      console.log(
        `[ChestSeeker] Near chest at (${nearestChest.position.x}, ${nearestChest.position.y}) - ${distance}px - letting AlignAndBomb handle`
      );
      return null;
    }

    // Find path to chest
    const path = Pathfinding.findShortestPath(
      botPosition,
      [nearestChest.position],
      gameState
    );

    if (!path || path.length === 0) {
      console.log("[ChestSeeker] No path to nearest chest");
      return null;
    }

    // Get direction to first step
    const nextPos = path[0];
    if (!nextPos) {
      return null;
    }

    const direction = this.getDirectionToPosition(botPosition, nextPos);

    if (direction === Direction.STOP) {
      return null;
    }

    const priority =
      this.priority + Math.max(0, 10 - Math.floor(distance / 40));
    console.log(
      `[ChestSeeker] Moving towards chest at (${nearestChest.position.x}, ${nearestChest.position.y}) - ${distance}px away`
    );

    return this.createDecision(
      BotAction.MOVE,
      priority,
      `Seeking chest at (${nearestChest.position.x}, ${nearestChest.position.y})`,
      direction
    );
  }

  /**
   * Find the nearest chest to bot position
   */
  private findNearestChest(
    botPosition: Position,
    chests: Array<{ position: Position; isDestructible: boolean }>
  ): { position: Position; isDestructible: boolean } | null {
    if (chests.length === 0) return null;

    let nearest = chests[0];
    if (!nearest) return null;

    let minDistance = manhattanDistance(botPosition, nearest.position);

    for (const chest of chests) {
      const distance = manhattanDistance(botPosition, chest.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = chest;
      }
    }

    return nearest || null;
  }

  /**
   * Get direction from current position to target position
   */
  private getDirectionToPosition(from: Position, to: Position): Direction {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // Prioritize direction with larger distance
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else if (Math.abs(dy) > 0) {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }

    return Direction.STOP;
  }
}
