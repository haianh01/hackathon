import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Position,
  Direction,
  Wall,
} from "../types";
import { manhattanDistance, isPositionInBounds } from "../utils/position";
import { Pathfinding } from "../utils/pathfinding";

/**
 * Strategy đặt bom thông minh
 * Đặt bom khi:
 * 1. Có thể phá tường/chest gần đó
 * 2. Có thể tấn công địch
 * 3. Có thể tạo lối thoát an toàn
 */
export class BombStrategy extends BaseStrategy {
  name = "BombStrategy";
  priority = 80; // Ưu tiên cao

  evaluate(gameState: GameState): BotDecision | null {
    const { currentBot, map } = gameState;
    const botPosition = currentBot.position;

    // Kiểm tra xem bot có thể đặt bom không
    if (currentBot.bombCount <= 0) {
      return null;
    }

    // Kiểm tra xem có bom nào tại vị trí hiện tại không
    const bombAtPosition = map.bombs.find(
      (bomb) =>
        bomb.position.x === botPosition.x && bomb.position.y === botPosition.y
    );
    if (bombAtPosition) {
      return null; // Không đặt bom nếu đã có bom tại vị trí này
    }

    // Tính điểm lợi ích của việc đặt bom
    const bombBenefit = this.calculateBombBenefit(gameState);

    if (bombBenefit.score <= 0) {
      return null;
    }

    // Kiểm tra khả năng thoát hiểm sau khi đặt bom
    const escapeRoute = this.findEscapeRoute(gameState);
    if (!escapeRoute) {
      return null; // Không đặt bom nếu không có lối thoát
    }

    return this.createDecision(
      BotAction.BOMB,
      this.priority + bombBenefit.score,
      `Đặt bom tại (${botPosition.x}, ${botPosition.y}): ${bombBenefit.reason}`
    );
  }
  /**
   * Tính toán lợi ích của việc đặt bom tại vị trí hiện tại
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

    // Kiểm tra các ô trong tầm nổ
    const affectedPositions = this.getAffectedPositions(
      botPosition,
      flameRange,
      map
    );

    // Điểm cho việc phá tường/chest
    const destructibleWalls = affectedPositions.filter((pos) => {
      const cell = map.walls.find(
        (wall) =>
          wall.position.x === pos.x &&
          wall.position.y === pos.y &&
          wall.isDestructible
      );
      return cell !== undefined;
    });

    if (destructibleWalls.length > 0) {
      score += destructibleWalls.length * 20;
      reasons.push(`phá ${destructibleWalls.length} tường`);
    }

    // Điểm cho việc tấn công địch
    const threatenedEnemies = enemies.filter((enemy) => {
      if (!enemy.isAlive) return false;
      return affectedPositions.some(
        (pos) => pos.x === enemy.position.x && pos.y === enemy.position.y
      );
    });

    if (threatenedEnemies.length > 0) {
      score += threatenedEnemies.length * 50;
      reasons.push(`tấn công ${threatenedEnemies.length} địch`);
    }

    // Điểm cho việc kiểm soát không gian
    const controlledArea = affectedPositions.length;
    score += controlledArea * 2;

    // Trừ điểm nếu có nguy cơ tự sát
    const selfThreat = this.calculateSelfThreat(gameState, affectedPositions);
    score -= selfThreat * 30;

    // Kiểm tra xem có item gần đó không (tránh phá item)
    const nearbyItems = map.items.filter((item) =>
      affectedPositions.some(
        (pos) => pos.x === item.position.x && pos.y === item.position.y
      )
    );

    if (nearbyItems.length > 0) {
      score -= nearbyItems.length * 15; // Trừ điểm nếu có thể phá item
      reasons.push(`có thể phá ${nearbyItems.length} item`);
    }

    return {
      score,
      reason: reasons.length > 0 ? reasons.join(", ") : "kiểm soát khu vực",
    };
  }

  /**
   * Kiểm tra vị trí có hợp lệ không
   */
  private isValidPosition(position: Position, map: any): boolean {
    // Kiểm tra trong bounds
    if (!isPositionInBounds(position, map.width, map.height)) {
      return false;
    }

    // Kiểm tra có tường không
    const wall = map.walls.find(
      (w: Wall) => w.position.x === position.x && w.position.y === position.y
    );

    return !wall || wall.isDestructible;
  }

  /**
   * Lấy tất cả các vị trí bị ảnh hưởng bởi bom
   */
  private getAffectedPositions(
    bombPosition: Position,
    flameRange: number,
    map: any
  ): Position[] {
    const positions: Position[] = [bombPosition];

    // Kiểm tra 4 hướng
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 }, // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }, // RIGHT
    ];

    for (const dir of directions) {
      for (let i = 1; i <= flameRange; i++) {
        const pos = {
          x: bombPosition.x + dir.dx * i,
          y: bombPosition.y + dir.dy * i,
        };

        if (!this.isValidPosition(pos, map)) {
          break; // Vượt ra ngoài map
        }

        // Kiểm tra xem có tường không thể phá không
        const wall = map.walls.find(
          (w: Wall) => w.position.x === pos.x && w.position.y === pos.y
        );

        if (wall) {
          if (wall.isDestructible) {
            positions.push(pos); // Thêm tường có thể phá
          }
          break; // Dừng lại khi gặp tường
        }

        positions.push(pos);
      }
    }

    return positions;
  }

  /**
   * Tính toán nguy cơ tự sát
   */
  private calculateSelfThreat(
    gameState: GameState,
    affectedPositions: Position[]
  ): number {
    const { currentBot } = gameState;
    const botPosition = currentBot.position;

    // Bot luôn ở vị trí đặt bom, nhưng có thể di chuyển ra
    // Giảm penalty vì bot có thể thoát
    return 0.3; // Giảm xuống để không quá strict
  }

  /**
   * Tìm lối thoát sau khi đặt bom
   */
  private findEscapeRoute(gameState: GameState): Position[] | null {
    const { currentBot, map } = gameState;
    const botPosition = currentBot.position;
    const flameRange = currentBot.flameRange;

    // Mô phỏng đặt bom tại vị trí hiện tại
    const dangerousPositions = this.getAffectedPositions(
      botPosition,
      flameRange,
      map
    );

    // Tìm các vị trí an toàn gần nhất
    const safePositions: Position[] = [];

    // Kiểm tra các ô xung quanh trong phạm vi có thể di chuyển
    for (let x = 0; x < map.width; x++) {
      for (let y = 0; y < map.height; y++) {
        const pos = { x, y };

        // Kiểm tra vị trí có an toàn không
        const isDangerous = dangerousPositions.some(
          (dangerPos) => dangerPos.x === pos.x && dangerPos.y === pos.y
        );

        if (!isDangerous && this.isValidPosition(pos, map)) {
          const distance = manhattanDistance(botPosition, pos);
          if (distance <= 4) {
            // Trong phạm vi có thể thoát được
            safePositions.push(pos);
          }
        }
      }
    }

    if (safePositions.length === 0) {
      return null; // Không có vị trí an toàn
    }

    // Tìm đường đi ngắn nhất đến vị trí an toàn gần nhất
    const nearestSafePosition = safePositions.reduce((nearest, pos) => {
      const currentDistance = manhattanDistance(botPosition, pos);
      const nearestDistance = manhattanDistance(botPosition, nearest);
      return currentDistance < nearestDistance ? pos : nearest;
    });

    return Pathfinding.findPath(botPosition, nearestSafePosition, gameState);
  }
}
