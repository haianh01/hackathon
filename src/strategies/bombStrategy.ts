import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Position,
  Wall,
  Bomb,
} from "../types";
import { isPositionInBounds } from "../utils/position";
import { Pathfinding } from "../utils/pathfinding";
import { isPositionSafe } from "../utils/gameLogic";

/**
 * Smart bomb placement strategy.
 * Places a bomb if:
 * 1. It can destroy nearby chests.
 * 2. It can attack an enemy.
 * 3. A safe escape route is available.
 */
export class BombStrategy extends BaseStrategy {
  name = "BombStrategy";
  priority = 80; // High priority

  evaluate(gameState: GameState): BotDecision | null {
    const { currentBot, map } = gameState;
    const botPosition = currentBot.position;

    console.log("[BombStrategy] Evaluating...");

    if (currentBot.bombCount <= 0) {
      console.log("[BombStrategy] No bombs available.");
      return null; // No bombs to place
    }

    const isBombAtPosition = map.bombs.some(
      (bomb) =>
        bomb.position.x === botPosition.x && bomb.position.y === botPosition.y
    );
    if (isBombAtPosition) {
      console.log("[BombStrategy] Bomb already at position.");
      return null; // Don't place a bomb if one is already here
    }

    // Simulate placing a bomb to find escape routes
    const simulatedGameState = this.simulateBombPlacement(gameState);

    // CRITICAL: First, check if there is a safe escape route.
    const escapePath = this.findEscapePath(simulatedGameState);
    if (!escapePath || escapePath.length === 0) {
      console.log("[BombStrategy] No escape path found.");
      return null; // Do not place a bomb if there is no escape
    }

    // If an escape route exists, calculate the benefit of placing the bomb.
    const bombBenefit = this.calculateBombBenefit(gameState);
    if (bombBenefit.score <= 0) {
      console.log(
        `[BombStrategy] Bomb benefit is too low: ${bombBenefit.score}. Reason: ${bombBenefit.reason}`
      );
      return null; // Not worth placing a bomb
    }

    console.log(`[BombStrategy] Placing bomb. Benefit: ${bombBenefit.score}`);
    // Increase priority based on the benefit score
    const dynamicPriority =
      this.priority + Math.min(bombBenefit.score / 10, 19); // Cap bonus priority

    return this.createDecision(
      BotAction.BOMB,
      dynamicPriority,
      `Place bomb: ${bombBenefit.reason}`
    );
  }

  /**
   * Calculates the benefit of placing a bomb at the current position.
   * @param gameState The current game state.
   * @returns An object with the score and a reason.
   */
  private calculateBombBenefit(gameState: GameState): {
    score: number;
    reason: string;
  } {
    const { currentBot, map, enemies } = gameState;
    const botPosition = currentBot.position;
    const flameRange = currentBot.flameRange;

    let score = 0;
    const reasons: string[] = [];

    const affectedPositions = this.getAffectedPositions(
      botPosition,
      flameRange,
      map
    );

    console.log(
      `[BombStrategy] Bot position: (${botPosition.x}, ${botPosition.y})`
    );
    console.log(`[BombStrategy] Flame range: ${flameRange}`);
    console.log(`[BombStrategy] Affected positions:`, affectedPositions);
    // console.log(`[BombStrategy] Chests on map:`, map.chests);

    // Score for destroying chests
    const destructibleChests = affectedPositions.filter((pos) =>
      map.chests.some((c) => c.position.x === pos.x && c.position.y === pos.y)
    );

    console.log(
      `[BombStrategy] Destructible chests found:`,
      destructibleChests
    );

    if (destructibleChests.length > 0) {
      score += destructibleChests.length * 30;
      reasons.push(`destroy ${destructibleChests.length} chests`);
    }

    // Score for hitting enemies
    const threatenedEnemies = enemies.filter(
      (enemy) =>
        enemy.isAlive &&
        affectedPositions.some(
          (pos) => pos.x === enemy.position.x && pos.y === enemy.position.y
        )
    );

    if (threatenedEnemies.length > 0) {
      score += threatenedEnemies.length * 80;
      reasons.push(`attack ${threatenedEnemies.length} enemies`);
    }

    // Penalty for potentially destroying items
    const nearbyItems = map.items.filter((item) =>
      affectedPositions.some(
        (pos) => pos.x === item.position.x && pos.y === item.position.y
      )
    );

    if (nearbyItems.length > 0) {
      score -= nearbyItems.length * 25;
      reasons.push(`risk destroying ${nearbyItems.length} items`);
    }

    if (reasons.length === 0 || score < 10) {
      return { score: 0, reason: "no valuable targets" };
    }

    return { score, reason: reasons.join(", ") };
  }

  /**
   * Gets all positions that would be affected by a bomb's explosion.
   * @param bombPosition The position of the bomb.
   * @param flameRange The bomb's flame range.
   * @param map The game map.
   * @returns An array of affected positions.
   */
  private getAffectedPositions(
    bombPosition: Position,
    flameRange: number,
    map: GameState["map"]
  ): Position[] {
    const positions: Position[] = [bombPosition];
    const CELL_SIZE = 40; // Each cell is 40x40 pixels
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 }, // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }, // RIGHT
    ];

    for (const dir of directions) {
      for (let i = 1; i <= flameRange; i++) {
        const pos = {
          x: bombPosition.x + dir.dx * i * CELL_SIZE,
          y: bombPosition.y + dir.dy * i * CELL_SIZE,
        };

        if (!isPositionInBounds(pos, map.width, map.height)) break;

        const wall = map.walls.find(
          (w) => w.position.x === pos.x && w.position.y === pos.y
        );
        if (wall && !wall.isDestructible) break; // Solid wall blocks flame

        positions.push(pos);

        const chest = map.chests.find(
          (c) => c.position.x === pos.x && c.position.y === pos.y
        );
        if (chest) {
          break; // Chest blocks flame propagation
        }
      }
    }
    return positions;
  }

  /**
   * Finds an escape path to a safe position after placing a bomb.
   * @param gameState The game state *after* a bomb has been simulated.
   * @returns An array of positions representing the path, or null if no path is found.
   */
  private findEscapePath(gameState: GameState): Position[] | null {
    const { currentBot, map } = gameState;

    // Find all safe positions on the map
    const safePositions: Position[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const pos = { x, y };
        if (isPositionSafe(pos, gameState)) {
          safePositions.push(pos);
        }
      }
    }

    if (safePositions.length === 0) return null;

    // Find the shortest path to any of the safe positions
    return Pathfinding.findShortestPath(
      currentBot.position,
      safePositions,
      gameState
    );
  }

  /**
   * Simulates the game state after placing a bomb at the bot's current position.
   * @param gameState The original game state.
   * @returns A new game state with the simulated bomb.
   */
  private simulateBombPlacement(gameState: GameState): GameState {
    const { currentBot } = gameState;
    const simulatedBomb: Bomb = {
      id: "simulated",
      position: currentBot.position,
      ownerId: currentBot.id,
      timeRemaining: 3000, // Average bomb timer
      flameRange: currentBot.flameRange,
    };

    return {
      ...gameState,
      map: {
        ...gameState.map,
        bombs: [...gameState.map.bombs, simulatedBomb],
      },
    };
  }
}
