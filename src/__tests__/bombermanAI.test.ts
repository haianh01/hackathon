import { BombermanAI } from "../ai/bombermanAI";
import { GameState, BotAction } from "../types";

describe("BombermanAI", () => {
  let ai: BombermanAI;
  let mockGameState: GameState;

  beforeEach(() => {
    ai = new BombermanAI();

    mockGameState = {
      map: {
        width: 640,
        height: 640,
        walls: [],
        chests: [],
        items: [],
        bombs: [],
        bots: [],
      },
      currentBot: {
        id: "test-bot",
        position: { x: 100, y: 100 },
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
  });

  describe("makeDecision", () => {
    it("should return a valid decision", () => {
      const decision = ai.makeDecision(mockGameState);

      expect(decision).toHaveProperty("action");
      expect(decision).toHaveProperty("priority");
      expect(decision).toHaveProperty("reason");
      expect(typeof decision.priority).toBe("number");
      expect(typeof decision.reason).toBe("string");
    });

    it("should return a decision when strategies apply", () => {
      // Game state will have explore strategy apply
      const decision = ai.makeDecision(mockGameState);

      expect(decision.action).toBeDefined();
      expect(decision.priority).toBeGreaterThan(0);
    });

    it("should prioritize escape when in danger", () => {
      // Add a bomb near the bot
      const dangerousGameState = {
        ...mockGameState,
        map: {
          ...mockGameState.map,
          bombs: [
            {
              id: "bomb1",
              position: { x: 100, y: 100 }, // Same position as bot
              ownerId: "enemy",
              timeRemaining: 3000,
              flameRange: 2,
            },
          ],
        },
      };

      const decision = ai.makeDecision(dangerousGameState);

      // Should try to move away (escape strategy should activate)
      expect(decision.action).toBe(BotAction.MOVE);
      expect(decision.priority).toBeGreaterThan(90); // High priority for escape
    });
  });

  describe("strategy management", () => {
    it("should return strategies info", () => {
      const strategies = ai.getStrategiesInfo();

      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);

      strategies.forEach((strategy) => {
        expect(strategy).toHaveProperty("name");
        expect(strategy).toHaveProperty("priority");
        expect(typeof strategy.name).toBe("string");
        expect(typeof strategy.priority).toBe("number");
      });
    });

    it("should update strategy priority", () => {
      const strategies = ai.getStrategiesInfo();
      const firstStrategy = strategies[0];

      if (firstStrategy) {
        const newPriority = 999;
        const updated = ai.updateStrategyPriority(
          firstStrategy.name,
          newPriority
        );

        expect(updated).toBe(true);

        const updatedStrategies = ai.getStrategiesInfo();
        const updatedStrategy = updatedStrategies.find(
          (s) => s.name === firstStrategy.name
        );

        expect(updatedStrategy?.priority).toBe(newPriority);
      }
    });

    it("should reset strategies", () => {
      ai.resetStrategies();
      const strategies = ai.getStrategiesInfo();

      expect(strategies.length).toBeGreaterThan(0);
      // Should have default strategies
      const strategyNames = strategies.map((s) => s.name);
      expect(strategyNames).toContain("Escape");
      expect(strategyNames).toContain("Attack");
    });
  });
});
