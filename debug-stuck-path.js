/**
 * Debug script to analyze stuck path issue
 * Run: node debug-stuck-path.js
 */

// Simulated data from your log
const botPosition = { x: 565, y: 548 };
const targetWaypoint = { x: 540, y: 580 };
const path = [
  { x: 565, y: 548 },  // Start position (waypoint 1)
  { x: 540, y: 580 }   // Target position (waypoint 2)
];

const CELL_SIZE = 40;
const PLAYER_SIZE = 35;
const PLAYER_HALF_SIZE = 17;

// Helper functions
function pixelToCellIndex(pos) {
  return {
    x: Math.floor((pos.x + PLAYER_HALF_SIZE) / CELL_SIZE),
    y: Math.floor((pos.y + PLAYER_HALF_SIZE) / CELL_SIZE)
  };
}

function getDistance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getDirectionToTarget(botPos, targetPos) {
  const botCenter = {
    x: botPos.x + PLAYER_HALF_SIZE,
    y: botPos.y + PLAYER_HALF_SIZE
  };
  const dx = targetPos.x - botCenter.x;
  const dy = targetPos.y - botCenter.y;

  console.log(`   dx: ${dx.toFixed(1)}, dy: ${dy.toFixed(1)}`);

  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
    return 'STOP';
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'RIGHT' : 'LEFT';
  } else {
    return dy > 0 ? 'DOWN' : 'UP';
  }
}

// Analysis
console.log('='.repeat(60));
console.log('🔍 PATH STUCK ANALYSIS');
console.log('='.repeat(60));

console.log('\n📍 Current State:');
console.log(`Bot position (top-left): (${botPosition.x}, ${botPosition.y})`);
console.log(`Bot cell: (${pixelToCellIndex(botPosition).x}, ${pixelToCellIndex(botPosition).y})`);
console.log(`Target waypoint: (${targetWaypoint.x}, ${targetWaypoint.y})`);
console.log(`Target cell: (${pixelToCellIndex(targetWaypoint).x}, ${pixelToCellIndex(targetWaypoint).y})`);

console.log('\n📏 Distance Calculation:');
const distance = getDistance(botPosition, targetWaypoint);
console.log(`Distance: ${distance.toFixed(2)}px`);

console.log('\n🧭 Direction Calculation:');
const direction = getDirectionToTarget(botPosition, targetWaypoint);
console.log(`Direction: ${direction}`);

console.log('\n🛤️ Path Analysis:');
console.log(`Path length: ${path.length} waypoints`);
console.log('Path cells:');
path.forEach((waypoint, i) => {
  const cell = pixelToCellIndex(waypoint);
  console.log(`  ${i + 1}. Cell (${cell.x}, ${cell.y}) → Pixel (${waypoint.x}, ${waypoint.y})`);
});

console.log('\n⚠️ PROBLEM DETECTION:');

// Check 1: Path is too short
if (path.length <= 2) {
  console.log('❌ Path too short (only 2 waypoints)');
  console.log('   → Missing intermediate waypoints');
}

// Check 2: Waypoints are not adjacent
const cell1 = pixelToCellIndex(path[0]);
const cell2 = pixelToCellIndex(path[1]);
const cellDx = Math.abs(cell2.x - cell1.x);
const cellDy = Math.abs(cell2.y - cell1.y);
const manhattan = cellDx + cellDy;

console.log(`Cell distance: dx=${cellDx}, dy=${cellDy}, manhattan=${manhattan}`);

if (manhattan > 1) {
  console.log('❌ Waypoints are NOT adjacent cells');
  console.log(`   → Need ${manhattan} intermediate waypoints`);
  console.log('   → Bot will try to move diagonally or turn prematurely');
}

// Check 3: Direction requires multiple steps
const pixelDx = Math.abs(targetWaypoint.x - botPosition.x);
const pixelDy = Math.abs(targetWaypoint.y - botPosition.y);

if (pixelDx > CELL_SIZE || pixelDy > CELL_SIZE) {
  console.log('❌ Target requires multi-cell movement');
  console.log(`   Pixel distance: dx=${pixelDx}px, dy=${pixelDy}px`);
  console.log(`   Cells to move: dx=${(pixelDx / CELL_SIZE).toFixed(1)}, dy=${(pixelDy / CELL_SIZE).toFixed(1)}`);
}

// Check 4: Simulate movement
console.log('\n🎮 MOVEMENT SIMULATION:');
console.log('Step-by-step what bot will do:');

let simPos = { ...botPosition };
let step = 1;

console.log(`Start: (${simPos.x}, ${simPos.y}), Cell (${pixelToCellIndex(simPos).x}, ${pixelToCellIndex(simPos).y})`);

// Simulate first 5 steps
for (let i = 0; i < 5; i++) {
  const dir = getDirectionToTarget(simPos, targetWaypoint);
  console.log(`Step ${step}: Move ${dir}`);

  // Update position based on direction
  switch(dir) {
    case 'UP': simPos.y -= 1; break;
    case 'DOWN': simPos.y += 1; break;
    case 'LEFT': simPos.x -= 1; break;
    case 'RIGHT': simPos.x += 1; break;
  }

  const cell = pixelToCellIndex(simPos);
  console.log(`   → Pos: (${simPos.x}, ${simPos.y}), Cell (${cell.x}, ${cell.y})`);

  // Check if direction changed
  const nextDir = getDirectionToTarget(simPos, targetWaypoint);
  if (nextDir !== dir && nextDir !== 'STOP') {
    console.log(`   ⚠️ DIRECTION CHANGE: ${dir} → ${nextDir}`);
    console.log(`   ⚠️ This is where collision might happen!`);
  }

  step++;
}

console.log('\n💡 SOLUTION:');
console.log('The path should have intermediate waypoints:');

// Calculate proper intermediate waypoints
const startCell = pixelToCellIndex(botPosition);
const endCell = pixelToCellIndex(targetWaypoint);

console.log(`From cell (${startCell.x}, ${startCell.y}) to (${endCell.x}, ${endCell.y})`);

// Generate proper path cell by cell
const properPath = [];
let currentCell = { ...startCell };

// Move horizontally first, then vertically (or vice versa)
while (currentCell.x !== endCell.x || currentCell.y !== endCell.y) {
  properPath.push({ ...currentCell });

  if (currentCell.x < endCell.x) currentCell.x++;
  else if (currentCell.x > endCell.x) currentCell.x--;
  else if (currentCell.y < endCell.y) currentCell.y++;
  else if (currentCell.y > endCell.y) currentCell.y--;
}
properPath.push({ ...endCell });

console.log('✅ Proper path (cell-by-cell):');
properPath.forEach((cell, i) => {
  const pixelCenter = {
    x: cell.x * CELL_SIZE + CELL_SIZE / 2,
    y: cell.y * CELL_SIZE + CELL_SIZE / 2
  };
  console.log(`  ${i + 1}. Cell (${cell.x}, ${cell.y}) → Pixel (${pixelCenter.x}, ${pixelCenter.y})`);
});

console.log('\n📋 RECOMMENDATIONS:');
console.log('1. Fix pathfinding to return ADJACENT waypoints only');
console.log('2. Each waypoint should be exactly 1 cell away from previous');
console.log('3. Avoid diagonal movements (move horizontal OR vertical, not both)');
console.log('4. Don\'t use lookahead blending for emergency escapes');
console.log('5. Check collision BEFORE changing direction');

console.log('\n' + '='.repeat(60));
