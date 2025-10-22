import {
  CELL_SIZE,
  MOVE_STEP_SIZE,
  pixelToCell,
  pixelToCellIndex,
  cellIndexToPixel,
  isWithinPixelBounds,
  isWithinCellBounds,
  getMapCellDimensions,
  createPositionKey,
  createCellIndexKey,
  parsePositionKey,
} from "../utils/coordinates";

describe("Coordinates System", () => {
  describe("Constants", () => {
    it("should have correct constants", () => {
      expect(CELL_SIZE).toBe(40);
      expect(MOVE_STEP_SIZE).toBe(1);
    });
  });

  describe("pixelToCell", () => {
    it("should convert pixel position to cell center", () => {
      expect(pixelToCell({ x: 35, y: 45 })).toEqual({ x: 40, y: 40 });
      expect(pixelToCell({ x: 85, y: 125 })).toEqual({ x: 80, y: 120 });
    });

    it("should handle exact cell centers", () => {
      expect(pixelToCell({ x: 80, y: 120 })).toEqual({ x: 80, y: 120 });
    });
  });

  describe("pixelToCellIndex", () => {
    it("should convert pixel position to cell indices", () => {
      expect(pixelToCellIndex({ x: 35, y: 45 })).toEqual({ x: 1, y: 1 });
      expect(pixelToCellIndex({ x: 85, y: 125 })).toEqual({ x: 2, y: 3 });
    });

    it("should handle origin", () => {
      expect(pixelToCellIndex({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    });
  });

  describe("cellIndexToPixel", () => {
    it("should convert cell indices to pixel centers", () => {
      expect(cellIndexToPixel({ x: 1, y: 1 })).toEqual({ x: 40, y: 40 });
      expect(cellIndexToPixel({ x: 2, y: 3 })).toEqual({ x: 80, y: 120 });
    });
  });

  describe("bounds checking", () => {
    const mapWidth = 800;
    const mapHeight = 600;

    describe("isWithinPixelBounds", () => {
      it("should correctly check pixel bounds", () => {
        expect(
          isWithinPixelBounds({ x: 400, y: 300 }, mapWidth, mapHeight)
        ).toBe(true);
        expect(isWithinPixelBounds({ x: 0, y: 0 }, mapWidth, mapHeight)).toBe(
          true
        );
        expect(
          isWithinPixelBounds({ x: 799, y: 599 }, mapWidth, mapHeight)
        ).toBe(true);
        expect(
          isWithinPixelBounds({ x: 800, y: 600 }, mapWidth, mapHeight)
        ).toBe(false);
        expect(isWithinPixelBounds({ x: -1, y: 0 }, mapWidth, mapHeight)).toBe(
          false
        );
      });
    });

    describe("isWithinCellBounds", () => {
      it("should correctly check cell index bounds", () => {
        const maxCellX = Math.floor(mapWidth / CELL_SIZE); // 20
        const maxCellY = Math.floor(mapHeight / CELL_SIZE); // 15

        expect(isWithinCellBounds({ x: 10, y: 7 }, mapWidth, mapHeight)).toBe(
          true
        );
        expect(isWithinCellBounds({ x: 0, y: 0 }, mapWidth, mapHeight)).toBe(
          true
        );
        expect(isWithinCellBounds({ x: 19, y: 14 }, mapWidth, mapHeight)).toBe(
          true
        );
        expect(isWithinCellBounds({ x: 20, y: 15 }, mapWidth, mapHeight)).toBe(
          false
        );
        expect(isWithinCellBounds({ x: -1, y: 0 }, mapWidth, mapHeight)).toBe(
          false
        );
      });
    });
  });

  describe("getMapCellDimensions", () => {
    it("should calculate correct cell dimensions", () => {
      expect(getMapCellDimensions(800, 600)).toEqual({ width: 20, height: 15 });
      expect(getMapCellDimensions(1200, 800)).toEqual({
        width: 30,
        height: 20,
      });
    });
  });

  describe("position keys", () => {
    it("should create and parse position keys", () => {
      const pos = { x: 35, y: 45 };
      const key = createPositionKey(pos);
      expect(key).toBe("40,40"); // Normalized to cell center

      const parsed = parsePositionKey(key);
      expect(parsed).toEqual({ x: 40, y: 40 });
    });

    it("should create cell index keys", () => {
      expect(createCellIndexKey({ x: 2, y: 3 })).toBe("2,3");
    });
  });
});
