/**
 * Example: Sử dụng Position Tracking & Prediction
 * 
 * Ví dụ này minh họa cách sử dụng các tính năng mới:
 * - Real-time position tracking
 * - Movement prediction
 * - Collision detection
 */

import { BaseStrategy } from "../src/strategies/baseStrategy";
import { GameState, BotDecision, BotAction, Direction } from "../src/types";
import { 
  getPositionInDirectionSmallStep,
  canMoveToPositionPrecise,
  isPositionCollidingWithWalls,
  getDirectionToTarget,
} from "../src/utils";

/**
 * Strategy ví dụ với position tracking
 */
export class SmartMoveStrategy extends BaseStrategy {
  name = "SmartMove";
  priority = 50;

  evaluate(gameState: GameState): BotDecision | null {
    const currentPos = gameState.currentBot.position;
    
    // Tìm mục tiêu (ví dụ: item gần nhất)
    const items = gameState.map.items;
    if (items.length === 0) {
      return null;
    }
    
    const targetItem = items[0]!;
    const direction = getDirectionToTarget(currentPos, targetItem.position);
    
    // Option 2: Predict vị trí tiếp theo TRƯỚC KHI di chuyển
    const predictedPos = getPositionInDirectionSmallStep(
      currentPos, 
      direction, 
      3 // 3px mỗi bước
    );
    
    console.log(`🔮 Predicted position: (${predictedPos.x}, ${predictedPos.y})`);
    
    // Kiểm tra collision với predicted position
    if (isPositionCollidingWithWalls(predictedPos, gameState, 30)) {
      console.log("❌ Predicted position sẽ va chạm với tường!");
      
      // Thử các hướng khác
      const alternativeDirections = [
        Direction.UP,
        Direction.DOWN,
        Direction.LEFT,
        Direction.RIGHT,
      ];
      
      for (const altDir of alternativeDirections) {
        const altPos = getPositionInDirectionSmallStep(currentPos, altDir, 3);
        
        if (canMoveToPositionPrecise(altPos, gameState)) {
          console.log(`✅ Tìm thấy hướng thay thế: ${altDir}`);
          return this.createDecision(
            BotAction.MOVE,
            this.priority,
            `Di chuyển hướng ${altDir} (tránh va chạm)`,
            altDir
          );
        }
      }
      
      // Không tìm được hướng nào, đứng yên
      return this.createDecision(
        BotAction.STOP,
        this.priority - 10,
        "Không thể di chuyển - tất cả hướng đều bị chặn",
        Direction.STOP
      );
    }
    
    // OK để di chuyển
    console.log(`✅ Safe to move ${direction}`);
    return this.createDecision(
      BotAction.MOVE,
      this.priority,
      `Di chuyển về phía item tại (${targetItem.position.x}, ${targetItem.position.y})`,
      direction,
      targetItem.position
    );
  }
}

/**
 * Example: Sử dụng với SocketConnection
 */
export class ExampleBotWithTracking {
  private lastKnownPosition: { x: number; y: number } | null = null;
  
  setupPositionTracking(socketConnection: any) {
    // Option 1: Đăng ký callback cho position updates
    socketConnection.onPositionUpdate((x: number, y: number) => {
      console.log(`📍 Position updated from server: (${x}, ${y})`);
      this.lastKnownPosition = { x, y };
      
      // Có thể trigger re-evaluation của AI
      this.onPositionChanged(x, y);
    });
  }
  
  private onPositionChanged(x: number, y: number) {
    console.log(`🔄 Position changed, re-evaluating strategies...`);
    // Re-run AI decision making với vị trí mới
  }
  
  makeMove(socketConnection: any, direction: Direction) {
    // Lấy vị trí hiện tại
    const currentPos = socketConnection.getCurrentPosition();
    
    if (!currentPos) {
      console.log("⚠️ Chưa có thông tin vị trí");
      return;
    }
    
    console.log(`📍 Current position: (${currentPos.x}, ${currentPos.y})`);
    
    // Predict vị trí tiếp theo
    const predictedPos = this.predictPosition(currentPos, direction);
    console.log(`🔮 Predicted position: (${predictedPos.x}, ${predictedPos.y})`);
    
    // Gửi lệnh di chuyển (SocketConnection sẽ tự predict internally)
    socketConnection.move(direction);
  }
  
  private predictPosition(
    currentPos: { x: number; y: number },
    direction: Direction
  ): { x: number; y: number } {
    const MOVE_STEP = 3;
    
    switch (direction) {
      case Direction.UP:
        return { x: currentPos.x, y: currentPos.y - MOVE_STEP };
      case Direction.DOWN:
        return { x: currentPos.x, y: currentPos.y + MOVE_STEP };
      case Direction.LEFT:
        return { x: currentPos.x - MOVE_STEP, y: currentPos.y };
      case Direction.RIGHT:
        return { x: currentPos.x + MOVE_STEP, y: currentPos.y };
      default:
        return currentPos;
    }
  }
}

/**
 * Example: Spam-safe movement
 */
export class SpamSafeMovement {
  private moveQueue: Direction[] = [];
  private isMoving: boolean = false;
  
  /**
   * Thêm move vào queue và xử lý an toàn
   */
  queueMove(direction: Direction, socketConnection: any, gameState: GameState) {
    this.moveQueue.push(direction);
    
    if (!this.isMoving) {
      this.processNextMove(socketConnection, gameState);
    }
  }
  
  private async processNextMove(socketConnection: any, gameState: GameState) {
    if (this.moveQueue.length === 0) {
      this.isMoving = false;
      return;
    }
    
    this.isMoving = true;
    const direction = this.moveQueue.shift()!;
    
    // Get current position
    const currentPos = socketConnection.getCurrentPosition();
    if (!currentPos) {
      this.isMoving = false;
      return;
    }
    
    // Predict and validate
    const predictedPos = getPositionInDirectionSmallStep(currentPos, direction, 3);
    
    if (canMoveToPositionPrecise(predictedPos, gameState)) {
      console.log(`✅ Safe move to (${predictedPos.x}, ${predictedPos.y})`);
      socketConnection.move(direction);
      
      // Wait for server confirmation (200ms throttle)
      await this.sleep(250);
      
      // Process next move
      this.processNextMove(socketConnection, gameState);
    } else {
      console.log(`❌ Unsafe move blocked`);
      this.isMoving = false;
      this.moveQueue = []; // Clear queue
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
