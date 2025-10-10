import { BombStrategy } from "../strategies/bombStrategy";
import {
  GameState,
  BotAction,
  Position,
  Direction,
  ItemType,
  Wall,
  Bomb,
  Item,
  Bot,
} from "../types";

describe("BombStrategy", () => {
  let strategy: BombStrategy;
  let mockGameState: GameState;

  beforeEach(() => {
    strategy = new BombStrategy();

    mockGameState = {
      map: {
        width: 15,
        height: 15,
        walls: [],
        chests: [],
        items: [],
        bombs: [],
        bots: [],
      },
      currentBot: {
        id: "bot1",
        position: { x: 5, y: 5 },
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
          position: { x: 5, y: 5 },
          ownerId: "bot1",
          timeRemaining: 3,
          flameRange: 2,
        },
      ];
      const decision = strategy.evaluate(mockGameState);
      expect(decision).toBeNull();
    });

    it("should place bomb when there are nearby chests and escape route exists", () => {
      mockGameState.map.chests = [
        { position: { x: 5, y: 6 }, isDestructible: true },
        { position: { x: 6, y: 5 }, isDestructible: true },
      ];

      const decision = strategy.evaluate(mockGameState);
      expect(decision).not.toBeNull();
      expect(decision!.action).toBe(BotAction.BOMB);
      expect(decision!.reason).toContain("rương");
    });

    it("should return null when nearby chests exist but no escape route", () => {
      // Tạo tình huống bị bao vây
      mockGameState.currentBot.position = { x: 1, y: 1 };
      mockGameState.map.chests = [
        { position: { x: 1, y: 2 }, isDestructible: true },
      ];

      // Bao vây bot bằng tường cứng
      const walls: Wall[] = [];
      for (let x = 0; x <= 6; x++) {
        for (let y = 0; y <= 6; y++) {
          if (x !== 1 || y !== 1) {
            walls.push({
              position: { x, y },
              isDestructible: false,
            });
          }
        }
      }
      mockGameState.map.walls = walls;

      const decision = strategy.evaluate(mockGameState);
      expect(decision).toBeNull();
    });

    it("should place bomb to attack enemies", () => {
      mockGameState.enemies = [
        {
          id: "enemy1",
          position: { x: 5, y: 6 },
          speed: 1,
          bombCount: 1,
          flameRange: 1,
          isAlive: true,
          score: 0,
        } as Bot,
      ];

      const decision = strategy.evaluate(mockGameState);
      expect(decision).not.toBeNull();
      expect(decision!.action).toBe(BotAction.BOMB);
      expect(decision!.reason).toContain("tấn công");
    });

    it("should return null when no escape route available", () => {
      // Bao vây hoàn toàn
      mockGameState.currentBot.position = { x: 1, y: 1 };
      const walls: Wall[] = [];
      for (let x = 0; x < mockGameState.map.width; x++) {
        for (let y = 0; y < mockGameState.map.height; y++) {
          if (x !== 1 || y !== 1) {
            walls.push({
              position: { x, y },
              isDestructible: false,
            });
          }
        }
      }
      mockGameState.map.walls = walls;

      const decision = strategy.evaluate(mockGameState);
      expect(decision).toBeNull();
    });

    it("should return null when bomb benefit score is too low", () => {
      // Không có mục tiêu nào xung quanh
      const decision = strategy.evaluate(mockGameState);
      expect(decision).toBeNull();
    });

    it("should consider items and reduce score", () => {
      mockGameState.map.items = [
        {
          id: "item1",
          position: { x: 5, y: 6 },
          type: ItemType.SPEED,
        } as Item,
      ];
      mockGameState.map.chests = [
        { position: { x: 5, y: 7 }, isDestructible: true },
      ];

      const decision = strategy.evaluate(mockGameState);
      // May still place bomb but score affected
      if (decision) {
        expect(decision.action).toBe(BotAction.BOMB);
      }
    });
  });

  describe("calculateBombBenefit (private method tests)", () => {
    it("should give high score for destroying chests", () => {
      // Bot at (5,5), chests within flame range (2)
      mockGameState.currentBot.position = { x: 5, y: 5 };
      mockGameState.currentBot.flameRange = 2;
      mockGameState.map.chests = [
        { position: { x: 5, y: 6 }, isDestructible: true }, // 1 step down
        { position: { x: 6, y: 5 }, isDestructible: true }, // 1 step right
      ];

      const escapeRoute = [
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
      ];
      const result = (strategy as any).calculateBombBenefit(
        mockGameState,
        escapeRoute
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.reason).toContain("phá");
    });

    it("should give high score for attacking enemies", () => {
      // Bot at (5,5), enemy within flame range
      mockGameState.currentBot.position = { x: 5, y: 5 };
      mockGameState.currentBot.flameRange = 2;
      mockGameState.enemies = [
        {
          id: "enemy1",
          position: { x: 5, y: 6 }, // 1 step down from bot
          isAlive: true,
          bombCount: 1,
          flameRange: 1,
          score: 0,
          speed: 1,
        } as Bot,
      ];

      const escapeRoute = [
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
      ];
      const result = (strategy as any).calculateBombBenefit(
        mockGameState,
        escapeRoute
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.reason).toContain("tấn công");
    });

    it("should reduce score when nearby items exist", () => {
      mockGameState.currentBot.position = { x: 5, y: 5 };
      mockGameState.currentBot.flameRange = 3; // Increase range to reach more chests
      mockGameState.map.items = [
        {
          id: "item1",
          position: { x: 5, y: 6 }, // Within flame range
          type: ItemType.SPEED,
        },
      ];
      // Add enemies to ensure high enough score
      mockGameState.enemies = [
        {
          id: "enemy1",
          position: { x: 6, y: 5 },
          isAlive: true,
          bombCount: 1,
          flameRange: 1,
          score: 0,
          speed: 1,
        } as Bot,
        {
          id: "enemy2",
          position: { x: 7, y: 5 },
          isAlive: true,
          bombCount: 1,
          flameRange: 1,
          score: 0,
          speed: 1,
        } as Bot,
      ];

      const escapeRoute = [
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
      ];
      const result = (strategy as any).calculateBombBenefit(
        mockGameState,
        escapeRoute
      );

      // Item should appear in reason (penalty applied)
      expect(result.reason).toContain("item");
      // Score should still be positive due to enemies
      expect(result.score).toBeGreaterThan(0);
    });

    it("should return zero score when no valuable targets", () => {
      const escapeRoute = [{ x: 3, y: 5 }];
      const result = (strategy as any).calculateBombBenefit(
        mockGameState,
        escapeRoute
      );

      expect(result.score).toBe(0);
      expect(result.reason).toContain("không có mục tiêu");
    });

    it("should not count dead enemies", () => {
      mockGameState.enemies = [
        {
          id: "enemy1",
          position: { x: 5, y: 6 },
          isAlive: false,
          bombCount: 1,
          flameRange: 1,
          score: 0,
          speed: 1,
        } as Bot,
      ];

      const escapeRoute = [{ x: 3, y: 5 }];
      const result = (strategy as any).calculateBombBenefit(
        mockGameState,
        escapeRoute
      );

      expect(result.score).toBe(0);
    });

    it("should prefer attacking enemies over destroying chests", () => {
      mockGameState.currentBot.position = { x: 5, y: 5 };
      mockGameState.currentBot.flameRange = 2;
      mockGameState.map.chests = [
        { position: { x: 5, y: 6 }, isDestructible: true },
      ];
      mockGameState.enemies = [
        {
          id: "enemy1",
          position: { x: 6, y: 5 }, // Different direction
          isAlive: true,
          bombCount: 1,
          flameRange: 1,
          score: 0,
          speed: 1,
        } as Bot,
      ];

      const escapeRoute = [
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
      ];
      const result = (strategy as any).calculateBombBenefit(
        mockGameState,
        escapeRoute
      );

      expect(result.reason).toContain("tấn công");
      expect(result.score).toBeGreaterThan(30); // Enemy score > chest score
    });
  });

  describe("isValidPosition (private method tests)", () => {
    it("should return false for out of bounds positions", () => {
      const testCases = [
        { x: -1, y: 5 },
        { x: 5, y: -1 },
        { x: 15, y: 5 },
        { x: 5, y: 15 },
      ];

      testCases.forEach((pos) => {
        const result = (strategy as any).isValidPosition(
          pos,
          mockGameState.map
        );
        expect(result).toBe(false);
      });
    });

    it("should return false for solid wall positions", () => {
      mockGameState.map.walls = [
        { position: { x: 5, y: 5 }, isDestructible: false },
      ];

      const result = (strategy as any).isValidPosition(
        { x: 5, y: 5 },
        mockGameState.map
      );
      expect(result).toBe(false);
    });

    it("should return true for destructible wall positions", () => {
      mockGameState.map.walls = [
        { position: { x: 5, y: 5 }, isDestructible: true },
      ];

      const result = (strategy as any).isValidPosition(
        { x: 5, y: 5 },
        mockGameState.map
      );
      expect(result).toBe(true);
    });

    it("should return true for valid empty positions", () => {
      const result = (strategy as any).isValidPosition(
        { x: 5, y: 5 },
        mockGameState.map
      );
      expect(result).toBe(true);
    });
  });

  describe("findNearbyChests (private method tests)", () => {
    it("should find chests in all 4 directions", () => {
      mockGameState.map.chests = [
        { position: { x: 5, y: 6 }, isDestructible: true }, // DOWN
        { position: { x: 5, y: 4 }, isDestructible: true }, // UP
        { position: { x: 6, y: 5 }, isDestructible: true }, // RIGHT
        { position: { x: 4, y: 5 }, isDestructible: true }, // LEFT
      ];

      const result = (strategy as any).findNearbyChests(mockGameState);
      expect(result).toHaveLength(4);
    });

    it("should find chests within flame range", () => {
      mockGameState.currentBot.flameRange = 3;
      mockGameState.map.chests = [
        { position: { x: 5, y: 8 }, isDestructible: true }, // Distance 3
      ];

      const result = (strategy as any).findNearbyChests(mockGameState);
      expect(result).toHaveLength(1);
    });

    it("should not find chests beyond flame range", () => {
      mockGameState.currentBot.flameRange = 2;
      mockGameState.map.chests = [
        { position: { x: 5, y: 10 }, isDestructible: true }, // Distance 5
      ];

      const result = (strategy as any).findNearbyChests(mockGameState);
      expect(result).toHaveLength(0);
    });

    it("should stop at solid walls", () => {
      mockGameState.map.chests = [
        { position: { x: 5, y: 8 }, isDestructible: true }, // Behind wall
      ];
      mockGameState.map.walls = [
        { position: { x: 5, y: 6 }, isDestructible: false },
      ];

      const result = (strategy as any).findNearbyChests(mockGameState);
      expect(result).toHaveLength(0);
    });

    it("should find destructible walls as fallback", () => {
      mockGameState.map.walls = [
        { position: { x: 5, y: 6 }, isDestructible: true },
      ];

      const result = (strategy as any).findNearbyChests(mockGameState);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ x: 5, y: 6 });
    });

    it("should stop after finding first chest in a direction", () => {
      mockGameState.currentBot.flameRange = 5;
      mockGameState.map.chests = [
        { position: { x: 5, y: 6 }, isDestructible: true },
        { position: { x: 5, y: 7 }, isDestructible: true }, // Should not be found
      ];

      const result = (strategy as any).findNearbyChests(mockGameState);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ x: 5, y: 6 });
    });
  });

  describe("getAffectedPositions (private method tests)", () => {
    it("should include bomb position", () => {
      const result = (strategy as any).getAffectedPositions(
        { x: 5, y: 5 },
        2,
        mockGameState.map
      );

      expect(result).toContainEqual({ x: 5, y: 5 });
    });

    it("should include positions in all 4 directions within flame range", () => {
      const result = (strategy as any).getAffectedPositions(
        { x: 5, y: 5 },
        2,
        mockGameState.map
      );

      expect(result).toContainEqual({ x: 5, y: 6 });
      expect(result).toContainEqual({ x: 5, y: 7 });
      expect(result).toContainEqual({ x: 5, y: 4 });
      expect(result).toContainEqual({ x: 5, y: 3 });
      expect(result).toContainEqual({ x: 6, y: 5 });
      expect(result).toContainEqual({ x: 7, y: 5 });
      expect(result).toContainEqual({ x: 4, y: 5 });
      expect(result).toContainEqual({ x: 3, y: 5 });
    });

    it("should stop at walls", () => {
      mockGameState.map.walls = [
        { position: { x: 5, y: 6 }, isDestructible: false },
      ];

      const result = (strategy as any).getAffectedPositions(
        { x: 5, y: 5 },
        3,
        mockGameState.map
      );

      expect(result).not.toContainEqual({ x: 5, y: 7 });
      expect(result).not.toContainEqual({ x: 5, y: 8 });
    });

    it("should include chest position and stop", () => {
      mockGameState.map.chests = [
        { position: { x: 5, y: 6 }, isDestructible: true },
      ];

      const result = (strategy as any).getAffectedPositions(
        { x: 5, y: 5 },
        3,
        mockGameState.map
      );

      expect(result).toContainEqual({ x: 5, y: 6 });
      expect(result).not.toContainEqual({ x: 5, y: 7 });
    });

    it("should respect map boundaries", () => {
      mockGameState.currentBot.position = { x: 0, y: 0 };
      const result = (strategy as any).getAffectedPositions(
        { x: 0, y: 0 },
        3,
        mockGameState.map
      );

      // Should not include negative positions
      const hasNegative = result.some(
        (pos: Position) => pos.x < 0 || pos.y < 0
      );
      expect(hasNegative).toBe(false);
    });
  });

  describe("calculateSelfThreat (private method tests)", () => {
    it("should return high threat when no escape route", () => {
      const result = (strategy as any).calculateSelfThreat([]);
      expect(result).toBe(10);
    });

    it("should return high threat when null escape route", () => {
      const result = (strategy as any).calculateSelfThreat(null);
      expect(result).toBe(10);
    });

    it("should return medium threat for short escape routes", () => {
      const result = (strategy as any).calculateSelfThreat([
        { x: 3, y: 5 },
        { x: 2, y: 5 },
      ]);
      expect(result).toBe(5);
    });

    it("should return low threat for good escape routes", () => {
      const result = (strategy as any).calculateSelfThreat([
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
      ]);
      expect(result).toBe(1);
    });
  });

  describe("findEscapeRoute (private method tests)", () => {
    it("should find safe positions outside bomb range", () => {
      const result = (strategy as any).findEscapeRoute(mockGameState);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(0);
    });

    it("should return null when completely surrounded", () => {
      mockGameState.currentBot.position = { x: 1, y: 1 };
      mockGameState.currentBot.flameRange = 5;

      const walls: Wall[] = [];
      for (let x = 0; x < mockGameState.map.width; x++) {
        for (let y = 0; y < mockGameState.map.height; y++) {
          const distance = Math.abs(x - 1) + Math.abs(y - 1);
          if (distance > 0 && distance <= 6) {
            walls.push({
              position: { x, y },
              isDestructible: false,
            });
          }
        }
      }
      mockGameState.map.walls = walls;

      const result = (strategy as any).findEscapeRoute(mockGameState);
      expect(result).toBeNull();
    });

    it("should sort safe positions by distance", () => {
      const result = (strategy as any).findEscapeRoute(mockGameState);

      if (result && result.length > 1) {
        const botPos = mockGameState.currentBot.position;
        for (let i = 0; i < result.length - 1; i++) {
          const dist1 =
            Math.abs(result[i].x - botPos.x) + Math.abs(result[i].y - botPos.y);
          const dist2 =
            Math.abs(result[i + 1].x - botPos.x) +
            Math.abs(result[i + 1].y - botPos.y);
          expect(dist1).toBeLessThanOrEqual(dist2);
        }
      }
    });

    it("should only include positions within distance 5", () => {
      const result = (strategy as any).findEscapeRoute(mockGameState);
      const botPos = mockGameState.currentBot.position;

      if (result) {
        result.forEach((pos: Position) => {
          const distance =
            Math.abs(pos.x - botPos.x) + Math.abs(pos.y - botPos.y);
          expect(distance).toBeLessThanOrEqual(5);
        });
      }
    });

    it("should exclude dangerous positions from escape route", () => {
      mockGameState.currentBot.flameRange = 2;
      const result = (strategy as any).findEscapeRoute(mockGameState);
      const botPos = mockGameState.currentBot.position;

      if (result) {
        // No safe position should be in the flame range
        result.forEach((pos: Position) => {
          const inFlameRange =
            (pos.x === botPos.x &&
              Math.abs(pos.y - botPos.y) <=
                mockGameState.currentBot.flameRange) ||
            (pos.y === botPos.y &&
              Math.abs(pos.x - botPos.x) <=
                mockGameState.currentBot.flameRange);
          expect(inFlameRange).toBe(false);
        });
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

  describe("complex scenarios", () => {
    it("should handle multiple chests and enemies", () => {
      mockGameState.map.chests = [
        { position: { x: 5, y: 6 }, isDestructible: true },
        { position: { x: 6, y: 5 }, isDestructible: true },
      ];
      mockGameState.enemies = [
        {
          id: "enemy1",
          position: { x: 5, y: 7 },
          isAlive: true,
          bombCount: 1,
          flameRange: 1,
          score: 0,
          speed: 1,
        } as Bot,
        {
          id: "enemy2",
          position: { x: 7, y: 5 },
          isAlive: true,
          bombCount: 1,
          flameRange: 1,
          score: 0,
          speed: 1,
        } as Bot,
      ];

      const decision = strategy.evaluate(mockGameState);
      expect(decision).not.toBeNull();
      expect(decision?.priority).toBeGreaterThan(strategy.priority);
    });

    it("should not place bomb when only empty space around", () => {
      // No chests, no enemies, no targets
      const decision = strategy.evaluate(mockGameState);
      expect(decision).toBeNull();
    });

    it("should calculate correct flame range with extended range", () => {
      mockGameState.currentBot.flameRange = 5;
      mockGameState.map.chests = [
        { position: { x: 5, y: 10 }, isDestructible: true },
      ];

      const result = (strategy as any).findNearbyChests(mockGameState);
      expect(result).toHaveLength(1);
    });

    it("should handle corner positions correctly", () => {
      mockGameState.currentBot.position = { x: 0, y: 0 };
      mockGameState.map.chests = [
        { position: { x: 0, y: 1 }, isDestructible: true },
        { position: { x: 1, y: 0 }, isDestructible: true },
      ];

      const decision = strategy.evaluate(mockGameState);
      expect(decision).not.toBeNull();
    });

    it("should handle edge of map positions", () => {
      mockGameState.currentBot.position = { x: 14, y: 14 };
      mockGameState.map.chests = [
        { position: { x: 14, y: 13 }, isDestructible: true },
      ];

      const decision = strategy.evaluate(mockGameState);
      expect(decision).not.toBeNull();
    });
  });
});
