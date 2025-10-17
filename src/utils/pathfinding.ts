import { GameState, Position, Bomb } from "../types";
import { manhattanDistance } from "./position";
import { MinHeap } from "./minHeap";
import {
  pixelToCellIndex,
  getMapCellDimensions,
  createCellIndexKey,
} from "./coordinates";
import {
  // Import unified collision system from constants
  isBlocked,
  cellToPixelCorner,
  WALL_SIZE,
  isWithinCellBounds,
  CELL_SIZE,
  MOVE_STEP_SIZE,
  MOVE_INTERVAL_MS,
  cellToPixelCenter,
} from "./constants";

/**
 * Options for pathfinding behavior
 */
export interface PathfindingOptions {
  /** Ignore all bombs when pathfinding (e.g., for hypothetical paths) */
  ignoreBombs?: boolean;
  /** Allow passing through this specific bomb position once (e.g., own bomb after placing) */
  allowOwnBomb?: Position;
}

/**
 * Pathfinding sử dụng thuật toán A* với MinHeap optimization
 * All pathfinding operates on CELL INDICES for performance and consistency
 *
 * IMPORTANT: Path results return CELL CENTER positions (not top-left corners)
 * to ensure safe bot movement and avoid collision issues.
 */
export class Pathfinding {
  /**
   * Manhattan distance heuristic for pathfinding (on cell indices).
   */
  static heuristic(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Tìm đường đi ngắn nhất từ start đến goal
   * Input positions can be in pixels, will be converted to cell indices internally
   */
  static findPath(
    start: Position,
    goal: Position,
    gameState: GameState,
    options?: PathfindingOptions
  ): Position[] {
    // Convert pixel positions to cell indices for pathfinding
    const startCell = pixelToCellIndex(start);
    const goalCell = pixelToCellIndex(goal);

    // Early exit optimization: if already at goal
    const startKey = createCellIndexKey(startCell);
    const goalKey = createCellIndexKey(goalCell);
    if (startKey === goalKey) {
      // Return normalized cell center for consistency with path results
      return [
        {
          x: startCell.x * CELL_SIZE + CELL_SIZE / 2,
          y: startCell.y * CELL_SIZE + CELL_SIZE / 2,
        },
      ];
    }

    const openSet = new MinHeap<Position>();
    const cameFrom = new Map<string, Position>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const closedSet = new Set<string>();

    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(startCell, goalCell));
    openSet.insert(startCell, fScore.get(startKey) || 0);

    while (!openSet.isEmpty()) {
      const current = openSet.extractMin();
      if (!current) break;

      const currentKey = createCellIndexKey(current);

      // If we reached the goal
      if (currentKey === goalKey) {
        const path = this.reconstructPath(cameFrom, current);
        // Convert cell indices back to pixel positions (cell centers)
        return path.map((cellIndex) => ({
          x: cellIndex.x * CELL_SIZE + CELL_SIZE / 2,
          y: cellIndex.y * CELL_SIZE + CELL_SIZE / 2,
        }));
      }

      closedSet.add(currentKey);

      // Check neighbors (pass options for bomb handling)
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
          const fScoreValue =
            tentativeGScore + this.heuristic(neighbor, goalCell);
          fScore.set(neighborKey, fScoreValue);

          // Update heap (note: our simple heap doesn't support efficient decrease-key,
          // so we just insert again - the duplicate will be handled by closedSet)
          openSet.insert(neighbor, fScoreValue);
        }
      }
    }

    return []; // No path found
  }

  private static positionKey(pos: Position): string {
    return createCellIndexKey(pos);
  }

  private static reconstructPath(
    cameFrom: Map<string, Position>,
    current: Position
  ): Position[] {
    const path = [current];
    let currentKey = this.positionKey(current);

    while (cameFrom.has(currentKey)) {
      current = cameFrom.get(currentKey)!;
      path.unshift(current);
      currentKey = this.positionKey(current);
    }

    return path;
  }

  private static getNeighbors(
    cellIndex: Position,
    gameState: GameState,
    options?: PathfindingOptions
  ): Position[] {
    const neighbors: Position[] = [];
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

      // Check if neighbor is valid (with bomb blocking logic)
      if (this.isValidCellIndex(neighbor, gameState, options)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  private static isValidCellIndex(
    cellIndex: Position,
    gameState: GameState,
    options?: PathfindingOptions
  ): boolean {
    // Check if within map bounds (using cell dimensions)
    if (
      !isWithinCellBounds(cellIndex, gameState.map.width, gameState.map.height)
    ) {
      return false;
    }

    // Convert to pixel position for unified collision checking
    const pixelPos = cellToPixelCorner(cellIndex);

    // Use unified collision system with WALL_SIZE for accurate detection
    if (isBlocked(pixelPos, gameState, WALL_SIZE)) {
      return false;
    }

    // Check bombs blocking (unless explicitly ignored)
    if (!options?.ignoreBombs && gameState.map.bombs.length > 0) {
      const cellKey = createCellIndexKey(cellIndex);

      for (const bomb of gameState.map.bombs) {
        const bombCellIndex = pixelToCellIndex(bomb.position);
        const bombKey = createCellIndexKey(bombCellIndex);

        // If this cell contains a bomb
        if (cellKey === bombKey) {
          // Check if this is the "allowed own bomb" (can pass through once)
          if (options?.allowOwnBomb) {
            const ownBombCellIndex = pixelToCellIndex(options.allowOwnBomb);
            const ownBombKey = createCellIndexKey(ownBombCellIndex);

            // Allow passing through own bomb
            if (bombKey === ownBombKey) {
              continue; // This bomb is allowed, check next bomb
            }
          }

          // Block this cell - contains enemy bomb or non-allowed bomb
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Finds the shortest path from a start position to any of a set of goal positions.
   * @param start The starting position (pixels).
   * @param goals An array of possible goal positions (pixels).
   * @param gameState The current game state.
   * @param options Pathfinding options (bomb handling, etc.)
   * @returns The path as an array of positions in pixels, or null if no path is found.
   */
  static findShortestPath(
    start: Position,
    goals: Position[],
    gameState: GameState,
    options?: PathfindingOptions
  ): Position[] | null {
    if (goals.length === 0) {
      return null;
    }

    // Convert all to cell indices
    const startCell = pixelToCellIndex(start);
    const goalCells = goals.map(pixelToCellIndex);

    const openSet = new MinHeap<Position>();
    const cameFrom = new Map<string, Position>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const closedSet = new Set<string>();

    const goalSet = new Set(goalCells.map(createCellIndexKey));

    const startKey = createCellIndexKey(startCell);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.getMinHeuristic(startCell, goalCells));
    openSet.insert(startCell, fScore.get(startKey) || 0);

    while (!openSet.isEmpty()) {
      const current = openSet.extractMin();
      if (!current) break;

      const currentKey = createCellIndexKey(current);

      if (goalSet.has(currentKey)) {
        const path = this.reconstructPath(cameFrom, current);
        // Convert back to pixels (cell centers)
        return path.map((cellIndex) => ({
          x: cellIndex.x * CELL_SIZE + CELL_SIZE / 2,
          y: cellIndex.y * CELL_SIZE + CELL_SIZE / 2,
        }));
      }

      closedSet.add(currentKey);

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
          const fScoreValue =
            tentativeGScore + this.getMinHeuristic(neighbor, goalCells);
          fScore.set(neighborKey, fScoreValue);

          openSet.insert(neighbor, fScoreValue);
        }
      }
    }

    return null; // No path found
  }

  private static getMinHeuristic(
    cellIndex: Position,
    goalCells: Position[]
  ): number {
    let minDistance = Infinity;
    for (const goal of goalCells) {
      minDistance = Math.min(minDistance, this.heuristic(cellIndex, goal));
    }
    return minDistance;
  }
}

/**
 * Dự đoán vị trí của đối thủ trong tương lai
 */
export function predictEnemyPosition(enemy: any, steps: number): Position {
  // Dự đoán đơn giản: giả sử enemy di chuyển theo hướng hiện tại
  // Trong thực tế, có thể sử dụng machine learning để dự đoán chính xác hơn

  // Nếu không có thông tin về hướng di chuyển, giả sử đứng yên
  return { ...enemy.position };
}

/**
 * Tính điểm ưu tiên cho vị trí dựa trên nhiều yếu tố
 */
export function calculatePositionScore(
  position: Position,
  gameState: GameState
): number {
  let score = 0;

  // Điểm cơ bản cho vị trí trung tâm
  const centerX = gameState.map.width / 2;
  const centerY = gameState.map.height / 2;
  const distanceFromCenter = manhattanDistance(position, {
    x: centerX,
    y: centerY,
  });
  score += Math.max(0, 100 - distanceFromCenter * 5);

  // Điểm cho vật phẩm gần đó
  for (const item of gameState.map.items) {
    const distance = manhattanDistance(position, item.position);
    if (distance <= 3) {
      score += Math.max(0, 50 - distance * 10);
    }
  }

  // Trừ điểm cho kẻ thù gần đó
  for (const enemy of gameState.enemies) {
    const distance = manhattanDistance(position, enemy.position);
    if (distance <= 4) {
      score -= Math.max(0, 60 - distance * 15);
    }
  }

  // Trừ điểm cho bom gần đó
  for (const bomb of gameState.map.bombs) {
    const distance = manhattanDistance(position, bomb.position);
    if (distance <= bomb.flameRange + 1) {
      score -= Math.max(0, 100 - distance * 20);
    }
  }

  return score;
}

/**
 * Tính danh sách ô bị ảnh hưởng bởi vụ nổ của 1 quả bom (conservative)
 * Explosion sẽ lan theo 4 hướng, dừng khi gặp tường cứng.
 * Returns cell indices as keys
 */
export function computeExplosionCells(
  bomb: Bomb,
  gameState: GameState,
  cellSize = CELL_SIZE
): Set<string> {
  const unsafe = new Set<string>();

  // Convert bomb position to cell index
  const bombCellIndex = pixelToCellIndex(bomb.position);
  const key = (cellIdx: Position) => createCellIndexKey(cellIdx);

  console.log(
    `💥 computeExplosionCells: bomb at (${bombCellIndex.x}, ${bombCellIndex.y}), range: ${bomb.flameRange}`
  );

  // Add bomb cell itself
  unsafe.add(key(bombCellIndex));

  // Pre-compute wall and chest cell indices for faster lookup and accurate matching
  const solidWallCells = new Set<string>();
  const destructibleCells = new Set<string>(); // chests + destructible walls

  // Convert walls to cell indices (more reliable than pixel comparison)
  for (const wall of gameState.map.walls) {
    const cellIdx = pixelToCellIndex(wall.position);
    const cellKey = key(cellIdx);
    if (!wall.isDestructible) {
      solidWallCells.add(cellKey);
    } else {
      destructibleCells.add(cellKey);
    }
  }

  // Convert chests to cell indices
  for (const chest of gameState.map.chests || []) {
    const cellIdx = pixelToCellIndex(chest.position);
    destructibleCells.add(key(cellIdx));
  }

  const directions = [
    { x: 0, y: -1 }, // UP
    { x: 0, y: 1 }, // DOWN
    { x: -1, y: 0 }, // LEFT
    { x: 1, y: 0 }, // RIGHT
  ];

  // Calculate map bounds in cells
  const maxCellX = Math.floor(gameState.map.width / CELL_SIZE);
  const maxCellY = Math.floor(gameState.map.height / CELL_SIZE);

  for (const dir of directions) {
    let currentCell = { ...bombCellIndex };

    for (let i = 1; i <= (bomb.flameRange || 2); i++) {
      currentCell = {
        x: currentCell.x + dir.x,
        y: currentCell.y + dir.y,
      };

      // Check bounds first
      if (
        currentCell.x < 0 ||
        currentCell.x >= maxCellX ||
        currentCell.y < 0 ||
        currentCell.y >= maxCellY
      ) {
        break;
      }

      const cellKey = key(currentCell);

      // Check if blocked by solid wall (non-destructible)
      // Solid walls BLOCK explosion completely - don't add this cell
      if (solidWallCells.has(cellKey)) {
        break;
      }

      // Add this cell to unsafe zone
      unsafe.add(cellKey);

      // Check if blocked by destructible (chest or destructible wall)
      // Explosion HITS destructible, but stops propagating beyond it
      if (destructibleCells.has(cellKey)) {
        break;
      }
    }
  }

  console.log(`   💥 Total unsafe cells: ${unsafe.size}`);
  return unsafe;
}

/**
 * Kiểm tra xem bot có thể thoát khỏi vùng bị nổ của 1 quả bom hay không,
 * xét đến tường và rương cản đường bằng cách dùng BFS trên lưới ô.
 * Trả về true nếu tồn tại đường đi đến ô an toàn trước khi bom nổ.
 */
export function canEscapeFromBomb(
  startPos: Position,
  bomb: Bomb,
  gameState: GameState,
  cellSize = CELL_SIZE,
  moveIntervalMs = MOVE_INTERVAL_MS
): boolean {
  console.log(`🔍 DEBUG canEscapeFromBomb: Starting detailed analysis...`);
  console.log(`   Start position: (${startPos.x}, ${startPos.y})`);
  console.log(`   Bomb position: (${bomb.position.x}, ${bomb.position.y})`);
  console.log(`   Bomb range: ${bomb.flameRange}, time: ${bomb.timeRemaining}`);

  // Fast BFS-based escape check
  const startCellIndex = pixelToCellIndex(startPos);
  console.log(
    `   Start cell index: (${startCellIndex.x}, ${startCellIndex.y})`
  );

  const unsafe = computeExplosionCells(bomb, gameState, cellSize);
  console.log(`   Unsafe cells count: ${unsafe.size}`);

  const startKey = createCellIndexKey(startCellIndex);
  console.log(`   Start key: ${startKey}`);

  // If cell is not in unsafe set, verify with pixel-level distance
  if (!unsafe.has(startKey)) {
    console.log(
      `   ℹ️ Start cell not in unsafe cell set, verifying pixel distance...`
    );

    // ADDITIONAL CHECK: Verify pixel-level safety for accuracy
    const pixelDistance = manhattanDistance(startPos, bomb.position);
    const dangerRadius = bomb.flameRange * cellSize + 15; // Add safety margin

    if (pixelDistance > dangerRadius) {
      console.log(
        `   ✅ Confirmed safe by pixel distance (${pixelDistance.toFixed(
          0
        )}px > ${dangerRadius}px)`
      );
      return true;
    } else {
      console.log(
        `   ⚠️ Cell safe but pixel distance close (${pixelDistance.toFixed(
          0
        )}px <= ${dangerRadius}px), continuing BFS search...`
      );
    }
  } else {
    console.log(`   ⚠️ Start position IS in danger zone, need to find escape`);
  }

  // BFS queue: each entry is {cellIndex, steps} where steps = number of cell moves from start
  const queue: { cellIndex: Position; steps: number }[] = [
    { cellIndex: startCellIndex, steps: 0 },
  ];
  const visited = new Set<string>([startKey]);

  // Calculate movement parameters
  const botSpeed = gameState.currentBot.speed || 1;
  const pixelsPerMove = botSpeed * MOVE_STEP_SIZE; // More accurate calculation
  const timeRemaining = bomb.timeRemaining || 5000;

  console.log(
    `   🏃 Movement params: speed=${botSpeed}, pixelsPerMove=${pixelsPerMove}, timeRemaining=${timeRemaining}ms`
  );

  // Safety cap to avoid infinite loops
  const mapCellDims = getMapCellDimensions(
    gameState.map.width,
    gameState.map.height
  );
  const maxVisits = Math.max(512, mapCellDims.width * mapCellDims.height * 4);
  let visits = 0;

  while (queue.length > 0) {
    const node = queue.shift()!;
    visits++;
    console.log(
      `   🔄 Visit ${visits}: Exploring cell (${node.cellIndex.x}, ${node.cellIndex.y}) at steps ${node.steps}`
    );

    if (visits > maxVisits) {
      console.log(`   ⚠️ Max visits reached: ${maxVisits}`);
      break;
    }

    // Explore 4-direction neighbors
    const directions = [
      { x: 0, y: -1 }, // UP
      { x: 0, y: 1 }, // DOWN
      { x: -1, y: 0 }, // LEFT
      { x: 1, y: 0 }, // RIGHT
    ];

    for (const dir of directions) {
      const nextCellIndex = {
        x: node.cellIndex.x + dir.x,
        y: node.cellIndex.y + dir.y,
      };
      const key = createCellIndexKey(nextCellIndex);

      console.log(
        `      Checking neighbor: (${nextCellIndex.x}, ${nextCellIndex.y}), key: ${key}`
      );

      // Check visited first (but don't add yet)
      if (visited.has(key)) {
        console.log(`      ⏭️ Already visited`);
        continue;
      }

      // Bounds check BEFORE marking as visited
      if (
        !isWithinCellBounds(
          nextCellIndex,
          gameState.map.width,
          gameState.map.height
        )
      ) {
        console.log(`      ❌ Out of bounds`);
        continue;
      }

      // Wall/chest blocker check using unified collision system
      const pixelPos = cellToPixelCorner(nextCellIndex);

      if (isBlocked(pixelPos, gameState, WALL_SIZE)) {
        console.log(
          `      🚧 Blocked by wall/chest at (${pixelPos.x}, ${pixelPos.y})`
        );
        continue;
      }

      // Calculate arrival time for this cell
      const nextSteps = node.steps + 1;
      const distancePx = nextSteps * CELL_SIZE; // pixels needed to reach this cell
      const pixelsPerSecond = (1000 / moveIntervalMs) * pixelsPerMove;
      const arrivalTimeMs = (distancePx / pixelsPerSecond) * 1000;

      console.log(
        `      ✅ Valid neighbor, distance: ${distancePx}px, unsafe: ${unsafe.has(
          key
        )}, arrival: ${arrivalTimeMs.toFixed(0)}ms`
      );

      // CRITICAL FIX: Check if we can pass through unsafe cells before bomb explodes
      if (unsafe.has(key)) {
        // Cell is in explosion zone - can only pass if we get through BEFORE bomb explodes
        if (arrivalTimeMs >= timeRemaining) {
          console.log(
            `      ⚠️ Unsafe cell but arrival time ${arrivalTimeMs.toFixed(
              0
            )}ms >= bomb time ${timeRemaining}ms - skip`
          );
          continue; // Can't pass through this unsafe cell in time
        }
        console.log(
          `      ⚠️ Unsafe cell but can pass through (arrival ${arrivalTimeMs.toFixed(
            0
          )}ms < bomb ${timeRemaining}ms)`
        );
      }

      // NOW it's safe to mark as visited (after all validation)
      visited.add(key);

      // If this cell is SAFE (not in unsafe set), check if we can reach it in time
      if (!unsafe.has(key)) {
        console.log(
          `     🎯 SAFE CELL FOUND: (${nextCellIndex.x}, ${nextCellIndex.y})`
        );
        console.log(`        Distance: ${distancePx}px`);
        console.log(`        Speed: ${pixelsPerSecond.toFixed(1)}px/s`);
        console.log(`        Arrival time: ${arrivalTimeMs.toFixed(0)}ms`);
        console.log(`        Time remaining: ${timeRemaining}ms`);

        if (arrivalTimeMs <= timeRemaining) {
          console.log(`     ✅ CAN ESCAPE! Found safe position in time`);
          return true; // found escape
        } else {
          console.log(
            `     ❌ Too slow! Need ${arrivalTimeMs.toFixed(
              0
            )}ms but only have ${timeRemaining}ms`
          );
        }
        // else: even though safe, cannot reach in time; continue exploring
      }

      // Enqueue for further exploration (if cell passed all checks)
      console.log(`      📝 Adding to queue for further exploration`);
      queue.push({ cellIndex: nextCellIndex, steps: nextSteps });
    }
  }

  console.log(`   ❌ NO ESCAPE FOUND after ${visits} visits`);
  return false;
}
// Định nghĩa kiểu trả về mới
type EscapePathResult = {
  nextStep: Position; // Vị trí pixel của bước đi đầu tiên
  targetCell: Position; // Vị trí cell index của đích an toàn
  fullSteps: number; // Tổng số bước (cells) đến đích
} | null;

/**
 * Sử dụng BFS để tìm đường đi ngắn nhất (bằng số bước) từ startPos
 * đến một ô an toàn mà có thể đến được trước khi bom nổ.
 * * @param startPos Vị trí pixel bắt đầu của bot.
 * @param bomb Thông tin về quả bom.
 * @param gameState Trạng thái hiện tại của trò chơi.
 * @returns {nextStep, targetCell, fullSteps} hoặc null nếu không thể thoát.
 */
export function findEscapePath(
  startPos: Position,
  bomb: Bomb,
  gameState: GameState,
  cellSize = CELL_SIZE,
  moveIntervalMs = MOVE_INTERVAL_MS
): EscapePathResult {
  const startCellIndex = pixelToCellIndex(startPos);
  const unsafe = computeExplosionCells(bomb, gameState, cellSize);
  const startKey = createCellIndexKey(startCellIndex);

  // Khởi tạo hàng đợi và Map truy vết (parentMap)
  // parentMap: 'key_cua_con' -> 'key_cua_cha'
  const queue: { cellIndex: Position; steps: number }[] = [
    { cellIndex: startCellIndex, steps: 0 },
  ];
  const parentMap = new Map<string, string>(); // Key -> Parent Key
  const visited = new Set<string>([startKey]);

  // Tính toán tham số di chuyển
  const botSpeed = gameState.currentBot.speed || 1;
  const pixelsPerMove = botSpeed * MOVE_STEP_SIZE;
  const timeRemaining = bomb.timeRemaining || 5000;
  const pixelsPerSecond = (1000 / moveIntervalMs) * pixelsPerMove;

  // ... (Phần logic kiểm tra an toàn tại chỗ có thể giữ lại hoặc đơn giản hóa) ...
  // Giả định nếu bot đang đứng trên ô an toàn (không bị ảnh hưởng), nó đã thoát.

  // Giới hạn vòng lặp
  const mapCellDims = getMapCellDimensions(
    gameState.map.width,
    gameState.map.height
  );
  const maxVisits = mapCellDims.width * mapCellDims.height * 2;
  let visits = 0;
  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }, // 4 hướng
  ];

  while (queue.length > 0) {
    const node = queue.shift()!;
    visits++;

    if (visits > maxVisits) return null; // Vượt quá giới hạn

    for (const dir of directions) {
      const nextCellIndex = {
        x: node.cellIndex.x + dir.x,
        y: node.cellIndex.y + dir.y,
      };
      const key = createCellIndexKey(nextCellIndex);

      if (visited.has(key)) continue;

      // 1. Kiểm tra giới hạn (Bounds Check)
      if (
        !isWithinCellBounds(
          nextCellIndex,
          gameState.map.width,
          gameState.map.height
        )
      ) {
        continue;
      }

      // 2. Kiểm tra vật cản (Blocking Check)
      const pixelPos = cellToPixelCorner(nextCellIndex);
      if (isBlocked(pixelPos, gameState, WALL_SIZE)) {
        continue;
      }

      const nextSteps = node.steps + 1;
      const distancePx = nextSteps * cellSize;
      const arrivalTimeMs = (distancePx / pixelsPerSecond) * 1000;

      // 3. Kiểm tra Thời gian và Nguy hiểm (Time & Danger Check)
      if (unsafe.has(key)) {
        // Nếu ô nguy hiểm, phải đi qua (và thoát ra) trước khi bom nổ
        if (arrivalTimeMs >= timeRemaining) {
          continue; // Không thể đi qua kịp thời
        }
      }

      // Đã vượt qua mọi kiểm tra. Lưu lại cha và thêm vào hàng đợi.
      visited.add(key);
      parentMap.set(key, createCellIndexKey(node.cellIndex));

      // 4. KIỂM TRA ĐÍCH AN TOÀN (Escape Target Check)
      if (!unsafe.has(key)) {
        // 🎯 Đã tìm thấy ô AN TOÀN đầu tiên

        if (arrivalTimeMs <= timeRemaining) {
          // Có thể đến đích an toàn kịp thời

          // Truy vết để tìm bước đi đầu tiên
          const nextStepCellIndex = reconstructFirstStep(
            parentMap,
            startCellIndex,
            nextCellIndex
          );
          const nextStepPixelPos = cellToPixelCenter(nextStepCellIndex);

          return {
            nextStep: nextStepPixelPos,
            targetCell: nextCellIndex,
            fullSteps: nextSteps,
          };
        }
        // Nếu an toàn nhưng không đến kịp, vẫn tiếp tục tìm kiếm (vì đây là BFS, không cần thêm vào queue nữa)
      }

      // Thêm vào hàng đợi để tìm kiếm các ô xa hơn
      queue.push({ cellIndex: nextCellIndex, steps: nextSteps });
    }
  }

  return null; // Không tìm thấy đường thoát
}

// ----------------------------------------------------------------------------------------------------------------------

/**
 * Hàm hỗ trợ: Truy vết ngược từ đích đến START để tìm BƯỚC ĐI ĐẦU TIÊN (index 1).
 * @param parentMap Map chứa quan hệ con -> cha.
 * @param startCellIndex Vị trí cell index bắt đầu.
 * @param endCellIndex Vị trí cell index đích.
 * @returns Vị trí cell index của bước đi đầu tiên sau startCellIndex.
 */
function reconstructFirstStep(
  parentMap: Map<string, string>,
  startCellIndex: Position,
  endCellIndex: Position
): Position {
  const startKey = createCellIndexKey(startCellIndex);
  let currentKey = createCellIndexKey(endCellIndex);
  let pathKeys: string[] = [];

  // 1. Dựng lại đường đi từ Đích về Gốc
  while (currentKey !== startKey) {
    pathKeys.unshift(currentKey);
    const parentKey = parentMap.get(currentKey);
    if (!parentKey) break; // Lỗi, không tìm thấy cha
    currentKey = parentKey;
  }

  // 2. Bước đi đầu tiên là phần tử đầu tiên của đường đi (index 0 của pathKeys)
  const firstStepKey = pathKeys[0];

  // Nếu không tìm được bước đi đầu tiên, trả về vị trí bắt đầu làm fallback
  if (!firstStepKey) {
    return startCellIndex;
  }

  // Chuyển key trở lại Position với kiểm tra an toàn
  const parts = firstStepKey.split(",");
  const px = Number(parts[0]);
  const py = Number(parts[1]);

  // Nếu giá trị không hợp lệ (undefined -> NaN / not finite), trả về fallback
  if (!Number.isFinite(px) || !Number.isFinite(py)) {
    return startCellIndex;
  }

  return { x: px, y: py };
}

// Giả định các hàm phụ trợ (pixelToCellIndex, cellToPixelCenter, isBlocked, computeExplosionCells, v.v.)
// đã được định nghĩa và có sẵn trong phạm vi mã của bạn.
