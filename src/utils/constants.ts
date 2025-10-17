/**
 * Central constants for Bomberman Bot
 * Single source of truth for all size and collision constants
 */

// === GRID & CELL CONSTANTS ===
export const CELL_SIZE = 40; // Standard cell size in pixels
export const HALF_CELL = CELL_SIZE / 2; // 20px - for center calculations

// === OBJECT SIZE CONSTANTS ===
export const WALL_SIZE = 40; // Wall object size in pixels
export const CHEST_SIZE = 40; // Chest object size in pixels
export const PLAYER_SIZE = 30; // Player/bot collision size
export const ITEM_SIZE = 20; // Item pickup size

// === COLLISION CONSTANTS ===
export const COLLISION_TOLERANCE = 5; // Minimum collision threshold
export const PLAYER_COLLISION_THRESHOLD = 25; // Player-to-player collision
export const EDGE_SAFETY_MARGIN = 20; // Safety margin from map edges

// === MOVEMENT CONSTANTS ===
export const MOVE_STEP_SIZE = 3; // Server moves 3px per step
export const MOVE_INTERVAL_MS = 17; // Default movement interval

// === COORDINATE CONVERSION UTILITIES ===
import { GameState, Position } from "../types";

/**
 * Convert pixel coordinates to cell indices (for array access)
 */
export function pixelToCell(pixelPos: Position): Position {
  return {
    x: Math.floor(pixelPos.x / CELL_SIZE),
    y: Math.floor(pixelPos.y / CELL_SIZE),
  };
}

/**
 * Convert cell indices to pixel coordinates (center of cell)
 */
export function cellToPixel(cellIndex: Position): Position {
  return {
    x: cellIndex.x * CELL_SIZE + HALF_CELL,
    y: cellIndex.y * CELL_SIZE + HALF_CELL,
  };
}

/**
 * Convert cell indices to pixel coordinates (top-left corner of cell)
 */
export function cellToPixelCorner(cellIndex: Position): Position {
  return {
    x: cellIndex.x * CELL_SIZE,
    y: cellIndex.y * CELL_SIZE,
  };
}

/**
 * Convert pixel to cell with center alignment
 */
export function pixelToCellCenter(pixelPos: Position): Position {
  return {
    x: Math.round(pixelPos.x / CELL_SIZE) * CELL_SIZE,
    y: Math.round(pixelPos.y / CELL_SIZE) * CELL_SIZE,
  };
}

/**
 * Create position key for maps/sets
 */
export function createPositionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

/**
 * Create cell index key for maps/sets
 */
export function createCellKey(cellIndex: Position): string {
  return `${cellIndex.x},${cellIndex.y}`;
}

/**
 * Check if position is within pixel bounds
 */
export function isWithinBounds(
  position: Position,
  mapWidth: number,
  mapHeight: number,
  margin: number = 0
): boolean {
  return (
    position.x >= margin &&
    position.x < mapWidth - margin &&
    position.y >= margin &&
    position.y < mapHeight - margin
  );
}

/**
 * Check if cell index is within cell bounds
 */
export function isWithinCellBounds(
  cellIndex: Position,
  mapWidth: number,
  mapHeight: number
): boolean {
  const maxCellX = Math.floor(mapWidth / CELL_SIZE);
  const maxCellY = Math.floor(mapHeight / CELL_SIZE);

  return (
    cellIndex.x >= 0 &&
    cellIndex.x < maxCellX &&
    cellIndex.y >= 0 &&
    cellIndex.y < maxCellY
  );
}

// === BOX COLLISION SYSTEM ===
/**
 * Check collision between two rectangular objects
 * This is the AUTHORITATIVE collision detection method
 */
export function checkBoxCollision(
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
 * UNIFIED COLLISION CHECKER - Single source of truth for all collision detection
 * This replaces all tolerance-based and exact-match collision systems
 */
export function isBlocked(
  position: Position,
  gameState: any,
  objectSize: number = PLAYER_SIZE
): boolean {
  // Check walls collision
  for (const wall of gameState.map.walls || []) {
    if (checkBoxCollision(position, objectSize, wall.position, WALL_SIZE)) {
      return true;
    }
  }

  // Check chests collision
  for (const chest of gameState.map.chests || []) {
    if (checkBoxCollision(position, objectSize, chest.position, CHEST_SIZE)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if position can be moved to (unified movement checker)
 * This is the AUTHORITATIVE movement validation method
 */
export function canMoveTo(
  position: Position,
  gameState: any,
  objectSize: number = PLAYER_SIZE
): boolean {
  // 1. Check bounds with object size consideration
  // FIXED: Account for object size - position is top-left corner
  if (
    position.x < 0 ||
    position.x + objectSize > gameState.map.width ||
    position.y < 0 ||
    position.y + objectSize > gameState.map.height
  ) {
    return false;
  }

  // 2. Check walls and chests using unified collision
  if (isBlocked(position, gameState, objectSize)) {
    return false;
  }

  // 3. Check enemy players collision
  // for (const enemy of gameState.enemies || []) {
  //   if (enemy.isAlive !== false) {
  //     // Only check alive enemies
  //     if (
  //       checkBoxCollision(position, objectSize, enemy.position, PLAYER_SIZE)
  //     ) {
  //       return false;
  //     }
  //   }
  // }

  return true;
}
export function isPositionBlocked(
  position: Position,
  gameState: GameState
): boolean {
  return isBlocked(position, gameState, PLAYER_SIZE);
}

/**
 * Chuyển đổi tọa độ chỉ mục ô lưới (cell index) sang tọa độ pixel
 * của TRUNG TÂM ô đó.
 * @param cellIndex Tọa độ chỉ mục ô lưới (ví dụ: {x: 1, y: 2}).
 * @param cellSize Kích thước mỗi ô (ví dụ: 40).
 * @returns Vị trí pixel trung tâm của ô.
 */
export function cellToPixelCenter(
  cellIndex: Position,
  cellSize: number = CELL_SIZE
): Position {
  // 1. Tính tọa độ góc (trên cùng bên trái)
  const cornerX = cellIndex.x * cellSize;
  const cornerY = cellIndex.y * cellSize;

  // 2. Cộng thêm nửa kích thước ô để lấy trung tâm
  const centerOffset = cellSize / 2;

  return {
    x: cornerX + centerOffset,
    y: cornerY + centerOffset,
  };
}
