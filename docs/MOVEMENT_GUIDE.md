# 🎮 Hướng dẫn Di chuyển Bot

## 📋 Tổng quan

Bot có **2 chế độ di chuyển** khác nhau:

### 1. **Single Move** - Di chuyển đơn (mặc định)
- ✅ Gửi lệnh di chuyển **1 lần**
- ✅ Có throttle 50ms để tránh spam
- ✅ Phù hợp cho di chuyển từng bước, kiểm soát chính xác

### 2. **Continuous Move** - Di chuyển liên tục (mới)
- ✅ Gửi lệnh di chuyển **liên tục** mỗi 100ms
- ✅ Bot sẽ di chuyển mượt mà theo hướng cho đến khi dừng lại
- ✅ Phù hợp cho di chuyển đường dài, tránh bom

---

## 🔧 API Reference

### `move(direction: Direction): void`
**Di chuyển đơn - Gửi lệnh 1 lần**

```typescript
// Ví dụ: Di chuyển lên trên
socketConnection.move(Direction.UP);
```

**Đặc điểm:**
- Throttle: 50ms (không gửi được nếu < 50ms từ lần gửi trước)
- Gửi 1 lần rồi dừng
- Cần gọi lại nếu muốn tiếp tục di chuyển

---

### `startContinuousMove(direction: Direction): void`
**Di chuyển liên tục - Gửi lệnh lặp lại mỗi 100ms**

```typescript
// Ví dụ: Bắt đầu di chuyển sang trái liên tục
socketConnection.startContinuousMove(Direction.LEFT);

// Bot sẽ tự động di chuyển LEFT mỗi 100ms cho đến khi:
// 1. Gọi stopContinuousMove()
// 2. Gọi startContinuousMove() với hướng khác
// 3. Game kết thúc hoặc disconnect
```

**Đặc điểm:**
- Interval: 100ms (gửi lệnh mỗi 100ms)
- Tự động lặp lại cho đến khi dừng
- Chỉ 1 continuous move có thể active tại 1 thời điểm

---

### `stopContinuousMove(): void`
**Dừng di chuyển liên tục**

```typescript
// Dừng di chuyển liên tục
socketConnection.stopContinuousMove();
```

**Đặc điểm:**
- Clear interval ngay lập tức
- Bot dừng lại tại vị trí hiện tại
- Tự động được gọi khi disconnect

---

## 💡 Khi nào dùng chế độ nào?

### ✅ Dùng **Single Move** khi:
- Di chuyển từng ô một cách chính xác
- Cần kiểm soát chi tiết từng bước
- Kết hợp với logic phức tạp (pathfinding từng bước)

### ✅ Dùng **Continuous Move** khi:
- Di chuyển đường dài đến mục tiêu
- Tránh bom/vùng nguy hiểm khẩn cấp
- Cần di chuyển mượt mà không giật lag

---

## 🎯 Ví dụ sử dụng

### Ví dụ 1: Di chuyển đơn giản
```typescript
import { SocketConnection } from './connection/socketConnection';
import { Direction } from './types';

const socket = new SocketConnection('ws://server', 'token');

// Di chuyển 1 lần
socket.move(Direction.UP);
```

### Ví dụ 2: Di chuyển liên tục đến mục tiêu
```typescript
// Bắt đầu di chuyển sang phải liên tục
socket.startContinuousMove(Direction.RIGHT);

// Sau 2 giây, đổi hướng sang dưới
setTimeout(() => {
  socket.startContinuousMove(Direction.DOWN);
}, 2000);

// Sau 4 giây, dừng lại
setTimeout(() => {
  socket.stopContinuousMove();
}, 4000);
```

### Ví dụ 3: Tích hợp với AI Strategy
```typescript
export class EscapeStrategy extends BaseStrategy {
  evaluate(gameState: GameState): BotDecision | null {
    const isInDanger = this.checkDanger(gameState);
    
    if (isInDanger) {
      const safeDirection = this.findSafeDirection(gameState);
      
      return {
        action: BotAction.CONTINUOUS_MOVE, // ⭐ Sử dụng continuous move
        direction: safeDirection,
        priority: 100,
        reason: 'Thoát hiểm liên tục'
      };
    }
    
    return null;
  }
}
```

### Ví dụ 4: Smart pathfinding với continuous move
```typescript
export class SmartNavigationStrategy extends BaseStrategy {
  evaluate(gameState: GameState): BotDecision | null {
    const target = this.findBestTarget(gameState);
    if (!target) return null;

    const path = Pathfinding.findPath(currentPos, target, gameState);
    
    if (path.length > 5) {
      // Đường dài → dùng continuous move
      const direction = getDirectionToTarget(currentPos, path[1]);
      
      return {
        action: BotAction.CONTINUOUS_MOVE,
        direction: direction,
        priority: 60,
        reason: `Di chuyển liên tục tới mục tiêu (${path.length} bước)`
      };
    } else {
      // Đường ngắn → dùng single move để kiểm soát tốt hơn
      const direction = getDirectionToTarget(currentPos, path[1]);
      
      return {
        action: BotAction.MOVE,
        direction: direction,
        priority: 60,
        reason: `Di chuyển từng bước (${path.length} bước)`
      };
    }
  }
}
```

---

## ⚠️ Lưu ý quan trọng

### 1. **Chỉ 1 continuous move tại 1 thời điểm**
```typescript
// ❌ SAI: Gọi nhiều lần cùng hướng (không cần thiết)
socket.startContinuousMove(Direction.UP);
socket.startContinuousMove(Direction.UP); // Bị ignore

// ✅ ĐÚNG: Đổi hướng sẽ tự động dừng hướng cũ
socket.startContinuousMove(Direction.UP);
socket.startContinuousMove(Direction.LEFT); // Tự động dừng UP, chuyển sang LEFT
```

### 2. **Luôn dừng continuous move khi không cần**
```typescript
// ✅ ĐÚNG: Dừng khi đến mục tiêu
if (reachedTarget) {
  socket.stopContinuousMove();
}

// ✅ ĐÚNG: Dừng khi cần thực hiện hành động khác
if (needToBomb) {
  socket.stopContinuousMove();
  socket.placeBomb();
}
```

### 3. **Auto cleanup khi disconnect**
```typescript
// Tự động dừng continuous move khi disconnect
socket.disconnect(); // stopContinuousMove() được gọi tự động
```

---

## 🔍 Debugging

### Log messages
- `🔄 Bắt đầu di chuyển liên tục: UP` - Bắt đầu continuous move
- `⏹️ Dừng di chuyển liên tục` - Dừng continuous move
- `➡️ Move: LEFT` - Single move

### Kiểm tra trạng thái
```typescript
// Kiểm tra có đang continuous move không
if (socket['moveInterval'] !== null) {
  console.log('Đang di chuyển liên tục theo hướng:', socket['currentDirection']);
}
```

---

## 📊 So sánh hiệu suất

| Tính năng | Single Move | Continuous Move |
|-----------|-------------|-----------------|
| **Tần suất gửi** | 1 lần/lệnh | 10 lần/giây |
| **Throttle** | 50ms | Không |
| **Kiểm soát** | Cao | Trung bình |
| **Mượt mà** | Trung bình | Cao |
| **Dùng cho** | Di chuyển chính xác | Di chuyển đường dài |
| **Network load** | Thấp | Cao hơn |

---

## 🚀 Best Practices

1. **Ưu tiên Single Move cho logic game chính**
   - Kiểm soát tốt hơn
   - Dễ debug
   - Phù hợp với turn-based logic

2. **Dùng Continuous Move cho tình huống khẩn cấp**
   - Thoát hiểm khỏi bom
   - Di chuyển đường dài nhanh chóng
   - Khi cần phản ứng nhanh

3. **Luôn cleanup properly**
   - Dừng continuous move khi không cần
   - Tránh memory leak
   - Clear interval khi game end

4. **Kết hợp 2 chế độ thông minh**
   - Continuous move cho đường dài
   - Single move cho điều chỉnh tinh chỉnh cuối cùng
