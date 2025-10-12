import { Position } from "../types";

/**
 * Standard cell size in pixels
 */
export const CELL_SIZE = 40;

/**
 * Movement step size in pixels (server moves 3px per step)
 */
export const MOVE_STEP_SIZE = 3;

/**
 * Default movement interval in milliseconds
 */
export const MOVE_INTERVAL_MS = 200;

/**
 * Convert pixel coordinates to cell coordinates (for pathfinding)
 * Returns the center of the cell that contains the pixel position
 */
export function pixelToCell(pixelPos: Position): Position {
  return {
    x: Math.round(pixelPos.x / CELL_SIZE) * CELL_SIZE,
    y: Math.round(pixelPos.y / CELL_SIZE) * CELL_SIZE,
  };
}

/**
 * Convert pixel coordinates to cell indices (for array access)
 * Returns integer indices for accessing grid arrays
 */
export function pixelToCellIndex(pixelPos: Position): Position {
  return {
    x: Math.round(pixelPos.x / CELL_SIZE),
    y: Math.round(pixelPos.y / CELL_SIZE),
  };
}

/**
 * Convert cell indices to pixel coordinates (center of cell)
 */
export function cellIndexToPixel(cellIndex: Position): Position {
  return {
    x: cellIndex.x * CELL_SIZE,
    y: cellIndex.y * CELL_SIZE,
  };
}

/**
 * Convert cell coordinates to cell indices
 */
export function cellToCellIndex(cellPos: Position): Position {
  return {
    x: cellPos.x / CELL_SIZE,
    y: cellPos.y / CELL_SIZE,
  };
}

/**
 * Check if position is within pixel bounds
 */
export function isWithinPixelBounds(
  position: Position,
  mapWidthPx: number,
  mapHeightPx: number
): boolean {
  return (
    position.x >= 0 &&
    position.x < mapWidthPx &&
    position.y >= 0 &&
    position.y < mapHeightPx
  );
}

/**
 * Check if cell index is within cell bounds
 */
export function isWithinCellBounds(
  cellIndex: Position,
  mapWidthPx: number,
  mapHeightPx: number
): boolean {
  const maxCellX = Math.floor(mapWidthPx / CELL_SIZE);
  const maxCellY = Math.floor(mapHeightPx / CELL_SIZE);

  return (
    cellIndex.x >= 0 &&
    cellIndex.x < maxCellX &&
    cellIndex.y >= 0 &&
    cellIndex.y < maxCellY
  );
}

/**
 * Get cell dimensions from pixel map dimensions
 */
export function getMapCellDimensions(
  mapWidthPx: number,
  mapHeightPx: number
): {
  width: number;
  height: number;
} {
  return {
    width: Math.floor(mapWidthPx / CELL_SIZE),
    height: Math.floor(mapHeightPx / CELL_SIZE),
  };
}

/**
 * Create a position key for maps/sets (normalized to cell coordinates)
 */
export function createPositionKey(position: Position): string {
  const cellPos = pixelToCell(position);
  return `${cellPos.x},${cellPos.y}`;
}

/**
 * Create a cell index key for maps/sets
 */
export function createCellIndexKey(cellIndex: Position): string {
  return `${cellIndex.x},${cellIndex.y}`;
}

/**
 * Parse position key back to position
 */
export function parsePositionKey(key: string): Position {
  const parts = key.split(",");
  const x = parseInt(parts[0] || "0", 10);
  const y = parseInt(parts[1] || "0", 10);
  return { x, y };
}
