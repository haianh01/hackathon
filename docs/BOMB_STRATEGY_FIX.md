# 🐛 Bug Fix: BombStrategy - Đặt bom vô nghĩa

## ❌ **Vấn đề ban đầu**

Bot đang đặt bom lung tung mà không có mục tiêu rõ ràng:

```
🤪 ~ file: bombermanAI.ts:41 [] -> decision :  {
  action: 'BOMB',
  priority: 89,
  reason: 'Đặt bom tại (565, 565): kiểm soát khu vực'
}
```

→ **Lãng phí bom** chỉ để "kiểm soát khu vực" mà không phá tường hay tấn công địch!

---

## 🔍 **Nguyên nhân**

### 1. **Điểm "kiểm soát không gian" luôn > 0**
```typescript
// ❌ CODE CŨ
const controlledArea = affectedPositions.length;
score += controlledArea * 2; // Với flameRange=3 → ~10 ô → +20 điểm
```

→ Bot **LUÔN** có điểm để đặt bom, ngay cả khi không có mục tiêu!

### 2. **Self-threat penalty quá nhỏ**
```typescript
// ❌ CODE CŨ
private calculateSelfThreat(): number {
  return 0.3; // Chỉ trừ 0.3 * 30 = 9 điểm
}
```

→ Penalty quá thấp so với điểm kiểm soát không gian (+20)

### 3. **Không có ngưỡng minimum**
Không kiểm tra xem có đủ lý do để đặt bom không.

### 4. **Escape route calculation không tối ưu**
- Gọi `findEscapeRoute()` 2 lần (trong `evaluate()` và `calculateSelfThreat()`)
- Return pathfinding result có thể fail

---

## ✅ **Giải pháp**

### 1. **Bỏ điểm "kiểm soát không gian"**
```typescript
// ✅ CODE MỚI - BỎ hoàn toàn
// Chỉ đặt bom khi có mục tiêu rõ ràng
```

### 2. **Tăng giá trị các mục tiêu thực sự**
```typescript
// ✅ Phá tường
if (destructibleWalls.length > 0) {
  score += destructibleWalls.length * 30; // Tăng từ 20 → 30
  reasons.push(`phá ${destructibleWalls.length} tường`);
}

// ✅ Tấn công địch
if (threatenedEnemies.length > 0) {
  score += threatenedEnemies.length * 80; // Tăng từ 50 → 80
  reasons.push(`tấn công ${threatenedEnemies.length} địch`);
}
```

### 3. **Cải thiện self-threat calculation**
```typescript
// ✅ CODE MỚI - Dựa vào escape route thực tế
private calculateSelfThreat(escapeRoute: Position[]): number {
  if (!escapeRoute || escapeRoute.length === 0) {
    return 10; // Nguy cơ cao
  }
  if (escapeRoute.length <= 2) {
    return 5; // Nguy cơ trung bình
  }
  return 1; // Nguy cơ thấp
}

// Penalty hợp lý
score -= selfThreat * 20; // Giảm từ 50 xuống 20
```

### 4. **Thêm ngưỡng minimum**
```typescript
// ✅ Chỉ đặt bom khi có lý do rõ ràng
if (reasons.length === 0 || score < 10) {
  return {
    score: 0,
    reason: "không có mục tiêu có giá trị",
  };
}
```

### 5. **Tối ưu escape route**
```typescript
// ✅ Tính escape route 1 lần trong evaluate()
const escapeRoute = this.findEscapeRoute(gameState);
if (!escapeRoute || escapeRoute.length === 0) {
  return null; // Không đặt bom nếu không có lối thoát
}

// Truyền escapeRoute vào calculateBombBenefit() để tránh tính lại
const bombBenefit = this.calculateBombBenefit(gameState, escapeRoute);
```

### 6. **Escape route trả về danh sách safe positions**
```typescript
// ✅ Trả về array of safe positions thay vì path
private findEscapeRoute(gameState: GameState): Position[] | null {
  // ...
  return safePositions; // Sorted by distance
}
```

---

## 📊 **Kết quả**

### Trước khi sửa:
```
✅ Bot đặt bom tại (565, 565): kiểm soát khu vực
❌ Không có tường để phá
❌ Không có địch để tấn công
❌ Lãng phí bom
```

### Sau khi sửa:
```
✅ Bot chỉ đặt bom khi:
   - Có tường/chest để phá (≥1)
   - Có địch trong tầm nổ
   - Có lối thoát an toàn
   
❌ Bot KHÔNG đặt bom khi:
   - Không có mục tiêu
   - Điểm < 10
   - Không có lối thoát
```

---

## 🧪 **Test Results**

```bash
 PASS  src/__tests__/bombStrategy.test.ts
  BombStrategy
    evaluate
      ✓ should return null if bot has no bombs
      ✓ should return null if there's already a bomb at current position
      ✓ should suggest bomb placement when can destroy walls
      ✓ should suggest bomb placement when can attack enemies
      ✓ should return null if no escape route available
      ✓ should consider items when calculating bomb benefit
    priority
      ✓ should have high priority (80)
    name
      ✓ should be BombStrategy
    bomb placement logic
      ✓ should calculate correct flame range positions
      ✓ should stop flame at non-destructible walls
    escape route calculation
      ✓ should find safe positions outside blast range

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
```

---

## 📈 **So sánh điểm số**

### Scenario: Bot ở (5,5), có 2 tường gần đó

| Tình huống | Điểm cũ | Điểm mới |
|-----------|---------|----------|
| **2 tường** | 2×20 = 40 | 2×30 = 60 |
| **Kiểm soát KV** | +20 | 0 (bỏ) |
| **Self-threat** | -9 (0.3×30) | -20 (1×20) |
| **TOTAL** | **51** | **40** |
| **Quyết định** | ✅ Đặt bom | ✅ Đặt bom |

### Scenario: Bot ở (5,5), KHÔNG có mục tiêu

| Tình huống | Điểm cũ | Điểm mới |
|-----------|---------|----------|
| **0 tường** | 0 | 0 |
| **0 địch** | 0 | 0 |
| **Kiểm soát KV** | +20 | 0 (bỏ) |
| **Self-threat** | -9 | -20 |
| **TOTAL** | **11** | **-20** |
| **Quyết định** | ✅ Đặt (SAI!) | ❌ Không đặt (ĐÚNG!) |

---

## 🎯 **Kết luận**

**Trước:** Bot đặt bom bừa bãi để "kiểm soát khu vực"  
**Sau:** Bot chỉ đặt bom khi có mục tiêu rõ ràng và lối thoát an toàn

✅ Tiết kiệm bom  
✅ An toàn hơn  
✅ Chiến thuật rõ ràng hơn  
✅ Tất cả tests PASS  
