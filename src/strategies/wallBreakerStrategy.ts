import { BaseStrategy } from "./baseStrategy";
import {
  GameState,
  BotDecision,
  BotAction,
  Position,
  Direction,
} from "../types";
import { canMoveTo, cellToPixel, pixelToCell, getPositionInDirection } from "../utils";
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
  private readonly MAX_STUCK_FRAMES = 30; // Increased from 15 to 30 (6 seconds at 200ms/frame)

  evaluate(gameState: GameState): BotDecision | null {
    console.log(`\n🧱 === WallBreakerStrategy EVALUATION START ===`);
    const currentPos = gameState.currentBot.position;

    // Update bomb tracking before evaluation
    this.updateBombTracking(gameState);

    console.log(`📊 Bomb tracking status:`);
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

    // DEBUG: Log first 5 chest positions to see if they're on grid
    if (availableChests.length > 0) {
      console.log(`📦 Sample chest positions (first 5):`);
      availableChests.slice(0, 5).forEach((chest, index) => {
        const snappedX = Math.round(chest.position.x / 40) * 40;
        const snappedY = Math.round(chest.position.y / 40) * 40;
        const isOnGrid = chest.position.x === snappedX && chest.position.y === snappedY;
        console.log(
          `  Chest ${index + 1}: (${chest.position.x}, ${chest.position.y}) ${isOnGrid ? '✅ ON GRID' : `❌ OFF GRID (snapped: ${snappedX}, ${snappedY})`}`
        );
      });
    }

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

    // SIMPLIFIED: Just check if close enough to optimal position
    // Grid alignment is NOT critical since bomb will snap to grid automatically
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

      const finalPriority = this.calculateDynamicPriority(
        bestPosition,
        gameState
      );
      console.log(`💥 WallBreakerStrategy: ĐANG ĐẶT BOM!`);
      console.log(`📊 Final priority: ${finalPriority}`);
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

    // IMPROVED: Enhanced progress checking to prevent infinite loops
    if (!this.checkProgressAndPreventLoop(currentPos, bestPosition.position)) {
      console.log(`🔄 Stuck detected, trying alternative strategy...`);
      console.log(
        `🧱 === WallBreakerStrategy EVALUATION END (STUCK PREVENTION) ===\n`
      );

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
        const direction = this.getDirectionToPosition(currentPos, nextStep);

        if (direction) {
          const movePriority = this.priority - 5;
          console.log(`🗺️ Using pathfinding to reach optimal position`);
          console.log(`📍 Current: (${currentPos.x}, ${currentPos.y})`);

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
   * IMPROVED: Clean up expired bomb tracking and update destroyed chests based on actual game state
   */
  private updateBombTracking(gameState: GameState): void {
    console.log(`🔄 Updating bomb tracking...`);

    // 1. Sync with actual bombs on map (source of truth)
    const currentBombKeys = new Set(
      gameState.map.bombs.map((b) => {
        const snapped = snapToGrid(b.position);
        return `${snapped.x},${snapped.y}`;
      })
    );

    console.log(`   Current bombs on map: ${currentBombKeys.size}`);
    console.log(`   Tracked bombs: ${this.placedBombs.size}`);

    // 2. Remove tracked bombs that no longer exist (exploded)
    for (const [bombKey, bombInfo] of this.placedBombs.entries()) {
      if (!currentBombKeys.has(bombKey)) {
        console.log(
          `💥 Bomb at ${bombKey} exploded, checking actual chest status...`
        );

        // 3. IMPROVED: Only mark chests as destroyed if they ACTUALLY disappeared
        bombInfo.targetChests.forEach((chest) => {
          const chestKey = `${chest.x},${chest.y}`;
          const stillExists = (gameState.map.chests || []).some(
            (c) =>
              Math.abs(c.position.x - chest.x) < 20 &&
              Math.abs(c.position.y - chest.y) < 20
          );

          if (!stillExists) {
            this.destroyedChests.add(chestKey);
            console.log(`  ✅ Chest at ${chestKey} confirmed destroyed`);
          } else {
            console.log(
              `  ⚠️ Chest at ${chestKey} still exists (wall blocked?)`
            );
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
        console.log(
          `🆕 Confirmed our bomb at ${bombKey} targeting ${targetChests.length} chests`
        );
      }
    }

    // 5. Clean up destroyed chests that respawned or were incorrectly marked
    const currentChestKeys = new Set(
      (gameState.map.chests || []).map((c) => `${c.position.x},${c.position.y}`)
    );

    for (const chestKey of this.destroyedChests) {
      if (currentChestKeys.has(chestKey)) {
        this.destroyedChests.delete(chestKey);
        console.log(
          `♻️ Chest at ${chestKey} respawned or was incorrectly marked, removing from destroyed list`
        );
      }
    }

    console.log(
      `   Final state: ${this.placedBombs.size} tracked bombs, ${this.destroyedChests.size} destroyed chests`
    );
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
        safetyScore: currentEval.safetyScore,
      };
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
      const closestBomb = gameState.map.bombs.reduce(
        (closest, bomb) => {
          const dist = manhattanDistance(position, bomb.position);
          const closestDist = closest
            ? manhattanDistance(position, closest.position)
            : Infinity;
          return dist < closestDist ? bomb : closest;
        },
        null as typeof gameState.map.bombs[0] | null
      );

      if (closestBomb) {
        const timeLeft = closestBomb.timeRemaining || 5000;
        console.log(`   💣 Closest bomb: ${timeLeft}ms remaining`);
        if (timeLeft < 2000) {
          console.log(`   🚨 CRITICAL: Bomb exploding soon, rejecting position!`);
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
        `   👥 ${nearbyEnemies.length} enemies nearby (-${nearbyEnemies.length * 15} safety)`
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

        // NEW: Check if chest blocks flame (destructible walls also block)
        if (chest) {
          console.log(`      📦 Flame blocked by chest`);
          break; // Flame stops at chest
        }
      }
    }

    // NEW: Bonus for multiple escape routes
    const escapeRoutes = this.countEscapeRoutes(snappedBombPos, gameState);
    safetyScore += escapeRoutes * 5;
    console.log(`   🚪 Escape routes: ${escapeRoutes} (+${escapeRoutes * 5} safety)`);

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
      const dist = manhattanDistance(
        gameState.currentBot.position,
        e.position
      );
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
    console.log(`   + Chest bonus: ${chestBonus} (${bestPosition.chestsCount} chests)`);
    console.log(
      `   + Safety adjustment: ${safetyAdjustment} (safety: ${bestPosition.safetyScore})`
    );
    console.log(`   + Urgency bonus: ${urgencyBonus} (${totalChests} chests left)`);
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
          ...recent.map(pos => Math.abs(pos.x - avgX) + Math.abs(pos.y - avgY))
        );

        const isStuck = maxDeviation < 15; // Less than 15 pixels total movement

        if (isStuck) {
          this.stuckFrameCount++;
          console.log(
            `⚠️ Bot is STUCK at same position for ${this.stuckFrameCount} frames (deviation: ${maxDeviation.toFixed(1)}px)`
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
          console.log(`✅ Bot is moving (deviation: ${maxDeviation.toFixed(1)}px)`);
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
        `  Bomb ${index + 1}: (${bomb.position.x}, ${bomb.position.y}) - range: ${bomb.flameRange}, time: ${bomb.timeRemaining}ms, distance: ${dist}px`
      );
    });

    // NEW: Check if starting position is already safe with new bomb
    if (!isPositionInDangerZone(snappedBombPos, tempGameState)) {
      console.log(`   ✅ Position already safe even with new bomb!`);
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
