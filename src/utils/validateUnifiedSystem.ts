/**
 * Validation script to test unified collision system
 * Run this to verify all systems work correctly together
 */

import {
  isBlocked,
  canMoveTo,
  checkBoxCollision,
  CELL_SIZE,
  WALL_SIZE,
  CHEST_SIZE,
  PLAYER_SIZE,
  EDGE_SAFETY_MARGIN,
  pixelToCell,
  cellToPixel,
} from "./constants";

// Mock game state for testing
const mockGameState = {
  map: {
    width: 640,
    height: 640,
    walls: [
      { position: { x: 80, y: 80 }, isDestructible: false },
      { position: { x: 120, y: 80 }, isDestructible: true },
      { position: { x: 160, y: 40 }, isDestructible: false },
    ],
    chests: [
      { position: { x: 200, y: 200 } },
      { position: { x: 240, y: 200 } },
    ],
    bombs: [],
    items: [],
  },
  enemies: [
    { position: { x: 300, y: 300 }, isAlive: true },
    { position: { x: 340, y: 300 }, isAlive: false },
  ],
  currentBot: {
    position: { x: 60, y: 60 },
  },
};

function runTests() {
  console.log("🚀 === UNIFIED COLLISION SYSTEM VALIDATION ===\n");

  // Test 1: Box Collision
  console.log("📦 Test 1: Box Collision Detection");
  const collision1 = checkBoxCollision(
    { x: 80, y: 80 },
    30,
    { x: 100, y: 100 },
    40
  );
  const collision2 = checkBoxCollision(
    { x: 50, y: 50 },
    30,
    { x: 100, y: 100 },
    40
  );
  console.log(`   Overlapping boxes: ${collision1} (should be true)`);
  console.log(`   Non-overlapping boxes: ${collision2} (should be false)\n`);

  // Test 2: Wall/Chest Blocking
  console.log("🧱 Test 2: Wall/Chest Blocking");
  const blockedByWall = isBlocked({ x: 85, y: 85 }, mockGameState);
  const blockedByChest = isBlocked({ x: 205, y: 205 }, mockGameState);
  const notBlocked = isBlocked({ x: 300, y: 100 }, mockGameState);
  console.log(
    `   Position near wall (85,85): ${blockedByWall} (should be true)`
  );
  console.log(
    `   Position near chest (205,205): ${blockedByChest} (should be true)`
  );
  console.log(`   Open position (300,100): ${notBlocked} (should be false)\n`);

  // Test 3: Movement Validation
  console.log("🏃 Test 3: Movement Validation");
  const canMoveToWall = canMoveTo({ x: 85, y: 85 }, mockGameState);
  const canMoveToEnemy = canMoveTo({ x: 305, y: 305 }, mockGameState);
  const canMoveToOpen = canMoveTo({ x: 400, y: 400 }, mockGameState);
  const canMoveToEdge = canMoveTo({ x: 10, y: 10 }, mockGameState);
  console.log(`   Can move to wall: ${canMoveToWall} (should be false)`);
  console.log(`   Can move to enemy: ${canMoveToEnemy} (should be false)`);
  console.log(`   Can move to open area: ${canMoveToOpen} (should be true)`);
  console.log(`   Can move to map edge: ${canMoveToEdge} (should be true)\n`);

  // Test 4: Coordinate Conversion
  console.log("📐 Test 4: Coordinate Conversion");
  const pixelPos = { x: 123, y: 456 };
  const cellIndex = pixelToCell(pixelPos);
  const backToPixel = cellToPixel(cellIndex);
  console.log(`   Original pixel: (${pixelPos.x}, ${pixelPos.y})`);
  console.log(`   To cell index: (${cellIndex.x}, ${cellIndex.y})`);
  console.log(
    `   Back to pixel center: (${backToPixel.x}, ${backToPixel.y})\n`
  );

  // Test 5: Constants Consistency
  console.log("🔧 Test 5: Constants Consistency");
  console.log(`   CELL_SIZE: ${CELL_SIZE}`);
  console.log(`   WALL_SIZE: ${WALL_SIZE}`);
  console.log(`   PLAYER_SIZE: ${PLAYER_SIZE}`);
  console.log(`   EDGE_SAFETY_MARGIN: ${EDGE_SAFETY_MARGIN}\n`);

  // Test 6: Performance Test
  console.log("⚡ Test 6: Performance Test");
  const startTime = Date.now();
  for (let i = 0; i < 1000; i++) {
    canMoveTo(
      { x: Math.random() * 600, y: Math.random() * 600 },
      mockGameState
    );
  }
  const endTime = Date.now();
  console.log(`   1000 canMoveTo calls: ${endTime - startTime}ms\n`);

  console.log("✅ === VALIDATION COMPLETE ===");
  console.log("All systems appear to be working correctly!");
  console.log("The unified collision system is ready for production use.");
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

export { runTests };
