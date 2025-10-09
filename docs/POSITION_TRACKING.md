# Position Tracking & Movement Prediction

## Vấn đề
- Server di chuyển bot 3px mỗi lần gọi event `move`
- Nếu spam di chuyển liên tục, bot có thể va chạm tường/rương mà không biết
- Cần tracking vị trí real-time để tránh spam vào tường

## Giải pháp đã implement

### Option 1: Real-time Position Tracking
Bot lắng nghe event `player_move` từ server để cập nhật vị trí real-time:

```typescript
this.socket.on("player_move", (data: any) => {
  if (data.uid === this.socket?.id) {
    console.log(`🎯 Bot di chuyển: (${data.x}, ${data.y})`);
    this.lastConfirmedPosition = { x: data.x, y: data.y };
    
    // Update myBomberInfo
    if (this.myBomberInfo) {
      this.myBomberInfo.x = data.x;
      this.myBomberInfo.y = data.y;
    }
    
    // Callback notification
    if (this.onPositionUpdateCallback) {
      this.onPositionUpdateCallback(data.x, data.y);
    }
  }
});
```

### Option 2: Movement Prediction
Trước khi gửi lệnh di chuyển, bot dự đoán vị trí tiếp theo:

```typescript
public move(direction: Direction): void {
  // ... throttle check ...
  
  // Predict next position (3px step)
  const currentPos = this.getCurrentPosition();
  if (currentPos) {
    const predictedPos = this.predictNextPosition(currentPos, direction);
    this.predictedPosition = predictedPos;
  }
  
  this.socket.emit("move", { orient: direction });
}

private predictNextPosition(
  currentPos: { x: number; y: number },
  direction: Direction
): { x: number; y: number } {
  const MOVE_STEP = 3; // Server moves 3px per step
  
  switch (direction) {
    case Direction.UP: return { x: currentPos.x, y: currentPos.y - MOVE_STEP };
    case Direction.DOWN: return { x: currentPos.x, y: currentPos.y + MOVE_STEP };
    case Direction.LEFT: return { x: currentPos.x - MOVE_STEP, y: currentPos.y };
    case Direction.RIGHT: return { x: currentPos.x + MOVE_STEP, y: currentPos.y };
    default: return currentPos;
  }
}
```

## Cách sử dụng

### 1. Lấy vị trí hiện tại
```typescript
const position = this.socketConnection.getCurrentPosition();
// Returns: { x: number, y: number } | null
// Ưu tiên: lastConfirmedPosition -> predictedPosition -> myBomberInfo
```

### 2. Đăng ký callback cho position updates
```typescript
this.socketConnection.onPositionUpdate((x: number, y: number) => {
  console.log(`New position: (${x}, ${y})`);
  // Cập nhật game state hoặc AI logic
});
```

### 3. Kiểm tra va chạm với tường (pixel-level)
```typescript
import { canMoveToPositionPrecise, isPositionCollidingWithWalls } from "./utils";

const predictedPos = { x: 123, y: 456 };
if (canMoveToPositionPrecise(predictedPos, gameState)) {
  // Safe to move
  this.socketConnection.move(direction);
} else {
  // Collision detected, change strategy
  console.log("Cannot move to predicted position!");
}
```

## Các utilities mới

### `getPositionInDirectionSmallStep()`
Di chuyển vị trí với bước nhỏ (3px thay vì 40px):
```typescript
const nextPos = getPositionInDirectionSmallStep(currentPos, Direction.UP, 3);
```

### `isPositionCollidingWithWalls()`
Kiểm tra va chạm pixel-level với tường/rương:
```typescript
if (isPositionCollidingWithWalls(position, gameState, botSize)) {
  console.log("Collision detected!");
}
```

### `canMoveToPositionPrecise()`
Kiểm tra tổng hợp (trong map + không va chạm):
```typescript
if (canMoveToPositionPrecise(predictedPos, gameState)) {
  // OK to move
}
```

## Luồng hoạt động

1. **Bot gửi lệnh move** → Dự đoán vị trí mới (predictedPosition)
2. **Server xử lý** → Gửi event `player_move` với vị trí thực
3. **Bot nhận event** → Cập nhật lastConfirmedPosition
4. **AI decision** → Sử dụng getCurrentPosition() để lấy vị trí chính xác nhất

## Lợi ích

✅ **Tránh spam vào tường** - Biết vị trí trước khi di chuyển  
✅ **Tracking real-time** - Cập nhật vị trí ngay khi server confirm  
✅ **Optimistic updates** - Dự đoán vị trí để phản hồi nhanh  
✅ **Pixel-perfect collision** - Kiểm tra va chạm chính xác  
✅ **Fallback mechanism** - Nhiều nguồn dữ liệu vị trí  

## Lưu ý

- **MOVE_STEP = 3px**: Server di chuyển 3 pixel mỗi lần
- **throttleMs = 200ms**: Giới hạn spam request
- **Bot size = 30px**: Default size cho collision detection
- **Cell size = 40x40px**: Kích thước mỗi ô trong map
