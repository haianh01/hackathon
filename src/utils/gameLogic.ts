import { GameState, Position, Direction, Wall, Bomb } from "../types";
import {
  getPositionInDirection,
  positionsEqual,
  getPositionsInLine,
} from "./position";

/**
 * Kiểm tra xem vị trí có bị tường chặn không
 */
export function isPositionBlocked(
  position: Position,
  gameState: GameState
): boolean {
  return gameState.map.walls.some((wall) =>
    positionsEqual(wall.position, position)
  );
}

/**
 * Kiểm tra xem vị trí có an toàn (không bị bom nổ) không
 */
export function isPositionSafe(
  position: Position,
  gameState: GameState
): boolean {
  return !isPositionInDangerZone(position, gameState);
}

/**
 * Kiểm tra xem vị trí có nằm trong vùng nguy hiểm của bom không
 */
export function isPositionInDangerZone(
  position: Position,
  gameState: GameState
): boolean {
  for (const bomb of gameState.map.bombs) {
    if (isPositionInBombRange(position, bomb, gameState)) {
      return true;
    }
  }
  return false;
}

/**
 * Kiểm tra xem vị trí có nằm trong phạm vi nổ của bom không
 */
export function isPositionInBombRange(
  position: Position,
  bomb: Bomb,
  gameState: GameState
): boolean {
  // Kiểm tra cùng vị trí với bom
  if (positionsEqual(position, bomb.position)) {
    return true;
  }

  // Kiểm tra 4 hướng từ bom
  const directions = [
    Direction.UP,
    Direction.DOWN,
    Direction.LEFT,
    Direction.RIGHT,
  ];

  for (const direction of directions) {
    const flamePositions = getPositionsInLine(
      bomb.position,
      direction,
      bomb.flameRange
    );

    for (const flamePos of flamePositions) {
      // Nếu gặp tường thì ngừng lan truyền
      if (isPositionBlocked(flamePos, gameState)) {
        break;
      }

      if (positionsEqual(position, flamePos)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Lấy tất cả vị trí an toàn xung quanh vị trí hiện tại
 */
export function getSafeAdjacentPositions(
  position: Position,
  gameState: GameState
): Position[] {
  const directions = [
    Direction.UP,
    Direction.DOWN,
    Direction.LEFT,
    Direction.RIGHT,
  ];
  const safePositions: Position[] = [];

  for (const direction of directions) {
    const newPos = getPositionInDirection(position, direction);

    if (
      !isPositionBlocked(newPos, gameState) &&
      isPositionSafe(newPos, gameState)
    ) {
      safePositions.push(newPos);
    }
  }

  return safePositions;
}

/**
 * Kiểm tra xem có thể di chuyển đến vị trí không
 */
export function canMoveTo(position: Position, gameState: GameState): boolean {
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
  if (isPositionBlocked(position, gameState)) {
    return false;
  }

  // Kiểm tra không có bot khác
  if (
    gameState.enemies.some((enemy) => positionsEqual(enemy.position, position))
  ) {
    return false;
  }

  return true;
}

/**
 * Tính điểm số của việc đặt bom tại vị trí
 */
export function calculateBombScore(
  position: Position,
  gameState: GameState
): number {
  let score = 0;
  const directions = [
    Direction.UP,
    Direction.DOWN,
    Direction.LEFT,
    Direction.RIGHT,
  ];

  for (const direction of directions) {
    const flamePositions = getPositionsInLine(
      position,
      direction,
      gameState.currentBot.flameRange
    );

    for (const flamePos of flamePositions) {
      // Nếu gặp tường không phá được thì dừng
      const wall = gameState.map.walls.find((w) =>
        positionsEqual(w.position, flamePos)
      );
      if (wall && !wall.isDestructible) {
        break;
      }

      // Điểm cho việc phá tường
      if (wall && wall.isDestructible) {
        score += 50;
        break; // Tường sẽ chặn flame tiếp tục
      }

      // Điểm cho việc hạ gục enemy
      const enemy = gameState.enemies.find((e) =>
        positionsEqual(e.position, flamePos)
      );
      if (enemy) {
        score += 1000;
      }

      // Điểm cho việc phá item
      const item = gameState.map.items.find((i) =>
        positionsEqual(i.position, flamePos)
      );
      if (item) {
        score += 10;
      }
    }
  }

  return score;
}

/**
 * Kiểm tra xem vị trí có va chạm với tường hoặc rương không
 * Dùng cho pixel-level collision detection
 */
export function isPositionCollidingWithWalls(
  position: Position,
  gameState: GameState,
  botSize: number = 30 // Default bot size
): boolean {
  // Kiểm tra va chạm với mỗi tường/rương
  for (const wall of gameState.map.walls) {
    if (checkBoxCollision(position, botSize, wall.position, 40)) {
      return true;
    }
  }
  return false;
}

/**
 * Kiểm tra va chạm giữa 2 hình chữ nhật (box collision)
 */
function checkBoxCollision(
  pos1: Position,
  size1: number,
  pos2: Position,
  size2: number
): boolean {
  return (
    pos1.x < pos2.x + size2 &&
    pos1.x + size1 > pos2.x &&
    pos1.y < pos2.y + size2 &&
    pos1.y + size1 > pos2.y
  );
}

/**
 * Kiểm tra xem có thể di chuyển đến vị trí predicted không
 * (với pixel-level precision)
 */
export function canMoveToPositionPrecise(
  position: Position,
  gameState: GameState
): boolean {
  // Kiểm tra nằm trong bản đồ
  if (
    position.x < 0 ||
    position.x >= gameState.map.width ||
    position.y < 0 ||
    position.y >= gameState.map.height
  ) {
    return false;
  }

  // Kiểm tra không va chạm với tường
  if (isPositionCollidingWithWalls(position, gameState)) {
    return false;
  }

  return true;
}
