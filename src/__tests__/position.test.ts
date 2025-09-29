import {
  manhattanDistance,
  euclideanDistance,
  positionsEqual,
  getDirectionToTarget,
} from "../utils/position";
import { Direction } from "../types";

describe("Position Utils", () => {
  describe("manhattanDistance", () => {
    it("should calculate correct Manhattan distance", () => {
      const pos1 = { x: 0, y: 0 };
      const pos2 = { x: 3, y: 4 };

      expect(manhattanDistance(pos1, pos2)).toBe(7);
    });

    it("should return 0 for same positions", () => {
      const pos = { x: 5, y: 5 };

      expect(manhattanDistance(pos, pos)).toBe(0);
    });
  });

  describe("euclideanDistance", () => {
    it("should calculate correct Euclidean distance", () => {
      const pos1 = { x: 0, y: 0 };
      const pos2 = { x: 3, y: 4 };

      expect(euclideanDistance(pos1, pos2)).toBe(5);
    });

    it("should return 0 for same positions", () => {
      const pos = { x: 5, y: 5 };

      expect(euclideanDistance(pos, pos)).toBe(0);
    });
  });

  describe("positionsEqual", () => {
    it("should return true for equal positions", () => {
      const pos1 = { x: 10, y: 20 };
      const pos2 = { x: 10, y: 20 };

      expect(positionsEqual(pos1, pos2)).toBe(true);
    });

    it("should return false for different positions", () => {
      const pos1 = { x: 10, y: 20 };
      const pos2 = { x: 11, y: 20 };

      expect(positionsEqual(pos1, pos2)).toBe(false);
    });
  });

  describe("getDirectionToTarget", () => {
    it("should return RIGHT for target to the right", () => {
      const from = { x: 0, y: 0 };
      const to = { x: 5, y: 0 };

      expect(getDirectionToTarget(from, to)).toBe(Direction.RIGHT);
    });

    it("should return UP for target above", () => {
      const from = { x: 0, y: 5 };
      const to = { x: 0, y: 0 };

      expect(getDirectionToTarget(from, to)).toBe(Direction.UP);
    });

    it("should prioritize horizontal movement for diagonal targets", () => {
      const from = { x: 0, y: 0 };
      const to = { x: 3, y: 2 };

      expect(getDirectionToTarget(from, to)).toBe(Direction.RIGHT);
    });
  });
});
