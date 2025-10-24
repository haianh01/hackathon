import {
  GameState,
  Position,
  Bomb,
  Direction,
  EscapePathResult,
} from "../types";
import { getDirectionToTarget } from "./position";
import { MinHeap } from "./minHeap";
import {
  pixelToCellIndex,
  getMapCellDimensions,
  createCellIndexKey,
  cellToPixelCorner,
} from "./coordinates";
import {
  isBlocked,
  WALL_SIZE,
  isWithinCellBounds,
  CELL_SIZE,
  cellToPixelCenter,
  pixelToCell,
  MOVE_STEP_SIZE,
  MOVE_INTERVAL_MS,
} from "./constants";
import { isBotFullyInCell } from "./gameLogic";

const PATHFINDING_CONFIG = {
  MAX_VISITS_MULTIPLIER: 4,
  CACHE_TTL: 150, // ms
  SAFETY_MARGIN: 10, // px
  DEBUG_MODE: false, // Toggle for production
} as const;

interface PathCache {
  path: Position[];
  timestamp: number;
  goalKey: string;
}

interface ExplosionCache {
  cells: Set<string>;
  timestamp: number;
}

const pathCache = new Map<string, PathCache>();
const explosionCache = new Map<string, ExplosionCache>();

/**
 * Clean expired cache entries
 */
function cleanCaches(): void {
  const now = Date.now();

  for (const [key, cache] of pathCache.entries()) {
    if (now - cache.timestamp > PATHFINDING_CONFIG.CACHE_TTL) {
      pathCache.delete(key);
    }
  }

  for (const [key, cache] of explosionCache.entries()) {
    if (now - cache.timestamp > PATHFINDING_CONFIG.CACHE_TTL) {
      explosionCache.delete(key);
    }
  }
}

export interface PathfindingOptions {
  ignoreBombs?: boolean;
  allowOwnBomb?: Position;
  useCache?: boolean;
}

export class Pathfinding {
  /**
   *  Manhattan distance with bit operations
   */
  static heuristic(a: Position, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
  }

  /**
   *  Find path with caching and early exit optimizations
   */
  static findPath(
    start: Position,
    goal: Position,
    gameState: GameState,
    options?: PathfindingOptions
  ): Position[] {
    const startCell = pixelToCellIndex(start);
    const goalCell = pixelToCellIndex(goal);

    const startKey = createCellIndexKey(startCell);
    const goalKey = createCellIndexKey(goalCell);

    // Early exit: already at goal
    if (startKey === goalKey) {
      return [start];
    }

    // Check cache if enabled
    if (options?.useCache !== false) {
      const cacheKey = `${startKey}->${goalKey}`;
      const cached = pathCache.get(cacheKey);

      if (
        cached &&
        Date.now() - cached.timestamp < PATHFINDING_CONFIG.CACHE_TTL
      ) {
        return cached.path;
      }
    }

    // Clean caches periodically (10% chance per call)
    if (Math.random() < 0.1) {
      cleanCaches();
    }

    // A* implementation
    const openSet = new MinHeap<Position>();
    const cameFrom = new Map<string, Position>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const closedSet = new Set<string>();

    const heuristicValue = this.heuristic(startCell, goalCell);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristicValue);
    openSet.insert(startCell, heuristicValue);

    // Safety limit
    const mapDims = getMapCellDimensions(
      gameState.map.width,
      gameState.map.height
    );
    const maxIterations = mapDims.width * mapDims.height * 2;
    let iterations = 0;

    while (!openSet.isEmpty() && iterations < maxIterations) {
      iterations++;

      const current = openSet.extractMin();
      if (!current) break;

      const currentKey = createCellIndexKey(current);

      // Goal reached
      if (currentKey === goalKey) {
        const path = this.reconstructPath(cameFrom, current);
        // ✅ CORRECT: Convert to cell centers (not top-left!)
        path.shift();
        const pixelPath = path.map((cellIndex) => ({
          x: cellIndex.x * CELL_SIZE + CELL_SIZE / 2,
          y: cellIndex.y * CELL_SIZE + CELL_SIZE / 2,
        }));

        // Cache the result
        if (options?.useCache !== false) {
          const cacheKey = `${startKey}->${goalKey}`;
          pathCache.set(cacheKey, {
            path: pixelPath,
            timestamp: Date.now(),
            goalKey,
          });
        }

        return pixelPath;
      }

      closedSet.add(currentKey);

      // Get neighbors with collision checking
      const neighbors = this.getNeighbors(current, gameState, options);

      for (const neighbor of neighbors) {
        const neighborKey = createCellIndexKey(neighbor);

        if (closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeGScore = (gScore.get(currentKey) || 0) + 1;

        if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeGScore);

          const heuristic = this.heuristic(neighbor, goalCell);
          const fScoreValue = tentativeGScore + heuristic;
          fScore.set(neighborKey, fScoreValue);

          openSet.insert(neighbor, fScoreValue);
        }
      }
    }

    return []; // No path found
  }

  /**
   *  Find shortest path to any of multiple goals
   */
  static findShortestPath(
    start: Position,
    goals: Position[],
    gameState: GameState,
    options?: PathfindingOptions
  ): Position[] | null {
    if (goals.length === 0) return null;
    if (goals.length === 1)
      return this.findPath(start, goals[0]!, gameState, options);

    const startCell = pixelToCellIndex(start);
    const goalCells = goals.map(pixelToCellIndex);
    const goalSet = new Set(goalCells.map(createCellIndexKey));

    const openSet = new MinHeap<Position>();
    const cameFrom = new Map<string, Position>();
    const gScore = new Map<string, number>();
    const closedSet = new Set<string>();

    const startKey = createCellIndexKey(startCell);
    const minHeuristic = this.getMinHeuristic(startCell, goalCells);

    gScore.set(startKey, 0);
    openSet.insert(startCell, minHeuristic);

    const mapDims = getMapCellDimensions(
      gameState.map.width,
      gameState.map.height
    );
    const maxIterations = mapDims.width * mapDims.height * 2;
    let iterations = 0;

    while (!openSet.isEmpty() && iterations < maxIterations) {
      iterations++;

      const current = openSet.extractMin();
      if (!current) break;

      const currentKey = createCellIndexKey(current);

      // Check if reached any goal
      if (goalSet.has(currentKey)) {
        const path = this.reconstructPath(cameFrom, current);
        return path.map(cellToPixelCenter);
      }

      closedSet.add(currentKey);

      const neighbors = this.getNeighbors(current, gameState, options);

      for (const neighbor of neighbors) {
        const neighborKey = createCellIndexKey(neighbor);

        if (closedSet.has(neighborKey)) continue;

        const tentativeGScore = (gScore.get(currentKey) || 0) + 1;

        if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeGScore);

          const heuristic = this.getMinHeuristic(neighbor, goalCells);
          const fScoreValue = tentativeGScore + heuristic;

          openSet.insert(neighbor, fScoreValue);
        }
      }
    }

    return null;
  }

  private static reconstructPath(
    cameFrom: Map<string, Position>,
    current: Position
  ): Position[] {
    const path = [current];
    let currentKey = createCellIndexKey(current);

    while (cameFrom.has(currentKey)) {
      current = cameFrom.get(currentKey)!;
      path.unshift(current);
      currentKey = createCellIndexKey(current);
    }

    return path;
  }

  /**
   *  Get valid neighbors with early exits
   */
  private static getNeighbors(
    cellIndex: Position,
    gameState: GameState,
    options?: PathfindingOptions
  ): Position[] {
    const neighbors: Position[] = [];

    // Check all 4 directions
    const directions = [
      { x: 0, y: -1 }, // UP
      { x: 0, y: 1 }, // DOWN
      { x: -1, y: 0 }, // LEFT
      { x: 1, y: 0 }, // RIGHT
    ];

    for (const dir of directions) {
      const neighbor: Position = {
        x: cellIndex.x + dir.x,
        y: cellIndex.y + dir.y,
      };

      if (this.isValidCell(neighbor, gameState, options)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  /**
   *  Validate cell with early exits
   */
  private static isValidCell(
    cellIndex: Position,
    gameState: GameState,
    options?: PathfindingOptions
  ): boolean {
    // Bounds check first (fastest)
    if (
      !isWithinCellBounds(cellIndex, gameState.map.width, gameState.map.height)
    ) {
      return false;
    }

    // Wall/chest collision check
    const pixelPos = cellToPixelCorner(cellIndex);
    if (isBlocked(pixelPos, gameState, WALL_SIZE)) {
      return false;
    }

    // Bomb blocking check (if not ignored)
    if (!options?.ignoreBombs && gameState.map.bombs.length > 0) {
      const cellKey = createCellIndexKey(cellIndex);

      for (const bomb of gameState.map.bombs) {
        const bombCell = pixelToCell(bomb.position);
        const bombKey = createCellIndexKey(bombCell);

        if (cellKey === bombKey) {
          // Check if this is allowed own bomb
          if (options?.allowOwnBomb) {
            const ownBombCell = pixelToCell(options.allowOwnBomb);
            const ownBombKey = createCellIndexKey(ownBombCell);

            if (bombKey === ownBombKey) {
              continue; // Allow passing through own bomb
            }
          }

          return false; // Blocked by bomb
        }
      }
    }

    return true;
  }

  private static getMinHeuristic(
    cellIndex: Position,
    goalCells: Position[]
  ): number {
    let minDist = Infinity;

    for (const goal of goalCells) {
      const dist = this.heuristic(cellIndex, goal);
      if (dist < minDist) {
        minDist = dist;
      }
    }

    return minDist;
  }
}

/**
 * ✅ Compute explosion cells for ALL bombs on map
 * @returns Set of unsafe cell keys
 */
export function computeExplosionCells(
  gameState: GameState // ← Chỉ cần gameState
): Set<string> {
  const unsafe = new Set<string>();

  // Precompute walls and chests
  const solidWalls = new Set<string>();
  const destructibles = new Set<string>();

  for (const wall of gameState.map.walls) {
    const cell = pixelToCell(wall.position);
    solidWalls.add(createCellIndexKey(cell));
  }

  for (const chest of gameState.map.chests || []) {
    const cell = pixelToCell(chest.position);
    destructibles.add(createCellIndexKey(cell));
  }

  const directions = [
    { x: 0, y: -1 }, // UP
    { x: 0, y: 1 }, // DOWN
    { x: -1, y: 0 }, // LEFT
    { x: 1, y: 0 }, // RIGHT
  ];

  const maxCellX = Math.floor(gameState.map.width / CELL_SIZE);
  const maxCellY = Math.floor(gameState.map.height / CELL_SIZE);

  // ✅ Loop through ALL bombs on map
  for (const bomb of gameState.map.bombs) {
    const bombCell = pixelToCell(bomb.position);
    const bombKey = createCellIndexKey(bombCell);

    // Center cell always unsafe
    unsafe.add(bombKey);

    // Check explosion in 4 directions
    for (const dir of directions) {
      for (let i = 1; i <= (bomb.flameRange || 2); i++) {
        const currentCell = {
          x: bombCell.x + dir.x * i,
          y: bombCell.y + dir.y * i,
        };

        // Bounds check
        if (
          currentCell.x < 0 ||
          currentCell.x >= maxCellX ||
          currentCell.y < 0 ||
          currentCell.y >= maxCellY
        ) {
          break;
        }

        const cellKey = createCellIndexKey(currentCell);

        // Solid wall blocks explosion
        if (solidWalls.has(cellKey)) {
          break;
        }

        // Add unsafe cell
        unsafe.add(cellKey);

        // Chest blocks explosion after being destroyed
        if (destructibles.has(cellKey)) {
          break;
        }
      }
    }
  }

  return unsafe;
}

/**
 * ✅ Check if can escape considering ALL bombs
 */
export function canEscapeFromBomb(
  startPos: Position,
  gameState: GameState // ← Không cần bomb parameter
): boolean {
  const startCell = pixelToCell(startPos);

  // ✅ Get explosion info for ALL bombs
  const explosionInfo = computeExplosionInfo(gameState);
  const { unsafeCells, cellTimeRemaining } = explosionInfo;

  const startKey = createCellIndexKey(startCell);

  // Already safe
  if (!unsafeCells.has(startKey)) {
    return true;
  }

  // BFS to find escape
  const queue: { cell: Position; steps: number }[] = [
    { cell: startCell, steps: 0 },
  ];
  const visited = new Set<string>([startKey]);

  const botSpeed = gameState.currentBot.speed || 1;
  const pixelsPerMove = botSpeed * MOVE_STEP_SIZE;
  const pixelsPerSecond = (1000 / MOVE_INTERVAL_MS) * pixelsPerMove;

  const mapDims = getMapCellDimensions(
    gameState.map.width,
    gameState.map.height
  );
  const maxVisits = Math.min(512, mapDims.width * mapDims.height);
  let visits = 0;

  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  while (queue.length > 0 && visits < maxVisits) {
    const node = queue.shift()!;
    visits++;

    for (const dir of directions) {
      const nextCell = {
        x: node.cell.x + dir.x,
        y: node.cell.y + dir.y,
      };
      const key = createCellIndexKey(nextCell);

      if (visited.has(key)) continue;

      // Validation
      if (
        !isWithinCellBounds(nextCell, gameState.map.width, gameState.map.height)
      ) {
        continue;
      }

      const pixelPos = cellToPixelCorner(nextCell);
      if (isBlocked(pixelPos, gameState, WALL_SIZE)) {
        continue;
      }

      visited.add(key);

      const nextSteps = node.steps + 1;
      const distancePx = nextSteps * CELL_SIZE;
      const arrivalTimeMs = (distancePx / pixelsPerSecond) * 1000;

      // ✅ Check with specific bomb time for this cell
      if (unsafeCells.has(key)) {
        const cellExplosionTime = cellTimeRemaining.get(key) ?? 5000;

        // Can't pass through
        if (arrivalTimeMs >= cellExplosionTime) {
          continue;
        }
      } else {
        // ✅ Found safe cell!
        return true;
      }

      queue.push({ cell: nextCell, steps: nextSteps });
    }
  }

  return false;
}

/**
 * ✅ Compute explosion information for ALL bombs
 * Returns a Map with cell key → minimum time remaining
 */
export interface ExplosionInfo {
  unsafeCells: Set<string>;
  cellTimeRemaining: Map<string, number>; // cell key → min time
}

export function computeExplosionInfo(gameState: GameState): ExplosionInfo {
  const unsafeCells = new Set<string>();
  const cellTimeRemaining = new Map<string, number>();

  // Precompute obstacles
  const solidWalls = new Set<string>();
  const destructibles = new Set<string>();

  for (const wall of gameState.map.walls) {
    const cell = pixelToCell(wall.position);
    solidWalls.add(createCellIndexKey(cell));
  }

  for (const chest of gameState.map.chests || []) {
    const cell = pixelToCell(chest.position);
    destructibles.add(createCellIndexKey(cell));
  }

  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  const maxCellX = Math.floor(gameState.map.width / CELL_SIZE);
  const maxCellY = Math.floor(gameState.map.height / CELL_SIZE);

  // ✅ Process ALL bombs
  for (const bomb of gameState.map.bombs) {
    const bombCell = pixelToCell(bomb.position);
    const bombKey = createCellIndexKey(bombCell);
    const bombTime = bomb.timeRemaining || 5000;

    // Update center cell
    unsafeCells.add(bombKey);

    // Track minimum time for this cell
    const currentTime = cellTimeRemaining.get(bombKey) ?? Infinity;
    cellTimeRemaining.set(bombKey, Math.min(currentTime, bombTime));

    // Check 4 directions
    for (const dir of directions) {
      for (let i = 1; i <= (bomb.flameRange || 2); i++) {
        const currentCell = {
          x: bombCell.x + dir.x * i,
          y: bombCell.y + dir.y * i,
        };

        // Bounds check
        if (
          currentCell.x < 0 ||
          currentCell.x >= maxCellX ||
          currentCell.y < 0 ||
          currentCell.y >= maxCellY
        ) {
          break;
        }

        const cellKey = createCellIndexKey(currentCell);

        // Solid wall blocks
        if (solidWalls.has(cellKey)) {
          break;
        }

        // Mark as unsafe
        unsafeCells.add(cellKey);

        // Update minimum time
        const currentTime = cellTimeRemaining.get(cellKey) ?? Infinity;
        cellTimeRemaining.set(cellKey, Math.min(currentTime, bombTime));

        // Chest blocks after destroy
        if (destructibles.has(cellKey)) {
          break;
        }
      }
    }
  }

  return { unsafeCells, cellTimeRemaining };
}

/**
 * ✅ Find escape path considering ALL bombs
 */
export function findEscapePath(
  startPos: Position,
  gameState: GameState // ← Không cần bomb parameter nữa!
): EscapePathResult {
  const startCell = pixelToCell(startPos);

  // ✅ Get explosion info for ALL bombs
  const explosionInfo = computeExplosionInfo(gameState);
  const { unsafeCells, cellTimeRemaining } = explosionInfo;

  const startKey = createCellIndexKey(startCell);

  // Check if already safe
  if (!unsafeCells.has(startKey)) {
    return {
      nextStep: startPos,
      target: startPos,
      path: [startPos],
      direction: Direction.STOP,
    };
  }

  // BFS search
  const queue: { cell: Position; steps: number }[] = [
    { cell: startCell, steps: 0 },
  ];
  const parentMap = new Map<string, string>();
  const visited = new Set<string>([startKey]);

  const botSpeed = gameState.currentBot.speed || 1;
  const pixelsPerMove = botSpeed * MOVE_STEP_SIZE;
  const pixelsPerSecond = (1000 / MOVE_INTERVAL_MS) * pixelsPerMove;

  const mapDims = getMapCellDimensions(
    gameState.map.width,
    gameState.map.height
  );
  const maxVisits =
    mapDims.width * mapDims.height * PATHFINDING_CONFIG.MAX_VISITS_MULTIPLIER;
  let visits = 0;

  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  while (queue.length > 0 && visits < maxVisits) {
    const node = queue.shift()!;
    visits++;

    for (const dir of directions) {
      const nextCell = {
        x: node.cell.x + dir.x,
        y: node.cell.y + dir.y,
      };
      const key = createCellIndexKey(nextCell);

      if (visited.has(key)) continue;

      // Validation
      if (
        !isWithinCellBounds(nextCell, gameState.map.width, gameState.map.height)
      ) {
        continue;
      }

      const pixelPos = cellToPixelCorner(nextCell);
      if (isBlocked(pixelPos, gameState, WALL_SIZE)) {
        continue;
      }

      visited.add(key);
      parentMap.set(key, createCellIndexKey(node.cell));

      const nextSteps = node.steps + 1;
      const distancePx = nextSteps * CELL_SIZE;
      const arrivalTimeMs = (distancePx / pixelsPerSecond) * 1000;

      // ✅ Check against specific bomb time for this cell
      if (unsafeCells.has(key)) {
        const cellExplosionTime = cellTimeRemaining.get(key) ?? 5000;

        // Can't pass through in time
        if (arrivalTimeMs >= cellExplosionTime) {
          continue;
        }

        // Can pass through, continue searching
      } else {
        // ✅ Found safe cell!
        const fullPath = reconstructFullPath(parentMap, startCell, nextCell);

        if (fullPath.length === 0) return null;

        const pixelPath: Position[] = []; // ✅ Fixed!
        for (let i = 1; i < fullPath.length; i++) {
          pixelPath.push(cellToPixelCenter(fullPath[i]!));
        }

        const nextTarget = pixelPath[1];
        const direction = getDirectionToTarget(startPos, nextTarget!);

        return {
          nextStep: nextTarget!,
          target: pixelPath[pixelPath.length - 1]!,
          path: pixelPath,
          direction,
        };
      }

      queue.push({ cell: nextCell, steps: nextSteps });
    }
  }

  return null;
}

/**
 * Helper: Reconstruct path from parent map
 */
function reconstructFullPath(
  parentMap: Map<string, string>,
  startCell: Position,
  endCell: Position
): Position[] {
  const startKey = createCellIndexKey(startCell);
  let currentKey = createCellIndexKey(endCell);
  const path: Position[] = [endCell];

  let iterations = 0;
  const maxIterations = 1000; // Safety limit

  while (currentKey !== startKey && iterations < maxIterations) {
    iterations++;

    const parentKey = parentMap.get(currentKey);
    if (!parentKey) break;

    const parts = parentKey.split(",");
    const parentCell = { x: parseInt(parts[0]!), y: parseInt(parts[1]!) };

    path.unshift(parentCell);
    currentKey = parentKey;
  }

  return path;
}

/**
 * Predict enemy position (placeholder for ML-based prediction)
 */
export function predictEnemyPosition(enemy: any, steps: number): Position {
  return { ...enemy.position };
}

/**
 * Clear all caches (call when game state changes significantly)
 */
export function clearPathfindingCaches(): void {
  pathCache.clear();
  explosionCache.clear();
}
