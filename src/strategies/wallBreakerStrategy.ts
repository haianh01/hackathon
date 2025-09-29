import { BaseStrategy } from './baseStrategy';
import { GameState, BotDecision, BotAction } from '../types';
import { calculateBombScore, isPositionSafe } from '../utils';

/**
 * Chiến thuật phá tường - tìm và phá các tường có thể phá để tìm vật phẩm
 */
export class WallBreakerStrategy extends BaseStrategy {
  name = 'WallBreaker';
  priority = 50;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;
    
    // Kiểm tra xem có thể đặt bom không
    if (gameState.currentBot.bombCount <= 0) {
      return null;
    }

    // Tìm tường có thể phá gần vị trí hiện tại
    const destructibleWalls = gameState.map.walls.filter(wall => wall.isDestructible);
    
    if (destructibleWalls.length === 0) {
      return null;
    }

    // Tính điểm số cho việc đặt bom tại vị trí hiện tại
    const bombScore = calculateBombScore(currentPos, gameState);
    
    // Chỉ đặt bom nếu có thể phá ít nhất 1 tường
    const canBreakWalls = this.canBreakWalls(currentPos, gameState);
    
    if (!canBreakWalls || bombScore < 50) {
      return null;
    }

    // Kiểm tra có thể thoát sau khi đặt bom không
    if (!this.canEscapeAfterBomb(currentPos, gameState)) {
      return null;
    }

    return this.createDecision(
      BotAction.BOMB,
      this.priority,
      `Phá tường - đặt bom để phá tường (điểm: ${bombScore})`
    );
  }

  /**
   * Kiểm tra xem có thể phá được tường không
   */
  private canBreakWalls(bombPosition: any, gameState: GameState): boolean {
    const flameRange = gameState.currentBot.flameRange;
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 },  // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }   // RIGHT
    ];

    for (const dir of directions) {
      for (let i = 1; i <= flameRange; i++) {
        const checkPos = {
          x: bombPosition.x + dir.dx * i,
          y: bombPosition.y + dir.dy * i
        };

        // Kiểm tra xem có tường phá được không
        const wall = gameState.map.walls.find(w => 
          w.position.x === checkPos.x && 
          w.position.y === checkPos.y
        );

        if (wall) {
          if (wall.isDestructible) {
            return true; // Tìm thấy tường có thể phá
          } else {
            break; // Gặp tường không phá được, dừng kiểm tra hướng này
          }
        }
      }
    }

    return false;
  }

  /**
   * Kiểm tra có thể thoát sau khi đặt bom không
   */
  private canEscapeAfterBomb(bombPosition: any, gameState: GameState): boolean {
    // Mô phỏng việc đặt bom
    const simulatedBomb = {
      id: 'temp-wallbreaker',
      position: bombPosition,
      ownerId: gameState.currentBot.id,
      timeRemaining: 5000,
      flameRange: gameState.currentBot.flameRange
    };

    const tempGameState = {
      ...gameState,
      map: {
        ...gameState.map,
        bombs: [...gameState.map.bombs, simulatedBomb]
      }
    };

    // Kiểm tra các vị trí xung quanh có an toàn không
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 },  // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }   // RIGHT
    ];

    for (const dir of directions) {
      for (let step = 1; step <= 3; step++) {
        const escapePos = {
          x: bombPosition.x + dir.dx * step,
          y: bombPosition.y + dir.dy * step
        };

        // Kiểm tra có thể di chuyển đến vị trí này không
        if (escapePos.x < 0 || escapePos.x >= gameState.map.width ||
            escapePos.y < 0 || escapePos.y >= gameState.map.height) {
          break;
        }

        // Kiểm tra không bị tường chặn
        const hasWall = gameState.map.walls.some(wall =>
          wall.position.x === escapePos.x && wall.position.y === escapePos.y
        );

        if (hasWall) {
          break;
        }

        // Kiểm tra vị trí có an toàn không
        if (isPositionSafe(escapePos, tempGameState)) {
          return true;
        }
      }
    }

    return false;
  }
}
