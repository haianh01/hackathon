 VẤN ĐỀ VÀ HẠN CHẾ

  1. Performance Issues

  // line 602-637: O(n) loop for all candidates
  for (candidatePos of candidates) {
    evaluateBombPosition(candidatePos);  // Expensive!
  }

  Vấn đề:
  - generateCandidatePositions tạo ~50-100 positions (grid + near chests)
  - Mỗi evaluateBombPosition loop 4 directions * flameRange
  - Total: ~50-100 * 4 * 3 = 600-1200 operations/tick

  Đề xuất:
  - Giới hạn candidates bằng distance threshold sớm hơn
  - Cache evaluations trong short-term memory
  - Early exit nếu tìm thấy position với chestsCount >= 3


   VẤN ĐỀ VÀ HẠN CHẾ

  1. Performance Issues

  // line 602-637: O(n) loop for all candidates
  for (candidatePos of candidates) {
    evaluateBombPosition(candidatePos);  // Expensive!
  }

  Vấn đề:
  - generateCandidatePositions tạo ~50-100 positions (grid + near chests)
  - Mỗi evaluateBombPosition loop 4 directions * flameRange
  - Total: ~50-100 * 4 * 3 = 600-1200 operations/tick

  Đề xuất:
  - Giới hạn candidates bằng distance threshold sớm hơn
  - Cache evaluations trong short-term memory
  - Early exit nếu tìm thấy position với chestsCount >= 3

    3. Candidate Generation Không Tối Ưu

  // line 687-695: Duplicate near chest positions
  for (const chest of chests) {
    nearPositions = getPositionsNearTarget(chest, flameRange);
    candidates.push(...nearPositions);  // Potential duplicates
  }

  Vấn đề:
  - Nhiều chests gần nhau → duplicate positions
  - getPositionsNearTarget tạo 4 * flameRange positions/chest
  - Deduplicate ở cuối (line 698-704) → lãng phí

  Đề xuất:
  // Use Set<string> để tránh duplicates từ đầu
  const candidateSet = new Set<string>();
  for (const chest of chests) {
    positions = getPositionsNearTarget(chest, flameRange);
    positions.forEach(p => candidateSet.add(`${p.x},${p.y}`));
  }

  4. Stuck Detection Quá Chậm

  // line 56: MAX_STUCK_FRAMES = 30 (6 seconds!)
  if (stuckFrameCount >= 30) {
    return false;
  }

  Vấn đề:
  - 6 giây stuck là RẤT LÂU trong game realtime
  - Bot bị waste time và có thể bị bomb
  - Enemies có thể steal chests trong lúc stuck

  Đề xuất:
  const MAX_STUCK_FRAMES = 15;  // 3 seconds
  const STUCK_THRESHOLD = 20;   // 20px over 5 frames (looser)

  // Add emergency escape
  if (stuckFrameCount >= 10 && isPositionInDangerZone()) {
    return false;  // Immediate abort if in danger
  }

    const searchRadius = 3;

  Vấn đề:
  - Alternative chỉ tìm trong 3 cells (120px)
  - Nếu stuck vì obstacle, alternative cũng có thể bị block
  - Không consider xa hơn nếu nearby không có chests

  Đề xuất:
  // Progressive search: 3 → 5 → 7 cells
  const searchRadii = [3, 5, 7];
  for (const radius of searchRadii) {
    alternative = findInRadius(radius);
    if (alternative && canReach(alternative)) {
      return alternative;
    }
  }

  6. Priority Formula Có Thể Xung Đột

  // line 945-999: Dynamic priority
  priority = 50 + chestsCount*5 + safetyAdj + urgency + competition - dangerPenalty

  // Scenarios:
  - 5 chests, safe: 50 + 25 + 5 + 15 + 0 = 95
  - 1 chest, in danger: 50 + 5 - 30 = 25
  - Escape priority: 100 (always higher)

  Vấn đề:
  - WallBreaker (25-95) vs Escape (100) → OK
  - WallBreaker (95) vs Explore (40) → OK
  - NHƯNG: WallBreaker (95) có thể override SmartNavigation (45-65) picking up critical items

  Đề xuất:
  - Cap max priority at 85 (dưới Escape 100, trên Explore/Navigation)
  - Or: Reduce chest bonus to 3 instead of 5


  7. Escape Check Có Thể Quá Nghiêm

  // line 1206-1216: Position must be safe BEFORE checking escape
  if (!isPositionInDangerZone(snappedBombPos, tempGameState)) {
    return true;
  }

  canEscape = canEscapeFromBomb(...);

  Vấn đề:
  - Chỉ check escape NẾU vị trí đang nguy hiểm
  - Nếu vị trí safe TRƯỚC khi đặt bomb → skip escape check
  - NHƯNG: Sau khi đặt bomb, vị trí SẼ TRỞ THÀNH danger zone!

  Logic đúng nên là:
  // ALWAYS check escape after placing bomb
  // because bomb turns safe zone → danger zone
  canEscape = canEscapeFromBomb(snappedBombPos, simulatedBomb, tempGameState);
  return canEscape;

Enemy score nhỏ so với chest (evaluateBombPosition)
Bot có thể bỏ lỡ cơ hội đánh enemy


⚠️ Điểm Cần Cải Thiện và Cân Nhắc
1. Điều kiện Trả về null (Line 140)
Hiện tại, hàm trả về null nếu chestsCount === 0.

return chestsCount > 0 ? {...} : null;
Vấn đề: Điều này có nghĩa là bot sẽ không bao giờ đặt bom nếu nó chỉ có thể tiêu diệt enemy (cho 150 điểm) mà không phá được chest nào.

Đề xuất cải thiện: Nên trả về kết quả nếu Total Score (bao gồm cả điểm enemy) vượt qua một ngưỡng tối thiểu nào đó, hoặc ít nhất là khi totalScore > 0.

return totalScore > 0 ? {...} : null;
Nếu không, chiến thuật sẽ quá tập trung vào phá chest và có thể bỏ lỡ cơ hội tiêu diệt đối thủ.