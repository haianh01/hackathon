import { GameState, GameMap, Bot, Bomb, Item, Wall } from "../types";

/**
 * Game Engine để xử lý logic và trạng thái game
 */
export class GameEngine {
  private gameState: GameState;

  constructor() {
    this.gameState = this.createEmptyGameState();
  }

  /**
   * Cập nhật trạng thái game từ dữ liệu server
   */
  public updateGameState(data: any): void {
    try {
      this.gameState = this.parseGameData(data);
    } catch (error) {
      console.error("Lỗi khi cập nhật game state:", error);
    }
  }

  /**
   * Lấy trạng thái game hiện tại
   */
  public getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Kiểm tra xem game có đang chạy không
   */
  public isGameRunning(): boolean {
    return (
      this.gameState.timeRemaining > 0 &&
      this.gameState.currentBot.isAlive &&
      this.gameState.enemies.some((enemy) => enemy.isAlive)
    );
  }

  /**
   * Lấy thông tin bot hiện tại
   */
  public getCurrentBot(): Bot {
    return { ...this.gameState.currentBot };
  }

  /**
   * Lấy danh sách kẻ thù
   */
  public getEnemies(): Bot[] {
    return this.gameState.enemies.map((enemy) => ({ ...enemy }));
  }

  /**
   * Lấy bản đồ hiện tại
   */
  public getMap(): GameMap {
    return { ...this.gameState.map };
  }

  /**
   * Parse dữ liệu từ server thành GameState
   */
  private parseGameData(data: any): GameState {
    // TODO: Implement parsing logic dựa trên format dữ liệu từ server
    // Đây là template, cần điều chỉnh theo format thực tế

    const map: GameMap = {
      width: data.map?.width || 640,
      height: data.map?.height || 640,
      walls: this.parseWalls(data.map?.walls || []),
      items: this.parseItems(data.map?.items || []),
      bombs: this.parseBombs(data.map?.bombs || []),
      bots: this.parseBots(data.bots || []),
    };

    const currentBot = this.findCurrentBot(map.bots, data.currentBotId);
    const enemies = map.bots.filter((bot) => bot.id !== currentBot.id);

    return {
      map,
      currentBot,
      enemies,
      timeRemaining: data.timeRemaining || 300000, // 5 phút mặc định
      round: data.round || 1,
    };
  }

  private parseWalls(wallsData: any[]): Wall[] {
    return wallsData.map((wall) => ({
      position: { x: wall.x, y: wall.y },
      isDestructible: wall.destructible || false,
    }));
  }

  private parseItems(itemsData: any[]): Item[] {
    return itemsData.map((item) => ({
      id: item.id,
      position: { x: item.x, y: item.y },
      type: item.type,
    }));
  }

  private parseBombs(bombsData: any[]): Bomb[] {
    return bombsData.map((bomb) => ({
      id: bomb.id,
      position: { x: bomb.x, y: bomb.y },
      ownerId: bomb.ownerId,
      timeRemaining: bomb.timeRemaining || 5000,
      flameRange: bomb.flameRange || 2,
    }));
  }

  private parseBots(botsData: any[]): Bot[] {
    return botsData.map((bot) => ({
      id: bot.id,
      position: { x: bot.x, y: bot.y },
      speed: bot.speed || 1,
      bombCount: bot.bombCount || 1,
      flameRange: bot.flameRange || 2,
      isAlive: bot.isAlive !== false,
      score: bot.score || 0,
    }));
  }

  private findCurrentBot(bots: Bot[], currentBotId: string): Bot {
    const bot = bots.find((b) => b.id === currentBotId);
    if (!bot) {
      throw new Error(`Không tìm thấy bot hiện tại với ID: ${currentBotId}`);
    }
    return bot;
  }

  private createEmptyGameState(): GameState {
    return {
      map: {
        width: 640,
        height: 640,
        walls: [],
        items: [],
        bombs: [],
        bots: [],
      },
      currentBot: {
        id: "",
        position: { x: 0, y: 0 },
        speed: 1,
        bombCount: 1,
        flameRange: 2,
        isAlive: true,
        score: 0,
      },
      enemies: [],
      timeRemaining: 300000,
      round: 1,
    };
  }

  /**
   * Tính toán các thống kê game
   */
  public getGameStats(): {
    totalBots: number;
    aliveBots: number;
    totalBombs: number;
    totalItems: number;
    currentBotScore: number;
    timeRemainingMinutes: number;
  } {
    const allBots = [this.gameState.currentBot, ...this.gameState.enemies];

    return {
      totalBots: allBots.length,
      aliveBots: allBots.filter((bot) => bot.isAlive).length,
      totalBombs: this.gameState.map.bombs.length,
      totalItems: this.gameState.map.items.length,
      currentBotScore: this.gameState.currentBot.score,
      timeRemainingMinutes: Math.round(this.gameState.timeRemaining / 60000),
    };
  }
}
