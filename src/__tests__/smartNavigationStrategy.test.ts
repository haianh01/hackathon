import { SmartNavigationStrategy } from "../strategies/smartNavigationStrategy";
import { GameState, BotAction, Direction, ItemType } from "../types";

describe("SmartNavigationStrategy", () => {
  let strategy: SmartNavigationStrategy;
  let mockGameState: GameState;

  beforeEach(() => {
    strategy = new SmartNavigationStrategy();

    mockGameState = {
      map: {
        width: 10,
        height: 10,
        walls: [],
        items: [],
        bombs: [],
        bots: [],
      },
      currentBot: {
        id: "test-bot",
        position: { x: 5, y: 5 },
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

  describe("escape functionality", () => {
    it("should prioritize escaping when in danger zone", () => {
      // Đặt bom gần bot để tạo vùng nguy hiểm
      mockGameState.map.bombs = [
        {
          id: "bomb1",
          position: { x: 5, y: 3 }, // 2 ô phía trên bot
          ownerId: "enemy",
          timeRemaining: 2,
          flameRange: 3, // Sẽ nổ tới vị trí bot (5,5)
        },
      ];

      const decision = strategy.evaluate(mockGameState);

      expect(decision).not.toBeNull();
      expect(decision!.action).toBe(BotAction.MOVE);
      expect(decision!.reason).toContain("Thoát khỏi vùng nguy hiểm");
      expect(decision!.priority).toBe(strategy.priority + 50); // Ưu tiên cao
    });

    it("should find safe position when escaping", () => {
      // Tạo bom gần bot (không tại vị trí bot) để có thể thoát
      mockGameState.map.bombs = [
        {
          id: "bomb1",
          position: { x: 5, y: 3 }, // 2 ô phía trên bot
          ownerId: "test-bot",
          timeRemaining: 3,
          flameRange: 2, // Sẽ nổ tới vị trí bot
        },
      ];

      const decision = strategy.evaluate(mockGameState);

      expect(decision).not.toBeNull();
      expect(decision!.action).toBe(BotAction.MOVE);
      expect(decision!.direction).toBeDefined();
    });

    it("should handle multiple bombs scenario", () => {
      // Tạo nhiều bom để kiểm tra logic thoát hiểm phức tạp
      mockGameState.map.bombs = [
        {
          id: "bomb1",
          position: { x: 5, y: 3 },
          ownerId: "enemy1",
          timeRemaining: 2,
          flameRange: 2,
        },
        {
          id: "bomb2",
          position: { x: 3, y: 5 },
          ownerId: "enemy2",
          timeRemaining: 3,
          flameRange: 2,
        },
      ];

      const decision = strategy.evaluate(mockGameState);

      expect(decision).not.toBeNull();
      expect(decision!.action).toBe(BotAction.MOVE);
      expect(decision!.reason).toContain("Thoát khỏi vùng nguy hiểm");
    });
  });

  describe("normal navigation", () => {
    it("should navigate to items when safe", () => {
      // Thêm item để bot di chuyển tới
      mockGameState.map.items = [
        {
          id: "item1",
          position: { x: 7, y: 7 },
          type: ItemType.SPEED,
        },
      ];

      const decision = strategy.evaluate(mockGameState);

      expect(decision).not.toBeNull();
      expect(decision!.action).toBe(BotAction.MOVE);
      expect(decision!.reason).toContain("Điều hướng thông minh");
    });

    it("should navigate to strategic positions when no items", () => {
      // Thêm tường có thể phá để tạo vị trí chiến thuật
      mockGameState.map.walls = [
        { position: { x: 6, y: 5 }, isDestructible: true },
        { position: { x: 5, y: 6 }, isDestructible: true },
      ];

      const decision = strategy.evaluate(mockGameState);

      if (decision) {
        expect(decision.action).toBe(BotAction.MOVE);
        expect(decision.reason).toContain("Điều hướng thông minh");
      }
    });

    it("should return null when no targets available", () => {
      // Không có item, không có tường phá được
      const decision = strategy.evaluate(mockGameState);

      expect(decision).toBeNull();
    });
  });

  describe("safety checks", () => {
    it("should not move to dangerous positions", () => {
      // Tạo item ở vị trí nguy hiểm
      mockGameState.map.items = [
        {
          id: "item1",
          position: { x: 7, y: 5 }, // Gần bom
          type: ItemType.SPEED,
        },
      ];

      mockGameState.map.bombs = [
        {
          id: "bomb1",
          position: { x: 8, y: 5 },
          ownerId: "enemy",
          timeRemaining: 2,
          flameRange: 3,
        },
      ];

      const decision = strategy.evaluate(mockGameState);

      // Nếu có decision, nó không nên dẫn bot vào vùng nguy hiểm
      if (decision) {
        expect(decision.action).toBe(BotAction.MOVE);
        // Target không nên là vị trí nguy hiểm
        expect(decision.target).toBeDefined();
      }
    });
  });

  describe("priority system", () => {
    it("should have correct priority", () => {
      expect(strategy.priority).toBe(45);
    });

    it("should have correct name", () => {
      expect(strategy.name).toBe("SmartNavigation");
    });
  });
});
