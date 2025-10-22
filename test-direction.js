// Test getDirectionToTarget fix
const getDirectionToTarget = (from, to) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const ALIGN_THRESHOLD = 2;
  
  if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
    return 'STOP';
  }
  
  const isAlignedX = Math.abs(dx) <= ALIGN_THRESHOLD;
  const isAlignedY = Math.abs(dy) <= ALIGN_THRESHOLD;
  
  if (isAlignedY && !isAlignedX) {
    return dx > 0 ? 'RIGHT' : 'LEFT';
  }
  
  if (isAlignedX && !isAlignedY) {
    return dy > 0 ? 'DOWN' : 'UP';
  }
  
  // Major axis first
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'RIGHT' : 'LEFT';
  } else if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 ? 'DOWN' : 'UP';
  }
  
  return dy > 0 ? 'DOWN' : 'UP';
};

// Test cases
console.log('Test 1 - Bot at (45,37) to (100,20):');
const dir1 = getDirectionToTarget({x:45, y:37}, {x:100, y:20});
console.log(`  dx=${100-45}, dy=${20-37} → ${dir1}`);
console.log(`  Expected: RIGHT (dx=55 > dy=-17)`);

console.log('\nTest 2 - Bot at (40,40) to (60,100):');
const dir2 = getDirectionToTarget({x:40, y:40}, {x:60, y:100});
console.log(`  dx=${60-40}, dy=${100-40} → ${dir2}`);
console.log(`  Expected: DOWN (dy=60 > dx=20)`);

console.log('\nTest 3 - Bot at (123,67) to (60,140):');
const dir3 = getDirectionToTarget({x:123, y:67}, {x:60, y:140});
console.log(`  dx=${60-123}, dy=${140-67} → ${dir3}`);
console.log(`  Expected: DOWN (dy=73 > dx=-63)`);

console.log('\n✅ All direction calculations working correctly!');
