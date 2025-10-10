# 📊 Bomberman Bot - Flow Summary

## 🎯 Tóm tắt luồng chính

### 1️⃣ KHỞI TẠO (Initialization)
```
index.ts → new BombermanBot(server, token)
    ↓
BombermanBot constructor
    ├── new BombermanAI()
    ├── new GameEngine()
    └── new SocketConnection(server, token)
        └── Detect environment (Dev/Competition)
```

### 2️⃣ KẾT NỐI (Connection)
```
bot.initialize()
    ↓
socketConnection.connect()
    ├── Create Socket.IO connection
    ├── Setup event listeners
    └── Wait for 'connect' event
    ↓
On 'connect':
    ├── Log Socket ID
    ├── emit('join', {})
    └── Wait for 'user' event
```

### 3️⃣ NHẬN DỮ LIỆU (Receive Data)
```
On 'user' event:
    ├── Find myBomberInfo (uid === socket.id)
    ├── Update lastConfirmedPosition
    ├── Log bot info
    └── Call onGameDataCallback
        └── processGameData()
            └── gameEngine.updateGameState()
```

### 4️⃣ GAME LOOP (Every 500ms)
```
executeBotLogic()
    ↓
Check: isGameRunning && isRunning?
    ├── No → Skip
    └── Yes → Continue
        ↓
    gameEngine.getGameState()
        ↓
    ai.makeDecision(gameState)
        ↓
    executeAction(decision)
        ├── MOVE → startContinuousMove(direction)
        ├── BOMB → stopContinuousMove() + placeBomb()
        └── STOP → stopContinuousMove()
```

### 5️⃣ CONTINUOUS MOVEMENT (Every 50ms)
```
startContinuousMove(direction)
    ↓
Check: Same direction?
    ├── Yes → Skip (already moving)
    └── No → Continue
        ↓
    stopContinuousMove() (if moving)
        ↓
    Emit 'move' immediately
        ↓
    Create interval (50ms)
        └── [Loop] Emit 'move' + Update predictedPosition
```

### 6️⃣ REALTIME EVENTS
```
player_move → Update position (if my bot)
new_bomb → Callback: onNewBomb
bomb_explode → Callback: onBombExplode
user_die_update → Check if bot died/killed
chest_destroyed → Callback: onChestDestroyed
item_collected → Callback: onItemCollected
```

## 🔑 Các điều kiện quan trọng

### Bot có thể hành động khi:
```
✅ isGameStarted = true
✅ isRunning = true
✅ socket != null
```

### Environment:
```
Dev Mode:
  └── isGameStarted = true (từ constructor)

Competition Mode:
  ├── isGameStarted = false (từ constructor)
  └── Đợi 'start' event → isGameStarted = true
```

## 📍 Position Tracking

### Ưu tiên vị trí:
```
getCurrentPosition()
    ↓
1. lastConfirmedPosition (từ server)
    ↓ (nếu không có)
2. myBomberInfo.x, myBomberInfo.y
    ↓ (nếu không có)
3. null
```

### Flow update:
```
Send move → predictedPosition = predict(current, direction)
Receive player_move → lastConfirmedPosition = {x, y}
```

## 🚀 Movement Comparison

### Single Move (Legacy):
```
❌ Gửi 1 lần mỗi 500ms
❌ Di chuyển giật lag
❌ Không đồng bộ với game
```

### Continuous Move (New):
```
✅ Gửi 20 lần/giây (50ms)
✅ Di chuyển mượt mà
✅ Auto-stop khi đổi hướng
✅ Tránh spam khi di chuyển cùng hướng
```

## 🎮 AI Strategies (Priority)

```
1. Escape (100)     ← Thoát khỏi nguy hiểm
2. Attack (80)      ← Tấn công đối thủ
3. Defense (70)     ← Phòng thủ
4. Collect (60)     ← Thu thập items
5. WallBreak (50)   ← Phá tường
6. Explore (40)     ← Khám phá
7. SmartNav (30)    ← Di chuyển thông minh
```

## 📊 Key Metrics

| Metric | Value |
|--------|-------|
| Bot Logic Loop | 500ms |
| Movement Send | 50ms (20/sec) |
| Position Update | Realtime |
| AI Strategies | 7 |
| Event Listeners | 11 |

## 🔍 Debug Quick Commands

```typescript
// Status
bot.isConnected()     // Socket status
bot.isGameRunning()   // Game running?
bot.isActive()        // Bot active?

// Position
bot.socketConnection.getCurrentPosition()
bot.socketConnection.predictedPosition
bot.socketConnection.lastConfirmedPosition

// Movement
bot.socketConnection.currentDirection  // Direction or null
bot.socketConnection.moveInterval      // Interval ID

// Info
bot.getBotInfo()      // Full bomber info
bot.getGameStats()    // Game stats
bot.getGameState()    // Full game state
```

## 🗂️ File Structure

```
src/
├── bombermanBot.ts              ← Main bot + callbacks
├── index.ts                     ← Entry point
├── connection/
│   └── socketConnection.ts      ← Socket.IO + Movement + Position
├── ai/
│   └── bombermanAI.ts          ← AI decision engine
├── game/
│   └── gameEngine.ts           ← Game state manager
├── strategies/                  ← 7 AI strategies
└── __tests__/                  ← Unit tests
```

## 📚 Documentation Files

```
docs/
├── README.md                    ← Doc index
├── CODE_FLOW.md                ← Complete flow (THIS)
├── RECENT_UPDATES.md           ← Latest changes
├── QUICK_REFERENCE.md          ← Quick ref + diagrams
├── POSITION_TRACKING.md        ← Position system
├── MOVEMENT_GUIDE.md           ← Movement guide
├── BOMB_STRATEGY_FIX.md        ← Bomb strategy
└── HACKATHON_DEV_DOC.md        ← Dev guide
```

## ⚡ Quick Start

```bash
# Install & Build
npm install
npm run build

# Run
npm run dev          # Development
npm start           # Production
docker compose up   # Docker
```

## 🎯 Common Issues

### Bot không di chuyển?
```
1. Check isGameStarted = true
2. Check socket != null
3. Check isRunning = true
4. Check logs for errors
```

### Bot di chuyển giật?
```
1. Ensure using startContinuousMove()
2. Check network latency
3. Verify 50ms interval active
```

### Position không đúng?
```
1. Check lastConfirmedPosition
2. Compare with predictedPosition
3. Check player_move event logs
```

---

**Version:** 2.0.0 (Updated 10/10/2025)  
**Team:** Hackathon 2025
