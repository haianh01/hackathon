import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Position,
  Direction,
} from "../types";
import {
  calculateBombScore,
  isPositionSafe,
  getSafeAdjacentPositions,
  // Use unified collision system
  canMoveTo,
  isBlocked,
  PLAYER_SIZE,
  CELL_SIZE,
  cellToPixel,
  pixelToCell,
} from "../utils";
import { Pathfinding, canEscapeFromBomb } from "../utils/pathfinding";
import { manhattanDistance, getPositionInDirection } from "../utils/position";

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

  // FIXED: Add progress tracking to prevent infinite loops
  private lastTargetPosition: Position | null = null;
  private noProgressCount = 0;
  private readonly MAX_NO_PROGRESS = 5; // Max attempts without progress

  evaluate(gameState: GameState): BotDecision | null {
    console.log(`\n🧱 === WallBreakerStrategy EVALUATION START ===`);
    const currentPos = gameState.currentBot.position;
    console.log(`📍 Bot position: (${currentPos.x}, ${currentPos.y})`);
    console.log(`💣 Bomb count: ${gameState.currentBot.bombCount}`);
    console.log(`🔥 Flame range: ${gameState.currentBot.flameRange}`);
    console.log(`⚡ Bot speed: ${gameState.currentBot.speed || 1}`);

    // Update bomb tracking before evaluation
    this.updateBombTracking(gameState);

    console.log(`📊 Bomb tracking status:`);
    console.log(`  Active bombs: ${this.placedBombs.size}`);
    console.log(`  Destroyed chests tracked: ${this.destroyedChests.size}`);

    // Log active bomb targets
    for (const [bombKey, bombInfo] of this.placedBombs.entries()) {
      const timeLeft = 5000 - (Date.now() - bombInfo.placedAt);
      console.log(
        `  💣 Bomb at ${bombKey}: ${
          bombInfo.targetChests.length
        } targets, ${Math.max(0, timeLeft)}ms left`
      );
    }

    // Kiểm tra xem có thể đặt bom không
    if (gameState.currentBot.bombCount <= 0) {
      console.log(
        `❌ WallBreakerStrategy: Không có bom (bombCount: ${gameState.currentBot.bombCount})`
      );
      console.log(`🧱 === WallBreakerStrategy EVALUATION END (NO BOMBS) ===\n`);
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

    console.log(`🏛️ Chest analysis:`);
    console.log(`  Total chests: ${allChests.length}`);
    console.log(`  Available chests: ${availableChests.length}`);
    console.log(
      `  Targeted by bombs: ${
        allChests.length - availableChests.length - this.destroyedChests.size
      }`
    );
    console.log(`  Already destroyed: ${this.destroyedChests.size}`);
    // destructibleWalls.forEach((chest, index) => {
    //   console.log(
    //     `  Chest ${index + 1}: (${chest.position.x}, ${chest.position.y})`
    //   );
    // });

    if (availableChests.length === 0) {
      console.log(
        `❌ WallBreakerStrategy: Không có tường phá được (hoặc đã được target)`
      );
      console.log(
        `🧱 === WallBreakerStrategy EVALUATION END (NO TARGETS) ===\n`
      );
      return null;
    }

    // Tìm vị trí tối ưu để đặt bom (có thể ở vị trí hiện tại hoặc cần di chuyển)
    console.log(`🔍 Finding optimal bomb position...`);
    const bestPosition = this.findOptimalBombPosition(
      gameState,
      availableChests
    );

    if (!bestPosition) {
      console.log(`❌ WallBreakerStrategy: Không tìm thấy vị trí tối ưu`);
      console.log(
        `🧱 === WallBreakerStrategy EVALUATION END (NO OPTIMAL) ===\n`
      );
      return null;
    }

    console.log(`✅ Found optimal position!`);
    console.log(
      `🎯 Optimal position: (${bestPosition.position.x}, ${bestPosition.position.y})`
    );
    console.log(
      `💯 Score: ${bestPosition.score}, Chests: ${bestPosition.chestsCount}`
    );

    // Nếu đã ở vị trí tối ưu, đặt bom
    const distanceToOptimal = manhattanDistance(
      currentPos,
      bestPosition.position
    );
    console.log(`🎯 WallBreakerStrategy DEBUG: Checking position optimality`);
    console.log(`📍 Current position: (${currentPos.x}, ${currentPos.y})`);
    console.log(
      `🎯 Best position: (${bestPosition.position.x}, ${bestPosition.position.y})`
    );
    console.log(
      `📏 Distance to optimal: ${distanceToOptimal} pixels (threshold: 20)`
    );
    console.log(
      `💯 Best position score: ${bestPosition.score}, chests: ${bestPosition.chestsCount}`
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

      console.log(`🔍 DEBUG Bomb check:`);
      console.log(
        `  📍 Current bot position: (${gameState.currentBot.position.x}, ${gameState.currentBot.position.y})`
      );
      console.log(
        `  🎯 Best position: (${bestPosition.position.x}, ${bestPosition.position.y})`
      );
      console.log(
        `  📍 Snapped bomb position: (${snappedBombPos.x}, ${snappedBombPos.y})`
      );
      console.log(`  💣 Existing bombs: ${gameState.map.bombs.length}`);

      gameState.map.bombs.forEach((bomb, index) => {
        const snappedExisting = snapToGrid(bomb.position);
        const dist = manhattanDistance(snappedExisting, snappedBombPos);
        console.log(
          `    Bomb ${index + 1}: (${bomb.position.x}, ${
            bomb.position.y
          }) -> snapped: (${snappedExisting.x}, ${
            snappedExisting.y
          }), distance: ${dist}`
        );
      });

      if (existingBomb) {
        console.log(
          `❌ WallBreakerStrategy: Đã có bom tại vị trí grid này rồi! Bom ID: ${existingBomb.id}`
        );
        console.log(
          `🧱 === WallBreakerStrategy EVALUATION END (BOMB EXISTS) ===\n`
        );
        return null; // Không đặt bom nữa
      }

      // Debug bomb simulation
      const simulatedBomb = {
        id: "temp-wallbreaker-debug",
        position: bestPosition.position,
        ownerId: gameState.currentBot.id,
        timeRemaining: 5000,
        flameRange: gameState.currentBot.flameRange,
      };
      console.log(`💣 DEBUG Simulated bomb:`, {
        position: simulatedBomb.position,
        flameRange: simulatedBomb.flameRange,
        timeRemaining: simulatedBomb.timeRemaining,
      });

      const canEscape = this.canEscapeAfterBombAdvanced(
        bestPosition.position,
        gameState
      );

      console.log(
        `🚪 Escape check result: ${
          canEscape ? "CÓ THỂ THOÁT" : "KHÔNG THỂ THOÁT"
        }`
      );

      if (!canEscape) {
        console.log(
          `❌ WallBreakerStrategy: Không thể thoát sau khi đặt bom - HỦY BỎ`
        );
        console.log(`⚠️  DEBUG: Bot sẽ chết nếu đặt bom tại vị trí này`);
        return null;
      }

      const finalPriority = this.priority + bestPosition.score / 10;
      console.log(`💥 WallBreakerStrategy: ĐANG ĐẶT BOM!`);
      console.log(
        `📊 Final priority: ${finalPriority} (base: ${this.priority} + bonus: ${
          bestPosition.score / 10
        })`
      );
      console.log(
        `🎯 Targets: ${bestPosition.chestsCount} chests, total score: ${bestPosition.score}`
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

    // FIXED: Check for progress toward target to prevent infinite loops
    const targetPosition = bestPosition.position;
    const targetKey = `${targetPosition.x},${targetPosition.y}`;
    const lastTargetKey = this.lastTargetPosition
      ? `${this.lastTargetPosition.x},${this.lastTargetPosition.y}`
      : null;

    if (lastTargetKey === targetKey) {
      this.noProgressCount++;
      console.log(`⚠️ Same target for ${this.noProgressCount} attempts`);

      if (this.noProgressCount >= this.MAX_NO_PROGRESS) {
        console.log(
          `🛑 Infinite loop detected! Abandoning target after ${this.MAX_NO_PROGRESS} attempts`
        );
        console.log(
          `🧱 === WallBreakerStrategy EVALUATION END (LOOP PREVENTION) ===\n`
        );
        this.lastTargetPosition = null;
        this.noProgressCount = 0;
        return null;
      }
    } else {
      // New target or progress made, reset counter
      this.lastTargetPosition = targetPosition;
      this.noProgressCount = 0;
    }

    // Nếu chưa ở vị trí tối ưu, di chuyển đến đó bằng pathfinding
    console.log(`🚶 WallBreakerStrategy: Cần di chuyển đến vị trí tối ưu...`);

    // Use pathfinding to find route to optimal position
    console.log(`🗺️ DEBUG: Calling pathfinding...`);
    console.log(`  From: (${currentPos.x}, ${currentPos.y})`);
    console.log(
      `  To: (${bestPosition.position.x}, ${bestPosition.position.y})`
    );

    const path = Pathfinding.findPath(
      currentPos,
      bestPosition.position,
      gameState
    );

    console.log(
      `🗺️ Pathfinding result:`,
      path ? `Found path with ${path.length} steps` : "No path found"
    );
    if (path && path.length > 0) {
      console.log(
        `🛤️ Full path:`,
        path.map((p, i) => `${i}: (${p.x}, ${p.y})`).join(" -> ")
      );
    }

    if (path && path.length > 1) {
      // Get next step in path (path[0] is current position, path[1] is next step)
      const nextStep = path[1];

      if (nextStep) {
        // FIXED: Ensure Y-coordinate alignment to prevent position mismatch
        const alignedNextStep = {
          x: nextStep.x,
          y: currentPos.y, // Keep same Y to avoid coordinate mismatch
        };

        console.log(`🔧 Original next step: (${nextStep.x}, ${nextStep.y})`);
        console.log(
          `🔧 Aligned next step: (${alignedNextStep.x}, ${alignedNextStep.y})`
        );

        const direction = this.getDirectionToPosition(
          currentPos,
          alignedNextStep
        );

        if (direction) {
          const movePriority = this.priority - 5;
          console.log(`🗺️ Using pathfinding to reach optimal position`);
          console.log(`📍 Current: (${currentPos.x}, ${currentPos.y})`);
          console.log(
            `🎯 Next step: (${alignedNextStep.x}, ${alignedNextStep.y})`
          );
          console.log(
            `🏁 Final target: (${bestPosition.position.x}, ${bestPosition.position.y})`
          );
          console.log(`🛤️ Path length: ${path.length} steps`);
          console.log(
            `➡️  WallBreakerStrategy: Di chuyển ${direction} theo pathfinding`
          );
          console.log(
            `📊 Move priority: ${movePriority} (base: ${this.priority} - 5)`
          );
          console.log(`📏 Distance remaining: ${distanceToOptimal} pixels`);
          console.log(
            `🧱 === WallBreakerStrategy EVALUATION END (PATHFINDING) ===\n`
          );

          return this.createDecision(
            BotAction.MOVE,
            movePriority,
            `Di chuyển đến vị trí phá tường tối ưu`,
            direction
          );
        } else {
          console.log(`❌ Cannot determine direction to next step`);
        }
      } else {
        console.log(`❌ Invalid path - no next step found`);
      }
    } else {
      console.log(`❌ No path found to optimal position`);
      console.log(`🤔 Trying simple direction as fallback...`);

      // Fallback to simple direction
      const direction = this.getDirectionToPosition(
        currentPos,
        bestPosition.position
      );

      if (direction) {
        const movePriority = this.priority - 5;
        console.log(
          `➡️  WallBreakerStrategy: Di chuyển ${direction} đến vị trí tối ưu (fallback)`
        );
        console.log(
          `📊 Move priority: ${movePriority} (base: ${this.priority} - 5)`
        );
        console.log(
          `🎯 Target: (${bestPosition.position.x}, ${bestPosition.position.y})`
        );
        console.log(`📏 Distance remaining: ${distanceToOptimal} pixels`);
        console.log(`🧱 === WallBreakerStrategy EVALUATION END (MOVING) ===\n`);

        return this.createDecision(
          BotAction.MOVE,
          movePriority,
          `Di chuyển đến vị trí phá tường tối ưu`,
          direction
        );
      } else {
        console.log(
          `❌ WallBreakerStrategy: Hoàn toàn không thể di chuyển đến target`
        );
        console.log(`🤔 Delta X: ${bestPosition.position.x - currentPos.x}`);
        console.log(`🤔 Delta Y: ${bestPosition.position.y - currentPos.y}`);

        // Try to find alternative bomb position closer to current location
        console.log(`🔄 Searching for alternative bomb positions...`);
        const alternativePosition = this.findAlternativeBombPosition(
          gameState,
          currentPos
        );

        if (alternativePosition) {
          console.log(
            `🎯 Found alternative position: (${alternativePosition.position.x}, ${alternativePosition.position.y})`
          );
          console.log(
            `💯 Alternative score: ${alternativePosition.score}, chests: ${alternativePosition.chestsCount}`
          );

          const altDistance = manhattanDistance(
            currentPos,
            alternativePosition.position
          );
          if (altDistance <= 20) {
            // Close enough to bomb
            const finalPriority =
              this.priority + alternativePosition.score / 10;
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
                altDirection
              );
            }
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
   * Clean up expired bomb tracking and update destroyed chests
   */
  private updateBombTracking(gameState: GameState): void {
    const currentTime = Date.now();
    const BOMB_LIFETIME = 5000; // 5 seconds

    // Remove expired bombs and mark chests as destroyed
    for (const [bombKey, bombInfo] of this.placedBombs.entries()) {
      if (currentTime - bombInfo.placedAt > BOMB_LIFETIME) {
        console.log(
          `💥 Bomb at ${bombKey} expired, marking ${bombInfo.targetChests.length} chests as destroyed`
        );

        // Mark target chests as destroyed
        bombInfo.targetChests.forEach((chest) => {
          const chestKey = `${chest.x},${chest.y}`;
          this.destroyedChests.add(chestKey);
        });

        this.placedBombs.delete(bombKey);
      }
    }

    // Clean up destroyed chests that no longer exist in game state
    const currentChests = new Set(
      (gameState.map.chests || []).map((c) => `${c.position.x},${c.position.y}`)
    );

    for (const chestKey of this.destroyedChests) {
      if (!currentChests.has(chestKey)) {
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
      bestPosition = currentPos;
      bestScore = currentEval.score;
      bestChestsCount = currentEval.chestsCount;

      // IMPORTANT: Nếu vị trí hiện tại đã có thể hit chests, trả về luôn!
      console.log(`🎯 EARLY RETURN: Current position is already optimal!`);
      this.cachedBestPosition = bestPosition;
      this.lastEvaluationTime = currentTime;
      return {
        position: bestPosition,
        score: bestScore,
        chestsCount: bestChestsCount,
      };
    } else {
      console.log(`❌ Current position cannot hit any chests`);
    } // Tìm kiếm các vị trí tối ưu trong phạm vi hợp lý
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

      const evaluation = this.evaluateBombPosition(candidatePos, gameState);
      if (!evaluation || evaluation.chestsCount === 0) continue;

      // Debug log cho candidate position
      console.log(
        `🎯 Candidate (${candidatePos.x}, ${candidatePos.y}): ${evaluation.chestsCount} chests, score: ${evaluation.score}, distance: ${distance}px`
      );

      // Tính điểm tổng hợp (kết hợp số tường phá được và khoảng cách)
      const distancePenalty = distance * 2; // Penalty cho khoảng cách xa
      const adjustedScore = evaluation.score - distancePenalty;

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
      }
    }

    if (bestPosition) {
      this.cachedBestPosition = bestPosition;
      this.lastEvaluationTime = currentTime;

      return {
        position: bestPosition,
        score: bestScore,
        chestsCount: bestChestsCount,
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
   * Đánh giá một vị trí để đặt bom
   */
  private evaluateBombPosition(
    position: Position,
    gameState: GameState
  ): {
    score: number;
    chestsCount: number;
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

    // Đánh giá tại vị trí bom (sử dụng vị trí đã snap)
    const chestAtBomb = (gameState.map.chests || []).find(
      (c) =>
        Math.abs(c.position.x - snappedBombPos.x) < 20 &&
        Math.abs(c.position.y - snappedBombPos.y) < 20
    );
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

        // Kiểm tra có chest không
        const chest = (gameState.map.chests || []).find(
          (c) =>
            Math.abs(c.position.x - checkPos.x) < 20 &&
            Math.abs(c.position.y - checkPos.y) < 20
        );

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
        }

        // Kiểm tra có enemy không
        const enemy = gameState.enemies.find(
          (e) =>
            Math.abs(e.position.x - checkPos.x) < 30 &&
            Math.abs(e.position.y - checkPos.y) < 30
        );
        if (enemy) {
          totalScore += 200; // Điểm cao cho việc tấn công enemy
        }

        // Kiểm tra tường cứng (dừng flame)
        const solidWall = gameState.map.walls.find(
          (w) =>
            Math.abs(w.position.x - checkPos.x) < 20 &&
            Math.abs(w.position.y - checkPos.y) < 20
        );
        if (solidWall) {
          break; // Tường cứng chặn flame
        }
      }
    }

    console.log(
      `   💯 Final result: ${chestsCount} chests, total score: ${totalScore}`
    );
    return chestsCount > 0 ? { score: totalScore, chestsCount } : null;
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
   * Kiểm tra có thể thoát sau khi đặt bom không (phiên bản cải tiến với debug)
   */
  private canEscapeAfterBombAdvanced(
    bombPosition: Position,
    gameState: GameState
  ): boolean {
    console.log(
      `🚪 DEBUG canEscapeAfterBombAdvanced: Starting escape analysis...`
    );
    console.log(`💣 Bomb position: (${bombPosition.x}, ${bombPosition.y})`);
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

    // Log existing bombs for context
    console.log(`💥 Existing bombs on map: ${gameState.map.bombs.length}`);
    gameState.map.bombs.forEach((bomb, index) => {
      console.log(
        `  Bomb ${index + 1}: (${bomb.position.x}, ${
          bomb.position.y
        }) - range: ${bomb.flameRange}, time: ${bomb.timeRemaining}`
      );
    });

    // Sử dụng pathfinding algorithm để kiểm tra escape (với snapped position)
    const canEscape = canEscapeFromBomb(
      snappedBombPos,
      simulatedBomb,
      gameState
    );

    console.log(
      `🚪 Escape result: ${canEscape ? "✅ CAN ESCAPE" : "❌ CANNOT ESCAPE"}`
    );

    if (!canEscape) {
      console.log(`⚠️  DANGER: Bot would be trapped if bomb is placed here!`);
      console.log(`💡 Suggestion: Try moving to a different position first`);
    } else {
      console.log(`✅ SAFE: Bot can escape after placing bomb`);
    }

    return canEscape;
  }

  /**
   * Kiểm tra có thể thoát sau khi đặt bom không (sử dụng phiên bản cải tiến)
   */
  private canEscapeAfterBomb(
    bombPosition: Position,
    gameState: GameState
  ): boolean {
    return this.canEscapeAfterBombAdvanced(bombPosition, gameState);
  }
}
