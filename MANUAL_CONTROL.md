# 🎮 Manual Keyboard Control - Debug Guide

Hệ thống điều khiển bằng bàn phím để debug bot trên server thật.

## 🚀 Cách sử dụng

### 1. Chạy manual control mode

```bash
npm run manual
# hoặc
npm run debug
```

### 2. Điều khiển bàn phím

#### 🎮 Di chuyển
- **↑ / W** - Di chuyển LÊN
- **↓ / S** - Di chuyển XUỐNG
- **← / A** - Di chuyển TRÁI
- **→ / D** - Di chuyển PHẢI
- **X / Enter** - DỪNG di chuyển

#### 💣 Hành động
- **Space / B** - Đặt BOMB

#### ℹ️ Thông tin
- **I** - Hiển thị trạng thái bot
- **H** - Hiển thị hướng dẫn
- **Ctrl+C** - Thoát chương trình

## 📊 Thông tin hiển thị

Khi nhấn phím **I**, bạn sẽ thấy:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BOT STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Name: YourBotName
📍 Position: (120, 80)
📍 Cell: (3, 2)
💣 Bombs: 3
🔥 Flame Range: 2
⚡ Speed: 1
💖 Lives: 3
🏆 Score: 150

🗺️ MAP INFO:
📦 Chests: 15
🎁 Items: 5
💣 Bombs: 2
👥 Players: 4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🎯 Tính năng

### ✅ Đã hoàn thành
- ✅ Kết nối đến server thật
- ✅ Điều khiển di chuyển bằng phím mũi tên / WASD
- ✅ Đặt bomb bằng Space / B
- ✅ Dừng di chuyển bằng X / Enter
- ✅ Hiển thị vị trí real-time
- ✅ Hiển thị trạng thái bot
- ✅ Xử lý sự kiện bomb
- ✅ Xử lý sự kiện chest/item
- ✅ Xử lý sự kiện game start/end
- ✅ Continuous movement (giữ phím)

### 📝 Real-time Events
Bot sẽ tự động log các sự kiện:
- 📍 Cập nhật vị trí
- 💣 Bomb được đặt
- 💥 Bomb nổ
- 📦 Chest bị phá
- 🎁 Item được nhặt
- 💀 Player chết
- 🎉 Giết địch

## 🔧 Cấu hình

Server và token được đọc từ file `.env`:

```bash
SOCKET_SERVER=https://zarena-dev3.zinza.com.vn
BOT_TOKEN=s9vq3n7y
```

## 💡 Tips Debug

### 1. Kiểm tra kết nối
```bash
npm run manual
# Nếu thấy "✅ Connected to server" là thành công
```

### 2. Test di chuyển
- Nhấn phím mũi tên → thấy log `🏃 Moving RIGHT`
- Nhấn X → thấy log `⏹️ Stopping movement`

### 3. Test bomb
- Nhấn Space → thấy log `💣 Placing bomb!`
- Sau đó sẽ thấy `💣 Bomb placed at (x, y)`

### 4. Xem trạng thái
- Nhấn I bất kỳ lúc nào để xem:
  - Vị trí hiện tại
  - Số bomb còn lại
  - Tốc độ, sức mạnh
  - Số lượng chest, item, bomb trên map

## 🐛 Troubleshooting

### Lỗi: "Cannot read property 'isTTY'"
→ Chạy trong terminal thật, không phải trong subprocess

### Lỗi: "Connection failed"
→ Kiểm tra:
1. Server có đang hoạt động không
2. BOT_TOKEN có đúng không
3. Network connection

### Phím không hoạt động
→ Đảm bảo:
1. Terminal đang focus
2. Game đã start (thấy "🎮 GAME STARTED!")
3. Không bị pause

## 🎓 So sánh với Auto Mode

| Feature | Manual Mode | Auto Mode |
|---------|-------------|-----------|
| Di chuyển | Bàn phím | AI pathfinding |
| Đặt bomb | Phím Space | AI quyết định |
| Debug | Dễ test từng hành động | Khó debug logic |
| Tốc độ | Phản ứng người | Tối ưu AI |
| Mục đích | Test & Debug | Production |

## 📖 Example Session

```bash
$ npm run manual

🎮 Bomberman Manual Control - Zinza Hackathon 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 Manual Bot Control
📡 Server: https://zarena-dev3.zinza.com.vn
🔑 Token: s9vq3n7y

🚀 Initializing manual control...
🔌 Connecting to server...
✅ Successfully connected to the server! Socket ID: abc123
➡️ Sending 'join' event to enter the game room...
🤖 My bot (MyBot) is ready.
✅ Connected to server.

✅ Manual control ready!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⌨️  KEYBOARD CONTROLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 Movement:
   ↑/W      - Move UP
   ↓/S      - Move DOWN
   ←/A      - Move LEFT
   →/D      - Move RIGHT
   X/Enter  - STOP movement

💣 Actions:
   Space/B  - Place BOMB

ℹ️  Info:
   I        - Print STATUS
   H        - Print HELP
   Ctrl+C   - EXIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 GAME STARTED!
🏃 Moving RIGHT
📍 Position: (121, 80) | Cell: (3, 2)
🏃 Moving RIGHT
📍 Position: (122, 80) | Cell: (3, 2)
💣 Placing bomb!
💣 Bomb placed at (120, 80)
⏹️ Stopping movement
```

## 🔗 Liên quan

- `src/manualControl.ts` - Source code chính
- `src/bombermanBot.ts` - Auto bot logic
- `src/connection/socketConnection.ts` - Socket handling
- `debug-keyboard-control.html` - Visual debug tool (offline)

---

**Happy Debugging! 🎮💣**
