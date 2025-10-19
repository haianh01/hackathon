import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Direction,
  Position,
} from "../types";
import {
  manhattanDistance,
  isPositionSafe,
  getPositionInDirection,
  canMoveTo,
  CELL_SIZE,
  getDirectionToTarget,
} from "../utils";
import { Pathfinding } from "../utils/pathfinding";

/**
 * Chiến thuật phòng thủ - tránh xa kẻ thù và bom
 */
export class DefensiveStrategy extends BaseStrategy {
  name = "Defensive";
  priority = 70;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;
    const DANGER_THRESHOLD = 3 * CELL_SIZE; // Kích hoạt khi kẻ địch cách 3 ô (120px)
    const enemies = gameState.enemies.filter((enemy) => enemy.isAlive);

    if (enemies.length === 0) {
      console.log(`🛡️ DefensiveStrategy: Không có enemy`);
      return null;
    }

    // Tìm kẻ thù gần nhất
    let nearestEnemy = null;
    let nearestDistance = Infinity;

    for (const enemy of enemies) {
      const distance = manhattanDistance(currentPos, enemy.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    }

    // Nếu kẻ thù quá gần, tìm cách tránh xa
    if (nearestEnemy && nearestDistance < DANGER_THRESHOLD) {
      const retreatPosition = this.findRetreatPosition(
        currentPos,
        nearestEnemy.position,
        gameState
      );

      if (retreatPosition) {
        const path = Pathfinding.findPath(
          currentPos,
          retreatPosition,
          gameState
        );
        if (!path || path.length < 2) {
          return null; // Không tìm thấy đường đi
        }

        const direction = getDirectionToTarget(currentPos, path[1]!);

        return this.createDecision(
          BotAction.MOVE,
          this.priority + (DANGER_THRESHOLD - nearestDistance) / 4, // Càng gần càng ưu tiên cao
          `Phòng thủ - lui về vị trí an toàn (cách kẻ địch: ${nearestDistance.toFixed(
            0
          )}px)`,
          direction,
          retreatPosition,
          path
        );
      }
    }

    return null;
  }

  /**
   * Tìm vị trí tốt nhất để lui về, vừa an toàn vừa có lợi thế chiến thuật.
   */
  private findRetreatPosition(
    currentPos: Position,
    enemyPos: Position,
    gameState: GameState
  ): Position | null {
    const candidatePositions: Position[] = [];
    const searchRadius = 5; // Tìm kiếm trong bán kính 5 ô

    // Tạo ra các vị trí ứng viên để lui về
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        if (dx === 0 && dy === 0) continue;

        const candidate: Position = {
          x: currentPos.x + dx * CELL_SIZE,
          y: currentPos.y + dy * CELL_SIZE,
        };

        // Lọc các vị trí không hợp lệ
        if (
          candidate.x < 0 ||
          candidate.x >= gameState.map.width ||
          candidate.y < 0 ||
          candidate.y >= gameState.map.height ||
          !canMoveTo(candidate, gameState) ||
          !isPositionSafe(candidate, gameState)
        ) {
          continue;
        }
        candidatePositions.push(candidate);
      }
    }

    if (candidatePositions.length === 0) {
      return null;
    }

    // Chấm điểm và chọn vị trí tốt nhất
    let bestPosition: Position | null = null;
    let bestScore = -Infinity;

    for (const pos of candidatePositions) {
      let score = 0;

      // 1. Càng xa kẻ thù càng tốt
      const distanceFromEnemy = manhattanDistance(pos, enemyPos);
      score += distanceFromEnemy * 1.5;

      // 2. Càng gần vị trí hiện tại càng tốt (để di chuyển nhanh)
      const distanceToTravel = manhattanDistance(currentPos, pos);
      score -= distanceToTravel * 1.0;

      // 3. Thưởng cho các vị trí có nhiều đường thoát
      const escapeRoutes = [
        Direction.UP,
        Direction.DOWN,
        Direction.LEFT,
        Direction.RIGHT,
      ]
        .map((dir) => getPositionInDirection(pos, dir))
        .filter((p) => canMoveTo(p, gameState)).length;
      score += escapeRoutes * 20;

      if (score > bestScore) {
        bestScore = score;
        bestPosition = pos;
      }
    }

    return bestPosition;
  }
}
