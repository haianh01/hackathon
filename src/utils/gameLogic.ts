import { GameState, Position, Direction, Wall, Bomb } from "../types";
import {
  getPositionInDirection,
  positionsEqual,
  getPositionsInLine,
} from "./position";
import { isWithinPixelBounds } from "./coordinates";

/**
 * Kiểm tra xem vị trí có bị tường chặn không
 */
export function isPositionBlocked(
  position: Position,
  gameState: GameState
): boolean {
  const OBJECT_SIZE = 40; // Standard object size in pixels
  const TOLERANCE = 20; // Half object size for overlap detection

  // Check solid walls with overlap detection
  const solidWall = gameState.map.walls.some(
    (wall) =>
      Math.abs(wall.position.x - position.x) < TOLERANCE &&
      Math.abs(wall.position.y - position.y) < TOLERANCE
  );

  // Check chests with overlap detection
  const chest = (gameState.map.chests || []).some(
    (c) =>
      Math.abs(c.position.x - position.x) < TOLERANCE &&
      Math.abs(c.position.y - position.y) < TOLERANCE
  );

  if (solidWall || chest) {
    console.log(
      `🚧 Position (${position.x}, ${position.y}) is BLOCKED by ${
        solidWall ? "wall" : "chest"
      }`
    );
    if (chest) {
      const blockingChest = (gameState.map.chests || []).find(
        (c) =>
          Math.abs(c.position.x - position.x) < TOLERANCE &&
          Math.abs(c.position.y - position.y) < TOLERANCE
      );
      if (blockingChest) {
        console.log(
          `  Blocking chest at: (${blockingChest.position.x}, ${blockingChest.position.y})`
        );
      }
    }
  }

  return solidWall || chest;
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
  const FLAME_TOLERANCE = 20; // Half cell size for flame overlap detection

  // Kiểm tra cùng vị trí với bom (với tolerance)
  if (
    Math.abs(position.x - bomb.position.x) < FLAME_TOLERANCE &&
    Math.abs(position.y - bomb.position.y) < FLAME_TOLERANCE
  ) {
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
      // Check if position overlaps with flame position
      if (
        Math.abs(position.x - flamePos.x) < FLAME_TOLERANCE &&
        Math.abs(position.y - flamePos.y) < FLAME_TOLERANCE
      ) {
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
 * Kiểm tra xem có thể di chuyển đến vị trí không
 * Uses pixel coordinates for precise bounds checking
 */
export function canMoveTo(position: Position, gameState: GameState): boolean {
  // Check if within map bounds (pixel-based)
  if (
    !isWithinPixelBounds(position, gameState.map.width, gameState.map.height)
  ) {
    return false;
  }

  // Check if blocked by walls or chests
  if (isPositionBlocked(position, gameState)) {
    return false;
  }

  // Check if another bot is at this position with overlap detection
  const PLAYER_SIZE = 30; // Player collision size (smaller than objects)
  if (
    gameState.enemies.some(
      (enemy) =>
        Math.abs(enemy.position.x - position.x) < PLAYER_SIZE &&
        Math.abs(enemy.position.y - position.y) < PLAYER_SIZE
    )
  ) {
    console.log(
      `🤖 Position (${position.x}, ${position.y}) is BLOCKED by enemy player`
    );
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
  if (
    !isWithinPixelBounds(position, gameState.map.width, gameState.map.height)
  ) {
    return false;
  }

  // Check for wall collision
  if (isPositionCollidingWithWalls(position, gameState)) {
    return false;
  }

  return true;
}
