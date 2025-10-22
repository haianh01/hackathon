# Pathfinding Tests

Test suite for validating the pathfinding and direction calculation logic in the Bomberman bot.

## Overview

These tests verify that the bot correctly calculates movement directions when navigating from one pixel position to another in a grid-based game.

## Test Files

### `pathfinding.test.js` (Standalone JavaScript)

**Run with:**
```bash
node tests/pathfinding.test.js
```

This is a standalone JavaScript test that doesn't require TypeScript compilation. It's perfect for quick validation during development.

**Features:**
- ✅ 10 comprehensive test cases
- 🎮 Movement simulation from (45, 68) to (60, 60)
- 📊 Detailed step-by-step output
- 🔍 Edge case coverage

### `pathfinding.test.ts` (TypeScript)

**Run with:**
```bash
npm test tests/pathfinding.test.ts
```

TypeScript version that imports actual source code functions for integration testing.

## Test Cases

### 1. **Align smaller axis first (Y < X)**
- From: (45, 68) → To: (60, 60)
- Expected: UP
- Reason: |dy|=8 < |dx|=15, prioritize aligning Y first

### 2. **Move along aligned axis**
- From: (45, 60) → To: (60, 60)
- Expected: RIGHT
- Reason: Y is already aligned (dy=0), move along X

### 3. **Stop when very close**
- From: (58, 62) → To: (60, 60)
- Expected: STOP
- Reason: Within 2px threshold on both axes

### 4. **Stop when within threshold**
- From: (59, 61) → To: (60, 60)
- Expected: STOP
- Reason: 1px distance, should stop

### 5. **Move when Y aligned but X not**
- From: (57, 60) → To: (60, 60)
- Expected: RIGHT
- Reason: Y aligned, continue along X axis

### 6. **Move when X aligned but Y not**
- From: (60, 57) → To: (60, 60)
- Expected: DOWN
- Reason: X aligned, continue along Y axis

### 7. **Already at target**
- From: (60, 60) → To: (60, 60)
- Expected: STOP
- Reason: Already at destination

### 8. **Large distance - align Y first**
- From: (20, 80) → To: (100, 60)
- Expected: UP
- Reason: |dy|=20 < |dx|=80, align Y first

### 9. **Large distance - align X first**
- From: (80, 20) → To: (60, 100)
- Expected: LEFT
- Reason: |dx|=20 < |dy|=80, align X first

### 10. **Equal distance - default to Y axis**
- From: (50, 50) → To: (60, 60)
- Expected: DOWN
- Reason: When equal, default to Y-axis movement

## Movement Simulation

The test suite includes a detailed simulation showing how the bot moves from (45, 68) to (60, 60):

```
Step  1: (45, 68) --UP    --> (45, 65) | dx=15, dy=-5
Step  2: (45, 65) --UP    --> (45, 62) | dx=15, dy=-2
Step  3: (45, 62) --RIGHT --> (48, 62) | dx=12, dy=-2
Step  4: (48, 62) --RIGHT --> (51, 62) | dx= 9, dy=-2
Step  5: (51, 62) --RIGHT --> (54, 62) | dx= 6, dy=-2
Step  6: (54, 62) --RIGHT --> (57, 62) | dx= 3, dy=-2
Step  7: (57, 62) --RIGHT --> (60, 62) | dx= 0, dy=-2

✨ Reached target at (60, 62) in 7 steps!
```

## Algorithm Strategy

The `getDirectionToTarget` function uses the following strategy:

### 1. **Align Smaller Axis First**
Prioritize aligning the axis with the smaller distance. This ensures the bot "snaps to grid" as quickly as possible, avoiding diagonal drift.

### 2. **Continue Along Aligned Axis**
Once one axis is aligned (within 3px threshold), move along the remaining axis.

### 3. **Stop When Close Enough**
Stop movement when both axes are within 2px of the target.

### 4. **Handle Edge Cases**
- When both axes are aligned but not close enough to stop, move along the axis with greater distance
- When distances are equal, default to Y-axis movement (safer in Bomberman due to vertical bomb explosions)

## Why This Strategy?

### ❌ **Old Strategy (Wrong)**
```typescript
// Prioritize axis with LARGER distance
if (Math.abs(dx) > Math.abs(dy)) {
  return dx > 0 ? RIGHT : LEFT;
}
```

**Problem:** Bot at (45, 68) going to (60, 60):
- dx=15, dy=-8
- Chooses RIGHT (|dx| > |dy|)
- Bot moves to (60, 68) instead of (60, 60)! ❌

### ✅ **New Strategy (Correct)**
```typescript
// Prioritize axis with SMALLER distance
if (Math.abs(dy) < Math.abs(dx)) {
  return dy > 0 ? DOWN : UP;
}
```

**Benefit:** Bot at (45, 68) going to (60, 60):
- dx=15, dy=-8
- Chooses UP (|dy| < |dx|)
- Bot aligns Y first: (45, 68) → (45, 60)
- Then moves X: (45, 60) → (60, 60) ✅

## Running Tests

```bash
# Quick test (JavaScript)
node tests/pathfinding.test.js

# Full test suite (TypeScript - requires compilation)
npm test

# Watch mode
npm test -- --watch
```

## Expected Output

All tests should pass with green checkmarks:

```
✅ Test 1: Align smaller axis first (Y < X)
✅ Test 2: Move along aligned axis
✅ Test 3: Stop when very close
... (10 tests total)

📊 RESULTS: 10 passed, 0 failed out of 10 tests
```

## Troubleshooting

### Test Failures

If tests fail, check:
1. **ALIGN_THRESHOLD**: Should be 3px (matches MOVE_STEP_SIZE)
2. **STOP_THRESHOLD**: Should be 2px (tight enough to reach target)
3. **Logic order**: Check aligned axis conditions BEFORE fallback logic

### Bot Not Reaching Target

If simulation shows bot moving away:
1. Verify direction calculation is "align smaller axis first"
2. Check that aligned axis conditions are working
3. Ensure STOP condition triggers correctly

## Related Files

- `src/utils/position.ts`: Contains `getDirectionToTarget` implementation
- `src/utils/pathfinding.ts`: Path calculation using BFS
- `src/bombermanBot.ts`: Bot movement logic using `followPath`

## Contributing

When modifying pathfinding logic:
1. Run tests before changes: `node tests/pathfinding.test.js`
2. Make your changes
3. Run tests after changes
4. Ensure all tests still pass
5. Add new test cases if needed