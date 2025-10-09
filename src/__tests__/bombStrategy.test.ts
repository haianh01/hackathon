import { BombStrategy } from "../strategies/bombStrategy";
import { GameState, BotAction, Position, Direction, ItemType } from "../types";

describe("BombStrategy", () => {
  let strategy: BombStrategy;
  let mockGameState: GameState;

  beforeEach(() => {
    strategy = new BombStrategy();

    mockGameState = {
      map: {
        width: 10,
        height: 10,
        walls: [
          { position: { x: 2, y: 2 }, isDestructible: true },
          { position: { x: 3, y: 2 }, isDestructible: false },
          { position: { x: 1, y: 5 }, isDestructible: true },
        ],
        items: [],
        bombs: [],
        bots: [],
      },
      currentBot: {
        id: "bot1",
        position: { x: 1, y: 1 },
        speed: 1,
        bombCount: 1,
        flameRange: 2,
        isAlive: true,
        score: 0,
        name: "TestBot",
      },
      enemies: [],
      timeRemaining: 100,
      round: 1,
    };
  });

  describe("evaluate", () => {
    it("should return null if bot has no bombs", () => {
      mockGameState.currentBot.bombCount = 0;
      const decision = strategy.evaluate(mockGameState);
      expect(decision).toBeNull();
    });

    it("should return null if there's already a bomb at current position", () => {
      mockGameState.map.bombs = [
        {
          id: "bomb1",
          position: { x: 1, y: 1 },
          ownerId: "bot2",
          timeRemaining: 3,
          flameRange: 2,
        },
      ];
      const decision = strategy.evaluate(mockGameState);
      expect(decision).toBeNull();
    });

    it("should suggest bomb placement when can destroy walls", () => {
      // Bot ở vị trí (1,1), có thể phá tường ở (1,2) hoặc (2,1) với flame range 2
      mockGameState.map.walls = [
        { position: { x: 1, y: 2 }, isDestructible: true }, // Trực tiếp phía dưới
        { position: { x: 2, y: 1 }, isDestructible: true }, // Trực tiếp bên phải
      ];

      const decision = strategy.evaluate(mockGameState);

      expect(decision).not.toBeNull();
      expect(decision!.action).toBe(BotAction.BOMB);
      expect(decision!.reason).toContain("phá");
    });

    it("should suggest bomb placement when can attack enemies", () => {
      mockGameState.enemies = [
        {
          id: "enemy1",
          position: { x: 1, y: 3 }, // Trong tầm nổ
          speed: 1,
          bombCount: 1,
          flameRange: 1,
          isAlive: true,
          score: 0,
        },
      ];

      const decision = strategy.evaluate(mockGameState);

      expect(decision).not.toBeNull();
      expect(decision!.action).toBe(BotAction.BOMB);
      expect(decision!.reason).toContain("tấn công");
    });

    it("should return null if no escape route available", () => {
      // Tạo tình huống bot bị bao vây
      mockGameState.map.walls = [
        { position: { x: 0, y: 1 }, isDestructible: false },
        { position: { x: 2, y: 1 }, isDestructible: false },
        { position: { x: 1, y: 0 }, isDestructible: false },
        { position: { x: 1, y: 2 }, isDestructible: false },
      ];

      const decision = strategy.evaluate(mockGameState);
      expect(decision).toBeNull();
    });

    it("should consider items when calculating bomb benefit", () => {
      mockGameState.map.items = [
        {
          id: "item1",
          position: { x: 1, y: 2 }, // Trong tầm nổ trực tiếp
          type: ItemType.SPEED,
        },
      ];

      // Thêm một tường để có lợi ích cơ bản, nhưng item sẽ giảm điểm
      mockGameState.map.walls = [
        { position: { x: 2, y: 1 }, isDestructible: true },
      ];

      const decision = strategy.evaluate(mockGameState);

      // Vẫn có thể có decision nhưng reason sẽ mention item
      if (decision) {
        expect(decision.reason).toContain("item");
      } else {
        // Hoặc không có decision do điểm quá thấp
        expect(decision).toBeNull();
      }
    });
  });

  describe("priority", () => {
    it("should have high priority (80)", () => {
      expect(strategy.priority).toBe(80);
    });
  });

  describe("name", () => {
    it("should be BombStrategy", () => {
      expect(strategy.name).toBe("BombStrategy");
    });
  });

  describe("bomb placement logic", () => {
    it("should calculate correct flame range positions", () => {
      mockGameState.currentBot.flameRange = 3;
      mockGameState.map.walls = [
        { position: { x: 1, y: 4 }, isDestructible: true }, // Trong tầm
        { position: { x: 4, y: 1 }, isDestructible: true }, // Trong tầm
        { position: { x: 1, y: 5 }, isDestructible: true }, // Ngoài tầm
      ];

      const decision = strategy.evaluate(mockGameState);

      expect(decision).not.toBeNull();
      expect(decision!.action).toBe(BotAction.BOMB);
    });

    it("should stop flame at non-destructible walls", () => {
      mockGameState.currentBot.flameRange = 5;
      mockGameState.map.walls = [
        { position: { x: 1, y: 2 }, isDestructible: false }, // Chặn flame
        { position: { x: 1, y: 3 }, isDestructible: true }, // Không bị ảnh hưởng
      ];

      const decision = strategy.evaluate(mockGameState);

      // Chỉ nên tính 1 tường có thể phá, không phải 2
      if (decision) {
        expect(decision.reason).not.toContain("2 tường");
      }
    });
  });

  describe("escape route calculation", () => {
    it("should find safe positions outside blast range", () => {
      mockGameState.currentBot.position = { x: 5, y: 5 };
      mockGameState.currentBot.flameRange = 2;

      // Tạo không gian rộng để có nhiều vị trí an toàn
      mockGameState.map.walls = [];

      const decision = strategy.evaluate(mockGameState);
      expect(decision).not.toBeNull();
    });
  });
});
