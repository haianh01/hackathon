import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Direction,
  Position,
} from "../types";
import {
  Pathfinding,
  manhattanDistance,
  isPositionSafe,
  getDirectionToTarget,
  isPositionInDangerZone,
  // Use unified collision system
  canMoveTo,
  isBlocked,
  PLAYER_SIZE,
} from "../utils";

/**
 * Chiến thuật thông minh sử dụng pathfinding để tìm đường tối ưu
 */
export class SmartNavigationStrategy extends BaseStrategy {
  name = "SmartNavigation";
  priority = 45;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;

    // PRIORITY 1: Kiểm tra xem bot có đang ở vùng nguy hiểm không
    const isInDanger = !isPositionSafe(currentPos, gameState);

    if (isInDanger) {
      const escapeTarget = this.findEscapeTarget(gameState);

      if (escapeTarget) {
        // Thử pathfinding trước
        let path = Pathfinding.findPath(currentPos, escapeTarget, gameState);

        // Nếu pathfinding thất bại, sử dụng direct movement
        if (path.length < 2) {
          const direction = getDirectionToTarget(currentPos, escapeTarget);
          const nextPos = this.getNextPosition(currentPos, direction);

          if (isPositionSafe(nextPos, gameState)) {
            return this.createDecision(
              BotAction.MOVE,
              this.priority + 50,
              `Thoát khỏi vùng nguy hiểm - di chuyển trực tiếp`,
              direction,
              escapeTarget
            );
          }
        } else {
          const nextPos = path[1]!;
          const direction = getDirectionToTarget(currentPos, nextPos);

          return this.createDecision(
            BotAction.MOVE,
            this.priority + 50, // Ưu tiên cao hơn cho việc thoát hiểm
            `Thoát khỏi vùng nguy hiểm - di chuyển đến vị trí an toàn`,
            direction,
            escapeTarget
          );
        }
      }
    }

    // PRIORITY 2: Tìm mục tiêu tốt nhất (vật phẩm hoặc vị trí chiến thuật)
    const target = this.findBestTarget(gameState);

    if (!target) {
      return null;
    }

    // Sử dụng A* để tìm đường đi tối ưu
    let path = Pathfinding.findPath(currentPos, target, gameState);

    // Nếu pathfinding thất bại, sử dụng direct movement
    if (path.length < 2) {
      const direction = getDirectionToTarget(currentPos, target);
      const nextPos = this.getNextPosition(currentPos, direction);

      if (isPositionSafe(nextPos, gameState)) {
        return this.createDecision(
          BotAction.MOVE,
          this.priority + this.calculateTargetValue(target, gameState),
          `Điều hướng thông minh - di chuyển trực tiếp tới mục tiêu`,
          direction,
          target
        );
      } else {
        return null;
      }
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
      `Điều hướng thông minh - di chuyển theo đường tối ưu (${
        path.length - 1
      } bước)`,
      direction,
      target
    );
  }

  /**
   * Tìm mục tiêu tốt nhất để di chuyển tới
   */
  private findBestTarget(gameState: GameState): any {
    const currentPos = gameState.currentBot.position;
    const maxReasonableDistance = 20; // Giới hạn khoảng cách hợp lý
    let bestTarget = null;
    let bestScore = -1;

    // Kiểm tra tất cả vật phẩm trong phạm vi hợp lý
    for (const item of gameState.map.items) {
      if (!isPositionSafe(item.position, gameState)) {
        continue;
      }

      const distance = manhattanDistance(currentPos, item.position);

      // Bỏ qua items quá xa
      if (distance > maxReasonableDistance) {
        continue;
      }

      const itemValue = this.getItemValue(item.type);
      const score = itemValue / (distance + 1);

      if (score > bestScore) {
        bestScore = score;
        bestTarget = item.position;
      }
    }

    // Kiểm tra vị trí chiến thuật (gần tường có thể phá)
    if (!bestTarget || bestScore < 5) {
      const strategicPosition = this.findStrategicPosition(gameState);
      if (strategicPosition) {
        const distance = manhattanDistance(currentPos, strategicPosition);

        // Chỉ chọn nếu trong phạm vi hợp lý
        if (distance <= maxReasonableDistance) {
          const strategicScore = 30 / (distance + 1);

          if (strategicScore > bestScore) {
            bestTarget = strategicPosition;
          }
        }
      }
    }

    return bestTarget;
  }

  /**
   * Tìm vị trí chiến thuật tốt (gần nhiều tường có thể phá)
   */
  private findStrategicPosition(gameState: GameState): any {
    const destructibleWalls = (gameState.map.chests || []).slice();

    if (destructibleWalls.length === 0) {
      return null;
    }

    const currentPos = gameState.currentBot.position;
    const maxSearchRadius = 15; // Giới hạn phạm vi tìm kiếm

    // Tìm vị trí có thể phá nhiều tường nhất trong phạm vi hợp lý
    let bestPosition = null;
    let maxWallCount = 0;

    for (
      let x = Math.max(0, currentPos.x - maxSearchRadius);
      x <= Math.min(gameState.map.width - 1, currentPos.x + maxSearchRadius);
      x++
    ) {
      for (
        let y = Math.max(0, currentPos.y - maxSearchRadius);
        y <= Math.min(gameState.map.height - 1, currentPos.y + maxSearchRadius);
        y++
      ) {
        const position = { x, y };

        // Giới hạn khoảng cách Manhattan
        const distance = manhattanDistance(currentPos, position);
        if (distance > maxSearchRadius) {
          continue;
        }

        // Kiểm tra có thể đứng ở đây không
        const canStand =
          !gameState.map.walls.some(
            (wall) => wall.position.x === x && wall.position.y === y
          ) &&
          !(gameState.map.chests || []).some(
            (c) => c.position.x === x && c.position.y === y
          );

        if (!canStand || !isPositionSafe(position, gameState)) {
          continue;
        }

        // Đếm số tường có thể phá từ vị trí này
        const wallCount = this.countDestructibleWallsInRange(
          position,
          gameState
        );

        // Ưu tiên vị trí có nhiều tường và gần hơn
        if (wallCount > 0) {
          const score = (wallCount * 10) / (distance + 1);
          const currentBestScore =
            (maxWallCount * 10) /
            (bestPosition
              ? manhattanDistance(currentPos, bestPosition) + 1
              : 1);

          if (score > currentBestScore) {
            maxWallCount = wallCount;
            bestPosition = position;
          }
        }
      }
    }

    return maxWallCount > 0 ? bestPosition : null;
  }

  /**
   * Đếm số tường có thể phá trong phạm vi bom
   */
  private countDestructibleWallsInRange(
    position: any,
    gameState: GameState
  ): number {
    const flameRange = gameState.currentBot.flameRange;
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 }, // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }, // RIGHT
    ];

    let count = 0;

    for (const dir of directions) {
      for (let i = 1; i <= flameRange; i++) {
        const checkPos = {
          x: position.x + dir.dx * i,
          y: position.y + dir.dy * i,
        };

        const wall = gameState.map.walls.find(
          (w) => w.position.x === checkPos.x && w.position.y === checkPos.y
        );
        const chestAtPos = (gameState.map.chests || []).find(
          (c) => c.position.x === checkPos.x && c.position.y === checkPos.y
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
      case "SPEED":
        return 100;
      case "BOMB":
        return 90;
      case "FLAME":
        return 80;
      default:
        return 10;
    }
  }

  private calculateTargetValue(target: any, gameState: GameState): number {
    // Tính giá trị ưu tiên dựa trên khoảng cách và tình huống
    const distance = manhattanDistance(gameState.currentBot.position, target);
    return Math.max(0, Math.min(20, 20 - distance));
  }

  /**
   * Lấy vị trí tiếp theo theo hướng di chuyển
   */
  private getNextPosition(position: Position, direction: Direction): Position {
    switch (direction) {
      case Direction.UP:
        return { x: position.x, y: position.y - 1 };
      case Direction.DOWN:
        return { x: position.x, y: position.y + 1 };
      case Direction.LEFT:
        return { x: position.x - 1, y: position.y };
      case Direction.RIGHT:
        return { x: position.x + 1, y: position.y };
      default:
        return position;
    }
  }

  /**
   * Tìm vị trí an toàn gần nhất để thoát khỏi vùng nguy hiểm
   */
  private findEscapeTarget(gameState: GameState): any {
    const currentPos = gameState.currentBot.position;
    const map = gameState.map;

    // Tìm tất cả vị trí an toàn trong bán kính hợp lý
    const safePositions: any[] = [];
    const searchRadius = 10; // Tăng bán kính tìm kiếm

    for (
      let x = Math.max(0, currentPos.x - searchRadius);
      x <= Math.min(map.width - 1, currentPos.x + searchRadius);
      x++
    ) {
      for (
        let y = Math.max(0, currentPos.y - searchRadius);
        y <= Math.min(map.height - 1, currentPos.y + searchRadius);
        y++
      ) {
        const position = { x, y };

        // Kiểm tra có thể đứng ở đây không
        const canStand =
          !map.walls.some(
            (wall) => wall.position.x === x && wall.position.y === y
          ) &&
          !(map.chests || []).some(
            (c) => c.position.x === x && c.position.y === y
          );

        if (canStand && isPositionSafe(position, gameState)) {
          const distance = manhattanDistance(currentPos, position);

          // Ưu tiên vị trí xa bom nhất và có thể tiếp cận được
          const dangerScore = this.calculateDangerScore(position, gameState);
          safePositions.push({
            position,
            distance,
            dangerScore,
            score: (1000 - dangerScore) / (distance + 1), // Ưu tiên vị trí an toàn và gần
          });
        }
      }
    }

    if (safePositions.length === 0) {
      // Nếu không tìm thấy vị trí an toàn, tìm vị trí ít nguy hiểm nhất
      return this.findLeastDangerousPosition(gameState);
    }

    // Sắp xếp theo điểm an toàn và trả về vị trí tốt nhất
    safePositions.sort((a, b) => b.score - a.score);
    return safePositions[0].position;
  }

  /**
   * Tính điểm nguy hiểm của một vị trí (càng thấp càng an toàn)
   */
  private calculateDangerScore(position: any, gameState: GameState): number {
    let dangerScore = 0;

    for (const bomb of gameState.map.bombs) {
      const distance = manhattanDistance(position, bomb.position);

      // Điểm nguy hiểm cao nếu gần bom
      if (distance <= bomb.flameRange + 1) {
        dangerScore += (bomb.flameRange + 2 - distance) * 100;
      }
    }

    return dangerScore;
  }

  /**
   * Tìm vị trí ít nguy hiểm nhất khi không có vị trí hoàn toàn an toàn
   */
  private findLeastDangerousPosition(gameState: GameState): any {
    const currentPos = gameState.currentBot.position;
    const map = gameState.map;

    let bestPosition = null;
    let lowestDanger = Infinity;

    // Kiểm tra các ô xung quanh trong phạm vi nhỏ
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 }, // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }, // RIGHT
      { dx: -1, dy: -1 }, // UP-LEFT
      { dx: 1, dy: -1 }, // UP-RIGHT
      { dx: -1, dy: 1 }, // DOWN-LEFT
      { dx: 1, dy: 1 }, // DOWN-RIGHT
    ];

    for (const dir of directions) {
      for (let distance = 1; distance <= 3; distance++) {
        const position = {
          x: currentPos.x + dir.dx * distance,
          y: currentPos.y + dir.dy * distance,
        };

        // Kiểm tra trong bounds
        if (
          position.x < 0 ||
          position.x >= map.width ||
          position.y < 0 ||
          position.y >= map.height
        ) {
          continue;
        }

        // Kiểm tra có thể đứng ở đây không
        const canStand =
          !map.walls.some(
            (wall) =>
              wall.position.x === position.x && wall.position.y === position.y
          ) &&
          !(map.chests || []).some(
            (c) => c.position.x === position.x && c.position.y === position.y
          );

        if (canStand) {
          const dangerScore = this.calculateDangerScore(position, gameState);
          if (dangerScore < lowestDanger) {
            lowestDanger = dangerScore;
            bestPosition = position;
          }
        }
      }
    }

    return bestPosition;
  }
}
