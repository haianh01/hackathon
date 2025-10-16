# Cơ Chế Kiểm Tra "Đã Đến Vị Trí An Toàn"

## Câu hỏi: Bot chỉ cần "gần đủ" waypoint, vậy làm sao biết đã an toàn?

**Trả lời:** Có **2 levels của kiểm tra**:
1. ✅ **Waypoint Check** - Gần đủ để chuyển hướng
2. ✅ **Target Check** - Đến đích cuối + kiểm tra an toàn thực sự

---

## Level 1: Waypoint Proximity (Di chuyển qua waypoints)

### Code Location
```typescript
// src/bombermanBot.ts:411-427

// Find closest waypoint in path
for (let i = this.currentPathIndex; i < searchEndIndex; i++) {
  const dist = Math.hypot(
    currentPos.x - pathPos.x,
    currentPos.y - pathPos.y
  );

  if (dist < minDist) {
    closestIndex = i;  // Update to closest waypoint
  }
}

this.currentPathIndex = closestIndex;
```

### Purpose
- **KHÔNG phải** để kiểm tra an toàn
- Chỉ để **chọn waypoint tiếp theo** trong path
- Bot tự động "advance" qua waypoints khi di chuyển gần chúng

### Example
```
Path: [(60, 60), (60, 100), (100, 100)]

Bot at (58, 62):
  - Closest waypoint: (60, 60) → index 0
  - Next waypoint: (60, 100)
  - Direction: DOWN

Bot at (60, 95):
  - Closest waypoint: (60, 100) → index 1
  - Next waypoint: (100, 100)
  - Direction: RIGHT
```

**Không có threshold ở đây** - chỉ tìm waypoint gần nhất!

---

## Level 2: Final Target Check (Đã đến đích + An toàn)

### Code Location
```typescript
// src/bombermanBot.ts:429-444

const REACHED_THRESHOLD = 20; // pixels

// Check if we reached the FINAL target
if (
  this.pathTarget &&
  Math.hypot(
    currentPos.x - this.pathTarget.x,
    currentPos.y - this.pathTarget.y
  ) < REACHED_THRESHOLD
) {
  console.log(`✅ Reached path target at (${this.pathTarget.x}, ${this.pathTarget.y})`);
  this.clearPath();
  this.socketConnection.stopContinuousMove();
  return;
}
```

### Purpose
- Kiểm tra **đã đến đích cuối cùng** của path
- Threshold: **20 pixels** (half cell size)
- Nếu đến → **DỪNG** di chuyển

### Example
```
Path target: (120, 80)

Bot at (110, 75):
  distance = hypot(120-110, 80-75) = hypot(10, 5) = 11.2px
  11.2 < 20 → ✅ REACHED!
  → Stop movement
  → Clear path
```

---

## Emergency Escape: 2-Stage Safety Check

### Stage 1: Distance Check
```typescript
// src/bombermanBot.ts:206-213

const distanceToTarget = Math.hypot(
  currentBot.x - this.emergencyEscapeTarget.x,
  currentBot.y - this.emergencyEscapeTarget.y
);

const REACHED_THRESHOLD = 40; // pixels - one cell size
```

### Stage 2: Safety Verification
```typescript
// src/bombermanBot.ts:215-243

const isCurrentlySafe = !isPositionInDangerZone(currentBot, gameState);

console.log(`🎯 Escape status: distanceToTarget=${distanceToTarget}px, isSafe=${isCurrentlySafe}`);

if (distanceToTarget < REACHED_THRESHOLD && isCurrentlySafe) {
  console.log(`✅ Emergency escape target reached AND position is safe!`);
  this.emergencyEscapePath = null;
  this.emergencyEscapeTarget = null;
  // Success!

} else if (distanceToTarget < REACHED_THRESHOLD && !isCurrentlySafe) {
  console.warn(`⚠️ Reached target distance but STILL IN DANGER! Re-evaluating...`);
  // Force new escape route
  this.emergencyEscapePath = null;
  this.emergencyEscapeTarget = null;
  this.clearPath();
  // AI will recalculate escape path

} else {
  // Continue following escape path
}
```

### Key Difference: **Distance + Safety**

Emergency escape cần **2 điều kiện**:
1. ✅ `distanceToTarget < 40px` (within 1 cell)
2. ✅ `isCurrentlySafe == true` (không trong vùng nguy hiểm)

**Nếu đến đích nhưng vẫn nguy hiểm → Tìm đường khác!**

---

## isPositionInDangerZone() - Safety Check

### Code Location
```typescript
// src/utils/gameLogic.ts:40-51

export function isPositionInDangerZone(
  position: Position,
  gameState: GameState
): boolean {
  for (const bomb of gameState.map.bombs) {
    if (isPositionInBombRange(position, bomb, gameState)) {
      return true;
    }
  }
  return false;
}
```

### How it Works
```typescript
// src/utils/gameLogic.ts:57-112

function isPositionInBombRange(
  position: Position,
  bomb: Bomb,
  gameState: GameState
): boolean {
  const CELL_SIZE = 40;
  const PLAYER_SIZE = 30;
  const SAFETY_MARGIN = 5;

  // Quick check: center-to-center distance
  const centerDistance = Math.hypot(
    position.x - bomb.position.x,
    position.y - bomb.position.y
  );

  const safeDistance = bomb.flameRange * CELL_SIZE + PLAYER_SIZE;

  if (centerDistance > safeDistance) {
    return false; // Definitely safe
  }

  // Detailed check: AABB collision with bomb position
  if (checkBoxCollision(position, PLAYER_SIZE, bomb.position, CELL_SIZE)) {
    return true; // In bomb cell
  }

  // Check 4 directions (flame spread)
  for (const direction of [UP, DOWN, LEFT, RIGHT]) {
    const flamePositions = getPositionsInLine(
      bomb.position,
      direction,
      bomb.flameRange
    );

    for (const flamePos of flamePositions) {
      // Check AABB collision: Bot (30x30) vs Flame (40x40)
      if (checkBoxCollision(position, PLAYER_SIZE, flamePos, CELL_SIZE)) {
        return true; // In flame range
      }

      // Stop if wall blocks flame
      if (isPositionBlocked(flamePos, gameState)) {
        break;
      }
    }
  }

  return false; // Safe!
}
```

### Safety Calculation

```
Bomb at (80, 40), range=2:

Safe Distance = range × CELL_SIZE + PLAYER_SIZE/2
              = 2 × 40 + 30/2
              = 80 + 15
              = 95 pixels

Bot at (40, 40):
  distance = hypot(80-40, 40-40) = 40px
  40 < 95 → IN DANGER! ❌

Bot at (180, 40):
  distance = hypot(180-80, 40-40) = 100px
  100 > 95 → SAFE! ✅
```

---

## Complete Example: Emergency Escape

### Scenario
```
Bomb placed at (80, 40), range=2
Bot at (80, 40) - just placed bomb
Escape target: (180, 120)
```

### Tick-by-Tick Analysis

| Tick | Bot Position | Distance to Target | Is Safe? | Action |
|------|--------------|-------------------|----------|--------|
| 0 | (80, 40) | 141px | ❌ (in bomb) | Find escape path |
| 1 | (83, 40) | 139px | ❌ (in range) | Move RIGHT |
| 5 | (95, 40) | 127px | ❌ (in range) | Move RIGHT |
| 10 | (110, 43) | 112px | ❌ (barely) | Move RIGHT |
| 15 | (125, 50) | 95px | ✅ Safe! | Continue |
| 20 | (140, 65) | 72px | ✅ Safe! | Continue |
| 25 | (155, 80) | 51px | ✅ Safe! | Continue |
| 30 | (170, 100) | 28px | ✅ Safe! | Continue |
| 32 | (176, 108) | 15px | ✅ Safe! | Continue |
| 33 | (180, 112) | 8px | ✅ Safe! | Continue |
| 34 | (180, 118) | 2px | ✅ Safe! | **STOP!** |

**Final Check (Tick 34):**
```typescript
distanceToTarget = 2px < 40px ✅
isCurrentlySafe = true ✅

→ Emergency escape SUCCESS!
→ Clear emergency path
→ Resume normal behavior
```

---

## What if Still in Danger?

### Scenario: Escape Target is Still Dangerous

```
Bot reaches (180, 120) but another bomb appears nearby!

distanceToTarget = 5px < 40px ✅
isCurrentlySafe = false ❌ (new bomb nearby!)

→ console.warn("⚠️ Reached target but STILL IN DANGER!")
→ Clear old escape path
→ Force AI to find NEW escape route
→ Repeat until truly safe
```

### Code
```typescript
else if (distanceToTarget < REACHED_THRESHOLD && !isCurrentlySafe) {
  console.warn(`⚠️ Reached target distance but STILL IN DANGER!`);

  // Clear old path
  this.emergencyEscapePath = null;
  this.emergencyEscapeTarget = null;
  this.clearPath();
  this.socketConnection.stopContinuousMove();

  // Fall through to normal AI decision
  // → EscapeStrategy will trigger again with new path
}
```

---

## Summary: 3 Levels of Checking

### 1. Waypoint Navigation (No Safety Check)
```typescript
// Automatic, no threshold
closestIndex = findClosestWaypoint(currentPos, path);
nextWaypoint = path[closestIndex + 1];
direction = getDirectionToTarget(currentPos, nextWaypoint);
```
**Purpose:** Navigate smoothly through path
**No safety check** - just pick next waypoint

---

### 2. Normal Target Reached (Distance Only)
```typescript
// REACHED_THRESHOLD = 20px
if (distance(currentPos, pathTarget) < 20) {
  console.log("✅ Reached path target!");
  stopMovement();
}
```
**Purpose:** Know when to stop following path
**Simple distance check** - assumes path was safe

---

### 3. Emergency Escape (Distance + Safety)
```typescript
// REACHED_THRESHOLD = 40px
if (distance(currentPos, escapeTarget) < 40 && isCurrentlySafe) {
  console.log("✅ Safe!");
  clearEmergencyPath();

} else if (distance < 40 && !isCurrentlySafe) {
  console.warn("⚠️ Still in danger!");
  findNewEscapePath();

} else {
  continueEscaping();
}
```
**Purpose:** Ensure bot is ACTUALLY safe
**Distance + Safety verification** - critical for survival

---

## Visualization

```
Normal Path Following:
┌─────────────────────────────────────┐
│  Waypoint 1   Waypoint 2   Target  │
│     (60,60)     (100,60)   (140,60) │
│        ↓           ↓          ↓     │
│    [No check]  [No check]  [20px]  │
│                              STOP   │
└─────────────────────────────────────┘

Emergency Escape:
┌─────────────────────────────────────────────┐
│  Start (DANGER)  →  Target (hopefully safe) │
│    (80,40)              (180,120)           │
│       ↓                     ↓               │
│  [Check every tick]    [40px + SAFE?]      │
│                                             │
│  If safe at target: STOP ✅                │
│  If danger at target: REPLAN ❌            │
└─────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Waypoints ≠ Safety Checks**
   - Waypoints are for navigation
   - No threshold, just "closest"

2. **pathTarget = Final Destination**
   - 20px threshold for normal paths
   - Simple: "close enough to stop"

3. **Emergency Escape = Critical**
   - 40px threshold (larger, more tolerant)
   - **MUST verify safety** with `isPositionInDangerZone()`
   - **Re-plan if still danger** at target

4. **"Gần đủ" có 2 nghĩa:**
   - Waypoint: "Gần đủ để chuyển hướng" (no threshold)
   - Target: "Gần đủ để dừng lại" (20px or 40px)

5. **An toàn ≠ Đến đích**
   - Normal path: Assumes safe (pathfinding avoided danger)
   - Emergency: **Verifies safe** before stopping!

---

## Code References

- **Waypoint navigation**: `src/bombermanBot.ts:411-427`
- **Target reached check**: `src/bombermanBot.ts:429-444`
- **Emergency safety check**: `src/bombermanBot.ts:206-243`
- **isPositionInDangerZone**: `src/utils/gameLogic.ts:40-51`
- **isPositionInBombRange**: `src/utils/gameLogic.ts:57-112`
