import { BaseStrategy } from "./baseStrategy";
import { GameState, BotDecision, BotAction, Direction } from "../types";
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
        const newPos = this.getPositionInDirection(currentPos, direction);
        if (this.canMoveTo(newPos, gameState)) {
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
    const direction = this.getDirectionToTarget(currentPos, targetPos);

    return this.createDecision(
      BotAction.MOVE,
      this.priority,
      "Thoát hiểm - di chuyển đến vị trí an toàn",
      direction,
      targetPos
    );
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

  private canMoveTo(position: any, gameState: GameState): boolean {
    // Kiểm tra nằm trong bản đồ
    if (
      position.x < 0 ||
      position.x >= gameState.map.width ||
      position.y < 0 ||
      position.y >= gameState.map.height
    ) {
      return false;
    }

    // Kiểm tra không bị tường chặn
    if (
      gameState.map.walls.some(
        (wall) =>
          wall.position.x === position.x && wall.position.y === position.y
      )
    ) {
      return false;
    }

    return true;
  }

  private getDirectionToTarget(from: any, to: any): Direction {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }
  }
}
