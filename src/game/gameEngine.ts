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
  public updateGameState(data: any, currentBotId?: string): void {
    try {
      this.gameState = this.parseGameData(data, currentBotId);
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
    const currentBotAlive = this.gameState.currentBot.isAlive;
    const hasTimeRemaining = this.gameState.timeRemaining > 0;
    const hasEnemies = this.gameState.enemies.length > 0;
    const hasAliveEnemies = this.gameState.enemies.some(
      (enemy) => enemy.isAlive
    );

    console.log(`🔍 Game running check:`, {
      currentBotAlive,
      hasTimeRemaining,
      hasEnemies,
      hasAliveEnemies,
      timeRemaining: this.gameState.timeRemaining,
    });

    // Game chạy nếu:
    // 1. Bot hiện tại còn sống
    // 2. Còn thời gian
    // 3. Có kẻ thù (trong trường hợp multiplayer) HOẶC đây là single player mode
    return (
      currentBotAlive && hasTimeRemaining && (hasAliveEnemies || !hasEnemies)
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
  private parseGameData(data: any, currentBotId?: string): GameState {
    console.log(
      "%c🤪 ~ file: gameEngine.ts:66 [] -> data : ",
      "color: #ac4d66",
      data
    );

    console.log(`🔍 Parsing game data với currentBotId: ${currentBotId}`);

    // Parse map từ server (2D array format)
    const walls = this.parseWallsFromMap(data.map || []);
    const bots = this.parseBots(data.bombers || [], currentBotId);

    console.log(
      `🔍 Parsed bots:`,
      bots.map((b) => ({ id: b.id, name: b.name, position: b.position }))
    );

    const bombs = this.parseBombs(data.bombs || []);
    const items = this.parseItems(data.items || []);
    const chests = this.parseChests(data.chests || []);

    const map: GameMap = {
      width: 640, // 16 cells * 40 pixels
      height: 640,
      walls: [...walls, ...chests], // Walls + Chests
      items: items,
      bombs: bombs,
      bots: bots,
    };

    const currentBot = this.findCurrentBot(bots, currentBotId);
    const enemies = bots.filter(
      (bot) => bot.id !== currentBot.id && bot.isAlive
    );

    console.log(`🔍 Current bot found:`, {
      id: currentBot.id,
      name: currentBot.name,
    });
    console.log(
      `🔍 Enemies found:`,
      enemies.map((e) => ({ id: e.id, name: e.name }))
    );

    return {
      map,
      currentBot,
      enemies,
      timeRemaining: data.timeRemaining || 300000, // 5 phút mặc định
      round: data.round || 1,
    };
  }

  /**
   * Parse walls từ map 2D array (W = Wall, null = empty, C = Chest)
   */
  private parseWallsFromMap(mapData: any[]): Wall[] {
    const walls: Wall[] = [];
    const CELL_SIZE = 40;

    mapData.forEach((row, rowIndex) => {
      row.forEach((cell: string | null, colIndex: number) => {
        if (cell === "W") {
          walls.push({
            position: {
              x: colIndex * CELL_SIZE,
              y: rowIndex * CELL_SIZE,
            },
            isDestructible: false, // Tường cứng
          });
        }
      });
    });

    return walls;
  }

  /**
   * Parse chests (rương) - có thể phá hủy
   */
  private parseChests(chestsData: any[]): Wall[] {
    return chestsData
      .filter((chest) => !chest.isDestroyed)
      .map((chest) => ({
        position: { x: chest.x, y: chest.y },
        isDestructible: true, // Rương có thể phá
      }));
  }

  /**
   * Parse items
   */
  private parseItems(itemsData: any[]): Item[] {
    return itemsData.map((item) => ({
      id: item.id || `item-${item.x}-${item.y}`,
      position: { x: item.x, y: item.y },
      type: item.type || "unknown",
    }));
  }

  /**
   * Parse bombs
   */
  private parseBombs(bombsData: any[]): Bomb[] {
    return bombsData.map((bomb) => ({
      id: bomb.id || `bomb-${bomb.x}-${bomb.y}`,
      position: { x: bomb.x, y: bomb.y },
      ownerId: bomb.uid || bomb.ownerId,
      timeRemaining: bomb.timeRemaining || 5000,
      flameRange: bomb.explosionRange || bomb.flameRange || 2,
    }));
  }

  /**
   * Parse bots (bombers)
   */
  private parseBots(botsData: any[], currentBotId?: string): Bot[] {
    return botsData.map((bot) => ({
      id: bot.uid,
      name: bot.name,
      position: { x: bot.x, y: bot.y },
      speed: bot.speed || 1,
      bombCount: bot.bombCount || 1,
      flameRange: bot.explosionRange || 2,
      isAlive: bot.isAlive !== false,
      score: bot.score || 0,
    }));
  }

  /**
   * Tìm bot hiện tại dựa vào Socket ID
   */
  private findCurrentBot(bots: Bot[], currentBotId?: string): Bot {
    if (!currentBotId) {
      // Nếu không có ID, lấy bot đầu tiên
      console.warn("⚠️ Không có currentBotId, sử dụng bot đầu tiên");
      return bots[0] || this.createEmptyBot();
    }

    const bot = bots.find((b) => b.id === currentBotId);

    if (!bot) {
      console.warn(`⚠️ Không tìm thấy bot với ID: ${currentBotId}`);
      console.log(
        "📋 Danh sách bots:",
        bots.map((b) => ({ id: b.id, name: b.name }))
      );
      // Fallback: lấy bot đầu tiên
      return bots[0] || this.createEmptyBot();
    }
    return bot;
  }

  /**
   * Tạo bot rỗng (fallback)
   */
  private createEmptyBot(): Bot {
    return {
      id: "",
      name: "Unknown",
      position: { x: 0, y: 0 },
      speed: 1,
      bombCount: 1,
      flameRange: 2,
      isAlive: true,
      score: 0,
    };
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
