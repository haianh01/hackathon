# Bomberman Bot - Hackathon 2025

Bot AI tham gia thi đấu Bomberman theo protocol Socket.IO của hackathon 2025.

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

# Production mode
npm start

# Test multiple servers
./test-servers.sh
```

### 4. Docker (Môi trường thi đấu)
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
- **Smart AI**: Hệ thống AI đa chiến lược
- **Map Processing**: Xử lý map 2D array theo protocol
- **Item Management**: Thu thập và quản lý items (S/R/B)
- **Bomb Strategy**: Đặt bom thông minh
- **Safety Checks**: Kiểm tra an toàn khi di chuyển

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
🚀 Khởi động bot...
🔌 Socket connected
📝 Đã gửi yêu cầu tham gia phòng chơi
📥 Nhận thông tin phòng chơi
🤖 Bot của chúng ta: BOT_NAME (uid)
🎯 Quyết định: MOVE UP - Tìm kiếm vật phẩm
```

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
**Version**: 2.0.0 (Updated for Socket.IO protocol)
