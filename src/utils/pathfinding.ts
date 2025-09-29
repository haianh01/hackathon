import { GameState, Position, Direction } from '../types';
import { manhattanDistance, getPositionInDirection } from './position';

/**
 * Pathfinding sử dụng thuật toán A*
 */
export class Pathfinding {
  /**
   * Tìm đường đi ngắn nhất từ start đến goal
   */
  static findPath(start: Position, goal: Position, gameState: GameState): Position[] {
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
        const tentativeGScore = (gScore.get(this.positionKey(current)) || 0) + 1;
        const neighborKey = this.positionKey(neighbor);
        
        if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeGScore);
          fScore.set(neighborKey, tentativeGScore + manhattanDistance(neighbor, goal));
          
          if (!openSet.some(pos => pos.x === neighbor.x && pos.y === neighbor.y)) {
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

  private static reconstructPath(cameFrom: Map<string, Position>, current: Position): Position[] {
    const path = [current];
    
    while (cameFrom.has(this.positionKey(current))) {
      current = cameFrom.get(this.positionKey(current))!;
      path.unshift(current);
    }
    
    return path;
  }

  private static getNeighbors(position: Position, gameState: GameState): Position[] {
    const neighbors: Position[] = [];
    const directions = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    
    for (const direction of directions) {
      const neighbor = getPositionInDirection(position, direction);
      
      // Kiểm tra neighbor có hợp lệ không
      if (this.isValidPosition(neighbor, gameState)) {
        neighbors.push(neighbor);
      }
    }
    
    return neighbors;
  }

  private static isValidPosition(position: Position, gameState: GameState): boolean {
    // Kiểm tra nằm trong bản đồ
    if (position.x < 0 || position.x >= gameState.map.width || 
        position.y < 0 || position.y >= gameState.map.height) {
      return false;
    }
    
    // Kiểm tra không bị tường chặn
    const hasWall = gameState.map.walls.some(wall => 
      wall.position.x === position.x && wall.position.y === position.y
    );
    
    return !hasWall;
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
export function calculatePositionScore(position: Position, gameState: GameState): number {
  let score = 0;
  
  // Điểm cơ bản cho vị trí trung tâm
  const centerX = gameState.map.width / 2;
  const centerY = gameState.map.height / 2;
  const distanceFromCenter = manhattanDistance(position, { x: centerX, y: centerY });
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
