# Luồng Code Hiện Tại - Socket.IO Bomberman Bot

## 📊 Tổng quan Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    KHỞI TẠO BOT                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Constructor - BombermanBot                                   │
│     • Tạo AI instance (BombermanAI)                              │
│     • Tạo GameEngine instance                                    │
│     • Tạo SocketConnection instance                              │
│       - serverAddress (từ env hoặc param)                        │
│       - token (từ env hoặc param)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. SocketConnection Constructor                                 │
│     • Lưu serverAddress, token                                   │
│     • Kiểm tra môi trường:                                       │
│       ✓ Dev mode? (zarena-dev/localhost/127.0.0.1)              │
│       ✓ Competition mode?                                        │
│     • Set isGameStarted:                                         │
│       - Dev mode: true (game luôn chạy)                          │
│       - Competition: false (đợi 'start' event)                   │
│     • Khởi tạo position tracking:                                │
│       - predictedPosition: null                                  │
│       - lastConfirmedPosition: null                              │
│       - currentDirection: null                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INITIALIZE & CONNECT                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. bot.initialize()                                             │
│     • Gọi connectToServer()                                      │
│       - Setup callbacks (onGameData, onGameStart, onGameEnd)     │
│       - Setup realtime event callbacks                           │
│       - Gọi socketConnection.connect()                           │
│     • Setup bot logic loop (500ms interval)                      │
│     • Set isRunning = true                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. socketConnection.connect() - PROMISE                         │
│     • Tạo Socket.IO connection với:                              │
│       - serverAddress                                            │
│       - auth: { token }                                          │
│       - transports: ['websocket']                                │
│     • Setup event listeners NGAY SAU khi tạo socket              │
│     • Đợi 'connect' event                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Event: 'connect' (từ Socket.IO)                              │
│     ✅ Kết nối thành công!                                       │
│     • Log Socket ID                                              │
│     • Gọi joinGameRoom()                                         │
│     • Resolve promise → initialize() tiếp tục                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. joinGameRoom()                                               │
│     • Log "Gửi sự kiện 'join'..."                                │
│     • socket.emit('join', {})                                    │
│     ⏳ Đợi server phản hồi...                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WAITING FOR SERVER                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
         ┌──────────────────┐  ┌──────────────────┐
         │  Event: 'user'   │  │ Event: 'start'   │
         │  (Game state)    │  │ (Competition)    │
         └──────────────────┘  └──────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Event: 'user' (Nhận thông tin game)                         │
│     • Parse data.bombers                                         │
│     • Tìm myBomberInfo (uid === socket.id)                       │
│     • Update lastConfirmedPosition (x, y)                        │
│     • Log thông tin bot chi tiết:                                │
│       - Tên, UID, Vị trí                                         │
│       - Điểm, Sống?, Tốc độ                                      │
│       - Số bom, Phạm vi nổ                                       │
│     • Gọi onGameDataCallback()                                   │
│       → processGameData()                                        │
│         → gameEngine.updateGameState(gameData, socketId)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BOT LOGIC LOOP                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. executeBotLogic() (mỗi 500ms)                                │
│     • Kiểm tra isGameRunning() && isRunning                      │
│     • Nếu FALSE: return (không làm gì)                           │
│     • Nếu TRUE:                                                  │
│       1. Lấy gameState từ gameEngine.getGameState()              │
│       2. Log game state (bot info, enemies, bombs, items)        │
│       3. AI.makeDecision(gameState)                              │
│       4. executeAction(decision)                                 │
│          - MOVE → startContinuousMove(direction)                 │
│          - BOMB → stopContinuousMove() + placeBomb()             │
│          - STOP → stopContinuousMove()                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  9. Continuous Movement System                                   │
│     • startContinuousMove(direction):                            │
│       - Kiểm tra nếu đang di chuyển cùng hướng → skip            │
│       - Dừng di chuyển cũ (nếu có)                               │
│       - Gửi lệnh move ngay lập tức                               │
│       - Tạo interval gửi lệnh mỗi 50ms (20 lần/giây)             │
│       - Update predictedPosition mỗi lần gửi                     │
│     • stopContinuousMove():                                      │
│       - Clear interval                                           │
│       - Reset currentDirection = null                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GAME EVENTS (Continuous)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────────────────┐
        │                     │                                 │
        ▼                     ▼                                 ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐  ┌─────────────┐
│ player_move  │    │  new_bomb    │    │bomb_explode  │  │ user_die    │
│              │    │              │    │              │  │ _update     │
│ Update pos   │    │ Add to list  │    │ Remove bomb  │  │             │
│ if my bot    │    │              │    │              │  │ Check death │
└──────────────┘    └──────────────┘    └──────────────┘  └─────────────┘
        │                     │                     │              │
        └─────────────────────┴─────────────────────┴──────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Realtime Event Callbacks      │
              │  • onNewBomb                   │
              │  • onBombExplode              │
              │  • onChestDestroyed           │
              │  • onItemCollected            │
              │  • onUserDie (check if my bot)│
              │  • onPositionUpdate           │
              └───────────────────────────────┘
                              │
                              ▼
                    (Trigger callbacks nếu có)
                              │
                              ▼
                    (Bot tiếp tục chơi)
```

## 🔄 Chi tiết từng bước

### Bước 1: Khởi tạo Bot
```typescript
// src/index.ts
const bot = new BombermanBot(serverAddress, botToken);
```

**Thực hiện trong Constructor:**
```typescript
constructor(serverAddress?: string, botToken?: string) {
  this.ai = new BomberManAI();
  this.gameEngine = new GameEngine();
  
  // Sử dụng giá trị từ param hoặc env
  const address = serverAddress || "https://zarena-dev4.zinza.com.vn";
  const token = botToken || process.env.BOT_TOKEN || "";
  
  this.socketConnection = new SocketConnection(address, token);
}
```

### Bước 2: Socket Connection Constructor
```typescript
constructor(serverAddress: string, token: string) {
  this.serverAddress = serverAddress;
  this.token = token;
  
  // Phát hiện môi trường
  this.isDevelopmentMode = serverAddress.includes("zarena-dev") || 
                           serverAddress.includes("localhost") ||
                           serverAddress.includes("127.0.0.1");
  
  // Khởi tạo position tracking
  this.predictedPosition = null;
  this.lastConfirmedPosition = null;
  this.currentDirection = null;
  this.moveInterval = null;
  
  if (this.isDevelopmentMode) {
    this.isGameStarted = true;  // ← QUAN TRỌNG: Dev mode luôn true
    console.log("🔧 Development mode: Game sẽ tự động chạy");
  } else {
    this.isGameStarted = false; // Competition cần đợi 'start'
    console.log("🏆 Competition mode: Đợi sự kiện 'start'");
  }
}
```

**Điều kiện:**
- ✅ Dev mode: `isGameStarted = true` → Bot có thể hoạt động ngay
- ⏳ Competition mode: `isGameStarted = false` → Đợi event 'start'

### Bước 3: Initialize
```typescript
public async initialize(): Promise<void> {
  console.log("🚀 Khởi tạo Bomberman Bot...");
  
  try {
    // 1. Kết nối đến game server
    await this.connectToServer();
    
    // 2. Setup bot logic loop
    this.setupBotLogic();
    
    // 3. Đánh dấu bot đang chạy
    this.isRunning = true;
    console.log("✅ Bot đã sẵn sàng!");
  } catch (error) {
    console.error("❌ Lỗi khi khởi tạo bot:", error);
    throw error;
  }
}
```

### Bước 3.1: Connect to Server
```typescript
private async connectToServer(): Promise<void> {
  console.log("🔌 Đang kết nối đến server...");
  
  // Setup callbacks trước khi connect
  this.socketConnection.onGameData((data: UserResponse) => {
    this.processGameData(data);
  });
  
  this.socketConnection.onGameStart(() => {
    console.log("🎮 Game bắt đầu!");
    this.isRunning = true;
  });
  
  this.socketConnection.onGameEnd(() => {
    console.log("🏁 Game kết thúc!");
    if (!this.socketConnection.isDevelopment()) {
      this.isRunning = false;
    }
  });
  
  // Setup position update callback
  this.socketConnection.onPositionUpdate((x: number, y: number) => {
    console.log(`📍 Position updated: (${x}, ${y})`);
  });
  
  // Setup realtime event callbacks
  this.setupRealtimeEventCallbacks();
  
  // Kết nối
  await this.socketConnection.connect();
  console.log("🔌 đã kết nối đến server...");
}
```

### Bước 3.2: Setup Realtime Callbacks
```typescript
private setupRealtimeEventCallbacks(): void {
  // Callback khi có bom mới
  this.socketConnection.onNewBomb((data: any) => {
    console.log(`⚡ Realtime: Bom mới tại (${data.x}, ${data.y})`);
  });
  
  // Callback khi bom nổ
  this.socketConnection.onBombExplode((data: any) => {
    console.log(`⚡ Realtime: Bom nổ tại (${data.x}, ${data.y})`);
  });
  
  // Callback khi có người chết
  this.socketConnection.onUserDie((data: any) => {
    const myBomber = this.socketConnection.getMyBomberInfo();
    
    if (data.killed.uid === myBomber?.uid) {
      console.log("💀 Bot đã bị tiêu diệt!");
      this.isRunning = false;
    }
    
    if (data.killer.uid === myBomber?.uid) {
      console.log(`🎉 Bot đã hạ gục ${data.killed.name}! +${data.score} điểm`);
    }
  });
  
  // ... các callbacks khác
}
```

### Bước 4: Socket.IO Connect
```typescript
public connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Đang cố gắng kết nối tới ${this.serverAddress}...`);
    
    this.socket = io(this.serverAddress, {
      auth: { token: this.token },
      transports: ["websocket"]
    });
    
    this.socket.on("connect", () => {
      console.log(`✅ Đã kết nối thành công! Socket ID: ${this.socket?.id}`);
      this.joinGameRoom();  // ← TỰ ĐỘNG GỬI 'join'
      resolve();
    });
    
    // Setup event listeners NGAY SAU khi tạo socket
    this.setupEventListeners();
    
    this.socket.on("connect_error", (err: Error) => {
      console.error(`❌ Lỗi kết nối: ${err.message}`);
      reject(new Error(`Connection failed: ${err.message}`));
    });
  });
}
```

### Bước 5: Event 'connect'
```typescript
this.socket.on("connect", () => {
  console.log(`✅ Đã kết nối thành công! Socket ID: ${this.socket?.id}`);
  this.joinGameRoom();  // ← Gửi 'join' event
  resolve();            // ← Promise hoàn thành
});
```

**Kết quả:**
- Socket.IO đã kết nối
- Có Socket ID
- Sẵn sàng gửi/nhận events

### Bước 6: Join Game Room
```typescript
private joinGameRoom(): void {
  console.log("➡️ Gửi sự kiện 'join' để tham gia phòng chơi...");
  this.socket?.emit("join", {});  // ← QUAN TRỌNG
}
```

**Data gửi:**
```json
{
  "event": "join",
  "data": {}
}
```

### Bước 7: Setup Event Listeners
```typescript
private setupEventListeners(): void {
  if (!this.socket) return;
  
  // Event: Nhận thông tin game
  this.socket.on("user", (data: UserResponse) => {
    // Tìm bot của mình
    this.myBomberInfo = data.bombers.find(b => b.uid === this.socket?.id) || null;
    
    if (this.myBomberInfo) {
      console.log(`🤖 Bot của tôi (${this.myBomberInfo.name}) đã sẵn sàng.`);
      console.log(`📍 Vị trí: (${this.myBomberInfo.x}, ${this.myBomberInfo.y})`);
      // ... log chi tiết khác
      
      // Update confirmed position
      this.lastConfirmedPosition = {
        x: this.myBomberInfo.x,
        y: this.myBomberInfo.y
      };
    }
    
    // Callback để xử lý game data
    if (this.onGameDataCallback) {
      this.onGameDataCallback(data);
    }
  });
  
  // Event: Game bắt đầu (Competition mode)
  this.socket.on("start", (data: any) => {
    console.log(`🚨 GAME BẮT ĐẦU! Thời gian: ${data.start_at}`);
    this.isGameStarted = true;
    this.isDevelopmentMode = false;
    
    if (this.onGameStartCallback) {
      this.onGameStartCallback();
    }
  });
  
  // Event: Game kết thúc
  this.socket.on("finish", (data: any) => {
    console.log("🏁 GAME KẾT THÚC!");
    
    if (this.isDevelopmentMode) {
      console.log("🔄 Dev mode: Game sẽ tự động reset sau 5 phút");
      setTimeout(() => {
        this.isGameStarted = true;
      }, 1000);
    } else {
      this.isGameStarted = false;
    }
    
    if (this.onGameEndCallback) {
      this.onGameEndCallback();
    }
  });
  
  // Event: Player di chuyển
  this.socket.on("player_move", (data: any) => {
    if (data.uid === this.socket?.id) {
      console.log(`🎯 Bot di chuyển: (${data.x}, ${data.y})`);
      this.lastConfirmedPosition = { x: data.x, y: data.y };
      
      // Update myBomberInfo
      if (this.myBomberInfo) {
        this.myBomberInfo.x = data.x;
        this.myBomberInfo.y = data.y;
      }
      
      // Notify callback
      if (this.onPositionUpdateCallback) {
        this.onPositionUpdateCallback(data.x, data.y);
      }
    }
  });
  
  // Event: Bom mới
  this.socket.on("new_bomb", (data: any) => {
    console.log(`⬅️ Bom mới được đặt tại (${data.x}, ${data.y})`);
    if (this.onNewBombCallback) {
      this.onNewBombCallback(data);
    }
  });
  
  // Event: Bom nổ
  this.socket.on("bomb_explode", (data: any) => {
    console.log(`💥 Bom nổ tại (${data.x}, ${data.y})`);
    if (this.onBombExplodeCallback) {
      this.onBombExplodeCallback(data);
    }
  });
  
  // Event: User chết
  this.socket.on("user_die_update", (data: any) => {
    console.log(`💀 Bot ${data.killed.name} đã bị hạ gục bởi ${data.killer.name}!`);
    if (this.onUserDieCallback) {
      this.onUserDieCallback(data);
    }
  });
  
  // ... các events khác: chest_destroyed, item_collected, etc.
}
```

**Data nhận từ 'user' event:**
```typescript
{
  map: MapCell[][],           // Bản đồ game
  bombers: Bomber[],          // Danh sách bot
  bombs: ServerBomb[],        // Danh sách bom
  chests: ServerChest[],      // Rương
  items: ServerItem[]         // Items
}
```

### Bước 8: Process Game Data
```typescript
private processGameData(gameData: UserResponse): void {
  try {
    // Lấy Socket ID từ connection
    const myBotInfo = this.socketConnection.getMyBomberInfo();
    const socketId = myBotInfo?.uid;
    
    console.log(`🔍 Socket ID của bot: ${socketId}`);
    
    if (!socketId) {
      console.warn("⚠️ Chưa có thông tin bot, bỏ qua update");
      return;
    }
    
    // Cập nhật trạng thái game với Socket ID
    this.gameEngine.updateGameState(gameData, socketId);
    
    // Debug: Kiểm tra game state sau khi update
    const currentBot = this.gameEngine.getCurrentBot();
    console.log(`🤖 Current bot sau update:`, {
      id: currentBot.id,
      name: currentBot.name,
      position: currentBot.position,
      isAlive: currentBot.isAlive
    });
    
    // Kiểm tra game còn chạy không
    if (!this.gameEngine.isGameRunning()) {
      console.log("🏁 Game đã kết thúc hoặc bot không sống");
      return;
    }
    
    // Log stats
    const stats = this.gameEngine.getGameStats();
    console.log(`📊 Stats: Score=${stats.currentBotScore}, Enemies=${stats.aliveBots - 1}`);
  } catch (error) {
    console.error("❌ Lỗi khi xử lý game data:", error);
  }
}
```

### Bước 9: Bot Logic Loop (Mỗi 500ms)
```typescript
private setupBotLogic(): void {
  this.botLogicInterval = setInterval(() => {
    this.executeBotLogic();
  }, 500);
}

private executeBotLogic(): void {
  console.log(`🔍 Executing bot logic - Game running: ${this.socketConnection.isGameRunning()}, Bot running: ${this.isRunning}`);
  
  // ĐIỀU KIỆN CHẠY
  if (!this.socketConnection.isGameRunning() || !this.isRunning) {
    return;  // ← Không chạy nếu game chưa start
  }
  
  try {
    // 1. Lấy game state
    const gameState = this.gameEngine.getGameState();
    console.log(`🔍 Game state cho AI:`, {
      currentBot: {
        id: gameState.currentBot.id,
        name: gameState.currentBot.name,
        position: gameState.currentBot.position
      },
      enemies: gameState.enemies.length,
      bombs: gameState.map.bombs.length,
      items: gameState.map.items.length
    });
    
    // 2. AI đưa ra quyết định
    const decision = this.ai.makeDecision(gameState);
    console.log(`🤖 AI Decision:`, decision);
    
    // 3. Thực hiện hành động
    this.executeAction(decision);
  } catch (error) {
    console.error("❌ Lỗi trong bot logic:", error);
  }
}
```

**Điều kiện để Bot Logic chạy:**
```typescript
isGameRunning() = isGameStarted
                = true (Dev mode)
                = false (Competition, đợi 'start')

isRunning = true (sau initialize)
```

### Bước 10: Execute Action
```typescript
private executeAction(decision: BotDecision): void {
  switch (decision.action) {
    case BotAction.MOVE:
      if (decision.direction) {
        // ✅ Dùng continuous move để di chuyển mượt mà
        this.socketConnection.startContinuousMove(decision.direction);
      }
      break;
      
    case BotAction.BOMB:
      // Dừng di chuyển trước khi đặt bom
      this.socketConnection.stopContinuousMove();
      this.socketConnection.placeBomb();
      break;
      
    case BotAction.STOP:
      // Dừng di chuyển khi cần dừng
      this.socketConnection.stopContinuousMove();
      break;
      
    default:
      this.socketConnection.stopContinuousMove();
      break;
  }
}
```

### Bước 11: Continuous Movement System

#### 11.1. Start Continuous Move
```typescript
public startContinuousMove(direction: Direction): void {
  if (!this.isGameStarted || !this.socket) {
    return;
  }
  
  // Nếu đã đang di chuyển cùng hướng, không cần restart
  if (this.currentDirection === direction && this.moveInterval) {
    return;
  }
  
  // Dừng di chuyển cũ (nếu có)
  this.stopContinuousMove();
  
  // Lưu hướng hiện tại
  this.currentDirection = direction;
  
  // Gửi lệnh move ngay lập tức
  this.socket.emit("move", { orient: direction });
  console.log(`🔄 Bắt đầu di chuyển liên tục: ${direction}`);
  
  // Tạo interval để gửi lệnh move liên tục
  this.moveInterval = setInterval(() => {
    if (this.socket && this.isGameStarted) {
      this.socket.emit("move", { orient: direction });
      
      // Update predicted position
      const currentPos = this.getCurrentPosition();
      if (currentPos) {
        this.predictedPosition = this.predictNextPosition(currentPos, direction);
      }
    } else {
      this.stopContinuousMove();
    }
  }, 50); // Gửi mỗi 50ms (20 lần/giây) để di chuyển nhanh và mượt
}
```

#### 11.2. Stop Continuous Move
```typescript
public stopContinuousMove(): void {
  if (this.moveInterval) {
    clearInterval(this.moveInterval);
    this.moveInterval = null;
    this.currentDirection = null;
    console.log("⏹️ Dừng di chuyển liên tục");
  }
}
```

#### 11.3. Position Prediction
```typescript
private predictNextPosition(current: {x: number, y: number}, direction: Direction): {x: number, y: number} {
  const next = { ...current };
  
  switch (direction) {
    case Direction.UP:
      next.y -= 1;
      break;
    case Direction.DOWN:
      next.y += 1;
      break;
    case Direction.LEFT:
      next.x -= 1;
      break;
    case Direction.RIGHT:
      next.x += 1;
      break;
  }
  
  return next;
}

public getCurrentPosition(): {x: number, y: number} | null {
  // Ưu tiên vị trí được server confirm
  if (this.lastConfirmedPosition) {
    return this.lastConfirmedPosition;
  }
  
  // Fallback về vị trí từ myBomberInfo
  if (this.myBomberInfo) {
    return { x: this.myBomberInfo.x, y: this.myBomberInfo.y };
  }
  
  return null;
}
```

## 🎯 Điều kiện quan trọng

### Để Bot có thể di chuyển/đặt bom:

#### Single Move (Legacy)
```typescript
public move(direction: Direction): void {
  if (!this.isGameStarted || !this.socket) {
    return;  // ← ĐIỀU KIỆN
  }
  
  // Throttle nhẹ để tránh spam request
  const now = Date.now();
  if (now - this.lastMoveTime < this.moveThrottleMs) {
    return;
  }
  
  // Predict next position
  const currentPos = this.getCurrentPosition();
  if (currentPos) {
    this.predictedPosition = this.predictNextPosition(currentPos, direction);
  }
  
  this.lastMoveTime = now;
  console.log(`➡️ Move: ${direction}`);
  this.socket.emit("move", { orient: direction });
}
```

#### Continuous Move (Recommended)
```typescript
public startContinuousMove(direction: Direction): void {
  // Yêu cầu:
  // ✅ isGameStarted = true
  // ✅ socket != null (đã kết nối)
  // ✅ direction hợp lệ
  
  if (!this.isGameStarted || !this.socket) {
    return;
  }
  
  // Logic gửi lệnh liên tục mỗi 50ms...
}
```

#### Place Bomb
```typescript
public placeBomb(): void {
  if (this.isGameStarted && this.socket) {  // ← ĐIỀU KIỆN
    console.log("💣 Đặt bom!");
    this.socket.emit("place_bomb", {});
  }
}
```

**Yêu cầu:**
- ✅ `isGameStarted = true`
- ✅ `socket != null` (đã kết nối)

### Trong Development Mode:
```
✅ isGameStarted = true (từ constructor)
✅ Không cần đợi 'start' event
✅ Bot có thể hoạt động ngay sau khi nhận 'user' event
✅ Game tự động reset sau khi 'finish' event (1 giây)
```

### Trong Competition Mode:
```
❌ isGameStarted = false (từ constructor)
⏳ Phải đợi event 'start'
⏳ Khi nhận 'start': isGameStarted = true
✅ Sau đó bot mới có thể hoạt động
❌ Sau 'finish': isGameStarted = false (không tự động reset)
```

## 📌 Tóm tắt Flow chính

1. **Khởi tạo** → Create instances (AI, GameEngine, SocketConnection)
2. **Connect** → Socket.IO connection với auth token
3. **Setup Event Listeners** → Đăng ký tất cả event handlers
4. **Join** → Tự động gửi 'join' event khi kết nối thành công
5. **Receive 'user'** → Nhận thông tin bot & game, update position
6. **Setup Callbacks** → Đăng ký callbacks cho realtime events
7. **Bot Logic Loop** → Chạy mỗi 500ms
   - Kiểm tra điều kiện (isGameRunning && isRunning)
   - Lấy game state từ GameEngine
   - AI analyze & make decision
   - Execute action (continuous move/bomb)
8. **Continuous Movement** → Gửi lệnh mỗi 50ms cho di chuyển mượt
9. **Receive Events** → Update game state từ realtime events
   - player_move → update position
   - new_bomb → add to danger zones
   - bomb_explode → remove from danger zones
   - user_die_update → check if bot died/killed
10. **Repeat** → Quay lại bước 7

## ⚙️ State Machine

```
[Disconnected] 
    ↓ (connect)
[Connected] 
    ↓ (join sent)
[Waiting for user event]
    ↓ (user received)
[Has Bot Info]
    ↓ (setup callbacks)
[Callbacks Ready]
    ↓ (isGameStarted = true)
[Playing] ←────────┐
    ↓ (500ms)      │
[Get Game State]   │
    ↓              │
[AI Decision]      │
    ↓              │
[Execute Action]   │
    ↓              │
[Send Command] ────┘
    │ (continuous 50ms if moving)
    ↓
[Receive Events]
    ↓
[Update State]
    ↓
(Loop back to Playing)
```

## 🔍 Current Status Check

Để kiểm tra bot đang ở trạng thái nào:

```typescript
// 1. Đã kết nối?
bot.isConnected()  // Socket.IO connection status

// 2. Game đang chạy?
bot.isGameRunning()  // = isGameStarted

// 3. Có thông tin bot?
bot.getBotInfo()  // myBomberInfo with position, stats, etc.

// 4. Bot đang active?
bot.isActive()  // isRunning && isConnected()

// 5. Môi trường nào?
bot.socketConnection.isDevelopment()  // Dev vs Competition

// 6. Vị trí hiện tại?
bot.socketConnection.getCurrentPosition()  // lastConfirmedPosition or myBomberInfo

// 7. Đang di chuyển?
bot.socketConnection.currentDirection  // Direction or null

// 8. Game stats?
bot.getGameStats()  // Score, alive bots, etc.
```

## 🚀 Luồng Movement mới (Continuous Movement)

### Ưu điểm:
- ✅ Di chuyển mượt mà, không bị giật
- ✅ Gửi lệnh liên tục 20 lần/giây (50ms interval)
- ✅ Tự động dừng khi gặp chướng ngại
- ✅ Tránh spam lệnh khi đã đang di chuyển cùng hướng
- ✅ Position tracking với prediction và confirmation

### Flow:
```
AI Decision: MOVE RIGHT
    ↓
startContinuousMove(RIGHT)
    ↓
Check: đã di chuyển RIGHT? → Skip
    ↓
stopContinuousMove() (nếu đang di chuyển khác)
    ↓
Gửi lệnh MOVE RIGHT ngay lập tức
    ↓
Tạo interval 50ms
    ↓
[Mỗi 50ms]
    ├─ Gửi MOVE RIGHT
    ├─ Update predictedPosition
    └─ Check isGameStarted & socket
    ↓
[Khi nhận player_move event]
    ├─ Update lastConfirmedPosition
    └─ Update myBomberInfo.x, myBomberInfo.y
    ↓
[Khi cần dừng/đổi hướng]
    ↓
stopContinuousMove()
    ├─ Clear interval
    └─ Reset currentDirection
```

Đây là toàn bộ luồng code hiện tại đang hoạt động! 🚀
