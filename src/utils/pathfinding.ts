import { GameState, Position, Direction, Bomb } from "../types";
import { manhattanDistance, getPositionInDirection } from "./position";

/**
 * Pathfinding sử dụng thuật toán A*
 */
export class Pathfinding {
  /**
   * Tìm đường đi ngắn nhất từ start đến goal
   */
  static findPath(
    start: Position,
    goal: Position,
    gameState: GameState
  ): Position[] {
    const openSet = [start];
    const cameFrom = new Map<string, Position>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    gScore.set(this.positionKey(start), 0);
    fScore.set(this.positionKey(start), manhattanDistance(start, goal));

    while (openSet.length > 0) {
      // Tìm node có fScore thấp nhất
      let current = openSet[0]!;
      let currentIndex = 0;

      for (let i = 1; i < openSet.length; i++) {
        const currentF = fScore.get(this.positionKey(openSet[i]!)) || Infinity;
        const bestF = fScore.get(this.positionKey(current)) || Infinity;

        if (currentF < bestF) {
          current = openSet[i]!;
          currentIndex = i;
        }
      }

      // Nếu đã đến đích
      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(cameFrom, current);
      }

      // Loại bỏ current khỏi openSet
      openSet.splice(currentIndex, 1);

      // Kiểm tra các neighbors
      const neighbors = this.getNeighbors(current, gameState);

      for (const neighbor of neighbors) {
        const tentativeGScore =
          (gScore.get(this.positionKey(current)) || 0) + 1;
        const neighborKey = this.positionKey(neighbor);

        if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeGScore);
          fScore.set(
            neighborKey,
            tentativeGScore + manhattanDistance(neighbor, goal)
          );

          if (
            !openSet.some((pos) => pos.x === neighbor.x && pos.y === neighbor.y)
          ) {
            openSet.push(neighbor);
          }
        }
      }
    }

    return []; // Không tìm thấy đường
  }

  private static positionKey(pos: Position): string {
    return `${pos.x},${pos.y}`;
  }

  private static reconstructPath(
    cameFrom: Map<string, Position>,
    current: Position
  ): Position[] {
    const path = [current];

    while (cameFrom.has(this.positionKey(current))) {
      current = cameFrom.get(this.positionKey(current))!;
      path.unshift(current);
    }

    return path;
  }

  private static getNeighbors(
    position: Position,
    gameState: GameState
  ): Position[] {
    const neighbors: Position[] = [];
    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];

    for (const direction of directions) {
      const neighbor = getPositionInDirection(position, direction);

      // Kiểm tra neighbor có hợp lệ không
      if (this.isValidPosition(neighbor, gameState)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  private static isValidPosition(
    position: Position,
    gameState: GameState
  ): boolean {
    // Kiểm tra nằm trong bản đồ
    if (
      position.x < 0 ||
      position.x >= gameState.map.width ||
      position.y < 0 ||
      position.y >= gameState.map.height
    ) {
      return false;
    }

    // Kiểm tra không bị tường cứng hoặc rương (chest) chặn
    const hasSolidWall = gameState.map.walls.some(
      (wall) =>
        wall.position.x === position.x &&
        wall.position.y === position.y &&
        !wall.isDestructible
    );

    const hasChest = gameState.map.walls.some(
      (wall) =>
        wall.position.x === position.x &&
        wall.position.y === position.y &&
        wall.isDestructible
    );

    // Cả tường cứng và rương đều chặn đường
    return !(hasSolidWall || hasChest);
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
 * Chuyển vị trí pixel sang vị trí ô (cell) căn giữa theo kích thước ô (default 40px)
 */
export function toCellPosition(pos: Position, cellSize = 40): Position {
  return {
    x: Math.round(pos.x / cellSize) * cellSize,
    y: Math.round(pos.y / cellSize) * cellSize,
  };
}

/**
 * Tính danh sách ô bị ảnh hưởng bởi vụ nổ của 1 quả bom (conservative)
 * Explosion sẽ lan theo 4 hướng, dừng khi gặp tường cứng.
 */
export function computeExplosionCells(
  bomb: Bomb,
  gameState: GameState,
  cellSize = 40
): Set<string> {
  const unsafe = new Set<string>();

  const bombCell = toCellPosition(bomb.position, cellSize);
  const key = (p: Position) => `${p.x},${p.y}`;

  unsafe.add(key(bombCell));

  const directions = [
    Direction.UP,
    Direction.DOWN,
    Direction.LEFT,
    Direction.RIGHT,
  ];
  for (const dir of directions) {
    let current = { ...bombCell };
    for (let i = 1; i <= (bomb.flameRange || 2); i++) {
      current = getPositionInDirection(current, dir, cellSize);

      // Mark the cell as unsafe
      unsafe.add(key(current));

      // `If there is a solid w`all at this cell, stop propagation
      const isSolidWall = gameState.map.walls.some(
        (w) =>
          w.position.x === current.x &&
          w.position.y === current.y &&
          !w.isDestructible
      );
      if (isSolidWall) break;
    }
  }

  return unsafe;
}

/**
 * Kiểm tra xem bot có thể thoát khỏi vùng bị nổ của 1 quả bom hay không,
 * xét đến tường và rương cản đường bằng cách dùng A* trên lưới ô 40px.
 * Trả về true nếu tồn tại đường đi đến ô an toàn trước khi bom nổ.
 */
export function canEscapeFromBomb(
  startPos: Position,
  bomb: Bomb,
  gameState: GameState,
  cellSize = 40,
  moveIntervalMs = 200
): boolean {
  // Fast BFS-based escape check (explore outward from start). This avoids
  // many A* calls and early-exits as soon as a safe reachable cell is found.
  const startCell = toCellPosition(startPos, cellSize);
  const unsafe = computeExplosionCells(bomb, gameState, cellSize);
  const startKey = `${startCell.x},${startCell.y}`;

  // If already safe
  if (!unsafe.has(startKey)) return true;

  // BFS queue: each entry is {pos, steps} where steps = number of cell moves from start
  const queue: { pos: Position; steps: number }[] = [
    { pos: startCell, steps: 0 },
  ];
  const visited = new Set<string>([startKey]);

  // Speed: pixels moved per "move tick" (1px per unit of speed)
  const pixelsPerMove = (gameState.currentBot.speed || 1) * 1;
  const timeRemaining = bomb.timeRemaining || 5000;

  // Safety cap to avoid pathological long loops (map is small, but keep guard)
  const maxVisits = Math.max(
    512,
    (gameState.map.width / cellSize) * (gameState.map.height / cellSize) * 4
  );
  let visits = 0;

  while (queue.length > 0) {
    const node = queue.shift()!;
    visits++;
    if (visits > maxVisits) break;

    // Explore 4-direction neighbors
    const dirs = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];
    for (const dir of dirs) {
      const next = getPositionInDirection(node.pos, dir, cellSize);
      const key = `${next.x},${next.y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      // bounds check
      if (
        next.x < 0 ||
        next.x >= gameState.map.width ||
        next.y < 0 ||
        next.y >= gameState.map.height
      )
        continue;

      // wall/chest blocker
      const isBlocked = gameState.map.walls.some(
        (w) => w.position.x === next.x && w.position.y === next.y
      );
      if (isBlocked) continue;

      const nextSteps = node.steps + 1;
      const distancePx = nextSteps * cellSize; // pixels needed to reach this cell

      // If this cell is not in unsafe set, evaluate time to reach
      if (!unsafe.has(key)) {
        const movesNeeded = Math.ceil(distancePx / pixelsPerMove);
        const timeNeededMs = movesNeeded * moveIntervalMs;
        if (timeNeededMs <= timeRemaining) return true; // found escape
        // else: even though safe, cannot reach in time; still continue exploring other cells
      }

      // enqueue for further exploration
      queue.push({ pos: next, steps: nextSteps });
    }
  }

  return false;
}
