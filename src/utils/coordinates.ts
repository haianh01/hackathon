import { Position } from "../types";
import {
  CELL_SIZE,
  MOVE_STEP_SIZE,
  MOVE_INTERVAL_MS,
  pixelToCell as pixelToCellFromConstants,
  cellToPixel,
  cellToPixelCorner,
  pixelToCellCenter,
  isWithinBounds,
  isWithinCellBounds as isWithinCellBoundsFromConstants,
  createPositionKey as createPositionKeyFromConstants,
  createCellKey,
} from "./constants";

/**
 * @deprecated Use constants.ts instead
 * Standard cell size in pixels
 */
export { CELL_SIZE };

/**
 * @deprecated Use constants.ts instead
 * Movement step size in pixels (server moves 3px per step)
 */
export { MOVE_STEP_SIZE };

/**
 * @deprecated Use constants.ts instead
 * Default movement interval in milliseconds
 */
export { MOVE_INTERVAL_MS };

/**
 * Convert pixel coordinates to cell coordinates (for pathfinding)
 * Returns the center of the cell that contains the pixel position
 * @deprecated Use constants.pixelToCellCenter instead
 */
export function pixelToCell(pixelPos: Position): Position {
  return pixelToCellCenter(pixelPos);
}

/**
 * Convert pixel coordinates to cell indices (for array access)
 * Returns integer indices for accessing grid arrays
 */
export function pixelToCellIndex(pixelPos: Position): Position {
  return pixelToCellFromConstants(pixelPos);
}

/**
 * Convert cell indices to pixel coordinates (center of cell)
 */
export function cellIndexToPixel(cellIndex: Position): Position {
  return cellToPixelCorner(cellIndex);
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
 * @deprecated Use constants.isWithinBounds instead
 */
export function isWithinPixelBounds(
  position: Position,
  mapWidthPx: number,
  mapHeightPx: number
): boolean {
  return isWithinBounds(position, mapWidthPx, mapHeightPx);
}

/**
 * Check if cell index is within cell bounds
 * @deprecated Use constants.isWithinCellBounds instead
 */
export function isWithinCellBounds(
  cellIndex: Position,
  mapWidthPx: number,
  mapHeightPx: number
): boolean {
  return isWithinCellBoundsFromConstants(cellIndex, mapWidthPx, mapHeightPx);
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
 * @deprecated Use constants.createPositionKey instead
 */
export function createPositionKey(position: Position): string {
  return createPositionKeyFromConstants(position);
}

/**
 * Create a cell index key for maps/sets
 */
export function createCellIndexKey(cellIndex: Position): string {
  return createCellKey(cellIndex);
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
