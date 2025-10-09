import { BaseStrategy } from "./baseStrategy";
import { GameState, BotDecision, BotAction, Direction } from "../types";
import { getPositionInDirection, canMoveTo } from "../utils";
import {
  calculateBombScore,
  isPositionSafe,
  getPositionsInLine,
} from "../utils";

/**
 * Chiến thuật tấn công - đặt bom để hạ gục kẻ thù
 */
export class AttackStrategy extends BaseStrategy {
  name = "Attack";
  priority = 80;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;

    // Kiểm tra xem có thể đặt bom không
    if (gameState.currentBot.bombCount <= 0) {
      console.log(
        `💣 AttackStrategy: Không có bom (bombCount: ${gameState.currentBot.bombCount})`
      );
      return null;
    }

    // Tính điểm số của việc đặt bom tại vị trí hiện tại
    const bombScore = calculateBombScore(currentPos, gameState);

    // Chỉ đặt bom nếu có khả năng hạ gục kẻ thù hoặc phá được nhiều vật
    if (bombScore < 100) {
      console.log(
        `💣 AttackStrategy: Điểm bom quá thấp (score: ${bombScore}, cần >= 100)`
      );
      return null;
    }

    // Kiểm tra xem có thể thoát khỏi vùng nổ sau khi đặt bom không
    if (!this.canEscapeAfterBomb(currentPos, gameState)) {
      return null;
    }

    return this.createDecision(
      BotAction.BOMB,
      this.priority + Math.floor(bombScore / 100), // Tăng priority dựa trên điểm số
      `Tấn công - đặt bom (điểm: ${bombScore})`
    );
  }

  /**
   * Kiểm tra xem có thể thoát khỏi vùng nổ sau khi đặt bom không
   */
  private canEscapeAfterBomb(bombPosition: any, gameState: GameState): boolean {
    // Mô phỏng bom được đặt
    const simulatedBomb = {
      id: "temp",
      position: bombPosition,
      ownerId: gameState.currentBot.id,
      timeRemaining: 5000, // 5 giây
      flameRange: gameState.currentBot.flameRange,
    };

    // Thêm bom vào state tạm thời
    const tempGameState = {
      ...gameState,
      map: {
        ...gameState.map,
        bombs: [...gameState.map.bombs, simulatedBomb],
      },
    };

    // Kiểm tra tất cả các vị trí lân cận
    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];

    for (const direction of directions) {
      let currentPos = { ...bombPosition };

      // Thử di chuyển tối đa 3 bước (dựa trên tốc độ tối đa)
      for (let step = 1; step <= 3; step++) {
        currentPos = getPositionInDirection(currentPos, direction);

        // Kiểm tra có thể di chuyển đến vị trí này không
        if (!canMoveTo(currentPos, gameState)) {
          break;
        }

        // Kiểm tra vị trí này có an toàn không (không bị bom nổ)
        if (isPositionSafe(currentPos, tempGameState)) {
          return true;
        }
      }
    }

    return false;
  }
}
