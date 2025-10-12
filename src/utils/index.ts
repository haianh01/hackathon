/**
 * Export tất cả các utility functions
 */

// Export constants as primary source of truth
export * from "./constants";

// Export other utilities
export * from "./position";
export * from "./pathfinding";
export * from "./positionPredictor";
export * from "./latencyTracker";
export * from "./adaptiveLoopManager";
export * from "./smartLogger";
export * from "./commandAckSystem";
export * from "./minHeap";

// Export gameLogic with explicit naming to avoid conflicts
export {
  // Danger zone functions
  isPositionSafe,
  isPositionInDangerZone,
  isPositionInBombRange,
  getSafeAdjacentPositions,
  calculateBombScore,
  // Legacy functions (deprecated)
  isPositionBlocked as isPositionBlockedLegacy,
  canMoveTo as canMoveToLegacy,
  isPositionCollidingWithWalls,
  canMoveToPositionPrecise,
} from "./gameLogic";

// Export coordinates with explicit naming to avoid conflicts
export {
  pixelToCellIndex,
  cellIndexToPixel,
  cellToCellIndex,
  getMapCellDimensions,
  createCellIndexKey,
  parsePositionKey,
  // Legacy exports (deprecated)
  pixelToCell as pixelToCellLegacy,
  isWithinPixelBounds,
  isWithinCellBounds as isWithinCellBoundsLegacy,
  createPositionKey as createPositionKeyLegacy,
} from "./coordinates";
