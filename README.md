# 🎮 Bomberman Bot - Zinza Hackathon 2025

## 📋 Mô Tả

Bot thông minh cho cuộc thi **Zinza Hackathon 2025 - BOOM ZARENA**, được phát triển bằng TypeScript với hệ thống AI đa chiến thuật để tự động chơi game Bomberman.

## ✨ Tính Năng

### 🧠 AI Thông Minh
- **Escape Strategy**: Thoát hiểm khi ở vùng nguy hiểm (Priority: 100)
- **Attack Strategy**: Tấn công kẻ thù và phá vật cản (Priority: 80)  
- **Defensive Strategy**: Phòng thủ và tránh xa kẻ thù (Priority: 70)
- **Collect Strategy**: Thu thập vật phẩm có giá trị (Priority: 60)
- **Wall Breaker Strategy**: Phá tường để tìm vật phẩm (Priority: 50)
- **Smart Navigation Strategy**: Điều hướng thông minh với A* pathfinding (Priority: 45)
- **Explore Strategy**: Khám phá bản đồ và tìm cơ hội (Priority: 40)

### 🎯 Chiến Thuật
- **Phân tích nguy hiểm**: Tính toán vùng nổ của bom và tìm đường thoát
- **Tấn công thông minh**: Đánh giá điểm số trước khi đặt bom
- **Thu thập tối ưu**: Ưu tiên vật phẩm theo giá trị và khoảng cách
- **Khám phá chiến thuật**: Di chuyển về trung tâm và tránh kẻ thù

### 🛠️ Kỹ Thuật
- **TypeScript**: Type-safe và maintainable
- **Modular Design**: Dễ mở rộng và tùy chỉnh
- **Unit Testing**: Test coverage với Jest
- **Error Handling**: Xử lý lỗi robust

## 🚀 Cài Đặt

```bash
# Clone repository
git clone <repository-url>
cd bomberman-bot

# Cài đặt dependencies
npm install

# Build project
npm run build

# Chạy tests
npm test

# Chạy development mode
npm run dev

# Chạy giao diện test
npm run serve
```

## 🎮 Giao Diện Test

Project bao gồm một giao diện web tương tác để test và debug bot:

### 🚀 Khởi Chạy Giao Diện Test

```bash
# Khởi động server giao diện test
npm run serve

# Hoặc chạy trên port tùy chỉnh
npx http-server public -p 8080 -o
```

Giao diện sẽ mở tự động tại `http://localhost:8080`

### ✨ Tính Năng Giao Diện

#### 🎮 Game Map
- **Visualization**: Hiển thị bản đồ game realtime
- **Interactive**: Click để refresh hoặc clear map
- **Color-coded**: Mỗi loại ô có màu sắc riêng biệt
  - 🟦 Player (Bot của bạn)
  - 🟩 Bots khác
  - ⬜ Tường bất diệt
  - 🟧 Tường có thể phá
  - 🟨 Power-ups
  - 🟥 Bombs
  - 🟪 Explosions

#### 🎛️ Bot Controls  
- **Start/Stop**: Điều khiển bot
- **Reset**: Reset AI về trạng thái mặc định
- **Manual Control**: Điều khiển thủ công bằng nút hoặc phím tắt
  - ⬆️⬇️⬅️➡️: Di chuyển
  - Spacebar: Đặt bom
- **AI Strategies**: Điều chỉnh priority của từng chiến thuật

#### 📊 Game Statistics
- **Score**: Điểm số hiện tại
- **Alive Bots**: Số bot còn sống
- **Time**: Thời gian còn lại
- **Position**: Vị trí hiện tại của bot

#### 📝 Game Logs
- **Real-time logging**: Theo dõi hoạt động của bot
- **Color-coded**: Phân loại theo mức độ (info, success, warning, error)
- **Auto-scroll**: Tự động cuộn xuống
- **Export**: Xuất logs ra file

#### 🧪 Test Input
- **JSON Input**: Nhập dữ liệu game để test
- **Sample Data**: Tải dữ liệu mẫu
- **Live Processing**: Xử lý dữ liệu realtime

### 🎯 Keyboard Shortcuts
- `↑↓←→`: Di chuyển bot
- `Space`: Đặt bom
- `Ctrl+C`: Dừng server

## 📁 Cấu Trúc Project

```
src/
├── types/           # Type definitions
│   ├── game.ts     # Game entities & states
│   └── index.ts    # Export types
├── utils/          # Utility functions
│   ├── position.ts # Position calculations
│   ├── gameLogic.ts# Game logic helpers
│   └── index.ts    # Export utils
├── strategies/     # AI Strategies
│   ├── baseStrategy.ts     # Base strategy class
│   ├── escapeStrategy.ts   # Escape from danger
│   ├── attackStrategy.ts   # Attack enemies
│   ├── collectStrategy.ts  # Collect items
│   ├── exploreStrategy.ts  # Explore map
│   └── index.ts           # Export strategies
├── ai/             # AI Engine
│   ├── bombermanAI.ts     # Main AI controller
│   └── index.ts           # Export AI
├── game/           # Game Engine
│   ├── gameEngine.ts      # Game state management
│   └── index.ts           # Export game
├── __tests__/      # Unit tests
│   ├── position.test.ts
│   ├── bombermanAI.test.ts
│   ├── gameEngine.test.ts
│   └── strategies.test.ts
├── bombermanBot.ts # Main Bot class
└── index.ts        # Entry point
```

## 🎮 Cách Sử Dụng

### Cơ Bản

```typescript
import { BombermanBot } from './src';

// Tạo bot instance
const bot = new BombermanBot();

// Khởi tạo
bot.initialize();

// Xử lý data từ game server
const gameData = {
  map: { /* map data */ },
  bots: [ /* bot data */ ],
  currentBotId: 'your-bot-id',
  timeRemaining: 300000
};

const action = bot.processGameData(gameData);
console.log(action); // "MOVE:RIGHT" hoặc "BOMB" hoặc "STOP"
```

### Tùy Chỉnh AI

```typescript
// Lấy thông tin strategies
const strategies = bot.getAIInfo();
console.log(strategies);

// Cập nhật priority
bot.updateStrategyPriority('Attack', 90);

// Reset về mặc định
bot.resetAI();
```

## 🧪 Testing

```bash
# Chạy tất cả tests
npm test

# Chạy với coverage
npm run test:coverage

# Chạy watch mode
npm run test:watch

# Lint code
npm run lint
npm run lint:fix
```

## 📊 Game Logic

### Tính Điểm
- **Hạ gục đối thủ**: 1000 điểm/mạng
- **Nhặt vật phẩm**: 10 điểm/vật phẩm
- **Phá tường**: 50 điểm (internal scoring)

### Vật Phẩm
- **Giày Speed**: Tăng tốc độ (max 3)
- **Liệt Hỏa**: Tăng phạm vi nổ bom
- **Đa Bom**: Tăng số lượng bom đặt được

### Bản Đồ
- **Kích thước**: 640x640
- **Bom**: Nổ sau 5 giây, phạm vi mặc định 2
- **Bot**: Tốc độ 1/2/3, 1 mạng sống

## 🔧 Cấu Hình

### TypeScript Config
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### Jest Config
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts']
};
```

## 🚀 Deployment

```bash
# Build production
npm run build

# Chạy built version
npm start

# Hoặc chạy trực tiếp TypeScript
npm run dev
```

## 🤝 Đóng Góp

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/amazing-strategy`)
3. Commit changes (`git commit -m 'Add amazing strategy'`)
4. Push to branch (`git push origin feature/amazing-strategy`)
5. Tạo Pull Request

## 📈 Performance Tips

- **Escape Priority**: Luôn ưu tiên thoát hiểm trước
- **Bomb Timing**: Đảm bảo có đường thoát trước khi đặt bom
- **Item Value**: Ưu tiên Speed > Flame > Bomb items
- **Map Control**: Điều khiển trung tâm bản đồ

## 🐛 Troubleshooting

### Lỗi TypeScript
```bash
npm run build  # Kiểm tra compile errors
```

### Lỗi Tests
```bash
npm run test:watch  # Debug tests interactively
```

### Performance Issues
- Kiểm tra game state parsing
- Optimize strategy evaluation
- Monitor memory usage

## 📝 License

MIT License - Zinza Hackathon 2025

## 👥 Team

Phát triển bởi đội thi Zinza Hackathon 2025

---

🎯 **Mục tiêu**: Trở thành Bot Bomberman thông minh nhất cuộc thi!

💪 **Chiến thuật**: Sống sót, thu thập, tấn công, và chiến thắng!

🏆 **Slogan**: "BOOM ZARENA - Where Intelligence Meets Explosion!"
