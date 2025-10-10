# Bomberman Bot - Hackathon 2025

Bot AI tham gia thi đấu Bomberman theo protocol Socket.IO của hackathon 2025.

## ✨ Tính năng mới (Updated 10/10/2025)

### 🎯 Continuous Movement System
- Di chuyển mượt mà với 20 lần/giây (50ms interval)
- Tự động dừng khi gặp chướng ngại hoặc cần đổi hướng
- Không spam lệnh khi đã đang di chuyển cùng hướng

### 📍 Position Tracking
- Track vị trí realtime với server confirmation
- Predict vị trí tiếp theo cho decision making
- Update position ngay lập tức khi nhận `player_move` event

### ⚡ Realtime Event Callbacks
- Phản ứng nhanh với bom mới (`new_bomb`)
- Xử lý bom nổ realtime (`bomb_explode`)
- Detect khi bot bị giết hoặc giết được địch (`user_die_update`)
- Track items và chest realtime

📖 **Chi tiết:** [Recent Updates](./docs/RECENT_UPDATES.md) | [Code Flow](./docs/CODE_FLOW.md)

## 🚀 Cách sử dụng

### 1. Chuẩn bị môi trường

```bash
# Install dependencies
npm install

# Build project
npm run build
```

### 2. Cấu hình

File `.env` đã được cấu hình sẵn với servers test:

```env
# Test Server Options (choose one)
SOCKET_SERVER=https://zarena-dev4.zinza.com.vn

# Bot authentication token  
BOT_TOKEN=s9vq3n7y

# Basic auth for test servers
BASIC_AUTH_USER=hackathon2025
BASIC_AUTH_PASS=hackathon@2025#
```

**Servers test có sẵn:**
- Server #1: `https://zarena-dev1.zinza.com.vn` (Client: https://zarena1.zinza.com.vn)
- Server #2: `https://zarena-dev2.zinza.com.vn` (Client: https://zarena2.zinza.com.vn)  
- Server #3: `https://zarena-dev3.zinza.com.vn` (Client: https://zarena3.zinza.com.vn)
- Server #4: `https://zarena-dev4.zinza.com.vn` (Client: https://zarena4.zinza.com.vn)

### 3. Chạy bot

```bash
# Development mode
npm run dev

# Production mode với Socket.IO
npm run build
npm run start:socketio

# Development mode với Socket.IO
npm run dev:socketio

# Test multiple servers
./test-servers.sh
```

### 4. Socket.IO Integration

Bot đã được tích hợp đầy đủ với Socket.IO để kết nối trực tiếp với server game:

- **Kết nối tự động**: Tự động kết nối và tham gia phòng game
- **Real-time events**: Xử lý tất cả events từ server (game start/end, player moves, bombs, etc.)
- **AI-driven actions**: AI tự động đưa ra quyết định và gửi actions lên server
- **Graceful shutdown**: Xử lý ngắt kết nối an toàn

Chi tiết xem [Socket.IO Integration Guide](./SOCKETIO_GUIDE.md)

### 5. Docker (Môi trường thi đấu)
npm run dev

# Production mode
npm start
```

### 4. Docker (Môi trường thi đấu)

```bash
# Build image
docker build -t bomberman-bot .

# Run with docker-compose
docker compose up bot
```

## 📋 Protocol theo Hackathon 2025

Bot được thiết kế theo đúng protocol Socket.IO như yêu cầu:

### Sự kiện gửi từ Bot:
- **join**: Tham gia phòng chơi
- **move**: Di chuyển (orient: UP/DOWN/LEFT/RIGHT)
- **place_bomb**: Đặt bom

### Sự kiện nhận từ Server:
- **user**: Thông tin phòng chơi khi tham gia
- **start**: Bắt đầu game (môi trường thi đấu)
- **player_move**: Bot di chuyển
- **new_bomb**: Bom mới được đặt
- **bomb_explode**: Bom phát nổ
- **map_update**: Cập nhật map
- **user_die_update**: Bot bị hạ gục
- **new_life**: Bot hồi sinh (môi trường luyện tập)
- **chest_destroyed**: Hòm đồ bị phá
- **item_collected**: Item được thu thập
- **user_disconnect**: Bot thoát
- **finish**: Kết thúc game (môi trường thi đấu)

## 🧠 AI Strategies

Bot sử dụng hệ thống multi-strategy với priority:

1. **EscapeStrategy** (Priority: 100) - Thoát khỏi nguy hiểm
2. **AttackStrategy** (Priority: 80) - Tấn công đối thủ
3. **DefensiveStrategy** (Priority: 70) - Phòng thủ
4. **CollectStrategy** (Priority: 60) - Thu thập items
5. **WallBreakerStrategy** (Priority: 50) - Phá tường
6. **ExploreStrategy** (Priority: 40) - Khám phá bản đồ
7. **SmartNavigationStrategy** (Priority: 30) - Di chuyển thông minh

### 🔄 Movement Flow
```
AI Decision → Execute Action → Continuous Move
    ↓              ↓                  ↓
  MOVE RIGHT   startContinuousMove   Send every 50ms
    ↓              ↓                  ↓
  Update State   Track Position   Server Confirm
```

## 📚 Documentation

- [📖 Code Flow](./docs/CODE_FLOW.md) - Luồng code chi tiết với diagrams
- [🆕 Recent Updates](./docs/RECENT_UPDATES.md) - Các cải tiến mới nhất
- [📍 Position Tracking](./docs/POSITION_TRACKING.md) - Hệ thống tracking vị trí
- [🎮 Movement Guide](./docs/MOVEMENT_GUIDE.md) - Hướng dẫn movement system
- [💣 Bomb Strategy](./docs/BOMB_STRATEGY_FIX.md) - Chiến thuật đặt bom
- [🏗️ Dev Guide](./docs/HACKATHON_DEV_DOC.md) - Hướng dẫn development

## 🔧 Cấu trúc dự án

```
src/
├── bombermanBot.ts          # Main bot class với Socket.IO
├── index.ts                 # Entry point
├── ai/                      # AI engine
├── game/                    # Game state management
├── strategies/              # AI strategies
├── types/                   # TypeScript types (cập nhật theo protocol)
└── utils/                   # Utilities
```

## 📦 Docker Configuration

Dockerfile được tối ưu cho môi trường thi đấu:

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
# ... build stage

FROM node:20-alpine
# ... production stage
CMD ["node", "dist/index.js"]
```

## 🎮 Game Features

- **Socket.IO Authentication**: Authenticate với token
- **Real-time Events**: Xử lý events real-time từ server
- **Continuous Movement**: Di chuyển mượt mà 20 lần/giây
- **Position Tracking**: Track vị trí realtime với server confirmation
- **Smart AI**: Hệ thống AI đa chiến lược với priority
- **Map Processing**: Xử lý map 2D array theo protocol
- **Item Management**: Thu thập và quản lý items (S/R/B)
- **Bomb Strategy**: Đặt bom thông minh với escape route
- **Safety Checks**: Kiểm tra an toàn khi di chuyển
- **Realtime Callbacks**: Phản ứng nhanh với game events

## 🔄 Architecture

```
BombermanBot
    ├── BombermanAI (Decision Making)
    │   ├── EscapeStrategy (Priority: 100)
    │   ├── AttackStrategy (Priority: 80)
    │   ├── DefensiveStrategy (Priority: 70)
    │   ├── CollectStrategy (Priority: 60)
    │   ├── WallBreakerStrategy (Priority: 50)
    │   ├── ExploreStrategy (Priority: 40)
    │   └── SmartNavigationStrategy (Priority: 30)
    │
    ├── GameEngine (State Management)
    │   ├── Update game state from server
    │   ├── Manage bombs, items, enemies
    │   └── Calculate danger zones
    │
    └── SocketConnection (Network)
        ├── Connect & authenticate
        ├── Send/receive events
        ├── Continuous movement (50ms)
        └── Position tracking
```

## 🔬 Development

```bash
# Development with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## 📝 Logs

Bot sẽ log các thông tin quan trọng:

```
🎮 Bomberman Bot - Zinza Hackathon 2025
🚀 Khởi tạo Bomberman Bot...
🔌 Đang kết nối đến server...
✅ Đã kết nối thành công! Socket ID: abc123
➡️ Gửi sự kiện 'join' để tham gia phòng chơi...
🤖 Bot của tôi (BOT_NAME) đã sẵn sàng.
📍 Vị trí: (100, 100)
🔄 Bắt đầu di chuyển liên tục: RIGHT
🔍 Executing bot logic - Game running: true, Bot running: true
🤖 AI Decision: { action: 'MOVE', direction: 'RIGHT', reason: '...' }
🎯 Bot di chuyển: (110, 100)
⚡ Realtime: Bom mới tại (120, 100)
💣 Đặt bom!
⏹️ Dừng di chuyển liên tục
```

## � Debug Tips

### Kiểm tra trạng thái bot:
```typescript
// Check connection
bot.isConnected()  // true/false

// Check game running
bot.isGameRunning()  // true/false (based on isGameStarted)

// Check bot active
bot.isActive()  // isRunning && isConnected()

// Get current position
bot.socketConnection.getCurrentPosition()  // { x: 100, y: 100 }

// Check movement
bot.socketConnection.currentDirection  // 'RIGHT' or null

// Get bot info
bot.getBotInfo()  // Full bomber info with stats

// Get game stats
bot.getGameStats()  // Score, alive bots, etc.
```

### Common Issues:

**Bot không di chuyển?**
- ✅ Check `isGameStarted = true` (dev mode) hoặc đã nhận `start` event
- ✅ Check `socket != null` (đã kết nối)
- ✅ Check `isRunning = true`

**Bot di chuyển giật?**
- ✅ Đảm bảo đang dùng `startContinuousMove()` thay vì `move()`
- ✅ Check network latency

**Position không đúng?**
- ✅ Check `lastConfirmedPosition` (từ server)
- ✅ So sánh với `predictedPosition`
- ✅ Xem logs `player_move` event

## ⚠️ Lưu ý quan trọng

1. **Môi trường thi đấu**: Bot chỉ di chuyển sau khi nhận event `start`
2. **Authentication**: Cần BOT_TOKEN hợp lệ từ BTC
3. **Map coordinates**: Sử dụng tọa độ pixel (x, y)
4. **Item types**: S (Speed), R (Range), B (Bomb Count)
5. **Socket events**: Tất cả communication qua Socket.IO

## 🏆 Chiến thuật

Bot được thiết kế với các chiến thuật thông minh:

- **Escape**: Ưu tiên thoát khỏi vùng nguy hiểm
- **Attack**: Tấn công khi có cơ hội
- **Collect**: Thu thập items để tăng sức mạnh  
- **Explore**: Khám phá map hiệu quả
- **Defense**: Phòng thủ khi cần thiết

---

**Team**: Zinza Hackathon 2025  
**Version**: 2.0.0 (Updated 10/10/2025)

## 📖 Documentation

Xem tài liệu đầy đủ tại [docs/README.md](./docs/README.md)

### 📑 Main Docs:
- [📊 Flow Summary](./FLOW_SUMMARY.md) - Tóm tắt luồng chính
- [📖 Code Flow](./docs/CODE_FLOW.md) - Luồng code chi tiết
- [🆕 Recent Updates](./docs/RECENT_UPDATES.md) - Cập nhật mới nhất
- [⚡ Quick Reference](./docs/QUICK_REFERENCE.md) - Tham khảo nhanh
- [📍 Position Tracking](./docs/POSITION_TRACKING.md) - Position system
- [🎯 Movement Guide](./docs/MOVEMENT_GUIDE.md) - Movement system
- [💣 Bomb Strategy](./docs/BOMB_STRATEGY_FIX.md) - Bomb strategy
- [🛠️ Dev Guide](./docs/HACKATHON_DEV_DOC.md) - Development guide
