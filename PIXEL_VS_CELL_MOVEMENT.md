# Pixel vs Cell Movement - Giải thích Chi Tiết

## Câu hỏi: Bot di chuyển từng pixel nhưng path trả về cell positions?

**TL;DR:**
- **Pathfinding** hoạt động trên cell grid (40x40) để tìm đường
- **Bot** di chuyển từng pixel (3px/tick mỗi 17ms)
- **followPath()** chỉ dùng cell positions làm **waypoints** (điểm mốc)
- Bot tự động di chuyển từng pixel cho đến khi **gần đủ** waypoint tiếp theo

---

## Constants

```typescript
// src/utils/constants.ts
export const CELL_SIZE = 40;           // Grid cell size
export const MOVE_STEP_SIZE = 1;       // Server moves 1px per tick
export const MOVE_INTERVAL_MS = 17;    // Server tickrate: 17ms (~59 FPS)
```

### Server Movement
- Server cập nhật vị trí mỗi **17ms** (59 ticks/giây)
- Mỗi tick, bot di chuyển **3 pixels** theo direction hiện tại
- Tốc độ thực tế: `3px/tick × 59 ticks/sec = ~177 px/sec`

---

## Pathfinding: Cell-Based

### Input/Output
```typescript
Pathfinding.findPath(
  { x: 40, y: 40 },    // Pixel position (start)
  { x: 120, y: 80 },   // Pixel position (goal)
  gameState
)

// Internally converts to cell indices:
startCell = pixelToCellIndex({ x: 40, y: 40 })   // { x: 1, y: 1 }
goalCell = pixelToCellIndex({ x: 120, y: 80 })   // { x: 3, y: 2 }

// A* pathfinding on cell grid...

// Returns cell CENTER positions in pixels:
return [
  { x: 60, y: 60 },    // Cell (1, 1) center
  { x: 60, y: 100 }    // Cell (1, 2) center
]
```

### Why Cell-Based?
1. **Performance**: Grid-based pathfinding is much faster
   - 360×360 pixel map = 129,600 pixels
   - 9×9 cell grid = 81 cells
   - **1600× fewer nodes** to search!

2. **Simplicity**: Walls and obstacles align with cells

3. **Accuracy**: Cell centers are safe positions
   - Center of 40×40 cell = 20px from edges
   - Avoids collision with walls

---

## Movement: Pixel-Based

### Socket Communication (17ms interval)

```typescript
// src/connection/socketConnection.ts:226-249

public startContinuousMove(direction: Direction): void {
  this.currentDirection = direction;

  const moveAction = () => {
    this.socket.emit("move", { orient: direction });
  };

  moveAction(); // Move immediately
  this.moveInterval = setInterval(moveAction, 17); // 17ms = ~59 FPS
}
```

**What happens:**
- Client sends `"move"` command to server **every 17ms**
- Server updates bot position: `+3px` in the given direction
- Server broadcasts `player_move` event with new pixel position
- Client receives updated position

### Server-Side Movement (every 17ms)

```
Tick 0:  Position (40, 40), Direction RIGHT → Move to (43, 40)
Tick 1:  Position (43, 40), Direction RIGHT → Move to (46, 40)
Tick 2:  Position (46, 40), Direction RIGHT → Move to (49, 40)
...
Tick 6:  Position (57, 40), Direction RIGHT → Move to (60, 40)
Tick 7:  Position (60, 40), Direction DOWN  → Move to (60, 43)
...
```

---

## Path Following: Waypoint Navigation

### followPath() Logic

```typescript
// src/bombermanBot.ts:368-470

followPath(decision: BotDecision) {
  // Path from pathfinding (cell centers):
  // [(60, 60), (60, 100)]

  const currentPos = currentBot.position; // Pixel position: (46, 52)

  // 1. Find closest waypoint in path
  let closestIndex = 0;
  for (let i = 0; i < path.length; i++) {
    const dist = hypot(currentPos - path[i]);
    if (dist < minDist) {
      closestIndex = i;
    }
  }

  // 2. Get next waypoint
  const nextWaypoint = path[closestIndex + 1]; // (60, 60)

  // 3. Calculate direction to waypoint
  const direction = getDirectionToTarget(currentPos, nextWaypoint);
  // from (46, 52) to (60, 60)
  // dx = 14, dy = 8
  // abs(dx) > abs(dy) → Direction.RIGHT

  // 4. Send continuous move command
  this.socketConnection.startContinuousMove(direction);
  // → Server moves bot +3px RIGHT every 17ms
}
```

### Key Point: Waypoints are NOT exact destinations

```
Path waypoints:       [(60, 60), (60, 100)]
Bot pixel positions:  (40,40) → (43,40) → (46,40) → ... → (58,52) → (60,55) → (60,58) → ...
                                                            ↑
                                                   Close enough to (60,60),
                                                   switch to next waypoint
```

Bot **doesn't stop** at exact waypoint positions. It just:
1. Moves in the direction of the waypoint
2. When "close enough", switches to next waypoint
3. Repeats until reaching final target

---

## Complete Example: Bot at (40, 40) → Target (60, 100)

### Path from Pathfinding
```typescript
path = [
  { x: 60, y: 60 },    // Waypoint 1 (cell 1,1 center)
  { x: 60, y: 100 }    // Waypoint 2 (cell 1,2 center)
]
```

### Tick-by-Tick Movement

| Time | Bot Pos | Next Waypoint | Direction | Distance to Waypoint |
|------|---------|---------------|-----------|---------------------|
| 0ms | (40, 40) | (60, 60) | Calculate... | 28px |
| | | | dx=20, dy=20 → RIGHT | |
| 17ms | (43, 40) | (60, 60) | RIGHT | 26px |
| 34ms | (46, 40) | (60, 60) | RIGHT | 25px |
| 51ms | (49, 40) | (60, 60) | RIGHT | 23px |
| 68ms | (52, 40) | (60, 60) | RIGHT | 21px |
| 85ms | (55, 43) | (60, 60) | RIGHT | 18px |
| 102ms | (58, 46) | (60, 60) | RIGHT | 14px |
| 119ms | (60, 49) | (60, 60) | Calculate... | 11px |
| | | | dx=0, dy=11 → DOWN | |
| 136ms | (60, 52) | (60, 60) | DOWN | 8px |
| 153ms | (60, 55) | (60, 60) | DOWN | 5px |
| 170ms | (60, 58) | (60, 60) | DOWN | 2px |
| 187ms | (60, 60) | ✅ Reached! | - | 0px |
| | | Switch to next waypoint | | |
| 187ms | (60, 60) | (60, 100) | DOWN | 40px |
| 204ms | (60, 63) | (60, 100) | DOWN | 37px |
| 221ms | (60, 66) | (60, 100) | DOWN | 34px |
| ... | ... | ... | ... | ... |
| ~850ms | (60, 100) | ✅ Target! | STOP | 0px |

**Total time**: ~850ms for 2 waypoints (~60 pixels of travel)

---

## Why This Design Works

### 1. Efficient Pathfinding
- A* runs on 9×9 grid (81 nodes) instead of 360×360 pixels (129,600 nodes)
- **1600× faster** pathfinding

### 2. Smooth Movement
- Bot moves 3px every 17ms
- Smooth visual movement (59 FPS)
- No jerky "cell to cell" jumping

### 3. Dynamic Re-evaluation
- Every 200ms tick, bot recalculates direction
- Can adjust path if obstacles appear
- Not locked into pixel-perfect path

### 4. Tolerance for Drift
- Bot doesn't need to hit exact pixel positions
- Server may lag or desync slightly
- Waypoint-based navigation is more robust

---

## Direction Calculation: Pixel-Level

```typescript
// src/utils/position.ts:98-108

function getDirectionToTarget(from: Position, to: Position): Direction {
  const dx = to.x - from.x;  // Pixel difference
  const dy = to.y - from.y;  // Pixel difference

  // Priority: axis with larger distance
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.RIGHT : Direction.LEFT;
  } else if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 ? Direction.DOWN : Direction.UP;
  }

  // Tie: prefer horizontal
  return dx > 0 ? Direction.RIGHT : Direction.LEFT;
}
```

### Examples

```
From: (46, 52) → To: (60, 60)
dx = 14, dy = 8
abs(14) > abs(8) → RIGHT

From: (60, 55) → To: (60, 100)
dx = 0, dy = 45
abs(0) < abs(45) → DOWN

From: (40, 40) → To: (60, 60)
dx = 20, dy = 20
abs(20) == abs(20) → RIGHT (tie-breaker)
```

---

## Real-World Analogy

Think of it like **GPS navigation**:

1. **GPS plans route** using major roads (highways/streets)
   - Like pathfinding using cell grid
   - Fast, efficient, big-picture planning

2. **You drive** on actual roads pixel by pixel
   - Like bot moving 3px every 17ms
   - Smooth, continuous movement

3. **GPS gives waypoints** ("Turn right at Main St")
   - Like cell center positions: (60, 60)
   - You don't stop exactly at Main St sign
   - You just need to get "close enough" before next instruction

4. **You adjust continuously** between waypoints
   - Every 200ms tick recalculates direction
   - Can handle small obstacles/drift
   - Eventually reaches destination

---

## Summary Table

| Aspect | Pathfinding | Movement | Path Following |
|--------|-------------|----------|----------------|
| **Coordinate System** | Cell indices (0-8) | Pixel positions (0-360) | Cell centers (pixels) |
| **Resolution** | 40×40 cells | 1×1 pixels | 40px waypoints |
| **Update Rate** | On-demand | Every 17ms | Every 200ms |
| **Purpose** | Find optimal route | Execute movement | Navigate waypoints |
| **Precision** | Low (cell-level) | High (pixel-level) | Medium (waypoint) |

---

## Visualization

```
Cell Grid (Pathfinding):
┌─────┬─────┬─────┬─────┐
│     │     │     │     │
│  S  │  1  │     │     │  S = Start cell (1,1)
├─────┼─────┼─────┼─────┤  1 = Waypoint 1 (1,1)
│     │     │     │     │  2 = Waypoint 2 (1,2)
│  2  │  G  │     │     │  G = Goal cell (2,2)
├─────┼─────┼─────┼─────┤
│     │     │     │     │
└─────┴─────┴─────┴─────┘

Pixel Movement (Actual Bot):
(40,40) → (43,40) → (46,40) → ... → (60,55) → (60,58) → (60,60)
   ↓                                                        ↓
 Start                                              Waypoint 1
                                                          ↓
                                              (60,63) → ... → (60,100)
                                                                  ↓
                                                                Goal

Path Waypoints (Cell Centers):
[(60, 60), (60, 100)]
    ↑          ↑
  Cell 1,1   Cell 1,2
  center     center
```

---

## Code References

- **Pathfinding**: `src/utils/pathfinding.ts:50-128`
  - Returns cell center positions

- **Movement**: `src/connection/socketConnection.ts:226-249`
  - Sends move commands every 17ms
  - Server moves 3px per command

- **Path Following**: `src/bombermanBot.ts:368-470`
  - Uses cell waypoints
  - Calculates pixel-level direction
  - Recalculates every 200ms

- **Direction Calc**: `src/utils/position.ts:98-108`
  - Works with pixel coordinates
  - Returns compass direction

---

## Conclusion

**Cell positions from pathfinding** là waypoints (điểm mốc) để hướng dẫn bot.

**Pixel movement** là cách bot thực sự di chuyển - mượt mà, liên tục, 3px mỗi 17ms.

Bot **không cần đến chính xác** cell centers. Nó chỉ cần đi **gần đủ** rồi chuyển sang waypoint tiếp theo.

Như GPS: Không cần dừng đúng biển báo, chỉ cần rẽ đúng hướng khi đến gần!
