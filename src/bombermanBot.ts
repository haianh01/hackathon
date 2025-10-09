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

    // Kết nối
    await this.socketConnection.connect();
    console.log("🔌 đã kết nối đến server...");
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
          this.socketConnection.move(decision.direction);
        }
        break;
      case BotAction.BOMB:
        this.socketConnection.placeBomb();
        break;
      case BotAction.STOP:
      default:
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
      console.log(
        `🔍 Dữ liệu bombers:`,
        gameData.bombers?.map((b) => ({ name: b.name, uid: b.uid }))
      );

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
