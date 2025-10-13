import { BaseStrategy } from "./baseStrategy";
import { GameState, BotDecision, BotAction, Direction } from "../types";
import {
  isPositionSafe,
  canMoveTo,
  getPositionInDirection,
  CELL_SIZE,
} from "../utils";

/**
 * Chiến thuật khám phá - di chuyển đến vùng chưa khám phá
 */
export class ExploreStrategy extends BaseStrategy {
  name = "Explore";
  priority = 40;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;

    // Tìm hướng di chuyển tốt nhất để khám phá
    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];
    let bestDirection = null;
    let bestScore = -1;
    for (const direction of directions) {
      const nextPos = getPositionInDirection(currentPos, direction);

      if (
        !canMoveTo(nextPos, gameState) ||
        !isPositionSafe(nextPos, gameState)
      ) {
        continue;
      }

      // Tính điểm khám phá cho hướng này
      const exploreScore = this.calculateExploreScore(nextPos, gameState);

      if (exploreScore > bestScore) {
        bestScore = exploreScore;
        bestDirection = direction;
      }
    }

    if (!bestDirection || bestScore <= 0) {
      return null;
    }

    return this.createDecision(
      BotAction.MOVE,
      this.priority + Math.floor(bestScore / 10),
      `Khám phá - di chuyển để tìm kiếm cơ hội (điểm: ${bestScore})`,
      bestDirection
    );
  }

  /**
   * Tính điểm khám phá cho một vị trí
   */
  private calculateExploreScore(position: any, gameState: GameState): number {
    let score = 10; // Điểm cơ bản cho việc di chuyển

    // Ưu tiên di chuyển về phía trung tâm bản đồ
    const centerX = gameState.map.width / 2;
    const centerY = gameState.map.height / 2;
    const distanceFromCenter =
      Math.abs(position.x - centerX) + Math.abs(position.y - centerY);
    const maxDistance = gameState.map.width + gameState.map.height; // Max possible distance
    score += Math.floor((1 - distanceFromCenter / maxDistance) * 50); // 0-50 points

    // Ưu tiên vùng có ít tường
    const nearbyWalls = this.countNearbyWalls(position, gameState, 2);
    score += Math.max(0, 20 - nearbyWalls * 5);

    // Ưu tiên tránh xa kẻ thù nếu không có lợi thế
    const nearestEnemyDistance = this.getNearestEnemyDistance(
      position,
      gameState
    );
    const DANGER_RADIUS = 3 * CELL_SIZE;
    if (nearestEnemyDistance < DANGER_RADIUS) {
      score -= ((DANGER_RADIUS - nearestEnemyDistance) / CELL_SIZE) * 10;
    }

    // Ưu tiên vùng có vật phẩm gần đó
    const nearbyItems = this.countNearbyItems(position, gameState, 3);
    score += nearbyItems * 15;

    return score;
  }

  private countNearbyWalls(
    position: any,
    gameState: GameState,
    radius: number
  ): number {
    let count = 0;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const checkPos = {
          x: position.x + dx * CELL_SIZE,
          y: position.y + dy * CELL_SIZE,
        };
        if (
          gameState.map.walls.some(
            (wall) =>
              wall.position.x === checkPos.x && wall.position.y === checkPos.y
          ) ||
          (gameState.map.chests || []).some(
            (c) => c.position.x === checkPos.x && c.position.y === checkPos.y
          )
        ) {
          count++;
        }
      }
    }

    return count;
  }

  private getNearestEnemyDistance(position: any, gameState: GameState): number {
    let minDistance = Infinity;

    for (const enemy of gameState.enemies) {
      if (!enemy.isAlive) continue;

      const distance =
        Math.abs(position.x - enemy.position.x) +
        Math.abs(position.y - enemy.position.y);
      minDistance = Math.min(minDistance, distance);
    }

    return minDistance === Infinity ? 10 : minDistance;
  }

  private countNearbyItems(
    position: any,
    gameState: GameState,
    radius: number
  ): number {
    let count = 0;

    for (const item of gameState.map.items) {
      const distance =
        Math.abs(position.x - item.position.x) +
        Math.abs(position.y - item.position.y);

      if (distance <= radius * CELL_SIZE) {
        count++;
      }
    }

    return count;
  }
}
