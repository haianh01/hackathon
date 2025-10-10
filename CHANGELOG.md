# Changelog

Tất cả các thay đổi quan trọng của dự án sẽ được ghi lại ở đây.

## [2.0.0] - 2025-10-10

### 🎉 Major Updates

#### ✨ Added
- **Continuous Movement System** - Di chuyển mượt mà với 50ms interval (20 lần/giây)
  - `startContinuousMove(direction)` - Bắt đầu di chuyển liên tục
  - `stopContinuousMove()` - Dừng di chuyển
  - Auto-detect cùng hướng để tránh spam
  - Auto-stop khi đổi hướng hoặc đặt bom
  
- **Position Tracking System** - Track vị trí realtime
  - `lastConfirmedPosition` - Vị trí confirmed bởi server
  - `predictedPosition` - Vị trí dự đoán tiếp theo
  - `getCurrentPosition()` - Lấy vị trí hiện tại (ưu tiên confirmed)
  - Update realtime qua `player_move` event
  
- **Realtime Event Callbacks** - Phản ứng nhanh với game events
  - `onNewBomb()` - Khi có bom mới
  - `onBombExplode()` - Khi bom nổ
  - `onUserDie()` - Khi có người chết (check if bot died/killed)
  - `onChestDestroyed()` - Khi rương bị phá
  - `onItemCollected()` - Khi item được nhặt
  - `onPositionUpdate()` - Khi bot di chuyển

#### 📚 Documentation
- Added `docs/RECENT_UPDATES.md` - Tài liệu các cải tiến mới nhất
- Added `docs/QUICK_REFERENCE.md` - Quick reference với diagrams
- Added `docs/README.md` - Documentation index
- Added `FLOW_SUMMARY.md` - Tóm tắt luồng chính
- Added `CHANGELOG.md` - File này
- Updated `docs/CODE_FLOW.md` - Flow chi tiết với continuous movement
- Updated `README.md` - Overview với tính năng mới
- Updated `.github/copilot-instructions.md` - Instructions cập nhật

#### 🔧 Improved
- **Logging** - Log chi tiết hơn với emojis
  - Log game state trước AI decision
  - Log AI decision trước execute
  - Log realtime events khi xảy ra
  - Log position updates
  
- **Environment Detection** - Detect chính xác hơn
  - Support `zarena-dev`, `localhost`, `127.0.0.1`
  - Auto-reset game trong dev mode
  - Không auto-reset trong competition mode

#### 🐛 Fixed
- Movement lag do chỉ gửi lệnh 1 lần mỗi 500ms
- Không track position thực tế của bot
- Chậm phản ứng với bom mới và bom nổ
- Không detect khi bot bị giết hoặc giết được địch

### 📝 Changed Files
```
src/
  ├── bombermanBot.ts                    - Added realtime callbacks
  └── connection/socketConnection.ts     - Added continuous move + position tracking

docs/
  ├── CODE_FLOW.md                       - Updated with new flow
  ├── RECENT_UPDATES.md                  - New file
  ├── QUICK_REFERENCE.md                 - New file
  └── README.md                          - New file

Root/
  ├── README.md                          - Updated with new features
  ├── FLOW_SUMMARY.md                    - New file
  ├── CHANGELOG.md                       - New file
  └── .github/copilot-instructions.md    - Updated
```

---

## [1.0.0] - Previous

### Initial Release
- Socket.IO integration với game server
- AI decision making với 7 strategies
- Game state management
- Basic movement system
- Bomb placement logic
- Map processing
- Item collection

### Features
- **Socket.IO Connection** - Real-time communication
- **Multi-Strategy AI** - 7 prioritized strategies
- **Game State Management** - Track game state
- **Basic Movement** - Single move commands
- **Bomb Placement** - Basic bomb logic
- **Safety Checks** - Danger zone detection

### AI Strategies
1. EscapeStrategy (100)
2. AttackStrategy (80)
3. DefensiveStrategy (70)
4. CollectStrategy (60)
5. WallBreakerStrategy (50)
6. ExploreStrategy (40)
7. SmartNavigationStrategy (30)

---

## Roadmap

### 🎯 Next Release (2.1.0)

#### High Priority
- [ ] Realtime danger zone updates
  - Update khi nhận `new_bomb` event
  - Remove khi nhận `bomb_explode` event
- [ ] Collision detection với predicted position
  - Check predicted position có hợp lệ không
  - Auto-stop nếu gặp tường/chướng ngại
- [ ] Optimize pathfinding với position tracking
  - Use confirmed position thay vì assume
  - Better route calculation

#### Medium Priority
- [ ] AI decision improvements
  - React faster to new bombs với realtime data
  - Better escape strategy với position tracking
  - Smarter attack with prediction
- [ ] Performance metrics
  - Track response time
  - Track accuracy of position prediction
  - Monitor network latency
- [ ] Smart throttling
  - Adaptive frequency based on network
  - Optimize network traffic

#### Low Priority
- [ ] Unit tests for continuous movement
- [ ] Integration tests for realtime events
- [ ] Advanced AI strategies
- [ ] Machine learning integration

---

## Version Format

Format: `[MAJOR.MINOR.PATCH]`

- **MAJOR**: Breaking changes, major features
- **MINOR**: New features, improvements
- **PATCH**: Bug fixes, small updates

---

## How to Update

Khi thêm thay đổi:

1. Update version trong `package.json`
2. Add entry vào CHANGELOG.md (file này)
3. Update `docs/RECENT_UPDATES.md`
4. Update `docs/CODE_FLOW.md` nếu flow thay đổi
5. Commit với message: `chore: release vX.X.X`

---

**Maintained by:** Hackathon 2025 Team  
**Last Updated:** 2025-10-10
