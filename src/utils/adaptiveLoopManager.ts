/**
 * Adaptive Loop Manager - Quản lý vòng lặp bot với tần suất linh hoạt
 * Cho phép bot phản ứng nhanh hơn khi cần thiết (ví dụ: gần bom)
 * Cải tiến: Tần suất được tính toán động dựa trên tốc độ của bot.
 */

import { CELL_SIZE, MOVE_INTERVAL_MS, MOVE_STEP_SIZE } from "./constants";

export enum LoopPriority {
  EMERGENCY,
  HIGH,
  NORMAL,
  LOW,
}

export interface LoopCallback {
  (): void;
}

export class AdaptiveLoopManager {
  private mainInterval: NodeJS.Timeout | null = null;
  private currentPriority: LoopPriority = LoopPriority.NORMAL;
  private callback: LoopCallback | null = null;
  private isRunning: boolean = false;
  private emergencyTimeout: NodeJS.Timeout | null = null;

  // Các mức tần suất (ms), sẽ được cập nhật động
  private intervals: Record<LoopPriority, number> = {
    [LoopPriority.EMERGENCY]: 100, // Cố định, luôn phải nhanh nhất
    [LoopPriority.HIGH]: 340,
    [LoopPriority.NORMAL]: 680,
    [LoopPriority.LOW]: 1200,
  };

  /**
   * Bắt đầu vòng lặp với tần suất mặc định
   * @param callback Hàm callback được gọi mỗi lần lặp
   * @param initialInterval Khoảng thời gian ban đầu (ms)
   */
  public start(
    callback: LoopCallback,
    initialInterval: number = LoopPriority.NORMAL
  ): void {
    this.callback = callback;
    this.currentPriority = initialInterval as LoopPriority;
    this.isRunning = true;

    // Khởi tạo interval
    this.restartInterval();
  }

  /**
   * Dừng vòng lặp
   */
  public stop(): void {
    this.isRunning = false;

    if (this.mainInterval) {
      clearInterval(this.mainInterval);
      this.mainInterval = null;
    }

    if (this.emergencyTimeout) {
      clearTimeout(this.emergencyTimeout);
      this.emergencyTimeout = null;
    }

    console.log("⏹️ Adaptive loop stopped");
  }

  /**
   * Thay đổi tần suất vòng lặp dựa trên priority
   * @param priority Mức độ ưu tiên (càng cao càng nhanh)
   */
  public setPriority(priority: LoopPriority): void {
    if (this.currentPriority === priority) {
      return; // Không cần thay đổi
    }

    console.log(
      `🔄 Loop priority changed: ${this.currentPriority}ms → ${priority}ms`
    );

    this.currentPriority = priority;
    this.restartInterval();
  }

  /**
   * Trigger vòng lặp khẩn cấp ngay lập tức
   * Sử dụng khi cần phản ứng nhanh (ví dụ: bom mới xuất hiện gần bot)
   */
  public triggerEmergency(): void {
    if (!this.isRunning || !this.callback) {
      return;
    }

    // Clear emergency timeout cũ nếu có
    if (this.emergencyTimeout) {
      clearTimeout(this.emergencyTimeout);
    }

    // Thực thi callback ngay lập tức
    console.log("🚨 Emergency loop triggered!");
    this.callback();

    // Chuyển sang priority EMERGENCY trong 2 giây
    const previousPriority = this.currentPriority;
    this.setPriority(LoopPriority.EMERGENCY);

    // Sau 2 giây, quay lại priority trước đó
    this.emergencyTimeout = setTimeout(() => {
      this.setPriority(previousPriority);
    }, 2000);
  }

  /**
   * Trigger vòng lặp tiếp theo ngay lập tức (one-time)
   * Sử dụng khi cần update ngay mà không thay đổi priority
   */
  public triggerNext(): void {
    if (!this.isRunning || !this.callback) {
      return;
    }

    console.log("⚡ Immediate loop triggered");
    this.callback();
  }

  /**
   * Lấy priority hiện tại
   */
  public getCurrentPriority(): LoopPriority {
    return this.currentPriority;
  }

  /**
   * Kiểm tra xem loop có đang chạy không
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Restart interval với priority mới
   */
  private restartInterval(): void {
    // Clear interval cũ
    if (this.mainInterval) {
      clearInterval(this.mainInterval);
    }

    if (!this.isRunning || !this.callback) {
      return;
    }

    // Tạo interval mới với priority hiện tại
    this.mainInterval = setInterval(() => {
      if (this.callback) {
        this.callback();
      }
    }, this.currentPriority);
  }

  /**
   * Auto-adjust priority dựa trên game state
   * @param hasBombsNearby Có bom gần không
   * @param hasEnemiesNearby Có enemy gần không
   * @param hasItemsNearby Có item gần không
   */
  public autoAdjustPriority(
    hasBombsNearby: boolean,
    hasEnemiesNearby: boolean,
    hasItemsNearby: boolean
  ): void {
    if (hasBombsNearby) {
      // Nguy hiểm khẩn cấp - phản ứng cực nhanh
      this.setPriority(LoopPriority.EMERGENCY);
    } else if (hasEnemiesNearby) {
      // Có enemy gần - ưu tiên cao
      this.setPriority(LoopPriority.HIGH);
    } else if (hasItemsNearby) {
      // Có item gần - bình thường
      this.setPriority(LoopPriority.NORMAL);
    } else {
      // Không có gì - thấp
      this.setPriority(LoopPriority.LOW);
    }
  }
}
