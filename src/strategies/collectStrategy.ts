import { BaseStrategy } from "./baseStrategy";
import { GameState, BotDecision, BotAction, ItemType, Item } from "../types";
import {
  manhattanDistance,
  isPositionSafe,
  pixelToCell,
  Pathfinding,
  getDirectionToTarget,
} from "../utils";
import { calculatePriority } from "./calculatePriority";

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
      console.log(`🎁 CollectStrategy: Không có item trên map`);
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

    // Tìm đường đi đến vật phẩm bằng Pathfinder
    const path = Pathfinding.findPath(
      pixelToCell(currentPos),
      pixelToCell(bestItem.position),
      gameState
    );

    if (!path || path.length === 0) {
      console.log(
        `🎁 CollectStrategy: Không tìm thấy đường đi đến ${bestItem.type}`
      );
      return null;
    }

    // ✅ NORMALIZED PRIORITY
    const priority = this.calculateCollectPriority(
      bestItem,
      bestDistance,
      gameState
    );

    return this.createDecision(
      BotAction.MOVE,
      priority,
      `Collecting item ${bestItem.type} (distance: ${bestDistance})`,
      direction,
      bestItem.position,
      path
    );
  }

  private calculateCollectPriority(
    item: Item,
    distance: number,
    gameState: GameState
  ): number {
    const base = this.priority; // 60

    // VALUE: Item importance [0-30]
    const itemValue = this.getItemScore(item.type, gameState);
    const value = Math.floor((itemValue / 100) * 30); // Normalize to [0-30]

    // DISTANCE: Distance penalty [-10 to +10]
    // Close items (+10), far items (-10)
    const maxDistance = 400; // 10 cells
    const distanceRatio = Math.min(distance / maxDistance, 1);
    const distanceScore = Math.floor(10 - distanceRatio * 20); // [10 to -10]

    // URGENCY: Competition [0-20]
    const nearbyEnemies = gameState.enemies.filter(
      (e) => manhattanDistance(e.position, item.position) < distance
    ).length;
    const urgency = Math.min(nearbyEnemies * 10, 20);

    // SAFETY: Position safety [-20 to +10]
    const isSafe = isPositionSafe(item.position, gameState);
    const safety = isSafe ? 0 : -20;

    // PENALTY: Already have similar items [-30 to 0]
    const penalty = this.getItemPenalty(item.type, gameState);

    return calculatePriority({
      base,
      value: value,
      distance: distanceScore,
      urgency,
      safety,
      penalty,
    });
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

  private getItemPenalty(type: ItemType, gameState: GameState): number {
    const bot = gameState.currentBot;

    switch (type) {
      case ItemType.SPEED:
        return bot.speed >= 3 ? -20 : 0; // Already max speed
      case ItemType.BOMB_COUNT:
        return bot.bombCount >= 5 ? -15 : 0; // Too many bombs
      default:
        return 0;
    }
  }
}
