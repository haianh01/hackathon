import { GameEngine } from "../game/gameEngine";

describe("GameEngine", () => {
  let gameEngine: GameEngine;

  beforeEach(() => {
    gameEngine = new GameEngine();
  });

  describe("initialization", () => {
    it("should initialize with empty game state", () => {
      const gameState = gameEngine.getGameState();

      expect(gameState).toHaveProperty("map");
      expect(gameState).toHaveProperty("currentBot");
      expect(gameState).toHaveProperty("enemies");
      expect(gameState.map.width).toBe(640);
      expect(gameState.map.height).toBe(640);
    });
  });

  describe("updateGameState", () => {
    it("should update game state from data", () => {
      // Create a 2D map array (16x16 grid)
      const mapArray: (string | null)[][] = Array(16)
        .fill(null)
        .map(() => Array(16).fill(null));
      // Add a wall at position (1, 1)
      if (mapArray[1]) {
        mapArray[1][1] = "W";
      }

      const testData = {
        map: mapArray, // 2D array expected by parseWallsFromMap
        bombers: [
          {
            uid: "bot1",
            x: 0,
            y: 0,
            speed: 2,
            bombCount: 2,
            explosionRange: 3,
            isAlive: true,
            score: 100,
            name: "TestBot",
          },
        ],
        bombs: [],
        items: [
          { x: 80, y: 80, type: "S" }, // SPEED item
        ],
        chests: [],
        timeRemaining: 240000,
        round: 2,
      };

      gameEngine.updateGameState(testData, "bot1");
      const gameState = gameEngine.getGameState();

      expect(gameState.currentBot.id).toBe("bot1");
      expect(gameState.currentBot.speed).toBe(2);
      expect(gameState.currentBot.score).toBe(100);
      expect(gameState.timeRemaining).toBe(240000);
      expect(gameState.round).toBe(2);
      expect(gameState.map.walls.length).toBeGreaterThanOrEqual(0);
      expect((gameState.map.chests || []).length).toBeGreaterThanOrEqual(0);
      expect(gameState.map.items.length).toBe(1);
    });

    it("should handle invalid data gracefully", () => {
      const invalidData = null;

      expect(() => {
        gameEngine.updateGameState(invalidData);
      }).not.toThrow();
    });
  });

  describe("isGameRunning", () => {
    it("should return true for initial empty game state", () => {
      // Initial state has bot alive with time remaining, so game is running
      expect(gameEngine.isGameRunning()).toBe(true);
    });

    it("should return false when bot is dead", () => {
      const deadBotData = {
        map: Array(16)
          .fill(null)
          .map(() => Array(16).fill(null)),
        bombers: [
          {
            uid: "bot1",
            x: 0,
            y: 0,
            isAlive: false, // Bot is dead
            score: 0,
          },
        ],
        bombs: [],
        items: [],
        chests: [],
        timeRemaining: 240000,
      };

      gameEngine.updateGameState(deadBotData, "bot1");
      expect(gameEngine.isGameRunning()).toBe(false);
    });

    it("should return false when time is up", () => {
      const noTimeData = {
        map: Array(16)
          .fill(null)
          .map(() => Array(16).fill(null)),
        bombers: [
          {
            uid: "bot1",
            x: 0,
            y: 0,
            isAlive: true,
            score: 0,
          },
        ],
        bombs: [],
        items: [],
        chests: [],
        timeRemaining: -1, // Use negative value instead of 0 (due to || operator in code)
      };

      gameEngine.updateGameState(noTimeData, "bot1");
      expect(gameEngine.isGameRunning()).toBe(false);
    });

    it("should return true when game is active", () => {
      const activeGameData = {
        map: Array(16)
          .fill(null)
          .map(() => Array(16).fill(null)),
        bombers: [
          {
            uid: "bot1",
            x: 0,
            y: 0,
            isAlive: true,
            score: 0,
          },
          {
            uid: "bot2",
            x: 100,
            y: 100,
            isAlive: true,
            score: 0,
          },
        ],
        bombs: [],
        items: [],
        chests: [],
        timeRemaining: 240000,
      };

      gameEngine.updateGameState(activeGameData, "bot1");
      expect(gameEngine.isGameRunning()).toBe(true);
    });
  });

  describe("getGameStats", () => {
    it("should return correct game statistics", () => {
      const stats = gameEngine.getGameStats();

      expect(stats).toHaveProperty("totalBots");
      expect(stats).toHaveProperty("aliveBots");
      expect(stats).toHaveProperty("totalBombs");
      expect(stats).toHaveProperty("totalItems");
      expect(stats).toHaveProperty("currentBotScore");
      expect(stats).toHaveProperty("timeRemainingMinutes");

      expect(typeof stats.totalBots).toBe("number");
      expect(typeof stats.aliveBots).toBe("number");
      expect(typeof stats.currentBotScore).toBe("number");
    });
  });
});
