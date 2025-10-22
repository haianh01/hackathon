# 🎮 Debug Tool Summary

## Công cụ đã tạo

### 1. Hybrid Control Mode (Manual + AI) ⭐ **RECOMMEND**
**File**: `src/manualControl.ts`

**Chạy**:
```bash
npm run manual
# hoặc
npm run debug
```

**Tính năng**:
- ✅ Kết nối server thật
- ✅ Chuyển đổi MANUAL ⟷ AUTO mode bằng phím `M`
- ✅ **MANUAL**: Điều khiển bằng bàn phím (↑↓←→, Space)
- ✅ **AUTO**: AI code của bạn tự động chạy (BombermanAI)
- ✅ Xem AI decision making real-time
- ✅ Can thiệp bất kỳ lúc nào

**Use case**:
```bash
# Debug AI strategy
npm run manual
> Nhấn M (vào AUTO mode)
> Xem log: "🤖 [AI] Making decision..."
> Hiểu AI đang làm gì

# Test manual vs AI
> Chơi manual → ghi score
> Nhấn M → AI chơi tiếp
> So sánh performance

# Emergency intervention
> AI sắp chết? Nhấn M → tự cứu
> An toàn rồi → Nhấn M → AI tiếp tục
```

---

### 2. Visual Debug Tool (Offline)
**File**: `debug-keyboard-control.html`

**Chạy**:
```bash
# Mở file trong browser
open debug-keyboard-control.html
```

**Tính năng**:
- ✅ Debug offline không cần server
- ✅ Visual map với bomb danger zones
- ✅ Pathfinding visualization
- ✅ Test collision, bomb mechanics
- ✅ Click để set target, place bomb

**Use case**:
- Test thuật toán offline
- Visualize danger zones
- Prototype trước khi test server thật

---

## 🎯 Workflow đề xuất

### Bước 1: Test offline trước
```bash
# Mở visual tool để test logic
open debug-keyboard-control.html
```

### Bước 2: Test trên server thật
```bash
# Hybrid mode - Manual first
npm run manual
> Test movement bằng tay
> Kiểm tra server response
```

### Bước 3: Debug AI
```bash
# Vẫn trong manual mode
> Nhấn M (switch to AUTO)
> Quan sát AI decisions
> Nhấn I để xem status
```

### Bước 4: So sánh performance
```bash
# Chơi manual vs AI
> Manual: Di chuyển tự do, đặt bomb
> Nhấn M: Để AI chơi
> So sánh scores
```

---

## 📊 Comparison

| Feature | Visual Tool (HTML) | Hybrid Control (Manual) |
|---------|-------------------|------------------------|
| Server connection | ❌ Offline | ✅ Real server |
| Visual map | ✅ Canvas | ❌ Terminal only |
| Manual control | ✅ Keyboard/Click | ✅ Keyboard |
| AI testing | ❌ | ✅ Full AI code |
| Pathfinding viz | ✅ | ❌ |
| Real-time events | ❌ | ✅ |
| **Best for** | Prototyping | Real debugging |

---

## 🔑 Key Commands

### Hybrid Control
- `M` - Toggle MANUAL/AUTO mode
- `↑↓←→` or `WASD` - Move (manual only)
- `Space` or `B` - Place bomb (manual only)
- `I` - Show status
- `H` - Show help
- `Ctrl+C` - Exit

### Visual Tool
- **Arrow keys/WASD** - Move bot
- **Space/B** - Place bomb
- **Left click** - Add chest
- **Right click** - Place bomb at position
- **M** - Toggle Manual/Auto (pathfinding)

---

## 📖 Documentation

- [QUICKSTART_DEBUG.md](./QUICKSTART_DEBUG.md) - Quick start guide
- [MANUAL_CONTROL.md](./MANUAL_CONTROL.md) - Full documentation
- [debug-keyboard-control.html](./debug-keyboard-control.html) - Visual tool

---

**Happy Debugging! 🎮💣**
