import { BombermanAI as BomberManAI } from "./ai";
import { GameEngine } from "./game";
import { BotDecision, BotAction, Direction, UserResponse } from "./types";
import { SocketConnection } from "./connection/socketConnection";

/**
 * Main Bot class - điểm vào chính của ứng dụng
 */
export class BomberManBot {
  private ai: BomberManAI;
  private gameEngine: GameEngine;
  private socketConnection: SocketConnection;
  private isRunning: boolean = false;
  private botLogicInterval: NodeJS.Timeout | undefined;

  constructor(serverAddress?: string, botToken?: string) {
    this.ai = new BomberManAI();
    this.gameEngine = new GameEngine();

    // Sử dụng giá trị từ param hoặc env
    const address = serverAddress || "https://zarena-dev4.zinza.com.vn";
    const token = botToken || process.env.BOT_TOKEN || "";

    this.socketConnection = new SocketConnection(address, token);
  }

  /**
   * Khởi tạo bot và bắt đầu game
   */
  public async initialize(): Promise<void> {
    console.log("🚀 Khởi tạo Bomberman Bot...");

    try {
      // Kết nối đến game server
      await this.connectToServer();

      // Setup bot logic loop
      this.setupBotLogic();

      this.isRunning = true;
      console.log("✅ Bot đã sẵn sàng!");
    } catch (error) {
      console.error("❌ Lỗi khi khởi tạo bot:", error);
      throw error;
    }
  }

  /**
   * Kết nối đến game server qua Socket.IO
   */
  private async connectToServer(): Promise<void> {
    console.log("🔌 Đang kết nối đến server...");

    // Setup callbacks
    this.socketConnection.onGameData((data: UserResponse) => {
      this.processGameData(data);
    });

    this.socketConnection.onGameStart(() => {
      console.log("🎮 Game bắt đầu!");
      this.isRunning = true;
    });

    this.socketConnection.onGameEnd(() => {
      console.log("🏁 Game kết thúc!");
      if (!this.socketConnection.isDevelopment()) {
        this.isRunning = false;
      }
    });

    // Setup position update callback
    this.socketConnection.onPositionUpdate((x: number, y: number) => {
      console.log(`📍 Position updated: (${x}, ${y})`);
      // Có thể cập nhật game engine nếu cần
    });

    // Setup realtime event callbacks
    this.setupRealtimeEventCallbacks();

    // Kết nối
    await this.socketConnection.connect();
    console.log("🔌 đã kết nối đến server...");
  }

  /**
   * Setup callbacks cho các sự kiện realtime
   */
  private setupRealtimeEventCallbacks(): void {
    // Callback khi có bom mới
    this.socketConnection.onNewBomb((data: any) => {
      console.log(`⚡ Realtime: Bom mới tại (${data.x}, ${data.y})`);
      // TODO: Cập nhật ngay lập tức vào game state để tránh bom
      // this.gameEngine.addBombRealtime(data);
    });

    // Callback khi bom nổ
    this.socketConnection.onBombExplode((data: any) => {
      console.log(`⚡ Realtime: Bom nổ tại (${data.x}, ${data.y})`);
      // TODO: Xóa bom khỏi danh sách nguy hiểm
      // this.gameEngine.removeBombRealtime(data.id);
    });

    // Callback khi có item mới
    this.socketConnection.onChestDestroyed((data: any) => {
      console.log(`⚡ Realtime: Rương bị phá tại (${data.x}, ${data.y})`);
      // TODO: Item có thể xuất hiện, cần check lại
    });

    // Callback khi item được thu thập
    this.socketConnection.onItemCollected((data: any) => {
      console.log(`⚡ Realtime: Item được nhặt tại (${data.x}, ${data.y})`);
      // TODO: Xóa item khỏi target list nếu có
    });

    // Callback khi có người chết
    this.socketConnection.onUserDie((data: any) => {
      const myBomber = this.socketConnection.getMyBomberInfo();

      // Kiểm tra nếu bot bị giết
      if (data.killed.uid === myBomber?.uid) {
        console.log("💀 Bot đã bị tiêu diệt!");
        this.isRunning = false;
      }

      // Kiểm tra nếu bot giết được địch
      if (data.killer.uid === myBomber?.uid) {
        console.log(
          `🎉 Bot đã hạ gục ${data.killed.name}! +${data.score} điểm`
        );
      }
    });
  }

  /**
   * Setup bot logic loop (chạy mỗi 500ms)
   */
  private setupBotLogic(): void {
    this.botLogicInterval = setInterval(() => {
      this.executeBotLogic();
    }, 500);
  }

  /**
   * Thực hiện logic bot
   */
  private executeBotLogic(): void {
    console.log(
      `🔍 Executing bot logic - Game running: ${this.socketConnection.isGameRunning()}, Bot running: ${
        this.isRunning
      }`
    );

    if (!this.socketConnection.isGameRunning() || !this.isRunning) {
      return;
    }

    try {
      const gameState = this.gameEngine.getGameState();
      console.log(`🔍 Game state cho AI:`, {
        currentBot: {
          id: gameState.currentBot.id,
          name: gameState.currentBot.name,
          position: gameState.currentBot.position,
        },
        enemies: gameState.enemies.length,
        bombs: gameState.map.bombs.length,
        items: gameState.map.items.length,
      });

      const decision = this.ai.makeDecision(gameState);
      console.log(`🤖 AI Decision:`, decision);

      this.executeAction(decision);
    } catch (error) {
      console.error("❌ Lỗi trong bot logic:", error);
    }
  }

  /**
   * Thực hiện action dựa trên quyết định của AI
   */
  private executeAction(decision: BotDecision): void {
    switch (decision.action) {
      case BotAction.MOVE:
        if (decision.direction) {
          // ✅ Dùng continuous move để di chuyển mượt mà
          this.socketConnection.startContinuousMove(decision.direction);
        }
        break;
      case BotAction.BOMB:
        // Dừng di chuyển trước khi đặt bom
        this.socketConnection.stopContinuousMove();
        this.socketConnection.placeBomb();
        break;
      case BotAction.STOP:
        // Dừng di chuyển khi cần dừng
        this.socketConnection.stopContinuousMove();
        break;
      default:
        this.socketConnection.stopContinuousMove();
        break;
    }
  }

  /**
   * Xử lý dữ liệu từ server và cập nhật game state
   */
  private processGameData(gameData: UserResponse): void {
    try {
      // Lấy Socket ID từ connection
      const myBotInfo = this.socketConnection.getMyBomberInfo();
      const socketId = myBotInfo?.uid;

      console.log(`🔍 Socket ID của bot: ${socketId}`);
      // console.log(
      //   `🔍 Dữ liệu bombers:`,
      //   gameData.bombers?.map((b) => ({ name: b.name, uid: b.uid }))
      // );

      if (!socketId) {
        console.warn("⚠️ Chưa có thông tin bot, bỏ qua update");
        return;
      }

      // Cập nhật trạng thái game với Socket ID
      this.gameEngine.updateGameState(gameData, socketId);

      // Debug: Kiểm tra game state sau khi update
      const currentBot = this.gameEngine.getCurrentBot();
      console.log(`🤖 Current bot sau update:`, {
        id: currentBot.id,
        name: currentBot.name,
        position: currentBot.position,
        isAlive: currentBot.isAlive,
      });

      // Kiểm tra game còn chạy không
      if (!this.gameEngine.isGameRunning()) {
        console.log("🏁 Game đã kết thúc hoặc bot không sống");
        console.log(`🔍 Game running check:`, {
          timeRemaining: this.gameEngine.getGameState().timeRemaining,
          botAlive: currentBot.isAlive,
          enemiesAlive: this.gameEngine.getEnemies().filter((e) => e.isAlive)
            .length,
        });
        return;
      }

      // Log thông tin game (nếu cần)
      const stats = this.gameEngine.getGameStats();
      console.log(
        `📊 Stats: Score=${stats.currentBotScore}, Enemies=${
          stats.aliveBots - 1
        }`
      );
    } catch (error) {
      console.error("❌ Lỗi khi xử lý game data:", error);
    }
  }

  /**
   * Format action thành string để gửi về server
   */
  private formatAction(action: BotAction, direction?: Direction): string {
    // TODO: Format theo protocol của game server
    // Đây là example format

    switch (action) {
      case BotAction.MOVE:
        return `MOVE:${direction || Direction.STOP}`;
      case BotAction.BOMB:
        return "BOMB";
      case BotAction.STOP:
      default:
        return "STOP";
    }
  }

  /**
   * Dừng bot và ngắt kết nối
   */
  public shutdown(): void {
    console.log("🛑 Đang tắt bot...");

    this.isRunning = false;

    // Clear interval
    if (this.botLogicInterval) {
      clearInterval(this.botLogicInterval);
      this.botLogicInterval = undefined;
    }

    // Ngắt kết nối socket
    this.socketConnection.disconnect();

    console.log("✅ Bot đã tắt hoàn toàn");
  }

  /**
   * Dừng bot tạm thời (giữ kết nối)
   */
  public stop(): void {
    this.isRunning = false;
    console.log("⏸️ Bot đã tạm dừng");
  }

  /**
   * Kiểm tra bot có đang chạy không
   */
  public isActive(): boolean {
    return this.isRunning && this.socketConnection.isConnected();
  }

  /**
   * Kiểm tra kết nối
   */
  public isConnected(): boolean {
    return this.socketConnection.isConnected();
  }

  /**
   * Kiểm tra game có đang chạy không
   */
  public isGameRunning(): boolean {
    return this.socketConnection.isGameRunning();
  }

  /**
   * Lấy thông tin bot hiện tại
   */
  public getBotInfo() {
    return this.socketConnection.getMyBomberInfo();
  }

  /**
   * Lấy thông tin AI strategies
   */
  public getAIInfo(): Array<{ name: string; priority: number }> {
    return this.ai.getStrategiesInfo();
  }

  /**
   * Cập nhật priority của strategy
   */
  public updateStrategyPriority(
    strategyName: string,
    priority: number
  ): boolean {
    return this.ai.updateStrategyPriority(strategyName, priority);
  }

  /**
   * Reset AI về mặc định
   */
  public resetAI(): void {
    this.ai.resetStrategies();
    console.log("🔄 AI đã reset về mặc định");
  }

  /**
   * Lấy thống kê game hiện tại
   */
  public getGameStats() {
    return this.gameEngine.getGameStats();
  }

  /**
   * Lấy trạng thái game hiện tại (để debug)
   */
  public getGameState() {
    return this.gameEngine.getGameState();
  }
}
