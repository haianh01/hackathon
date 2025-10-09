import { BaseStrategy } from "./baseStrategy";
import { GameState, BotDecision, BotAction, Direction } from "../types";
import {
  getPositionInDirection,
  canMoveTo,
  getDirectionToTarget,
} from "../utils";
import {
  isPositionSafe,
  getSafeAdjacentPositions,
  isPositionInDangerZone,
} from "../utils";

/**
 * Chiến thuật thoát hiểm khi đang ở vùng nguy hiểm
 */
export class EscapeStrategy extends BaseStrategy {
  name = "Escape";
  priority = 100; // Ưu tiên cao nhất

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;

    // Kiểm tra xem có đang ở vùng nguy hiểm không
    if (!isPositionInDangerZone(currentPos, gameState)) {
      console.log(
        `🛡️ EscapeStrategy: Không ở vùng nguy hiểm (${gameState.map.bombs.length} bom trên map)`
      );
      return null;
    }

    // Tìm vị trí an toàn gần nhất
    const safePositions = getSafeAdjacentPositions(currentPos, gameState);

    if (safePositions.length === 0) {
      // Không có vị trí an toàn lân cận, thử tất cả hướng
      const directions = [
        Direction.UP,
        Direction.DOWN,
        Direction.LEFT,
        Direction.RIGHT,
      ];

      for (const direction of directions) {
        const newPos = getPositionInDirection(currentPos, direction);
        if (canMoveTo(newPos, gameState)) {
          return this.createDecision(
            BotAction.MOVE,
            this.priority,
            "Thoát hiểm - di chuyển khỏi vùng nguy hiểm",
            direction
          );
        }
      }

      // Nếu không thể di chuyển, đứng yên
      return this.createDecision(
        BotAction.STOP,
        this.priority,
        "Thoát hiểm - không thể di chuyển, đứng yên",
        Direction.STOP
      );
    }

    // Chọn vị trí an toàn đầu tiên
    const targetPos = safePositions[0]!;
    const direction = getDirectionToTarget(currentPos, targetPos);

    return this.createDecision(
      BotAction.MOVE,
      this.priority,
      "Thoát hiểm - di chuyển đến vị trí an toàn",
      direction,
      targetPos
    );
  }
}
