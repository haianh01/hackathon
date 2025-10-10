import {
  GameState,
  GameMap,
  Bot,
  Bomb,
  Item,
  Wall,
  UserResponse,
} from "../types";

/**
 * The GameEngine handles the game's logic and state management.
 */
export class GameEngine {
  private gameState: GameState;

  constructor() {
    this.gameState = this.createEmptyGameState();
  }

  /**
   * Updates the game state from server data.
   * @param data The data received from the server.
   * @param currentBotId The ID of the current bot.
   */
  public updateGameState(data: UserResponse, currentBotId: string): void {
    try {
      this.gameState = this.parseGameData(data, currentBotId);
    } catch (error) {
      console.error("Error updating game state:", error);
    }
  }

  /**
   * Gets the current game state.
   * @returns A copy of the current game state.
   */
  public getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Checks if the game is currently running.
   * @returns True if the game is running, false otherwise.
   */
  public isGameRunning(): boolean {
    const { currentBot, timeRemaining, enemies } = this.gameState;
    const isBotAlive = currentBot.isAlive;
    const hasTime = timeRemaining > 0;
    const hasAliveEnemies = enemies.some((enemy) => enemy.isAlive);

    // The game runs if the bot is alive, time remains, and there are living enemies (or no enemies in single-player).
    return isBotAlive && hasTime && (hasAliveEnemies || enemies.length === 0);
  }

  /**
   * Gets the current bot's information.
   * @returns A copy of the current bot's data.
   */
  public getCurrentBot(): Bot {
    return { ...this.gameState.currentBot };
  }

  /**
   * Gets the list of enemies.
   * @returns An array of enemy bots.
   */
  public getEnemies(): Bot[] {
    return this.gameState.enemies.map((enemy) => ({ ...enemy }));
  }

  /**
   * Gets the current map.
   * @returns A copy of the game map.
   */
  public getMap(): GameMap {
    return { ...this.gameState.map };
  }

  /**
   * Parses data from the server into a GameState object.
   * @param data The raw data from the server.
   * @param currentBotId The ID of the bot controlled by this client.
   * @returns The parsed game state.
   */
  private parseGameData(data: UserResponse, currentBotId: string): GameState {
    const bots = this.parseBots(data.bombers || []);
    const currentBot = this.findCurrentBot(bots, currentBotId);
    const enemies = bots.filter(
      (bot) => bot.id !== currentBot.id && bot.isAlive
    );

    const map: GameMap = {
      width: 640, // 16 cells * 40 pixels
      height: 640,
      walls: this.parseWallsFromMap(data.map || []),
      chests: this.parseChests(data.chests || []),
      items: this.parseItems(data.items || []),
      bombs: this.parseBombs(data.bombs || []),
      bots: bots,
    };

    return {
      map,
      currentBot,
      enemies,
      timeRemaining: data.timeRemaining ?? 300000, // Default to 5 minutes
      round: data.round ?? 1,
    };
  }

  /**
   * Parses walls from the 2D map array.
   * @param mapData The 2D array representing the map.
   * @returns An array of wall objects.
   */
  private parseWallsFromMap(mapData: (string | null)[][]): Wall[] {
    const walls: Wall[] = [];
    const CELL_SIZE = 40;

    mapData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell === "W") {
          walls.push({
            position: { x: colIndex * CELL_SIZE, y: rowIndex * CELL_SIZE },
            isDestructible: false, // Solid wall
          });
        }
      });
    });

    return walls;
  }

  /**
   * Parses destructible chests.
   * @param chestsData The raw chest data from the server.
   * @returns An array of wall objects representing chests.
   */
  private parseChests(chestsData: any[]): Wall[] {
    return chestsData
      .filter((chest) => !chest.isDestroyed)
      .map((chest) => ({
        position: { x: chest.x, y: chest.y },
        isDestructible: true,
      }));
  }

  /**
   * Parses items from server data.
   * @param itemsData The raw item data.
   * @returns An array of item objects.
   */
  private parseItems(itemsData: any[]): Item[] {
    return itemsData.map((item) => ({
      id: item.id || `item-${item.x}-${item.y}`,
      position: { x: item.x, y: item.y },
      type: item.type || "unknown",
    }));
  }

  /**
   * Parses bombs from server data.
   * @param bombsData The raw bomb data.
   * @returns An array of bomb objects.
   */
  private parseBombs(bombsData: any[]): Bomb[] {
    return bombsData.map((bomb) => ({
      id: bomb.id || `bomb-${bomb.x}-${bomb.y}`,
      position: { x: bomb.x, y: bomb.y },
      ownerId: bomb.uid || bomb.ownerId,
      timeRemaining: bomb.timeRemaining ?? 5000,
      flameRange: bomb.explosionRange || bomb.flameRange || 2,
    }));
  }

  /**
   * Parses bots (bombers) from server data.
   * @param botsData The raw bot data.
   * @returns An array of bot objects.
   */
  private parseBots(botsData: any[]): Bot[] {
    return botsData.map((bot) => ({
      id: bot.uid,
      name: bot.name,
      position: { x: bot.x, y: bot.y },
      speed: bot.speed ?? 1,
      bombCount: bot.bombCount ?? 1,
      flameRange: bot.explosionRange ?? 2,
      isAlive: bot.isAlive !== false,
      score: bot.score ?? 0,
    }));
  }

  /**
   * Finds the current bot based on its socket ID.
   * @param bots The list of all bots.
   * @param currentBotId The ID of the current bot.
   * @returns The current bot, or a fallback empty bot if not found.
   */
  private findCurrentBot(bots: Bot[], currentBotId: string): Bot {
    const bot = bots.find((b) => b.id === currentBotId);
    if (!bot) {
      console.warn(
        `⚠️ Bot with ID not found: ${currentBotId}. Falling back to the first bot.`
      );
      return bots[0] || this.createEmptyBot();
    }
    return bot;
  }

  /**
   * Creates an empty bot object as a fallback.
   * @returns An empty bot.
   */
  private createEmptyBot(): Bot {
    return {
      id: "",
      name: "Unknown",
      position: { x: 0, y: 0 },
      speed: 1,
      bombCount: 1,
      flameRange: 2,
      isAlive: false, // Default to not alive to prevent logic errors
      score: 0,
    };
  }

  /**
   * Creates an empty game state object.
   * @returns An empty game state.
   */
  private createEmptyGameState(): GameState {
    return {
      map: {
        width: 640,
        height: 640,
        walls: [],
        chests: [],
        items: [],
        bombs: [],
        bots: [],
      },
      currentBot: this.createEmptyBot(),
      enemies: [],
      timeRemaining: 300000,
      round: 1,
    };
  }

  /**
   * Calculates game statistics.
   * @returns An object with various game stats.
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
