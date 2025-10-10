import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Position,
  Direction,
} from "../types";
import { getDirectionToTarget, manhattanDistance } from "../utils/position";
import { canMoveTo, isPositionSafe } from "../utils/gameLogic";

/**
 * Strategy to align bot to grid position (aligned to 40px cells) before bombing.
 * This ensures bombs are placed at optimal positions for maximum chest destruction.
 */
export class AlignAndBombStrategy extends BaseStrategy {
  name = "AlignAndBomb";
  priority = 85; // Higher than BombStrategy to run first

  evaluate(gameState: GameState): BotDecision | null {
    const { currentBot, map } = gameState;
    const botPosition = currentBot.position;
    const CELL_SIZE = 40;

    // Check if bot is already aligned to grid
    const isAlignedX = botPosition.x % CELL_SIZE === 0;
    const isAlignedY = botPosition.y % CELL_SIZE === 0;
    const isFullyAligned = isAlignedX && isAlignedY;

    // Calculate distance to nearest alignment
    const distX = Math.abs(botPosition.x % CELL_SIZE);
    const distY = Math.abs(botPosition.y % CELL_SIZE);
    const distToAlign =
      Math.min(distX, CELL_SIZE - distX) + Math.min(distY, CELL_SIZE - distY);

    console.log(
      `[AlignAndBomb] Bot at (${botPosition.x}, ${botPosition.y}) - Aligned: ${isFullyAligned} (X: ${isAlignedX}, Y: ${isAlignedY}) - Distance to align: ${distToAlign}px`
    );

    if (!isFullyAligned) {
      // Bot is not aligned, try to align
      const alignedPosition = this.getNearestAlignedPosition(botPosition);
      console.log(
        `[AlignAndBomb] Target aligned position: (${alignedPosition.x}, ${alignedPosition.y})`
      );

      // Check if we can move to aligned position
      if (
        canMoveTo(alignedPosition, gameState) &&
        isPositionSafe(alignedPosition, gameState)
      ) {
        const direction = getDirectionToTarget(botPosition, alignedPosition);
        if (direction !== Direction.STOP) {
          // Higher priority if very close to alignment (almost there)
          const priority =
            distToAlign <= 5 ? this.priority + 15 : this.priority + 5;
          return this.createDecision(
            BotAction.MOVE,
            priority,
            `Align to grid position (${alignedPosition.x}, ${alignedPosition.y}) - ${distToAlign}px away`,
            direction
          );
        }
      }
    }

    // If aligned, check if there are nearby chests worth bombing
    if (isFullyAligned && currentBot.bombCount > 0) {
      const nearbyChests = this.findNearbyChests(
        botPosition,
        currentBot.flameRange,
        map
      );

      if (nearbyChests.length > 0) {
        console.log(
          `[AlignAndBomb] Found ${nearbyChests.length} chests in range - PLACING BOMB`
        );
        return this.createDecision(
          BotAction.BOMB,
          this.priority + 10,
          `Aligned bomb to destroy ${nearbyChests.length} chests`
        );
      }
    }

    return null;
  }

  /**
   * Get the nearest grid-aligned position (aligned to 40px cells)
   */
  private getNearestAlignedPosition(position: Position): Position {
    const CELL_SIZE = 40;
    return {
      x: Math.round(position.x / CELL_SIZE) * CELL_SIZE,
      y: Math.round(position.y / CELL_SIZE) * CELL_SIZE,
    };
  }

  /**
   * Find chests within bomb's flame range
   */
  private findNearbyChests(
    bombPosition: Position,
    flameRange: number,
    map: GameState["map"]
  ): Position[] {
    const CELL_SIZE = 40;
    const nearbyChests: Position[] = [];
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 }, // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }, // RIGHT
    ];

    // Check bomb position itself
    const chestAtBomb = map.chests.find(
      (c) => c.position.x === bombPosition.x && c.position.y === bombPosition.y
    );
    if (chestAtBomb) {
      nearbyChests.push(chestAtBomb.position);
    }

    // Check in each direction
    for (const dir of directions) {
      for (let i = 1; i <= flameRange; i++) {
        const pos = {
          x: bombPosition.x + dir.dx * i * CELL_SIZE,
          y: bombPosition.y + dir.dy * i * CELL_SIZE,
        };

        // Check for solid wall blocking
        const wall = map.walls.find(
          (w) => w.position.x === pos.x && w.position.y === pos.y
        );
        if (wall && !wall.isDestructible) break;

        // Check for chest
        const chest = map.chests.find(
          (c) => c.position.x === pos.x && c.position.y === pos.y
        );
        if (chest) {
          nearbyChests.push(chest.position);
          break; // Chest blocks further flame
        }
      }
    }

    return nearbyChests;
  }
}
