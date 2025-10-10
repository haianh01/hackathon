import io from "socket.io-client";
import { Direction, UserResponse, Bomber } from "../types";

// Define the Socket type from socket.io-client
type SocketType = ReturnType<typeof io>;

/**
 * Socket.IO connection manager for Bomberman bot
 * Dựa trên protocol của hackathon
 */
export class SocketConnection {
  private socket: SocketType | null = null;
  private serverAddress: string;
  private token: string;
  private isGameStarted: boolean = true; // Mặc định true cho dev environment
  private myBomberInfo: Bomber | null = null;
  private onGameDataCallback?: (data: UserResponse) => void;
  private onGameStartCallback?: () => void;
  private onGameEndCallback?: () => void;
  private onPositionUpdateCallback?: (x: number, y: number) => void;
  private onNewBombCallback?: (data: any) => void;
  private onBombExplodeCallback?: (data: any) => void;
  private onMapUpdateCallback?: (data: any) => void;
  private onUserDieCallback?: (data: any) => void;
  private onChestDestroyedCallback?: (data: any) => void;
  private onItemCollectedCallback?: (data: any) => void;
  private onUserDisconnectCallback?: (data: any) => void;
  private isDevelopmentMode: boolean = true;
  private lastMoveTime: number = 0;
  private moveThrottleMs: number = 50; // Giảm xuống 50ms để di chuyển mượt hơn
  private predictedPosition: { x: number; y: number } | null = null; // Vị trí dự đoán
  private lastConfirmedPosition: { x: number; y: number } | null = null; // Vị trí được server confirm
  private currentDirection: Direction | null = null; // Hướng đang di chuyển
  private moveInterval: NodeJS.Timeout | null = null; // Interval để di chuyển liên tục

  constructor(serverAddress: string, token: string) {
    this.serverAddress = serverAddress;
    this.token = token;

    // Kiểm tra môi trường development
    this.isDevelopmentMode =
      serverAddress.includes("zarena-dev") ||
      serverAddress.includes("localhost") ||
      serverAddress.includes("127.0.0.1");

    if (this.isDevelopmentMode) {
      this.isGameStarted = true;
      console.log("🔧 Development mode: Game sẽ tự động chạy");
    } else {
      this.isGameStarted = false;
      console.log("🏆 Competition mode: Đợi sự kiện 'start'");
    }
  }

  /**
   * Khởi tạo kết nối đến server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Đang cố gắng kết nối tới ${this.serverAddress}...`);

      const auth = {
        token: this.token,
      };

      this.socket = io(this.serverAddress, {
        auth: auth,
        transports: ["websocket"],
      });

      this.socket.on("connect", () => {
        console.log(
          `✅ Đã kết nối thành công với Server! Socket ID: ${this.socket?.id}`
        );
        this.joinGameRoom();
        resolve();
      });
      // Setup event listeners NGAY SAU KHI tạo socket
      this.setupEventListeners();

      this.socket.on("connect_error", (err: Error) => {
        console.error(`❌ Lỗi kết nối: ${err.message}`);
        reject(new Error(`Connection failed: ${err.message}`));
      });

      this.socket.on("disconnect", (reason: string) => {
        console.log(`❌ Mất kết nối. Lý do: ${reason}`);
        this.isGameStarted = this.isDevelopmentMode;
      });
    });
  }

  /**
   * Thiết lập các event listener cho Socket.IO
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Sự kiện: Nhận thông tin ban đầu sau khi tham gia phòng thành công
    this.socket.on("user", (data: UserResponse) => {
      // console.log(
      //   "⬅️ Nhận sự kiện 'user': Nhận thông tin bản đồ và trạng thái game.",
      //   data
      // );

      if (data.bombers && data.bombers.length > 0) {
        this.myBomberInfo =
          data.bombers.find((b) => b.uid === this.socket?.id) || null;
        if (this.myBomberInfo) {
          console.log(
            `🤖 Bot của tôi (${this.myBomberInfo.name}) đã sẵn sàng.`
          );
          console.log("🔍 ===== CHI TIẾT BOT =====");
          console.log(`📛 Tên: ${this.myBomberInfo.name}`);
          console.log(`🆔 UID: ${this.myBomberInfo.uid}`);
          console.log(
            `📍 Vị trí: (${this.myBomberInfo.x}, ${this.myBomberInfo.y})`
          );
          console.log(`💯 Điểm: ${this.myBomberInfo.score}`);
          console.log(`💚 Sống: ${this.myBomberInfo.isAlive ? "Có" : "Không"}`);
          console.log(`⚡ Tốc độ: ${this.myBomberInfo.speed}`);
          console.log(`💣 Số bom: ${this.myBomberInfo.bombCount}`);
          console.log(`🔥 Phạm vi nổ: ${this.myBomberInfo.explosionRange}`);
          console.log("========================");

          // Update confirmed position
          this.lastConfirmedPosition = {
            x: this.myBomberInfo.x,
            y: this.myBomberInfo.y,
          };
        }
      }

      if (this.onGameDataCallback) {
        this.onGameDataCallback(data);
      }
    });

    // Sự kiện: BẮT ĐẦU GAME (Chỉ có ở môi trường thi đấu)
    this.socket.on("start", (data: any) => {
      console.log(`🚨 GAME BẮT ĐẦU! Thời gian: ${data.start_at}`);
      console.log("📝 Lưu ý: Sự kiện 'start' chỉ có trong môi trường thi đấu");
      this.isGameStarted = true;
      this.isDevelopmentMode = false;

      if (this.onGameStartCallback) {
        this.onGameStartCallback();
      }
    });

    // Sự kiện: Kết thúc Game
    this.socket.on("finish", (data: any) => {
      console.log("🏁 GAME KẾT THÚC!");

      if (this.isDevelopmentMode) {
        console.log("🔄 Dev mode: Game sẽ tự động reset sau 5 phút");
        setTimeout(() => {
          console.log("🔄 Game đã reset, tiếp tục chơi...");
          this.isGameStarted = true;
        }, 1000);
      } else {
        this.isGameStarted = false;
      }

      if (this.onGameEndCallback) {
        this.onGameEndCallback();
      }
    });

    // Các sự kiện game khác
    this.socket.on("player_move", (data: any) => {
      // console.log(`⬅️ ${data.name} di chuyển tới (${data.x}, ${data.y})`);

      // Option 1: Track real-time position updates
      if (data.uid === this.socket?.id) {
        console.log(`🎯 Bot di chuyển: (${data.x}, ${data.y})`);
        this.lastConfirmedPosition = { x: data.x, y: data.y };

        // Update myBomberInfo if available
        if (this.myBomberInfo) {
          this.myBomberInfo.x = data.x;
          this.myBomberInfo.y = data.y;
        }

        // Notify callback if registered
        if (this.onPositionUpdateCallback) {
          this.onPositionUpdateCallback(data.x, data.y);
        }
      }
    });

    this.socket.on("new_bomb", (data: any) => {
      console.log(`⬅️ Bom mới được đặt tại (${data.x}, ${data.y})`);

      // Callback để cập nhật game state ngay lập tức
      if (this.onNewBombCallback) {
        this.onNewBombCallback(data);
      }
    });

    this.socket.on("bomb_explode", (data: any) => {
      console.log(`💥 Bom nổ tại (${data.x}, ${data.y})`);

      // Callback để xóa bom khỏi danh sách và cập nhật vùng nguy hiểm
      if (this.onBombExplodeCallback) {
        this.onBombExplodeCallback(data);
      }
    });

    this.socket.on("map_update", (data: any) => {
      console.log("⬅️ Cập nhật bản đồ: Rương và Item mới.");

      // Callback để cập nhật bản đồ (chest/item mới xuất hiện)
      if (this.onMapUpdateCallback) {
        this.onMapUpdateCallback(data);
      }
    });

    this.socket.on("user_die_update", (data: any) => {
      console.log(
        `💀 Bot ${data.killed.name} đã bị hạ gục bởi ${data.killer.name}!`
      );

      // Callback để cập nhật trạng thái người chơi (ai chết, ai giết)
      if (this.onUserDieCallback) {
        this.onUserDieCallback(data);
      }
    });

    this.socket.on("chest_destroyed", (data: any) => {
      console.log(`📦 Rương bị phá hủy tại (${data.x}, ${data.y})`);

      // Callback để xóa chest khỏi map, có thể spawn item
      if (this.onChestDestroyedCallback) {
        this.onChestDestroyedCallback(data);
      }
    });

    this.socket.on("item_collected", (data: any) => {
      console.log(`🎁 Item được thu thập tại (${data.x}, ${data.y})`);

      // Callback để xóa item khỏi map
      if (this.onItemCollectedCallback) {
        this.onItemCollectedCallback(data);
      }
    });

    this.socket.on("user_disconnect", (data: any) => {
      console.log(`👋 User ${data.name} đã ngắt kết nối`);

      // Callback để xóa user khỏi danh sách
      if (this.onUserDisconnectCallback) {
        this.onUserDisconnectCallback(data);
      }
    });
  }

  /**
   * Tham gia phòng chơi
   * Event name: join
   * Data: {} (empty object)
   */
  private joinGameRoom(): void {
    console.log("➡️ Gửi sự kiện 'join' để tham gia phòng chơi...");
    this.socket?.emit("join", {});
  }

  /**
   * Gửi lại event join (public method để gọi từ bên ngoài nếu cần)
   */
  public rejoin(): void {
    if (this.socket && this.socket.connected) {
      console.log("➡️ Gửi lại sự kiện 'join'...");
      this.socket.emit("join", {});
    } else {
      console.log("⚠️ Không thể join: Chưa kết nối với server");
    }
  }

  /**
   * Di chuyển bot theo hướng (single move - gửi lệnh 1 lần)
   */
  public move(direction: Direction): void {
    if (!this.isGameStarted || !this.socket) {
      return;
    }

    // Throttle nhẹ để tránh spam request
    const now = Date.now();
    if (now - this.lastMoveTime < this.moveThrottleMs) {
      return;
    }

    // Predict next position trước khi gửi lệnh
    const currentPos = this.getCurrentPosition();
    if (currentPos) {
      const predictedPos = this.predictNextPosition(currentPos, direction);
      this.predictedPosition = predictedPos;
    }

    this.lastMoveTime = now;
    console.log(`➡️ Move: ${direction}`);
    this.socket.emit("move", { orient: direction });
  }

  /**
   * Di chuyển liên tục theo hướng cho đến khi dừng lại
   * Gửi lệnh move mỗi 100ms để đảm bảo bot di chuyển mượt
   */
  public startContinuousMove(direction: Direction): void {
    if (!this.isGameStarted || !this.socket) {
      return;
    }

    // Nếu đã đang di chuyển cùng hướng, không cần restart
    if (this.currentDirection === direction && this.moveInterval) {
      return;
    }

    // Dừng di chuyển cũ (nếu có)
    this.stopContinuousMove();

    // Lưu hướng hiện tại
    this.currentDirection = direction;

    // Gửi lệnh move ngay lập tức
    this.socket.emit("move", { orient: direction });
    console.log(`🔄 Bắt đầu di chuyển liên tục: ${direction}`);

    // Tạo interval để gửi lệnh move liên tục
    this.moveInterval = setInterval(() => {
      if (this.socket && this.isGameStarted) {
        this.socket.emit("move", { orient: direction });

        // Update predicted position
        const currentPos = this.getCurrentPosition();
        if (currentPos) {
          this.predictedPosition = this.predictNextPosition(
            currentPos,
            direction
          );
        }
      } else {
        this.stopContinuousMove();
      }
    }, 50); // Gửi mỗi 50ms (20 lần/giây) để di chuyển nhanh và mượt
  }

  /**
   * Dừng di chuyển liên tục
   */
  public stopContinuousMove(): void {
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
      this.currentDirection = null;
      console.log(`⏹️ Dừng di chuyển liên tục`);
    }
  }

  /**
   * Dự đoán vị trí tiếp theo dựa trên direction
   * Mỗi lần di chuyển = 1 pixels
   */
  private predictNextPosition(
    currentPos: { x: number; y: number },
    direction: Direction
  ): { x: number; y: number } {
    const MOVE_STEP = 1; // Server di chuyển 1px mỗi lần

    switch (direction) {
      case Direction.UP:
        return { x: currentPos.x, y: currentPos.y - MOVE_STEP };
      case Direction.DOWN:
        return { x: currentPos.x, y: currentPos.y + MOVE_STEP };
      case Direction.LEFT:
        return { x: currentPos.x - MOVE_STEP, y: currentPos.y };
      case Direction.RIGHT:
        return { x: currentPos.x + MOVE_STEP, y: currentPos.y };
      case Direction.STOP:
      default:
        return { x: currentPos.x, y: currentPos.y };
    }
  }

  /**
   * Đặt bom
   */
  public placeBomb(): void {
    if (this.isGameStarted && this.socket) {
      console.log("➡️ Gửi sự kiện 'place_bomb'");
      this.socket.emit("place_bomb", {});
    }
  }

  /**
   * Ngắt kết nối
   */
  public disconnect(): void {
    // Dừng di chuyển liên tục trước khi disconnect
    this.stopContinuousMove();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isGameStarted = false;
      console.log("🔌 Đã ngắt kết nối");
    }
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Kiểm tra game có đang chạy không
   */
  public isGameRunning(): boolean {
    return this.isGameStarted;
  }

  /**
   * Kiểm tra có phải môi trường development không
   */
  public isDevelopment(): boolean {
    return this.isDevelopmentMode;
  }

  /**
   * Lấy thông tin bomber hiện tại
   */
  public getMyBomberInfo(): Bomber | null {
    return this.myBomberInfo;
  }

  /**
   * Đăng ký callback cho dữ liệu game
   */
  public onGameData(callback: (data: UserResponse) => void): void {
    this.onGameDataCallback = callback;
  }

  /**
   * Đăng ký callback cho sự kiện game bắt đầu
   */
  public onGameStart(callback: () => void): void {
    this.onGameStartCallback = callback;
  }

  /**
   * Đăng ký callback cho sự kiện game kết thúc
   */
  public onGameEnd(callback: () => void): void {
    this.onGameEndCallback = callback;
  }

  /**
   * Đăng ký callback cho position update
   */
  public onPositionUpdate(callback: (x: number, y: number) => void): void {
    this.onPositionUpdateCallback = callback;
  }

  /**
   * Đăng ký callback cho bom mới
   */
  public onNewBomb(callback: (data: any) => void): void {
    this.onNewBombCallback = callback;
  }

  /**
   * Đăng ký callback cho bom nổ
   */
  public onBombExplode(callback: (data: any) => void): void {
    this.onBombExplodeCallback = callback;
  }

  /**
   * Đăng ký callback cho cập nhật map
   */
  public onMapUpdate(callback: (data: any) => void): void {
    this.onMapUpdateCallback = callback;
  }

  /**
   * Đăng ký callback cho người chơi chết
   */
  public onUserDie(callback: (data: any) => void): void {
    this.onUserDieCallback = callback;
  }

  /**
   * Đăng ký callback cho rương bị phá
   */
  public onChestDestroyed(callback: (data: any) => void): void {
    this.onChestDestroyedCallback = callback;
  }

  /**
   * Đăng ký callback cho item được thu thập
   */
  public onItemCollected(callback: (data: any) => void): void {
    this.onItemCollectedCallback = callback;
  }

  /**
   * Đăng ký callback cho người chơi ngắt kết nối
   */
  public onUserDisconnect(callback: (data: any) => void): void {
    this.onUserDisconnectCallback = callback;
  }

  /**
   * Lấy vị trí hiện tại (predicted hoặc confirmed)
   */
  public getCurrentPosition(): { x: number; y: number } | null {
    // Ưu tiên vị trí được confirm từ server
    if (this.lastConfirmedPosition) {
      return { ...this.lastConfirmedPosition };
    }

    // Fallback sang predicted position
    if (this.predictedPosition) {
      return { ...this.predictedPosition };
    }

    // Fallback sang myBomberInfo
    if (this.myBomberInfo) {
      return { x: this.myBomberInfo.x, y: this.myBomberInfo.y };
    }

    return null;
  }
}
