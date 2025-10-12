import { MinHeap } from "../utils/minHeap";

describe("MinHeap", () => {
  let heap: MinHeap<string>;

  beforeEach(() => {
    heap = new MinHeap<string>();
  });

  describe("basic operations", () => {
    it("should start empty", () => {
      expect(heap.isEmpty()).toBe(true);
      expect(heap.size()).toBe(0);
      expect(heap.peek()).toBe(null);
      expect(heap.peekPriority()).toBe(Infinity);
    });

    it("should insert and maintain min-heap property", () => {
      heap.insert("c", 3);
      heap.insert("a", 1);
      heap.insert("b", 2);

      expect(heap.size()).toBe(3);
      expect(heap.isEmpty()).toBe(false);
      expect(heap.peek()).toBe("a");
      expect(heap.peekPriority()).toBe(1);
    });

    it("should extract minimum elements in order", () => {
      heap.insert("d", 4);
      heap.insert("b", 2);
      heap.insert("a", 1);
      heap.insert("c", 3);

      expect(heap.extractMin()).toBe("a");
      expect(heap.extractMin()).toBe("b");
      expect(heap.extractMin()).toBe("c");
      expect(heap.extractMin()).toBe("d");
      expect(heap.extractMin()).toBe(null);
    });
  });

  describe("edge cases", () => {
    it("should handle single element", () => {
      heap.insert("single", 5);
      expect(heap.peek()).toBe("single");
      expect(heap.extractMin()).toBe("single");
      expect(heap.isEmpty()).toBe(true);
    });

    it("should handle duplicate priorities", () => {
      heap.insert("first", 1);
      heap.insert("second", 1);
      heap.insert("third", 1);

      const first = heap.extractMin();
      const second = heap.extractMin();
      const third = heap.extractMin();

      expect([first, second, third]).toContain("first");
      expect([first, second, third]).toContain("second");
      expect([first, second, third]).toContain("third");
    });
  });

  describe("contains and updatePriority", () => {
    it("should check if item exists", () => {
      heap.insert("a", 1);
      heap.insert("b", 2);

      expect(heap.contains("a")).toBe(true);
      expect(heap.contains("b")).toBe(true);
      expect(heap.contains("c")).toBe(false);
    });

    it("should update priority correctly", () => {
      heap.insert("a", 5);
      heap.insert("b", 3);
      heap.insert("c", 4);

      expect(heap.peek()).toBe("b");

      // Update 'a' to have lower priority
      heap.updatePriority("a", 1);
      expect(heap.peek()).toBe("a");

      // Update 'c' to have higher priority
      heap.updatePriority("c", 10);
      heap.extractMin(); // Remove 'a'
      expect(heap.peek()).toBe("b"); // 'b' should still be next
    });
  });

  describe("complex scenarios", () => {
    it("should handle pathfinding-like scenario", () => {
      // Simulate A* pathfinding priority queue
      const positions = [
        { id: "start", fScore: 10 },
        { id: "goal", fScore: 0 },
        { id: "mid1", fScore: 5 },
        { id: "mid2", fScore: 8 },
        { id: "mid3", fScore: 3 },
      ];

      positions.forEach((pos) => heap.insert(pos.id, pos.fScore));

      // Should extract in order of f-score
      expect(heap.extractMin()).toBe("goal"); // fScore: 0
      expect(heap.extractMin()).toBe("mid3"); // fScore: 3
      expect(heap.extractMin()).toBe("mid1"); // fScore: 5
      expect(heap.extractMin()).toBe("mid2"); // fScore: 8
      expect(heap.extractMin()).toBe("start"); // fScore: 10
    });

    it("should handle large number of items", () => {
      const items = [];
      for (let i = 100; i >= 1; i--) {
        heap.insert(`item${i}`, i);
        items.push(`item${i}`);
      }

      expect(heap.size()).toBe(100);

      // Extract all and verify order
      for (let i = 1; i <= 100; i++) {
        expect(heap.extractMin()).toBe(`item${i}`);
      }

      expect(heap.isEmpty()).toBe(true);
    });
  });

  describe("utility methods", () => {
    it("should clear all items", () => {
      heap.insert("a", 1);
      heap.insert("b", 2);
      heap.insert("c", 3);

      heap.clear();
      expect(heap.isEmpty()).toBe(true);
      expect(heap.size()).toBe(0);
    });

    it("should get all items", () => {
      heap.insert("a", 1);
      heap.insert("b", 2);
      heap.insert("c", 3);

      const items = heap.getAllItems();
      expect(items).toHaveLength(3);
      expect(items).toContain("a");
      expect(items).toContain("b");
      expect(items).toContain("c");
    });
  });
});
