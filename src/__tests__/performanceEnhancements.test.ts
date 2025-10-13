/**
 * Tests for Performance Enhancement utilities
 */

import {
  PositionPredictor,
  LatencyTracker,
  AdaptiveLoopManager,
  SmartLogger,
  CommandAckSystem,
  LoopPriority,
  LogCategory,
  LogLevel,
} from "../utils";
import { Direction } from "../types";

// Test data constants
const TEST_POSITION = { x: 5, y: 5 };
const MOVEMENT_DELAY_MS = 200;
const CONFIDENCE_DECAY_MS = 500;

describe("PositionPredictor", () => {
  describe("predictCurrentPosition", () => {
    it("should return same position when not moving", () => {
      const lastConfirmed = {
        ...TEST_POSITION,
        timestamp: Date.now(),
      };

      const result = PositionPredictor.predictCurrentPosition(
        lastConfirmed,
        null,
        1
      );

      expect(result).toMatchObject({
        x: TEST_POSITION.x,
        y: TEST_POSITION.y,
        confidence: 1.0,
      });
    });

    it("should predict position when moving right", () => {
      const lastConfirmed = {
        ...TEST_POSITION,
        timestamp: Date.now() - MOVEMENT_DELAY_MS,
      };

      const result = PositionPredictor.predictCurrentPosition(
        lastConfirmed,
        Direction.RIGHT,
        1
      );

      expect(result).toMatchObject({
        x: TEST_POSITION.x + 1,
        y: TEST_POSITION.y,
      });
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should decrease confidence over time", () => {
      const lastConfirmed = {
        ...TEST_POSITION,
        timestamp: Date.now() - CONFIDENCE_DECAY_MS,
      };

      const result = PositionPredictor.predictCurrentPosition(
        lastConfirmed,
        Direction.UP,
        1
      );

      expect(result.confidence).toBeLessThan(1.0);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe("predictNextPosition", () => {
    const testCases = [
      { direction: Direction.UP, expected: { x: 5, y: 2 } },    // -3 pixels
      { direction: Direction.DOWN, expected: { x: 5, y: 8 } },  // +3 pixels
      { direction: Direction.LEFT, expected: { x: 2, y: 5 } },  // -3 pixels
      { direction: Direction.RIGHT, expected: { x: 8, y: 5 } }, // +3 pixels
    ];

    testCases.forEach(({ direction, expected }) => {
      it(`should predict next position when moving ${direction}`, () => {
        const result = PositionPredictor.predictNextPosition(
          TEST_POSITION,
          direction
        );
        expect(result).toEqual(expected);
      });
    });

    it("should predict multiple steps", () => {
      const steps = 3;
      const result = PositionPredictor.predictNextPosition(
        TEST_POSITION,
        Direction.RIGHT,
        steps
      );

      expect(result).toEqual({
        x: TEST_POSITION.x + steps,
        y: TEST_POSITION.y,
      });
    });
  });

  describe("manhattanDistance", () => {
    it("should calculate correct distance", () => {
      const pos1 = { x: 1, y: 1 };
      const pos2 = { x: 4, y: 5 };

      const distance = PositionPredictor.manhattanDistance(pos1, pos2);

      expect(distance).toBe(7); // |4-1| + |5-1| = 3 + 4 = 7
    });
  });

  describe("needsCorrection", () => {
    const testCases = [
      {
        description: "should return true if distance > 2",
        predicted: { x: 5, y: 5 },
        confirmed: { x: 8, y: 8 },
        expected: true,
      },
      {
        description: "should return false if distance <= 2",
        predicted: { x: 5, y: 5 },
        confirmed: { x: 6, y: 6 },
        expected: false,
      },
    ];

    testCases.forEach(({ description, predicted, confirmed, expected }) => {
      it(description, () => {
        const result = PositionPredictor.needsCorrection(predicted, confirmed);
        expect(result).toBe(expected);
      });
    });
  });
});

describe("LatencyTracker", () => {
  let tracker: LatencyTracker;

  beforeEach(() => {
    tracker = new LatencyTracker();
  });

  afterEach(() => {
    tracker.stopTracking();
  });

  describe("latency measurements", () => {
    it("should return 0 latency when no measurements", () => {
      expect(tracker.getAverageLatency()).toBe(0);
      expect(tracker.getLatestLatency()).toBe(0);
    });

    it("should track latency measurements", () => {
      const measurements = [50, 60, 70];
      const expectedAverage = 60;

      measurements.forEach((latency) => {
        (tracker as any).addMeasurement(latency);
      });

      expect(tracker.getAverageLatency()).toBe(expectedAverage);
      expect(tracker.getLatestLatency()).toBe(
        measurements[measurements.length - 1]
      );
    });
  });

  describe("high latency detection", () => {
    it("should detect high latency", () => {
      const measurement = 250;
      (tracker as any).addMeasurement(measurement);

      expect(tracker.isHighLatency(200)).toBe(true);
      expect(tracker.isHighLatency(300)).toBe(false);
    });
  });

  describe("connection quality", () => {
    const qualityTestCases = [
      { latency: 30, expected: "excellent" },
      { latency: 80, expected: "good" },
      { latency: 150, expected: "fair" },
      { latency: 250, expected: "poor" },
    ];

    qualityTestCases.forEach(({ latency, expected }) => {
      it(`should return ${expected} quality for ${latency}ms latency`, () => {
        tracker.reset();
        (tracker as any).addMeasurement(latency);
        expect(tracker.getConnectionQuality()).toBe(expected);
      });
    });
  });
});

describe("AdaptiveLoopManager", () => {
  let manager: AdaptiveLoopManager;
  let callbackCount: number;

  beforeEach(() => {
    manager = new AdaptiveLoopManager();
    callbackCount = 0;
  });

  afterEach(() => {
    manager.stop();
  });

  it("should start and stop loop", () => {
    manager.start(() => {
      callbackCount++;
    }, LoopPriority.NORMAL);

    expect(manager.getIsRunning()).toBe(true);

    manager.stop();

    expect(manager.getIsRunning()).toBe(false);
  });

  it("should change priority", () => {
    manager.start(() => {
      callbackCount++;
    }, LoopPriority.NORMAL);

    expect(manager.getCurrentPriority()).toBe(LoopPriority.NORMAL);

    manager.setPriority(LoopPriority.HIGH);

    expect(manager.getCurrentPriority()).toBe(LoopPriority.HIGH);
  });

  it("should trigger emergency", (done) => {
    manager.start(() => {
      callbackCount++;
    }, LoopPriority.NORMAL);

    const initialCount = callbackCount;

    manager.triggerEmergency();

    setTimeout(() => {
      expect(callbackCount).toBeGreaterThan(initialCount);
      expect(manager.getCurrentPriority()).toBe(LoopPriority.EMERGENCY);
      done();
    }, 50);
  });

  it("should auto-adjust priority based on game state", () => {
    manager.start(() => {
      callbackCount++;
    }, LoopPriority.NORMAL);

    // Bombs nearby → EMERGENCY
    manager.autoAdjustPriority(true, false, false);
    expect(manager.getCurrentPriority()).toBe(LoopPriority.EMERGENCY);

    // Enemies nearby → HIGH
    manager.autoAdjustPriority(false, true, false);
    expect(manager.getCurrentPriority()).toBe(LoopPriority.HIGH);

    // Items nearby → NORMAL
    manager.autoAdjustPriority(false, false, true);
    expect(manager.getCurrentPriority()).toBe(LoopPriority.NORMAL);

    // Nothing nearby → LOW
    manager.autoAdjustPriority(false, false, false);
    expect(manager.getCurrentPriority()).toBe(LoopPriority.LOW);
  });
});

describe("SmartLogger", () => {
  let logger: SmartLogger;

  beforeEach(() => {
    logger = SmartLogger.getInstance();
    // Spy on console methods
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    logger.enableAll(); // Reset to default
  });

  it("should log in development mode", () => {
    logger.setDevelopmentMode(true);
    logger.info(LogCategory.GENERAL, "Test message");

    expect(console.log).toHaveBeenCalled();
  });

  it("should not log INFO in competition mode", () => {
    logger.setDevelopmentMode(false);
    logger.info(LogCategory.GENERAL, "Test message");

    expect(console.log).not.toHaveBeenCalled();
  });

  it("should always log ERROR", () => {
    logger.setDevelopmentMode(false);
    logger.error(LogCategory.GENERAL, "Error message");

    expect(console.error).toHaveBeenCalled();
  });

  it("should respect category filtering", () => {
    logger.enableAll();
    logger.setCategoryEnabled(LogCategory.MOVEMENT, false);

    logger.info(LogCategory.MOVEMENT, "Movement message");
    expect(console.log).not.toHaveBeenCalled();

    logger.info(LogCategory.AI, "AI message");
    expect(console.log).toHaveBeenCalled();
  });

  it("should disable all logging", () => {
    logger.disableAll();

    logger.info(LogCategory.GENERAL, "Info");
    logger.warn(LogCategory.GENERAL, "Warn");
    logger.error(LogCategory.GENERAL, "Error");

    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("CommandAckSystem", () => {
  let ackSystem: CommandAckSystem;
  let mockSocket: any;

  beforeEach(() => {
    ackSystem = new CommandAckSystem();
    mockSocket = {
      emit: jest.fn((event, data, callback) => {
        // Simulate server response after 50ms
        setTimeout(() => callback({ success: true }), 50);
      }),
    };
  });

  afterEach(() => {
    ackSystem.clear();
  });

  it("should track pending commands", () => {
    ackSystem.sendMove(mockSocket, Direction.UP);

    expect(ackSystem.getPendingCount()).toBe(1);
    expect(ackSystem.hasPending()).toBe(true);
  });

  it("should handle acknowledgement", (done) => {
    ackSystem.sendMove(mockSocket, Direction.RIGHT, (success, command) => {
      expect(success).toBe(true);
      expect(command.type).toBe("move");
      expect(ackSystem.getPendingCount()).toBe(0);
      done();
    });
  });

  it("should handle timeout", (done) => {
    ackSystem.setTimeout(100);

    // Mock socket that never responds
    const slowSocket = {
      emit: jest.fn(),
    };

    ackSystem.sendMove(slowSocket, Direction.LEFT, (success, command) => {
      expect(success).toBe(false);
      done();
    });
  }, 200);

  it("should get stats", () => {
    ackSystem.sendMove(mockSocket, Direction.UP);
    ackSystem.sendPlaceBomb(mockSocket);

    const stats = ackSystem.getStats();

    expect(stats.pending).toBe(2);
    expect(stats.types["move"]).toBe(1);
    expect(stats.types["place_bomb"]).toBe(1);
  });
});
