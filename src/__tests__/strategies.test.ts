import { EscapeStrategy } from "../strategies/escapeStrategy";
import { AttackStrategy } from "../strategies/attackStrategy";
import { CollectStrategy } from "../strategies/collectStrategy";
import { GameState, ItemType } from "../types";

describe("Strategies", () => {
  let mockGameState: GameState;

  beforeEach(() => {
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

  describe("EscapeStrategy", () => {
    it("should return null when not in danger", () => {
      const strategy = new EscapeStrategy();
      const decision = strategy.evaluate(mockGameState);

      expect(decision).toBeNull();
    });

    it("should return escape decision when in danger", () => {
      const strategy = new EscapeStrategy();

      // Add bomb at same position as bot
      const dangerGameState = {
        ...mockGameState,
        map: {
          ...mockGameState.map,
          bombs: [
            {
              id: "bomb1",
              position: { x: 100, y: 100 },
              ownerId: "enemy",
              timeRemaining: 3000,
              flameRange: 2,
            },
          ],
        },
      };

      const decision = strategy.evaluate(dangerGameState);

      expect(decision).not.toBeNull();
      expect(decision?.priority).toBe(100);
      expect(decision?.reason).toContain("Thoát hiểm");
    });
  });

  describe("AttackStrategy", () => {
    it("should return null when no bomb available", () => {
      const strategy = new AttackStrategy();

      const noBombGameState = {
        ...mockGameState,
        currentBot: {
          ...mockGameState.currentBot,
          bombCount: 0,
        },
      };

      const decision = strategy.evaluate(noBombGameState);
      expect(decision).toBeNull();
    });

    it("should return null when no good targets", () => {
      const strategy = new AttackStrategy();
      const decision = strategy.evaluate(mockGameState);

      // No enemies or destructible walls nearby, should not attack
      expect(decision).toBeNull();
    });
  });

  describe("CollectStrategy", () => {
    it("should return null when no items available", () => {
      const strategy = new CollectStrategy();
      const decision = strategy.evaluate(mockGameState);

      expect(decision).toBeNull();
    });

    it("should move towards valuable item", () => {
      const strategy = new CollectStrategy();

      // Tạo game state với item gần bot và không có bom nguy hiểm
      const itemGameState = {
        ...mockGameState,
        map: {
          ...mockGameState.map,
          items: [
            {
              id: "item1",
              position: { x: 102, y: 100 }, // Gần bot hơn
              type: ItemType.SPEED,
            },
          ],
          bombs: [], // Đảm bảo không có bom
          walls: [], // Đảm bảo không có tường chặn
        },
      };

      const decision = strategy.evaluate(itemGameState);

      expect(decision).not.toBeNull();
      if (decision) {
        expect(decision.reason).toContain("Thu thập vật phẩm");
        expect(decision.target).toEqual({ x: 102, y: 100 });
      }
    });
  });
});
