# Cải Tiến Hiệu Suất Bot - Performance Enhancements

Tài liệu này mô tả các tính năng mới được thêm vào để cải thiện hiệu suất và độ chính xác của bot.

## 📋 Tổng quan các cải tiến

### 1. ✅ Position Predictor - Dự đoán vị trí với Timestamp
### 2. ✅ Latency Tracker - Theo dõi độ trễ mạng
### 3. ✅ Adaptive Loop Manager - Vòng lặp linh hoạt
### 4. ✅ Smart Logger - Logger thông minh
### 5. ✅ Command Acknowledgement - Xác nhận lệnh

---

## 1. Position Predictor

### Mục đích
Dự đoán vị trí chính xác hơn dựa trên **timestamp** và **tốc độ bot**, thay vì chỉ ±1 ô như trước.

### Cách hoạt động
```typescript
import { PositionPredictor } from './utils/positionPredictor';

// Vị trí confirm cuối cùng từ server
const lastConfirmed = {
  x: 5,
  y: 5,
  timestamp: Date.now() - 300 // 300ms trước
};

// Dự đoán vị trí hiện tại
const predicted = PositionPredictor.predictCurrentPosition(
  lastConfirmed,
  Direction.RIGHT,
  1 // speed
);

console.log(predicted);
// {
//   x: 6,
//   y: 5,
//   confidence: 0.7 // Độ tin cậy 70%
// }
```

### Các tính năng chính

#### 1.1. Dự đoán vị trí hiện tại
```typescript
predictCurrentPosition(
  lastConfirmed: PositionWithTimestamp,
  currentDirection: Direction | null,
  speed: number = 1
): { x: number; y: number; confidence: number }
```

- **lastConfirmed**: Vị trí được server confirm cuối cùng (có timestamp)
- **currentDirection**: Hướng đang di chuyển
- **speed**: Tốc độ di chuyển (mặc định 1)
- **Returns**: Vị trí dự đoán + độ tin cậy (confidence)

**Độ tin cậy (Confidence):**
- `1.0` (100%): Nếu không di chuyển hoặc < 100ms
- Giảm dần theo thời gian: `1.0 - (timePassed / 1000)`
- Tối thiểu `0.5` (50%)

#### 1.2. Dự đoán vị trí tiếp theo
```typescript
predictNextPosition(
  current: { x: number; y: number },
  direction: Direction,
  steps: number = 1
): { x: number; y: number }
```

- Dự đoán vị trí sau **N bước** di chuyển

#### 1.3. Kiểm tra cần điều chỉnh
```typescript
needsCorrection(
  predicted: { x: number; y: number },
  confirmed: { x: number; y: number }
): boolean
```

- Trả về `true` nếu prediction sai lệch quá 2 ô
- Dùng để detect và điều chỉnh prediction

### Ví dụ sử dụng

```typescript
// Trong SocketConnection
private lastConfirmedPosition: PositionWithTimestamp | null = null;

// Khi nhận player_move event
this.socket.on("player_move", (data: any) => {
  if (data.uid === this.socket?.id) {
    this.lastConfirmedPosition = {
      x: data.x,
      y: data.y,
      timestamp: Date.now()
    };
  }
});

// Khi cần lấy vị trí hiện tại
public getCurrentPosition(): { x: number; y: number } | null {
  if (!this.lastConfirmedPosition) return null;
  
  const predicted = PositionPredictor.predictCurrentPosition(
    this.lastConfirmedPosition,
    this.currentDirection,
    this.myBomberInfo?.speed || 1
  );
  
  return predicted;
}
```

---

## 2. Latency Tracker

### Mục đích
Theo dõi độ trễ kết nối để AI có thể điều chỉnh quyết định.

### Cách hoạt động
```typescript
import { LatencyTracker } from './utils/latencyTracker';

const latencyTracker = new LatencyTracker();

// Bắt đầu tracking (ping mỗi 5 giây)
latencyTracker.startTracking(socket, 5000);

// Lấy latency
const avg = latencyTracker.getAverageLatency(); // 85ms
const latest = latencyTracker.getLatestLatency(); // 92ms
const quality = latencyTracker.getConnectionQuality(); // "good"
```

### Các phương thức chính

#### 2.1. Bắt đầu tracking
```typescript
startTracking(socket: any, intervalMs: number = 5000): void
```

- Ping server mỗi `intervalMs` để đo latency

#### 2.2. Lấy thông tin latency
```typescript
getAverageLatency(): number        // Latency trung bình
getLatestLatency(): number         // Latency gần nhất
getMaxLatency(count = 5): number   // Latency max trong N lần gần nhất
getMinLatency(count = 5): number   // Latency min trong N lần gần nhất
getExpectedLatency(): number       // Latency dự kiến (max của 3 lần gần nhất)
```

#### 2.3. Kiểm tra chất lượng kết nối
```typescript
getConnectionQuality(): "excellent" | "good" | "fair" | "poor"
// excellent: < 50ms
// good: < 100ms
// fair: < 200ms
// poor: >= 200ms

isHighLatency(threshold = 200): boolean
```

#### 2.4. Lấy stats chi tiết
```typescript
getStats(): {
  average: number;
  latest: number;
  min: number;
  max: number;
  quality: string;
  sampleCount: number;
}
```

### Ví dụ sử dụng

```typescript
// Trong SocketConnection
private latencyTracker = new LatencyTracker();

public connect(): Promise<void> {
  // ... connect logic
  
  this.socket.on("connect", () => {
    // Bắt đầu tracking latency
    this.latencyTracker.startTracking(this.socket, 5000);
  });
}

// AI sử dụng latency để quyết định
public makeDecision(gameState: GameState): BotDecision {
  const latency = this.latencyTracker.getExpectedLatency();
  
  if (latency > 200) {
    // Latency cao: Chơi defensive, tránh move phức tạp
    return this.defensiveStrategy.execute(gameState);
  }
  
  // Latency thấp: Có thể chơi aggressive
  return this.attackStrategy.execute(gameState);
}
```

---

## 3. Adaptive Loop Manager

### Mục đích
Cho phép bot điều chỉnh tần suất vòng lặp dựa trên tình huống (escape nhanh khi gần bom).

### Cách hoạt động
```typescript
import { AdaptiveLoopManager, LoopPriority } from './utils/adaptiveLoopManager';

const loopManager = new AdaptiveLoopManager();

// Bắt đầu với 500ms interval
loopManager.start(() => {
  this.executeBotLogic();
}, LoopPriority.NORMAL);

// Khi gần bom: Chuyển sang EMERGENCY (100ms)
loopManager.setPriority(LoopPriority.EMERGENCY);

// Trigger ngay lập tức
loopManager.triggerEmergency();
```

### Loop Priorities

```typescript
enum LoopPriority {
  EMERGENCY = 100,  // Nguy hiểm khẩn cấp (100ms)
  HIGH = 200,       // Ưu tiên cao (200ms)
  NORMAL = 500,     // Bình thường (500ms)
  LOW = 1000,       // Thấp (1000ms)
}
```

### Các phương thức chính

#### 3.1. Quản lý vòng lặp
```typescript
start(callback: () => void, initialInterval = 500): void
stop(): void
setPriority(priority: LoopPriority): void
```

#### 3.2. Trigger khẩn cấp
```typescript
triggerEmergency(): void
// - Chạy callback ngay lập tức
// - Chuyển sang EMERGENCY priority trong 2 giây
// - Tự động quay lại priority trước đó

triggerNext(): void
// - Chạy callback ngay lập tức (one-time)
// - Không thay đổi priority
```

#### 3.3. Auto-adjust priority
```typescript
autoAdjustPriority(
  hasBombsNearby: boolean,
  hasEnemiesNearby: boolean,
  hasItemsNearby: boolean
): void
// Tự động điều chỉnh priority dựa trên game state
```

### Ví dụ sử dụng

```typescript
// Trong BombermanBot
private loopManager = new AdaptiveLoopManager();

private setupBotLogic(): void {
  // Thay thế setInterval cũ
  this.loopManager.start(() => {
    this.executeBotLogic();
  }, LoopPriority.NORMAL);
}

private executeBotLogic(): void {
  const gameState = this.gameEngine.getGameState();
  const botPos = gameState.currentBot.position;
  
  // Kiểm tra có bom gần không
  const hasBombsNearby = gameState.map.bombs.some(bomb => {
    const distance = manhattanDistance(botPos, bomb.position);
    return distance <= bomb.explosionRange + 1;
  });
  
  // Auto-adjust priority
  this.loopManager.autoAdjustPriority(
    hasBombsNearby,
    gameState.enemies.length > 0,
    gameState.map.items.length > 0
  );
  
  // AI decision...
}

// Setup realtime callbacks để trigger emergency
private setupRealtimeEventCallbacks(): void {
  this.socketConnection.onNewBomb((data: any) => {
    const botPos = this.gameEngine.getCurrentBot().position;
    const bombPos = { x: data.x, y: data.y };
    
    if (manhattanDistance(botPos, bombPos) <= data.explosionRange + 1) {
      // Bom mới gần bot → Trigger emergency!
      this.loopManager.triggerEmergency();
    }
  });
}
```

---

## 4. Smart Logger

### Mục đích
Logger thông minh có thể **tắt logging** trong competition mode để tăng hiệu suất.

### Cách hoạt động
```typescript
import { logger, LogCategory, LogLevel } from './utils/smartLogger';

// Development mode: Full logging
logger.setDevelopmentMode(true);

// Competition mode: Chỉ log ERROR
logger.setDevelopmentMode(false);

// Log theo category
logger.info(LogCategory.MOVEMENT, "Bot di chuyển", { x: 5, y: 5 });
logger.debug(LogCategory.AI, "AI decision", decision);
logger.error(LogCategory.SOCKET, "Socket error", error);
```

### Log Categories

```typescript
enum LogCategory {
  GENERAL = "GENERAL",
  SOCKET = "SOCKET",
  MOVEMENT = "MOVEMENT",
  AI = "AI",
  GAME_STATE = "GAME_STATE",
  POSITION = "POSITION",
  BOMB = "BOMB",
  PERFORMANCE = "PERFORMANCE",
}
```

### Log Levels

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}
```

### Các phương thức chính

#### 4.1. Configuration
```typescript
// Set development/competition mode
setDevelopmentMode(isDev: boolean): void

// Set minimum log level
setMinLevel(level: LogLevel): void

// Enable/disable category
setCategoryEnabled(category: LogCategory, enabled: boolean): void

// Disable/enable all
disableAll(): void
enableAll(): void
```

#### 4.2. Logging methods
```typescript
debug(category: LogCategory, message: string, ...args: any[]): void
info(category: LogCategory, message: string, ...args: any[]): void
warn(category: LogCategory, message: string, ...args: any[]): void
error(category: LogCategory, message: string, ...args: any[]): void
```

#### 4.3. Performance logging
```typescript
// Sync performance
performance(label: string, fn: () => void): void

// Async performance
performanceAsync<T>(label: string, fn: () => Promise<T>): Promise<T>
```

### Ví dụ sử dụng

```typescript
// Trong SocketConnection constructor
constructor(serverAddress: string, token: string) {
  // ...
  
  // Configure logger dựa trên môi trường
  logger.setDevelopmentMode(this.isDevelopmentMode);
  
  if (this.isDevelopmentMode) {
    logger.enableAll();
  } else {
    // Competition: Chỉ log ERROR
    logger.setMinLevel(LogLevel.ERROR);
  }
}

// Sử dụng logger
this.socket.on("player_move", (data: any) => {
  logger.debug(LogCategory.MOVEMENT, "Player move", data);
  // Chỉ hiện trong dev mode
});

// Performance logging
logger.performance("AI Decision", () => {
  const decision = this.ai.makeDecision(gameState);
  // Log thời gian thực thi
});

// Async performance
await logger.performanceAsync("Load Game Data", async () => {
  await this.loadGameData();
});
```

---

## 5. Command Acknowledgement System

### Mục đích
Xác nhận lệnh đã được server nhận, thay vì chỉ dựa vào event phản hồi sau đó.

### Cách hoạt động
```typescript
import { CommandAckSystem } from './utils/commandAckSystem';

const ackSystem = new CommandAckSystem();

// Gửi lệnh move với ack
ackSystem.sendMove(socket, Direction.RIGHT, (success, command) => {
  if (success) {
    console.log("✅ Move acknowledged");
  } else {
    console.log("❌ Move timeout");
  }
});

// Gửi lệnh place bomb với ack
ackSystem.sendPlaceBomb(socket, (success, command) => {
  if (success) {
    console.log("✅ Bomb placed");
  } else {
    console.log("❌ Bomb placement failed");
  }
});
```

### Các phương thức chính

#### 5.1. Gửi lệnh
```typescript
sendCommand(
  socket: any,
  type: CommandType,
  data: any,
  callback?: (success: boolean, command: PendingCommand) => void
): string

sendMove(socket: any, direction: Direction, callback?: CommandCallback): string

sendPlaceBomb(socket: any, callback?: CommandCallback): string
```

#### 5.2. Stats
```typescript
getPendingCount(): number
hasPending(): boolean
getStats(): { pending: number; types: { [key: string]: number } }
```

#### 5.3. Configuration
```typescript
setTimeout(ms: number): void  // Đặt timeout (mặc định 1000ms)
clear(): void                 // Clear all pending commands
```

### Ví dụ sử dụng

```typescript
// Trong SocketConnection
private ackSystem = new CommandAckSystem();

public startContinuousMove(direction: Direction): void {
  // ...
  
  // Gửi lệnh move với ack
  this.ackSystem.sendMove(this.socket, direction, (success, command) => {
    if (!success) {
      logger.warn(LogCategory.MOVEMENT, "Move command timeout, resending...");
      // Retry logic
    }
  });
  
  // Interval để gửi liên tục
  this.moveInterval = setInterval(() => {
    this.ackSystem.sendMove(this.socket, direction);
  }, 50);
}

public placeBomb(): void {
  this.ackSystem.sendPlaceBomb(this.socket, (success, command) => {
    if (success) {
      logger.info(LogCategory.BOMB, "Bomb placed successfully");
    } else {
      logger.error(LogCategory.BOMB, "Failed to place bomb");
    }
  });
}
```

---

## 📊 Tổng hợp Integration

### Cách tích hợp tất cả vào bot

```typescript
// Trong BombermanBot

import {
  PositionPredictor,
  LatencyTracker,
  AdaptiveLoopManager,
  logger,
  CommandAckSystem,
  LoopPriority,
  LogCategory
} from './utils';

export class BombermanBot {
  private loopManager = new AdaptiveLoopManager();
  
  constructor() {
    // Configure logger
    logger.setDevelopmentMode(this.socketConnection.isDevelopment());
  }
  
  private async connectToServer(): Promise<void> {
    await this.socketConnection.connect();
    
    // Setup realtime callbacks với emergency trigger
    this.setupRealtimeEventCallbacks();
  }
  
  private setupBotLogic(): void {
    // Sử dụng adaptive loop
    this.loopManager.start(() => {
      this.executeBotLogic();
    }, LoopPriority.NORMAL);
  }
  
  private executeBotLogic(): void {
    logger.performance("Bot Logic", () => {
      const gameState = this.gameEngine.getGameState();
      
      // Auto-adjust priority
      const botPos = gameState.currentBot.position;
      const hasBombsNearby = this.checkBombsNearby(botPos, gameState);
      
      this.loopManager.autoAdjustPriority(
        hasBombsNearby,
        gameState.enemies.length > 0,
        gameState.map.items.length > 0
      );
      
      // AI decision
      const decision = this.ai.makeDecision(gameState);
      
      // Execute action
      this.executeAction(decision);
    });
  }
  
  private setupRealtimeEventCallbacks(): void {
    this.socketConnection.onNewBomb((data: any) => {
      const botPos = this.gameEngine.getCurrentBot().position;
      const bombPos = { x: data.x, y: data.y };
      
      if (PositionPredictor.manhattanDistance(botPos, bombPos) <= data.explosionRange + 1) {
        logger.warn(LogCategory.BOMB, "Bomb nearby! Emergency escape!");
        this.loopManager.triggerEmergency();
      }
    });
  }
}
```

### Trong SocketConnection

```typescript
export class SocketConnection {
  private latencyTracker = new LatencyTracker();
  private ackSystem = new CommandAckSystem();
  
  public connect(): Promise<void> {
    // ...
    
    this.socket.on("connect", () => {
      // Start latency tracking
      this.latencyTracker.startTracking(this.socket, 5000);
      
      // Configure logger
      logger.setDevelopmentMode(this.isDevelopmentMode);
    });
  }
  
  public startContinuousMove(direction: Direction): void {
    // Sử dụng ack system
    this.ackSystem.sendMove(this.socket, direction, (success) => {
      if (!success) {
        logger.warn(LogCategory.MOVEMENT, "Move timeout");
      }
    });
    
    // ...
  }
  
  public getCurrentPosition(): { x: number; y: number } | null {
    if (!this.lastConfirmedPosition) return null;
    
    // Sử dụng position predictor
    const predicted = PositionPredictor.predictCurrentPosition(
      this.lastConfirmedPosition,
      this.currentDirection,
      this.myBomberInfo?.speed || 1
    );
    
    return predicted;
  }
}
```

---

## 🎯 Lợi ích của các cải tiến

### 1. Position Predictor
- ✅ Dự đoán vị trí chính xác hơn
- ✅ Tính đến tốc độ và thời gian thực tế
- ✅ Độ tin cậy giảm dần theo thời gian

### 2. Latency Tracker
- ✅ Hiểu rõ chất lượng kết nối
- ✅ AI điều chỉnh chiến lược dựa trên latency
- ✅ Phát hiện lag spike

### 3. Adaptive Loop Manager
- ✅ Phản ứng nhanh khi nguy hiểm
- ✅ Tiết kiệm tài nguyên khi không cần
- ✅ Emergency trigger cho bom gần

### 4. Smart Logger
- ✅ Tăng hiệu suất trong competition (tắt log)
- ✅ Debug tốt hơn trong development
- ✅ Performance profiling

### 5. Command Acknowledgement
- ✅ Đảm bảo lệnh được server nhận
- ✅ Retry logic khi timeout
- ✅ Theo dõi pending commands

---

## 📝 Next Steps

1. **Testing**: Test từng tính năng riêng lẻ
2. **Integration**: Tích hợp vào bot chính
3. **Tuning**: Điều chỉnh thresholds và parameters
4. **Monitoring**: Theo dõi performance trong competition

## 🔗 Files liên quan

- `src/utils/positionPredictor.ts`
- `src/utils/latencyTracker.ts`
- `src/utils/adaptiveLoopManager.ts`
- `src/utils/smartLogger.ts`
- `src/utils/commandAckSystem.ts`
