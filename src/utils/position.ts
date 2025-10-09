import { Position, Direction } from "../types";

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
 * Lấy vị trí mới sau khi di chuyển theo hướng
 */
export function getPositionInDirection(
  position: Position,
  direction: Direction,
  steps: number = 40 // Each cell is 40x40 pixels
): Position {
  const newPos = { ...position };

  switch (direction) {
    case Direction.UP:
      newPos.y -= steps;
      break;
    case Direction.DOWN:
      newPos.y += steps;
      break;
    case Direction.LEFT:
      newPos.x -= steps;
      break;
    case Direction.RIGHT:
      newPos.x += steps;
      break;
    case Direction.STOP:
      break;
  }

  return newPos;
}

/**
 * Lấy vị trí mới sau khi di chuyển theo hướng với bước nhỏ (3px)
 * Dùng cho prediction
 */
export function getPositionInDirectionSmallStep(
  position: Position,
  direction: Direction,
  steps: number = 3 // Server moves 3px per step
): Position {
  return getPositionInDirection(position, direction, steps);
}

/**
 * Lấy tất cả các vị trí xung quanh (4 hướng)
 */
export function getAdjacentPositions(position: Position): Position[] {
  return [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT].map(
    (dir) => getPositionInDirection(position, dir)
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
 * Lấy hướng để đi từ vị trí hiện tại đến vị trí đích
 */
export function getDirectionToTarget(from: Position, to: Position): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Ưu tiên di chuyển theo trục có khoảng cách lớn hơn
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  } else if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 ? Direction.DOWN : Direction.UP;
  }

  // Nếu bằng nhau, ưu tiên di chuyển theo trục X
  return dx > 0 ? Direction.RIGHT : Direction.LEFT;
}

/**
 * Tạo mảng các vị trí từ vị trí bắt đầu đến vị trí kết thúc theo hướng
 */
export function getPositionsInLine(
  start: Position,
  direction: Direction,
  length: number
): Position[] {
  const positions: Position[] = [];
  let current = { ...start };

  for (let i = 0; i < length; i++) {
    current = getPositionInDirection(current, direction, 1);
    positions.push({ ...current });
  }

  return positions;
}
