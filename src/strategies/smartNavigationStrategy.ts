import { BaseStrategy } from './baseStrategy';
import { GameState, BotDecision, BotAction, Direction } from '../types';
import { Pathfinding, manhattanDistance, isPositionSafe, getDirectionToTarget } from '../utils';

/**
 * Chiến thuật thông minh sử dụng pathfinding để tìm đường tối ưu
 */
export class SmartNavigationStrategy extends BaseStrategy {
  name = 'SmartNavigation';
  priority = 45;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;
    
    // Tìm mục tiêu tốt nhất (vật phẩm hoặc vị trí chiến thuật)
    const target = this.findBestTarget(gameState);
    
    if (!target) {
      return null;
    }

    // Sử dụng A* để tìm đường đi tối ưu
    const path = Pathfinding.findPath(currentPos, target, gameState);
    
    if (path.length < 2) {
      return null; // Không tìm thấy đường hoặc đã ở đích
    }

    // Lấy bước đi tiếp theo
    const nextPos = path[1]!; // path[0] là vị trí hiện tại
    const direction = getDirectionToTarget(currentPos, nextPos);
    
    // Kiểm tra bước đi có an toàn không
    if (!isPositionSafe(nextPos, gameState)) {
      return null;
    }

    return this.createDecision(
      BotAction.MOVE,
      this.priority + this.calculateTargetValue(target, gameState),
      `Điều hướng thông minh - di chuyển theo đường tối ưu (${path.length - 1} bước)`,
      direction,
      target
    );
  }

  /**
   * Tìm mục tiêu tốt nhất để di chuyển tới
   */
  private findBestTarget(gameState: GameState): any {
    const currentPos = gameState.currentBot.position;
    let bestTarget = null;
    let bestScore = -1;

    // Kiểm tra tất cả vật phẩm
    for (const item of gameState.map.items) {
      if (!isPositionSafe(item.position, gameState)) {
        continue;
      }

      const distance = manhattanDistance(currentPos, item.position);
      const itemValue = this.getItemValue(item.type);
      const score = itemValue / (distance + 1);

      if (score > bestScore) {
        bestScore = score;
        bestTarget = item.position;
      }
    }

    // Kiểm tra vị trí chiến thuật (gần tường có thể phá)
    if (!bestTarget || bestScore < 10) {
      const strategicPosition = this.findStrategicPosition(gameState);
      if (strategicPosition) {
        const distance = manhattanDistance(currentPos, strategicPosition);
        const strategicScore = 30 / (distance + 1);
        
        if (strategicScore > bestScore) {
          bestTarget = strategicPosition;
        }
      }
    }

    return bestTarget;
  }

  /**
   * Tìm vị trí chiến thuật tốt (gần nhiều tường có thể phá)
   */
  private findStrategicPosition(gameState: GameState): any {
    const destructibleWalls = gameState.map.walls.filter(wall => wall.isDestructible);
    
    if (destructibleWalls.length === 0) {
      return null;
    }

    // Tìm vị trí có thể phá nhiều tường nhất
    let bestPosition = null;
    let maxWallCount = 0;

    for (let x = 0; x < gameState.map.width; x++) {
      for (let y = 0; y < gameState.map.height; y++) {
        const position = { x, y };
        
        // Kiểm tra có thể đứng ở đây không
        const canStand = !gameState.map.walls.some(wall => 
          wall.position.x === x && wall.position.y === y
        );
        
        if (!canStand || !isPositionSafe(position, gameState)) {
          continue;
        }

        // Đếm số tường có thể phá từ vị trí này
        const wallCount = this.countDestructibleWallsInRange(position, gameState);
        
        if (wallCount > maxWallCount) {
          maxWallCount = wallCount;
          bestPosition = position;
        }
      }
    }

    return maxWallCount > 0 ? bestPosition : null;
  }

  /**
   * Đếm số tường có thể phá trong phạm vi bom
   */
  private countDestructibleWallsInRange(position: any, gameState: GameState): number {
    const flameRange = gameState.currentBot.flameRange;
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 },  // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }   // RIGHT
    ];

    let count = 0;

    for (const dir of directions) {
      for (let i = 1; i <= flameRange; i++) {
        const checkPos = {
          x: position.x + dir.dx * i,
          y: position.y + dir.dy * i
        };

        const wall = gameState.map.walls.find(w => 
          w.position.x === checkPos.x && w.position.y === checkPos.y
        );

        if (wall) {
          if (wall.isDestructible) {
            count++;
          }
          break; // Dừng kiểm tra hướng này khi gặp tường
        }
      }
    }

    return count;
  }

  private getItemValue(itemType: any): number {
    switch (itemType) {
      case 'SPEED': return 100;
      case 'BOMB': return 90;
      case 'FLAME': return 80;
      default: return 10;
    }
  }

  private calculateTargetValue(target: any, gameState: GameState): number {
    // Tính giá trị ưu tiên dựa trên khoảng cách và tình huống
    const distance = manhattanDistance(gameState.currentBot.position, target);
    return Math.max(0, Math.min(20, 20 - distance));
  }
}
