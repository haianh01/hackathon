import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Direction,
  ItemType,
} from "../types";
import {
  manhattanDistance,
  isPositionSafe,
  canMoveTo,
  getDirectionToTarget,
} from "../utils";

/**
 * Chiến thuật thu thập vật phẩm
 */
export class CollectStrategy extends BaseStrategy {
  name = "Collect";
  priority = 60;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;
    const items = gameState.map.items;

    if (items.length === 0) {
      return null;
    }

    // Tìm vật phẩm gần nhất và có giá trị
    let bestItem = null;
    let bestDistance = Infinity;
    let bestScore = 0;

    for (const item of items) {
      // Kiểm tra vật phẩm có ở vị trí an toàn không
      if (!isPositionSafe(item.position, gameState)) {
        continue;
      }

      const distance = manhattanDistance(currentPos, item.position);
      const itemScore = this.getItemScore(item.type, gameState);

      // Tính điểm tổng hợp (ưu tiên vật phẩm có giá trị cao và gần)
      const totalScore = itemScore / (distance + 1);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestItem = item;
        bestDistance = distance;
      }
    }

    if (!bestItem || bestScore < 5) {
      return null;
    }

    // Tìm đường đi đến vật phẩm
    const direction = getDirectionToTarget(currentPos, bestItem.position);
    const nextPos = this.getPositionInDirection(currentPos, direction);

    // Kiểm tra có thể di chuyển đến vị trí tiếp theo không
    if (!canMoveTo(nextPos, gameState)) {
      return null;
    }

    return this.createDecision(
      BotAction.MOVE,
      this.priority + Math.floor(bestScore),
      `Thu thập vật phẩm ${bestItem.type} (khoảng cách: ${bestDistance})`,
      direction,
      bestItem.position
    );
  }

  /**
   * Tính điểm giá trị của vật phẩm
   */
  private getItemScore(itemType: ItemType, gameState: GameState): number {
    const bot = gameState.currentBot;

    switch (itemType) {
      case ItemType.SPEED:
        // Item tăng tốc độ có giá trị cao nếu tốc độ chưa đạt tối đa
        return bot.speed < 3 ? 100 : 20;

      case ItemType.EXPLOSION_RANGE:
        // Item tăng phạm vi nổ luôn có giá trị
        return 80;

      case ItemType.BOMB_COUNT:
        // Item tăng số lượng bom có giá trị nếu chưa có nhiều bom
        return bot.bombCount < 3 ? 90 : 30;

      default:
        return 10;
    }
  }

  private getPositionInDirection(position: any, direction: Direction): any {
    const newPos = { ...position };

    switch (direction) {
      case Direction.UP:
        newPos.y -= 1;
        break;
      case Direction.DOWN:
        newPos.y += 1;
        break;
      case Direction.LEFT:
        newPos.x -= 1;
        break;
      case Direction.RIGHT:
        newPos.x += 1;
        break;
    }

    return newPos;
  }
}
