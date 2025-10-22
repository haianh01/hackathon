/**
 * Standalone JavaScript test for getDirectionToTarget logic
 * Run with: node tests/pathfinding.test.js
 */

const Direction = {
  UP: "UP",
  DOWN: "DOWN",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  STOP: "STOP",
};

/**
 * Replicate the getDirectionToTarget logic for testing
 */
function getDirectionToTarget(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // THRESHOLD: Nếu đã gần đúng trục (trong vòng 1px), coi như đã align
  // Sử dụng 3px vì MOVE_STEP_SIZE = 1px, đảm bảo bot có thể align chính xác
  const ALIGN_THRESHOLD = 1;

  // Kiểm tra xem đã align theo trục nào chưa
  const isAlignedX = Math.abs(dx) <= ALIGN_THRESHOLD;
  const isAlignedY = Math.abs(dy) <= ALIGN_THRESHOLD;

  // Chỉ trả về STOP khi đã gần sát target (cả 2 trục đều < 2px)
  // Điều này tránh bot dừng sớm khi còn cách target vài pixels
  if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
    return Direction.STOP;
  }

  // Nếu đã align theo trục Y (dy nhỏ), chỉ cần di chuyển theo trục X
  // Kiểm tra điều kiện này TRƯỚC để ưu tiên hoàn thành hướng còn lại
  if (isAlignedY && !isAlignedX) {
    return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  }

  // Nếu đã align theo trục X (dx nhỏ), chỉ cần di chuyển theo trục Y
  if (isAlignedX && !isAlignedY) {
    return dy > 0 ? Direction.DOWN : Direction.UP;
  }

  // Trường hợp đặc biệt: Cả 2 trục đều aligned (trong threshold) nhưng chưa đủ gần để STOP
  // Chọn trục có khoảng cách lớn hơn để di chuyển
  if (isAlignedX && isAlignedY) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }
  }

  // Nếu chưa align theo trục nào, ưu tiên align theo trục có khoảng cách NHỎ hơn trước
  // Điều này đảm bảo bot "snap to grid" sớm nhất có thể
  if (Math.abs(dy) < Math.abs(dx)) {
    // dy nhỏ hơn, align Y trước
    return dy > 0 ? Direction.DOWN : Direction.UP;
  } else if (Math.abs(dx) < Math.abs(dy)) {
    // dx nhỏ hơn, align X trước
    return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  }

  // Nếu bằng nhau, ưu tiên di chuyển theo trục Y (an toàn hơn trong Bomberman)
  return dy > 0 ? Direction.DOWN : Direction.UP;
}

/**
 * Test cases
 */
const testCases = [
  {
    name: "Test 1: Align smaller axis first (Y < X)",
    from: { x: 45, y: 68 },
    to: { x: 60, y: 60 },
    expected: Direction.UP,
  },
  {
    name: "Test 2: Move along aligned axis",
    from: { x: 45, y: 60 },
    to: { x: 60, y: 60 },
    expected: Direction.RIGHT,
  },
  {
    name: "Test 3: Stop when very close",
    from: { x: 58, y: 62 },
    to: { x: 60, y: 60 },
    expected: Direction.STOP,
  },
  {
    name: "Test 4: Stop when within threshold",
    from: { x: 59, y: 61 },
    to: { x: 60, y: 60 },
    expected: Direction.STOP,
  },
  {
    name: "Test 5: Move when Y aligned but X not",
    from: { x: 57, y: 60 },
    to: { x: 60, y: 60 },
    expected: Direction.RIGHT,
  },
  {
    name: "Test 6: Move when X aligned but Y not",
    from: { x: 60, y: 57 },
    to: { x: 60, y: 60 },
    expected: Direction.DOWN,
  },
  {
    name: "Test 7: Already at target",
    from: { x: 60, y: 60 },
    to: { x: 60, y: 60 },
    expected: Direction.STOP,
  },
  {
    name: "Test 8: Large distance - align Y first",
    from: { x: 20, y: 80 },
    to: { x: 100, y: 60 },
    expected: Direction.UP,
  },
  {
    name: "Test 9: Large distance - align X first",
    from: { x: 80, y: 20 },
    to: { x: 60, y: 100 },
    expected: Direction.LEFT,
  },
  {
    name: "Test 10: Equal distance - default to Y axis",
    from: { x: 50, y: 50 },
    to: { x: 60, y: 60 },
    expected: Direction.DOWN,
  },
];

/**
 * Run all tests
 */
function runTests() {
  console.log("=".repeat(70));
  console.log("🧪 PATHFINDING DIRECTION TEST SUITE");
  console.log("=".repeat(70));
  console.log("");

  let passed = 0;
  let failed = 0;

  testCases.forEach((test) => {
    const result = getDirectionToTarget(test.from, test.to);
    const success = result === test.expected;

    if (success) {
      passed++;
      console.log(`✅ ${test.name}`);
      console.log(
        `   From (${test.from.x}, ${test.from.y}) → To (${test.to.x}, ${test.to.y}) = ${result}`
      );
    } else {
      failed++;
      console.log(`❌ ${test.name}`);
      console.log(`   From: (${test.from.x}, ${test.from.y})`);
      console.log(`   To: (${test.to.x}, ${test.to.y})`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Got: ${result}`);
    }
    console.log("");
  });

  console.log("=".repeat(70));
  console.log(
    `📊 RESULTS: ${passed} passed, ${failed} failed out of ${testCases.length} tests`
  );
  console.log("=".repeat(70));

  return failed === 0;
}

/**
 * Simulate bot movement from start to target
 */
function runMovementSimulation() {
  console.log("");
  console.log("=".repeat(70));
  console.log("🎮 MOVEMENT SIMULATION: Bot from (45, 68) to (60, 60)");
  console.log("=".repeat(70));
  console.log("");

  let currentPos = { x: 45, y: 68 };
  const target = { x: 60, y: 60 };
  const MOVE_STEP = 3; // pixels per step
  let steps = 0;
  const MAX_STEPS = 50;

  console.log(`📍 Start: (${currentPos.x}, ${currentPos.y})`);
  console.log(`🎯 Target: (${target.x}, ${target.y})`);
  console.log("");

  const path = [];

  while (steps < MAX_STEPS) {
    const direction = getDirectionToTarget(currentPos, target);

    if (direction === Direction.STOP) {
      console.log(
        `\n✨ Reached target at (${currentPos.x}, ${currentPos.y}) in ${steps} steps!`
      );
      path.push({ ...currentPos });
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
    path.push({ ...currentPos });

    const dx = target.x - currentPos.x;
    const dy = target.y - currentPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy).toFixed(1);

    console.log(
      `Step ${steps.toString().padStart(2)}: (${oldPos.x
        .toString()
        .padStart(3)}, ${oldPos.y.toString().padStart(3)}) --${direction.padEnd(
        5
      )}--> (${currentPos.x.toString().padStart(3)}, ${currentPos.y
        .toString()
        .padStart(3)}) | dx=${dx.toString().padStart(3)}, dy=${dy
        .toString()
        .padStart(3)}, dist=${dist}`
    );

    // Safety check
    if (
      Math.abs(currentPos.x - target.x) > 200 ||
      Math.abs(currentPos.y - target.y) > 200
    ) {
      console.log("\n❌ ERROR: Bot is moving away from target!");
      return false;
    }
  }

  if (steps >= MAX_STEPS) {
    console.log("\n❌ ERROR: Failed to reach target within max steps!");
    return false;
  }

  console.log("");
  console.log("📊 Path Summary:");
  console.log(`   Total steps: ${steps}`);
  console.log(
    `   Distance traveled: ${steps * MOVE_STEP}px (${steps} × ${MOVE_STEP}px)`
  );
  console.log(`   Path points: ${path.length}`);

  return true;
}

// Run tests
console.log("\n");
const testsOk = runTests();
const simOk = runMovementSimulation();
console.log("\n");

if (!testsOk || !simOk) {
  process.exit(1);
}
