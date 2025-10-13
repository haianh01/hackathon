import { GameState, Position, Direction, Wall, Bomb } from "../types";
import {
  getPositionInDirection,
  positionsEqual,
  getPositionsInLine,
} from "./position";
import {
  isWithinBounds,
  isBlocked,
  canMoveTo as canMoveToUnified,
  PLAYER_SIZE,
} from "./constants";

/**
 * @deprecated Use constants.isBlocked instead
 * Kiểm tra xem vị trí có bị tường chặn không
 */
export function isPositionBlocked(
  position: Position,
  gameState: GameState
): boolean {
  console.log(
    `⚠️ Using deprecated isPositionBlocked, switch to constants.isBlocked`
  );
  return isBlocked(position, gameState, PLAYER_SIZE);
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
 * Sử dụng AABB collision để check toàn bộ bot hitbox (30x30px)
 */
export function isPositionInBombRange(
  position: Position,
  bomb: Bomb,
  gameState: GameState
): boolean {
  const CELL_SIZE = 40; // Flame cell size
  const PLAYER_SIZE = 30; // Bot hitbox size

  // Kiểm tra collision với bomb center (bomb occupies full cell)
  if (checkBoxCollision(position, PLAYER_SIZE, bomb.position, CELL_SIZE)) {
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
      // Check AABB collision: Bot (30x30px) vs Flame cell (40x40px)
      if (checkBoxCollision(position, PLAYER_SIZE, flamePos, CELL_SIZE)) {
        return true;
      }

      // Nếu gặp tường cứng thì ngừng lan truyền; nếu gặp chest thì chest bị ảnh hưởng
      // chest _vẫn_ chặn flame tiếp tục vì chest có kích thước ô
      if (isPositionBlocked(flamePos, gameState)) {
        break;
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
 * @deprecated Use constants.canMoveTo instead
 * Kiểm tra xem có thể di chuyển đến vị trí không
 * Uses pixel coordinates for precise bounds checking
 */
export function canMoveTo(position: Position, gameState: GameState): boolean {
  console.log(`⚠️ Using deprecated canMoveTo, switch to constants.canMoveTo`);
  return canMoveToUnified(position, gameState, PLAYER_SIZE);
}

/**
 * Tính điểm số của việc đặt bom tại vị trí
 * Sử dụng AABB collision để detect chính xác enemies/items trong flame
 */
export function calculateBombScore(
  position: Position,
  gameState: GameState
): number {
  let score = 0;
  const CELL_SIZE = 40;
  const PLAYER_SIZE = 30;
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

      // Điểm cho việc hạ gục enemy (dùng AABB collision)
      const enemy = gameState.enemies.find((e) =>
        checkBoxCollision(e.position, PLAYER_SIZE, flamePos, CELL_SIZE)
      );
      if (enemy) {
        score += 1000;
      }

      // Điểm cho việc phá item (dùng AABB collision với item size 20px)
      const item = gameState.map.items.find((i) =>
        checkBoxCollision(i.position, 20, flamePos, CELL_SIZE)
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
  for (const chest of gameState.map.chests || []) {
    if (checkBoxCollision(position, botSize, chest.position, 40)) {
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
  // Check if within map bounds (pixel-based)
  if (!isWithinBounds(position, gameState.map.width, gameState.map.height)) {
    return false;
  }

  // Check for wall collision using unified system
  if (isBlocked(position, gameState)) {
    return false;
  }

  return true;
}
