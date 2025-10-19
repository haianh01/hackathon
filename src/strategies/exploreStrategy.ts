import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Direction,
  Position,
} from "../types";
import {
  isPositionSafe,
  canMoveTo,
  getPositionInDirection,
  CELL_SIZE,
  Pathfinding,
} from "../utils";

/**
 * Chiến thuật khám phá - di chuyển đến vùng chưa khám phá
 */
export class ExploreStrategy extends BaseStrategy {
  name = "Explore";
  priority = 40;

  private lastTarget: Position | null = null;
  private lastTargetTime: number = 0;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;

    // Tìm một mục tiêu khám phá tốt
    const target = this.findExplorationTarget(gameState);

    if (!target) {
      console.log(
        "🧭 ExploreStrategy: Không tìm thấy mục tiêu khám phá phù hợp."
      );
      return null;
    }

    // Sử dụng Pathfinding để tìm đường đến mục tiêu
    const path = Pathfinding.findPath(currentPos, target, gameState);

    if (!path || path.length < 2) {
      console.log(
        `🧭 ExploreStrategy: Không tìm thấy đường đến mục tiêu (${target.x}, ${target.y}).`
      );
      return null;
    }

    const finalTarget = path[path.length - 1]!;
    const score = this.calculateExploreScore(finalTarget, gameState);

    return this.createDecision(
      BotAction.MOVE,
      this.priority + Math.floor(score / 10),
      `Khám phá - tìm đường đến vị trí chiến lược (điểm: ${score.toFixed(1)})`,
      undefined, // Direction sẽ được tính từ path
      finalTarget,
      path
    );
  }

  /**
   * Tìm một vị trí mục tiêu để khám phá.
   */
  private findExplorationTarget(gameState: GameState): Position | null {
    const currentPos = gameState.currentBot.position;
    const searchRadius = 8; // Tìm kiếm trong bán kính 8 ô
    let bestTarget: Position | null = null;
    let bestScore = -Infinity;

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const targetPos = {
          x: currentPos.x + dx * CELL_SIZE,
          y: currentPos.y + dy * CELL_SIZE,
        };
        if (
          !canMoveTo(targetPos, gameState) ||
          !isPositionSafe(targetPos, gameState)
        )
          continue;

        const score = this.calculateExploreScore(targetPos, gameState);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = targetPos;
        }
      }
    }
    return bestTarget;
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

    // PHẠT ĐIỂM CÁC VỊ TRÍ DỄ BỊ KẸT (TRAP PENALTY)
    // Đếm số lối thoát xung quanh vị trí để đánh giá mức độ "mở"
    const walkableNeighbors = this.countWalkableNeighbors(position, gameState);
    if (walkableNeighbors <= 1) {
      score -= 50; // Phạt rất nặng cho ngõ cụt
    } else if (walkableNeighbors === 2) {
      score -= 15; // Phạt nhẹ cho các vị trí dạng hành lang
    }

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

  /**
   * Đếm số lượng ô trống có thể di chuyển xung quanh một vị trí.
   * Giúp xác định các ngõ cụt (1 lối đi) và hành lang (2 lối đi).
   * @param position Vị trí cần kiểm tra.
   * @param gameState Trạng thái game.
   * @returns Số lượng ô có thể di chuyển được.
   */
  private countWalkableNeighbors(
    position: Position,
    gameState: GameState
  ): number {
    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];
    let walkableCount = 0;
    for (const direction of directions) {
      const neighborPos = getPositionInDirection(position, direction);
      if (canMoveTo(neighborPos, gameState)) {
        walkableCount++;
      }
    }
    return walkableCount;
  }
}
