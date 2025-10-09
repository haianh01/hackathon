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
│     • Tạo AI instance                                            │
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
│       ✓ Dev mode? (zarena-dev/localhost)                        │
│       ✓ Competition mode?                                        │
│     • Set isGameStarted:                                         │
│       - Dev mode: true (game luôn chạy)                          │
│       - Competition: false (đợi 'start' event)                   │
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
│     • Setup bot logic loop                                       │
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
│     • Setup event listeners                                      │
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
│     • Log thông tin môi trường (Dev/Competition)                 │
│     • Gửi event: socket.emit('join', {})                         │
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
│     • Log thông tin bot chi tiết                                 │
│     • Gọi onGameDataCallback()                                   │
│       → processGameData()                                        │
│         → gameEngine.updateGameState()                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BOT LOGIC LOOP                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. setupBotLogic() (mỗi 500ms)                                  │
│     • Kiểm tra isGameRunning() && isRunning                      │
│     • Nếu TRUE:                                                  │
│       1. Lấy gameState từ gameEngine                             │
│       2. AI.makeDecision(gameState)                              │
│       3. executeAction(decision)                                 │
│          - MOVE → socket.emit('move', {orient})                  │
│          - BOMB → socket.emit('place_bomb', {})                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GAME EVENTS (Continuous)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ player_move  │    │  new_bomb    │    │bomb_explode  │
└──────────────┘    └──────────────┘    └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    (Cập nhật game state)
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

**Thực hiện:**
- Tạo `BombermanAI` instance
- Tạo `GameEngine` instance
- Tạo `SocketConnection` với serverAddress và token

### Bước 2: Socket Connection Constructor
```typescript
constructor(serverAddress: string, token: string) {
  this.serverAddress = serverAddress;
  this.token = token;
  
  // Phát hiện môi trường
  this.isDevelopmentMode = serverAddress.includes("zarena-dev") || 
                           serverAddress.includes("localhost");
  
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
// BombermanBot.initialize()
await bot.initialize();

// Bên trong:
await this.connectToServer();  // Kết nối Socket.IO
this.setupBotLogic();          // Setup interval 500ms
this.isRunning = true;         // Cho phép bot chạy
```

### Bước 4: Connect to Server
```typescript
public connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.socket = io(this.serverAddress, {
      auth: { token: this.token },
      transports: ["websocket"]
    });
    
    this.socket.on("connect", () => {
      // Kết nối thành công
      this.joinGameRoom();  // ← TỰ ĐỘNG GỬI 'join'
      resolve();
    });
    
    this.setupEventListeners(); // Setup tất cả event handlers
  });
}
```

### Bước 5: Event 'connect'
```typescript
this.socket.on("connect", () => {
  console.log(`✅ Socket ID: ${this.socket?.id}`);
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
  console.log("➡️ Gửi sự kiện 'join'...");
  
  // Hiển thị thông tin môi trường
  if (this.isDevelopmentMode) {
    console.log("🔧 Development Mode:");
    console.log("   • Game tự động chạy liên tục");
    // ...
  }
  
  // GỬI EVENT JOIN
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

### Bước 7: Event 'user' (Phản hồi từ server)
```typescript
this.socket.on("user", (data: UserResponse) => {
  // Tìm bot của mình
  this.myBomberInfo = data.bombers.find(b => b.uid === this.socket?.id);
  
  if (this.myBomberInfo) {
    // Log thông tin bot
    console.log(`🤖 Bot: ${this.myBomberInfo.name}`);
    console.log(`📍 Vị trí: (${this.myBomberInfo.x}, ${this.myBomberInfo.y})`);
    // ...
  }
  
  // Callback để xử lý game data
  if (this.onGameDataCallback) {
    this.onGameDataCallback(data);  // → processGameData()
  }
});
```

**Data nhận:**
```typescript
{
  map: MapCell[][],           // Bản đồ game
  bombers: Bomber[],          // Danh sách bot
  bombs: ServerBomb[],        // Danh sách bom
  chests: ServerChest[],      // Rương
  items: ServerItem[]         // Items
}
```

### Bước 8: Bot Logic Loop (Mỗi 500ms)
```typescript
private setupBotLogic(): void {
  this.botLogicInterval = setInterval(() => {
    this.executeBotLogic();
  }, 500);
}

private executeBotLogic(): void {
  // ĐIỀU KIỆN CHẠY
  if (!this.socketConnection.isGameRunning() || !this.isRunning) {
    return;  // ← Không chạy nếu game chưa start
  }
  
  // 1. Lấy game state
  const gameState = this.gameEngine.getGameState();
  
  // 2. AI đưa ra quyết định
  const decision = this.ai.makeDecision(gameState);
  
  // 3. Thực hiện hành động
  this.executeAction(decision);
}
```

**Điều kiện để Bot Logic chạy:**
```typescript
isGameRunning() = isGameStarted
                = true (Dev mode)
                = false (Competition, đợi 'start')

isRunning = true (sau initialize)
```

### Bước 9: Execute Action
```typescript
private executeAction(decision: BotDecision): void {
  switch (decision.action) {
    case BotAction.MOVE:
      this.socketConnection.move(decision.direction);
      // → socket.emit('move', { orient: direction })
      break;
      
    case BotAction.BOMB:
      this.socketConnection.placeBomb();
      // → socket.emit('place_bomb', {})
      break;
  }
}
```

## 🎯 Điều kiện quan trọng

### Để Bot có thể di chuyển/đặt bom:
```typescript
public move(direction: Direction): void {
  if (this.isGameStarted && this.socket) {  // ← ĐIỀU KIỆN
    this.socket.emit("move", { orient: direction });
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
```

### Trong Competition Mode:
```
❌ isGameStarted = false (từ constructor)
⏳ Phải đợi event 'start'
⏳ Khi nhận 'start': isGameStarted = true
✅ Sau đó bot mới có thể hoạt động
```

## 📌 Tóm tắt Flow chính

1. **Khởi tạo** → Create instances
2. **Connect** → Socket.IO connection
3. **Join** → Tự động gửi 'join' event
4. **Receive 'user'** → Nhận thông tin bot & game
5. **Bot Logic Loop** → Chạy mỗi 500ms
6. **Make Decision** → AI analyze game state
7. **Execute Action** → Gửi 'move' hoặc 'place_bomb'
8. **Receive Events** → Update game state
9. **Repeat** → Quay lại bước 5

## ⚙️ State Machine

```
[Disconnected] 
    ↓ (connect)
[Connected] 
    ↓ (join sent)
[Waiting for user event]
    ↓ (user received)
[Has Bot Info]
    ↓ (isGameStarted = true)
[Playing] ← ┐
    ↓ (500ms) │
[AI Decision] │
    ↓         │
[Send Action]─┘
```

## 🔍 Current Status Check

Để kiểm tra bot đang ở trạng thái nào:

```typescript
// 1. Đã kết nối?
bot.isConnected()  // Socket.IO connection

// 2. Game đang chạy?
bot.isGameRunning()  // = isGameStarted

// 3. Có thông tin bot?
bot.getBotInfo()  // myBomberInfo

// 4. Bot đang active?
bot.isActive()  // isRunning && isConnected()

// 5. Môi trường nào?
bot.socketConnection.isDevelopment()  // Dev vs Competition
```

Đây là toàn bộ luồng code hiện tại đang hoạt động! 🚀
