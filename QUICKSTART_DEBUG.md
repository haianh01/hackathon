# 🚀 Quick Start - Hybrid Debug Mode (Manual + AI)

## Cách chạy nhanh nhất

### 1️⃣ Chạy Hybrid Mode (Manual + AI)

```bash
npm run manual
```

Hoặc:

```bash
npm run debug
```

## 🎮 Hai chế độ hoạt động

### MANUAL Mode 🎮
- Bạn điều khiển bot trực tiếp bằng bàn phím
- Debug từng bước di chuyển, đặt bomb
- Phù hợp để test collision, bomb timing, v.v.

### AUTO Mode 🤖
- **AI code của bạn** (BombermanAI) tự động điều khiển
- Giống như chạy `npm run dev` nhưng có thể can thiệp bất kỳ lúc nào
- Debug strategy, pathfinding, decision making

### 2️⃣ Các phím điều khiển

| Phím | Hành động |
|------|-----------|
| **M** | **🔄 Chuyển MANUAL ⟷ AUTO** |
| ↑ / W | Di chuyển LÊN (Manual only) |
| ↓ / S | Di chuyển XUỐNG (Manual only) |
| ← / A | Di chuyển TRÁI (Manual only) |
| → / D | Di chuyển PHẢI (Manual only) |
| Space / B | Đặt BOMB 💣 (Manual only) |
| X / Enter | DỪNG di chuyển (Manual only) |
| I | Xem trạng thái bot |
| H | Xem hướng dẫn |
| Ctrl+C | Thoát |

### 3️⃣ Ví dụ sử dụng

```bash
# Chạy hybrid control
$ npm run manual

# Bạn sẽ thấy:
🎮 Bomberman Hybrid Control - Zinza Hackathon 2025
🔄 Switch between MANUAL (keyboard) and AUTO (AI) modes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 Hybrid Bot Control (Manual + AI)
📡 Server: https://zarena-dev3.zinza.com.vn
🔑 Token: s9vq3n7y
✅ AI logic initialized (will activate in AUTO mode)
✅ Hybrid control ready!
📍 Mode: 🎮 MANUAL

# Scenario 1: Manual control để test
# 1. Phím → → → (di chuyển phải)
# 2. Phím Space (đặt bomb)
# 3. Phím ← ← ← (chạy trái tránh bomb)

# Scenario 2: Chuyển sang AUTO để xem AI hoạt động
# 1. Nhấn M (switch to AUTO)
# 2. Quan sát AI tự động đi, đặt bomb
# 3. Nhấn M lại (switch to MANUAL) để can thiệp

# Scenario 3: Debug AI decision
# 1. Nhấn M (AUTO mode)
# 2. Xem log: "🤖 [AI] Making decision..."
# 3. Xem AI chọn action gì và tại sao
# 4. Nhấn I để xem trạng thái
```

## 📝 Output mẫu

```
🏃 Moving RIGHT
📍 Position: (121, 80) | Cell: (3, 2)
🏃 Moving RIGHT
📍 Position: (122, 80) | Cell: (3, 2)
💣 Placing bomb!
💣 Bomb placed at (120, 80)
🏃 Moving LEFT
📍 Position: (121, 80) | Cell: (3, 2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BOT STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Name: MyBot
📍 Position: (121, 80)
📍 Cell: (3, 2)
💣 Bombs: 3
🔥 Explosion Range: 2
⚡ Speed: 1 (Speed Count: 0)
✅ Alive: true
🏆 Score: 150

🗺️ MAP INFO:
📦 Chests: 15
🎁 Items: 5
💣 Bombs: 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🎯 Use Cases

### Debug movement
```bash
npm run manual
# MANUAL mode: Nhấn ↑↓←→ để test collision detection
```

### Debug AI decision making
```bash
npm run manual
# Nhấn M để switch sang AUTO mode
# Quan sát log:
# 🤖 [AI] Making decision...
# 🤖 [AI] Action: MOVE - Exploring target at (200, 120)
# 🤖 [AI] Moving RIGHT
```

### Debug bomb placement strategy
```bash
npm run manual
# AUTO mode: Xem AI đặt bomb ở đâu
# MANUAL mode: Tự test đặt bomb xem có hợp lý không
```

### Compare AI vs Manual
```bash
npm run manual
# 1. Chơi manual một lúc, ghi nhớ score
# 2. Nhấn M để AI chơi
# 3. So sánh hiệu suất
```

## 🔧 Cấu hình

File `.env`:
```bash
SOCKET_SERVER=https://zarena-dev3.zinza.com.vn
BOT_TOKEN=s9vq3n7y
```

## 💡 Pro Tips

1. **Debug AI Strategies**:
   - Nhấn M để vào AUTO mode
   - Xem log `🤖 [AI] Action: MOVE - Exploring target...`
   - Hiểu AI đang dùng strategy nào (Escape, WallBreaker, ChestCollector, etc.)

2. **Test AI vs Manual**:
   - Chạy manual một round
   - Nhấn M để AI chạy round tiếp
   - So sánh performance

3. **Quick intervention**:
   - AI đang chạy mà sắp chết? Nhấn M ngay để tự cứu
   - Sau khi thoát hiểm, nhấn M lại để AI tiếp tục

4. **Debug specific scenarios**:
   - Đi manual đến vị trí khó
   - Nhấn M xem AI xử lý thế nào
   - Học được cách AI pathfinding

## 📚 Tài liệu đầy đủ

Xem thêm: [MANUAL_CONTROL.md](./MANUAL_CONTROL.md)

---

**Happy Debugging! 🎮💣**
