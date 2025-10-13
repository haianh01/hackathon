/**
 * Position Predictor - Tính toán vị trí dự đoán dựa trên timestamp và tốc độ
 * Improvement: Sử dụng thời gian và tốc độ thực tế thay vì chỉ ±1 ô
 */

import { Direction } from "../types";

export interface PositionWithTimestamp {
  x: number;
  y: number;
  timestamp: number;
}

export interface MovementState {
  position: PositionWithTimestamp;
  direction: Direction | null;
  speed: number; // Tốc độ di chuyển (ô/giây)
}

export class PositionPredictor {
  private static readonly MOVE_STEP_SIZE = 3; // Server moves 3px per tick
  private static readonly MS_PER_MOVE = 17; // Server tickrate: 17ms (~59 ticks/sec)

  /**
   * Dự đoán vị trí hiện tại dựa trên vị trí confirm cuối cùng và thời gian trôi qua
   * @param lastConfirmed Vị trí được server confirm cuối cùng (pixel coordinates)
   * @param currentDirection Hướng đang di chuyển
   * @param speed Tốc độ di chuyển (mặc định 1 = 3px/17ms)
   * @returns Vị trí dự đoán hiện tại (pixel coordinates)
   */
  public static predictCurrentPosition(
    lastConfirmed: PositionWithTimestamp,
    currentDirection: Direction | null,
    speed: number = 1
  ): { x: number; y: number; confidence: number } {
    if (!currentDirection) {
      return {
        x: lastConfirmed.x,
        y: lastConfirmed.y,
        confidence: 1.0, // 100% chắc chắn vì không di chuyển
      };
    }

    const now = Date.now();
    const timePassed = now - lastConfirmed.timestamp;

    // Tính số ticks đã di chuyển dựa trên thời gian (17ms per tick)
    const ticksPassed = Math.floor(timePassed / this.MS_PER_MOVE);
    const pixelsMoved = ticksPassed * speed; // speed multiplier for MOVE_STEP_SIZE

    // Tính vị trí dự đoán
    const predicted = this.calculatePosition(
      lastConfirmed,
      currentDirection,
      pixelsMoved
    );

    // Tính độ tin cậy (giảm dần theo thời gian)
    // Confidence = 1.0 nếu < 100ms, giảm dần xuống 0.5 sau 1000ms
    const confidence = Math.max(0.5, 1.0 - timePassed / 1000);

    return {
      ...predicted,
      confidence,
    };
  }

  /**
   * Dự đoán vị trí sau N bước di chuyển
   * @param current Vị trí hiện tại (pixel coordinates)
   * @param direction Hướng di chuyển
   * @param steps Số bước di chuyển (mỗi bước = 3px)
   * @returns Vị trí sau khi di chuyển (pixel coordinates)
   */
  public static predictNextPosition(
    current: { x: number; y: number },
    direction: Direction,
    steps: number = 1
  ): { x: number; y: number } {
    const delta = this.getDirectionDelta(direction);

    return {
      x: current.x + delta.x * steps,
      y: current.y + delta.y * steps,
    };
  }

  /**
   * Tính toán vị trí dựa trên hướng và số bước
   */
  private static calculatePosition(
    current: { x: number; y: number },
    direction: Direction,
    steps: number
  ): { x: number; y: number } {
    const delta = this.getDirectionDelta(direction);

    return {
      x: current.x + delta.x * steps,
      y: current.y + delta.y * steps,
    };
  }

  /**
   * Lấy delta x, y cho mỗi hướng (in pixels, not cells)
   * Server moves 3 pixels per tick at 17ms tickrate
   */
  private static getDirectionDelta(direction: Direction): {
    x: number;
    y: number;
  } {
    switch (direction) {
      case Direction.UP:
        return { x: 0, y: -this.MOVE_STEP_SIZE }; // -3 pixels
      case Direction.DOWN:
        return { x: 0, y: this.MOVE_STEP_SIZE }; // +3 pixels
      case Direction.LEFT:
        return { x: -this.MOVE_STEP_SIZE, y: 0 }; // -3 pixels
      case Direction.RIGHT:
        return { x: this.MOVE_STEP_SIZE, y: 0 }; // +3 pixels
      default:
        return { x: 0, y: 0 };
    }
  }

  /**
   * Tính khoảng cách Manhattan giữa 2 vị trí
   */
  public static manhattanDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Kiểm tra xem prediction có cần update không
   * (Nếu vị trí confirm mới khác xa prediction quá 2 ô)
   */
  public static needsCorrection(
    predicted: { x: number; y: number },
    confirmed: { x: number; y: number }
  ): boolean {
    return this.manhattanDistance(predicted, confirmed) > 2;
  }
}
