import { Position, Direction } from "../types";
import { CELL_SIZE, MOVE_STEP_SIZE } from "./constants";
import { botTopLeftToCenter, COORDINATE_CONFIG } from "./coordinates";

/**
 * Tính khoảng cách Manhattan giữa hai điểm
 */
export function manhattanDistance(pos1: Position, pos2: Position): number {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

/**
 * Tính khoảng cách Euclidean giữa hai điểm
 */
export function euclideanDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Kiểm tra xem hai vị trí có bằng nhau không
 */
export function positionsEqual(pos1: Position, pos2: Position): boolean {
  return pos1.x === pos2.x && pos1.y === pos2.y;
}
/**
 * Get position after moving in a direction
 */
export function getPositionInDirection(
  position: Position,
  direction: Direction,
  distance: number = COORDINATE_CONFIG.CELL_SIZE
): Position {
  switch (direction) {
    case Direction.UP:
      return { x: position.x, y: position.y - distance };
    case Direction.DOWN:
      return { x: position.x, y: position.y + distance };
    case Direction.LEFT:
      return { x: position.x - distance, y: position.y };
    case Direction.RIGHT:
      return { x: position.x + distance, y: position.y };
    default:
      return position;
  }
}

/**
 * Lấy vị trí mới sau khi di chuyển theo hướng với bước nhỏ (3px)
 * Dùng cho prediction và movement
 */
export function getPositionInDirectionSmallStep(
  position: Position,
  direction: Direction,
  steps: number = MOVE_STEP_SIZE // Server moves 1px per step
): Position {
  return getPositionInDirection(position, direction, steps);
}

/**
 * Lấy tất cả các vị trí xung quanh (4 hướng) - returns cell-centered positions
 */
export function getAdjacentPositions(position: Position): Position[] {
  return [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT].map(
    (dir) => getPositionInDirection(position, dir, CELL_SIZE)
  );
}

/**
 * Kiểm tra vị trí có nằm trong bản đồ không
 */
export function isPositionInBounds(
  position: Position,
  mapWidth: number,
  mapHeight: number
): boolean {
  return (
    position.x >= 0 &&
    position.x < mapWidth &&
    position.y >= 0 &&
    position.y < mapHeight
  );
}

/**
 * ✅ FIXED: Calculate direction from current position to target
 * Always uses CENTER to CENTER comparison
 *
 * @param botTopLeft - Bot's current position (top-left)
 * @param targetCenter - Target position (center)
 * @returns Direction to move
 */
export function getDirectionToTarget(
  botTopLeft: Position,
  targetCenter: Position
): Direction {
  // Convert bot to center for consistent comparison
  const botCenter = botTopLeftToCenter(botTopLeft);

  const dx = targetCenter.x - botCenter.x;
  const dy = targetCenter.y - botCenter.y;

  // If very close to target, consider it reached
  const MIN_DISTANCE = 2; // pixels
  if (Math.abs(dx) < MIN_DISTANCE && Math.abs(dy) < MIN_DISTANCE) {
    return Direction.STOP;
  }

  // Prioritize larger axis for cleaner movement
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  } else {
    return dy > 0 ? Direction.DOWN : Direction.UP;
  }
}

// Chuyển hướng sang vector
function directionToVector(dir: Direction): any {
  switch (dir) {
    case "UP":
      return { x: 0, y: -1 };
    case "DOWN":
      return { x: 0, y: 1 };
    case "LEFT":
      return { x: -1, y: 0 };
    case "RIGHT":
      return { x: 1, y: 0 };
  }
}

// Kiểm tra xem hướng tiếp theo có vuông góc 90° với hướng hiện tại không
function isRightAngleTurn(current: Direction, next: Direction): boolean {
  const v1 = directionToVector(current);
  const v2 = directionToVector(next);
  const dot = v1!.x * v2!.x + v1!.y * v2!.y;
  return dot === 0; // 0 nghĩa là vuông góc
}

function getDirection(from: Position, to: Position): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  } else if (Math.abs(dy) > 0) {
    return dy > 0 ? Direction.DOWN : Direction.UP;
  }
  return Direction.UP; // default
}

export function isNextTurnRightAngle(path: Position[]): boolean {
  if (path.length < 3) return false;

  const d1 = getDirection(path[0]!, path[1]!);
  const d2 = getDirection(path[1]!, path[2]!);
  return isRightAngleTurn(d1, d2);
}

/**
 * Tính góc giữa 2 hướng di chuyển
 * @returns 0, 90, 180, hoặc 270
 */
export function angleBetween(dir1: Direction, dir2: Direction): number {
  if (dir1 === dir2) return 0;

  const opposites = {
    [Direction.UP]: Direction.DOWN,
    [Direction.DOWN]: Direction.UP,
    [Direction.LEFT]: Direction.RIGHT,
    [Direction.RIGHT]: Direction.LEFT,
  } as any;

  // Nếu hai hướng ngược nhau → 180°

  if (opposites[dir1] === dir2) return 180;

  // Nếu không trùng, không ngược → 90°
  return 90;
}

/**
 * Lấy hướng di chuyển chính xác dựa trên hai bước (cell index) liên tiếp trong một đường đi.
 * Hàm này đáng tin cậy hơn getDirectionToTarget vì nó không bị ảnh hưởng bởi sự trôi/lệch pixel.
 * @param fromCell - Cell index của vị trí bắt đầu.
 * @param toCell - Cell index của vị trí kế tiếp.
 * @returns Hướng di chuyển (UP, DOWN, LEFT, RIGHT).
 */
export function getDirectionFromPathStep(
  fromCell: Position,
  toCell: Position
): Direction {
  const dx = toCell.x - fromCell.x; // Sẽ là -1, 0, hoặc 1
  const dy = toCell.y - fromCell.y; // Sẽ là -1, 0, hoặc 1

  if (dx === 1) {
    return Direction.RIGHT;
  }
  if (dx === -1) {
    return Direction.LEFT;
  }
  if (dy === 1) {
    return Direction.DOWN;
  }
  if (dy === -1) {
    return Direction.UP;
  }

  return Direction.STOP; // Fallback, không nên xảy ra với đường đi hợp lệ
}

/**
 * Tạo mảng các vị trí từ vị trí bắt đầu đến vị trí kết thúc theo hướng
 * Each step moves one full cell (CELL_SIZE = 40 pixels)
 */
export function getPositionsInLine(
  start: Position,
  direction: Direction,
  length: number
): Position[] {
  const positions: Position[] = [];
  let current = { ...start };

  for (let i = 0; i < length; i++) {
    current = getPositionInDirection(current, direction, CELL_SIZE);
    positions.push({ ...current });
  }

  return positions;
}
