/**
 * Test suite for pathfinding direction logic
 *
 * This file validates the getDirectionToTarget function to ensure
 * it correctly handles pixel-level movement in a grid-based game.
 */

import { Direction } from "../src/types";
import { getDirectionToTarget } from "../src/utils/position";

interface TestCase {
  name: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  expected: Direction;
  description: string;
}

const testCases: TestCase[] = [
  {
    name: "Test 1: Align smaller axis first (Y < X)",
    from: { x: 45, y: 68 },
    to: { x: 60, y: 60 },
    expected: Direction.UP,
    description: "Bot should move UP first to align Y axis (dy=-8 < dx=15)",
  },
  {
    name: "Test 2: Move along aligned axis",
    from: { x: 45, y: 60 },
    to: { x: 60, y: 60 },
    expected: Direction.RIGHT,
    description: "After Y is aligned, bot should move RIGHT along X axis",
  },
  {
    name: "Test 3: Stop when very close",
    from: { x: 58, y: 62 },
    to: { x: 60, y: 60 },
    expected: Direction.STOP,
    description: "Bot is within STOP threshold (2px), should stop",
  },
  {
    name: "Test 4: Stop when within threshold",
    from: { x: 59, y: 61 },
    to: { x: 60, y: 60 },
    expected: Direction.STOP,
    description: "Distance is 1px on both axes, should stop",
  },
  {
    name: "Test 5: Move when Y aligned but X not",
    from: { x: 57, y: 60 },
    to: { x: 60, y: 60 },
    expected: Direction.RIGHT,
    description: "Y is aligned (dy=0), should move RIGHT to align X (dx=3)",
  },
  {
    name: "Test 6: Move when X aligned but Y not",
    from: { x: 60, y: 57 },
    to: { x: 60, y: 60 },
    expected: Direction.DOWN,
    description: "X is aligned (dx=0), should move DOWN to align Y (dy=3)",
  },
  {
    name: "Test 7: Already at target",
    from: { x: 60, y: 60 },
    to: { x: 60, y: 60 },
    expected: Direction.STOP,
    description: "Bot is already at target position",
  },
  {
    name: "Test 8: Large distance - align Y first",
    from: { x: 20, y: 80 },
    to: { x: 100, y: 60 },
    expected: Direction.UP,
    description: "dy=-20 < dx=80, should prioritize aligning Y first",
  },
  {
    name: "Test 9: Large distance - align X first",
    from: { x: 80, y: 20 },
    to: { x: 60, y: 100 },
    expected: Direction.LEFT,
    description: "dx=-20 < dy=80, should prioritize aligning X first",
  },
  {
    name: "Test 10: Equal distance - default to Y axis",
    from: { x: 50, y: 50 },
    to: { x: 60, y: 60 },
    expected: Direction.DOWN,
    description: "dx=10, dy=10 (equal), should default to Y axis movement",
  },
];

/**
 * Run all test cases and report results
 */
function runTests(): void {
  console.log("=".repeat(60));
  console.log("🧪 PATHFINDING DIRECTION TEST SUITE");
  console.log("=".repeat(60));
  console.log("");

  let passed = 0;
  let failed = 0;

  testCases.forEach((test) => {
    const result = getDirectionToTarget(test.from, test.to);
    const success = result === test.expected;

    if (success) {
      passed++;
      console.log(`✅ ${test.name}`);
    } else {
      failed++;
      console.log(`❌ ${test.name}`);
      console.log(`   From: (${test.from.x}, ${test.from.y})`);
      console.log(`   To: (${test.to.x}, ${test.to.y})`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Got: ${result}`);
      console.log(`   Description: ${test.description}`);
    }
  });

  console.log("");
  console.log("=".repeat(60));
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * Detailed test with step-by-step movement simulation
 */
function runDetailedSimulation(): void {
  console.log("");
  console.log("=".repeat(60));
  console.log("🎮 MOVEMENT SIMULATION: Bot from (45, 68) to (60, 60)");
  console.log("=".repeat(60));
  console.log("");

  let currentPos = { x: 45, y: 68 };
  const target = { x: 60, y: 60 };
  const MOVE_STEP = 3; // pixels per step
  let steps = 0;
  const MAX_STEPS = 50;

  console.log(`Start: (${currentPos.x}, ${currentPos.y})`);
  console.log(`Target: (${target.x}, ${target.y})`);
  console.log("");

  while (steps < MAX_STEPS) {
    const direction = getDirectionToTarget(currentPos, target);

    if (direction === Direction.STOP) {
      console.log(`\n🎯 Reached target at (${currentPos.x}, ${currentPos.y}) in ${steps} steps!`);
      break;
    }

    // Simulate movement
    const oldPos = { ...currentPos };
    switch (direction) {
      case Direction.UP:
        currentPos.y -= MOVE_STEP;
        break;
      case Direction.DOWN:
        currentPos.y += MOVE_STEP;
        break;
      case Direction.LEFT:
        currentPos.x -= MOVE_STEP;
        break;
      case Direction.RIGHT:
        currentPos.x += MOVE_STEP;
        break;
    }

    steps++;
    const dx = target.x - currentPos.x;
    const dy = target.y - currentPos.y;
    console.log(
      `Step ${steps}: (${oldPos.x}, ${oldPos.y}) --${direction}--> (${currentPos.x}, ${currentPos.y}) [dx=${dx}, dy=${dy}]`
    );

    // Safety check
    if (
      Math.abs(currentPos.x - target.x) > 200 ||
      Math.abs(currentPos.y - target.y) > 200
    ) {
      console.log("\n❌ ERROR: Bot is moving away from target!");
      break;
    }
  }

  if (steps >= MAX_STEPS) {
    console.log("\n❌ ERROR: Failed to reach target within max steps!");
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
  runDetailedSimulation();
}

export { runTests, runDetailedSimulation, testCases };
