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
      const testData = {
        map: {
          width: 640,
          height: 640,
          walls: [{ x: 40, y: 40, destructible: false }],
          items: [{ id: "1", x: 80, y: 80, type: "SPEED" }],
          bombs: [],
        },
        bots: [
          {
            id: "bot1",
            x: 0,
            y: 0,
            speed: 2,
            bombCount: 2,
            flameRange: 3,
            isAlive: true,
            score: 100,
          },
        ],
        currentBotId: "bot1",
        timeRemaining: 240000,
        round: 2,
      };

      gameEngine.updateGameState(testData);
      const gameState = gameEngine.getGameState();

      expect(gameState.currentBot.id).toBe("bot1");
      expect(gameState.currentBot.speed).toBe(2);
      expect(gameState.currentBot.score).toBe(100);
      expect(gameState.timeRemaining).toBe(240000);
      expect(gameState.round).toBe(2);
      expect(gameState.map.walls.length).toBe(1);
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
    it("should return false for empty game state", () => {
      expect(gameEngine.isGameRunning()).toBe(false);
    });

    it("should return true when game is active", () => {
      const activeGameData = {
        bots: [
          {
            id: "bot1",
            x: 0,
            y: 0,
            isAlive: true,
            score: 0,
          },
          {
            id: "bot2",
            x: 100,
            y: 100,
            isAlive: true,
            score: 0,
          },
        ],
        currentBotId: "bot1",
        timeRemaining: 240000,
      };

      gameEngine.updateGameState(activeGameData);
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
