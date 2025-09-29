import { BombermanAI } from "./ai";
import { GameEngine } from "./game";
import { BotDecision, BotAction, Direction } from "./types";

/**
 * Main Bot class - điểm vào chính của ứng dụng
 */
export class BombermanBot {
  private ai: BombermanAI;
  private gameEngine: GameEngine;
  private isRunning: boolean = false;

  constructor() {
    this.ai = new BombermanAI();
    this.gameEngine = new GameEngine();
  }

  /**
   * Khởi tạo bot và bắt đầu game
   */
  public initialize(): void {
    console.log("🚀 Khởi tạo Bomberman Bot...");

    // TODO: Kết nối đến game server
    // this.connectToServer();

    this.isRunning = true;
    console.log("✅ Bot đã sẵn sàng!");
  }

  /**
   * Xử lý dữ liệu từ server và đưa ra quyết định
   */
  public processGameData(gameData: any): string {
    try {
      // Cập nhật trạng thái game
      this.gameEngine.updateGameState(gameData);

      // Kiểm tra game còn chạy không
      if (!this.gameEngine.isGameRunning()) {
        console.log("🏁 Game đã kết thúc");
        return this.formatAction(BotAction.STOP, Direction.STOP);
      }

      // Lấy trạng thái hiện tại
      const gameState = this.gameEngine.getGameState();

      // Log thông tin game
      const stats = this.gameEngine.getGameStats();
      console.log(
        `📊 Stats: Score=${stats.currentBotScore}, Bots=${stats.aliveBots}/${stats.totalBots}, Time=${stats.timeRemainingMinutes}min`
      );

      // AI đưa ra quyết định
      const decision = this.ai.makeDecision(gameState);

      // Format và trả về action
      return this.formatAction(decision.action, decision.direction);
    } catch (error) {
      console.error("❌ Lỗi khi xử lý game data:", error);
      return this.formatAction(BotAction.STOP, Direction.STOP);
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
   * Dừng bot
   */
  public stop(): void {
    this.isRunning = false;
    console.log("🛑 Bot đã dừng");
  }

  /**
   * Kiểm tra bot có đang chạy không
   */
  public isActive(): boolean {
    return this.isRunning;
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
