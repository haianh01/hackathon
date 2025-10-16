import { Pathfinding } from "./src/utils/pathfinding";
import { GameState } from "./src/types";

/**
 * Giả lập pathfinding khi BOT ở (40, 40) đặt bom ở (80, 40)
 * Map layout:
 *       x=0   x=40  x=80  x=120 x=160 x=200 x=240 x=280 x=320
 *  y=0   [#]  [#]  [#]   [#]   [#]   [#]   [#]   [#]   [#]
 *  y=40  [#] [BOT] [ ]   [C1]  [#]   [ ]   [W]   [ ]   [#]
 *  y=80  [#]  [ ]  [#]   [ ]   [#]   [C2]  [#]   [ ]   [#]
 *  y=120 [#]  [C3] [ ]   [#]   [ ]   [ ]   [#]   [ ]   [#]
 *  y=160 [#]  [#]  [#]   [#]   [#]   [ ]   [#]   [ ]   [#]
 *  y=200 [#]  [ ]  [W]   [ ]   [ ]   [E1]  [ ]   [C4]  [#]
 *  y=240 [#]  [ ]  [#]   [ ]   [#]   [ ]   [#]   [ ]   [#]
 *  y=280 [#]  [ ]  [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [#]
 *  y=320 [#]  [#]  [#]   [#]   [#]   [#]   [#]   [#]   [#]
 */

// Tạo mock game state
const createMockGameState = (): GameState => {
  const state: GameState = {
    currentBot: {
      id: "bot1",
      position: { x: 40, y: 40 }, // BOT at (40, 40)
      speed: 1,
      flameRange: 2,
      bombCount: 1,
      isAlive: true,
      score: 0,
      name: "TestBot",
    },
    enemies: [
      {
        id: "enemy1",
        position: { x: 200, y: 200 }, // E1
        speed: 1,
        flameRange: 2,
        bombCount: 1,
        isAlive: true,
        score: 0,
        name: "Enemy1",
      },
    ],
    map: {
      width: 360, // 9 cells * 40
      height: 360, // 9 cells * 40
      walls: [
        // Border walls (top row)
        { position: { x: 0, y: 0 }, isDestructible: false },
        { position: { x: 40, y: 0 }, isDestructible: false },
        { position: { x: 80, y: 0 }, isDestructible: false },
        { position: { x: 120, y: 0 }, isDestructible: false },
        { position: { x: 160, y: 0 }, isDestructible: false },
        { position: { x: 200, y: 0 }, isDestructible: false },
        { position: { x: 240, y: 0 }, isDestructible: false },
        { position: { x: 280, y: 0 }, isDestructible: false },
        { position: { x: 320, y: 0 }, isDestructible: false },

        // Border walls (left column)
        { position: { x: 0, y: 40 }, isDestructible: false },
        { position: { x: 0, y: 80 }, isDestructible: false },
        { position: { x: 0, y: 120 }, isDestructible: false },
        { position: { x: 0, y: 160 }, isDestructible: false },
        { position: { x: 0, y: 200 }, isDestructible: false },
        { position: { x: 0, y: 240 }, isDestructible: false },
        { position: { x: 0, y: 280 }, isDestructible: false },
        { position: { x: 0, y: 320 }, isDestructible: false },

        // Border walls (right column)
        { position: { x: 320, y: 40 }, isDestructible: false },
        { position: { x: 320, y: 80 }, isDestructible: false },
        { position: { x: 320, y: 120 }, isDestructible: false },
        { position: { x: 320, y: 160 }, isDestructible: false },
        { position: { x: 320, y: 200 }, isDestructible: false },
        { position: { x: 320, y: 240 }, isDestructible: false },
        { position: { x: 320, y: 280 }, isDestructible: false },
        { position: { x: 320, y: 320 }, isDestructible: false },

        // Border walls (bottom row)
        { position: { x: 40, y: 320 }, isDestructible: false },
        { position: { x: 80, y: 320 }, isDestructible: false },
        { position: { x: 120, y: 320 }, isDestructible: false },
        { position: { x: 160, y: 320 }, isDestructible: false },
        { position: { x: 200, y: 320 }, isDestructible: false },
        { position: { x: 240, y: 320 }, isDestructible: false },
        { position: { x: 280, y: 320 }, isDestructible: false },

        // Internal walls
        { position: { x: 160, y: 40 }, isDestructible: false },
        { position: { x: 240, y: 40 }, isDestructible: true }, // W at (240, 40)
        { position: { x: 80, y: 80 }, isDestructible: false },
        { position: { x: 160, y: 80 }, isDestructible: false },
        { position: { x: 240, y: 80 }, isDestructible: false },
        { position: { x: 120, y: 120 }, isDestructible: false },
        { position: { x: 240, y: 120 }, isDestructible: false },
        { position: { x: 40, y: 160 }, isDestructible: false },
        { position: { x: 80, y: 160 }, isDestructible: false },
        { position: { x: 120, y: 160 }, isDestructible: false },
        { position: { x: 160, y: 160 }, isDestructible: false },
        { position: { x: 240, y: 160 }, isDestructible: false },
        { position: { x: 80, y: 200 }, isDestructible: true }, // W at (80, 200)
        { position: { x: 80, y: 240 }, isDestructible: false },
        { position: { x: 160, y: 240 }, isDestructible: false },
        { position: { x: 240, y: 240 }, isDestructible: false },
      ],
      chests: [
        { position: { x: 120, y: 40 }, isDestructible: true }, // C1
        { position: { x: 200, y: 80 }, isDestructible: true }, // C2
        { position: { x: 40, y: 120 }, isDestructible: true }, // C3
        { position: { x: 280, y: 200 }, isDestructible: true }, // C4
      ],
      items: [],
      bombs: [
        // Bom được đặt tại (80, 40)
        {
          id: "bomb1",
          position: { x: 80, y: 40 },
          flameRange: 2,
          timeRemaining: 3000,
          ownerId: "bot1",
        },
      ],
      bots: [],
    },
    timeRemaining: 300000,
    round: 1,
  };

  return state;
};

// Test 1: Tìm đường từ (40, 40) đến (40, 80) với bom tại (80, 40)
function test1_PathWithBomb() {
  console.log("\n=== TEST 1: Pathfinding với bom tại (80, 40) ===");
  console.log("Start: BOT tại (40, 40)");
  console.log("Goal: Di chuyển đến (40, 80)");
  console.log("Bomb: Tại (80, 40) với range=2, time=3000ms\n");

  const gameState = createMockGameState();
  const startPos = { x: 40, y: 40 };
  const goalPos = { x: 40, y: 80 };

  console.log("🔍 Gọi Pathfinding.findPath()...");
  const path = Pathfinding.findPath(startPos, goalPos, gameState);

  console.log("\n📍 Kết quả path:");
  if (path.length === 0) {
    console.log("❌ KHÔNG TÌM THẤY ĐƯỜNG!");
  } else {
    console.log(`✅ Tìm thấy đường với ${path.length} bước:`);
    path.forEach((pos, idx) => {
      console.log(`   Step ${idx + 1}: (${pos.x}, ${pos.y})`);
    });
  }
}

// Test 2: Tìm đường với allowOwnBomb option
function test2_PathWithAllowOwnBomb() {
  console.log("\n=== TEST 2: Pathfinding với allowOwnBomb ===");
  console.log("Start: BOT tại (40, 40)");
  console.log("Goal: Di chuyển đến (120, 80)");
  console.log("Bomb: Tại (80, 40), nhưng cho phép đi qua (allowOwnBomb)\n");

  const gameState = createMockGameState();
  const startPos = { x: 40, y: 40 };
  const goalPos = { x: 120, y: 80 };
  const bombPos = { x: 80, y: 40 };

  console.log("🔍 Gọi Pathfinding.findPath() với allowOwnBomb...");
  const path = Pathfinding.findPath(startPos, goalPos, gameState, {
    allowOwnBomb: bombPos,
  });

  console.log("\n📍 Kết quả path:");
  if (path.length === 0) {
    console.log("❌ KHÔNG TÌM THẤY ĐƯỜNG!");
  } else {
    console.log(`✅ Tìm thấy đường với ${path.length} bước:`);
    path.forEach((pos, idx) => {
      console.log(`   Step ${idx + 1}: (${pos.x}, ${pos.y})`);
    });
  }
}

// Test 3: Tìm đường với ignoreBombs option
function test3_PathWithIgnoreBombs() {
  console.log("\n=== TEST 3: Pathfinding với ignoreBombs ===");
  console.log("Start: BOT tại (40, 40)");
  console.log("Goal: Di chuyển đến (120, 80)");
  console.log("Bomb: Tại (80, 40), nhưng bỏ qua tất cả bombs (ignoreBombs)\n");

  const gameState = createMockGameState();
  const startPos = { x: 40, y: 40 };
  const goalPos = { x: 120, y: 80 };

  console.log("🔍 Gọi Pathfinding.findPath() với ignoreBombs...");
  const path = Pathfinding.findPath(startPos, goalPos, gameState, {
    ignoreBombs: true,
  });

  console.log("\n📍 Kết quả path:");
  if (path.length === 0) {
    console.log("❌ KHÔNG TÌM THẤY ĐƯỜNG!");
  } else {
    console.log(`✅ Tìm thấy đường với ${path.length} bước:`);
    path.forEach((pos, idx) => {
      console.log(`   Step ${idx + 1}: (${pos.x}, ${pos.y})`);
    });
  }
}

// Test 4: Tìm đường vòng tránh bom
function test4_PathAroundBomb() {
  console.log("\n=== TEST 4: Tìm đường vòng tránh bom ===");
  console.log("Start: BOT tại (40, 40)");
  console.log("Goal: Di chuyển đến (120, 120)");
  console.log("Bomb: Tại (80, 40), phải đi vòng tránh\n");

  const gameState = createMockGameState();
  const startPos = { x: 40, y: 40 };
  const goalPos = { x: 120, y: 120 };

  console.log("🔍 Gọi Pathfinding.findPath()...");
  const path = Pathfinding.findPath(startPos, goalPos, gameState);

  console.log("\n📍 Kết quả path:");
  if (path.length === 0) {
    console.log("❌ KHÔNG TÌM THẤY ĐƯỜNG!");
  } else {
    console.log(`✅ Tìm thấy đường với ${path.length} bước:`);
    path.forEach((pos, idx) => {
      console.log(`   Step ${idx + 1}: (${pos.x}, ${pos.y})`);
    });
  }
}

// Chạy tất cả tests
console.log("🚀 BẮT ĐẦU SIMULATION PATHFINDING");
console.log("=".repeat(60));

test1_PathWithBomb();
test2_PathWithAllowOwnBomb();
test3_PathWithIgnoreBombs();
test4_PathAroundBomb();

console.log("\n" + "=".repeat(60));
console.log("✅ HOÀN THÀNH TẤT CẢ TESTS");
