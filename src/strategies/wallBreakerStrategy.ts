import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Position,
  Direction,
} from "../types";
import {
  canMoveTo,
  cellToPixel,
  pixelToCell,
  getPositionInDirection,
} from "../utils";
import { Pathfinding, canEscapeFromBomb } from "../utils/pathfinding";
import { manhattanDistance } from "../utils/position";
import { isPositionInDangerZone } from "../utils/gameLogic";

// Helper function để snap position về grid - now using unified system
function snapToGrid(pos: Position): Position {
  const cellIndex = pixelToCell(pos);
  return cellToPixel(cellIndex);
}

/**
 * Chiến thuật phá tường cải tiến - thông minh hơn trong việc tìm và phá tường
 * Bao gồm: di chuyển đến vị trí tối ưu, đánh giá nhiều chest cùng lúc, tính toán escape path
 */
export class WallBreakerStrategy extends BaseStrategy {
  name = "WallBreaker";
  priority = 50;

  private lastEvaluationTime = 0;
  private cachedBestPosition: Position | null = null;
  private cacheDuration = 2000; // Cache 2 giây

  // Bomb tracking system
  private placedBombs: Map<
    string,
    {
      position: Position;
      targetChests: Position[];
      placedAt: number;
    }
  > = new Map();

  private destroyedChests: Set<string> = new Set(); // Track destroyed chests

  // Enhanced progress tracking
  private lastTargetPosition: Position | null = null;
  private noProgressCount = 0;
  private readonly MAX_NO_PROGRESS = 5; // Max attempts without progress
  private positionHistory: Position[] = [];
  private readonly HISTORY_SIZE = 10;
  private stuckFrameCount = 0;
  private readonly MAX_STUCK_FRAMES = 15;

  evaluate(gameState: GameState): BotDecision | null {
    console.log(`\n🧱 === WallBreakerStrategy EVALUATION START ===`);
    const currentPos = gameState.currentBot.position;

    this.updateBombTracking(gameState);

    if (gameState.currentBot.bombCount <= 0) {
      console.log(
        `❌ WallBreakerStrategy: Không có bom (bombCount: ${gameState.currentBot.bombCount})`
      );
      return null;
    }

    // Tìm tường có thể phá (chests) - exclude already targeted ones
    const allChests = (gameState.map.chests || []).slice();
    const availableChests = allChests.filter((chest) => {
      const chestKey = `${chest.position.x},${chest.position.y}`;

      // Skip if already destroyed
      if (this.destroyedChests.has(chestKey)) {
        return false;
      }

      // Skip if currently targeted by active bomb
      for (const bombInfo of this.placedBombs.values()) {
        const isTargeted = bombInfo.targetChests.some(
          (target) =>
            Math.abs(target.x - chest.position.x) < 20 &&
            Math.abs(target.y - chest.position.y) < 20
        );
        if (isTargeted) {
          return false;
        }
      }

      return true;
    });

    if (availableChests.length === 0) {
      console.log(
        `❌ WallBreakerStrategy: Không có tường phá được (hoặc đã được target)`
      );

      return null;
    }

    const bestPosition = this.findOptimalBombPosition(
      gameState,
      availableChests
    );

    if (!bestPosition) {
      console.log(`❌ WallBreakerStrategy: Không tìm thấy vị trí tối ưu`);
      return null;
    }

    console.log(
      `🎯 Optimal position: (${bestPosition.position.x}, ${bestPosition.position.y})`
    );

    // Nếu đã ở vị trí tối ưu, đặt bom
    const distanceToOptimal = manhattanDistance(
      currentPos,
      bestPosition.position
    );

    if (distanceToOptimal <= 20) {
      console.log(
        `✅ WallBreakerStrategy: Đã đến vị trí tối ưu! Kiểm tra escape path...`
      );

      // CRITICAL: Kiểm tra xem đã có bom ở vị trí này chưa
      // Snap bomb position to grid to match server logic
      const snappedBombPos = snapToGrid(bestPosition.position);

      const existingBomb = gameState.map.bombs.find((bomb) => {
        const snappedExistingPos = snapToGrid(bomb.position);
        const distance = manhattanDistance(snappedExistingPos, snappedBombPos);
        return distance < 20; // Same grid cell
      });

      if (existingBomb) {
        console.log(
          `❌ WallBreakerStrategy: Đã có bom tại vị trí grid này rồi! Bom ID: ${existingBomb.id}`
        );

        return null; // Không đặt bom nữa
      }

      const canEscape = this.canEscapeAfterBombAdvanced(
        bestPosition.position,
        gameState
      );

      if (!canEscape) {
        console.log(
          `❌ WallBreakerStrategy: Không thể thoát sau khi đặt bom - HỦY BỎ`
        );
        return null;
      }

      const finalPriority = this.calculateDynamicPriority(
        bestPosition,
        gameState
      );

      // Track this bomb placement and target chests
      const targetChests = this.getTargetChests(
        bestPosition.position,
        gameState
      );
      this.trackBombPlacement(bestPosition.position, targetChests);

      console.log(
        `🧱 === WallBreakerStrategy EVALUATION END (BOMB PLACED) ===\n`
      );

      return this.createDecision(
        BotAction.BOMB,
        finalPriority,
        `Phá ${bestPosition.chestsCount} tường - đặt bom (điểm: ${bestPosition.score})`
      );
    } else {
      console.log(
        `❌ WallBreakerStrategy: Chưa đến vị trí tối ưu (cần di chuyển ${distanceToOptimal} pixels)`
      );
    }

    // IMPROVED: Enhanced progress checking to prevent infinite loops
    if (!this.checkProgressAndPreventLoop(currentPos, bestPosition.position)) {
      console.log(`🔄 Stuck detected, trying alternative strategy...`);

      // Try finding completely different target area
      const alternativePosition = this.findAlternativeBombPosition(
        gameState,
        currentPos
      );

      if (alternativePosition) {
        const altDistance = manhattanDistance(
          currentPos,
          alternativePosition.position
        );
        if (altDistance <= 20) {
          console.log(`🎯 Using alternative position nearby`);
          const canEscape = this.canEscapeAfterBombAdvanced(
            alternativePosition.position,
            gameState
          );
          if (canEscape) {
            return this.createDecision(
              BotAction.BOMB,
              this.priority,
              `Alternative bomb position (stuck recovery)`
            );
          }
        }
      }

      return null; // Skip this frame
    }

    // Use pathfinding to find route to optimal position
    const path = Pathfinding.findPath(
      currentPos,
      bestPosition.position,
      gameState
    );

    if (path && path.length > 1) {
      const nextStep = path[1];

      if (nextStep) {
        const direction = this.getDirectionToPosition(currentPos, nextStep);

        if (direction) {
          const movePriority = this.priority + bestPosition.chestsCount * 2; // Base 50 + chest bonus
          return this.createDecision(
            BotAction.MOVE,
            movePriority,
            `Di chuyển đến vị trí phá tường tối ưu`,
            direction,
            bestPosition.position,
            path
          );
        } else {
          console.log(`❌ Cannot determine direction to next step`);
        }
      } else {
        console.log(`❌ Invalid path - no next step found`);
      }
    } else {
      console.log(`🔄 Searching for alternative bomb positions...`);
      const alternativePosition = this.findAlternativeBombPosition(
        gameState,
        currentPos
      );

      if (alternativePosition) {
        const altDistance = manhattanDistance(
          currentPos,
          alternativePosition.position
        );
        if (altDistance <= 20) {
          // Close enough to bomb
          const finalPriority = this.priority + alternativePosition.score / 10;
          console.log(
            `🧱 === WallBreakerStrategy EVALUATION END (ALTERNATIVE BOMB) ===\n`
          );

          return this.createDecision(
            BotAction.BOMB,
            finalPriority,
            `Phá ${alternativePosition.chestsCount} tường - đặt bom thay thế (điểm: ${alternativePosition.score})`
          );
        } else {
          // Need to move to alternative
          const altDirection = this.getDirectionToPosition(
            currentPos,
            alternativePosition.position
          );
          if (altDirection) {
            console.log(
              `🧱 === WallBreakerStrategy EVALUATION END (ALTERNATIVE MOVE) ===\n`
            );
            return this.createDecision(
              BotAction.MOVE,
              this.priority - 5,
              `Di chuyển đến vị trí thay thế`,
              altDirection,
              alternativePosition.position
            );
          }
        }
      }
    }

    console.log(`❌ WallBreakerStrategy: Không có action nào được thực hiện`);
    console.log(`🧱 === WallBreakerStrategy EVALUATION END (NO ACTION) ===\n`);
    return null;
  }

  /**
   * Track bomb placement and target chests
   */
  private trackBombPlacement(
    bombPosition: Position,
    targetChests: Position[]
  ): void {
    const bombKey = `${Math.round(bombPosition.x / 40) * 40},${
      Math.round(bombPosition.y / 40) * 40
    }`;

    this.placedBombs.set(bombKey, {
      position: bombPosition,
      targetChests: targetChests,
      placedAt: Date.now(),
    });

    console.log(
      `📝 Tracked bomb at ${bombKey} targeting ${targetChests.length} chests`
    );
    targetChests.forEach((chest, i) => {
      console.log(`  Target ${i + 1}: (${chest.x}, ${chest.y})`);
    });
  }

  /**
   * Get chests that will be destroyed by bomb at position
   */
  private getTargetChests(
    bombPosition: Position,
    gameState: GameState
  ): Position[] {
    const targetChests: Position[] = [];
    const flameRange = gameState.currentBot.flameRange;
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 }, // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }, // RIGHT
    ];

    const snappedBombPos = {
      x: Math.round(bombPosition.x / 40) * 40,
      y: Math.round(bombPosition.y / 40) * 40,
    };

    // Check chest at bomb position
    const chestAtBomb = (gameState.map.chests || []).find(
      (c) =>
        Math.abs(c.position.x - snappedBombPos.x) < 20 &&
        Math.abs(c.position.y - snappedBombPos.y) < 20
    );
    if (chestAtBomb) {
      targetChests.push(chestAtBomb.position);
    }

    // Check chests in flame directions
    for (const dir of directions) {
      for (let i = 1; i <= flameRange; i++) {
        const checkPos = {
          x: snappedBombPos.x + dir.dx * i * 40,
          y: snappedBombPos.y + dir.dy * i * 40,
        };

        const chest = (gameState.map.chests || []).find(
          (c) =>
            Math.abs(c.position.x - checkPos.x) < 20 &&
            Math.abs(c.position.y - checkPos.y) < 20
        );

        if (chest) {
          targetChests.push(chest.position);
        }

        // Check for walls that block flames
        const solidWall = gameState.map.walls.find(
          (w) =>
            Math.abs(w.position.x - checkPos.x) < 20 &&
            Math.abs(w.position.y - checkPos.y) < 20
        );
        if (solidWall) {
          break; // Wall blocks flame
        }
      }
    }

    return targetChests;
  }

  /**
   * IMPROVED: Clean up expired bomb tracking and update destroyed chests based on actual game state
   */
  private updateBombTracking(gameState: GameState): void {
    // 1. Sync with actual bombs on map (source of truth)
    const currentBombKeys = new Set(
      gameState.map.bombs.map((b) => {
        const snapped = snapToGrid(b.position);
        return `${snapped.x},${snapped.y}`;
      })
    );

    // 2. Remove tracked bombs that no longer exist (exploded)
    for (const [bombKey, bombInfo] of this.placedBombs.entries()) {
      if (!currentBombKeys.has(bombKey)) {
        bombInfo.targetChests.forEach((chest) => {
          const chestKey = `${chest.x},${chest.y}`;
          const stillExists = (gameState.map.chests || []).some(
            (c) =>
              Math.abs(c.position.x - chest.x) < 20 &&
              Math.abs(c.position.y - chest.y) < 20
          );

          if (!stillExists) {
            this.destroyedChests.add(chestKey);
          }
        });

        this.placedBombs.delete(bombKey);
      }
    }

    // 4. Track NEW bombs that appear (including verification of our bombs)
    for (const bomb of gameState.map.bombs) {
      const snapped = snapToGrid(bomb.position);
      const bombKey = `${snapped.x},${snapped.y}`;

      if (
        !this.placedBombs.has(bombKey) &&
        bomb.ownerId === gameState.currentBot.id
      ) {
        // This is our bomb that just appeared on server
        const targetChests = this.getTargetChests(bomb.position, gameState);
        this.placedBombs.set(bombKey, {
          position: bomb.position,
          targetChests: targetChests,
          placedAt: Date.now(), // For reference only
        });
      }
    }

    // 5. Clean up destroyed chests that respawned or were incorrectly marked
    const currentChestKeys = new Set(
      (gameState.map.chests || []).map((c) => `${c.position.x},${c.position.y}`)
    );

    for (const chestKey of this.destroyedChests) {
      if (currentChestKeys.has(chestKey)) {
        this.destroyedChests.delete(chestKey);
      }
    }
  }

  /**
   * Tìm vị trí bomb thay thế gần current position hơn
   */
  private findAlternativeBombPosition(
    gameState: GameState,
    currentPos: Position
  ): {
    position: Position;
    score: number;
    chestsCount: number;
  } | null {
    console.log(
      `🔄 Searching for alternative bomb positions near current location...`
    );

    // Search trong radius nhỏ hơn xung quanh current position
    const searchRadius = 3; // Smaller radius for alternatives
    const candidatePositions = this.generateCandidatePositions(
      currentPos,
      searchRadius,
      gameState
    );

    let bestAlternative: {
      position: Position;
      score: number;
      chestsCount: number;
    } | null = null;

    for (const candidatePos of candidatePositions) {
      // Kiểm tra có thể đến được vị trí này không
      if (!canMoveTo(candidatePos, gameState)) continue;

      // Kiểm tra khoảng cách có hợp lý không
      const distance = manhattanDistance(currentPos, candidatePos);
      if (distance > 120) continue; // Max 3 cells away

      // CRITICAL: Kiểm tra có đường đi đến vị trí này không
      const path = Pathfinding.findPath(currentPos, candidatePos, gameState);
      if (!path || path.length === 0) {
        console.log(
          `   ❌ No path to alternative (${candidatePos.x}, ${candidatePos.y}) - skipping`
        );
        continue;
      }

      const evaluation = this.evaluateBombPosition(candidatePos, gameState);
      if (!evaluation || evaluation.chestsCount === 0) continue;

      console.log(
        `🎯 Alternative candidate (${candidatePos.x}, ${candidatePos.y}): ${evaluation.chestsCount} chests, score: ${evaluation.score}, distance: ${distance}px`
      );

      // Tìm alternative tốt nhất (ưu tiên khoảng cách gần)
      if (
        !bestAlternative ||
        evaluation.chestsCount > bestAlternative.chestsCount ||
        (evaluation.chestsCount === bestAlternative.chestsCount &&
          distance < manhattanDistance(currentPos, bestAlternative.position))
      ) {
        bestAlternative = {
          position: candidatePos,
          score: evaluation.score,
          chestsCount: evaluation.chestsCount,
        };
      }
    }

    return bestAlternative;
  }

  /**
   * Tìm vị trí tối ưu để đặt bom - có thể phá nhiều tường cùng lúc
   */
  private findOptimalBombPosition(
    gameState: GameState,
    availableChests?: any[]
  ): {
    position: Position;
    score: number;
    chestsCount: number;
    safetyScore: number;
  } | null {
    const currentTime = Date.now();

    // Sử dụng cache nếu còn hiệu lực
    if (
      this.cachedBestPosition &&
      currentTime - this.lastEvaluationTime < this.cacheDuration
    ) {
      const cached = this.evaluateBombPosition(
        this.cachedBestPosition,
        gameState
      );
      if (cached && cached.chestsCount > 0) {
        return {
          position: this.cachedBestPosition,
          score: cached.score,
          chestsCount: cached.chestsCount,
          safetyScore: cached.safetyScore,
        };
      }
    }

    const currentPos = gameState.currentBot.position;
    const flameRange = gameState.currentBot.flameRange;
    const chests = availableChests || gameState.map.chests || [];

    if (chests.length === 0) return null;

    let bestPosition: Position | null = null;
    let bestScore = 0;
    let bestChestsCount = 0;
    let bestSafetyScore = 0;

    /**
     * Đánh giá vị trí hiện tại trước
     */
    console.log(
      `🎯 Evaluating current position: (${currentPos.x}, ${currentPos.y})`
    );
    const currentEval = this.evaluateBombPosition(currentPos, gameState);
    if (currentEval && currentEval.chestsCount > 0) {
      console.log(
        `✅ Current position can hit ${currentEval.chestsCount} chests (score: ${currentEval.score})`
      );

      // CRITICAL: Only use current position if it has escape routes (safe)
      const canEscapeCurrent = this.canEscapeAfterBombAdvanced(currentPos, gameState);

      if (canEscapeCurrent) {
        console.log(`🎯 EARLY RETURN: Current position is safe and can hit chests!`);
        this.cachedBestPosition = currentPos;
        this.lastEvaluationTime = currentTime;
        return {
          position: currentPos,
          score: currentEval.score,
          chestsCount: currentEval.chestsCount,
          safetyScore: currentEval.safetyScore,
        };
      } else {
        console.log(`⚠️ Current position can hit chests but NOT SAFE - searching for safer position`);
        // CRITICAL: Set current as baseline but with HEAVY penalty to prefer safer alternatives
        // Only use if no better option found
        bestPosition = currentPos;
        bestScore = -1000; // Massive penalty - prefer any safer position
        bestChestsCount = currentEval.chestsCount;
        bestSafetyScore = 0; // Mark as unsafe
      }
    } else {
      console.log(`❌ Current position cannot hit any chests`);
    }

    // Tìm kiếm các vị trí tối ưu trong phạm vi hợp lý
    const searchRadius = Math.min(5, flameRange + 2);
    console.log(
      `🔍 Search radius: ${searchRadius} cells (${searchRadius * 40}px)`
    );
    const candidatePositions = this.generateCandidatePositions(
      currentPos,
      searchRadius,
      gameState
    );

    console.log(
      `📝 Generated ${candidatePositions.length} candidate positions`
    );

    for (const candidatePos of candidatePositions) {
      // Kiểm tra có thể đến được vị trí này không
      if (!canMoveTo(candidatePos, gameState)) continue;

      // Kiểm tra khoảng cách có hợp lý không (không quá xa)
      const distance = manhattanDistance(currentPos, candidatePos);
      if (distance > searchRadius * 40) continue; // 40 pixels per cell

      // CRITICAL: Kiểm tra có đường đi đến vị trí này không
      const path = Pathfinding.findPath(currentPos, candidatePos, gameState);
      if (!path || path.length === 0) {
        console.log(
          `   ❌ No path to candidate (${candidatePos.x}, ${candidatePos.y}) - skipping`
        );
        continue;
      }

      const evaluation = this.evaluateBombPosition(candidatePos, gameState);
      if (!evaluation || evaluation.chestsCount === 0) continue;

      // Debug log cho candidate position
      console.log(
        `🎯 Candidate (${candidatePos.x}, ${candidatePos.y}): ${evaluation.chestsCount} chests, score: ${evaluation.score}, distance: ${distance}px`
      );

      // Tính điểm tổng hợp (kết hợp số tường phá được và khoảng cách)
      const distancePenalty = distance * 2; // Penalty cho khoảng cách xa
      let adjustedScore = evaluation.score - distancePenalty;

      // CRITICAL: Boost score for positions with better safety
      // Prioritize positions that can escape over unsafe current position
      if (evaluation.safetyScore > 100) {
        // Has escape routes
        adjustedScore += 50; // Significant safety bonus
        console.log(`   ⬆️ Safety bonus: +50 (safetyScore: ${evaluation.safetyScore})`);
      }

      // Ưu tiên vị trí phá được nhiều tường hơn, hoặc score cao hơn nếu bằng nhau
      const isBetter =
        evaluation.chestsCount > bestChestsCount ||
        (evaluation.chestsCount === bestChestsCount &&
          adjustedScore > bestScore);

      if (isBetter) {
        console.log(
          `✅ NEW BEST: (${candidatePos.x}, ${candidatePos.y}) - ${evaluation.chestsCount} chests, adjusted score: ${adjustedScore}`
        );
        bestPosition = candidatePos;
        bestScore = adjustedScore;
        bestChestsCount = evaluation.chestsCount;
        bestSafetyScore = evaluation.safetyScore;
      }
    }

    if (bestPosition) {
      this.cachedBestPosition = bestPosition;
      this.lastEvaluationTime = currentTime;

      return {
        position: bestPosition,
        score: bestScore,
        chestsCount: bestChestsCount,
        safetyScore: bestSafetyScore,
      };
    }

    return null;
  }

  /**
   * Tạo danh sách các vị trí ứng viên để đặt bom
   */
  private generateCandidatePositions(
    center: Position,
    radius: number,
    gameState: GameState
  ): Position[] {
    const candidates: Position[] = [];
    const cellSize = 40; // Kích thước cell tiêu chuẩn

    // Tạo lưới các vị trí ứng viên
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue; // Bỏ qua vị trí hiện tại

        const candidatePos: Position = {
          x: center.x + dx * cellSize,
          y: center.y + dy * cellSize,
        };

        // Kiểm tra trong bounds của map
        if (
          candidatePos.x >= 0 &&
          candidatePos.x < gameState.map.width &&
          candidatePos.y >= 0 &&
          candidatePos.y < gameState.map.height
        ) {
          candidates.push(candidatePos);
        }
      }
    }

    // Thêm các vị trí gần chests trực tiếp
    const chests = gameState.map.chests || [];
    for (const chest of chests) {
      const nearChestPositions = this.getPositionsNearTarget(
        chest.position,
        gameState.currentBot.flameRange
      );
      candidates.push(...nearChestPositions);
    }

    // Loại bỏ duplicate và sắp xếp theo khoảng cách
    const uniqueCandidates = candidates.filter(
      (pos, index, self) =>
        index ===
        self.findIndex(
          (p) => Math.abs(p.x - pos.x) < 20 && Math.abs(p.y - pos.y) < 20
        )
    );

    return uniqueCandidates.sort(
      (a, b) => manhattanDistance(center, a) - manhattanDistance(center, b)
    );
  }

  /**
   * Lấy các vị trí có thể đặt bom để bắn trúng target trong phạm vi flame range
   * Logic: Tìm vị trí mà bom có thể đặt để flame đến được target
   */
  private getPositionsNearTarget(
    target: Position,
    flameRange: number
  ): Position[] {
    const positions: Position[] = [];
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 }, // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }, // RIGHT
    ];

    // Tìm vị trí để đặt bom sao cho flame có thể đến target
    for (const dir of directions) {
      for (let distance = 1; distance <= flameRange; distance++) {
        // Vị trí đặt bom = target - direction * distance
        // Để flame từ bomb position bắn về target
        positions.push({
          x: target.x - dir.dx * distance * 40,
          y: target.y - dir.dy * distance * 40,
        });
      }
    }

    return positions;
  }

  /**
   * IMPROVED: Đánh giá một vị trí để đặt bom với safety scoring
   */
  private evaluateBombPosition(
    position: Position,
    gameState: GameState
  ): {
    score: number;
    chestsCount: number;
    safetyScore: number;
  } | null {
    const flameRange = gameState.currentBot.flameRange;
    const directions = [
      { dx: 0, dy: -1 }, // UP
      { dx: 0, dy: 1 }, // DOWN
      { dx: -1, dy: 0 }, // LEFT
      { dx: 1, dy: 0 }, // RIGHT
    ];

    let totalScore = 0;
    let chestsCount = 0;
    let safetyScore = 100; // Start with perfect safety
    const hitChests = new Set<string>();

    // QUAN TRỌNG: Snap bomb position về grid (bom được căn về ô nó thuộc)
    const snappedBombPos = {
      x: Math.round(position.x / 40) * 40,
      y: Math.round(position.y / 40) * 40,
    };

    console.log(`💣 DEBUG evaluateBombPosition:`);
    console.log(`   Original position: (${position.x}, ${position.y})`);
    console.log(
      `   Snapped position: (${snappedBombPos.x}, ${snappedBombPos.y})`
    );
    console.log(`   Flame range: ${flameRange}`);

    // NEW: Check if position is currently in danger zone
    if (isPositionInDangerZone(position, gameState)) {
      console.log(`   ⚠️ Position is in DANGER ZONE!`);
      safetyScore -= 80; // Heavy penalty

      // Find closest bomb threat
      const closestBomb = gameState.map.bombs.reduce((closest, bomb) => {
        const dist = manhattanDistance(position, bomb.position);
        const closestDist = closest
          ? manhattanDistance(position, closest.position)
          : Infinity;
        return dist < closestDist ? bomb : closest;
      }, null as (typeof gameState.map.bombs)[0] | null);

      if (closestBomb) {
        const timeLeft = closestBomb.timeRemaining || 5000;
        console.log(`   💣 Closest bomb: ${timeLeft}ms remaining`);
        if (timeLeft < 2000) {
          console.log(
            `   🚨 CRITICAL: Bomb exploding soon, rejecting position!`
          );
          return null; // Too dangerous
        }
      }
    }

    // NEW: Check for enemy players nearby (collision risk)
    const nearbyEnemies = gameState.enemies.filter((enemy) => {
      const dist = manhattanDistance(position, enemy.position);
      return enemy.isAlive && dist < 80; // Within 2 cells
    });

    if (nearbyEnemies.length > 0) {
      safetyScore -= nearbyEnemies.length * 15;
      console.log(
        `   👥 ${nearbyEnemies.length} enemies nearby (-${
          nearbyEnemies.length * 15
        } safety)`
      );
    }

    // Đánh giá tại vị trí bom (sử dụng vị trí đã snap) - FIXED: Snap chest positions
    const chestAtBomb = (gameState.map.chests || []).find((c) => {
      const snappedChestX = Math.round(c.position.x / 40) * 40;
      const snappedChestY = Math.round(c.position.y / 40) * 40;
      return (
        Math.abs(snappedChestX - snappedBombPos.x) < 20 &&
        Math.abs(snappedChestY - snappedBombPos.y) < 20
      );
    });
    if (chestAtBomb) {
      const chestKey = `${chestAtBomb.position.x},${chestAtBomb.position.y}`;
      if (!hitChests.has(chestKey)) {
        hitChests.add(chestKey);
        chestsCount++;
        totalScore += 100; // Điểm cao cho chest
        console.log(
          `   ✅ Chest at bomb position: (${chestAtBomb.position.x}, ${chestAtBomb.position.y})`
        );
      }
    }

    // Đánh giá theo 4 hướng (sử dụng vị trí bom đã snap)
    for (const dir of directions) {
      console.log(`   🔥 Checking direction: dx=${dir.dx}, dy=${dir.dy}`);
      for (let i = 1; i <= flameRange; i++) {
        const checkPos = {
          x: snappedBombPos.x + dir.dx * i * 40,
          y: snappedBombPos.y + dir.dy * i * 40,
        };

        console.log(
          `      Range ${i}: checking position (${checkPos.x}, ${checkPos.y})`
        );

        // Kiểm tra có chest không - FIXED: Snap chest positions to grid for comparison
        const chest = (gameState.map.chests || []).find((c) => {
          const snappedChestX = Math.round(c.position.x / 40) * 40;
          const snappedChestY = Math.round(c.position.y / 40) * 40;
          return (
            Math.abs(snappedChestX - checkPos.x) < 20 &&
            Math.abs(snappedChestY - checkPos.y) < 20
          );
        });

        if (chest) {
          const chestKey = `${chest.position.x},${chest.position.y}`;
          if (!hitChests.has(chestKey)) {
            hitChests.add(chestKey);
            chestsCount++;
            totalScore += 100;
            console.log(
              `      ✅ HIT CHEST: (${chest.position.x}, ${chest.position.y})`
            );
          } else {
            console.log(
              `      ⚠️ Already counted chest: (${chest.position.x}, ${chest.position.y})`
            );
          }
          // CRITICAL: Chest blocks flame! Don't continue checking beyond this point
          console.log(
            `      📦 Flame STOPS at chest - cannot hit anything beyond`
          );
          break;
        }

        // Kiểm tra có enemy không
        const enemy = gameState.enemies.find(
          (e) =>
            e.isAlive &&
            Math.abs(e.position.x - checkPos.x) < 30 &&
            Math.abs(e.position.y - checkPos.y) < 30
        );
        if (enemy) {
          totalScore += 150; // Reduced from 200 (chest priority)
          console.log(
            `      💀 Can hit enemy at (${enemy.position.x}, ${enemy.position.y})`
          );
        }

        // Kiểm tra tường cứng (dừng flame)
        const solidWall = gameState.map.walls.find(
          (w) =>
            Math.abs(w.position.x - checkPos.x) < 20 &&
            Math.abs(w.position.y - checkPos.y) < 20
        );
        if (solidWall) {
          console.log(`      🧱 Flame blocked by solid wall`);
          break; // Tường cứng chặn flame
        }

        // Note: Chest blocking is handled above after counting the chest hit
        // No need for duplicate check here
      }
    }

    // NEW: Bonus for multiple escape routes
    const escapeRoutes = this.countEscapeRoutes(snappedBombPos, gameState);
    safetyScore += escapeRoutes * 5;
    console.log(
      `   🚪 Escape routes: ${escapeRoutes} (+${escapeRoutes * 5} safety)`
    );

    // Combined score with safety weighting
    const finalScore = totalScore + safetyScore;

    console.log(
      `   💯 Final result: ${chestsCount} chests, combat: ${totalScore}, safety: ${safetyScore}, total: ${finalScore}`
    );
    return chestsCount > 0
      ? { score: finalScore, chestsCount, safetyScore }
      : null;
  }

  /**
   * NEW: Calculate dynamic priority based on game context
   */
  private calculateDynamicPriority(
    bestPosition: {
      position: Position;
      score: number;
      chestsCount: number;
      safetyScore: number;
    },
    gameState: GameState
  ): number {
    let priority = this.priority; // Base 50

    // Factor 1: Chest count bonus (more chests = higher priority)
    const chestBonus = bestPosition.chestsCount * 5;
    priority += chestBonus;

    // Factor 2: Safety bonus/penalty
    const safetyAdjustment = Math.floor((bestPosition.safetyScore - 50) / 10);
    priority += safetyAdjustment;

    // Factor 3: Urgency (few chests left on map)
    const totalChests = (gameState.map.chests || []).length;
    let urgencyBonus = 0;
    if (totalChests <= 3) {
      urgencyBonus = 15; // High urgency
    } else if (totalChests <= 10) {
      urgencyBonus = 5; // Medium urgency
    }
    priority += urgencyBonus;

    // Factor 4: Competition (enemies nearby)
    const nearbyEnemies = gameState.enemies.filter((e) => {
      const dist = manhattanDistance(gameState.currentBot.position, e.position);
      return e.isAlive && dist < 200; // Within 5 cells
    }).length;
    const competitionBonus = nearbyEnemies * 3;
    priority += competitionBonus;

    // Factor 5: Penalty if currently in danger zone
    let dangerPenalty = 0;
    if (isPositionInDangerZone(gameState.currentBot.position, gameState)) {
      dangerPenalty = -30; // Lower priority if we need to escape first
      priority += dangerPenalty;
    }

    console.log(`📊 Dynamic priority calculation:`);
    console.log(`   Base priority: ${this.priority}`);
    console.log(
      `   + Chest bonus: ${chestBonus} (${bestPosition.chestsCount} chests)`
    );
    console.log(
      `   + Safety adjustment: ${safetyAdjustment} (safety: ${bestPosition.safetyScore})`
    );
    console.log(
      `   + Urgency bonus: ${urgencyBonus} (${totalChests} chests left)`
    );
    console.log(
      `   + Competition bonus: ${competitionBonus} (${nearbyEnemies} enemies nearby)`
    );
    if (dangerPenalty !== 0) {
      console.log(`   + Danger penalty: ${dangerPenalty}`);
    }
    console.log(`   = Final priority: ${priority}`);

    return priority;
  }

  /**
   * NEW: Check progress and prevent infinite loops with enhanced detection
   */
  private checkProgressAndPreventLoop(
    currentPos: Position,
    targetPosition: Position
  ): boolean {
    // Add to position history
    this.positionHistory.push({ x: currentPos.x, y: currentPos.y });
    if (this.positionHistory.length > this.HISTORY_SIZE) {
      this.positionHistory.shift();
    }

    // Check 1: Same target check (existing)
    const targetKey = `${targetPosition.x},${targetPosition.y}`;
    const lastTargetKey = this.lastTargetPosition
      ? `${this.lastTargetPosition.x},${this.lastTargetPosition.y}`
      : null;

    if (lastTargetKey === targetKey) {
      this.noProgressCount++;

      // NEW: Check if actually moving - with more lenient threshold
      if (this.positionHistory.length >= 5) {
        // Check over 5 frames instead of 3
        const recent = this.positionHistory.slice(-5);
        const avgX = recent.reduce((sum, p) => sum + p.x, 0) / recent.length;
        const avgY = recent.reduce((sum, p) => sum + p.y, 0) / recent.length;

        // Check if bot has moved less than 15 pixels in any direction over 5 frames
        // 15 pixels over 5 frames = 3 pixels/frame average (very slow or stuck)
        const maxDeviation = Math.max(
          ...recent.map(
            (pos) => Math.abs(pos.x - avgX) + Math.abs(pos.y - avgY)
          )
        );

        const isStuck = maxDeviation < 15; // Less than 15 pixels total movement

        if (isStuck) {
          this.stuckFrameCount++;
          console.log(
            `⚠️ Bot is STUCK at same position for ${
              this.stuckFrameCount
            } frames (deviation: ${maxDeviation.toFixed(1)}px)`
          );

          if (this.stuckFrameCount >= this.MAX_STUCK_FRAMES) {
            console.log(
              `🛑 STUCK detected! Bot hasn't moved significantly for ${this.MAX_STUCK_FRAMES} frames`
            );
            this.resetProgressTracking();
            return false; // Signal to abandon this target
          }
        } else {
          this.stuckFrameCount = 0; // Making progress
          console.log(
            `✅ Bot is moving (deviation: ${maxDeviation.toFixed(1)}px)`
          );
        }
      }

      if (this.noProgressCount >= this.MAX_NO_PROGRESS) {
        console.log(
          `🛑 Same target for ${this.MAX_NO_PROGRESS} attempts, abandoning`
        );
        this.resetProgressTracking();
        return false;
      }
    } else {
      // New target, reset counters
      this.lastTargetPosition = targetPosition;
      this.noProgressCount = 0;
      this.stuckFrameCount = 0;
    }

    return true; // Can continue
  }

  /**
   * NEW: Reset all progress tracking state
   */
  private resetProgressTracking(): void {
    this.lastTargetPosition = null;
    this.noProgressCount = 0;
    this.stuckFrameCount = 0;
    this.positionHistory = [];
    this.cachedBestPosition = null; // Also clear cache
    console.log(`🔄 Progress tracking reset`);
  }

  /**
   * NEW: Count number of escape routes from a position
   */
  private countEscapeRoutes(position: Position, gameState: GameState): number {
    const directions = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];
    let escapeCount = 0;

    for (const dir of directions) {
      const testPos = getPositionInDirection(position, dir, 40);

      if (
        canMoveTo(testPos, gameState) &&
        !isPositionInDangerZone(testPos, gameState)
      ) {
        escapeCount++;
      }
    }

    return escapeCount;
  }

  /**
   * Lấy hướng di chuyển đến vị trí mục tiêu
   */
  private getDirectionToPosition(
    from: Position,
    to: Position
  ): Direction | null {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // Ưu tiên hướng có khoảng cách lớn hơn
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else if (Math.abs(dy) > 0) {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }

    return null;
  }

  /**
   * IMPROVED: Kiểm tra có thể thoát sau khi đặt bom không - xét tất cả bombs trên map
   */
  private canEscapeAfterBombAdvanced(
    bombPosition: Position,
    gameState: GameState
  ): boolean {
    console.log(
      `🚪 DEBUG canEscapeAfterBombAdvanced: Enhanced escape analysis with multiple bombs...`
    );
    console.log(`💣 New bomb position: (${bombPosition.x}, ${bombPosition.y})`);
    console.log(`🔥 Flame range: ${gameState.currentBot.flameRange}`);
    console.log(`⚡ Bot speed: ${gameState.currentBot.speed || 1}`);

    // QUAN TRỌNG: Snap bomb position về grid (bom được căn về ô nó thuộc)
    const snappedBombPos = {
      x: Math.round(bombPosition.x / 40) * 40,
      y: Math.round(bombPosition.y / 40) * 40,
    };

    console.log(
      `📍 Snapped bomb position: (${snappedBombPos.x}, ${snappedBombPos.y})`
    );

    // Mô phỏng việc đặt bom (sử dụng vị trí đã snap)
    const simulatedBomb = {
      id: "temp-wallbreaker-advanced",
      position: snappedBombPos,
      ownerId: gameState.currentBot.id,
      timeRemaining: 5000,
      flameRange: gameState.currentBot.flameRange,
    };

    console.log(`💣 Simulated bomb details:`, {
      timeRemaining: simulatedBomb.timeRemaining,
      flameRange: simulatedBomb.flameRange,
      position: simulatedBomb.position,
    });

    // NEW: Create temporary game state with simulated bomb ADDED
    const tempGameState: GameState = {
      ...gameState,
      map: {
        ...gameState.map,
        bombs: [...gameState.map.bombs, simulatedBomb], // Include ALL bombs
      },
    };

    console.log(
      `💥 Total bombs in simulation: ${tempGameState.map.bombs.length}`
    );
    console.log(`   Existing bombs: ${gameState.map.bombs.length}`);
    console.log(`   Simulated bomb: 1`);

    // Log all bombs for context
    tempGameState.map.bombs.forEach((bomb, index) => {
      const dist = manhattanDistance(snappedBombPos, bomb.position);
      console.log(
        `  Bomb ${index + 1}: (${bomb.position.x}, ${
          bomb.position.y
        }) - range: ${bomb.flameRange}, time: ${
          bomb.timeRemaining
        }ms, distance: ${dist}px`
      );
    });

    // IMPROVED: Check distance to existing bombs for smarter decision
    if (gameState.map.bombs.length > 0) {
      const minDistanceToExistingBombs = Math.min(
        ...gameState.map.bombs.map((b) =>
          manhattanDistance(snappedBombPos, b.position)
        )
      );

      const SAFE_DISTANCE = 60; // 1.5 cells
      if (minDistanceToExistingBombs > SAFE_DISTANCE) {
        console.log(
          `   ℹ️ Position is safe distance from existing bombs (${minDistanceToExistingBombs.toFixed(
            0
          )}px > ${SAFE_DISTANCE}px)`
        );
        // Still need to check if we can escape from the NEW bomb
        console.log(`   Checking escape from new bomb only...`);
      } else {
        console.log(
          `   ⚠️ Position near existing bomb (${minDistanceToExistingBombs.toFixed(
            0
          )}px <= ${SAFE_DISTANCE}px), full escape analysis needed`
        );
      }
    }

    // Check if position is in danger with new bomb (using improved detection)
    const isInDanger = isPositionInDangerZone(snappedBombPos, tempGameState);
    console.log(
      `   Position danger status: ${isInDanger ? "⚠️ DANGER" : "✅ SAFE"}`
    );

    // If position is safe even with new bomb, no need for escape check
    if (!isInDanger) {
      console.log(
        `   ✅ Position safe even with new bomb placed! No escape needed.`
      );
      return true;
    }

    // Use existing canEscapeFromBomb but with FULL bomb context
    const canEscape = canEscapeFromBomb(
      snappedBombPos,
      simulatedBomb,
      tempGameState // Use temp state with all bombs
    );

    console.log(
      `🚪 Escape result: ${canEscape ? "✅ CAN ESCAPE" : "❌ CANNOT ESCAPE"}`
    );

    if (!canEscape) {
      console.log(
        `⚠️  DANGER: Bot would be trapped with ${tempGameState.map.bombs.length} bombs on map!`
      );
      console.log(`💡 Suggestion: Wait for other bombs to explode first`);
    } else {
      console.log(
        `✅ SAFE: Bot can escape even with ${tempGameState.map.bombs.length} bombs`
      );
    }

    return canEscape;
  }
}
