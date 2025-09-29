import { BaseStrategy } from './baseStrategy';
import { GameState, BotDecision, BotAction, Direction } from '../types';
import { manhattanDistance, isPositionSafe, canMoveTo } from '../utils';

/**
 * Chiến thuật phòng thủ - tránh xa kẻ thù và bom
 */
export class DefensiveStrategy extends BaseStrategy {
  name = 'Defensive';
  priority = 70;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;
    const enemies = gameState.enemies.filter(enemy => enemy.isAlive);
    
    if (enemies.length === 0) {
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

    // Nếu kẻ thù quá gần (dưới 3 ô), tìm cách tránh xa
    if (nearestEnemy && nearestDistance < 4) {
      const escapeDirection = this.findEscapeDirection(currentPos, nearestEnemy.position, gameState);
      
      if (escapeDirection) {
        return this.createDecision(
          BotAction.MOVE,
          this.priority + (4 - nearestDistance) * 10, // Càng gần càng ưu tiên cao
          `Phòng thủ - tránh xa kẻ thù (khoảng cách: ${nearestDistance})`,
          escapeDirection
        );
      }
    }

    return null;
  }

  /**
   * Tìm hướng thoát khỏi kẻ thù
   */
  private findEscapeDirection(currentPos: any, enemyPos: any, gameState: GameState): Direction | null {
    const directions = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    let bestDirection = null;
    let maxDistance = -1;

    for (const direction of directions) {
      const newPos = this.getPositionInDirection(currentPos, direction);
      
      if (!canMoveTo(newPos, gameState) || !isPositionSafe(newPos, gameState)) {
        continue;
      }

      const distanceFromEnemy = manhattanDistance(newPos, enemyPos);
      
      if (distanceFromEnemy > maxDistance) {
        maxDistance = distanceFromEnemy;
        bestDirection = direction;
      }
    }

    return bestDirection;
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
