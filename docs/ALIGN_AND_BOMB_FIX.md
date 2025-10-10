# Align and Bomb Strategy - Fix Summary

**Date**: October 10, 2025

## 🐛 Issues Fixed

### 1. **Bomb Not Detecting Chests**
**Problem**: Bot đứng tại rương `(565, 520)` nhưng không đặt bom vì `getAffectedPositions` tính sai.

**Root Cause**: 
```typescript
// SAI - tính theo pixel thay vì cell
const pos = {
  x: bombPosition.x + dir.dx * i,  // +1, +2 pixels
  y: bombPosition.y + dir.dy * i,
};
```

**Fix**:
```typescript
// ĐÚNG - tính theo cell (40px/cell)
const CELL_SIZE = 40;
const pos = {
  x: bombPosition.x + dir.dx * i * CELL_SIZE,  // +40, +80 pixels
  y: bombPosition.y + dir.dy * i * CELL_SIZE,
};
```

**File**: `src/strategies/bombStrategy.ts` - Line 175-179

---

### 2. **Position Update Incorrect**
**Problem**: Bot position được update sai khi bị rương chặn.
- Bot thực tế: `(40, 40)`
- Server báo: `(40, 85)` 
- Bot bị stuck ở rương nhưng position vẫn tăng!

**Root Cause**: Server `player_move` event trả về predicted position, không validate collision với chest.

**Fix**: Thêm debug log để track position changes:
```typescript
console.log(`📍 Position updated: ${oldPos} -> (${data.x}, ${data.y})`);
```

**File**: `src/connection/socketConnection.ts` - Line 130-132

**Note**: Đây là server-side issue, bot không thể fix hoàn toàn. Cần rely vào GameEngine's bomber position từ `data.bombers`.

---

### 3. **Map Size Hardcoded Wrong**
**Problem**: Map size hardcoded 640x640 nhưng thực tế map có thể khác size.

**Root Cause**:
```typescript
const map: GameMap = {
  width: 640,  // HARDCODED!
  height: 640,
};
```

**Fix**: Tính dynamic từ `data.map` array:
```typescript
const CELL_SIZE = 40;
const mapData = data.map || [];
const mapHeight = mapData.length * CELL_SIZE;
const mapWidth = mapData.length > 0 && mapData[0] ? mapData[0].length * CELL_SIZE : 0;

console.log(`🗺️ Map size: ${mapWidth}x${mapHeight}`);

const map: GameMap = {
  width: mapWidth,
  height: mapHeight,
  // ...
};
```

**File**: `src/game/gameEngine.ts` - Line 93-100

---

## ✨ New Feature: AlignAndBombStrategy

### Purpose
Đảm bảo bot căn chỉnh về vị trí "chẵn" (aligned to 40px grid) trước khi đặt bom để tối ưu hóa việc phá rương.

### How It Works

1. **Check Alignment**:
```typescript
const isAlignedX = botPosition.x % 40 === 0;
const isAlignedY = botPosition.y % 40 === 0;
const isFullyAligned = isAlignedX && isAlignedY;
```

2. **Move to Aligned Position**:
```typescript
const alignedPosition = {
  x: Math.round(position.x / 40) * 40,
  y: Math.round(position.y / 40) * 40,
};
// Move towards aligned position
```

3. **Place Bomb When Aligned**:
```typescript
if (isFullyAligned && currentBot.bombCount > 0) {
  const nearbyChests = this.findNearbyChests(...);
  if (nearbyChests.length > 0) {
    return BOMB action;
  }
}
```

### Example Scenario

```
Bot at (85, 77) → Move to (80, 80) [aligned]
Chest at (120, 80)
Flame range: 2

At (80, 80):
  - RIGHT direction: (120, 80), (160, 80)
  - Chest at (120, 80) detected! ✅
  - Place bomb → Destroy chest
```

### Priority
- **Priority: 85** (higher than BombStrategy: 80)
- Runs BEFORE BombStrategy to ensure optimal positioning

### Integration

**File**: `src/strategies/alignAndBombStrategy.ts` (NEW)

**Added to AI**:
```typescript
// src/ai/bombermanAI.ts
import { AlignAndBombStrategy } from "../strategies";

private getDefaultStrategies(): BotStrategy[] {
  return [
    new EscapeStrategy(),        // 100
    new AlignAndBombStrategy(),  // 85 ⭐ NEW
    new BombStrategy(),          // 80
    new AttackStrategy(),        // 80
    // ...
  ];
}
```

---

## 🎯 Strategy Priority Order

After this update:

1. **EscapeStrategy** (100) - Escape danger
2. **AlignAndBombStrategy** (85) - Align to grid + bomb chests ⭐ NEW
3. **BombStrategy** (80) - General bomb placement
4. **AttackStrategy** (80) - Attack enemies
5. **DefensiveStrategy** (70) - Defensive play
6. **CollectStrategy** (60) - Collect items
7. **WallBreakerStrategy** (50) - Break walls
8. **SmartNavigationStrategy** (30) - Smart pathfinding
9. **ExploreStrategy** (40) - Explore map

---

## 🧪 Testing

Run the bot:
```bash
npm run build
npm run dev
```

**Expected Behavior**:
1. Bot sees chest nearby
2. Bot moves to aligned position (e.g., 80, 80)
3. Log: `[AlignAndBomb] Found X chests in range - PLACING BOMB`
4. Bot places bomb
5. Chest destroyed ✅

---

## 📝 Files Changed

1. `src/strategies/bombStrategy.ts` - Fixed `getAffectedPositions` 
2. `src/strategies/alignAndBombStrategy.ts` - NEW strategy
3. `src/strategies/index.ts` - Export new strategy
4. `src/ai/bombermanAI.ts` - Import and register strategy
5. `src/game/gameEngine.ts` - Dynamic map size calculation
6. `src/connection/socketConnection.ts` - Position update debug log

---

## 🚀 Next Steps

1. Monitor bot behavior with new strategy
2. Test with different map sizes
3. Fine-tune alignment threshold if needed
4. Consider adding "pre-align" prediction for smoother movement
