import * as readline from "readline";
import { SocketConnection } from "../connection/socketConnection";
import { Direction } from "../types";

/**
 * Lớp điều khiển bot thủ công bằng bàn phím để debug.
 * - Sử dụng các phím mũi tên để di chuyển.
 * - Sử dụng phím 'B' để đặt bom.
 * - Sử dụng phím 'Space' để dừng lại.
 * - Sử dụng 'Ctrl + C' để thoát.
 */
export class ManualControl {
  private socketConnection: SocketConnection;
  private isEnabled: boolean = false;

  constructor(socketConnection: SocketConnection) {
    this.socketConnection = socketConnection;
  }

  /**
   * Kích hoạt chế độ điều khiển thủ công.
   * Vô hiệu hóa logic AI và lắng nghe sự kiện từ bàn phím.
   */
  public enable() {
    if (this.isEnabled) {
      console.log("🕹️  Chế độ điều khiển thủ công đã được bật.");
      return;
    }

    this.isEnabled = true;
    console.log(
      "🕹️  Kích hoạt chế độ điều khiển thủ công. Sử dụng các phím mũi tên để di chuyển."
    );
    console.log("    - Phím 'B': Đặt bom");
    console.log("    - Phím 'Space': Dừng di chuyển");
    console.log("    - 'Ctrl + C': Thoát");

    // Thiết lập để đọc input từ bàn phím
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on("keypress", this.handleKeyPress);
  }

  /**
   * Vô hiệu hóa chế độ điều khiển thủ công.
   */
  public disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    process.stdin.removeListener("keypress", this.handleKeyPress);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    console.log("🕹️  Đã tắt chế độ điều khiển thủ công.");
  }

  // Dùng arrow function để `this` trỏ đúng vào instance của class
  private handleKeyPress = (str: string, key: any) => {
    // Thoát chương trình bằng Ctrl+C
    if (key.ctrl && key.name === "c") {
      console.log("🔌  Đang tắt bot...");
      this.socketConnection.disconnect();
      process.exit();
    }

    // Xử lý các phím điều khiển
    switch (key.name) {
      case "up":
        this.socketConnection.startContinuousMove(Direction.UP);
        break;
      case "down":
        this.socketConnection.startContinuousMove(Direction.DOWN);
        break;
      case "left":
        this.socketConnection.startContinuousMove(Direction.LEFT);
        break;
      case "right":
        this.socketConnection.startContinuousMove(Direction.RIGHT);
        break;
      case "b": // Đặt bom
        this.socketConnection.placeBomb();
        break;
      case "space": // Dừng lại
        this.socketConnection.stopContinuousMove();
        break;
    }
  };
}
