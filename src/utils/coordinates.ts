import { Position } from "../types";
import {
  CELL_SIZE,
  pixelToCell as pixelToCellFromConstants,
  createCellKey,
  PLAYER_SIZE,
} from "./constants";

/**
 * Convert pixel coordinates to cell indices (for array access)
 * Returns integer indices for accessing grid arrays
 */
export const COORDINATE_CONFIG = {
  CELL_SIZE: 40, // Cell dimensions
  PLAYER_SIZE: 35, // Bot dimensions (actual size used by game)
  PLAYER_HALF_SIZE: 17.5, // Pre-calculated for performance
  CELL_HALF_SIZE: 20, // Pre-calculated for performance

  // Thresholds for waypoint detection
  WAYPOINT_REACH_THRESHOLD: 10, // Reduced from 20px for precision
  REACH_MARGIN_PIXELS: 8, // Server sync tolerance
  FINAL_TARGET_THRESHOLD: 10, // For end of path

  // Offset from cell center (used for alignment)
  CENTER_OFFSET: Math.ceil((CELL_SIZE - PLAYER_SIZE) / 2), // (40 - 35) / 2 = 3px
} as const;

/**
 * ✅ FIXED: Convert bot pixel position (top-left) to cell index
 * Uses bot CENTER for accurate cell determination
 */
export function pixelToCellIndex(botTopLeft: Position): Position {
  const botCenterX = botTopLeft.x + COORDINATE_CONFIG.PLAYER_HALF_SIZE; // 43 + 17.5 = 60.5
  const botCenterY = botTopLeft.y + COORDINATE_CONFIG.PLAYER_HALF_SIZE;

  return {
    x: Math.floor(botCenterX / CELL_SIZE),
    y: Math.floor(botCenterY / CELL_SIZE),
  };
}
/**
 * ✅ FIXED: Convert cell index to pixel position for bot
 * Returns TOP-LEFT position so bot is centered in cell
 */

function cellToPixelPositionForBot(cellIndex: Position): Position {
  return {
    x: cellIndex.x * CELL_SIZE + COORDINATE_CONFIG.CENTER_OFFSET, // e.g., 40 + 3 = 43
    y: cellIndex.y * CELL_SIZE + COORDINATE_CONFIG.CENTER_OFFSET,
  };
}

/**
 * Get cell center in pixels (used for waypoint targets)
 */
export function cellToPixelCenter(cellIndex: Position): Position {
  return {
    x:
      cellIndex.x * COORDINATE_CONFIG.CELL_SIZE +
      COORDINATE_CONFIG.CELL_HALF_SIZE,
    y:
      cellIndex.y * COORDINATE_CONFIG.CELL_SIZE +
      COORDINATE_CONFIG.CELL_HALF_SIZE,
  };
}
/**
 * Get cell corner (top-left) in pixels
 */
export function cellToPixelCorner(cellIndex: Position): Position {
  return {
    x: cellIndex.x * COORDINATE_CONFIG.CELL_SIZE,
    y: cellIndex.y * COORDINATE_CONFIG.CELL_SIZE,
  };
}

/**
 * Convert cell indices to pixel coordinates (center of cell)
 */
export function cellIndexToPixel(cellIndex: Position): Position {
  return cellToPixelCorner(cellIndex);
}

/**
 * Convert bot top-left position to center position
 */
export function botTopLeftToCenter(botTopLeft: Position): Position {
  return {
    x: botTopLeft.x + COORDINATE_CONFIG.PLAYER_HALF_SIZE,
    y: botTopLeft.y + COORDINATE_CONFIG.PLAYER_HALF_SIZE,
  };
}

/**
 * Convert bot center position to top-left position
 */
export function botCenterToTopLeft(botCenter: Position): Position {
  return {
    x: botCenter.x - COORDINATE_CONFIG.PLAYER_HALF_SIZE,
    y: botCenter.y - COORDINATE_CONFIG.PLAYER_HALF_SIZE,
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

/**
 * ✅ FIXED: Check if bot has reached a position
 * Compares bot CENTER to target CENTER
 *
 * @param botTopLeft - Bot's current position (top-left coordinate)
 * @param targetCenter - Target position (typically a cell center)
 * @param threshold - Base threshold in pixels
 * @returns true if bot center is within threshold of target center
 */
export function isAtPosition(
  botTopLeft: Position,
  targetCenter: Position,
  threshold: number = COORDINATE_CONFIG.WAYPOINT_REACH_THRESHOLD
): boolean {
  // Convert bot top-left to center for fair comparison
  const botCenter = botTopLeftToCenter(botTopLeft);

  // Calculate distance between centers
  const distance = Math.hypot(
    botCenter.x - targetCenter.x,
    botCenter.y - targetCenter.y
  );

  console.log(
    "%c🤪 ~ file: coordinates.ts:164 [] -> distance : ",
    "color: #7d80b4",
    distance,
    targetCenter,
    botCenter
  );

  // Add margin for server sync tolerance
  // const effectiveThreshold = threshold + COORDINATE_CONFIG.REACH_MARGIN_PIXELS;
  const effectiveThreshold = threshold;
  return distance >= effectiveThreshold + 28;
}
/**
 * ✅ FIXED: Calculate distance between two positions
 * Always compares CENTER to CENTER for consistency
 */
export function getDistance(
  pos1: Position,
  pos2: Position,
  pos1IsTopLeft: boolean = false,
  pos2IsTopLeft: boolean = false
): number {
  // Convert to centers if needed
  const p1 = pos1IsTopLeft ? botTopLeftToCenter(pos1) : pos1;
  const p2 = pos2IsTopLeft ? botTopLeftToCenter(pos2) : pos2;

  return Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
}
/**
 * ✅ FIXED: Check if bot is completely inside a cell
 * Verifies all four corners of bot are within cell boundaries
 */
export function isBotCompletelyInsideCell(
  botTopLeft: Position,
  cellIndex: Position
): boolean {
  // Calculate cell boundaries
  const cellLeft = cellIndex.x * COORDINATE_CONFIG.CELL_SIZE;
  const cellRight = cellLeft + COORDINATE_CONFIG.CELL_SIZE;
  const cellTop = cellIndex.y * COORDINATE_CONFIG.CELL_SIZE;
  const cellBottom = cellTop + COORDINATE_CONFIG.CELL_SIZE;

  // Calculate bot boundaries (bot position is top-left)
  const botLeft = botTopLeft.x;
  const botRight = botTopLeft.x + COORDINATE_CONFIG.PLAYER_SIZE;
  const botTop = botTopLeft.y;
  const botBottom = botTopLeft.y + COORDINATE_CONFIG.PLAYER_SIZE;

  // Check if bot is completely inside cell
  return (
    botLeft >= cellLeft &&
    botRight <= cellRight &&
    botTop >= cellTop &&
    botBottom <= cellBottom
  );
}
