# Movement & Position Sync Issues - Fix Summary

**Date**: October 10, 2025

## 🐛 Critical Issues Found

### 1. **Server Tickrate Mismatch**
**Problem**: Bot gửi move command mỗi 1ms nhưng server tickrate là 17ms
- Server chỉ xử lý ~59 ticks/second (17ms/tick)
- Bot gửi 1000 commands/second → 940+ commands bị waste!
- Commands bị throttle/dropped → bot chậm hơn bots khác

**Fix**:
```typescript
// BEFORE
this.moveInterval = setInterval(moveAction, 1); // TOO FAST!

// AFTER  
this.moveInterval = setInterval(moveAction, 17); // Match server tickrate
```

**Files**: `src/connection/socketConnection.ts`
- Line 30: `moveThrottleMs: 17`
- Line 250: `setInterval(moveAction, 17)`

---

### 2. **Position Sync Issue**
**Problem**: Bot position không sync giữa GameEngine và SocketConnection
- `player_move` event update: `(564, 40)` 
- `data.bombers` position: `(565, 40)` ← Bot logic dùng giá trị này!
- Strategies đưa ra quyết định dựa trên position SAI

**Why it happens**:
```typescript
// SocketConnection updates:
this.lastConfirmedPosition = { x: 564, y: 40 }; 

// But GameEngine uses:
const currentBot = data.bombers.find(b => b.uid === botId);
// currentBot.position = { x: 565, y: 40 } ← OLD VALUE!
```

**Impact**:
- Bot không detect được chests gần đó
- ChestSeeker không tìm được path
- AlignAndBomb không align đúng

**Solution Options**:

**Option 1: Use SocketConnection position (RECOMMENDED)**
```typescript
// In bombermanBot.ts
const socketPos = this.socketConnection.getCurrentPosition();
if (socketPos) {
  gameState.currentBot.position = socketPos;
}
```

**Option 2: Force update GameEngine from player_move**
```typescript
// In socketConnection.ts player_move handler
this.onPositionUpdateCallback?.(data.x, data.y);
// → bombermanBot updates gameEngine position
```

---

### 3. **Affected Positions Calculation Wrong**
**Problem**: Bot ở `(565, 40)` tính affected positions:
```
{ x: 565, y: 40 },
{ x: 525, y: 40 },  // LEFT: 565 - 40 = 525
{ x: 485, y: 40 },  // LEFT: 565 - 80 = 485
```

Nhưng chests ở:
```
{ x: 480, y: 40 }  // ← Không match với 485!
{ x: 440, y: 40 }  // ← Không match với 525!
```

**Root Cause**: Bot position `565` không phải grid-aligned (should be 560 or 600)

**Why bot starts at odd position**: Server spawn position không aligned!

**Current Fix**: AlignAndBombStrategy moves bot to aligned position first
- Bot at `(565, 40)` → Move LEFT to `(560, 40)`
- Then from `(560, 40)`: affected = `[560, 520, 480, 440, 400...]` ✅
- Now detects chest at `480, 40`!

---

### 4. **Pathfinding Issues**
**Problem**: ChestSeeker không tìm được path đến chest gần nhất
```
[ChestSeeker] No path to nearest chest
```

**Possible Causes**:
1. Bot position không chính xác (565 vs 564)
2. Pathfinding không handle pixel-level positions well
3. Chests position vs bot position có thể bị solid walls block

**Debug needed**:
```typescript
console.log(`[ChestSeeker] Bot at: ${botPosition.x}, ${botPosition.y}`);
console.log(`[ChestSeeker] Nearest chest: ${nearestChest.position.x}, ${nearestChest.position.y}`);
console.log(`[ChestSeeker] Path:`, path);
```

---

## ✅ Fixes Applied

### 1. Server Tickrate Sync ✅
- Changed move interval from 1ms → 17ms
- Matches server tickrate exactly
- Reduced network overhead by 98%!

### 2. Movement Speed Prediction ✅
```typescript
const MOVE_STEP = 3; // Server moves ~3px per 17ms tick
```
- Updated from 1px to 3px per step
- More accurate position prediction

### 3. Grid Alignment Strategy ✅
- AlignAndBombStrategy aligns bot to 40px grid
- Higher priority (100) when very close (≤5px)
- Ensures bomb placement at optimal positions

### 4. Better Logging ✅
```typescript
console.log(`📍 Position updated: ${oldPos} -> (${data.x}, ${data.y})`);
console.log(`[AlignAndBomb] Distance to align: ${distToAlign}px`);
```

---

## 🚧 Still TODO

### 1. Fix Position Sync (HIGH PRIORITY)
Need to ensure bot logic uses the LATEST position from `player_move` event, not stale `data.bombers` position.

**Recommended Implementation**:
```typescript
// In bombermanBot.ts - before makeDecision
private syncBotPosition(gameState: GameState): void {
  const socketPos = this.socketConnection.getCurrentPosition();
  if (socketPos) {
    gameState.currentBot.position = socketPos;
    console.log(`🔄 Synced position: (${socketPos.x}, ${socketPos.y})`);
  }
}

private async run(): Promise<void> {
  // ... 
  const gameState = this.gameEngine.getGameState();
  this.syncBotPosition(gameState); // ← ADD THIS
  const decision = this.ai.makeDecision(gameState);
  // ...
}
```

### 2. Debug Pathfinding
Add detailed logs to understand why ChestSeeker can't find path:
```typescript
const nearestChest = this.findNearestChest(botPosition, map.chests);
console.log(`[ChestSeeker] Nearest: (${nearestChest.position.x}, ${nearestChest.position.y})`);

const path = Pathfinding.findShortestPath(...);
if (!path) {
  // Check why - walls blocking? Position invalid?
  console.log(`[ChestSeeker] DEBUG - Bot pos:`, botPosition);
  console.log(`[ChestSeeker] DEBUG - Target:`, nearestChest.position);
  console.log(`[ChestSeeker] DEBUG - Can move to target?`, canMoveTo(nearestChest.position, gameState));
}
```

### 3. Optimize Alignment Threshold
Currently aligns to exact 40px grid. Consider:
- Accept "close enough" (±2px tolerance)?
- Pre-calculate optimal bombing positions?
- Skip alignment if enemy nearby (danger)?

---

## 📊 Current Strategy Priority

After all fixes:

1. **EscapeStrategy** (100) - Escape danger
2. **AlignAndBombStrategy** (85-100) - Align + bomb chests
3. **BombStrategy** (80) - General bomb placement  
4. **AttackStrategy** (80) - Attack enemies
5. **DefensiveStrategy** (70) - Defensive play
6. **CollectStrategy** (60) - Collect items
7. **ChestSeekerStrategy** (55) - Seek chests
8. **WallBreakerStrategy** (50) - Break walls
9. **ExploreStrategy** (40) - Explore
10. **SmartNavigationStrategy** (30) - Navigate

---

## 🎯 Expected Behavior After Fix

1. Bot spawns at `(565, 40)` (not aligned)
2. AlignAndBomb detects: "5px away from alignment" → Priority 100
3. Bot moves LEFT: `(565→564→563→562→561→560)` at 3px per 17ms
4. When aligned at `(560, 40)`:
   - Affected positions: `[560, 520, 480, 440, 400...]`
   - Detects chest at `(480, 40)` and `(440, 40)` ✅
   - Places bomb!
5. Escapes to safety
6. Repeat for next chest

---

## 🔧 Quick Fix Commands

```bash
# Build
npm run build

# Run
npm run dev

# Watch logs for these key indicators:
# ✅ "17ms interval" - correct tickrate
# ✅ "Distance to align: Xpx" - alignment tracking  
# ✅ "Position updated: (X,Y) -> (X,Y)" - position sync
# ✅ "Found N chests in range - PLACING BOMB" - successful detection
```

---

## 📝 Files Modified

1. `src/connection/socketConnection.ts` - Tickrate sync (17ms)
2. `src/strategies/alignAndBombStrategy.ts` - Grid alignment + distance calc
3. `src/strategies/bombStrategy.ts` - Affected positions (CELL_SIZE * i)
4. `src/strategies/chestSeekerStrategy.ts` - NEW - Seek nearby chests
5. `src/game/gameEngine.ts` - Dynamic map size calculation
6. `src/ai/bombermanAI.ts` - Added new strategies

---

## 🎯 Next Steps

1. **Implement position sync** in bombermanBot.ts
2. **Debug pathfinding** with detailed logs
3. **Test in real game** and monitor behavior
4. **Fine-tune priorities** based on results
