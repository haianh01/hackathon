import {
  GameState,
  GameMap,
  Bot,
  Bomb,
  Item,
  Wall,
  UserResponse,
  Position,
  Chest,
  ItemCollectedEventData,
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
   * @returns The current game state (direct reference for real-time updates).
   * NOTE: Previously returned a shallow copy, but this caused position updates
   * to not be reflected in AI logic. Now returns direct reference for real-time sync.
   */
  public getGameState(): GameState {
    return this.gameState; // Direct reference for real-time position updates
  }

  /**
   * Updates the current bot's position immediately (real-time update).
   * This is called when receiving position updates from the server.
   * @param x The new X coordinate.
   * @param y The new Y coordinate.
   */
  public updateBotPosition(x: number, y: number): void {
    this.gameState.currentBot.position.x = x;
    this.gameState.currentBot.position.y = y;

    // Also update in bots array if present
    const botInArray = this.gameState.map.bots.find(
      (b) => b.id === this.gameState.currentBot.id
    );
    if (botInArray) {
      botInArray.position.x = x;
      botInArray.position.y = y;
    }
  }

  /**
   * Adds a new bomb to the game state immediately (real-time update).
   * This is called when receiving bomb placement events from the server.
   * @param bombData The raw bomb data from the server event.
   */
  public addBombRealtime(bombData: any): void {
    const newBomb: Bomb = {
      id: bombData.id || `bomb-${bombData.x}-${bombData.y}`,
      position: { x: bombData.x, y: bombData.y },
      ownerId: bombData.uid || bombData.ownerId,
      timeRemaining: bombData.timeRemaining ?? 5000,
      flameRange:
        bombData.flameRange ||
        bombData.explosionRange ||
        bombData.flameRange ||
        2,
    };

    // Add to bombs array if not already present
    const existingBomb = this.gameState.map.bombs.find(
      (b) =>
        b.position.x === newBomb.position.x &&
        b.position.y === newBomb.position.y
    );

    if (!existingBomb) {
      this.gameState.map.bombs.push(newBomb);
    }
  }

  /**
   * Finds a predicted bomb in the game state and updates it with the
   * real data received from the server.
   * @param predictedPosition The position of the bomb we predicted.
   * @param serverBombData The final bomb data from the server, including the real ID.
   */
  public confirmPredictedBomb(
    predictedPosition: Position,
    serverBombData: any
  ): void {
    // Find the temporary bomb in our state that matches the predicted position
    const tempBomb = this.gameState.map.bombs.find((bomb) => {
      // Match by position and check if it's a predicted bomb
      const isPredicted = String(bomb.id).startsWith("predicted-");
      const dist = Math.hypot(
        bomb.position.x - predictedPosition.x,
        bomb.position.y - predictedPosition.y
      );
      return isPredicted && dist < 10;
    });

    if (tempBomb) {
      const index = this.gameState.map.bombs.indexOf(tempBomb);
      console.log(
        `✅ Correlating bomb. Replacing temp ID ${tempBomb.id} with real ID ${serverBombData.id} at index ${index}.`
      );
      // Replace the temporary bomb with the real one from the server
      // to ensure all data (ID, exact position, etc.) is accurate.
      this.gameState.map.bombs[index] = {
        id: serverBombData.id,
        position: { x: serverBombData.x, y: serverBombData.y },
        ownerId: serverBombData.uid,
        timeRemaining: serverBombData.timeRemaining ?? 5000,
        flameRange:
          serverBombData.flameRange || serverBombData.explosionRange || 2,
      };
    }
  }
  // ...existing code...
  /**
   * Remove a bomb from the game state that was exploded (realtime).
   * Safe: checks for structure existence and attempts to update any danger maps.
   * @param bombIdentifier Can be a Position object or an object with an `id` property.
   */
  public removeBombRealtime(bombIdentifier: Position | { id: any }): void {
    if (!bombIdentifier) return;

    // Defensive checks for game state structure
    if (
      !this.gameState ||
      !this.gameState.map ||
      !Array.isArray(this.gameState.map.bombs)
    ) {
      return;
    }

    const bombs = this.gameState.map.bombs;
    let idx = -1;

    if ("id" in bombIdentifier) {
      idx = bombs.findIndex((b) => b.id === bombIdentifier.id);
    } else if ("x" in bombIdentifier && "y" in bombIdentifier) {
      // Fallback to position for predicted bombs or events without ID
      idx = bombs.findIndex((b) => {
        const dist = Math.hypot(
          b.position.x - bombIdentifier.x,
          b.position.y - bombIdentifier.y
        );
        return dist < 10; // Use a small threshold for position matching
      });
    }

    if (idx === -1) {
      // nothing to remove
      return;
    }

    const [removed] = bombs.splice(idx, 1);
    // try {
    //   if ((this as any).bombsById && (this as any).bombsById[bombId]) {
    //     delete (this as any).bombsById[bombId];
    //   }
    // } catch (e) {
    //   // ignore if not present
    // }

    // Recompute danger zones / caches if engine provides helpers
    // if (typeof (this as any).recalculateDangerZones === "function") {
    //   (this as any).recalculateDangerZones();
    // } else if (typeof (this as any).updateDangerMap === "function") {
    //   (this as any).updateDangerMap();
    // }

    console.log(`🧨 Bomb removed from state:`, removed);
  }

  /**
   * Cập nhật trạng thái của Bot khi một Item được thu thập (realtime).
   *
   * Hàm này loại bỏ item đã được thu thập khỏi danh sách items của GameState
   * và khỏi danh sách mục tiêu (targets) của Bot nếu có.
   *
   * @param data Thông tin sự kiện ItemCollectedEventData.
   */
  public handleItemCollected(data: ItemCollectedEventData): void {
    // 1. Unified Defensive Check
    if (
      !data?.item ||
      !this.gameState?.map?.items ||
      !Array.isArray(this.gameState.map.items)
    ) {
      console.warn(
        "⚡ Realtime: Invalid data or game state structure on ItemCollected event."
      );
      return;
    }

    const { x, y } = data.item;
    const gameItems: Item[] = this.gameState.map.items;

    // 2. Find the Item
    // Tìm item dựa trên tọa độ x, y
    const idx = gameItems.findIndex(
      (item: Item) => item && item.position.x === x && item.position.y === y
    );

    // 3. Removal Check
    if (idx === -1) {
      console.warn(
        `⚡ Realtime: Item collected event received for non-existent item at (${x}, ${y}).`
      );
      return;
    }

    // 4. Perform Removal from GameState
    const [removedItem] = gameItems.splice(idx, 1);

    // 5. Update Bot's Internal Logic (Crucial for Bot AI)

    // 5a. CẬP NHẬT CHỈ SỐ CỦA BOT (Nếu bot của mình thu thập)
    if (data.bomber && this.gameState.currentBot.id === data.bomber.uid) {
      // Lưu ý: Trong một số protocol, chỉ số của bot (speed, bombCount, v.v.)
      // được server tự động cập nhật trong sự kiện trạng thái (state update).
      // Tuy nhiên, cập nhật sớm ở đây giúp logic bot phản ứng nhanh hơn.

      // Cập nhật lại chỉ số của currentBot bằng dữ liệu mới nhất từ event
      // Dùng destructuring để cập nhật trực tiếp
      const { speed, bombCount, explosionRange, speedCount } = data.bomber;

      this.gameState.currentBot = {
        ...this.gameState.currentBot,
        speed,
        bombCount,
        flameRange: explosionRange,
        speedCount,
      };
    }

    // 5b. HỦY BỎ MỤC TIÊU ĐANG NHẮM TỚI
    // Nếu bot của bạn có một biến trạng thái (ví dụ: `this.targetPosition`)
    // đang lưu trữ vị trí của item vừa bị thu thập, hãy reset nó.
    // if (
    //   instance.targetPosition &&
    //   instance.targetPosition.x === x &&
    //   instance.targetPosition.y === y
    // ) {
    //   instance.targetPosition = null;
    //   console.log("🎯 Bot Goal Reset: Target item was collected.");
    // }
    // *Lưu ý quan trọng cho Bot AI:*
    // Nếu Bot đang có mục tiêu là item này, hãy loại bỏ nó khỏi danh sách mục tiêu
    // và kích hoạt lại logic tìm đường/quyết định (pathfinding/decision-making).

    // Ví dụ: Kích hoạt tính toán lại hành động kế tiếp
    // const instance = this as any;
    // if (typeof instance.recalculateNextAction === "function") {
    //   instance.recalculateNextAction();
    // }
  }

  // ...existing code...
  /**
   * Remove a chest from the game state that was destroyed (realtime).
   * Accepts either an id string, an object with { id | _id } or a position { x, y }.
   * Returns the removed chest object or null if nothing removed.
   */
  public removeChestRealtime(position: Position) {
    if (!position) return null;

    // Defensive checks for game state structure
    if (
      !this.gameState ||
      !this.gameState.map ||
      !Array.isArray(this.gameState.map.chests)
    ) {
      return null;
    }

    const chests = this.gameState.map.chests;
    const idx = chests.findIndex((c: Chest) => {
      return c && c.position.x === position.x && c.position.y === position.y;
    });
    if (idx === -1) {
      // nothing to remove
      return;
    }
    const [removed] = chests.splice(idx, 1);

    // If engine provides helpers to update caches/danger maps, call them
    // if (typeof (this as any).recalculateMapCaches === "function") {
    //   (this as any).recalculateMapCaches();
    // } else if (typeof (this as any).updateMapState === "function") {
    //   (this as any).updateMapState();
    // }

    // Lightweight debug log
    // eslint-disable-next-line no-console
    console.log("🧱 Chest removed from state:", removed);

    return removed;
  }

  //
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

    // Calculate map size from actual map data
    const CELL_SIZE = 40;
    const mapData = data.map || [];
    const mapHeight = mapData.length * CELL_SIZE;
    const mapWidth =
      mapData.length > 0 && mapData[0] ? mapData[0].length * CELL_SIZE : 0;

    console.log(
      `🗺️ Map size: ${mapWidth}x${mapHeight} (${mapData[0]?.length || 0}x${
        mapData.length
      } cells)`
    );

    const map: GameMap = {
      width: mapWidth,
      height: mapHeight,
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
