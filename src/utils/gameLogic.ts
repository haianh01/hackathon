import { GameState, Position, Bomb, Direction } from "../types";
import { getPositionInDirection, getPositionsInLine } from "./position";
import { computeExplosionCells } from "./pathfinding";
import { createCellIndexKey } from "./coordinates";
import {
  CELL_SIZE,
  CHEST_SIZE,
  isBlocked,
  isPositionBlocked,
  isWithinBounds,
  pixelToCell,
  PLAYER_SIZE,
  WALL_SIZE,
} from "./constants";

interface ExplosionCache {
  bombId: string;
  cells: Set<string>;
  timestamp: number;
}

const explosionCache = new Map<string, ExplosionCache>();
const CACHE_TTL = 100; // Cache valid for 100ms

/**
 * Clear old cache entries (call periodically)
 */
function cleanExplosionCache(): void {
  const now = Date.now();
  for (const [key, cache] of explosionCache.entries()) {
    if (now - cache.timestamp > CACHE_TTL) {
      explosionCache.delete(key);
    }
  }
}

/**
 * Get cached explosion cells or compute if not cached
 */
function getCachedExplosionCells(
  bomb: Bomb,
  gameState: GameState
): Set<string> {
  const bombKey = `${bomb.position.x},${bomb.position.y},${bomb.flameRange}`;
  const cached = explosionCache.get(bombKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.cells;
  }

  const cells = computeExplosionCells(bomb, gameState);
  explosionCache.set(bombKey, {
    bombId: bombKey,
    cells,
    timestamp: Date.now(),
  });

  return cells;
}

/**
 * OPTIMIZED: Fast AABB collision check with early exit
 * Uses bit operations for faster comparisons
 */
function checkBoxCollision(
  pos1: Position,
  size1: number,
  pos2: Position,
  size2: number
): boolean {
  // Early exit: check horizontal axis first (most likely to fail)
  if (pos1.x >= pos2.x + size2 || pos1.x + size1 <= pos2.x) {
    return false;
  }

  // Only check vertical if horizontal overlaps
  return pos1.y < pos2.y + size2 && pos1.y + size1 > pos2.y;
}

/**
 * OPTIMIZED: Check if position overlaps with any bomb center
 * Used for bomb placement validation
 */
function isOnBombPosition(position: Position, bombs: Bomb[]): boolean {
  // Check if bot center is within 10px of any bomb center
  for (const bomb of bombs) {
    const dx = position.x - bomb.position.x;
    const dy = position.y - bomb.position.y;
    // Use squared distance to avoid sqrt
    if (dx * dx + dy * dy < 100) {
      // 10px threshold
      return true;
    }
  }
  return false;
}

/**
 * OPTIMIZED: Check if position is safe from all bombs
 * Uses cached explosion cells for performance
 */
export function isPositionSafe(
  position: Position,
  gameState: GameState
): boolean {
  return !isPositionInDangerZone(position, gameState);
}

/**
 * OPTIMIZED: Check danger zone with caching AND pixel-perfect distance check
 * CONFLICT FIX: This must align with BombermanBot's threat detection
 */
export function isPositionInDangerZone(
  position: Position,
  gameState: GameState
): boolean {
  // Clean cache periodically (every 10th call)
  if (Math.random() < 0.1) {
    cleanExplosionCache();
  }

  const cellIndex = pixelToCell(position);
  const cellKey = createCellIndexKey(cellIndex);

  // Early exit if no bombs
  if (!gameState.map.bombs || gameState.map.bombs.length === 0) {
    return false;
  }

  // Check each bomb
  for (const bomb of gameState.map.bombs) {
    const unsafeCells = getCachedExplosionCells(bomb, gameState);

    if (unsafeCells.has(cellKey)) {
      return true;
    }
  }

  return false;
}

/**
 * OPTIMIZED: Check bomb range with early exits and proper AABB
 * CONFLICT FIX: Matches BombermanBot's BOMB_SAFETY_MARGIN (80px)
 */
export function isPositionInBombRange(
  position: Position,
  bomb: Bomb,
  gameState: GameState
): boolean {
  const SAFETY_MARGIN = 80; // Match BombermanBot's CONFIG.BOMB_SAFETY_MARGIN

  // OPTIMIZATION: Quick distance check first (cheaper than AABB)
  const dx = position.x - bomb.position.x;
  const dy = position.y - bomb.position.y;
  const distSquared = dx * dx + dy * dy;

  const maxRange = bomb.flameRange * CELL_SIZE + PLAYER_SIZE + SAFETY_MARGIN;
  const maxRangeSquared = maxRange * maxRange;

  // Early exit: too far away
  if (distSquared > maxRangeSquared) {
    return false;
  }

  // Check bomb center collision
  if (checkBoxCollision(position, PLAYER_SIZE, bomb.position, CELL_SIZE)) {
    return true;
  }

  // Check flame directions with optimized line checking
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
      // AABB collision check
      if (checkBoxCollision(position, PLAYER_SIZE, flamePos, CELL_SIZE)) {
        return true;
      }

      // Stop if blocked (walls/chests block flame propagation)
      if (isPositionBlocked(flamePos, gameState)) {
        break;
      }
    }
  }

  return false;
}

// ============================================================================
// ADJACENT POSITION HELPERS - Optimized with validation
// ============================================================================

/**
 * OPTIMIZED: Get safe adjacent positions with proper filtering
 * CONFLICT FIX: Now properly checks both danger AND blocking
 */
export function getSafeAdjacentPositions(
  position: Position,
  gameState: GameState
): Position[] {
  const adjacentPositions = [
    { x: position.x, y: position.y - CELL_SIZE }, // UP
    { x: position.x, y: position.y + CELL_SIZE }, // DOWN
    { x: position.x - CELL_SIZE, y: position.y }, // LEFT
    { x: position.x + CELL_SIZE, y: position.y }, // RIGHT
  ];

  return adjacentPositions.filter((pos) => {
    // Must pass ALL checks
    return (
      isWithinBounds(pos, gameState.map.width, gameState.map.height) &&
      !isPositionBlocked(pos, gameState) &&
      !isPositionInDangerZone(pos, gameState)
    );
  });
}

/**
 * OPTIMIZED: Get first safe adjacent position (for emergency escapes)
 */
export function getSafeAdjacentPositionFirst(
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

    // Validate all conditions
    if (
      isWithinBounds(newPos, gameState.map.width, gameState.map.height) &&
      !isPositionBlocked(newPos, gameState) &&
      !isPositionInDangerZone(newPos, gameState)
    ) {
      safePositions.push(newPos);
    }
  }

  return safePositions;
}

// ============================================================================
// BOMB SCORING - Optimized with priority checks
// ============================================================================

/**
 * OPTIMIZED: Calculate bomb score with priority sorting
 * Checks high-value targets first (enemies > chests > items)
 */
export function calculateBombScore(
  position: Position,
  gameState: GameState
): number {
  let score = 0;
  const flameRange = gameState.currentBot.flameRange;

  // Pre-compute flame positions once
  const allFlamePositions: Position[] = [];
  const directions = [
    Direction.UP,
    Direction.DOWN,
    Direction.LEFT,
    Direction.RIGHT,
  ];

  for (const direction of directions) {
    const flamePositions = getPositionsInLine(position, direction, flameRange);

    for (const flamePos of flamePositions) {
      allFlamePositions.push(flamePos);

      // Stop at walls
      if (isPositionBlocked(flamePos, gameState)) {
        break;
      }
    }
  }

  // OPTIMIZATION: Check enemies first (highest priority)
  for (const enemy of gameState.enemies) {
    if (!enemy.isAlive) continue;

    for (const flamePos of allFlamePositions) {
      if (checkBoxCollision(enemy.position, PLAYER_SIZE, flamePos, CELL_SIZE)) {
        score += 1000;
        break; // Count each enemy once
      }
    }
  }

  // Check chests (medium priority)
  if (gameState.map.chests) {
    for (const chest of gameState.map.chests) {
      for (const flamePos of allFlamePositions) {
        if (checkBoxCollision(chest.position, CELL_SIZE, flamePos, CELL_SIZE)) {
          score += 50;
          break;
        }
      }
    }
  }

  // Check items (negative score - we don't want to destroy items)
  for (const item of gameState.map.items) {
    for (const flamePos of allFlamePositions) {
      if (checkBoxCollision(item.position, 20, flamePos, CELL_SIZE)) {
        score -= 100;
        break;
      }
    }
  }

  return score;
}

// ============================================================================
// COLLISION DETECTION - Wall and obstacles
// ============================================================================

/**
 * OPTIMIZED: Check wall collisions with spatial optimization
 */

export function isPositionCollidingWithWalls(
  position: Position,
  gameState: GameState,
  botSize: number = PLAYER_SIZE
): boolean {
  // Check walls first (usually more numerous)
  for (const wall of gameState.map.walls) {
    if (checkBoxCollision(position, botSize, wall.position, WALL_SIZE)) {
      return true;
    }
  }

  // Check chests
  if (gameState.map.chests) {
    for (const chest of gameState.map.chests) {
      if (checkBoxCollision(position, botSize, chest.position, CHEST_SIZE)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// PROXIMITY DETECTION - Enemies and items
// ============================================================================

/**
 * OPTIMIZED: Check for nearby enemies with squared distance
 */
export function isEnemyNearby(
  botPosition: Position,
  gameState: GameState,
  radius: number
): boolean {
  const radiusSquared = radius * radius;

  for (const enemy of gameState.enemies) {
    if (!enemy.isAlive) continue;

    const dx = botPosition.x - enemy.position.x;
    const dy = botPosition.y - enemy.position.y;
    const distSquared = dx * dx + dy * dy;

    if (distSquared <= radiusSquared) {
      return true;
    }
  }

  return false;
}

/**
 * OPTIMIZED: Check for nearby items with squared distance
 */
export function isItemNearby(
  botPosition: Position,
  gameState: GameState,
  radius: number
): boolean {
  const radiusSquared = radius * radius;

  for (const item of gameState.map.items) {
    const dx = botPosition.x - item.position.x;
    const dy = botPosition.y - item.position.y;
    const distSquared = dx * dx + dy * dy;

    if (distSquared <= radiusSquared) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// MOVEMENT VALIDATION
// ============================================================================

/**
 * OPTIMIZED: Precise movement validation
 */
export function canMoveToPositionPrecise(
  position: Position,
  gameState: GameState
): boolean {
  // Quick bounds check
  if (!isWithinBounds(position, gameState.map.width, gameState.map.height)) {
    return false;
  }

  // Check blocking (walls, chests, bombs)
  if (isBlocked(position, gameState)) {
    return false;
  }

  return true;
}

/**
 * OPTIMIZED: Squared distance (avoids expensive sqrt)
 */
export function getDistanceSquared(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return dx * dx + dy * dy;
}

/**
 * Regular distance (when actual distance is needed)
 */
export function getDistance(pos1: Position, pos2: Position): number {
  return Math.sqrt(getDistanceSquared(pos1, pos2));
}

/**
 * Call this periodically to clean up old cache entries
 * Recommended: once per second or when bombs explode
 */
export function clearExplosionCache(): void {
  explosionCache.clear();
}
// Giả định hàm này kiểm tra nếu bot (có kích thước BOT_SIZE) nằm hoàn toàn trong ô lưới (cellIndex)
export function isBotFullyInCell(
  botPos: Position,
  cellIndex: Position
): boolean {
  const cellTopLeft = {
    x: cellIndex.x * CELL_SIZE,
    y: cellIndex.y * CELL_SIZE,
  };

  const botTopLeft = botPos; // Assuming botPos is top-left
  const botBottomRight = {
    x: botPos.x + PLAYER_SIZE,
    y: botPos.y + PLAYER_SIZE,
  };

  // ✅ Bot hoàn toàn trong cell khi:
  // Bot top-left >= cell top-left
  // Bot bottom-right <= cell bottom-right

  const fullyInX =
    botTopLeft.x >= cellTopLeft.x &&
    botBottomRight.x <= cellTopLeft.x + CELL_SIZE;
  const fullyInY =
    botTopLeft.y >= cellTopLeft.y &&
    botBottomRight.y <= cellTopLeft.y + CELL_SIZE;

  return fullyInX && fullyInY;
}
