/**
 * Test cho Position Tracking & Movement Prediction
 */

import { Direction } from "../types";
import {
  getPositionInDirectionSmallStep,
  canMoveToPositionPrecise,
  isPositionCollidingWithWalls,
} from "../utils";

describe("Position Tracking & Prediction", () => {
  describe("getPositionInDirectionSmallStep", () => {
    it("should move 3px UP", () => {
      const pos = { x: 100, y: 100 };
      const result = getPositionInDirectionSmallStep(pos, Direction.UP, 3);
      expect(result).toEqual({ x: 100, y: 97 });
    });

    it("should move 3px DOWN", () => {
      const pos = { x: 100, y: 100 };
      const result = getPositionInDirectionSmallStep(pos, Direction.DOWN, 3);
      expect(result).toEqual({ x: 100, y: 103 });
    });

    it("should move 3px LEFT", () => {
      const pos = { x: 100, y: 100 };
      const result = getPositionInDirectionSmallStep(pos, Direction.LEFT, 3);
      expect(result).toEqual({ x: 97, y: 100 });
    });

    it("should move 3px RIGHT", () => {
      const pos = { x: 100, y: 100 };
      const result = getPositionInDirectionSmallStep(pos, Direction.RIGHT, 3);
      expect(result).toEqual({ x: 103, y: 100 });
    });

    it("should not move on STOP", () => {
      const pos = { x: 100, y: 100 };
      const result = getPositionInDirectionSmallStep(pos, Direction.STOP, 3);
      expect(result).toEqual({ x: 100, y: 100 });
    });
  });

  describe("isPositionCollidingWithWalls", () => {
    it("should detect collision with wall", () => {
      const gameState: any = {
        map: {
          walls: [{ position: { x: 40, y: 40 }, isDestructible: false }],
        },
      };

      // Bot at (35, 35) with size 30 will collide with wall at (40, 40)
      const result = isPositionCollidingWithWalls(
        { x: 35, y: 35 },
        gameState,
        30
      );
      expect(result).toBe(true);
    });

    it("should not detect collision when far from wall", () => {
      const gameState: any = {
        map: {
          walls: [{ position: { x: 40, y: 40 }, isDestructible: false }],
        },
      };

      // Bot at (100, 100) with size 30 will NOT collide with wall at (40, 40)
      const result = isPositionCollidingWithWalls(
        { x: 100, y: 100 },
        gameState,
        30
      );
      expect(result).toBe(false);
    });

    it("should detect collision with chest (destructible wall)", () => {
      const gameState: any = {
        map: {
          walls: [{ position: { x: 80, y: 80 }, isDestructible: true }],
        },
      };

      // Bot at (75, 75) with size 30 will collide with chest at (80, 80)
      const result = isPositionCollidingWithWalls(
        { x: 75, y: 75 },
        gameState,
        30
      );
      expect(result).toBe(true);
    });
  });

  describe("canMoveToPositionPrecise", () => {
    const createMockGameState = (walls: any[] = []): any => ({
      map: {
        width: 640,
        height: 640,
        walls,
      },
    });

    it("should allow move to empty space", () => {
      const gameState = createMockGameState();
      const result = canMoveToPositionPrecise({ x: 100, y: 100 }, gameState);
      expect(result).toBe(true);
    });

    it("should block move outside map (negative x)", () => {
      const gameState = createMockGameState();
      const result = canMoveToPositionPrecise({ x: -10, y: 100 }, gameState);
      expect(result).toBe(false);
    });

    it("should block move outside map (too large x)", () => {
      const gameState = createMockGameState();
      const result = canMoveToPositionPrecise({ x: 700, y: 100 }, gameState);
      expect(result).toBe(false);
    });

    it("should block move outside map (negative y)", () => {
      const gameState = createMockGameState();
      const result = canMoveToPositionPrecise({ x: 100, y: -10 }, gameState);
      expect(result).toBe(false);
    });

    it("should block move outside map (too large y)", () => {
      const gameState = createMockGameState();
      const result = canMoveToPositionPrecise({ x: 100, y: 700 }, gameState);
      expect(result).toBe(false);
    });

    it("should block move to wall position", () => {
      const gameState = createMockGameState([
        { position: { x: 100, y: 100 }, isDestructible: false },
      ]);
      const result = canMoveToPositionPrecise({ x: 105, y: 105 }, gameState);
      expect(result).toBe(false);
    });
  });

  describe("Movement Prediction Integration", () => {
    it("should predict safe movement path", () => {
      const gameState: any = {
        map: {
          width: 640,
          height: 640,
          walls: [
            { position: { x: 200, y: 100 }, isDestructible: false }, // Wall far ahead
          ],
        },
      };

      const currentPos = { x: 100, y: 100 };

      // Try to move RIGHT (will be safe for several steps)
      const predictedRight = getPositionInDirectionSmallStep(
        currentPos,
        Direction.RIGHT,
        3
      );
      expect(canMoveToPositionPrecise(predictedRight, gameState)).toBe(true); // Safe at 103

      // Multiple steps
      let pos = currentPos;
      let safeSteps = 0;
      for (let i = 0; i < 10; i++) {
        pos = getPositionInDirectionSmallStep(pos, Direction.RIGHT, 3);
        if (canMoveToPositionPrecise(pos, gameState)) {
          safeSteps++;
        } else {
          break;
        }
      }

      expect(safeSteps).toBeGreaterThan(0);
    });

    it("should detect and avoid wall collision", () => {
      const gameState: any = {
        map: {
          width: 640,
          height: 640,
          walls: [
            { position: { x: 400, y: 400 }, isDestructible: false }, // Wall far away
          ],
        },
      };

      const currentPos = { x: 100, y: 100 };

      // Try all directions from safe position
      const directions = [
        Direction.UP,
        Direction.DOWN,
        Direction.LEFT,
        Direction.RIGHT,
      ];

      const safeDirections = directions.filter((dir) => {
        const predicted = getPositionInDirectionSmallStep(currentPos, dir, 3);
        return canMoveToPositionPrecise(predicted, gameState);
      });

      // All directions should be safe from this position
      expect(safeDirections.length).toBe(4);
    });

    it("should block movement near boundary", () => {
      const gameState: any = {
        map: {
          width: 640,
          height: 640,
          walls: [],
        },
      };

      // Near left boundary
      const nearBoundary = { x: 1, y: 100 };
      const predictedLeft = getPositionInDirectionSmallStep(
        nearBoundary,
        Direction.LEFT,
        3
      );
      
      // Should be outside map (negative x)
      expect(canMoveToPositionPrecise(predictedLeft, gameState)).toBe(false);
    });
  });
});
