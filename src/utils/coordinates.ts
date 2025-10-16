import { Position } from "../types";
import {
  CELL_SIZE,
  pixelToCell as pixelToCellFromConstants,
  cellToPixelCorner,
  createCellKey,
} from "./constants";

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
