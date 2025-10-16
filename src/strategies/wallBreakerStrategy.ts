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

  // Path-following plan state
  private currentPlan: {
    phase: "MOVING_TO_TARGET";
    path: Position[];
    bombPosition: Position;
    targetChests: number;
    plannedAt: number;
  } | null = null;

  evaluate(gameState: GameState): BotDecision | null {
    console.log(`\n🧱 === WallBreakerStrategy EVALUATION START ===`);
    const currentPos = gameState.currentBot.position;

    this.updateBombTracking(gameState);

    if (gameState.currentBot.bombCount <= 0) {
      this.currentPlan = null; // Clear plan if no bombs
      return null;
    }

    // PRIORITY 1: Check if we have an active plan and should continue following it
    if (this.currentPlan && !this.shouldReplan(gameState)) {
      console.log(`📋 Continuing existing bomb placement plan...`);

      const distanceToTarget = manhattanDistance(
        currentPos,
        this.currentPlan.bombPosition
      );

      // Check if reached target → BOMB
      if (distanceToTarget <= 20) {
        console.log(`✅ Reached bomb placement target! Placing bomb...`);

        // CRITICAL: Check if bomb already exists at this position
        const snappedBombPos = snapToGrid(this.currentPlan.bombPosition);
        const existingBomb = gameState.map.bombs.find((bomb) => {
          const snappedExistingPos = snapToGrid(bomb.position);
          const distance = manhattanDistance(
            snappedExistingPos,
            snappedBombPos
          );
          return distance < 20;
        });

        if (existingBomb) {
          console.log(`❌ Bomb already exists at target, clearing plan`);
          this.currentPlan = null;
          return null;
        }

        // Final escape check
        const canEscape = this.canEscapeAfterBombAdvanced(
          this.currentPlan.bombPosition,
          gameState
        );

        if (!canEscape) {
          console.log(
            `❌ Cannot escape from planned bomb position, replanning`
          );
          this.currentPlan = null;
          return null;
        }

        // Execute bomb placement
        const targetChests = this.getTargetChests(
          this.currentPlan.bombPosition,
          gameState
        );
        this.trackBombPlacement(this.currentPlan.bombPosition, targetChests);

        const finalPriority = this.priority + this.currentPlan.targetChests * 5;
        const targetChestsCount = this.currentPlan.targetChests;

        // Clear plan after execution
        this.currentPlan = null;

        console.log(
          `🧱 === WallBreakerStrategy EVALUATION END (PLAN BOMB) ===\n`
        );
        return this.createDecision(
          BotAction.BOMB,
          finalPriority,
          `Executing planned bomb (${targetChestsCount} chests)`
        );
      }

      // Continue following path
      const movePriority =
        this.priority + this.currentPlan.targetChests * 2 + 10; // Boost priority for committed plan
      console.log(
        `🧱 === WallBreakerStrategy EVALUATION END (PLAN MOVE) ===\n`
      );
      return this.createDecision(
        BotAction.MOVE,
        movePriority,
        `Following bomb placement path (${distanceToTarget}px away)`,
        Direction.STOP, // Will be calculated from path
        this.currentPlan.bombPosition,
        this.currentPlan.path
      );
    }

    // PRIORITY 2: No plan or need to replan - create new plan
    console.log(`📋 Creating new bomb placement plan...`);

    // Find available chests
    const allChests = (gameState.map.chests || []).slice();
    const availableChests = allChests.filter((chest) => {
      const chestKey = `${chest.position.x},${chest.position.y}`;

      // Skip if already destroyed
      if (this.destroyedChests.has(chestKey)) return false;

      // Skip if currently targeted by active bomb
      for (const bombInfo of this.placedBombs.values()) {
        const isTargeted = bombInfo.targetChests.some(
          (target) =>
            Math.abs(target.x - chest.position.x) < 20 &&
            Math.abs(target.y - chest.position.y) < 20
        );
        if (isTargeted) return false;
      }

      return true;
    });

    if (availableChests.length === 0) {
      return null;
    }

    const bestPosition = this.findOptimalBombPosition(
      gameState,
      availableChests
    );

    if (!bestPosition) {
      return null;
    }

    // Check if already at target
    const distanceToTarget = manhattanDistance(
      currentPos,
      bestPosition.position
    );
    if (distanceToTarget <= 20) {
      if (isPositionInDangerZone(currentPos, gameState)) {
        this.currentPlan = null;
        return null;
      }

      const canEscape = this.canEscapeAfterBombAdvanced(
        bestPosition.position,
        gameState
      );

      if (!canEscape) {
        this.currentPlan = null;
        return null;
      }

      const targetChests = this.getTargetChests(
        bestPosition.position,
        gameState
      );
      this.trackBombPlacement(bestPosition.position, targetChests);

      const finalPriority = this.calculateDynamicPriority(
        bestPosition,
        gameState
      );

      this.currentPlan = null; // Clear plan after execution

      console.log(
        `🧱 === WallBreakerStrategy EVALUATION END (IMMEDIATE BOMB) ===\n`
      );
      return this.createDecision(
        BotAction.BOMB,
        finalPriority,
        `Immediate bomb (${bestPosition.chestsCount} chests)`
      );
    }
    // Find path to optimal position
    const path = Pathfinding.findPath(
      currentPos,
      bestPosition.position,
      gameState
    );

    if (!path || path.length === 0) {
      return null;
    }

    // Create new plan
    this.currentPlan = {
      phase: "MOVING_TO_TARGET",
      path: path,
      bombPosition: bestPosition.position,
      targetChests: bestPosition.chestsCount,
      plannedAt: Date.now(),
    };

    // Start following path
    const movePriority = this.priority + bestPosition.chestsCount * 2;
    console.log(
      `🧱 === WallBreakerStrategy EVALUATION END (NEW PLAN MOVE) ===\n`
    );
    return this.createDecision(
      BotAction.MOVE,
      movePriority,
      `Starting bomb placement path (${bestPosition.chestsCount} chests)`,
      Direction.STOP,
      bestPosition.position,
      path
    );
  }

  /**
   * Track bomb placement and target chests
   */
  private trackBombPlacement(
    bombPosition: Position,
    targetChests: Position[]
  ): void {
    const snappedPos = snapToGrid(bombPosition);
    const bombKey = `${snappedPos.x},${snappedPos.y}`;

    this.placedBombs.set(bombKey, {
      position: bombPosition,
      targetChests: targetChests,
      placedAt: Date.now(),
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

    const snappedBombPos = snapToGrid(bombPosition);

    // Check chest at bomb position
    const chestAtBomb = (gameState.map.chests || []).find((c) => {
      const snappedChest = snapToGrid(c.position);
      return (
        Math.abs(snappedChest.x - snappedBombPos.x) < 20 &&
        Math.abs(snappedChest.y - snappedBombPos.y) < 20
      );
    });
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

        const chest = (gameState.map.chests || []).find((c) => {
          const snappedChest = snapToGrid(c.position);
          return (
            Math.abs(snappedChest.x - checkPos.x) < 20 &&
            Math.abs(snappedChest.y - checkPos.y) < 20
          );
        });

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
   * Clean up expired bomb tracking and update destroyed chests based on actual game state
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
    const currentPos = gameState.currentBot.position;
    const flameRange = gameState.currentBot.flameRange;
    const chests = availableChests || gameState.map.chests || [];

    if (!chests.length) return null;

    // 1️⃣ Cache
    if (
      this.cachedBestPosition &&
      currentTime - this.lastEvaluationTime < this.cacheDuration
    ) {
      const cached = this.evaluateBombPosition(
        this.cachedBestPosition,
        gameState
      );
      if (cached && cached.chestsCount > 0) {
        return { ...cached, position: this.cachedBestPosition };
      }
    }

    // 3️⃣ Evaluate current position first
    const currentEval = this.evaluateBombPosition(currentPos, gameState);
    if (currentEval && currentEval.chestsCount > 0) {
      if (this.canEscapeAfterBombAdvanced(currentPos, gameState)) {
        this.cachedBestPosition = currentPos;
        this.lastEvaluationTime = currentTime;
        return { position: currentPos, ...currentEval };
      }
    }

    // 4️⃣ Generate candidate positions
    const searchRadius = Math.min(5, flameRange + 2);
    const candidatePositions = this.generateCandidatePositions(
      currentPos,
      searchRadius,
      gameState
    );

    // Collect ALL valid candidates (that pass escape check)
    const validCandidates: Array<{
      pos: Position;
      adjustedScore: number;
      eval: any;
    }> = [];

    for (const candidatePos of candidatePositions) {
      if (!canMoveTo(candidatePos, gameState)) continue;
      const distance = manhattanDistance(currentPos, candidatePos);
      if (distance > searchRadius * 40) continue;

      const path = Pathfinding.findPath(currentPos, candidatePos, gameState);
      if (!path || path.length === 0) continue;

      const evaluation = this.evaluateBombPosition(candidatePos, gameState);
      if (!evaluation || evaluation.chestsCount === 0) continue;

      const canEscape = this.canEscapeAfterBombAdvanced(
        candidatePos,
        gameState
      );
      if (!canEscape) {
        console.log(
          `   ⚠️  Candidate (${candidatePos.x}, ${candidatePos.y}) rejected - cannot escape`
        );
        continue;
      }

      const adjustedScore = this.computeAdjustedScore(evaluation, distance);

      // Reject unsafe candidates
      if (adjustedScore < 0) continue;

      // Add to valid candidates list
      validCandidates.push({
        pos: candidatePos,
        adjustedScore,
        eval: evaluation,
      });
    }

    if (validCandidates.length === 0) {
      return null;
    }

    validCandidates.sort((a, b) => {
      if (a.eval.chestsCount !== b.eval.chestsCount) {
        return b.eval.chestsCount - a.eval.chestsCount;
      }
      return b.adjustedScore - a.adjustedScore;
    });

    const bestCandidate = validCandidates[0];

    if (!bestCandidate) {
      return null;
    }

    this.cachedBestPosition = bestCandidate.pos;
    this.lastEvaluationTime = currentTime;
    return {
      position: bestCandidate.pos,
      score: bestCandidate.adjustedScore,
      chestsCount: bestCandidate.eval.chestsCount,
      safetyScore: bestCandidate.eval.safetyScore,
    };
  }

  private computeAdjustedScore = (evaluation: any, distance: number) => {
    let score = evaluation.score - distance * 2; // distance penalty

    if (evaluation.safetyScore > 100) {
      score += 50; // safe bonus
    } else if (evaluation.safetyScore < 50) {
      score -= 200; // unsafe penalty
    } else {
      score -= 100; // marginal safety
    }

    return score;
  };

  /**
   * Tạo danh sách các vị trí ứng viên để đặt bom
   */
  private generateCandidatePositions(
    center: Position,
    radius: number,
    gameState: GameState
  ): Position[] {
    const candidates: Position[] = [];
    const cellSize = 40;

    const snappedCenter = snapToGrid(center);

    // Tạo lưới các vị trí ứng viên
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue; // Bỏ qua vị trí hiện tại

        const candidatePos: Position = {
          x: snappedCenter.x + dx * cellSize,
          y: snappedCenter.y + dy * cellSize,
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
      (a, b) =>
        manhattanDistance(snappedCenter, a) -
        manhattanDistance(snappedCenter, b)
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
   *  Đánh giá một vị trí để đặt bom với safety scoring
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
    let safetyScore = 100; // Start
    const hitChests = new Set<string>();

    const snappedBombPos = snapToGrid(position); // Use unified snap method

    // NEW: Check if position is currently in danger zone
    if (isPositionInDangerZone(position, gameState)) {
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
        if (timeLeft < 2000) {
          return null;
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
      const snappedChest = snapToGrid(c.position);
      return (
        Math.abs(snappedChest.x - snappedBombPos.x) < 20 &&
        Math.abs(snappedChest.y - snappedBombPos.y) < 20
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

        // Kiểm tra có chest không - FIXED: Snap chest positions to grid for comparison
        const chest = (gameState.map.chests || []).find((c) => {
          const snappedChest = snapToGrid(c.position);
          return (
            Math.abs(snappedChest.x - checkPos.x) < 20 &&
            Math.abs(snappedChest.y - checkPos.y) < 20
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
          }
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
          break;
        }
      }
    }

    // NEW: Bonus for multiple escape routes
    const escapeRoutes = this.countEscapeRoutes(snappedBombPos, gameState);
    safetyScore += escapeRoutes * 5;

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
   * IMPROVED: Kiểm tra có thể thoát sau khi đặt bom không - xét tất cả bombs trên map
   */
  private canEscapeAfterBombAdvanced(
    bombPosition: Position,
    gameState: GameState
  ): boolean {
    // QUAN TRỌNG: Snap bomb position về grid (bom được căn về ô nó thuộc)
    const snappedBombPos = snapToGrid(bombPosition);

    // Mô phỏng việc đặt bom (sử dụng vị trí đã snap)
    const simulatedBomb = {
      id: "temp-wallbreaker-advanced",
      position: snappedBombPos,
      ownerId: gameState.currentBot.id,
      timeRemaining: 5000,
      flameRange: gameState.currentBot.flameRange,
    };

    // NEW: Create temporary game state with simulated bomb ADDED
    const tempGameState: GameState = {
      ...gameState,
      map: {
        ...gameState.map,
        bombs: [...gameState.map.bombs, simulatedBomb], // Include ALL bombs
      },
    };

    // IMPROVED: Check distance to existing bombs for smarter decision

    // Check if position is in danger with new bomb (using improved detection)
    const isInDanger = isPositionInDangerZone(snappedBombPos, tempGameState);

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

    if (!canEscape) {
      console.log(
        `⚠️  DANGER: Bot would be trapped with ${tempGameState.map.bombs.length} bombs on map!`
      );
    }

    return canEscape;
  }

  /**
   * Check if current plan needs replanning
   */
  private shouldReplan(gameState: GameState): boolean {
    if (!this.currentPlan) return true;

    // 1. Plan too old (timeout after 5 seconds)
    const planAge = Date.now() - this.currentPlan.plannedAt;
    if (planAge > 5000) {
      console.log(`🔄 Plan expired (${planAge}ms old), replanning`);
      return true;
    }

    // 2. Target no longer valid (chest destroyed/targeted)
    const targetStillValid = this.isTargetStillValid(
      this.currentPlan.bombPosition,
      gameState
    );
    if (!targetStillValid) {
      console.log(`🔄 Target no longer valid, replanning`);
      return true;
    }

    // 3. Path blocked by new obstacles
    const pathBlocked = this.isPathBlocked(this.currentPlan.path, gameState);
    if (pathBlocked) {
      console.log(`🔄 Path blocked by obstacles, replanning`);
      return true;
    }

    // 4. CRITICAL: Path goes through danger zone (new bombs)
    const pathDangerous = this.isPathDangerous(
      this.currentPlan.path,
      gameState
    );
    if (pathDangerous) {
      console.log(`🔄 Path goes through danger zone, replanning`);
      return true;
    }

    return false; // Plan is still good
  }

  /**
   * Check if path goes through danger zones
   */
  private isPathDangerous(path: Position[], gameState: GameState): boolean {
    // Check if any position in path is in danger zone
    for (const pos of path) {
      if (isPositionInDangerZone(pos, gameState)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if path is blocked by walls/chests
   */
  private isPathBlocked(path: Position[], gameState: GameState): boolean {
    for (const pos of path) {
      if (!canMoveTo(pos, gameState)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if target position still has chests to break
   */
  private isTargetStillValid(bombPos: Position, gameState: GameState): boolean {
    const evaluation = this.evaluateBombPosition(bombPos, gameState);
    return evaluation !== null && evaluation.chestsCount > 0;
  }
}
