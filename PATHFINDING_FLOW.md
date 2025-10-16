# Bot Movement Flow - From Pathfinding to Socket Command

## Overview
Khi `Pathfinding.findPath()` trả về một path như `[(60, 60), (60, 100)]`, bot sẽ thực hiện một chuỗi các bước để di chuyển theo path đó.

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. STRATEGY EVALUATION (WallBreakerStrategy.ts:243-274)            │
│                                                                      │
│  const path = Pathfinding.findPath(                                │
│    currentPos,        // (40, 40)                                  │
│    bestPosition,      // (120, 80)                                 │
│    gameState                                                        │
│  );                                                                 │
│                                                                      │
│  Result: path = [                                                   │
│    { x: 60, y: 60 },   // Step 1                                   │
│    { x: 60, y: 100 }   // Step 2                                   │
│  ]                                                                  │
│                                                                      │
│  ├─> Create BotDecision with path:                                 │
│  │                                                                  │
│  └─> return {                                                       │
│        action: BotAction.MOVE,                                     │
│        path: path,                    // ✅ Path được lưu vào      │
│        target: bestPosition.position, // (120, 80)                 │
│        priority: 60,                                               │
│        reason: "Following bomb placement path"                     │
│      }                                                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. BOT LOGIC TICK (bombermanBot.ts:279)                            │
│                                                                      │
│  executeBotLogic() {                                               │
│    const decision = this.ai.makeDecision(gameState);               │
│    // decision.path = [(60, 60), (60, 100)]                        │
│    this.executeAction(decision);                                   │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. EXECUTE ACTION (bombermanBot.ts:317-326)                        │
│                                                                      │
│  executeAction(decision: BotDecision) {                            │
│    switch (decision.action) {                                      │
│      case BotAction.MOVE:                                          │
│        if (decision.path && decision.path.length > 1) {            │
│          this.followPath(decision); // ✅ Path được xử lý ở đây   │
│        }                                                            │
│        break;                                                       │
│    }                                                                │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. FOLLOW PATH (bombermanBot.ts:368-470)                           │
│                                                                      │
│  followPath(decision: BotDecision) {                               │
│    // Step 1: Check if new path or continuation                    │
│    if (isNewPath) {                                                │
│      this.currentPath = decision.path; // [(60,60), (60,100)]     │
│      this.currentPathIndex = 0;                                    │
│      this.pathTarget = decision.target; // (120, 80)               │
│    }                                                                │
│                                                                      │
│    // Step 2: Find current position in path                        │
│    const currentPos = currentBot.position; // (40, 40)            │
│    let closestIndex = 0;                                           │
│                                                                      │
│    // Tìm waypoint gần nhất trong path                             │
│    for (let i = 0; i < path.length; i++) {                         │
│      const dist = distance(currentPos, path[i]);                  │
│      if (dist < minDist) {                                         │
│        closestIndex = i;                                           │
│      }                                                              │
│    }                                                                │
│                                                                      │
│    this.currentPathIndex = closestIndex; // 0                     │
│                                                                      │
│    // Step 3: Check if reached target                              │
│    if (distance(currentPos, pathTarget) < 20) {                   │
│      this.clearPath();                                             │
│      this.socketConnection.stopContinuousMove();                  │
│      return;                                                        │
│    }                                                                │
│                                                                      │
│    // Step 4: Get next waypoint                                    │
│    const nextIndex = this.currentPathIndex + 1; // 1              │
│    const nextWaypoint = this.currentPath[nextIndex]; // (60, 60)  │
│                                                                      │
│    // Step 5: Calculate direction                                  │
│    const direction = getDirectionToTarget(                         │
│      currentPos,    // (40, 40)                                    │
│      nextWaypoint   // (60, 60)                                    │
│    );                                                               │
│    // Result: Direction.RIGHT (vì dx=20, dy=20, abs(dx)==abs(dy)) │
│                                                                      │
│    console.log(`Following path: Step 1/2 -> RIGHT to (60, 60)`);  │
│                                                                      │
│    // Step 6: Send move command to socket                          │
│    this.socketConnection.startContinuousMove(direction);           │
│    // ✅ Bot bắt đầu di chuyển sang phải                          │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. GET DIRECTION TO TARGET (utils/position.ts:98-108)              │
│                                                                      │
│  getDirectionToTarget(from, to) {                                  │
│    const dx = to.x - from.x;  // 60 - 40 = 20                      │
│    const dy = to.y - from.y;  // 60 - 40 = 20                      │
│                                                                      │
│    // Ưu tiên di chuyển theo trục có khoảng cách lớn hơn           │
│    if (Math.abs(dx) > Math.abs(dy)) {                             │
│      return dx > 0 ? Direction.RIGHT : Direction.LEFT;            │
│    } else if (Math.abs(dy) > Math.abs(dx)) {                      │
│      return dy > 0 ? Direction.DOWN : Direction.UP;               │
│    }                                                                │
│                                                                      │
│    // Nếu dx == dy, ưu tiên horizontal (RIGHT/LEFT)                │
│    return dx > 0 ? Direction.RIGHT : Direction.LEFT;              │
│  }                                                                  │
│                                                                      │
│  Result: Direction.RIGHT                                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. SOCKET COMMUNICATION (connection/socketConnection.ts)           │
│                                                                      │
│  startContinuousMove(direction: Direction) {                       │
│    this.socket.emit("user-action", {                               │
│      action: "MOVE",                                               │
│      direction: "RIGHT"  // ✅ Server nhận lệnh di chuyển         │
│    });                                                              │
│  }                                                                  │
│                                                                      │
│  Server Response:                                                   │
│  - Cập nhật vị trí bot trên server                                │
│  - Gửi event "position-update" về client                           │
│  - Client cập nhật gameState                                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. NEXT TICK (200ms later)                                         │
│                                                                      │
│  executeBotLogic() {                                               │
│    // Bot đã di chuyển một chút, giả sử vị trí mới: (50, 50)      │
│    const currentPos = (50, 50);                                    │
│                                                                      │
│    // Strategy vẫn trả về same decision với same path              │
│    const decision = this.ai.makeDecision(gameState);               │
│                                                                      │
│    followPath(decision) {                                          │
│      // Check: isNewPath?                                          │
│      // this.pathTarget == decision.target? YES → continue path    │
│      // isNewPath = false                                          │
│                                                                      │
│      // Tìm waypoint gần nhất                                      │
│      closestIndex = 0 (vì (50,50) vẫn gần (60,60) hơn)           │
│      nextWaypoint = path[1] = (60, 60)                            │
│                                                                      │
│      direction = getDirectionToTarget((50, 50), (60, 60))         │
│      // dx=10, dy=10 → Direction.RIGHT                            │
│                                                                      │
│      this.socketConnection.startContinuousMove(Direction.RIGHT);  │
│    }                                                                │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. REACHED WAYPOINT (vị trí bot: (60, 60))                         │
│                                                                      │
│  followPath(decision) {                                            │
│    currentPos = (60, 60);                                          │
│                                                                      │
│    // Tìm waypoint gần nhất                                        │
│    closestIndex = 0 (vì đã đến (60, 60))                          │
│                                                                      │
│    // Next waypoint                                                │
│    nextIndex = 1;                                                  │
│    nextWaypoint = path[1] = (60, 100);                            │
│                                                                      │
│    // Calculate direction                                          │
│    direction = getDirectionToTarget((60, 60), (60, 100));         │
│    // dx=0, dy=40 → Direction.DOWN                                │
│                                                                      │
│    console.log(`Following path: Step 2/2 -> DOWN to (60, 100)`);  │
│                                                                      │
│    this.socketConnection.startContinuousMove(Direction.DOWN);     │
│    // ✅ Bot chuyển hướng đi xuống                                │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 9. REACHED TARGET (vị trí bot: (60, 100) ~ (120, 80))              │
│                                                                      │
│  followPath(decision) {                                            │
│    currentPos = (60, 100);                                         │
│    pathTarget = (120, 80);                                         │
│                                                                      │
│    // Check if reached target                                      │
│    const distance = hypot(60-120, 100-80) = hypot(-60, 20)        │
│                   = sqrt(3600 + 400) = sqrt(4000) ≈ 63px          │
│                                                                      │
│    // REACHED_THRESHOLD = 20px                                     │
│    if (distance < 20) { // FALSE (63 > 20)                        │
│      // Chưa đến target, tiếp tục di chuyển                        │
│    }                                                                │
│                                                                      │
│    // NOTE: Trong thực tế, path sẽ dài hơn để đến đúng (120, 80) │
│    // Path example: [(60,60), (60,100), (80,100), (100,100),      │
│    //                 (120,100), (120,80)]                         │
│  }                                                                  │
│                                                                      │
│  When ACTUALLY reached (120, 80):                                  │
│  followPath(decision) {                                            │
│    if (distance(currentPos, pathTarget) < 20) {                   │
│      console.log("✅ Reached path target at (120, 80)");          │
│      this.clearPath();                                             │
│      this.socketConnection.stopContinuousMove();                  │
│      // ✅ Path following hoàn tất, bot dừng lại                  │
│    }                                                                │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. State Management
```typescript
// bombermanBot.ts
private currentPath: Position[] | null = null;
private currentPathIndex: number = 0;
private pathTarget: Position | null = null;
```

- `currentPath`: Lưu path đang theo
- `currentPathIndex`: Index của waypoint hiện tại
- `pathTarget`: Điểm đích cuối cùng

### 2. Path Following Logic

**Pseudo Code:**
```
EACH TICK (every 200ms):
  1. Get AI decision with path
  2. If decision has path:
     a. Save path to currentPath (if new)
     b. Find closest waypoint in path
     c. Get next waypoint
     d. Calculate direction to next waypoint
     e. Send move command to server
  3. Check if reached target:
     - If yes: clear path, stop movement
     - If no: continue in next tick
```

### 3. Direction Calculation

```typescript
// From: (40, 40)
// To:   (60, 60)

dx = 60 - 40 = 20
dy = 60 - 40 = 20

if (abs(dx) > abs(dy))     → Horizontal movement priority
else if (abs(dy) > abs(dx)) → Vertical movement priority
else                         → Tie: prefer horizontal

Result: Direction.RIGHT (dx > 0, tie-breaker)
```

---

## Example Scenario: Bot at (40, 40), Bomb at (80, 40)

### Input
```typescript
currentPos = { x: 40, y: 40 }
bombPos = { x: 80, y: 40 }
```

### Pathfinding Result
```typescript
path = [
  { x: 60, y: 60 },   // Step 1: Diagonal down-right
  { x: 60, y: 100 }   // Step 2: Down (escaping bomb range)
]
```

### Movement Sequence

| Tick | Bot Pos | Next Waypoint | Direction | Action |
|------|---------|---------------|-----------|--------|
| 0 | (40, 40) | (60, 60) | RIGHT | Start moving right |
| 1 | (50, 50) | (60, 60) | RIGHT | Continue right |
| 2 | (60, 60) | (60, 100) | DOWN | Reached waypoint 1, turn down |
| 3 | (60, 70) | (60, 100) | DOWN | Continue down |
| 4 | (60, 80) | (60, 100) | DOWN | Continue down |
| 5 | (60, 90) | (60, 100) | DOWN | Continue down |
| 6 | (60, 100) | - | STOP | Reached target, stop |

---

## Console Logs Example

```
🧱 === WallBreakerStrategy EVALUATION START ===
📋 Creating new bomb placement plan...
🛤️ Starting new path: 2 steps to (120, 80)
🧱 === WallBreakerStrategy EVALUATION END (NEW PLAN MOVE) ===

🤖 AI Decision: MOVE -> N/A with priority 60 (took 5ms)

🎯 Following path: Step 1/2 -> RIGHT to (60, 60)
⏱️ Tick performance: Decision=5ms, Action=1ms, Total=6ms

[Next tick - 200ms later]

🧱 === WallBreakerStrategy EVALUATION START ===
📋 Continuing existing bomb placement plan...
🧱 === WallBreakerStrategy EVALUATION END (PLAN MOVE) ===

🤖 AI Decision: MOVE -> N/A with priority 60 (took 3ms)

🎯 Following path: Step 1/2 -> RIGHT to (60, 60)
⏱️ Tick performance: Decision=3ms, Action=1ms, Total=4ms

[Bot reaches (60, 60)]

🎯 Following path: Step 2/2 -> DOWN to (60, 100)

[Bot reaches target]

✅ Reached path target at (60, 100)
```

---

## Important Notes

1. **Tick Rate**: Bot logic runs every 200ms
2. **Path Persistence**: Path is saved and reused across ticks until:
   - Target is reached
   - New path is calculated (different target)
   - Emergency situation (bomb threat)
   - Path becomes invalid (blocked)

3. **Direction Priority**: When dx == dy, horizontal movement is preferred
4. **Threshold**: Bot considers target "reached" when within 20px

5. **Path Validation**: WallBreakerStrategy checks if path should be recalculated:
   - Plan too old (>5 seconds)
   - Target no longer valid
   - Path blocked by obstacles
   - Path goes through danger zone

---

## Summary

**Pathfinding Flow: A → B → C → D → E → F**

A. **Strategy** creates path using `Pathfinding.findPath()`
B. **Decision** contains path in `BotDecision.path`
C. **BomberManBot** receives decision in tick
D. **executeAction()** routes to `followPath()`
E. **followPath()** calculates direction to next waypoint
F. **Socket** sends move command to server

This creates a smooth, autonomous movement system where the bot follows complex paths automatically without manual step-by-step commands.
