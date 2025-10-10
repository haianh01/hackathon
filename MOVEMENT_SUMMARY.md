# 🎯 TÓM TẮT: Tại sao `move()` KHÔNG di chuyển liên tục?

## ❌ Vấn đề ban đầu

Function `move()` có **THROTTLE 50ms** nên không thể di chuyển liên tục:

```typescript
// ❌ Code CŨ - Có throttle
if (now - this.lastMoveTime < this.moveThrottleMs) {
  return; // DỪNG LẠI nếu < 50ms
}
```

**Kết quả:**
- Chỉ gửi được 1 lệnh mỗi 50ms
- Không di chuyển liên tục
- Bot bị "giật" khi di chuyển

---

## ✅ Giải pháp

Đã thêm **2 chế độ di chuyển**:

### 1. **`move(direction)`** - Di chuyển đơn
- Gửi lệnh 1 lần
- Có throttle 50ms
- Dùng cho di chuyển chính xác

### 2. **`startContinuousMove(direction)`** - Di chuyển liên tục (MỚI)
- ✅ Gửi lệnh **liên tục mỗi 100ms** bằng `setInterval()`
- ✅ Bot di chuyển mượt mà cho đến khi gọi `stopContinuousMove()`
- ✅ Không có throttle

---

## 🚀 Cách sử dụng

### Trước đây (chỉ có 1 cách):
```typescript
// Di chuyển 1 lần, phải gọi lại nhiều lần
socket.move(Direction.UP); // Chỉ di chuyển 1 bước
socket.move(Direction.UP); // Phải gọi lại
socket.move(Direction.UP); // Và lại...
```

### Bây giờ (2 cách):

#### Cách 1: Single move (như cũ)
```typescript
socket.move(Direction.UP); // Di chuyển 1 bước
```

#### Cách 2: Continuous move (mới - DI CHUYỂN LIÊN TỤC)
```typescript
// Bắt đầu di chuyển liên tục
socket.startContinuousMove(Direction.UP);

// Bot tự động di chuyển UP mỗi 100ms...
// ...cho đến khi:

// Dừng lại
socket.stopContinuousMove();
```

---

## 🎮 Ví dụ thực tế

### Thoát khỏi bom (cần di chuyển nhanh liên tục):
```typescript
// ✅ ĐÚNG: Dùng continuous move
if (isInDanger) {
  socket.startContinuousMove(safeDirection);
}

// Khi đã an toàn
if (isSafe) {
  socket.stopContinuousMove();
}
```

### Di chuyển chính xác (từng bước):
```typescript
// ✅ ĐÚNG: Dùng single move
const nextStep = pathfinding.getNextStep();
socket.move(nextStep.direction);
```

---

## 📊 So sánh

| | Single Move | Continuous Move |
|---|-------------|-----------------|
| **Gửi lệnh** | 1 lần | Liên tục (10 lần/giây) |
| **Dừng lại** | Tự động | Phải gọi `stop()` |
| **Mượt mà** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Kiểm soát** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Dùng cho** | Chính xác | Đường dài |

---

## 📖 Xem thêm
Chi tiết đầy đủ tại: [`docs/MOVEMENT_GUIDE.md`](./docs/MOVEMENT_GUIDE.md)
