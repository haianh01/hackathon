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

    // ✅ KIỂM TRA NGAY: Bot có đứng cạnh rương không?
    const nearbyChests = this.findNearbyChests(gameState);
    console.log(
      `💣 BombStrategy: Kiểm tra rương gần - tìm thấy ${nearbyChests.length} rương`
    );

    if (nearbyChests.length > 0) {
      console.log(
        `💣 BombStrategy: ✅ Phát hiện ${nearbyChests.length} rương trong tầm bom!`
      );
      console.log(
        `💣 BombStrategy: Vị trí bot: (${botPosition.x}, ${botPosition.y})`
      );
      console.log(`💣 BombStrategy: Rương:`, nearbyChests);

      // Kiểm tra có lối thoát không
      const escapeRoute = this.findEscapeRoute(gameState);
      if (escapeRoute && escapeRoute.length > 0) {
        console.log(`💣 BombStrategy: ✅ Có lối thoát - ĐẶT BOM!`);
        return this.createDecision(
          BotAction.BOMB,
          this.priority + 15,
          `Đặt bom phá ${nearbyChests.length} rương gần đây`
        );
      } else {
        console.log(`💣 BombStrategy: ❌ Không có lối thoát - BỎ QUA`);
      }
    }

    // Kiểm tra khả năng thoát hiểm TRƯỚC (quan trọng nhất)
    const escapeRoute = this.findEscapeRoute(gameState);
    if (!escapeRoute || escapeRoute.length === 0) {
      console.log(`💣 BombStrategy: Không có lối thoát an toàn`);
      return null; // Không đặt bom nếu không có lối thoát
    }

    // Tính điểm lợi ích của việc đặt bom
    const bombBenefit = this.calculateBombBenefit(gameState, escapeRoute);

    if (bombBenefit.score <= 0) {
      console.log(`💣 BombStrategy: ${bombBenefit.reason}`);
      return null;
    }

    return this.createDecision(
      BotAction.BOMB,
      this.priority + Math.min(bombBenefit.score, 20), // Cap max bonus at 20
      `Đặt bom: ${bombBenefit.reason}`
    );
  }
  /**
   * Tính toán lợi ích của việc đặt bom tại vị trí hiện tại
   */
  private calculateBombBenefit(
    gameState: GameState,
    escapeRoute: Position[]
  ): {
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

    // Điểm cho việc phá tường/chest (chests array)
    const destructibleWalls = affectedPositions.filter((pos) => {
      const cell = (map.chests || []).find(
        (c) => c.position.x === pos.x && c.position.y === pos.y
      );
      return cell !== undefined;
    });

    if (destructibleWalls.length > 0) {
      score += destructibleWalls.length * 30; // Tăng lên để ưu tiên phá tường
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
      score += threatenedEnemies.length * 80; // Tăng lên để ưu tiên tấn công
      reasons.push(`tấn công ${threatenedEnemies.length} địch`);
    }

    // ❌ BỎ điểm kiểm soát không gian - chỉ đặt bom khi có mục tiêu rõ ràng
    // const controlledArea = affectedPositions.length;
    // score += controlledArea * 2;

    // Trừ điểm nếu có nguy cơ tự sát
    const selfThreat = this.calculateSelfThreat(escapeRoute);
    score -= selfThreat * 20; // Giảm penalty để không quá strict

    // Kiểm tra xem có item gần đó không (tránh phá item)
    const nearbyItems = map.items.filter((item) =>
      affectedPositions.some(
        (pos) => pos.x === item.position.x && pos.y === item.position.y
      )
    );

    if (nearbyItems.length > 0) {
      score -= nearbyItems.length * 25; // Tăng penalty để tránh phá item quý
      reasons.push(`có thể phá ${nearbyItems.length} item`);
    }

    // ✅ Chỉ đặt bom khi có lý do rõ ràng (phá tường hoặc tấn công)
    if (reasons.length === 0 || score < 10) {
      return {
        score: 0, // Không đủ lý do để đặt bom
        reason: "không có mục tiêu có giá trị",
      };
    }

    return {
      score,
      reason: reasons.join(", "),
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
    // If there's a solid wall here, invalid. chests are destructible so ok.
    const solid = map.walls.find(
      (w: Wall) => w.position.x === position.x && w.position.y === position.y
    );
    if (solid && !solid.isDestructible) return false;
    // if chest exists here, it's considered destructible and thus valid to place bomb on
    return true;
  }

  /**
   * Tìm các rương gần vị trí bot (trong tầm bom)
   */
  private findNearbyChests(gameState: GameState): Position[] {
    const { currentBot, map } = gameState;
    const botPosition = currentBot.position;
    const flameRange = currentBot.flameRange;
    const nearbyChests: Position[] = [];

    // Lấy danh sách chests (có thể là chests hoặc destructibleWalls)
    const chestList = map.chests || [];
    console.log(
      "%c🤪 ~ file: bombStrategy.ts:205 [] -> chestList : ",
      "color: #aded63",
      chestList
    );

    // Kiểm tra 4 hướng chính
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 }, // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }, // RIGHT
    ];

    for (const dir of directions) {
      for (let i = 1; i <= flameRange; i++) {
        const checkPos = {
          x: botPosition.x + dir.dx * i,
          y: botPosition.y + dir.dy * i,
        };

        // Tìm chest tại vị trí này
        const chest = chestList.find(
          (c: any) => c.position.x === checkPos.x && c.position.y === checkPos.y
        );

        if (chest) {
          nearbyChests.push(chest.position);
          break; // Dừng kiểm tra hướng này (chest chặn)
        }

        // ✅ FALLBACK: Nếu không có chests, tìm destructible walls
        const destructibleWall = map.walls.find(
          (w: Wall) =>
            w.position.x === checkPos.x &&
            w.position.y === checkPos.y &&
            w.isDestructible
        );

        if (destructibleWall) {
          nearbyChests.push(destructibleWall.position);
          break; // Dừng kiểm tra hướng này
        }

        // Kiểm tra tường cứng (chặn flame)
        const solidWall = map.walls.find(
          (w: Wall) =>
            w.position.x === checkPos.x &&
            w.position.y === checkPos.y &&
            !w.isDestructible
        );

        if (solidWall) {
          break; // Dừng kiểm tra hướng này
        }
      }
    }

    return nearbyChests;
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
        // If there's a chest here, add and stop
        const chest = (map.chests || []).find(
          (c: any) => c.position.x === pos.x && c.position.y === pos.y
        );
        if (chest) {
          positions.push(pos);
          break;
        }

        const wall = map.walls.find(
          (w: Wall) => w.position.x === pos.x && w.position.y === pos.y
        );
        if (wall) {
          break;
        }

        positions.push(pos);
      }
    }

    return positions;
  }

  /**
   * Tính toán nguy cơ tự sát dựa trên escape route
   */
  private calculateSelfThreat(escapeRoute: Position[]): number {
    if (!escapeRoute || escapeRoute.length === 0) {
      return 10; // Nguy cơ cao nếu không có lối thoát
    }

    if (escapeRoute.length <= 2) {
      return 5; // Nguy cơ trung bình nếu lối thoát quá gần
    }

    return 1; // Nguy cơ thấp nếu có lối thoát tốt
  }

  /**
   * Tìm lối thoát sau khi đặt bom
   * Returns array of safe positions (not a path)
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
          if (distance <= 5) {
            // Trong phạm vi có thể thoát được
            safePositions.push(pos);
          }
        }
      }
    }

    if (safePositions.length === 0) {
      return null; // Không có vị trí an toàn
    }

    // Sắp xếp theo khoảng cách và trả về danh sách vị trí an toàn
    safePositions.sort((a, b) => {
      const distA = manhattanDistance(botPosition, a);
      const distB = manhattanDistance(botPosition, b);
      return distA - distB;
    });

    return safePositions; // Return array of safe positions
  }
}
