import { GameState, Position, Direction, Bomb } from "../types";
import { manhattanDistance, getPositionInDirection } from "./position";
import { MinHeap } from "./minHeap";
import {
  CELL_SIZE,
  MOVE_STEP_SIZE,
  MOVE_INTERVAL_MS,
  pixelToCell,
  pixelToCellIndex,
  isWithinCellBounds,
  getMapCellDimensions,
  createCellIndexKey,
} from "./coordinates";

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
    gameState: GameState
  ): Position[] {
    // Convert pixel positions to cell indices for pathfinding
    const startCell = pixelToCellIndex(start);
    const goalCell = pixelToCellIndex(goal);

    const openSet = new MinHeap<Position>();
    const cameFrom = new Map<string, Position>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const closedSet = new Set<string>();

    const startKey = createCellIndexKey(startCell);
    const goalKey = createCellIndexKey(goalCell);

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

      // Check neighbors
      const neighbors = this.getNeighbors(current, gameState);

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
    gameState: GameState
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

      // Check if neighbor is valid
      if (this.isValidCellIndex(neighbor, gameState)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  private static isValidCellIndex(
    cellIndex: Position,
    gameState: GameState
  ): boolean {
    // Check if within map bounds (using cell dimensions)
    if (
      !isWithinCellBounds(cellIndex, gameState.map.width, gameState.map.height)
    ) {
      return false;
    }

    // Convert to pixel position for obstacle checking
    const pixelPos: Position = {
      x: cellIndex.x * CELL_SIZE,
      y: cellIndex.y * CELL_SIZE,
    };

    // Check for solid walls or chests at this position
    const hasSolidWall = gameState.map.walls.some(
      (wall) =>
        wall.position.x === pixelPos.x &&
        wall.position.y === pixelPos.y &&
        !wall.isDestructible
    );

    const hasChest = gameState.map.chests.some(
      (chest) =>
        chest.position.x === pixelPos.x && chest.position.y === pixelPos.y
    );

    return !(hasSolidWall || hasChest);
  }

  /**
   * Finds the shortest path from a start position to any of a set of goal positions.
   * @param start The starting position (pixels).
   * @param goals An array of possible goal positions (pixels).
   * @param gameState The current game state.
   * @returns The path as an array of positions in pixels, or null if no path is found.
   */
  static findShortestPath(
    start: Position,
    goals: Position[],
    gameState: GameState
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

      const neighbors = this.getNeighbors(current, gameState);
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
 * Chuyển vị trí pixel sang vị trí ô (cell) căn giữa theo kích thước ô
 * @deprecated Use coordinates.pixelToCell instead
 */
export function toCellPosition(pos: Position, cellSize = CELL_SIZE): Position {
  return pixelToCell(pos);
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

  console.log(`💥 DEBUG computeExplosionCells:`);
  console.log(`   Bomb at pixel: (${bomb.position.x}, ${bomb.position.y})`);
  console.log(`   Bomb cell index: (${bombCellIndex.x}, ${bombCellIndex.y})`);
  console.log(`   Flame range: ${bomb.flameRange}`);

  unsafe.add(key(bombCellIndex));

  const directions = [
    { x: 0, y: -1 }, // UP
    { x: 0, y: 1 }, // DOWN
    { x: -1, y: 0 }, // LEFT
    { x: 1, y: 0 }, // RIGHT
  ];

  for (const dir of directions) {
    console.log(`   🔥 Direction: dx=${dir.x}, dy=${dir.y}`);
    let currentCell = { ...bombCellIndex };

    for (let i = 1; i <= (bomb.flameRange || 2); i++) {
      currentCell = {
        x: currentCell.x + dir.x,
        y: currentCell.y + dir.y,
      };

      console.log(
        `      Range ${i}: cell (${currentCell.x}, ${currentCell.y})`
      );

      // Mark the cell as unsafe
      unsafe.add(key(currentCell));

      // Check for solid wall at this cell (convert to pixel for checking)
      const pixelPos = {
        x: currentCell.x * CELL_SIZE,
        y: currentCell.y * CELL_SIZE,
      };

      const isSolidWall = gameState.map.walls.some(
        (w) =>
          w.position.x === pixelPos.x &&
          w.position.y === pixelPos.y &&
          !w.isDestructible
      );

      if (isSolidWall) {
        console.log(
          `      BLOCKED by solid wall at (${pixelPos.x}, ${pixelPos.y})`
        );
        break;
      }
    }
  }

  console.log(`   💥 Total unsafe cells: ${unsafe.size}`);
  console.log(`   💥 Unsafe cell list: [${Array.from(unsafe).join(", ")}]`);
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

  // If already safe
  if (!unsafe.has(startKey)) {
    console.log(`   ✅ Already safe! Start position not in danger zone`);
    return true;
  }

  console.log(`   ⚠️ Start position IS in danger zone, need to find escape`);

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

      if (visited.has(key)) {
        console.log(`      ⏭️ Already visited`);
        continue;
      }
      visited.add(key);

      // bounds check
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

      // wall/chest blocker check
      const pixelPos = {
        x: nextCellIndex.x * CELL_SIZE,
        y: nextCellIndex.y * CELL_SIZE,
      };

      const isBlocked =
        gameState.map.walls.some(
          (w) => w.position.x === pixelPos.x && w.position.y === pixelPos.y
        ) ||
        gameState.map.chests.some(
          (c) => c.position.x === pixelPos.x && c.position.y === pixelPos.y
        );

      if (isBlocked) {
        console.log(
          `      🚧 Blocked by wall/chest at (${pixelPos.x}, ${pixelPos.y})`
        );
        continue;
      }

      const nextSteps = node.steps + 1;
      const distancePx = nextSteps * CELL_SIZE; // pixels needed to reach this cell

      console.log(
        `      ✅ Valid neighbor, distance: ${distancePx}px, unsafe: ${unsafe.has(
          key
        )}`
      );

      // If this cell is not in unsafe set, evaluate time to reach
      if (!unsafe.has(key)) {
        // FIXED: Sử dụng tính toán thời gian thực tế
        // Bot di chuyển với continuous movement ~17ms/command
        // Với tốc độ 3px/command, trong 1 giây có thể di chuyển ~180px
        const pixelsPerSecond = (1000 / 17) * pixelsPerMove; // ~176 px/s
        const timeNeededMs = (distancePx / pixelsPerSecond) * 1000;

        console.log(
          `     🎯 SAFE CELL FOUND: (${nextCellIndex.x}, ${nextCellIndex.y})`
        );
        console.log(`        Distance: ${distancePx}px`);
        console.log(`        Speed: ${pixelsPerSecond.toFixed(1)}px/s`);
        console.log(`        Time needed: ${timeNeededMs.toFixed(0)}ms`);
        console.log(`        Time remaining: ${timeRemaining}ms`);

        if (timeNeededMs <= timeRemaining) {
          console.log(`     ✅ CAN ESCAPE! Found safe position in time`);
          return true; // found escape
        } else {
          console.log(
            `     ❌ Too slow! Need ${timeNeededMs.toFixed(
              0
            )}ms but only have ${timeRemaining}ms`
          );
        }
        // else: even though safe, cannot reach in time; continue exploring
      }

      // enqueue for further exploration
      console.log(`      📝 Adding to queue for further exploration`);
      queue.push({ cellIndex: nextCellIndex, steps: nextSteps });
    }
  }

  console.log(`   ❌ NO ESCAPE FOUND after ${visits} visits`);
  return false;
}
